
import React, { useMemo } from 'react';
import { Integral, FunctionGraph, Variable } from '../../types';
import { evaluateMathExpression } from '../../utils/geometry';

interface IntegralShapeProps {
  integral: Integral;
  graph1: FunctionGraph;
  graph2: FunctionGraph;
  pan: { x: number; y: number };
  zoom: number;
  viewSize: { width: number; height: number };
  gridSize: number;
  isSelected: boolean;
  variables?: Variable[];
}

export const IntegralShape: React.FC<IntegralShapeProps> = ({ 
    integral, graph1, graph2, pan, zoom, viewSize, gridSize, isSelected, variables = []
}) => {
  
  // Create variable map for math eval (NORMALIZED TO LOWERCASE)
  const variableMap = useMemo(() => {
      const map: Record<string, number> = {};
      variables.forEach(v => {
          if (v.name) map[v.name.toLowerCase()] = v.value;
      });
      return map;
  }, [variables]);

  // Calculate the path data for the area between curves
  const pathData = useMemo(() => {
      if (!graph1 || !graph2) return "";

      const buffer = 100;
      const startScreenX = -buffer;
      const endScreenX = viewSize.width + buffer;
      const pixelStep = 2; 

      let strips: {x: number, y1: number, y2: number}[][] = [];
      let currentStrip: {x: number, y1: number, y2: number}[] = [];
      
      let prevPt: any = null;
      let foundFirstCrossing = false; 

      const getY = (sx: number) => {
          const worldX = (sx - pan.x) / zoom;
          const mathX = worldX / gridSize;
          const mathY1 = evaluateMathExpression(graph1.formula, mathX, variableMap);
          const mathY2 = evaluateMathExpression(graph2.formula, mathX, variableMap);
          
          if (isNaN(mathY1) || isNaN(mathY2) || !isFinite(mathY1) || !isFinite(mathY2)) return null;
          
          return {
              x: worldX,
              y1: -mathY1 * gridSize, 
              y2: -mathY2 * gridSize,
              diff: (-mathY1 * gridSize) - (-mathY2 * gridSize)
          };
      };

      prevPt = getY(startScreenX);

      for (let sx = startScreenX + pixelStep; sx <= endScreenX; sx += pixelStep) {
          const currPt = getY(sx);

          if (!prevPt || !currPt) {
              currentStrip = [];
              prevPt = currPt;
              continue;
          }

          const sign1 = Math.sign(prevPt.diff);
          const sign2 = Math.sign(currPt.diff);

          if (sign1 !== 0 && sign2 !== 0 && sign1 !== sign2) {
              const t = -prevPt.diff / (currPt.diff - prevPt.diff);
              const intersectX = prevPt.x + t * (currPt.x - prevPt.x);
              const intersectY1 = prevPt.y1 + t * (currPt.y1 - prevPt.y1);
              const pIntersect = { x: intersectX, y1: intersectY1, y2: intersectY1 };

              if (foundFirstCrossing) {
                  currentStrip.push(pIntersect);
                  strips.push(currentStrip);
              }

              foundFirstCrossing = true;
              currentStrip = [pIntersect]; 
          } 
          
          if (foundFirstCrossing) {
              currentStrip.push({ x: currPt.x, y1: currPt.y1, y2: currPt.y2 });
          }

          prevPt = currPt;
      }
      
      let d = "";
      
      for (const strip of strips) {
          if (strip.length < 2) continue;
          d += `M ${strip[0].x.toFixed(2)} ${strip[0].y1.toFixed(2)} `;
          for (let i = 1; i < strip.length; i++) {
              d += `L ${strip[i].x.toFixed(2)} ${strip[i].y1.toFixed(2)} `;
          }
          for (let i = strip.length - 1; i >= 0; i--) {
              d += `L ${strip[i].x.toFixed(2)} ${strip[i].y2.toFixed(2)} `;
          }
          d += "Z ";
      }
      
      return d;

  }, [graph1.formula, graph2.formula, pan, zoom, viewSize, gridSize, variableMap]);

  let fill = 'none';
  let opacity = integral.fillOpacity !== undefined ? integral.fillOpacity : 0.4;
  
  const fillColor = integral.fillColor || '#4f46e5';
  const safeColor = fillColor.replace(/[^a-z0-9]/gi, '');

  if (integral.fillStyle === 'none') {
      fill = 'none';
  } else if (integral.fillStyle === 'solid' || !integral.fillStyle) {
      fill = fillColor;
  } else {
      fill = `url(#pattern-${integral.fillStyle}-${safeColor})`;
  }

  return (
    <path
      d={pathData}
      fill={fill}
      fillOpacity={opacity}
      stroke="none"
      className={isSelected ? 'selected-ring' : ''}
      data-hidden={integral.hidden}
      style={{ pointerEvents: 'stroke' }} 
    />
  );
};
