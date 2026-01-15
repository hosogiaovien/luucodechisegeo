
import { GeometryData, Point, Segment, Polygon, ToolType } from '../types';
import { generateId, evaluateMathExpression } from './geometry';

// --- Toán học cơ bản ---

export const reflectPoint = (p: {x:number, y:number}, center: {x:number, y:number}) => {
    return {
        x: 2 * center.x - p.x,
        y: 2 * center.y - p.y
    };
};

export const reflectPointOverLine = (p: {x:number, y:number}, l1: {x:number, y:number}, l2: {x:number, y:number}) => {
    const dx = l2.x - l1.x;
    const dy = l2.y - l1.y;
    if (dx === 0 && dy === 0) return { x: p.x, y: p.y };
    
    const t = ((p.x - l1.x) * dx + (p.y - l1.y) * dy) / (dx * dx + dy * dy);
    const closestX = l1.x + t * dx;
    const closestY = l1.y + t * dy;
    
    return {
        x: 2 * closestX - p.x,
        y: 2 * closestY - p.y
    };
};

export const rotatePoint = (p: {x:number, y:number}, center: {x:number, y:number}, angleDeg: number) => {
    const rad = angleDeg * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos
    };
};

// --- Logic tạo đối tượng mới ---

// Helper tạo đường nét đứt nối ảnh và tạo ảnh (Dùng cho đối xứng)
const createReflectedCopy = (
    original: Point, 
    newCoords: {x:number, y:number},
    prevPoints: Point[], 
    prevSegments: Segment[]
) => {
    const newP: Point = { 
        id: generateId('p_prime'), 
        x: newCoords.x, 
        y: newCoords.y, 
        label: original.label ? original.label + "'" : undefined, 
        color: original.color, 
        radius: original.radius 
    };
    
    const dashedLine: Segment = {
        id: generateId('s_dash'),
        startPointId: original.id,
        endPointId: newP.id,
        style: 'dashed',
        strokeWidth: 1,
        color: '#94a3b8' // Slate-400
    };

    return { point: newP, segment: dashedLine };
};

// 1. ĐỐI XỨNG TÂM & TRỤC
export const applySymmetry = (
    tool: ToolType, // SYMMETRY_CENTRAL or SYMMETRY_AXIAL
    referenceId: string, // Center Point ID or Line/Segment ID
    targetId: string,    // Object ID to reflect
    targetType: 'point' | 'segment' | 'polygon',
    data: GeometryData
): Partial<GeometryData> | null => {
    
    const center = tool === ToolType.SYMMETRY_CENTRAL ? data.points.find(p => p.id === referenceId) : null;
    
    let lineP1: Point | undefined, lineP2: Point | undefined;
    if (tool === ToolType.SYMMETRY_AXIAL) {
        const refObj = data.segments.find(s => s.id === referenceId) || data.lines.find(l => l.id === referenceId) || data.rays.find(r => r.id === referenceId);
        if (refObj) {
            lineP1 = data.points.find(p => p.id === (refObj as any).startPointId || (refObj as any).p1Id);
            lineP2 = data.points.find(p => p.id === (refObj as any).endPointId || (refObj as any).p2Id || (refObj as any).directionPointId);
        }
    }

    if ((tool === ToolType.SYMMETRY_CENTRAL && !center) || (tool === ToolType.SYMMETRY_AXIAL && (!lineP1 || !lineP2))) return null;

    const reflect = (p: Point) => {
        if (tool === ToolType.SYMMETRY_CENTRAL && center) return reflectPoint(p, center);
        if (tool === ToolType.SYMMETRY_AXIAL && lineP1 && lineP2) return reflectPointOverLine(p, lineP1, lineP2);
        return { x: p.x, y: p.y };
    };

    const nextPoints = [...data.points];
    const nextSegments = [...data.segments];
    const nextPolygons = [...data.polygons];

    if (targetType === 'point') {
        const original = data.points.find(p => p.id === targetId);
        if (original) {
            const res = createReflectedCopy(original, reflect(original), nextPoints, nextSegments);
            nextPoints.push(res.point);
            nextSegments.push(res.segment);
        }
    } else if (targetType === 'segment') {
        const originalSeg = data.segments.find(s => s.id === targetId);
        if (originalSeg) {
            const pStart = data.points.find(p => p.id === originalSeg.startPointId);
            const pEnd = data.points.find(p => p.id === originalSeg.endPointId);
            if (pStart && pEnd) {
                const resStart = createReflectedCopy(pStart, reflect(pStart), nextPoints, nextSegments);
                const resEnd = createReflectedCopy(pEnd, reflect(pEnd), nextPoints, nextSegments);
                
                nextPoints.push(resStart.point, resEnd.point);
                nextSegments.push(resStart.segment, resEnd.segment);
                
                nextSegments.push({ 
                    ...originalSeg, 
                    id: generateId('s_prime'), 
                    startPointId: resStart.point.id, 
                    endPointId: resEnd.point.id 
                });
            }
        }
    } else if (targetType === 'polygon') {
        const originalPoly = data.polygons.find(poly => poly.id === targetId);
        if (originalPoly) {
            const newPointIds: string[] = [];
            originalPoly.pointIds.forEach(pid => {
                const p = data.points.find(pt => pt.id === pid);
                if (p) {
                    const res = createReflectedCopy(p, reflect(p), nextPoints, nextSegments);
                    nextPoints.push(res.point);
                    nextSegments.push(res.segment);
                    newPointIds.push(res.point.id);
                }
            });
            nextPolygons.push({ ...originalPoly, id: generateId('poly_prime'), pointIds: newPointIds });
        }
    }

    return { points: nextPoints, segments: nextSegments, polygons: nextPolygons };
};

// 2. PHÉP QUAY (ROTATION)
export const applyRotation = (
    centerId: string,
    targetId: string,
    targetType: 'point' | 'segment' | 'polygon',
    angleStr: string, // "45" or "a"
    data: GeometryData
): Partial<GeometryData> | null => {
    
    const center = data.points.find(p => p.id === centerId);
    if (!center) return null;

    // Helper: Tính toán vị trí ban đầu (để hiển thị ngay) và tạo Point với constraint
    const createRotatedPoint = (original: Point): Point => {
        // Resolve angle value immediately for initial position
        const variableMap: Record<string, number> = {};
        (data.variables || []).forEach(v => variableMap[v.name.toLowerCase()] = v.value);
        
        let angleVal = parseFloat(angleStr);
        if (isNaN(angleVal)) {
            // Try to find variable
            angleVal = evaluateMathExpression(angleStr, 0, variableMap);
        }
        if (isNaN(angleVal)) angleVal = 0; // Fallback

        const coords = rotatePoint(original, center, angleVal);

        return {
            id: generateId('p_rot'),
            x: coords.x,
            y: coords.y,
            label: original.label ? original.label + "'" : undefined,
            color: original.color,
            radius: original.radius,
            constraint: {
                type: 'rotation',
                centerId: center.id,
                originalPointId: original.id,
                angle: angleStr // Store the string (variable name or number)
            }
        };
    };

    const nextPoints = [...data.points];
    const nextSegments = [...data.segments];
    const nextPolygons = [...data.polygons];

    if (targetType === 'point') {
        const original = data.points.find(p => p.id === targetId);
        if (original) {
            const newP = createRotatedPoint(original);
            nextPoints.push(newP);
        }
    } else if (targetType === 'segment') {
        const originalSeg = data.segments.find(s => s.id === targetId);
        if (originalSeg) {
            const pStart = data.points.find(p => p.id === originalSeg.startPointId);
            const pEnd = data.points.find(p => p.id === originalSeg.endPointId);
            if (pStart && pEnd) {
                const newP1 = createRotatedPoint(pStart);
                const newP2 = createRotatedPoint(pEnd);
                nextPoints.push(newP1, newP2);
                nextSegments.push({ 
                    ...originalSeg, 
                    id: generateId('s_rot'), 
                    startPointId: newP1.id, 
                    endPointId: newP2.id 
                });
            }
        }
    } else if (targetType === 'polygon') {
        const originalPoly = data.polygons.find(poly => poly.id === targetId);
        if (originalPoly) {
            const newPointIds: string[] = [];
            originalPoly.pointIds.forEach(pid => {
                const p = data.points.find(pt => pt.id === pid);
                if (p) {
                    const newP = createRotatedPoint(p);
                    nextPoints.push(newP);
                    newPointIds.push(newP.id);
                }
            });
            nextPolygons.push({ ...originalPoly, id: generateId('poly_rot'), pointIds: newPointIds });
        }
    }

    return { points: nextPoints, segments: nextSegments, polygons: nextPolygons };
};
