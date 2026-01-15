
import React, { useMemo } from 'react';
import { GeometryData } from '../types';

interface CanvasDefinitionsProps {
  data: GeometryData;
  showHidden: boolean;
}

export const CanvasDefinitions: React.FC<CanvasDefinitionsProps> = ({ data, showHidden }) => {
  // Collect unique colors for pattern generation
  const uniqueFillColors = useMemo(() => Array.from(new Set([
    'black', '#000000', '#4f46e5',
    ...(data.polygons || []).map(p => p.fillColor || 'none'),
    ...(data.circles || []).map(c => c.fillColor || 'none'),
    ...(data.arcs || []).map(a => a.fillColor || 'none'),
    ...(data.ellipses || []).map(e => e.fillColor || 'none'),
    ...(data.ellipticalArcs || []).map(e => e.fillColor || 'none'),
    ...(data.integrals || []).map(i => i.fillColor || 'none')
  ])).filter(c => c !== 'none'), [data]);

  const PATTERNS = [
      { id: 'hatch', path: (c: string) => <line x1="0" y1="0" x2="0" y2="8" stroke={c} strokeWidth="1" opacity="0.5" />, props: { width: 8, height: 8, patternTransform: "rotate(45)" } },
      { id: 'hatch-vertical', path: (c: string) => <line x1="0" y1="0" x2="0" y2="8" stroke={c} strokeWidth="1" opacity="0.5" />, props: { width: 8, height: 8 } },
      { id: 'hatch-horizontal', path: (c: string) => <line x1="0" y1="0" x2="8" y2="0" stroke={c} strokeWidth="1" opacity="0.5" />, props: { width: 8, height: 8 } },
      { id: 'crosshatch', path: (c: string) => <><line x1="0" y1="0" x2="0" y2="8" stroke={c} strokeWidth="1" opacity="0.5" /><line x1="0" y1="0" x2="8" y2="0" stroke={c} strokeWidth="1" opacity="0.5" /></>, props: { width: 8, height: 8, patternTransform: "rotate(45)" } },
      { id: 'dots', path: (c: string) => <circle cx="2" cy="2" r="1" fill={c} opacity="0.5" />, props: { width: 8, height: 8 } },
      { id: 'dots-dense', path: (c: string) => <circle cx="1" cy="1" r="1" fill={c} opacity="0.5" />, props: { width: 4, height: 4 } },
      { id: 'grid', path: (c: string) => <path d="M0 0 L8 0 M0 0 L0 8" stroke={c} strokeWidth="1" opacity="0.5" />, props: { width: 8, height: 8 } },
      { id: 'zigzag', path: (c: string) => <path d="M0 4 L4 0 L8 4" stroke={c} strokeWidth="1" fill="none" opacity="0.5" />, props: { width: 8, height: 8 } },
      { id: 'bricks', path: (c: string) => <path d="M0 0 L8 0 M0 4 L8 4 M4 0 L4 4 M0 4 L0 8 M8 4 L8 8" stroke={c} strokeWidth="1" opacity="0.5" />, props: { width: 8, height: 8 } },
      { id: 'waves', path: (c: string) => <path d="M0 4 Q 2 0, 4 4 T 8 4" stroke={c} strokeWidth="1" fill="none" opacity="0.5" />, props: { width: 8, height: 8 } },
  ];

  return (
    <>
      <style>{`
          .cursor-fill {
              cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%234f46e5' stroke='white' stroke-width='2'%3E%3Cpath d='M19 11L11 3 2.4 11.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11z'/%3E%3Cpath d='M5 2l5 5'/%3E%3Cpath d='M2 13l5 5'/%3E%3Cpath d='M22 22l-5-10-5 10'/%3E%3C/svg%3E") 2 22, auto;
          }
          .math-container { display: inline-flex; align-items: center; justify-content: center; cursor: move; user-select: none; white-space: nowrap; }
          .math-container .katex { font-size: 1em; }
          [data-hidden="true"] { opacity: ${showHidden ? '0.5' : '0'}; pointer-events: ${showHidden ? 'auto' : 'none'}; visibility: ${showHidden ? 'visible' : 'hidden'}; cursor: pointer; }
          [data-hidden="true"] line, [data-hidden="true"] circle, [data-hidden="true"] ellipse, [data-hidden="true"] rect { stroke-dasharray: ${showHidden ? '4,4' : 'none'} !important; }
          .selected-ring { filter: drop-shadow(0 0 6px #4f46e5); }
          .selected-point { stroke: #4f46e5 !important; stroke-width: 3px !important; }
          .selected-text { outline: 2px dashed #4f46e5; background: rgba(79, 70, 229, 0.05); }
          .construction-highlight { stroke: #f97316 !important; stroke-width: 3px !important; opacity: 0.8; }
          .highlighted-point { fill: #f97316 !important; stroke: white !important; stroke-width: 2px !important; r: 6px !important; transition: all 0.1s; }
      `}</style>
      
      <defs>
          {uniqueFillColors.map(color => {
              const safeColor = color.replace(/[^a-z0-9]/gi, '');
              return PATTERNS.map(p => (
                  <pattern key={`pattern-${p.id}-${safeColor}`} id={`pattern-${p.id}-${safeColor}`} patternUnits="userSpaceOnUse" {...p.props}>
                      {p.path(color)}
                  </pattern>
              ));
          })}
          
          {[1, 2, 3].map(size => {
              const scale = size === 1 ? 0.8 : size === 2 ? 1.2 : 1.6;
              const width = 10 * scale; const height = 10 * scale; const refX = 10 * scale; const refY = 5 * scale;
              return (
                  <React.Fragment key={size}>
                      <marker id={`arrow-start-${size}`} viewBox={`0 0 ${width} ${height}`} refX={refX} refY={refY} markerWidth={width} markerHeight={height} orient="auto">
                          <path d={`M ${width} 0 L 0 ${height/2} L ${width} ${height} z`} fill="context-stroke" />
                      </marker>
                      <marker id={`arrow-end-${size}`} viewBox={`0 0 ${width} ${height}`} refX={refX} refY={refY} markerWidth={width} markerHeight={height} orient="auto">
                          <path d={`M 0 0 L ${width} ${height/2} L 0 ${height} z`} fill="context-stroke" />
                      </marker>
                  </React.Fragment>
              );
          })}
      </defs>
    </>
  );
};
