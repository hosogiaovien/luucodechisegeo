
import React from 'react';
import { InfiniteLine, Point } from '../../types';

interface LineShapeProps {
  line: InfiniteLine;
  points: Point[];
  isSelected: boolean;
  isHighlighted?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const LineShape: React.FC<LineShapeProps> = ({ line, points, isSelected, isHighlighted, onMouseDown }) => {
  const p1 = points.find(p => p.id === line.p1Id);
  const p2 = points.find(p => p.id === line.p2Id);
  if (!p1 || !p2) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let dashArray = '0';
  if (line.style === 'dashed') dashArray = '10,8';
  else if (line.style === 'dotted') dashArray = '2,5';

  return (
    <line 
      x1={p1.x - dx * 2000} y1={p1.y - dy * 2000} 
      x2={p1.x + dx * 2000} y2={p1.y + dy * 2000} 
      stroke={line.color || 'black'} 
      strokeWidth={line.strokeWidth || 1.5} 
      strokeDasharray={dashArray} 
      strokeLinecap={line.style === 'dotted' ? 'round' : 'butt'}
      data-hidden={line.hidden} 
      className={`${isSelected ? 'selected-ring' : ''} ${isHighlighted ? 'construction-highlight' : ''}`}
      onMouseDown={onMouseDown}
      style={{ cursor: onMouseDown ? 'move' : 'default' }}
    />
  );
};
