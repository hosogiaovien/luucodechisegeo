
import React from 'react';
import { Polygon, Point } from '../../types';
import { getDashArray } from '../../utils/geometry';

interface PolygonShapeProps {
  polygon: Polygon;
  points: Point[];
  isSelected: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const PolygonShape: React.FC<PolygonShapeProps> = ({ polygon, points, isSelected, onMouseDown }) => {
  let fill = 'none';
  
  // Use fillColor if available, else default to black or stroke color for fallback logic
  const fillColor = polygon.fillColor || polygon.color || 'black';
  const safeColor = fillColor.replace(/[^a-z0-9]/gi, '');

  // Default Opacity logic
  let opacity = polygon.fillOpacity !== undefined ? polygon.fillOpacity : 0.2;

  if (polygon.fillStyle === 'none') {
      fill = 'none';
  } else if (polygon.fillStyle === 'solid') {
    fill = fillColor;
    // Keep user opacity or default to 0.2
  } else if (polygon.fillStyle) {
    // Dynamic colored pattern based on fill color
    fill = `url(#pattern-${polygon.fillStyle}-${safeColor})`;
    // Patterns usually look better with higher opacity, but respect user setting if explicit
    if (polygon.fillOpacity === undefined) opacity = 1;
  } else {
    // Legacy support (fallback if fillStyle is missing but fillColor exists)
    fill = polygon.fillColor || 'none';
    if (!polygon.fillStyle && polygon.fillColor && polygon.fillOpacity === undefined) opacity = 0.1;
  }

  const dashArray = getDashArray(polygon.style || 'solid');

  return (
    <polygon 
      points={polygon.pointIds.map(id => { 
        const p = points.find(pt => pt.id === id); 
        return p ? `${p.x},${p.y}` : ''; 
      }).join(' ')} 
      fill={fill}
      fillOpacity={opacity}
      stroke={polygon.color || 'black'} 
      strokeWidth={polygon.strokeWidth || 1.5} 
      strokeDasharray={dashArray}
      strokeLinecap={polygon.style === 'dotted' ? 'round' : 'butt'}
      data-hidden={polygon.hidden} 
      className={`${isSelected ? 'selected-ring' : ''} cursor-move`} 
      onMouseDown={onMouseDown}
    />
  );
};
