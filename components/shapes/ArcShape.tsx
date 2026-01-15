
import React from 'react';
import { Arc, Point } from '../../types';

interface ArcShapeProps {
  arc: Arc;
  points: Point[];
  isSelected: boolean;
  isHighlighted: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const ArcShape: React.FC<ArcShapeProps> = ({ arc, points, isSelected, isHighlighted, onMouseDown }) => {
  const center = points.find(p => p.id === arc.centerId);
  const start = points.find(p => p.id === arc.startPointId);
  const end = points.find(p => p.id === arc.endPointId);

  if (!center || !start || !end) return null;

  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);

  let normStart = startAngle < 0 ? startAngle + 2*Math.PI : startAngle;
  let normEnd = endAngle < 0 ? endAngle + 2*Math.PI : endAngle;

  let delta = normEnd - normStart;
  if (delta < 0) delta += 2 * Math.PI;

  let sweepFlag = 1; 
  let largeArcFlag = 0;

  if (!arc.isMajor) {
      if (delta > Math.PI) { sweepFlag = 0; largeArcFlag = 0; } 
      else { sweepFlag = 1; largeArcFlag = 0; }
  } else {
      if (delta > Math.PI) { sweepFlag = 1; largeArcFlag = 1; } 
      else { sweepFlag = 0; largeArcFlag = 1; }
  }

  const realEndX = center.x + radius * Math.cos(endAngle);
  const realEndY = center.y + radius * Math.sin(endAngle);

  let fill = 'none';
  const fillColor = arc.fillColor || arc.color || 'black';
  const safeColor = fillColor.replace(/[^a-z0-9]/gi, '');
  
  let opacity = arc.fillOpacity !== undefined ? arc.fillOpacity : 0.2;

  let d = "";

  if (arc.fillStyle === 'none') {
      // Basic arc line only
      fill = 'none';
      d = [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, sweepFlag, realEndX, realEndY
      ].join(" ");
  } else if (arc.fillStyle) {
    // Handling Fill Modes
    if (arc.fillMode === 'sector') {
      // HÌNH QUẠT: Đi từ tâm -> Start -> Arc -> End -> Tâm
      d = [
        "M", center.x, center.y,
        "L", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, sweepFlag, realEndX, realEndY,
        "Z"
      ].join(" ");
    } else {
      // VIÊN PHÂN (Default): Start -> Arc -> End -> Close (Chord)
      d = [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, sweepFlag, realEndX, realEndY,
        "Z"
      ].join(" ");
    }

    if (arc.fillStyle === 'solid') {
      fill = fillColor;
    } else {
      fill = `url(#pattern-${arc.fillStyle}-${safeColor})`;
      if (arc.fillOpacity === undefined) opacity = 1;
    }
  }

  let dashArray = '0';
  if (arc.style === 'dashed') dashArray = '10,8';
  else if (arc.style === 'dotted') dashArray = '2,5';

  return (
    <path
      d={d}
      fill={fill}
      fillOpacity={opacity}
      stroke={arc.color || 'black'}
      strokeWidth={arc.strokeWidth || 1.5}
      strokeDasharray={dashArray}
      className={`${isSelected ? 'selected-ring' : ''} ${isHighlighted ? 'stroke-orange-500 stroke-[3px]' : ''}`}
      data-hidden={arc.hidden}
      onMouseDown={onMouseDown}
      style={{ cursor: onMouseDown ? 'move' : 'default' }}
    />
  );
};
