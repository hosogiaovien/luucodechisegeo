
import React from 'react';
import { Point, ToolType } from '../../types';

interface PointShapeProps {
  point: Point;
  isSelected: boolean;
  isHighlighted?: boolean;
  activeTool: ToolType;
  setDraggedLabelId: (id: string) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  isArrowPoint?: boolean;
}

export const PointShape: React.FC<PointShapeProps> = ({ point, isSelected, isHighlighted, activeTool, setDraggedLabelId, onMouseDown, isArrowPoint }) => {
  return (
    <g data-hidden={point.hidden}>
      {/* Hit area - always visible to mouse but maybe transparent */}
      <circle 
        cx={point.x} cy={point.y} r={isArrowPoint ? 6 : (point.radius || 4)} 
        fill={isArrowPoint ? 'transparent' : (point.color || 'black')} 
        stroke="none" 
        className={`${isSelected ? 'selected-point' : 'cursor-pointer'} ${isHighlighted ? 'highlighted-point' : ''}`}
        onMouseDown={onMouseDown} 
        style={{ opacity: isArrowPoint ? 0 : 1, cursor: 'move' }}
      />
      {!isArrowPoint && point.label && (
        <text 
          x={point.x + (point.labelOffsetX || 15)} 
          y={point.y + (point.labelOffsetY || -15)} 
          fontSize="24" fontWeight="black" 
          fill={point.color || 'black'} 
          textAnchor="middle" dominantBaseline="middle" 
          style={{cursor:'move'}} 
          onMouseDown={(e) => { e.stopPropagation(); setDraggedLabelId(point.id); }}
        >
          {point.label}
        </text>
      )}
    </g>
  );
};
