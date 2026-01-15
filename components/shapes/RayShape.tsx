
import React from 'react';
import { Ray, Point } from '../../types';

interface RayShapeProps {
  ray: Ray;
  points: Point[];
  isSelected: boolean;
  isHighlighted?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const RayShape: React.FC<RayShapeProps> = ({ ray, points, isSelected, isHighlighted, onMouseDown }) => {
  const p1 = points.find(p => p.id === ray.startPointId);
  const p2 = points.find(p => p.id === ray.directionPointId);
  if (!p1 || !p2) return null;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  let dashArray = '0';
  if (ray.style === 'dashed') dashArray = '10,8';
  else if (ray.style === 'dotted') dashArray = '2,5';

  return (
    <line 
      x1={p1.x} y1={p1.y} x2={p1.x + dx * 10} y2={p1.y + dy * 10} 
      stroke={ray.color || 'black'} 
      strokeWidth={ray.strokeWidth || 1.5} 
      strokeDasharray={dashArray} 
      strokeLinecap={ray.style === 'dotted' ? 'round' : 'butt'}
      data-hidden={ray.hidden} 
      className={`${isSelected ? 'selected-ring' : ''} ${isHighlighted ? 'construction-highlight' : ''}`}
      onMouseDown={onMouseDown}
      style={{ cursor: onMouseDown ? 'move' : 'default' }}
    />
  );
};
