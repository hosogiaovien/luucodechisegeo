import React from 'react';
import { GeometryData, ToolType, SelectionState, TextElement } from '../types';

// Import shapes
import { LineShape } from './shapes/LineShape';
import { RayShape } from './shapes/RayShape';
import { SegmentShape } from './shapes/SegmentShape';
import { CircleShape } from './shapes/CircleShape';
import { EllipseShape } from './shapes/EllipseShape';
import { PolygonShape } from './shapes/PolygonShape';
import { TextShape } from './shapes/TextShape';
import { PointShape } from './shapes/PointShape';
import { ArcShape } from './shapes/ArcShape';
import { SphereShape } from './shapes/SphereShape';
import { CylinderShape } from './shapes/CylinderShape';
import { ConeShape } from './shapes/ConeShape';
import { AngleShape } from './shapes/AngleShape';
import { EllipticalArcShape } from './shapes/EllipticalArcShape';
import { FunctionGraphShape } from './shapes/FunctionGraphShape';
import { ImageShape } from './shapes/ImageShape';
import { IntegralShape } from './shapes/IntegralShape';

interface GeometryLayerProps {
  data: GeometryData;
  activeTool: ToolType;
  selectedElements: SelectionState[];
  activePoints: string[];
  hoveredElement: { type: string, id: string } | null;
  pan: { x: number; y: number };
  zoom: number;
  viewSize: { width: number; height: number };
  gridSize: number;
  
  // Callbacks
  onResizeHandleMouseDown: (e: React.MouseEvent, handle: string, img: any) => void;
  onSelectionChange: (newSelection: SelectionState[], dragged?: SelectionState[]) => void;
  setDraggedLabelId: (id: string) => void;
  setDraggedFunctionLabelId: (id: string) => void;
  handleDoubleClickText: (e: React.MouseEvent, t: TextElement) => void;
}

export const GeometryLayer: React.FC<GeometryLayerProps> = ({
  data, activeTool, selectedElements, activePoints, hoveredElement,
  pan, zoom, viewSize, gridSize,
  onResizeHandleMouseDown, onSelectionChange, setDraggedLabelId, setDraggedFunctionLabelId, handleDoubleClickText
}) => {

  const isSelected = (type: string, id: string) => selectedElements.some(el => el.type === type && el.id === id);
  const isHighlighted = (id: string) => activePoints.includes(id) || (hoveredElement?.id === id);

  const handleSelection = (e: React.MouseEvent, type: SelectionState['type'], id: string) => {
      if (activeTool !== ToolType.SELECT && activeTool !== ToolType.TEXT && type === 'text') return; // Special case for text edit
      if (activeTool !== ToolType.SELECT) return;
      
      e.stopPropagation();
      e.preventDefault(); // Prevents default browser drag behavior
      
      if (e.shiftKey || e.ctrlKey) {
          if (isSelected(type, id)) {
              // Deselect: Remove from selection and don't drag anything
              const newSelection = selectedElements.filter(el => el.id !== id);
              onSelectionChange(newSelection, []);
          } else {
              // Add to selection: Add item and prepare to drag the ENTIRE new group
              const item = { type, id };
              const newSelection = [...selectedElements, item];
              onSelectionChange(newSelection, newSelection); 
          }
      } else {
          if (!isSelected(type, id)) {
              // Select Single
              const item = { type, id };
              onSelectionChange([item], [item]);
          } else {
              // Clicking an already selected item -> Keep group selection, Drag group
              onSelectionChange(selectedElements, selectedElements);
          }
      }
  };

  const pointsToHide = new Set<string>();
  if (data.segments) {
      data.segments.forEach(s => {
          if (s.arrows === 'start' || s.arrows === 'both') pointsToHide.add(s.startPointId);
          if (s.arrows === 'end' || s.arrows === 'both') pointsToHide.add(s.endPointId);
      });
  }

  return (
    <g className="geometry-layer">
        {/* Axis Highlight Effect */}
        {(isHighlighted('axis-x') || isSelected('axis', 'axis-x')) && (
            <line x1={-100000} y1={0} x2={100000} y2={0} stroke="#f97316" strokeWidth={3 / zoom} opacity={0.6} />
        )}
        {(isHighlighted('axis-y') || isSelected('axis', 'axis-y')) && (
            <line x1={0} y1={-100000} x2={0} y2={100000} stroke="#f97316" strokeWidth={3 / zoom} opacity={0.6} />
        )}

        {/* Projection Lines */}
        {data.points.map(p => {
            if (p.showCoordProj && !p.hidden) {
                return (
                    <g key={`proj-${p.id}`}>
                        <line x1={p.x} y1={p.y} x2={p.x} y2={0} stroke={p.projColor || '#94a3b8'} strokeWidth={1} strokeDasharray="4,4" />
                        <line x1={p.x} y1={p.y} x2={0} y2={p.y} stroke={p.projColor || '#94a3b8'} strokeWidth={1} strokeDasharray="4,4" />
                    </g>
                );
            }
            return null;
        })}

        {/* Render Integrals First */}
        {(data.integrals || []).map(int => {
            const g1 = data.functionGraphs?.find(g => g.id === int.graph1Id);
            const g2 = data.functionGraphs?.find(g => g.id === int.graph2Id);
            if (!g1 || !g2) return null;
            return (
                <IntegralShape 
                    key={int.id} integral={int} graph1={g1} graph2={g2}
                    pan={pan} zoom={zoom} viewSize={viewSize} gridSize={gridSize}
                    isSelected={isSelected('integral', int.id)}
                    variables={data.variables}
                />
            );
        })}

        {/* Render Images */}
        {(data.images || []).map(img => (
            <ImageShape 
                key={img.id} image={img} isSelected={isSelected('image', img.id)}
                activeTool={activeTool} zoom={zoom}
                onResizeHandleMouseDown={(e, handle) => onResizeHandleMouseDown(e, handle, img)}
                onMouseDown={(e) => handleSelection(e, 'image', img.id)}
            />
        ))}

        {(data.functionGraphs || []).map(g => ( 
            <FunctionGraphShape 
                key={g.id} graph={g} pan={pan} zoom={zoom} viewSize={viewSize} gridSize={gridSize || 50}
                isSelected={isSelected('functionGraph', g.id)} isHighlighted={isHighlighted(g.id)} 
                setDraggedFunctionLabelId={setDraggedFunctionLabelId}
                variables={data.variables}
                onLabelMouseDown={(e) => handleSelection(e, 'functionGraph', g.id)}
            /> 
        ))}

        {(data.cylinders || []).map(cyl => ( <CylinderShape key={cyl.id} cylinder={cyl} points={data.points} isSelected={isSelected('cylinder', cyl.id)} isHighlighted={isHighlighted(cyl.id)} /> ))}
        {(data.cones || []).map(cone => ( <ConeShape key={cone.id} cone={cone} points={data.points} isSelected={isSelected('cone', cone.id)} isHighlighted={isHighlighted(cone.id)} /> ))}
        {(data.spheres || []).map(sph => ( <SphereShape key={sph.id} sphere={sph} points={data.points} isSelected={isSelected('sphere', sph.id)} isHighlighted={isHighlighted(sph.id)} /> ))}
        
        {(data.lines || []).map(l => ( 
            <LineShape 
                key={l.id} line={l} points={data.points} 
                isSelected={isSelected('line', l.id)} isHighlighted={isHighlighted(l.id)} 
                onMouseDown={(e) => handleSelection(e, 'line', l.id)}
            /> 
        ))}
        {(data.rays || []).map(r => ( 
            <RayShape 
                key={r.id} ray={r} points={data.points} 
                isSelected={isSelected('ray', r.id)} isHighlighted={isHighlighted(r.id)} 
                onMouseDown={(e) => handleSelection(e, 'ray', r.id)}
            /> 
        ))}
        {(data.segments || []).map(seg => ( 
            <SegmentShape 
                key={seg.id} segment={seg} points={data.points} 
                isSelected={isSelected('segment', seg.id)} isHighlighted={isHighlighted(seg.id)} 
                onMouseDown={(e) => handleSelection(e, 'segment', seg.id)}
            /> 
        ))}
        {(data.circles || []).map(c => ( 
            <CircleShape 
                key={c.id} circle={c} points={data.points} 
                isSelected={isSelected('circle', c.id)} isHighlighted={isHighlighted(c.id)} 
                onMouseDown={(e) => handleSelection(e, 'circle', c.id)}
            /> 
        ))}
        {(data.arcs || []).map(arc => ( 
            <ArcShape 
                key={arc.id} arc={arc} points={data.points} 
                isSelected={isSelected('arc', arc.id)} isHighlighted={isHighlighted(arc.id)} 
                onMouseDown={(e) => handleSelection(e, 'arc', arc.id)}
            /> 
        ))}
        {(data.ellipticalArcs || []).map(arc => ( 
            <EllipticalArcShape 
                key={arc.id} arc={arc} points={data.points} 
                isSelected={isSelected('ellipticalArc', arc.id)} isHighlighted={isHighlighted(arc.id)} 
                onMouseDown={(e) => handleSelection(e, 'ellipticalArc', arc.id)}
            /> 
        ))}
        {(data.ellipses || []).map(ellipseObj => ( 
            <EllipseShape 
                key={ellipseObj.id} ellipse={ellipseObj} points={data.points} 
                isSelected={isSelected('ellipse', ellipseObj.id)} 
                onMouseDown={(e) => handleSelection(e, 'ellipse', ellipseObj.id)}
            /> 
        ))}
        
        {/* Updated PolygonShape with selection handler */}
        {(data.polygons || []).map(poly => ( 
            <PolygonShape 
                key={poly.id} 
                polygon={poly} 
                points={data.points} 
                isSelected={isSelected('polygon', poly.id)} 
                onMouseDown={(e) => handleSelection(e, 'polygon', poly.id)}
            /> 
        ))}
        
        {(data.angles || []).map(ang => ( <AngleShape key={ang.id} angle={ang} points={data.points} isSelected={isSelected('angle', ang.id)} isHighlighted={isHighlighted(ang.id)} /> ))}
        {(data.texts || []).map(t => ( 
            <TextShape 
                key={t.id} text={t} isSelected={isSelected('text', t.id)} activeTool={activeTool} 
                handleDoubleClick={handleDoubleClickText} 
                onMouseDown={(e) => handleSelection(e, 'text', t.id)} 
            /> 
        ))}
        {(data.points || []).map(p => ( 
            <PointShape 
                key={p.id} point={p} isSelected={isSelected('point', p.id)} 
                isHighlighted={isHighlighted(p.id)}
                activeTool={activeTool} setDraggedLabelId={setDraggedLabelId} 
                isArrowPoint={pointsToHide.has(p.id)}
                onMouseDown={(e) => handleSelection(e, 'point', p.id)} 
            /> 
        ))}
    </g>
  );
};