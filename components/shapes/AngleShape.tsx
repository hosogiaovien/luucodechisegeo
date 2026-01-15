
import React from 'react';
import { Angle, Point } from '../../types';

interface AngleShapeProps {
  angle: Angle;
  points: Point[];
  isSelected: boolean;
  isHighlighted?: boolean;
}

export const AngleShape: React.FC<AngleShapeProps> = ({ angle, points, isSelected, isHighlighted }) => {
  const center = points.find(p => p.id === angle.centerId);
  const p1 = points.find(p => p.id === angle.point1Id);
  const p2 = points.find(p => p.id === angle.point2Id);

  if (!center || !p1 || !p2) return null;

  const radius = 25; // Bán kính cơ bản của ký hiệu góc

  // Tính góc của 2 vector BA và BC
  const angle1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const angle2 = Math.atan2(p2.y - center.y, p2.x - center.x);

  // Tính góc chênh lệch (Delta) để xác định vẽ cung nhỏ hay lớn
  // Ta luôn ưu tiên vẽ cung nhỏ (< 180 độ) cho hình học cơ bản
  let startAngle = angle1;
  let endAngle = angle2;
  let diff = endAngle - startAngle;

  // Chuẩn hóa diff về khoảng [-PI, PI]
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  while (diff > Math.PI) diff -= 2 * Math.PI;

  // Nếu diff < 0 nghĩa là đi theo chiều kim đồng hồ mới là đường ngắn
  // SVG arc vẽ theo chiều ngược kim đồng hồ (sweep-flag = 1) hoặc kim đồng hồ (sweep-flag = 0)
  
  let drawStartAngle = startAngle;
  let drawEndAngle = endAngle;
  let sweepFlag = 0; // 0: CW (ngắn nếu diff < 0), 1: CCW (ngắn nếu diff > 0)

  if (diff > 0) {
      sweepFlag = 1; // CCW
  } else {
      sweepFlag = 0; // CW
  }

  // --- TÍNH TOÁN SỐ ĐO & VỊ TRÍ TEXT ---
  // Góc trung bình để đặt text.
  // Lưu ý: midAngle phải nằm trên cung vừa vẽ.
  // diff là góc quay từ start -> end (có thể âm). start + diff/2 là góc ở giữa.
  const midAngle = startAngle + diff / 2;
  const degrees = Math.round(Math.abs(diff) * (180 / Math.PI));
  
  const textRadius = radius + 22; // Đẩy chữ ra xa hơn cung một chút
  const textX = center.x + textRadius * Math.cos(midAngle);
  const textY = center.y + textRadius * Math.sin(midAngle);

  // --- VẼ GÓC VUÔNG ---
  if (angle.isRightAngle) {
      // Vector đơn vị
      const d1 = Math.hypot(p1.x - center.x, p1.y - center.y);
      const d2 = Math.hypot(p2.x - center.x, p2.y - center.y);
      if (d1 === 0 || d2 === 0) return null;
      
      const ux1 = (p1.x - center.x) / d1;
      const uy1 = (p1.y - center.y) / d1;
      const ux2 = (p2.x - center.x) / d2;
      const uy2 = (p2.y - center.y) / d2;
      
      const sqSize = 15;
      // Điểm trên cạnh 1
      const c1x = center.x + ux1 * sqSize;
      const c1y = center.y + uy1 * sqSize;
      // Điểm trên cạnh 2
      const c2x = center.x + ux2 * sqSize;
      const c2y = center.y + uy2 * sqSize;
      // Điểm góc vuông
      const c3x = c1x + c2x - center.x;
      const c3y = c1y + c2y - center.y;

      return (
          <g data-hidden={angle.hidden}>
            <path 
                d={`M ${c1x} ${c1y} L ${c3x} ${c3y} L ${c2x} ${c2y}`}
                fill="none"
                stroke={angle.color || 'black'}
                strokeWidth={angle.strokeWidth || 1.5}
                className={isSelected ? 'selected-ring' : ''}
            />
            {angle.showLabel && (
                <text 
                    x={textX} y={textY} 
                    textAnchor="middle" dominantBaseline="middle"
                    fill={angle.color || 'black'}
                    fontSize={angle.fontSize || 14}
                    fontWeight="bold"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                    stroke="white" strokeWidth="4" paintOrder="stroke"
                >
                    90°
                </text>
            )}
          </g>
      );
  }

  // --- VẼ GÓC THƯỜNG (Cung tròn) ---
  const paths = [];
  const count = angle.arcCount || 1;
  const gap = 4; // Khoảng cách giữa các cung
  
  for (let i = 0; i < count; i++) {
      const r = radius + i * gap;
      
      const sx = center.x + r * Math.cos(drawStartAngle);
      const sy = center.y + r * Math.sin(drawStartAngle);
      const ex = center.x + r * Math.cos(drawEndAngle);
      const ey = center.y + r * Math.sin(drawEndAngle);

      paths.push(
          <path
            key={i}
            d={`M ${sx} ${sy} A ${r} ${r} 0 0 ${sweepFlag} ${ex} ${ey}`}
            fill="none"
            stroke={angle.color || 'black'}
            strokeWidth={angle.strokeWidth || 1.5}
            className={isSelected ? 'selected-ring' : ''}
            data-hidden={angle.hidden}
          />
      );
  }

  // --- VẼ TICK MARK (Gạch chéo) ---
  if (angle.hasTick) {
      // Điểm giữa của cung ngoài cùng
      const rTick = radius + (count - 1) * gap;
      const midX = center.x + rTick * Math.cos(midAngle);
      const midY = center.y + rTick * Math.sin(midAngle);
      
      // Vector hướng tâm
      const tickLen = 5;
      const tickX1 = center.x + (rTick - tickLen) * Math.cos(midAngle);
      const tickY1 = center.y + (rTick - tickLen) * Math.sin(midAngle);
      const tickX2 = center.x + (rTick + tickLen) * Math.cos(midAngle);
      const tickY2 = center.y + (rTick + tickLen) * Math.sin(midAngle);
      
      paths.push(
        <line 
            key="tick"
            x1={tickX1} y1={tickY1} x2={tickX2} y2={tickY2}
            stroke={angle.color || 'black'}
            strokeWidth={angle.strokeWidth || 1.5}
        />
      );
  }

  return (
    <g>
        {/* Fill mờ để dễ chọn */}
        <path
            d={`M ${center.x} ${center.y} L ${center.x + radius*Math.cos(drawStartAngle)} ${center.y + radius*Math.sin(drawStartAngle)} A ${radius} ${radius} 0 0 ${sweepFlag} ${center.x + radius*Math.cos(drawEndAngle)} ${center.y + radius*Math.sin(drawEndAngle)} Z`}
            fill={angle.color || 'black'}
            fillOpacity={isSelected ? 0.2 : 0}
            stroke="none"
            className="cursor-pointer"
        />
        {paths}
        {angle.showLabel && (
            <text 
                x={textX} y={textY} 
                textAnchor="middle" dominantBaseline="middle"
                fill={angle.color || 'black'}
                fontSize={angle.fontSize || 14}
                fontWeight="bold"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
                stroke="white" strokeWidth="4" paintOrder="stroke"
            >
                {degrees}°
            </text>
        )}
    </g>
  );
};
