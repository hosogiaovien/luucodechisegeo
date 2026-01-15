
import React from 'react';
import { Cylinder, Point } from '../../types';

interface CylinderShapeProps {
  cylinder: Cylinder;
  points: Point[];
  isSelected: boolean;
  isHighlighted: boolean;
}

export const CylinderShape: React.FC<CylinderShapeProps> = ({ cylinder, points, isSelected, isHighlighted }) => {
  const pBottom = points.find(p => p.id === cylinder.bottomCenterId);
  const pRadius = points.find(p => p.id === cylinder.radiusPointId);
  const pTop = points.find(p => p.id === cylinder.topCenterId);

  if (!pBottom || !pRadius || !pTop) return null;

  // Calculate radius based on ellipse equation rx^2 + (3*ry)^2 logic
  // rx = r, ry = r/3. 
  // We need to find r such that the point pRadius is on the ellipse boundary
  // Ellipse equation: (dx'/r)^2 + (dy'/(r/3))^2 = 1
  // dx'^2/r^2 + 9*dy'^2/r^2 = 1
  // r^2 = dx'^2 + 9*dy'^2
  
  const vx = pTop.x - pBottom.x;
  const vy = pTop.y - pBottom.y;
  const h = Math.hypot(vx, vy);
  
  // Calculate unit vectors for Major Axis (perp to cylinder axis) and Minor Axis (parallel)
  let ux, uy, px, py;
  
  if (h < 1e-9) {
      // Degenerate case, just fallback
      ux = 0; uy = 1; px = 1; py = 0;
  } else {
      // Minor axis direction (along cylinder axis)
      ux = vx / h;
      uy = vy / h;
      // Major axis direction (perpendicular)
      px = -uy;
      py = ux;
  }

  // Vector from Top Center to Radius Point
  const dx = pRadius.x - pTop.x;
  const dy = pRadius.y - pTop.y;
  
  // Project onto Major and Minor axes
  const distMajor = Math.abs(dx * px + dy * py);
  const distMinor = Math.abs(dx * ux + dy * uy);
  
  // r = sqrt(dMajor^2 + 9 * dMinor^2)
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
  
  const t1x = pTop.x + nx * r;
  const t1y = pTop.y + ny * r;
  const t2x = pTop.x - nx * r;
  const t2y = pTop.y - ny * r;

  const highlightClass = isHighlighted ? 'stroke-orange-500 stroke-[3px]' : '';
  const selectedClass = isSelected ? 'selected-ring' : '';

  // Bán kính trục bé của ellipse đáy (để tạo phối cảnh 3D)
  const ry = r / 3;

  return (
    <g data-hidden={cylinder.hidden} className={`${highlightClass} ${selectedClass}`}>
      {/* Trục tâm (Nét đứt mờ) */}
      <line x1={pBottom.x} y1={pBottom.y} x2={pTop.x} y2={pTop.y} stroke={cylinder.color || 'black'} strokeWidth={1} strokeDasharray="5,5" opacity="0.3" />
      {/* Bán kính (Nét đứt mờ) */}
      <line x1={pTop.x} y1={pTop.y} x2={pRadius.x} y2={pRadius.y} stroke={cylinder.color || 'black'} strokeWidth={1} strokeDasharray="5,5" opacity="0.3" />

      {/* ĐÁY DƯỚI: Chia làm 2 cung */}
      {/* Cung sau (bị khuất -> Nét đứt) */}
      <path
        d={`M ${b1x} ${b1y} A ${r} ${ry} ${ellipseRotation} 0 0 ${b2x} ${b2y}`}
        fill="none" stroke={cylinder.color || 'black'} strokeWidth={cylinder.strokeWidth || 1.5}
        strokeDasharray="5,3"
      />
      {/* Cung trước (nhìn thấy -> Nét liền) */}
      <path
        d={`M ${b2x} ${b2y} A ${r} ${ry} ${ellipseRotation} 0 0 ${b1x} ${b1y}`}
        fill="none" stroke={cylinder.color || 'black'} strokeWidth={cylinder.strokeWidth || 1.5}
      />

      {/* ĐÁY TRÊN: Nguyên ellipse (nhìn thấy toàn bộ hoặc vẽ liền cho đẹp) */}
      <ellipse cx={pTop.x} cy={pTop.y} rx={r} ry={ry} transform={`rotate(${ellipseRotation}, ${pTop.x}, ${pTop.y})`}
        fill="none" stroke={cylinder.color || 'black'} strokeWidth={cylinder.strokeWidth || 1.5}
      />

      {/* Đường sinh (Cạnh bên) */}
      <line x1={b1x} y1={b1y} x2={t1x} y2={t1y} stroke={cylinder.color || 'black'} strokeWidth={cylinder.strokeWidth || 1.5} />
      <line x1={b2x} y1={b2y} x2={t2x} y2={t2y} stroke={cylinder.color || 'black'} strokeWidth={cylinder.strokeWidth || 1.5} />
    </g>
  );
};
