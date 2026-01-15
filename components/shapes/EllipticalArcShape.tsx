
import React from 'react';
import { EllipticalArc, Point } from '../../types';

interface EllipticalArcShapeProps {
  arc: EllipticalArc;
  points: Point[];
  isSelected: boolean;
  isHighlighted: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const EllipticalArcShape: React.FC<EllipticalArcShapeProps> = ({ arc, points, isSelected, isHighlighted, onMouseDown }) => {
  const center = points.find(p => p.id === arc.centerId);
  const pMajor = points.find(p => p.id === arc.majorAxisPointId);
  const pMinor = points.find(p => p.id === arc.minorAxisPointId);
  const pStart = points.find(p => p.id === arc.startPointId);
  const pEnd = points.find(p => p.id === arc.endPointId);

  if (!center || !pMajor || !pMinor || !pStart || !pEnd) return null;

  // Calculate Geometry from points
  const rx = Math.hypot(pMajor.x - center.x, pMajor.y - center.y);
  const ry = Math.hypot(pMinor.x - center.x, pMinor.y - center.y);
  
  const rotationRad = Math.atan2(pMajor.y - center.y, pMajor.x - center.x);
  const rotationDeg = rotationRad * (180 / Math.PI);

  // To calculate angles relative to the ellipse local coordinate system:
  // 1. Transform pStart/pEnd to local coords (translate to origin, rotate -rotation)
  // 2. Adjust for ellipse scaling (y / ry * rx) -> transform to circle space
  // 3. Atan2
  
  const getEllipseAngle = (px: number, py: number) => {
      // Translate
      const tx = px - center.x;
      const ty = py - center.y;
      // Rotate backwards
      const cos = Math.cos(-rotationRad);
      const sin = Math.sin(-rotationRad);
      const rx_local = tx * cos - ty * sin;
      const ry_local = tx * sin + ty * cos;
      
      // Calculate angle in "parametric" space (circle space)
      // Standard ellipse param: x = rx cos t, y = ry sin t
      // t = atan2(y/ry, x/rx)
      return Math.atan2(ry_local / ry, rx_local / rx);
  };

  const startAngle = getEllipseAngle(pStart.x, pStart.y);
  const endAngle = getEllipseAngle(pEnd.x, pEnd.y);

  let normStart = startAngle < 0 ? startAngle + 2*Math.PI : startAngle;
  let normEnd = endAngle < 0 ? endAngle + 2*Math.PI : endAngle;

  let delta = normEnd - normStart;
  if (delta < 0) delta += 2 * Math.PI;

  let largeArcFlag = 0;
  let sweepFlag = 1; 

  if (!arc.isMajor) {
      if (delta > Math.PI) { largeArcFlag = 0; sweepFlag = 0; } 
      else { largeArcFlag = 0; sweepFlag = 1; }
  } else {
      if (delta > Math.PI) { largeArcFlag = 1; sweepFlag = 1; } 
      else { largeArcFlag = 1; sweepFlag = 0; }
  }
  
  const getPointOnEllipse = (angle: number) => {
      // In local unrotated space
      const lx = rx * Math.cos(angle);
      const ly = ry * Math.sin(angle);
      // Rotate + Translate back
      const cos = Math.cos(rotationRad);
      const sin = Math.sin(rotationRad);
      return {
          x: center.x + lx * cos - ly * sin,
          y: center.y + lx * sin + ly * cos
      };
  };

  const realStart = getPointOnEllipse(normStart);
  const realEnd = getPointOnEllipse(normEnd);

  const useSweep = ( (!arc.isMajor && delta <= Math.PI) || (arc.isMajor && delta > Math.PI) ) ? 1 : 0;
  const useLarge = arc.isMajor ? 1 : 0;

  let finalSweep = 1;
  let finalLarge = 0;
  
  if (!arc.isMajor) {
      // Shortest path
      if (delta <= Math.PI) { finalSweep = 1; finalLarge = 0; }
      else { finalSweep = 0; finalLarge = 0; }
  } else {
      // Longest path
      if (delta <= Math.PI) { finalSweep = 0; finalLarge = 1; }
      else { finalSweep = 1; finalLarge = 1; }
  }

  let d = "";
  let fill = 'none';
  const fillColor = arc.fillColor || arc.color || 'black';
  const safeColor = fillColor.replace(/[^a-z0-9]/gi, '');
  
  let opacity = arc.fillOpacity !== undefined ? arc.fillOpacity : 0.2;

  if (arc.fillMode === 'sector' && arc.fillStyle && arc.fillStyle !== 'none') {
      d = `M ${center.x} ${center.y} L ${realStart.x} ${realStart.y} A ${rx} ${ry} ${rotationDeg} ${finalLarge} ${finalSweep} ${realEnd.x} ${realEnd.y} Z`;
  } else if (arc.fillStyle && arc.fillStyle !== 'none') {
      // Chord
      d = `M ${realStart.x} ${realStart.y} A ${rx} ${ry} ${rotationDeg} ${finalLarge} ${finalSweep} ${realEnd.x} ${realEnd.y} Z`;
  } else {
      d = `M ${realStart.x} ${realStart.y} A ${rx} ${ry} ${rotationDeg} ${finalLarge} ${finalSweep} ${realEnd.x} ${realEnd.y}`;
  }

  if (arc.fillStyle === 'none' || !arc.fillStyle) {
      fill = 'none';
  } else if (arc.fillStyle === 'solid') {
      fill = fillColor;
  } else {
      fill = `url(#pattern-${arc.fillStyle}-${safeColor})`;
      if (arc.fillOpacity === undefined) opacity = 1;
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
