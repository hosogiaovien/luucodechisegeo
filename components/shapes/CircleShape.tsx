
import React from 'react';
import { Circle, Point } from '../../types';
import { getDashArray } from '../../utils/geometry';

interface CircleShapeProps {
  circle: Circle;
  points: Point[];
  isSelected: boolean;
  isHighlighted?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const CircleShape: React.FC<CircleShapeProps> = ({ circle, points, isSelected, isHighlighted, onMouseDown }) => {
  const center = points.find(p => p.id === circle.centerId);
  if (!center) return null;
  let r = circle.radiusValue || 50;
  if (circle.radiusPointId) {
    const rp = points.find(p => p.id === circle.radiusPointId);
    if (rp) r = Math.hypot(rp.x - center.x, rp.y - center.y);
  }

  const dashArray = getDashArray(circle.style || 'solid');

  let fill = 'none';
  
  const fillColor = circle.fillColor || circle.color || 'black';
  const safeColor = fillColor.replace(/[^a-z0-9]/gi, '');

  let opacity = circle.fillOpacity !== undefined ? circle.fillOpacity : 0.2;

  if (circle.fillStyle === 'none') {
      fill = 'none';
  } else if (circle.fillStyle === 'solid') {
    fill = fillColor;
  } else if (circle.fillStyle) {
    fill = `url(#pattern-${circle.fillStyle}-${safeColor})`;
    if (circle.fillOpacity === undefined) opacity = 1;
  } else {
    fill = circle.fillColor || 'none';
    if (!circle.fillStyle && circle.fillColor && circle.fillOpacity === undefined) opacity = 0.1;
  }

  return (
    <circle 
      cx={center.x} cy={center.y} r={r} 
      fill={fill}
      fillOpacity={opacity}
      stroke={circle.color || 'black'} 
      strokeWidth={circle.strokeWidth || 1.5} 
      strokeDasharray={dashArray} 
      strokeLinecap={circle.style === 'dotted' ? 'round' : 'butt'}
      data-hidden={circle.hidden} 
      className={`${isSelected ? 'selected-ring' : ''} ${isHighlighted ? 'construction-highlight' : ''}`}
      onMouseDown={onMouseDown}
      style={{ cursor: onMouseDown ? 'move' : 'default' }}
    />
  );
};
