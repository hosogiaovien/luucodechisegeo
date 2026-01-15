
import React, { useMemo } from 'react';
import { FunctionGraph, Variable } from '../../types';
import { evaluateMathExpression, renderLatex } from '../../utils/geometry';

interface FunctionGraphShapeProps {
  graph: FunctionGraph;
  pan: { x: number; y: number };
  zoom: number;
  viewSize: { width: number; height: number };
  gridSize: number;
  isSelected: boolean;
  isHighlighted?: boolean;
  setDraggedFunctionLabelId: (id: string) => void;
  onLabelMouseDown?: (e: React.MouseEvent) => void; // New Prop for selection
  variables?: Variable[];
}

const formatToLatex = (formula: string) => {
    try {
        let tex = formula;
        tex = tex.replace(/\s/g, '');
        tex = tex.replace(/\*/g, ''); 
        tex = tex.replace(/sqrt\((.+?)\)/g, '\\sqrt{$1}');
        tex = tex.replace(/\((.+?)\)\/\((.+?)\)/g, '\\frac{$1}{$2}');
        tex = tex.replace(/\((.+?)\)\/([a-zA-Z0-9\.]+)/g, '\\frac{$1}{$2}');
        tex = tex.replace(/([a-zA-Z0-9\.]+)\/\((.+?)\)/g, '\\frac{$1}{$2}');
        tex = tex.replace(/([a-zA-Z0-9\.]+)\/([a-zA-Z0-9\.]+)/g, '\\frac{$1}{$2}');
        tex = tex.replace(/\b(sin|cos|tan|cot|ln|log)\b/g, '\\$1');
        tex = tex.replace(/\bpi\b/g, '\\pi');
        tex = tex.replace(/\be\b/g, 'e'); 
        tex = tex.replace(/abs\((.+?)\)/g, '|$1|');
        return `y = \\displaystyle ${tex}`;
    } catch (e) {
        return `y = ${formula}`;
    }
};

export const FunctionGraphShape: React.FC<FunctionGraphShapeProps> = ({ 
    graph, pan, zoom, viewSize, gridSize, isSelected, isHighlighted, setDraggedFunctionLabelId, onLabelMouseDown, variables = []
}) => {
  
  // Convert variables array to Record<string, number> for faster lookup
  // Normalize variable keys to lowercase
  const variableMap = useMemo(() => {
      const map: Record<string, number> = {};
      variables.forEach(v => {
          if (v.name) map[v.name.toLowerCase()] = v.value;
      });
      return map;
  }, [variables]);

  const pathData = useMemo(() => {
      const startScreenX = 0;
      const endScreenX = viewSize.width;
      const pixelStep = 2; 
      
      let d = "";
      let isFirst = true;
      let lastY = NaN;

      for (let sx = startScreenX; sx <= endScreenX; sx += pixelStep) {
          const worldX = (sx - pan.x) / zoom;
          const mathX = worldX / gridSize;
          
          const mathY = evaluateMathExpression(graph.formula, mathX, variableMap);
          
          if (isNaN(mathY) || !isFinite(mathY)) {
              isFirst = true; 
              continue;
          }

          const worldY = -mathY * gridSize;
          
          // Asymptote Check
          if (!isNaN(lastY) && Math.abs(worldY - lastY) > (viewSize.height / zoom) * 2) {
               isFirst = true; 
          }

          if (isFirst) {
              d += `M ${worldX.toFixed(2)} ${worldY.toFixed(2)}`;
              isFirst = false;
          } else {
              d += ` L ${worldX.toFixed(2)} ${worldY.toFixed(2)}`;
          }
          lastY = worldY;
      }
      
      return d;
  }, [graph.formula, pan, zoom, viewSize, gridSize, variableMap]);

  let dashArray = '0';
  if (graph.style === 'dashed') dashArray = '10,8';
  else if (graph.style === 'dotted') dashArray = '2,5';

  // Default position handling for label if graph is empty/offscreen
  const labelX = graph.labelX !== undefined ? graph.labelX : (-pan.x / zoom + viewSize.width / (2 * zoom));
  const labelY = graph.labelY !== undefined ? graph.labelY : (-pan.y / zoom + viewSize.height / (2 * zoom));

  const latexLabel = useMemo(() => formatToLatex(graph.formula), [graph.formula]);

  return (
    <g data-hidden={graph.hidden}>
        <path 
            d={pathData} 
            stroke="transparent" 
            strokeWidth={(graph.strokeWidth || 2) + 10}
            fill="none" 
            className="cursor-pointer"
        />
        <path 
            d={pathData} 
            stroke={graph.color || '#1565C0'} 
            strokeWidth={graph.strokeWidth || 2}
            strokeDasharray={dashArray}
            fill="none"
            vectorEffect="non-scaling-stroke" 
            className={`${isSelected ? 'selected-ring' : ''} ${isHighlighted ? 'construction-highlight' : ''}`}
            style={{ pointerEvents: 'none' }} 
        />
        <foreignObject 
            x={labelX} 
            y={labelY} 
            width="1" height="1"
            className="pointer-events-none overflow-visible"
        >
            <div 
                className="math-container pointer-events-auto transition-transform hover:scale-110 active:scale-95"
                style={{ 
                    color: graph.color || '#1565C0',
                    transform: 'translate(-50%, -50%)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(4px)',
                    border: isSelected ? `1px solid ${graph.color || '#1565C0'}` : '1px solid rgba(0,0,0,0.05)',
                    boxShadow: isSelected ? '0 4px 6px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                    cursor: 'move',
                    minWidth: 'max-content',
                    fontSize: '14px'
                }}
                onMouseDown={(e) => {
                    // Call the selection handler if provided
                    if (onLabelMouseDown) onLabelMouseDown(e);
                    // Also start dragging
                    setDraggedFunctionLabelId(graph.id);
                }}
                dangerouslySetInnerHTML={{ __html: renderLatex(latexLabel) }}
                title="Nhấp để chọn/di chuyển"
            />
        </foreignObject>
    </g>
  );
};
