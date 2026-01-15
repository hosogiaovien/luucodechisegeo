
import React from 'react';

interface GridLayerProps {
  pan: { x: number; y: number };
  zoom: number;
  width: number;
  height: number;
  gridSize: number; // Kích thước ô lưới gốc (mặc định 50 = 1cm)
  visible: boolean;
  showAxes: boolean;
}

const GridLayer: React.FC<GridLayerProps> = ({ pan, zoom, width, height, gridSize, visible, showAxes }) => {
  if (!visible && !showAxes) return null;

  // Tính toán vùng bao phủ trong hệ tọa độ World
  const buffer = gridSize * 2;
  const worldLeft = -pan.x / zoom;
  const worldTop = -pan.y / zoom;
  const worldRight = (width - pan.x) / zoom;
  const worldBottom = (height - pan.y) / zoom;

  const startX = Math.floor((worldLeft - buffer) / gridSize) * gridSize;
  const endX = Math.floor((worldRight + buffer) / gridSize) * gridSize;
  const startY = Math.floor((worldTop - buffer) / gridSize) * gridSize;
  const endY = Math.floor((worldBottom + buffer) / gridSize) * gridSize;

  const gridPaths = [];
  
  // Chỉ vẽ lưới nếu visible = true
  if (visible) {
      for (let x = startX; x <= endX; x += gridSize) {
        if (Math.abs(x) > 1e-6 || !showAxes) { // Nếu showAxes=true, không vẽ đường trùng trục (để vẽ trục đậm hơn)
            gridPaths.push(`M ${x} ${startY} L ${x} ${endY}`);
        }
      }
      for (let y = startY; y <= endY; y += gridSize) {
        if (Math.abs(y) > 1e-6 || !showAxes) {
            gridPaths.push(`M ${startX} ${y} L ${endX} ${y}`);
        }
      }
  }

  // Vẽ trục tọa độ nếu showAxes = true
  const axesElements = [];
  const labels = [];
  
  // Ngưỡng zoom để hiển thị số (tránh rối mắt khi zoom out quá xa)
  const showLabels = zoom > 0.4;

  if (showAxes) {
      // Padding để thụt đầu dòng vào trong, giúp dễ chụp hình mũi tên
      // Thụt vào khoảng 0.8 ô lưới
      const inset = gridSize * 0.8;

      // TRỤC HOÀNH (X-AXIS) - Đi qua y=0
      if (0 >= startY && 0 <= endY) {
          // Giới hạn đường trục nằm trong khung nhìn có thụt lề
          const axisStart = Math.max(worldLeft + inset, startX);
          const axisEnd = Math.min(worldRight - inset, endX);

          // Đường trục
          axesElements.push(
              <line key="axis-x" x1={axisStart} y1={0} x2={axisEnd} y2={0} stroke="#334155" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          );
          // Mũi tên trục X
          const arrowSize = 6 / zoom;
          axesElements.push(
              <path key="arrow-x" d={`M ${axisEnd} 0 L ${axisEnd - arrowSize} ${-arrowSize/2} L ${axisEnd - arrowSize} ${arrowSize/2} Z`} fill="#334155" />
          );
          // Label tên trục X
          labels.push(
              <text key="label-x-name" x={axisEnd - arrowSize * 3} y={-arrowSize} fontSize={12/zoom} fill="#334155" fontWeight="bold">x</text>
          );

          // Các vạch số trên trục X
          for (let x = startX; x <= endX; x += gridSize) {
              if (Math.abs(x) < 1e-6) continue; // Bỏ qua gốc O
              axesElements.push(
                  <line key={`tick-x-${x}`} x1={x} y1={-3/zoom} x2={x} y2={3/zoom} stroke="#334155" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              );
              if (showLabels) {
                  const val = Math.round(x / gridSize);
                  labels.push(
                      <text key={`num-x-${x}`} x={x} y={15/zoom} fontSize={10/zoom} fill="#64748b" textAnchor="middle">{val}</text>
                  );
              }
          }
      }

      // TRỤC TUNG (Y-AXIS) - Đi qua x=0
      if (0 >= startX && 0 <= endX) {
          // Giới hạn đường trục nằm trong khung nhìn có thụt lề
          const axisStart = Math.max(worldTop + inset, startY);
          const axisEnd = Math.min(worldBottom - inset, endY);

          // Đường trục
          axesElements.push(
              <line key="axis-y" x1={0} y1={axisStart} x2={0} y2={axisEnd} stroke="#334155" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          );
          // Mũi tên trục Y (Lưu ý: SVG y hướng xuống là dương, nên "lên" là y âm -> axisStart là phía trên)
          const arrowSize = 6 / zoom;
          // Vẽ mũi tên ở phía trên cùng (giá trị y nhỏ nhất)
          axesElements.push(
              <path key="arrow-y" d={`M 0 ${axisStart} L ${-arrowSize/2} ${axisStart + arrowSize} L ${arrowSize/2} ${axisStart + arrowSize} Z`} fill="#334155" />
          );
           // Label tên trục Y
           labels.push(
            <text key="label-y-name" x={arrowSize} y={axisStart + arrowSize * 3} fontSize={12/zoom} fill="#334155" fontWeight="bold">y</text>
            );

          // Các vạch số trên trục Y
          for (let y = startY; y <= endY; y += gridSize) {
              if (Math.abs(y) < 1e-6) continue; // Bỏ qua gốc O
              axesElements.push(
                  <line key={`tick-y-${y}`} x1={-3/zoom} y1={y} x2={3/zoom} y2={y} stroke="#334155" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              );
              if (showLabels) {
                  // Lưu ý: trong hệ trục toán học, y lên trên là dương. Trong SVG, y lên trên là âm.
                  // Vì vậy giá trị hiển thị = -(y / gridSize)
                  const val = Math.round(-y / gridSize);
                  labels.push(
                      <text key={`num-y-${y}`} x={-8/zoom} y={y + 3/zoom} fontSize={10/zoom} fill="#64748b" textAnchor="end">{val}</text>
                  );
              }
          }
      }

      // Gốc tọa độ O
      if (0 >= startX && 0 <= endX && 0 >= startY && 0 <= endY) {
          labels.push(
              <text key="origin-O" x={-10/zoom} y={12/zoom} fontSize={11/zoom} fill="#334155" fontStyle="italic" fontWeight="bold">O</text>
          );
      }
  }

  return (
    <g className="grid-layer pointer-events-none">
      {/* Lưới thường */}
      <path 
        d={gridPaths.join(' ')} 
        stroke="#e2e8f0" 
        strokeWidth={1} 
        vectorEffect="non-scaling-stroke" 
        fill="none" 
      />
      {/* Trục tọa độ và số */}
      {axesElements}
      {labels}
    </g>
  );
};

export default GridLayer;
