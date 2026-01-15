
import React from 'react';
import { Ellipse, Point } from '../../types';

interface EllipseShapeProps {
  ellipse: Ellipse;
  points?: Point[]; // Optional for legacy support, but required for new tool
  isSelected: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const EllipseShape: React.FC<EllipseShapeProps> = ({ ellipse, points, isSelected, onMouseDown }) => {
  let dashArray = '0';
  if (ellipse.style === 'dashed') dashArray = '10,8';
  else if (ellipse.style === 'dotted') dashArray = '2,5';

  let fill = 'none';
  const fillColor = ellipse.fillColor || ellipse.color || 'black';
  const safeColor = fillColor.replace(/[^a-z0-9]/gi, '');

  let opacity = ellipse.fillOpacity !== undefined ? ellipse.fillOpacity : 0.2;

  if (ellipse.fillStyle === 'none') {
      fill = 'none';
  } else if (ellipse.fillStyle === 'solid') {
    fill = fillColor;
  } else if (ellipse.fillStyle) {
    fill = `url(#pattern-${ellipse.fillStyle}-${safeColor})`;
    if (ellipse.fillOpacity === undefined) opacity = 1;
  } else {
    fill = ellipse.fillColor || 'none';
    if (!ellipse.fillStyle && ellipse.fillColor && ellipse.fillOpacity === undefined) opacity = 0.1;
  }

  // Calculate geometry
  let cx = ellipse.cx || 0;
  let cy = ellipse.cy || 0;
  let rx = ellipse.rx || 50;
  let ry = ellipse.ry || 30;
  let rotation = ellipse.rotation || 0;

  // If points are provided and linked, recalculate based on points
  if (points && ellipse.centerId && ellipse.majorAxisPointId && ellipse.minorAxisPointId) {
      const center = points.find(p => p.id === ellipse.centerId);
      const pMajor = points.find(p => p.id === ellipse.majorAxisPointId);
      const pMinor = points.find(p => p.id === ellipse.minorAxisPointId);

      if (center && pMajor && pMinor) {
          cx = center.x;
          cy = center.y;
          rx = Math.hypot(pMajor.x - center.x, pMajor.y - center.y);
          ry = Math.hypot(pMinor.x - center.x, pMinor.y - center.y);
          const angleRad = Math.atan2(pMajor.y - center.y, pMajor.x - center.x);
          rotation = angleRad * (180 / Math.PI);
      }
  }

  return (
    <ellipse 
      cx={cx} cy={cy} rx={rx} ry={ry} 
      transform={`rotate(${rotation}, ${cx}, ${cy})`}
      fill={fill}
      fillOpacity={opacity}
      stroke={ellipse.color || 'black'} 
      strokeWidth={ellipse.strokeWidth || 1.5} 
      strokeDasharray={dashArray}
      strokeLinecap={ellipse.style === 'dotted' ? 'round' : 'butt'} 
      data-hidden={ellipse.hidden} 
      className={isSelected ? 'selected-ring' : ''} 
      onMouseDown={onMouseDown}
      style={{ cursor: onMouseDown ? 'move' : 'default' }}
    />
  );
};
