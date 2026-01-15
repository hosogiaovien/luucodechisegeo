
import React from 'react';
import { ImageElement, ToolType } from '../../types';

interface ImageShapeProps {
  image: ImageElement;
  isSelected: boolean;
  activeTool: ToolType;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeHandleMouseDown?: (e: React.MouseEvent, handle: string) => void;
  zoom: number;
}

export const ImageShape: React.FC<ImageShapeProps> = ({ image, isSelected, activeTool, onMouseDown, onResizeHandleMouseDown, zoom }) => {
  // Handle size in pixels (constant screen size) -> convert to world size
  const handleSize = 8 / zoom; 
  const strokeWidth = 1.5 / zoom;

  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
      e.stopPropagation();
      e.preventDefault(); // Prevent default browser drag
      if (onResizeHandleMouseDown) onResizeHandleMouseDown(e, handle);
  };

  // Rotation center
  const cx = image.x + image.width / 2;
  const cy = image.y + image.height / 2;
  const rotation = image.rotation || 0;

  return (
    <g 
        data-hidden={image.hidden}
        transform={`rotate(${rotation}, ${cx}, ${cy})`}
    >
        <image
            href={image.src}
            x={image.x}
            y={image.y}
            width={image.width}
            height={image.height}
            className={`pointer-events-auto ${isSelected ? 'selected-ring' : ''}`}
            style={{ 
                opacity: image.opacity !== undefined ? image.opacity : 1,
                outline: isSelected ? `2px dashed #4f46e5` : 'none',
                cursor: activeTool === ToolType.SELECT ? 'move' : 'default'
            }}
            onMouseDown={(e) => {
                e.stopPropagation();
                onMouseDown(e);
            }}
        />
        {isSelected && (
            <g>
                <rect 
                    x={image.x} y={image.y} 
                    width={image.width} height={image.height} 
                    fill="none" stroke="#4f46e5" strokeWidth={strokeWidth} strokeDasharray="5,3" 
                    pointerEvents="none"
                />
                
                {/* Resize Handles - rendered in local coordinate space (so they rotate with the group) */}
                {/* Top-Left */}
                <rect 
                    x={image.x - handleSize/2} y={image.y - handleSize/2} width={handleSize} height={handleSize}
                    fill="white" stroke="#4f46e5" strokeWidth={strokeWidth}
                    style={{ cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleMouseDown(e, 'nw')}
                />
                {/* Top-Right */}
                <rect 
                    x={image.x + image.width - handleSize/2} y={image.y - handleSize/2} width={handleSize} height={handleSize}
                    fill="white" stroke="#4f46e5" strokeWidth={strokeWidth}
                    style={{ cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleMouseDown(e, 'ne')}
                />
                {/* Bottom-Left */}
                <rect 
                    x={image.x - handleSize/2} y={image.y + image.height - handleSize/2} width={handleSize} height={handleSize}
                    fill="white" stroke="#4f46e5" strokeWidth={strokeWidth}
                    style={{ cursor: 'nesw-resize' }}
                    onMouseDown={(e) => handleMouseDown(e, 'sw')}
                />
                {/* Bottom-Right */}
                <rect 
                    x={image.x + image.width - handleSize/2} y={image.y + image.height - handleSize/2} width={handleSize} height={handleSize}
                    fill="white" stroke="#4f46e5" strokeWidth={strokeWidth}
                    style={{ cursor: 'nwse-resize' }}
                    onMouseDown={(e) => handleMouseDown(e, 'se')}
                />
            </g>
        )}
    </g>
  );
};
