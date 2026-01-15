
import React from 'react';
import { Cone, Point } from '../../types';

interface ConeShapeProps {
  cone: Cone;
  points: Point[];
  isSelected: boolean;
  isHighlighted: boolean;
}

export const ConeShape: React.FC<ConeShapeProps> = ({ cone, points, isSelected, isHighlighted }) => {
  const pBottom = points.find(p => p.id === cone.bottomCenterId);
  const pRadius = points.find(p => p.id === cone.radiusPointId);
  const pApex = points.find(p => p.id === cone.apexId);

  if (!pBottom || !pRadius || !pApex) return null;

  // Calculate radius based on ellipse equation rx^2 + (3*ry)^2 logic
  // Ensure the ellipse passes through pRadius
  const vx = pApex.x - pBottom.x;
  const vy = pApex.y - pBottom.y;
  const h = Math.hypot(vx, vy);
  
  let ux, uy, px, py;
  
  if (h < 1e-9) {
      ux = 0; uy = 1; px = 1; py = 0;
  } else {
      // Minor axis direction (along cone axis)
      ux = vx / h;
      uy = vy / h;
      // Major axis direction (perpendicular)
      px = -uy;
      py = ux;
  }

  // Vector from Bottom Center to Radius Point
  const dx = pRadius.x - pBottom.x;
  const dy = pRadius.y - pBottom.y;
  
  // Project onto Major and Minor axes
  const distMajor = Math.abs(dx * px + dy * py);
  const distMinor = Math.abs(dx * ux + dy * uy);
  
  // r = sqrt(dMajor^2 + 9 * dMinor^2) (Assuming ry = r/3)
  const r = Math.sqrt(distMajor * distMajor + 9 * distMinor * distMinor);

  const angleRad = Math.atan2(vy, vx);
  const angleDeg = angleRad * (180 / Math.PI);
  const ellipseRotation = angleDeg - 90;

  let nx = -vy; let ny = vx;
  if (h > 0) { nx /= h; ny /= h; } else { nx = 1; ny = 0; }

  const b1x = pBottom.x + nx * r;
  const b1y = pBottom.y + ny * r;
  const b2x = pBottom.x - nx * r;
  const b2y = pBottom.y - ny * r;

  const highlightClass = isHighlighted ? 'stroke-orange-500 stroke-[3px]' : '';
  const selectedClass = isSelected ? 'selected-ring' : '';
  
  const ry = r / 3;

  return (
    <g data-hidden={cone.hidden} className={`${highlightClass} ${selectedClass}`}>
      {/* Trục tâm (Nét đứt mờ) */}
      <line x1={pBottom.x} y1={pBottom.y} x2={pApex.x} y2={pApex.y} stroke={cone.color || 'black'} strokeWidth={1} strokeDasharray="5,5" opacity="0.3" />
      {/* Bán kính đáy (Nét đứt mờ) */}
      <line x1={pBottom.x} y1={pBottom.y} x2={pRadius.x} y2={pRadius.y} stroke={cone.color || 'black'} strokeWidth={1} strokeDasharray="5,5" opacity="0.3" />

      {/* ĐÁY: Chia làm 2 cung */}
      {/* Cung sau (bị khuất -> Nét đứt) */}
      <path
        d={`M ${b1x} ${b1y} A ${r} ${ry} ${ellipseRotation} 0 0 ${b2x} ${b2y}`}
        fill="none" stroke={cone.color || 'black'} strokeWidth={cone.strokeWidth || 1.5}
        strokeDasharray="5,3"
      />
      {/* Cung trước (nhìn thấy -> Nét liền) */}
      <path
        d={`M ${b2x} ${b2y} A ${r} ${ry} ${ellipseRotation} 0 0 ${b1x} ${b1y}`}
        fill="none" stroke={cone.color || 'black'} strokeWidth={cone.strokeWidth || 1.5}
      />

      {/* Đường sinh (Cạnh bên) */}
      <line x1={b1x} y1={b1y} x2={pApex.x} y2={pApex.y} stroke={cone.color || 'black'} strokeWidth={cone.strokeWidth || 1.5} />
      <line x1={b2x} y1={b2y} x2={pApex.x} y2={pApex.y} stroke={cone.color || 'black'} strokeWidth={cone.strokeWidth || 1.5} />
    </g>
  );
};
