
import React from 'react';
import { Segment, Point } from '../../types';
import { getDashArray } from '../../utils/geometry';

interface SegmentShapeProps {
  segment: Segment;
  points: Point[];
  isSelected: boolean;
  isHighlighted?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const SegmentShape: React.FC<SegmentShapeProps> = ({ segment, points, isSelected, isHighlighted, onMouseDown }) => {
  const p1 = points.find(p => p.id === segment.startPointId);
  const p2 = points.find(p => p.id === segment.endPointId);
  if (!p1 || !p2) return null;
  
  const dashArray = getDashArray(segment.style);

  const size = segment.arrowSize || 1; // Default Small
  
  let markerStart = undefined;
  let markerEnd = undefined;

  if (segment.arrows === 'start' || segment.arrows === 'both') markerStart = `url(#arrow-start-${size})`;
  if (segment.arrows === 'end' || segment.arrows === 'both') markerEnd = `url(#arrow-end-${size})`;

  // --- Marker Drawing Logic ---
  const renderMarker = () => {
      if (!segment.marker || segment.marker === 'none') return null;

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
      
      const strokeWidth = segment.strokeWidth || 1.5;
      const color = segment.color || 'black';
      
      const tickHeight = 6 + strokeWidth; 
      const tickGap = 3 + strokeWidth;

      let paths = [];

      if (segment.marker === 'tick1') {
          paths.push(<line key="t1" x1={0} y1={-tickHeight} x2={0} y2={tickHeight} stroke={color} strokeWidth={strokeWidth} />);
      } 
      else if (segment.marker === 'tick2') {
          paths.push(<line key="t2a" x1={-tickGap/2} y1={-tickHeight} x2={-tickGap/2} y2={tickHeight} stroke={color} strokeWidth={strokeWidth} />);
          paths.push(<line key="t2b" x1={tickGap/2} y1={-tickHeight} x2={tickGap/2} y2={tickHeight} stroke={color} strokeWidth={strokeWidth} />);
      }
      else if (segment.marker === 'tick3') {
          paths.push(<line key="t3a" x1={-tickGap} y1={-tickHeight} x2={-tickGap} y2={tickHeight} stroke={color} strokeWidth={strokeWidth} />);
          paths.push(<line key="t3b" x1={0} y1={-tickHeight} x2={0} y2={tickHeight} stroke={color} strokeWidth={strokeWidth} />);
          paths.push(<line key="t3c" x1={tickGap} y1={-tickHeight} x2={tickGap} y2={tickHeight} stroke={color} strokeWidth={strokeWidth} />);
      }
      else if (segment.marker === 'cross') {
          const size = 5 + strokeWidth;
          paths.push(<line key="c1" x1={-size} y1={-size} x2={size} y2={size} stroke={color} strokeWidth={strokeWidth} />);
          paths.push(<line key="c2" x1={size} y1={-size} x2={-size} y2={size} stroke={color} strokeWidth={strokeWidth} />);
      }
      else if (segment.marker === 'tickCross') {
          const size = 5 + strokeWidth;
          // Tick
          paths.push(<line key="tc1" x1={-tickGap} y1={-tickHeight} x2={-tickGap} y2={tickHeight} stroke={color} strokeWidth={strokeWidth} />);
          // Cross
          paths.push(<line key="tc2" x1={tickGap/2 - size} y1={-size} x2={tickGap/2 + size} y2={size} stroke={color} strokeWidth={strokeWidth} />);
          paths.push(<line key="tc3" x1={tickGap/2 + size} y1={-size} x2={tickGap/2 - size} y2={size} stroke={color} strokeWidth={strokeWidth} />);
      }

      // Rotate group to align with segment, but for ticks we often want a slight slant relative to the perpendicular.
      // Standard geometry notation: Ticks are perpendicular to the line.
      // Let's stick to simple rotation aligning with line normal?
      // Wait, standard ticks (/) are usually slanted relative to the normal.
      // Let's implement a standard "slanted tick" rotation.
      // If we rotate by `angle`, the local coordinate system aligns with the segment (X axis along segment).
      // A vertical line (x=0) in local space is perpendicular to the segment.
      // If we want slanted ticks (/), we can just draw them slanted in the SVG or rotate the group differently.
      // Let's keep the lines vertical in local space (perpendicular to segment) for now, as that's "hash mark" style (||). 
      // If the user specifically wants slant (/), I'll rotate the group slightly relative to perpendicular.
      
      // Let's assume standard "hash" marks for equal segments.
      
      return (
          <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
              {/* If marker is tick-based, maybe slant it slightly? standard | | is fine, but / / is also common. Let's do straight perpendicular for clarity.*/}
              {paths}
          </g>
      );
  };

  return (
    <g data-hidden={segment.hidden}>
        <line 
          x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} 
          stroke={segment.color || 'black'} 
          strokeWidth={segment.strokeWidth || 1.5} 
          strokeDasharray={dashArray} 
          strokeLinecap={segment.style === 'dotted' ? 'round' : 'butt'}
          markerStart={markerStart}
          markerEnd={markerEnd}
          className={`${isSelected ? 'selected-ring' : ''} ${isHighlighted ? 'construction-highlight' : ''}`} 
          onMouseDown={onMouseDown}
          style={{ cursor: onMouseDown ? 'move' : 'default' }}
        />
        {renderMarker()}
    </g>
  );
};
