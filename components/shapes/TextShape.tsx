
import React from 'react';
import { TextElement, ToolType } from '../../types';
import { renderLatex } from '../../utils/geometry';

interface TextShapeProps {
  text: TextElement;
  isSelected: boolean;
  activeTool: ToolType;
  handleDoubleClick: (e: React.MouseEvent, t: TextElement) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export const TextShape: React.FC<TextShapeProps> = ({ text, isSelected, activeTool, handleDoubleClick, onMouseDown }) => {
  return (
    <foreignObject 
        x={text.x} y={text.y} width="1" height="1" 
        className="pointer-events-none overflow-visible"
    >
       <div 
         className={`math-container pointer-events-auto transition-all ${isSelected ? 'selected-text' : ''}`}
         style={{ 
             fontSize: `${text.fontSize}px`, 
             color: text.color || 'black', 
             transform: 'translate(0, -50%)',
             minWidth: '20px', // Đảm bảo luôn có vùng để click dù text ngắn
             minHeight: '20px',
             display: 'inline-block'
         }}
         onMouseDown={(e) => {
             // Ngăn sự kiện nổi bọt lên Canvas để tránh tạo điểm mới
             e.stopPropagation();
             onMouseDown(e);
         }}
         onDoubleClick={(e) => {
             e.stopPropagation();
             e.preventDefault(); // Ngăn hành vi mặc định (như bôi đen text)
             handleDoubleClick(e, text);
         }}
         dangerouslySetInnerHTML={{ __html: renderLatex(text.text) }} 
         title="Nhấp đúp để sửa"
       />
    </foreignObject>
  );
};
