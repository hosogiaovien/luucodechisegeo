
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GeometryData, Point, ToolType, SelectionState, Variable, Polygon, TextEntry, TextElement, ElementColor, InfiniteLine, Segment, Circle, Ray, FunctionGraph, ImageElement } from '../types';
import { generateId, distance, isPointOnSegment, getLineEquation, getIntersectionLinear, calculateAngle, evaluateMathExpression } from '../utils/geometry';
import { useHitTest } from './useHitTest';
import { calculateRegularPolygonUpdate, createRegularPolygonData } from '../utils/regularPolygonUtils';
import { resolveConstraints } from '../utils/constraintSolver';
import { applySymmetry, applyRotation } from '../utils/transformationUtils';
import * as htmlToImage from 'html-to-image';

interface UseCanvasProps {
  data: GeometryData;
  setData: (data: GeometryData | ((prev: GeometryData) => GeometryData)) => void;
  activeTool: ToolType;
  currentStrokeWidth: number;
  currentPointSize: number;
  currentLineStyle: any;
  currentFillStyle: any;
  currentFillColor: string;
  autoLabelPoints: boolean;
  showHidden: boolean;
  showAxes: boolean;
  gridSize: number;
  currentArrowStyle: any;
  arcFillMode: any;
  arcModeMajor: boolean;
}

export const useCanvas = (
    svgRef: React.RefObject<SVGSVGElement>,
    props: UseCanvasProps
) => {
    const { data, setData, activeTool, gridSize } = props;

    // --- STATE ---
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [activePoints, setActivePoints] = useState<string[]>([]);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    
    // Selection
    const [selectedElements, setSelectedElements] = useState<SelectionState[]>([]);
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    
    // Export Area State
    const [exportBox, setExportBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    const [isDrawingExport, setIsDrawingExport] = useState(false);

    // Interaction
    const [isPanning, setIsPanning] = useState(false);
    const [draggedIds, setDraggedIds] = useState<string[]>([]);
    const [draggedLabelId, setDraggedLabelId] = useState<string | null>(null);
    const [draggedFunctionLabelId, setDraggedFunctionLabelId] = useState<string | null>(null);
    
    // Resize State for Images
    const [resizeState, setResizeState] = useState<{ 
        id: string, 
        handle: string, 
        startPos: {x:number, y:number}, 
        startDims: {x:number, y:number, w:number, h:number, rotation: number} 
    } | null>(null);

    // Text & Dialogs
    const [textEntry, setTextEntry] = useState<TextEntry | null>(null);
    const [dialogType, setDialogType] = useState<'angle' | 'segment' | 'point_coord' | 'circle_fixed' | 'function_graph' | 'polygon_regular' | 'rotate_angle' | null>(null);
    const [dialogValues, setDialogValues] = useState({ v1: '', v2: '', angleDir: 'ccw' as 'ccw' | 'cw' });
    const [rotationAngle, setRotationAngle] = useState<string>(''); // Store rotation angle

    // Hit Test
    const { findHitPoint, findHitText, findHitCircle, findHitArc, findHitAngle, findHitEllipse, findHitEllipticalArc, findHitPolygon, findHitLineLike, findHitFunctionGraph, findHitAxis } = useHitTest({ data, zoom, showHidden: props.showHidden, gridSize });
    
    const [hoveredElement, setHoveredElement] = useState<{ type: string, id: string } | null>(null);
    const lastPanRef = useRef({ x: 0, y: 0 });

    // --- HELPERS ---
    const getMouseCoords = useCallback((e: React.MouseEvent | MouseEvent | React.WheelEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - pan.x) / zoom,
            y: (e.clientY - rect.top - pan.y) / zoom
        };
    }, [pan, zoom]);

    const createNextPointLabel = (currentPoints: Point[]) => { 
        if (!props.autoLabelPoints) return undefined; 
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; 
        const usedLabels = new Set(currentPoints.map(p => p.label)); 
        for (let char of alphabet) { 
            if (!usedLabels.has(char)) return char; 
        } 
        return undefined; 
    };

    const resetView = () => {
        if (svgRef.current) {
            const { clientWidth, clientHeight } = svgRef.current;
            setPan({ x: clientWidth / 2, y: clientHeight / 2 });
            setZoom(1);
        }
    };

    // --- EFFECTS ---
    
    // 1. Handle Space key for Panning
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) setIsSpacePressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') setIsSpacePressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // 2. Auto-center Axis on Mount
    useEffect(() => {
        if (svgRef.current && pan.x === 0 && pan.y === 0) {
            const { clientWidth, clientHeight } = svgRef.current;
            setPan({ x: clientWidth / 2, y: clientHeight / 2 });
        }
    }, [svgRef.current]);

    // 3. Tool initialization logic
    useEffect(() => {
        if (activeTool !== ToolType.SELECT_AREA) {
            setSelectionBox(null);
            // DO NOT clear exportBox immediately to let user see what they selected before changing tool
            setIsDrawingExport(false);
        }
        
        setActivePoints([]);
        setSelectionStart(null);
        setDraggedIds([]);
        setDraggedLabelId(null);
        setDraggedFunctionLabelId(null);
        setTextEntry(null);
        
        if (activeTool !== ToolType.SELECT) setSelectedElements([]);
        
        setDialogType(null);
        if (activeTool === ToolType.POINT_COORD) {
            setDialogType('point_coord');
            setDialogValues(prev => ({...prev, v1: '0', v2: '0'}));
        } else if (activeTool === ToolType.FUNCTION_GRAPH) {
            setDialogType('function_graph');
            setDialogValues(prev => ({...prev, v1: ''}));
        } else if (activeTool === ToolType.POLYGON_REGULAR) {
            setDialogType('polygon_regular');
            setDialogValues(prev => ({...prev, v1: '5', v2: '3'}));
        } else if (activeTool === ToolType.ROTATE) {
            setDialogType('rotate_angle');
            setDialogValues(prev => ({...prev, v1: '90'}));
        }
    }, [activeTool]);

    // 4. Auto-update Constraints
    useEffect(() => {
        if (draggedIds.length === 0) {
            const resolvedPoints = resolveConstraints(
                data.points, data.lines, data.segments, data.rays, data.functionGraphs, data.variables, gridSize
            );
            const hasChanges = resolvedPoints.some((p, i) => {
                const oldP = data.points[i];
                return !oldP || Math.abs(p.x - oldP.x) > 1e-4 || Math.abs(p.y - oldP.y) > 1e-4;
            });
            if (hasChanges) setData(prev => ({ ...prev, points: resolvedPoints }));
        }
    }, [data.variables, data.functionGraphs, data.lines, data.segments, gridSize, draggedIds.length]);


    // --- EVENT HANDLERS ---

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scale = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(10, zoom * scale));
        
        if (svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const newPan = {
                x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
                y: mouseY - (mouseY - pan.y) * (newZoom / zoom)
            };
            setPan(newPan);
            setZoom(newZoom);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const coords = getMouseCoords(e);
        let { x, y } = coords; // These are World Coordinates
        
        // --- FORCE AXIS ALIGNMENT (SNAP) ON MOUSE DOWN ---
        // This ensures the point created is strictly on the axis even if mouse is slightly off
        if (e.shiftKey && activePoints.length > 0) {
            const allowedTools = [ToolType.SEGMENT, ToolType.LINE, ToolType.RAY, ToolType.POLYGON, ToolType.CYLINDER, ToolType.CONE];
            if (allowedTools.includes(activeTool)) {
                const lastPointId = activePoints[activePoints.length - 1];
                const lastPoint = data.points.find(p => p.id === lastPointId);
                if (lastPoint) {
                    const dx = Math.abs(x - lastPoint.x);
                    const dy = Math.abs(y - lastPoint.y);
                    // Override the click coordinates to be perfectly aligned
                    if (dx > dy) {
                        y = lastPoint.y; // Horizontal Snap
                    } else {
                        x = lastPoint.x; // Vertical Snap
                    }
                }
            }
        }

        // --- ARC TOOL CONSTRAINT ON MOUSE DOWN ---
        // When clicking the 3rd point, force coordinates to be exactly on the radius circle
        if (activeTool === ToolType.ARC && activePoints.length === 2) {
            const center = data.points.find(p => p.id === activePoints[0]);
            const start = data.points.find(p => p.id === activePoints[1]);
            if (center && start) {
                const radius = Math.hypot(start.x - center.x, start.y - center.y);
                const angle = Math.atan2(y - center.y, x - center.x);
                x = center.x + radius * Math.cos(angle);
                y = center.y + radius * Math.sin(angle);
            }
        }

        // --- ELLIPTICAL ARC TOOL CONSTRAINT ON MOUSE DOWN ---
        // When drawing point 4 (Start) or point 5 (End), snap to the ellipse path
        if (activeTool === ToolType.ELLIPTICAL_ARC && (activePoints.length === 3 || activePoints.length === 4)) {
             const center = data.points.find(p => p.id === activePoints[0]);
             const major = data.points.find(p => p.id === activePoints[1]);
             const minor = data.points.find(p => p.id === activePoints[2]);
             
             if (center && major && minor) {
                 const rx = Math.hypot(major.x - center.x, major.y - center.y);
                 const ry = Math.hypot(minor.x - center.x, minor.y - center.y);
                 const rotation = Math.atan2(major.y - center.y, major.x - center.x);
                 
                 // Transform world mouse to local unrotated ellipse space
                 const dx = x - center.x;
                 const dy = y - center.y;
                 const cos = Math.cos(-rotation);
                 const sin = Math.sin(-rotation);
                 const lx = dx * cos - dy * sin;
                 const ly = dx * sin + dy * cos;
                 
                 // Calculate parametric angle t
                 const t = Math.atan2(ly / ry, lx / rx);
                 
                 // Constrain local point to ellipse
                 const cx_local = rx * Math.cos(t);
                 const cy_local = ry * Math.sin(t);
                 
                 // Transform back to world space
                 const cosR = Math.cos(rotation);
                 const sinR = Math.sin(rotation);
                 
                 x = center.x + cx_local * cosR - cy_local * sinR;
                 y = center.y + cx_local * sinR + cy_local * cosR;
             }
        }

        // 1. Panning
        if (e.button === 1 || (e.button === 0 && isSpacePressed) || (activeTool === ToolType.SELECT && e.buttons === 4)) {
            setIsPanning(true);
            lastPanRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (textEntry) return;

        // 2. Select Area / Export Tool
        // Using World Coordinates (coords) ensures the box sticks to the grid/geometry logic
        if (activeTool === ToolType.SELECT_AREA) {
             setSelectionStart({ x, y }); 
             setIsDrawingExport(true);
             // Init with 0 width/height
             setExportBox({ x, y, width: 0, height: 0 });
             return;
        }

        // Fill Tool
        if (activeTool === ToolType.FILL) {
            const hitPoly = findHitPolygon(x, y); 
            if (hitPoly) { setData(prev => ({ ...prev, polygons: prev.polygons.map(p => p.id === hitPoly.id ? { ...p, fillStyle: props.currentFillStyle, fillColor: props.currentFillColor, fillOpacity: 0.4 } : p) })); return; }
            const hitEllipse = findHitEllipse(x, y); 
            if (hitEllipse) { setData(prev => ({ ...prev, ellipses: prev.ellipses.map(e => e.id === hitEllipse.id ? { ...e, fillStyle: props.currentFillStyle, fillColor: props.currentFillColor, fillOpacity: 0.4 } : e) })); return; }
            const hitCircle = findHitCircle(x, y); 
            if (hitCircle) { setData(prev => ({ ...prev, circles: prev.circles.map(c => c.id === hitCircle.id ? { ...c, fillStyle: props.currentFillStyle, fillColor: props.currentFillColor, fillOpacity: 0.4 } : c) })); return; }
            const hitArc = findHitArc(x, y); 
            if (hitArc) { setData(prev => ({ ...prev, arcs: (prev.arcs || []).map(a => a.id === hitArc.id ? { ...a, fillStyle: props.currentFillStyle, fillColor: props.currentFillColor, fillOpacity: 0.4 } : a) })); return; }
            const hitIntegral = data.integrals?.find(i => { return false; });
            return;
        }

        if (activeTool === ToolType.TEXT) {
            const hitExistingText = findHitText(x, y);
            if (hitExistingText) { 
                setSelectedElements([{ type: 'text', id: hitExistingText.id }]); 
                setDraggedIds([hitExistingText.id]); 
                return; 
            }
            const rect = svgRef.current?.getBoundingClientRect(); 
            const screenX = e.clientX - (rect?.left || 0); 
            const screenY = e.clientY - (rect?.top || 0); 
            e.preventDefault(); 
            setTextEntry({ 
                svgX: x, svgY: y, 
                screenX: screenX - 20, screenY: screenY - 20, 
                value: '', fontSize: 24, color: 'black' 
            }); 
            return;
        }

        if (activeTool === ToolType.IMAGE) {
            return;
        }

        // Selection Logic
        if (activeTool === ToolType.SELECT) {
            const hitPoint = findHitPoint(x, y, 15);
            const hitText = findHitText(x, y);
            const hitLineLike = findHitLineLike(x, y);
            const hitCircle = findHitCircle(x, y);
            const hitEllipse = findHitEllipse(x, y);
            const hitPolygon = findHitPolygon(x, y);
            const hitGraph = findHitFunctionGraph(x, y);
            const hitArc = findHitArc(x, y);
            const hitAngle = findHitAngle(x, y);
            const hitAxis = props.showAxes ? findHitAxis(x, y) : null;
            const hitImage = (data.images || []).slice().reverse().find(img => {
                if (img.hidden) return false;
                const cx = img.x + img.width/2; const cy = img.y + img.height/2;
                const r = (img.rotation || 0) * Math.PI / 180;
                const dx = x - cx; const dy = y - cy;
                const lx = dx * Math.cos(-r) - dy * Math.sin(-r) + cx;
                const ly = dx * Math.sin(-r) + dy * Math.cos(-r) + cy;
                return lx >= img.x && lx <= img.x + img.width && ly >= img.y && ly <= img.y + img.height;
            });

            let target: SelectionState | null = null;
            if (hitPoint) target = { type: 'point', id: hitPoint.id };
            else if (hitText) target = { type: 'text', id: hitText.id };
            else if (hitLineLike) target = { type: hitLineLike.type as any, id: hitLineLike.id };
            else if (hitCircle) target = { type: 'circle', id: hitCircle.id };
            else if (hitArc) target = { type: 'arc', id: hitArc.id };
            else if (hitEllipse) target = { type: 'ellipse', id: hitEllipse.id };
            else if (hitPolygon) target = { type: 'polygon', id: hitPolygon.id };
            else if (hitGraph) target = { type: 'functionGraph', id: hitGraph.id };
            else if (hitAngle) target = { type: 'angle', id: hitAngle.id };
            else if (hitImage) target = { type: 'image', id: hitImage.id };
            else if (hitAxis) target = { type: 'axis', id: hitAxis.id };

            if (target) {
                e.stopPropagation();
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    if (selectedElements.some(el => el.id === target!.id)) {
                        const newSel = selectedElements.filter(el => el.id !== target!.id);
                        setSelectedElements(newSel);
                        setDraggedIds([]);
                    } else {
                        const newSel = [...selectedElements, target];
                        setSelectedElements(newSel);
                        setDraggedIds(newSel.map(s => s.id));
                    }
                } else {
                    if (!selectedElements.some(el => el.id === target!.id)) {
                        setSelectedElements([target]);
                        setDraggedIds([target.id]);
                    } else {
                        setDraggedIds(selectedElements.map(s => s.id));
                    }
                }
            } else {
                if (!e.shiftKey && !e.ctrlKey) setSelectedElements([]);
                // Element Selection Box (Transient)
                setSelectionStart({ x, y });
                setSelectionBox({ x, y, width: 0, height: 0 });
            }
            return;
        }

        // --- DRAWING LOGIC ---
        // ... (Existing drawing logic remains unchanged)
        // [Truncated for brevity]
        const hitPoint = findHitPoint(x, y, 20);
        const hitLineLike = findHitLineLike(x, y);
        const hitGraph = findHitFunctionGraph(x, y);
        const hitAxis = props.showAxes ? findHitAxis(x, y) : null;
        const hitPolygon = findHitPolygon(x, y);

        // TRANSFORMATION TOOLS LOGIC (SYMMETRY & ROTATION)
        if (activeTool === ToolType.SYMMETRY_CENTRAL || activeTool === ToolType.SYMMETRY_AXIAL || activeTool === ToolType.ROTATE) {
            let newActive = [...activePoints];
            
            // Step 1: Select Axis or Center
            if (newActive.length === 0) {
                if ((activeTool === ToolType.SYMMETRY_CENTRAL || activeTool === ToolType.ROTATE) && hitPoint) {
                    newActive.push(hitPoint.id);
                    setActivePoints(newActive);
                } else if (activeTool === ToolType.SYMMETRY_AXIAL && hitLineLike) {
                    newActive.push(hitLineLike.id);
                    setActivePoints(newActive);
                }
            } 
            // Step 2: Select Target Object to Transform
            else {
                const referenceId = newActive[0];
                let targetId: string | undefined;
                let targetType: 'point' | 'segment' | 'polygon' | undefined;

                if (hitPoint) { targetId = hitPoint.id; targetType = 'point'; }
                else if (hitPolygon) { targetId = hitPolygon.id; targetType = 'polygon'; }
                else if (hitLineLike) { targetId = hitLineLike.id; targetType = 'segment'; }

                if (targetId && targetId !== referenceId && targetType) {
                    setData(prev => {
                        let updates: Partial<GeometryData> | null = null;
                        
                        if (activeTool === ToolType.ROTATE) {
                            // Rotation requires an angle
                            if (!rotationAngle) return prev; // Should be set by dialog
                            updates = applyRotation(referenceId, targetId!, targetType!, rotationAngle, prev);
                        } else {
                            // Symmetry
                            updates = applySymmetry(activeTool, referenceId, targetId!, targetType!, prev);
                        }

                        if (updates) {
                            return { ...prev, ...updates };
                        }
                        return prev;
                    });
                    setActivePoints([]); // Reset after operation
                }
            }
            return;
        }

        if (activeTool === ToolType.MIDPOINT) {
             if (hitPoint) {
                const newActive = [...activePoints, hitPoint.id];
                if (newActive.length === 2) {
                    const p1 = data.points.find(p => p.id === newActive[0]);
                    const p2 = data.points.find(p => p.id === newActive[1]);
                    if (p1 && p2) {
                        const mid = { id: generateId('p'), x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, label: createNextPointLabel(data.points), color: 'black' as ElementColor, radius: props.currentPointSize };
                        setData(prev => ({ ...prev, points: [...prev.points, mid] }));
                    }
                    setActivePoints([]);
                } else setActivePoints(newActive);
            } else if (hitLineLike && hitLineLike.type === 'segment') {
                 const seg = hitLineLike.obj as Segment;
                 const p1 = data.points.find(p => p.id === seg.startPointId);
                 const p2 = data.points.find(p => p.id === seg.endPointId);
                 if (p1 && p2) {
                     const mid = { id: generateId('p'), x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, label: createNextPointLabel(data.points), color: 'black' as ElementColor, radius: props.currentPointSize };
                     setData(prev => ({ ...prev, points: [...prev.points, mid] }));
                 }
            }
            return;
        }

        if (activeTool === ToolType.PERPENDICULAR || activeTool === ToolType.PARALLEL) {
             let newActive = [...activePoints];
            if (hitPoint && !newActive.includes(hitPoint.id)) newActive.push(hitPoint.id);
            else if (hitLineLike && !newActive.includes(hitLineLike.id)) newActive.push(hitLineLike.id);
            
            if (newActive.length === 2) {
                const pointId = newActive.find(id => data.points.some(p => p.id === id));
                const lineId = newActive.find(id => !data.points.some(p => p.id === id)); 
                if (pointId && lineId) {
                    const id1 = generateId('p_aux'); const id2 = generateId('p_aux');
                    const newLine: InfiniteLine = { id: generateId('l'), p1Id: id1, p2Id: id2, style: props.currentLineStyle, strokeWidth: props.currentStrokeWidth, color: 'black', constraint: { type: activeTool === ToolType.PERPENDICULAR ? 'perpendicular' : 'parallel', sourceId: lineId, throughPointId: pointId } };
                    setData(prev => {
                        const nextPoints = [...prev.points, { id: id1, x: 0, y: 0, hidden: true }, { id: id2, x: 0, y: 0, hidden: true }];
                        const resolvedPoints = resolveConstraints(nextPoints, [...prev.lines, newLine], prev.segments, prev.rays, prev.functionGraphs, prev.variables, gridSize);
                        return { ...prev, points: resolvedPoints, lines: [...prev.lines, newLine] };
                    });
                }
                setActivePoints([]);
            } else setActivePoints(newActive);
            return;
        }

        if (activeTool === ToolType.INTERSECT) {
             let newActive = [...activePoints];
            if (hitLineLike && !newActive.includes(hitLineLike.id)) newActive.push(hitLineLike.id);
            else if (hitGraph && !newActive.includes(hitGraph.id)) newActive.push(hitGraph.id);
            else if (hitAxis && !newActive.includes(hitAxis.id)) newActive.push(hitAxis.id);

            if (newActive.length === 2) {
                 const id1 = newActive[0];
                 const id2 = newActive[1];
                 const p: Point = { 
                    id: generateId('p'), 
                    x: mousePos.x, 
                    y: mousePos.y, 
                    label: createNextPointLabel(data.points), 
                    color: 'black' as ElementColor, 
                    radius: props.currentPointSize, 
                    constraint: { type: 'intersection', id1: id1, id2: id2 } 
                 };
                 setData(prev => {
                     const nextPoints = [...prev.points, p];
                     const resolved = resolveConstraints(nextPoints, prev.lines, prev.segments, prev.rays, prev.functionGraphs, prev.variables, gridSize);
                     return { ...prev, points: resolved };
                 });
                 setActivePoints([]);
            } else setActivePoints(newActive);
            return;
        }

        let clickedPointId = hitPoint ? hitPoint.id : null;

        if (!clickedPointId && [ToolType.SEGMENT, ToolType.LINE, ToolType.RAY, ToolType.CIRCLE, ToolType.ARC, ToolType.ELLIPSE, ToolType.ELLIPTICAL_ARC, ToolType.POLYGON, ToolType.ANGLE, ToolType.CYLINDER, ToolType.CONE, ToolType.SPHERE, ToolType.POINT, ToolType.ANGLE_FIXED, ToolType.SEGMENT_FIXED, ToolType.CIRCLE_FIXED].includes(activeTool)) {
            let constraint = undefined;
            let newX = x; let newY = y;
            if (hoveredElement) {
                if (hoveredElement.type === 'functionGraph') {
                    const graph = data.functionGraphs?.find(g => g.id === hoveredElement.id);
                    if (graph) {
                        const variableMap: Record<string, number> = {}; (data.variables || []).forEach(v => variableMap[v.name.toLowerCase()] = v.value);
                        const mathX = x / gridSize; 
                        const mathY = evaluateMathExpression(graph.formula, mathX, variableMap);
                        if (!isNaN(mathY)) { newX = mathX * gridSize; newY = -mathY * gridSize; constraint = { type: 'onFunctionGraph', graphId: graph.id, xParam: mathX }; }
                    }
                } else if (hoveredElement.type === 'axis') {
                    if (hoveredElement.id === 'axis-x') { newY = 0; constraint = { type: 'onAxis', axis: 'x' }; } else { newX = 0; constraint = { type: 'onAxis', axis: 'y' }; }
                } else if (hoveredElement.type === 'segment' || hoveredElement.type === 'line' || hoveredElement.type === 'ray') {
                     const linearObj = findHitLineLike(x, y); 
                    if (linearObj) {
                        let pts;
                        if (linearObj.type === 'segment') { const s = linearObj.obj as Segment; pts = [data.points.find(p=>p.id===s.startPointId), data.points.find(p=>p.id===s.endPointId)]; } 
                        else if (linearObj.type === 'line') { const l = linearObj.obj as InfiniteLine; pts = [data.points.find(p=>p.id===l.p1Id), data.points.find(p=>p.id===l.p2Id)]; } 
                        else if (linearObj.type === 'ray') { const r = linearObj.obj as Ray; pts = [data.points.find(p=>p.id===r.startPointId), data.points.find(p=>p.id===r.directionPointId)]; }
                        if (pts && pts[0] && pts[1]) {
                            const p1 = pts[0]; const p2 = pts[1];
                            const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                            const l2 = dx*dx + dy*dy;
                            if (l2 > 0) { const t = ((x - p1.x) * dx + (y - p1.y) * dy) / l2; newX = p1.x + t * dx; newY = p1.y + t * dy; }
                        }
                    }
                } else if (hoveredElement.type === 'circle') {
                    const c = findHitCircle(x, y)?.obj;
                    const center = c ? data.points.find(p => p.id === c.centerId) : null;
                    if (c && center) {
                        let r = c.radiusValue || 50;
                        if (c.radiusPointId) { const rp = data.points.find(p => p.id === c.radiusPointId); if (rp) r = Math.hypot(rp.x - center.x, rp.y - center.y); }
                        const angle = Math.atan2(y - center.y, x - center.x);
                        newX = center.x + r * Math.cos(angle); newY = center.y + r * Math.sin(angle);
                    }
                }
            }

            const newPoint = { id: generateId('p'), x: newX, y: newY, label: createNextPointLabel(data.points), labelOffsetX: 15, labelOffsetY: -15, color: 'black', radius: props.currentPointSize, constraint: constraint as any };
            setData(prev => ({ ...prev, points: [...prev.points, newPoint] }));
            clickedPointId = newPoint.id;
            if (activeTool === ToolType.POINT) return; 
        }

        if (activeTool === ToolType.FUNCTION_GRAPH || activeTool === ToolType.POINT_COORD || activeTool === ToolType.POLYGON_REGULAR) { return; }

        if (clickedPointId) {
             const newActive = [...activePoints, clickedPointId];
            if ([ToolType.SEGMENT, ToolType.LINE, ToolType.RAY, ToolType.CIRCLE, ToolType.SPHERE].includes(activeTool) && newActive.length === 2) {
                 if (activeTool === ToolType.SEGMENT) setData(prev => ({ ...prev, segments: [...(prev.segments || []), { id: generateId('s'), startPointId: newActive[0], endPointId: newActive[1], style: props.currentLineStyle, strokeWidth: props.currentStrokeWidth, color: 'black', arrows: props.currentArrowStyle }] }));
                 else if (activeTool === ToolType.LINE) setData(prev => ({ ...prev, lines: [...(prev.lines || []), { id: generateId('l'), p1Id: newActive[0], p2Id: newActive[1], style: props.currentLineStyle, strokeWidth: props.currentStrokeWidth, color: 'black' }] }));
                 else if (activeTool === ToolType.RAY) setData(prev => ({ ...prev, rays: [...(prev.rays || []), { id: generateId('r'), startPointId: newActive[0], directionPointId: newActive[1], style: props.currentLineStyle, strokeWidth: props.currentStrokeWidth, color: 'black' }] }));
                 else if (activeTool === ToolType.CIRCLE) setData(prev => ({ ...prev, circles: [...(prev.circles || []), { id: generateId('c'), centerId: newActive[0], radiusPointId: newActive[1], color: 'black', style: props.currentLineStyle, strokeWidth: props.currentStrokeWidth, fillStyle: props.currentFillStyle, fillColor: props.currentFillColor }] }));
                 else if (activeTool === ToolType.SPHERE) setData(prev => ({ ...prev, spheres: [...(prev.spheres || []), { id: generateId('sph'), centerId: newActive[0], radiusPointId: newActive[1], color: 'black', strokeWidth: props.currentStrokeWidth }] }));
                 setActivePoints([]);
            } 
            else if ([ToolType.ARC, ToolType.CYLINDER, ToolType.CONE, ToolType.ELLIPSE].includes(activeTool) && newActive.length === 3) {
                if (activeTool === ToolType.ARC) setData(prev => ({ ...prev, arcs: [...(prev.arcs || []), { id: generateId('arc'), centerId: newActive[0], startPointId: newActive[1], endPointId: newActive[2], isMajor: props.arcModeMajor, style: props.currentLineStyle, strokeWidth: props.currentStrokeWidth, color: 'black', fillStyle: props.currentFillStyle, fillColor: props.currentFillColor, fillMode: props.arcFillMode }] }));
                else if (activeTool === ToolType.ELLIPSE) setData(prev => ({ ...prev, ellipses: [...(prev.ellipses || []), { id: generateId('el'), centerId: newActive[0], majorAxisPointId: newActive[1], minorAxisPointId: newActive[2], color: 'black', strokeWidth: props.currentStrokeWidth, fillStyle: props.currentFillStyle, fillColor: props.currentFillColor }] }));
                else if (activeTool === ToolType.CYLINDER) setData(prev => ({ ...prev, cylinders: [...(prev.cylinders || []), { id: generateId('cyl'), bottomCenterId: newActive[0], topCenterId: newActive[1], radiusPointId: newActive[2], strokeWidth: props.currentStrokeWidth, color: 'black' }] }));
                else if (activeTool === ToolType.CONE) setData(prev => ({ ...prev, cones: [...(prev.cones || []), { id: generateId('cone'), apexId: newActive[0], bottomCenterId: newActive[1], radiusPointId: newActive[2], strokeWidth: props.currentStrokeWidth, color: 'black' }] }));
                setActivePoints([]);
            }
            else if (activeTool === ToolType.ELLIPTICAL_ARC && newActive.length === 5) {
                setData(prev => ({ ...prev, ellipticalArcs: [...(prev.ellipticalArcs || []), { id: generateId('ea'), centerId: newActive[0], majorAxisPointId: newActive[1], minorAxisPointId: newActive[2], startPointId: newActive[3], endPointId: newActive[4], isMajor: props.arcModeMajor, fillMode: props.arcFillMode, color: 'black', strokeWidth: props.currentStrokeWidth, fillStyle: props.currentFillStyle, fillColor: props.currentFillColor }] }));
                setActivePoints([]);
            }
            else if (activeTool === ToolType.POLYGON) {
                if (activePoints.length >= 3 && clickedPointId === activePoints[0]) {
                      setData(prev => ({ ...prev, polygons: [...(prev.polygons || []), { id: generateId('poly'), pointIds: activePoints, strokeWidth: props.currentStrokeWidth, color: 'black', fillStyle: props.currentFillStyle, fillColor: props.currentFillColor }] }));
                      setActivePoints([]);
                } else setActivePoints([...activePoints, clickedPointId]);
            }
            else if (activeTool === ToolType.ANGLE && newActive.length === 3) {
                 let isRightAngle = false;
                 const p1 = data.points.find(p => p.id === newActive[0]);
                 const center = data.points.find(p => p.id === newActive[1]);
                 const p2 = data.points.find(p => p.id === newActive[2]);
                 if (p1 && center && p2) {
                     const deg = calculateAngle(p1, center, p2);
                     if (Math.abs(deg - 90) < 3 || Math.abs(deg - 270) < 3) isRightAngle = true;
                 }
                 setData(prev => ({ ...prev, angles: [...(prev.angles || []), { id: generateId('ang'), point1Id: newActive[0], centerId: newActive[1], point2Id: newActive[2], color: 'black', strokeWidth: 1.5, arcCount: 1, hasTick: false, isRightAngle, showLabel: true, fontSize: 14 }] }));
                 setActivePoints([]);
            }
            else if (activeTool === ToolType.ANGLE_FIXED && newActive.length === 2) { setDialogType('angle'); setActivePoints(newActive); setDialogValues(prev => ({ ...prev, v1: '45' })); }
            else if (activeTool === ToolType.SEGMENT_FIXED && newActive.length === 1) { setDialogType('segment'); setActivePoints(newActive); setDialogValues(prev => ({ ...prev, v1: '5' })); }
            else if (activeTool === ToolType.CIRCLE_FIXED && newActive.length === 1) { setDialogType('circle_fixed'); setActivePoints(newActive); setDialogValues(prev => ({ ...prev, v1: '3' })); }
            else setActivePoints(newActive);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const coords = getMouseCoords(e);
        let { x: worldX, y: worldY } = coords; // Use World Coordinates for everything geometry-related
        
        if (isPanning) {
            const dx = e.clientX - lastPanRef.current.x;
            const dy = e.clientY - lastPanRef.current.y;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPanRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // --- SHIFT KEY CONSTRAINT FOR DRAWING (SEGMENT, LINE, RAY, POLYGON, CYLINDER, CONE) ---
        // Force straight lines (horizontal/vertical) when drawing
        // Added ToolType.CYLINDER and ToolType.CONE
        if (e.shiftKey && activePoints.length > 0 && [ToolType.SEGMENT, ToolType.LINE, ToolType.RAY, ToolType.POLYGON, ToolType.CYLINDER, ToolType.CONE].includes(activeTool)) {
             const lastPointId = activePoints[activePoints.length - 1];
             const lastPoint = data.points.find(p => p.id === lastPointId);
             if (lastPoint) {
                 const dx = Math.abs(worldX - lastPoint.x);
                 const dy = Math.abs(worldY - lastPoint.y);
                 if (dx > dy) worldY = lastPoint.y; // Horizontal
                 else worldX = lastPoint.x;         // Vertical
             }
        }

        // --- ARC TOOL CONSTRAINT ---
        // When drawing the 3rd point (End Point), snap the cursor to the circle defined by Center (p[0]) and Start (p[1])
        if (activeTool === ToolType.ARC && activePoints.length === 2) {
            const center = data.points.find(p => p.id === activePoints[0]);
            const start = data.points.find(p => p.id === activePoints[1]);
            if (center && start) {
                const radius = Math.hypot(start.x - center.x, start.y - center.y);
                const angle = Math.atan2(worldY - center.y, worldX - center.x);
                // Constrain the cursor to lie on the circle
                worldX = center.x + radius * Math.cos(angle);
                worldY = center.y + radius * Math.sin(angle);
            }
        }

        // --- ELLIPTICAL ARC TOOL CONSTRAINT ---
        // When drawing point 4 (Start) or point 5 (End), snap to the ellipse defined by points 1, 2, 3
        if (activeTool === ToolType.ELLIPTICAL_ARC && (activePoints.length === 3 || activePoints.length === 4)) {
            const center = data.points.find(p => p.id === activePoints[0]);
            const major = data.points.find(p => p.id === activePoints[1]);
            const minor = data.points.find(p => p.id === activePoints[2]);
            
            if (center && major && minor) {
                const rx = Math.hypot(major.x - center.x, major.y - center.y);
                const ry = Math.hypot(minor.x - center.x, minor.y - center.y);
                const rotation = Math.atan2(major.y - center.y, major.x - center.x);
                
                // Transform world mouse to local unrotated ellipse space
                const dx = worldX - center.x;
                const dy = worldY - center.y;
                const cos = Math.cos(-rotation);
                const sin = Math.sin(-rotation);
                const lx = dx * cos - dy * sin;
                const ly = dx * sin + dy * cos;
                
                // Calculate parametric angle t
                // x = rx * cos(t), y = ry * sin(t)
                const t = Math.atan2(ly / ry, lx / rx);
                
                // Constrain local point to ellipse
                const cx_local = rx * Math.cos(t);
                const cy_local = ry * Math.sin(t);
                
                // Transform back to world space
                const cosR = Math.cos(rotation);
                const sinR = Math.sin(rotation);
                
                worldX = center.x + cx_local * cosR - cy_local * sinR;
                worldY = center.y + cx_local * sinR + cy_local * cosR;
            }
        }

        setMousePos({ x: worldX, y: worldY });

        // Updating Export Box (Select Area Tool)
        if (activeTool === ToolType.SELECT_AREA && isDrawingExport && selectionStart) {
             setExportBox({
                 x: Math.min(selectionStart.x, worldX),
                 y: Math.min(selectionStart.y, worldY),
                 width: Math.abs(worldX - selectionStart.x),
                 height: Math.abs(worldY - selectionStart.y)
             });
             return;
        }

        if (activeTool === ToolType.SELECT) {
            if (resizeState) {
                const { id, handle, startDims } = resizeState;
                const angleRad = (startDims.rotation || 0) * Math.PI / 180;
                const cos = Math.cos(angleRad); const sin = Math.sin(angleRad);
                const ux = { x: cos, y: sin }; const uy = { x: -sin, y: cos };
                const cx = startDims.x + startDims.w / 2; const cy = startDims.y + startDims.h / 2;
                const halfW = startDims.w / 2; const halfH = startDims.h / 2;
                const getCornerRel = (sx: number, sy: number) => ({ x: sx * halfW * ux.x + sy * halfH * uy.x, y: sx * halfW * ux.y + sy * halfH * uy.y });
                let anchorRel = { x: 0, y: 0 }; let moveDir = { x: 0, y: 0 }; 
                if (handle.includes('n')) { anchorRel.y = 1; moveDir.y = -1; } else if (handle.includes('s')) { anchorRel.y = -1; moveDir.y = 1; }
                if (handle.includes('w')) { anchorRel.x = 1; moveDir.x = -1; } else if (handle.includes('e')) { anchorRel.x = -1; moveDir.x = 1; }
                const anchorVec = getCornerRel(anchorRel.x, anchorRel.y);
                const anchorPos = { x: cx + anchorVec.x, y: cy + anchorVec.y };
                const mouseVec = { x: worldX - anchorPos.x, y: worldY - anchorPos.y };
                let newW = startDims.w; let newH = startDims.h;
                if (moveDir.x !== 0) { const proj = mouseVec.x * (moveDir.x * ux.x) + mouseVec.y * (moveDir.x * ux.y); newW = Math.max(10, proj); }
                if (moveDir.y !== 0) { const proj = mouseVec.x * (moveDir.y * uy.x) + mouseVec.y * (moveDir.y * uy.y); newH = Math.max(10, proj); }
                const centerOffset = { x: - (anchorRel.x * newW / 2) * ux.x - (anchorRel.y * newH / 2) * uy.x, y: - (anchorRel.x * newW / 2) * ux.y - (anchorRel.y * newH / 2) * uy.y };
                const newCx = anchorPos.x + centerOffset.x; const newCy = anchorPos.y + centerOffset.y;
                const newX = newCx - newW / 2; const newY = newCy - newH / 2;
                setData(prev => ({ ...prev, images: (prev.images || []).map(img => img.id === id ? { ...img, x: newX, y: newY, width: newW, height: newH } : img) }));
            } else if (draggedFunctionLabelId) {
                  setData(prev => ({ ...prev, functionGraphs: (prev.functionGraphs || []).map(g => g.id === draggedFunctionLabelId ? { ...g, labelX: (g.labelX || 0) + e.movementX / zoom, labelY: (g.labelY || 0) + e.movementY / zoom } : g) }));
            } else if (draggedLabelId) {
                 setData(prev => ({ ...prev, points: prev.points.map(p => p.id === draggedLabelId ? { ...p, labelOffsetX: (p.labelOffsetX || 15) + e.movementX / zoom, labelOffsetY: (p.labelOffsetY || -15) + e.movementY / zoom } : p) }));
            } else if (selectionStart) {
                setSelectionBox({ x: Math.min(selectionStart.x, worldX), y: Math.min(selectionStart.y, worldY), width: Math.abs(worldX - selectionStart.x), height: Math.abs(worldY - selectionStart.y) });
            } else if (draggedIds.length > 0) {
                 setData(prev => {
                     let dx = e.movementX / zoom;
                     let dy = e.movementY / zoom;

                     // --- SHIFT KEY CONSTRAINT FOR DRAGGING ---
                     // Lock to X or Y axis based on which movement is larger
                     if (e.shiftKey) {
                         if (Math.abs(dx) > Math.abs(dy)) dy = 0;
                         else dx = 0;
                     }

                     const pointsToMove = new Set<string>();
                     const otherMoves = new Map<string, {x:number, y:number}>(); 
                     if (draggedIds.length === 1) {
                         const draggedId = draggedIds[0];
                         const regPoly = prev.polygons.find(p => p.isRegular && (p.pointIds.includes(draggedId) || p.centerId === draggedId));
                         if (regPoly) {
                             const { updatedPoints } = calculateRegularPolygonUpdate(draggedId, worldX, worldY, regPoly, prev.points);
                             if (updatedPoints.size > 0) { const nextPoints = prev.points.map(p => updatedPoints.has(p.id) ? { ...p, ...updatedPoints.get(p.id) } : p); return { ...prev, points: nextPoints }; }
                             return prev;
                         }
                     }
                     
                     // 1. Identify explicitly selected points
                     draggedIds.forEach(id => {
                         const isPoint = prev.points.some(p => p.id === id); if (isPoint) pointsToMove.add(id);
                         prev.polygons.forEach(p => { if (p.id === id) { p.pointIds.forEach(pid => pointsToMove.add(pid)); if(p.centerId) pointsToMove.add(p.centerId); } });
                         prev.circles.forEach(c => { if (c.id === id) { pointsToMove.add(c.centerId); if(c.radiusPointId) pointsToMove.add(c.radiusPointId); } });
                         prev.segments.forEach(s => { if (s.id === id) { pointsToMove.add(s.startPointId); pointsToMove.add(s.endPointId); } });
                         prev.lines.forEach(l => { if (l.id === id) { pointsToMove.add(l.p1Id); pointsToMove.add(l.p2Id); } });
                         prev.texts.forEach(t => { if (t.id === id) otherMoves.set(id, { x: t.x + dx, y: t.y + dy }); });
                         prev.images?.forEach(i => { if (i.id === id) otherMoves.set(id, { x: i.x + dx, y: i.y + dy }); });
                     });

                     // 2. Implicit Constraints for 3D Shapes (Rigid Faces - When Dragging Center)
                     (prev.cylinders || []).forEach(cyl => {
                         const pRad = prev.points.find(p => p.id === cyl.radiusPointId);
                         const pTop = prev.points.find(p => p.id === cyl.topCenterId);
                         const pBot = prev.points.find(p => p.id === cyl.bottomCenterId);
                         if (pRad && pTop && pBot) {
                             const distTop = Math.hypot(pRad.x - pTop.x, pRad.y - pTop.y);
                             const distBot = Math.hypot(pRad.x - pBot.x, pRad.y - pBot.y);
                             if (pointsToMove.has(cyl.topCenterId) && distTop <= distBot) pointsToMove.add(cyl.radiusPointId);
                             if (pointsToMove.has(cyl.bottomCenterId) && distBot < distTop) pointsToMove.add(cyl.radiusPointId);
                         }
                     });
                     (prev.cones || []).forEach(cone => {
                         if (pointsToMove.has(cone.bottomCenterId)) pointsToMove.add(cone.radiusPointId);
                     });

                     let newPoints = prev.points.map(p => { if (pointsToMove.has(p.id)) return { ...p, x: p.x + dx, y: p.y + dy }; return p; });

                     // 3. Radius Point Constraint (When Dragging Radius Point)
                     // Force Perpendicularity to Axis (Right Cylinder / Right Cone)
                     if (draggedIds.length === 1) {
                         const draggedId = draggedIds[0];
                         
                         (prev.cylinders || []).forEach(cyl => {
                             if (cyl.radiusPointId === draggedId) {
                                 const pTop = newPoints.find(p => p.id === cyl.topCenterId);
                                 const pBot = newPoints.find(p => p.id === cyl.bottomCenterId);
                                 const pRad = newPoints.find(p => p.id === cyl.radiusPointId);
                                 if (pTop && pBot && pRad) {
                                     const ax = pTop.x - pBot.x; const ay = pTop.y - pBot.y;
                                     if (Math.hypot(ax, ay) > 1e-4) {
                                         const vx = pRad.x - pTop.x; const vy = pRad.y - pTop.y;
                                         const nx = -ay; const ny = ax; // Normal vector
                                         const dot = vx * nx + vy * ny;
                                         const lenSq = nx * nx + ny * ny;
                                         const scale = dot / lenSq;
                                         pRad.x = pTop.x + nx * scale; pRad.y = pTop.y + ny * scale;
                                     }
                                 }
                             }
                         });

                         (prev.cones || []).forEach(cone => {
                             if (cone.radiusPointId === draggedId) {
                                 const pApex = newPoints.find(p => p.id === cone.apexId);
                                 const pBot = newPoints.find(p => p.id === cone.bottomCenterId);
                                 const pRad = newPoints.find(p => p.id === cone.radiusPointId);
                                 if (pApex && pBot && pRad) {
                                     const ax = pApex.x - pBot.x; const ay = pApex.y - pBot.y;
                                     if (Math.hypot(ax, ay) > 1e-4) {
                                         const vx = pRad.x - pBot.x; const vy = pRad.y - pBot.y;
                                         const nx = -ay; const ny = ax; // Normal vector
                                         const dot = vx * nx + vy * ny;
                                         const lenSq = nx * nx + ny * ny;
                                         const scale = dot / lenSq;
                                         pRad.x = pBot.x + nx * scale; pRad.y = pBot.y + ny * scale;
                                     }
                                 }
                             }
                         });
                     }

                     newPoints = resolveConstraints(newPoints, prev.lines, prev.segments, prev.rays, prev.functionGraphs, prev.variables, gridSize);
                     return { ...prev, points: newPoints, texts: prev.texts.map(t => otherMoves.has(t.id) ? { ...t, ...otherMoves.get(t.id) } : t), images: (prev.images || []).map(i => otherMoves.has(i.id) ? { ...i, ...otherMoves.get(i.id) } : i) };
                 });
            }
        }
        
        const hitPoint = findHitPoint(worldX, worldY); if (hitPoint) { setHoveredElement({ type: 'point', id: hitPoint.id }); return; }
        const hitAxis = props.showAxes ? findHitAxis(worldX, worldY) : null; if (hitAxis) { setHoveredElement(hitAxis); return; }
        const hitGraph = findHitFunctionGraph(worldX, worldY); if (hitGraph) { setHoveredElement(hitGraph); return; }
        const hitLine = findHitLineLike(worldX, worldY); if (hitLine) { setHoveredElement({ type: hitLine.type, id: hitLine.id }); return; }
        const hitCircle = findHitCircle(worldX, worldY); if (hitCircle) { setHoveredElement({ type: 'circle', id: hitCircle.id }); return; }
        const hitArc = findHitArc(worldX, worldY); if (hitArc) { setHoveredElement({ type: 'arc', id: hitArc.id }); return; }
        setHoveredElement(null);
    };

    const handleMouseUp = (e?: React.MouseEvent | MouseEvent) => {
        if (isPanning) { setIsPanning(false); return; }
        setResizeState(null);
        
        if (activeTool === ToolType.SELECT_AREA) { 
            // End drawing export box, but KEEP the box visible until copied or tool changed
            setIsDrawingExport(false);
            setSelectionStart(null); 
            return; 
        }

        if (selectionStart && activeTool === ToolType.SELECT && selectionBox) { 
            const found: SelectionState[] = [];
            const x = Math.min(selectionBox.x, selectionBox.x + selectionBox.width);
            const y = Math.min(selectionBox.y, selectionBox.y + selectionBox.height);
            const inBox = (px: number, py: number) => px >= x && px <= x + selectionBox.width && py >= y && py <= y + selectionBox.height;
            data.points.forEach(p => { if ((props.showHidden || !p.hidden) && inBox(p.x, p.y)) found.push({ type: 'point', id: p.id }); });
            data.texts.forEach(t => { if ((props.showHidden || !t.hidden) && inBox(t.x, t.y)) found.push({ type: 'text', id: t.id }); });
            data.polygons.forEach(poly => {
                const points = poly.pointIds.map(id => data.points.find(p => p.id === id)).filter(p => !!p) as Point[];
                if (points.length > 0 && points.every(p => inBox(p.x, p.y))) found.push({ type: 'polygon', id: poly.id });
            });
            data.segments.forEach(s => { const p1 = data.points.find(p => p.id === s.startPointId); const p2 = data.points.find(p => p.id === s.endPointId); if (p1 && p2 && inBox(p1.x, p1.y) && inBox(p2.x, p2.y)) found.push({ type: 'segment', id: s.id }); });
            data.images?.forEach(img => { const cx = img.x + img.width/2; const cy = img.y + img.height/2; if (inBox(cx, cy)) found.push({ type: 'image', id: img.id }); });
            if (e && (e.shiftKey || e.ctrlKey || e.metaKey)) { const combined = [...selectedElements]; found.forEach(f => { if (!combined.some(c => c.id === f.id)) combined.push(f); }); setSelectedElements(combined); } else { setSelectedElements(found); }
        }
        setSelectionStart(null); setSelectionBox(null); setDraggedIds([]); setDraggedLabelId(null); setDraggedFunctionLabelId(null);
    };

    const handleCopy = async () => {
        if (!svgRef.current || !svgRef.current.parentElement) return;
        const wrapper = svgRef.current.parentElement;

        // --- SMART CROP LOGIC (Using World Coordinates) ---
        let minWx = Infinity, minWy = Infinity, maxWx = -Infinity, maxWy = -Infinity;
        
        // 1. Check if we have a manual selection box (ToolType.SELECT_AREA)
        // Note: exportBox is in World Coordinates (thanks to handleMouseMove)
        if (activeTool === ToolType.SELECT_AREA && exportBox && exportBox.width > 1 && exportBox.height > 1) {
            minWx = exportBox.x;
            minWy = exportBox.y;
            maxWx = exportBox.x + exportBox.width;
            maxWy = exportBox.y + exportBox.height;
        } 
        // 2. Otherwise auto-calculate from elements
        else {
             let hasElements = false;
             const expand = (wx: number, wy: number, padding: number = 0) => {
                 minWx = Math.min(minWx, wx - padding);
                 minWy = Math.min(minWy, wy - padding);
                 maxWx = Math.max(maxWx, wx + padding);
                 maxWy = Math.max(maxWy, wy + padding);
                 hasElements = true;
             };

             data.points.forEach(p => { if(!p.hidden) expand(p.x, p.y, p.radius ? p.radius + 15 : 20); });
             data.texts.forEach(t => { if(!t.hidden) expand(t.x, t.y, 40); });
             data.images?.forEach(img => {
                 if(!img.hidden) {
                     expand(img.x, img.y);
                     expand(img.x + img.width, img.y + img.height);
                 }
             });
             data.functionGraphs?.forEach(g => {
                 if (!g.hidden && g.labelX && g.labelY) expand(g.labelX, g.labelY, 50);
             });
             
             // If no elements, capture the current visible area
             if (!hasElements || !isFinite(minWx)) {
                 const rect = wrapper.getBoundingClientRect();
                 minWx = -pan.x / zoom;
                 minWy = -pan.y / zoom;
                 maxWx = (rect.width - pan.x) / zoom;
                 maxWy = (rect.height - pan.y) / zoom;
             } else {
                 // Add comfortable padding for auto-crop
                 const padding = 30 / zoom;
                 minWx -= padding; minWy -= padding;
                 maxWx += padding; maxWy += padding;
             }
        }

        // --- EXPORT PIPELINE ---
        const cropWidth = (maxWx - minWx) * zoom;
        const cropHeight = (maxWy - minWy) * zoom;
        const cropScreenX = minWx * zoom + pan.x;
        const cropScreenY = minWy * zoom + pan.y;

        try {
            const blob = await htmlToImage.toBlob(wrapper, {
                backgroundColor: 'transparent',
                width: cropWidth,
                height: cropHeight,
                style: {
                    transform: `translate(${-cropScreenX}px, ${-cropScreenY}px)`,
                    width: wrapper.scrollWidth + 'px', 
                    height: wrapper.scrollHeight + 'px' 
                },
                filter: (node) => {
                    if (node.classList && node.classList.contains('exclude-export')) return false;
                    if (node.classList && node.classList.contains('export-box-visual')) return false;
                    return true;
                },
                skipAutoScale: true,
                cacheBust: true,
                pixelRatio: 2
            });
            
            if (blob) {
                await navigator.clipboard.write([ new ClipboardItem({ "image/png": blob }) ]);
            }
        } catch (err) { console.error("Copy failed", err); }
    };

    const insertImage = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (dataUrl) {
                const img = new Image();
                img.onload = () => {
                    const maxDim = 200 / zoom;
                    let w = img.width; let h = img.height;
                    const scale = Math.min(maxDim / w, maxDim / h);
                    w *= scale; h *= scale;
                    const viewCenter = { x: -pan.x / zoom + (svgRef.current?.clientWidth || 800) / (2 * zoom), y: -pan.y / zoom + (svgRef.current?.clientHeight || 600) / (2 * zoom) };
                    const newImage: ImageElement = { id: generateId('img'), x: viewCenter.x - w / 2, y: viewCenter.y - h / 2, width: w, height: h, src: dataUrl, rotation: 0, opacity: 1 };
                    setData(prev => ({ ...prev, images: [...(prev.images || []), newImage] }));
                    setSelectedElements([{ type: 'image', id: newImage.id }]);
                };
                img.src = dataUrl;
            }
        };
        reader.readAsDataURL(file);
    };

    const resetSelection = () => { setSelectedElements([]); setActivePoints([]); setTextEntry(null); };

    const startEditingText = () => {
        if (selectedElements.length === 1 && selectedElements[0].type === 'text') {
             const t = data.texts.find(text => text.id === selectedElements[0].id);
             if (t) {
                 const screenPos = svgRef.current ? svgRef.current.getBoundingClientRect() : { left: 0, top: 0 };
                 setTextEntry({ id: t.id, value: t.text, screenX: screenPos.left + t.x * zoom + pan.x, screenY: screenPos.top + t.y * zoom + pan.y, svgX: t.x, svgY: t.y, fontSize: t.fontSize, color: t.color || 'black' });
             }
        }
    };

    const onResizeHandleMouseDown = (e: React.MouseEvent, handle: string, img: ImageElement) => {
         e.stopPropagation();
         const coords = getMouseCoords(e);
         setResizeState({ id: img.id, handle, startPos: coords, startDims: { x: img.x, y: img.y, w: img.width, h: img.height, rotation: img.rotation || 0 } });
    };

    const handleDoubleClickText = (e: React.MouseEvent, t: TextElement) => {
         setSelectedElements([{ type: 'text', id: t.id }]);
         startEditingText();
    };

    const createIntegral = (id1: string, id2: string) => {
         const newInt = { id: generateId('int'), graph1Id: id1, graph2Id: id2, fillColor: '#4f46e5', fillStyle: 'solid' as const, fillOpacity: 0.4 };
         setData(prev => ({ ...prev, integrals: [...(prev.integrals || []), newInt] }));
    };

    const submitDialogs = {
        onAngleSubmit: () => {
             const p1 = data.points.find(p => p.id === activePoints[0]);
             const center = data.points.find(p => p.id === activePoints[1]);
             if (p1 && center) {
                 const deg = parseFloat(dialogValues.v1);
                 if (!isNaN(deg)) {
                     const rad = (deg * Math.PI) / 180;
                     const theta = dialogValues.angleDir === 'cw' ? rad : -rad;
                     const dx = p1.x - center.x; const dy = p1.y - center.y;
                     const newX = center.x + dx * Math.cos(theta) - dy * Math.sin(theta);
                     const newY = center.y + dx * Math.sin(theta) + dy * Math.cos(theta);
                     const p3 = { id: generateId('p'), x: newX, y: newY, label: createNextPointLabel(data.points), color: 'black' as ElementColor, radius: props.currentPointSize };
                     setData(prev => ({ ...prev, points: [...prev.points, p3], angles: [...prev.angles, { id: generateId('ang'), point1Id: p1.id, centerId: center.id, point2Id: p3.id, color: 'black', strokeWidth: 1.5, arcCount: 1, showLabel: true }] }));
                 }
             }
             setDialogType(null); setActivePoints([]);
        },
        onSegmentSubmit: () => {
             const p1 = data.points.find(p => p.id === activePoints[0]);
             if (p1) {
                 const len = parseFloat(dialogValues.v1);
                 if (!isNaN(len) && len > 0) {
                     const p2 = { id: generateId('p'), x: p1.x + len * gridSize, y: p1.y, label: createNextPointLabel(data.points), color: 'black' as ElementColor, radius: props.currentPointSize };
                     const seg = { id: generateId('s'), startPointId: p1.id, endPointId: p2.id, style: props.currentLineStyle, strokeWidth: props.currentStrokeWidth, color: 'black' };
                     setData(prev => ({ ...prev, points: [...prev.points, p2], segments: [...prev.segments, seg] }));
                 }
             }
             setDialogType(null); setActivePoints([]);
        },
        onCircleFixedSubmit: () => {
             const center = data.points.find(p => p.id === activePoints[0]);
             if (center) {
                 const r = parseFloat(dialogValues.v1);
                 if (!isNaN(r) && r > 0) {
                     setData(prev => ({ ...prev, circles: [...prev.circles, { id: generateId('c'), centerId: center.id, radiusValue: r * gridSize, color: 'black', style: props.currentLineStyle, strokeWidth: props.currentStrokeWidth }] }));
                 }
             }
             setDialogType(null); setActivePoints([]);
        },
        onFunctionGraphSubmit: () => {
             const formula = dialogValues.v1;
             if (formula) {
                 const defaultLabelX = -pan.x / zoom + (svgRef.current?.clientWidth || 1000) / (2 * zoom);
                 const defaultLabelY = -pan.y / zoom + (svgRef.current?.clientHeight || 800) / (2 * zoom) - 50 / zoom;
                 const newGraph: FunctionGraph = { id: generateId('func'), formula: formula, color: '#1565C0', strokeWidth: 2, hidden: false, labelX: defaultLabelX, labelY: defaultLabelY };
                 setData(prev => ({ ...prev, functionGraphs: [...(prev.functionGraphs || []), newGraph] }));
             }
             setDialogType(null);
        },
        onPointCoordSubmit: () => {
             const x = parseFloat(dialogValues.v1) * gridSize;
             const y = -parseFloat(dialogValues.v2) * gridSize; 
             const newPoint = { id: generateId('p'), x, y, label: createNextPointLabel(data.points), color: 'black', radius: props.currentPointSize, showCoordProj: true };
             setData(prev => ({ ...prev, points: [...prev.points, newPoint] }));
             setDialogType(null);
        },
        onPolygonRegularSubmit: () => {
            const sides = parseInt(dialogValues.v1);
            const length = parseFloat(dialogValues.v2);
            if (sides >= 3 && length > 0) {
                 const viewCenter = { x: -pan.x/zoom + (svgRef.current?.clientWidth || 800)/(2*zoom), y: -pan.y/zoom + (svgRef.current?.clientHeight || 600)/(2*zoom) };
                 const { newPoints, polygon } = createRegularPolygonData(sides, length, gridSize, viewCenter, props.currentPointSize, props.currentStrokeWidth, props.currentFillColor, props.currentFillStyle, props.currentLineStyle, data.points);
                 setData(prev => ({ ...prev, points: [...prev.points, ...newPoints], polygons: [...prev.polygons, polygon] }));
            }
            setDialogType(null);
        },
        onTextSubmit: (entry: TextEntry) => {
             if (entry.id) { setData(prev => ({ ...prev, texts: prev.texts.map(t => t.id === entry.id ? { ...t, text: entry.value, color: entry.color, fontSize: entry.fontSize } : t) })); } 
             else { const newText: TextElement = { id: generateId('text'), x: entry.svgX, y: entry.svgY, text: entry.value, color: entry.color, fontSize: entry.fontSize }; setData(prev => ({ ...prev, texts: [...prev.texts, newText] })); }
             setTextEntry(null);
        },
        onRotateAngleSubmit: () => {
            setRotationAngle(dialogValues.v1);
            setDialogType(null);
        }
    };

    const batchUpdateElement = (updates: any) => {
        setData(prev => {
            let next = { ...prev };
            selectedElements.forEach(sel => {
                 if (sel.type === 'point') next.points = next.points.map(p => p.id === sel.id ? { ...p, ...updates } : p);
                 if (sel.type === 'segment') next.segments = next.segments.map(s => s.id === sel.id ? { ...s, ...updates } : s);
                 if (sel.type === 'line') next.lines = next.lines.map(l => l.id === sel.id ? { ...l, ...updates } : l);
                 if (sel.type === 'circle') next.circles = next.circles.map(c => c.id === sel.id ? { ...c, ...updates } : c);
                 if (sel.type === 'polygon') next.polygons = next.polygons.map(p => p.id === sel.id ? { ...p, ...updates } : p);
                 if (sel.type === 'text') next.texts = next.texts.map(t => t.id === sel.id ? { ...t, ...updates } : t);
                 if (sel.type === 'functionGraph') next.functionGraphs = (next.functionGraphs || []).map(g => g.id === sel.id ? { ...g, ...updates } : g);
                 if (sel.type === 'angle') next.angles = next.angles.map(a => a.id === sel.id ? { ...a, ...updates } : a);
                 if (sel.type === 'image') next.images = (next.images || []).map(i => i.id === sel.id ? { ...i, ...updates } : i);
                 if (sel.type === 'arc') next.arcs = (next.arcs || []).map(a => a.id === sel.id ? { ...a, ...updates } : a);
                 if (sel.type === 'ellipticalArc') next.ellipticalArcs = (next.ellipticalArcs || []).map(a => a.id === sel.id ? { ...a, ...updates } : a);
                 if (sel.type === 'integral') next.integrals = (next.integrals || []).map(i => i.id === sel.id ? { ...i, ...updates } : i);
            });
            return next;
        });
    };

    const batchDeleteElement = () => {
         setData(prev => {
             let next = { ...prev };
             const ids = new Set(selectedElements.map(s => s.id));
             next.points = next.points.filter(p => !ids.has(p.id));
             next.segments = next.segments.filter(s => !ids.has(s.id));
             next.lines = next.lines.filter(l => !ids.has(l.id));
             next.circles = next.circles.filter(c => !ids.has(c.id));
             next.polygons = next.polygons.filter(p => !ids.has(p.id));
             next.texts = next.texts.filter(t => !ids.has(t.id));
             next.functionGraphs = (next.functionGraphs || []).filter(g => !ids.has(g.id));
             next.images = (next.images || []).filter(i => !ids.has(i.id));
             next.arcs = (next.arcs || []).filter(a => !ids.has(a.id));
             next.ellipticalArcs = (next.ellipticalArcs || []).filter(a => !ids.has(a.id));
             next.angles = next.angles.filter(a => !ids.has(a.id));
             next.cylinders = (next.cylinders || []).filter(c => !ids.has(c.id));
             next.cones = (next.cones || []).filter(c => !ids.has(c.id));
             next.spheres = (next.spheres || []).filter(s => !ids.has(s.id));
             next.integrals = (next.integrals || []).filter(i => !ids.has(i.id));
             return next;
         });
         setSelectedElements([]);
    };

    const handleAngleUpdate = (id: string, newDegree: number) => {
         setData(prev => {
             const angle = prev.angles.find(a => a.id === id);
             if(!angle) return prev;
             const center = prev.points.find(p => p.id === angle.centerId);
             const p1 = prev.points.find(p => p.id === angle.point1Id);
             const p2 = prev.points.find(p => p.id === angle.point2Id);
             if(!center || !p1 || !p2) return prev;
             const theta1 = Math.atan2(p1.y - center.y, p1.x - center.x);
             const r2 = Math.hypot(p2.x - center.x, p2.y - center.y);
             const theta2 = theta1 + newDegree * (Math.PI / 180); 
             const newX = center.x + r2 * Math.cos(theta2);
             const newY = center.y + r2 * Math.sin(theta2);
             return { ...prev, points: prev.points.map(p => p.id === p2.id ? { ...p, x: newX, y: newY } : p) };
         });
    };

    return {
        pan, zoom, mousePos,
        activePoints, selectionBox, selectionStart,
        selectedElements, setSelectedElements,
        textEntry, setTextEntry,
        dialogType, setDialogType,
        dialogValues, setDialogValues,
        hoveredElement,
        exportBox, // Exposed for overlay
        handleMouseDown, handleMouseMove, handleMouseUp,
        handleWheel,
        handleCopy, resetSelection, startEditingText,
        onResizeHandleMouseDown,
        setDraggedLabelId, setDraggedFunctionLabelId,
        handleDoubleClickText,
        batchUpdateElement, batchDeleteElement,
        handleAngleUpdate,
        submitDialogs,
        createIntegral,
        insertImage,
        setDraggedIds,
        resetView,
        // --- Added for cursor logic ---
        isPanning, 
        isSpacePressed
    };
};
