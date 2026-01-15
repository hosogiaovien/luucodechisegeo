
import React from 'react';
import { ToolType, GeometryData } from '../types';
import { EllipseShape } from './shapes/EllipseShape';
import { EllipticalArcShape } from './shapes/EllipticalArcShape';
import { CylinderShape } from './shapes/CylinderShape';
import { ConeShape } from './shapes/ConeShape';
import { ArcShape } from './shapes/ArcShape';

interface CanvasOverlayProps {
  activeTool: ToolType;
  activePoints: string[];
  data: GeometryData;
  mousePos: { x: number, y: number };
  selectionBox: { x: number, y: number, width: number, height: number } | null;
  selectionStart: { x: number, y: number } | null;
  arcModeMajor: boolean;
  arcFillMode: 'segment' | 'sector';
  zoom: number;
  exportBox?: { x: number, y: number, width: number, height: number } | null; // Added prop
}

export const CanvasOverlay: React.FC<CanvasOverlayProps> = ({
  activeTool, activePoints, data, mousePos, selectionBox, arcModeMajor, arcFillMode, zoom, exportBox
}) => {
  return (
    <g className="ui-overlay pointer-events-none">
        {/* Selection Box for Elements */}
        {selectionBox && activeTool === ToolType.SELECT && (
            <rect x={selectionBox.x} y={selectionBox.y} width={selectionBox.width} height={selectionBox.height} fill="rgba(79, 70, 229, 0.08)" stroke="#4f46e5" strokeWidth={1.5/zoom} strokeDasharray="5,3" />
        )}
        
        {/* EXPORT BOX (Persistent Green Box) */}
        {exportBox && activeTool === ToolType.SELECT_AREA && (
            <g className="export-box-visual">
                <rect 
                    x={exportBox.x} y={exportBox.y} width={exportBox.width} height={exportBox.height} 
                    fill="rgba(34, 197, 94, 0.1)" stroke="#22c55e" strokeWidth={2} strokeDasharray="8,4" 
                />
                <text x={exportBox.x} y={exportBox.y - 5} fill="#22c55e" fontSize="12" fontWeight="bold">Vùng Xuất Hình</text>
            </g>
        )}
        
        {activeTool !== ToolType.SELECT && activeTool !== ToolType.SELECT_AREA && ![ToolType.INTERSECT, ToolType.PARALLEL, ToolType.PERPENDICULAR, ToolType.TEXT, ToolType.MIDPOINT, ToolType.ANGLE, ToolType.FILL, ToolType.ANGLE_FIXED, ToolType.SEGMENT_FIXED, ToolType.POINT_COORD, ToolType.CIRCLE_FIXED, ToolType.FUNCTION_GRAPH].includes(activeTool) && ( 
            <circle cx={mousePos.x} cy={mousePos.y} r={5 / zoom} fill="rgba(99, 102, 241, 0.5)" stroke="white" strokeWidth={1 / zoom} /> 
        )}
        
        {activeTool !== ToolType.POLYGON && activeTool !== ToolType.ARC && activeTool !== ToolType.ANGLE && activeTool !== ToolType.ELLIPSE && activeTool !== ToolType.ELLIPTICAL_ARC && activeTool !== ToolType.ANGLE_FIXED && activeTool !== ToolType.SEGMENT_FIXED && activeTool !== ToolType.CIRCLE_FIXED && activeTool !== ToolType.FUNCTION_GRAPH && activePoints.length > 0 && data.points.find(p => p.id === activePoints[activePoints.length-1]) && ( 
            <line x1={data.points.find(p => p.id === activePoints[activePoints.length-1])!.x} y1={data.points.find(p => p.id === activePoints[activePoints.length-1])!.y} x2={mousePos.x} y2={mousePos.y} stroke="#4f46e5" strokeWidth={2/zoom} strokeDasharray="5,5" /> 
        )}
        
        {activeTool === ToolType.ANGLE && activePoints.length === 2 && data.points.find(p => p.id === activePoints[0]) && data.points.find(p => p.id === activePoints[1]) && ( 
            <path d={`M ${data.points.find(p => p.id === activePoints[0])!.x} ${data.points.find(p => p.id === activePoints[0])!.y} L ${data.points.find(p => p.id === activePoints[1])!.x} ${data.points.find(p => p.id === activePoints[1])!.y} L ${mousePos.x} ${mousePos.y}`} stroke="#4f46e5" strokeWidth={1/zoom} fill="none" opacity="0.5" strokeDasharray="5,5" /> 
        )}
        
        {activeTool === ToolType.ANGLE_FIXED && activePoints.length === 1 && data.points.find(p => p.id === activePoints[0]) && (
            <line x1={data.points.find(p => p.id === activePoints[0])!.x} y1={data.points.find(p => p.id === activePoints[0])!.y} x2={mousePos.x} y2={mousePos.y} stroke="#4f46e5" strokeWidth={2/zoom} strokeDasharray="5,5" />
        )}

        {(activeTool === ToolType.ELLIPSE || activeTool === ToolType.ELLIPTICAL_ARC) && activePoints.length > 0 && (
            <g opacity="0.5">
                {data.points.find(p => p.id === activePoints[0]) && (
                    <line x1={data.points.find(p => p.id === activePoints[0])!.x} y1={data.points.find(p => p.id === activePoints[0])!.y} x2={mousePos.x} y2={mousePos.y} stroke="#4f46e5" strokeWidth={1.5/zoom} strokeDasharray="5,5"/>
                )}
                {activePoints.length >= 2 && (
                    <EllipseShape ellipse={{ id: 'temp_ellipse', centerId: activePoints[0], majorAxisPointId: activePoints[1], minorAxisPointId: 'temp_mouse', strokeWidth: 1, color: '#4f46e5' }} points={[...data.points, {id: 'temp_mouse', x: mousePos.x, y: mousePos.y}]} isSelected={false} />
                )}
                {activeTool === ToolType.ELLIPTICAL_ARC && activePoints.length >= 3 && data.points.find(p => p.id === activePoints[2]) && (
                        <EllipseShape ellipse={{ id: 'ghost_ellipse', centerId: activePoints[0], majorAxisPointId: activePoints[1], minorAxisPointId: activePoints[2], strokeWidth: 1, color: '#94a3b8', style: 'dashed' }} points={data.points} isSelected={false} />
                )}
                {activeTool === ToolType.ELLIPTICAL_ARC && activePoints.length >= 3 && ( <circle cx={mousePos.x} cy={mousePos.y} r={4/zoom} fill="#f97316" stroke="white" strokeWidth={1} /> )}
                {activeTool === ToolType.ELLIPTICAL_ARC && activePoints.length === 4 && (
                    <EllipticalArcShape arc={{ id: 'preview_arc', centerId: activePoints[0], majorAxisPointId: activePoints[1], minorAxisPointId: activePoints[2], startPointId: activePoints[3], endPointId: 'temp_mouse', isMajor: arcModeMajor, fillMode: arcFillMode, color: '#4f46e5', strokeWidth: 2 }} points={[...data.points, {id: 'temp_mouse', x: mousePos.x, y: mousePos.y}]} isSelected={false} isHighlighted={true} />
                )}
            </g>
        )}

        {activeTool === ToolType.CYLINDER && activePoints.length === 2 && data.points.find(p => p.id === activePoints[0]) && data.points.find(p => p.id === activePoints[1]) && ( <g opacity="0.4"> <CylinderShape cylinder={{ id: 'preview_cyl', bottomCenterId: activePoints[0], topCenterId: activePoints[1], radiusPointId: 'temp_mouse', strokeWidth: 1, color: '#4f46e5' }} points={[...data.points, { id: 'temp_mouse', x: mousePos.x, y: mousePos.y }]} isSelected={false} isHighlighted={false} /> </g> )}
        {activeTool === ToolType.CONE && activePoints.length === 2 && data.points.find(p => p.id === activePoints[0]) && data.points.find(p => p.id === activePoints[1]) && ( <g opacity="0.4"> <ConeShape cone={{ id: 'preview_cone', apexId: activePoints[0], bottomCenterId: activePoints[1], radiusPointId: 'temp_mouse', strokeWidth: 1, color: '#4f46e5' }} points={[...data.points, { id: 'temp_mouse', x: mousePos.x, y: mousePos.y }]} isSelected={false} isHighlighted={false} /> </g> )}
        {activeTool === ToolType.POLYGON && activePoints.length > 0 && ( <polyline points={activePoints.map(id => { const p = data.points.find(x => x.id === id); return p ? `${p.x},${p.y}` : ''; }).join(' ') + ` ${mousePos.x},${mousePos.y}`} fill="none" stroke="#4f46e5" strokeWidth={2/zoom} strokeDasharray="5,5" /> )}
        {activeTool === ToolType.ARC && activePoints.length === 1 && data.points.find(p => p.id === activePoints[0]) && ( <line x1={data.points.find(p => p.id === activePoints[0])!.x} y1={data.points.find(p => p.id === activePoints[0])!.y} x2={mousePos.x} y2={mousePos.y} stroke="#4f46e5" strokeWidth={2/zoom} strokeDasharray="5,5" /> )}
        {activeTool === ToolType.ARC && activePoints.length === 2 && data.points.find(p => p.id === activePoints[0]) && data.points.find(p => p.id === activePoints[1]) && ( <g> <circle cx={data.points.find(p => p.id === activePoints[0])!.x} cy={data.points.find(p => p.id === activePoints[0])!.y} r={Math.hypot(data.points.find(p => p.id === activePoints[1])!.x - data.points.find(p => p.id === activePoints[0])!.x, data.points.find(p => p.id === activePoints[1])!.y - data.points.find(p => p.id === activePoints[0])!.y)} fill="none" stroke="#4f46e5" strokeWidth={1/zoom} strokeDasharray="5,5" opacity="0.3" /> <ArcShape arc={{ id: 'preview', centerId: activePoints[0], startPointId: activePoints[1], endPointId: 'mouse_temp', isMajor: arcModeMajor, fillMode: arcFillMode }} points={[...data.points, {id: 'mouse_temp', x: mousePos.x, y: mousePos.y}]} isSelected={false} isHighlighted={true} /> </g> )}
    </g>
  );
};
