

import { Point, Polygon, FillStyle, LineStyle } from '../types';
import { generateId } from './geometry';

// Hàm tạo dữ liệu cho Đa giác đều
export const createRegularPolygonData = (
    sides: number,
    sideLengthCm: number,
    gridSize: number,
    viewCenter: { x: number, y: number },
    currentPointSize: number,
    currentStrokeWidth: number,
    currentFillColor: string,
    currentFillStyle: FillStyle,
    currentLineStyle: LineStyle,
    existingPoints: Point[]
) => {
    const sideLengthPx = sideLengthCm * gridSize;
    // Bán kính đường tròn ngoại tiếp R = s / (2 * sin(PI/n))
    const radius = sideLengthPx / (2 * Math.sin(Math.PI / sides));
    
    // Tâm đa giác
    const centerPoint: Point = {
        id: generateId('p_center'),
        x: viewCenter.x,
        y: viewCenter.y,
        label: undefined,
        color: 'black',
        radius: 3, // Nhỏ hơn chút để phân biệt
        labelOffsetX: 10,
        labelOffsetY: 10
    };

    const newPoints: Point[] = [centerPoint];
    const newPointIds: string[] = [];
    
    // Tạo các đỉnh, bắt đầu từ góc -90 độ (phía trên)
    for (let i = 0; i < sides; i++) {
        const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
        const px = viewCenter.x + radius * Math.cos(angle);
        const py = viewCenter.y + radius * Math.sin(angle);
        
        // Tạo label tự động (A, B, C...)
        const labelChar = String.fromCharCode(65 + ((existingPoints.length + i) % 26)); 
        
        const p: Point = {
            id: generateId('p'),
            x: px,
            y: py,
            label: labelChar,
            color: 'black',
            radius: currentPointSize
        };
        newPoints.push(p);
        newPointIds.push(p.id);
    }
    
    const polygon: Polygon = {
        id: generateId('poly'),
        pointIds: newPointIds,
        color: 'black',
        fillColor: currentFillColor,
        fillStyle: currentFillStyle,
        fillOpacity: 0.2,
        strokeWidth: currentStrokeWidth,
        style: currentLineStyle,
        isRegular: true,
        centerId: centerPoint.id
    };

    return { newPoints, polygon };
};

// Hàm tính toán cập nhật vị trí các điểm khi kéo 1 đỉnh của đa giác đều
export const calculateRegularPolygonUpdate = (
    draggedPointId: string,
    newX: number,
    newY: number,
    polygon: Polygon,
    allPoints: Point[]
): { updatedPoints: Map<string, {x: number, y: number}> } => {
    
    const updatedPoints = new Map<string, {x: number, y: number}>();
    
    if (!polygon.isRegular || !polygon.centerId) return { updatedPoints };

    const center = allPoints.find(p => p.id === polygon.centerId);
    if (!center) return { updatedPoints };

    // Kiểm tra xem điểm đang kéo là tâm hay là đỉnh
    if (draggedPointId === polygon.centerId) {
        // Nếu kéo tâm: Di chuyển cả hình (Translation)
        const dx = newX - center.x;
        const dy = newY - center.y;
        
        updatedPoints.set(center.id, { x: newX, y: newY });
        
        polygon.pointIds.forEach(pid => {
            const p = allPoints.find(pt => pt.id === pid);
            if (p) {
                updatedPoints.set(pid, { x: p.x + dx, y: p.y + dy });
            }
        });
    } else {
        // Nếu kéo đỉnh: Co giãn và Xoay quanh tâm (Scaling & Rotation)
        const vertexIndex = polygon.pointIds.indexOf(draggedPointId);
        if (vertexIndex === -1) return { updatedPoints }; // Không thuộc đa giác này

        // 1. Tính bán kính mới và góc mới của điểm đang kéo so với tâm
        const newRadius = Math.hypot(newX - center.x, newY - center.y);
        const currentAngle = Math.atan2(newY - center.y, newX - center.x);

        // 2. Tính lại vị trí các đỉnh khác
        const n = polygon.pointIds.length;
        
        updatedPoints.set(draggedPointId, { x: newX, y: newY });

        polygon.pointIds.forEach((pid, idx) => {
            if (pid === draggedPointId) return; 

            // Khoảng cách index
            const k = idx - vertexIndex;
            const angleOffset = k * (2 * Math.PI / n);
            const targetAngle = currentAngle + angleOffset;

            const px = center.x + newRadius * Math.cos(targetAngle);
            const py = center.y + newRadius * Math.sin(targetAngle);
            
            updatedPoints.set(pid, { x: px, y: py });
        });
    }

    return { updatedPoints };
};