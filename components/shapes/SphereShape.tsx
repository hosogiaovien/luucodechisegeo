
import React from 'react';
import { Sphere, Point } from '../../types';

interface SphereShapeProps {
  sphere: Sphere;
  points: Point[];
  isSelected: boolean;
  isHighlighted: boolean;
}

export const SphereShape: React.FC<SphereShapeProps> = ({ sphere, points, isSelected, isHighlighted }) => {
  const center = points.find(p => p.id === sphere.centerId);
  const radiusP = points.find(p => p.id === sphere.radiusPointId);

  if (!center || !radiusP) return null;

  const r = Math.hypot(radiusP.x - center.x, radiusP.y - center.y);

  const highlightClass = isHighlighted ? 'stroke-orange-500 stroke-[3px]' : '';
  const selectedClass = isSelected ? 'selected-ring' : '';

  return (
    <g data-hidden={sphere.hidden} className={`${highlightClass} ${selectedClass}`}>
      {/* Đường tròn bao ngoài */}
      <circle
        cx={center.x}
        cy={center.y}
        r={r}
        fill="none"
        stroke={sphere.color || 'black'}
        strokeWidth={sphere.strokeWidth || 1.5}
      />
      {/* Đường xích đạo (Ellipse) - Nửa liền nửa đứt */}
      <ellipse
        cx={center.x}
        cy={center.y}
        rx={r}
        ry={r / 3}
        fill="none"
        stroke={sphere.color || 'black'}
        strokeWidth={sphere.strokeWidth || 1}
        strokeDasharray="4,4" // Vẽ tạm nét đứt toàn bộ cho đơn giản
      />
    </g>
  );
};
