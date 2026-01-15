
export enum ToolType {
  SELECT = 'SELECT',
  POINT = 'POINT',
  POINT_COORD = 'POINT_COORD', 
  SEGMENT = 'SEGMENT',
  SEGMENT_FIXED = 'SEGMENT_FIXED', 
  LINE = 'LINE',
  RAY = 'RAY',
  POLYGON = 'POLYGON',
  POLYGON_REGULAR = 'POLYGON_REGULAR', // New Tool
  CIRCLE = 'CIRCLE',
  CIRCLE_FIXED = 'CIRCLE_FIXED',
  ELLIPSE = 'ELLIPSE',
  ELLIPTICAL_ARC = 'ELLIPTICAL_ARC', 
  ANGLE = 'ANGLE',
  ANGLE_FIXED = 'ANGLE_FIXED', 
  FUNCTION_GRAPH = 'FUNCTION_GRAPH', 
  IMAGE = 'IMAGE', 
  SELECT_AREA = 'SELECT_AREA',
  TEXT = 'TEXT',
  MIDPOINT = 'MIDPOINT',
  PERPENDICULAR = 'PERPENDICULAR',
  PARALLEL = 'PARALLEL',
  INTERSECT = 'INTERSECT',
  SYMMETRY_CENTRAL = 'SYMMETRY_CENTRAL', // Đối xứng tâm
  SYMMETRY_AXIAL = 'SYMMETRY_AXIAL',     // Đối xứng trục
  ROTATE = 'ROTATE',                     // New Tool: Phép quay
  ARC = 'ARC',
  CYLINDER = 'CYLINDER',
  CONE = 'CONE',
  SPHERE = 'SPHERE',
  FILL = 'FILL'
}

export type AppMode = 'GEOMETRY' | 'CHART' | 'SOLIDS'; // Added SOLIDS

export type ChartType = 'column' | 'line' | 'pie'; // Simplified types

export type SolidType = 'cube' | 'rectangular_prism' | 'prism_tri' | 'square_pyramid' | 'tetrahedron' | 'cylinder' | 'cone';

export type PatternType = 'none' | 'solid' | 'hatch' | 'hatch-cross' | 'dots' | 'grid' | 'lines-vertical' | 'lines-horizontal' | 'lines-diagonal-right' | 'lines-diagonal-left';

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  pattern: PatternType;
}

export interface ChartDataPoint {
  id: string;
  label: string;
  values: number[]; // Array mapping to series indices
  // For Pie chart or Single Column customization:
  color?: string; 
  pattern?: PatternType;
}

export interface ChartConfig {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  type: ChartType;
  series: ChartSeries[];
  data: ChartDataPoint[];
  showValues: boolean;
  showLegend: boolean;
  barWidth: number; // 0.1 to 1
  startFromZero: boolean;
  gridLines: boolean;
}

export type ElementColor = string; 
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'longdash';
export type FillStyle = 'none' | 'solid' | 'hatch' | 'hatch-vertical' | 'hatch-horizontal' | 'crosshatch' | 'dots' | 'dots-dense' | 'grid' | 'zigzag' | 'bricks' | 'waves';
export type SegmentMarker = 'none' | 'tick1' | 'tick2' | 'tick3' | 'cross' | 'tickCross';

export interface Variable {
  id: string;
  name: string; // e.g. "m", "a", "k"
  value: number;
  min: number;
  max: number;
  step: number;
  isPlaying?: boolean; // For animation
  animationDirection?: 'forward' | 'backward'; // Direction of animation
  speed?: number;
}

export interface Point {
  id: string;
  x: number;
  y: number;
  label?: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
  color?: ElementColor;
  radius?: number; 
  hidden?: boolean;
  showCoordProj?: boolean;
  projColor?: ElementColor;
  
  constraint?: {
    type: 'intersection' | 'onFunctionGraph' | 'onAxis' | 'rotation';
    // For Intersection
    id1?: string; 
    id2?: string; 
    // For Function Graph
    graphId?: string;
    xParam?: number; // Giá trị x trong hệ tọa độ toán học
    // For Axis
    axis?: 'x' | 'y';
    // For Rotation
    centerId?: string;
    originalPointId?: string;
    angle?: string; // Có thể là số "45" hoặc tên biến "alpha"
  };
}

export interface Segment {
  id: string;
  startPointId: string;
  endPointId: string;
  style: LineStyle;
  color?: ElementColor;
  strokeWidth?: number;
  arrows?: 'none' | 'start' | 'end' | 'both'; 
  arrowSize?: number;
  marker?: SegmentMarker; // New property for equality marks
  hidden?: boolean;
}

export interface InfiniteLine {
  id: string;
  p1Id: string; 
  p2Id: string; 
  style: LineStyle;
  color?: ElementColor;
  strokeWidth?: number;
  type?: 'perpendicular' | 'parallel' | 'normal';
  hidden?: boolean;
  constraint?: {
    type: 'perpendicular' | 'parallel';
    sourceId: string; 
    throughPointId: string; 
  };
}

export interface Ray {
  id: string;
  startPointId: string;
  directionPointId: string;
  style: LineStyle;
  color?: ElementColor;
  strokeWidth?: number;
  hidden?: boolean;
}

export interface Polygon {
  id: string;
  pointIds: string[];
  color?: ElementColor;
  fillColor?: string;
  fillStyle?: FillStyle; 
  fillOpacity?: number;
  strokeWidth?: number;
  style?: LineStyle;
  hidden?: boolean;
  // Properties for Regular Polygon logic
  isRegular?: boolean;
  centerId?: string;
}

export interface Circle {
  id: string;
  centerId: string;
  radiusPointId?: string;
  radiusValue?: number;
  color?: ElementColor;
  fillColor?: string; 
  fillStyle?: FillStyle; 
  fillOpacity?: number;
  style?: LineStyle;
  strokeWidth?: number;
  hidden?: boolean;
}

export interface Ellipse {
  id: string;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  rotation?: number; 
  centerId?: string;
  majorAxisPointId?: string; 
  minorAxisPointId?: string; 
  color?: ElementColor;
  fillColor?: string;
  fillStyle?: FillStyle;
  fillOpacity?: number;
  style?: LineStyle;
  strokeWidth?: number;
  hidden?: boolean;
}

export interface Arc {
  id: string;
  centerId: string;
  startPointId: string;
  endPointId: string; 
  isMajor?: boolean; 
  color?: ElementColor;
  fillColor?: string; 
  fillStyle?: FillStyle; 
  fillOpacity?: number;
  fillMode?: 'segment' | 'sector'; 
  strokeWidth?: number;
  style?: LineStyle;
  hidden?: boolean;
}

export interface EllipticalArc {
  id: string;
  centerId: string;
  majorAxisPointId: string;
  minorAxisPointId: string;
  startPointId: string; 
  endPointId: string;   
  isMajor?: boolean;
  color?: ElementColor;
  fillColor?: string;
  fillStyle?: FillStyle;
  fillOpacity?: number;
  fillMode?: 'segment' | 'sector';
  strokeWidth?: number;
  style?: LineStyle;
  hidden?: boolean;
}

export interface FunctionGraph {
  id: string;
  formula: string; 
  color?: ElementColor;
  strokeWidth?: number;
  style?: LineStyle;
  hidden?: boolean;
  labelX?: number;
  labelY?: number;
}

// New Interface for Area Between Curves
export interface Integral {
  id: string;
  graph1Id: string;
  graph2Id: string;
  fillColor?: string;
  fillStyle?: FillStyle;
  fillOpacity?: number;
  hidden?: boolean;
}

export interface Cylinder {
  id: string;
  bottomCenterId: string; 
  radiusPointId: string;  
  topCenterId: string;    
  color?: ElementColor;
  strokeWidth?: number;
  hidden?: boolean;
}

export interface Cone {
  id: string;
  bottomCenterId: string;
  radiusPointId: string;
  apexId: string; 
  color?: ElementColor;
  strokeWidth?: number;
  hidden?: boolean;
}

export interface Sphere {
  id: string;
  centerId: string;
  radiusPointId: string;
  color?: ElementColor;
  strokeWidth?: number;
  hidden?: boolean;
}

export interface TextElement {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color?: ElementColor;
  hidden?: boolean;
}

export interface ImageElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // Data URL
  rotation?: number; // Degrees
  opacity?: number;
  hidden?: boolean;
}

export interface Angle {
  id: string;
  centerId: string;  
  point1Id: string;  
  point2Id: string;  
  isRightAngle?: boolean; 
  arcCount?: 1 | 2 | 3; 
  hasTick?: boolean; 
  showLabel?: boolean; // Toggle angle value text
  fontSize?: number; // Font size for angle value
  color?: ElementColor;
  strokeWidth?: number;
  hidden?: boolean;
}

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeometryData {
  points: Point[];
  segments: Segment[];
  lines: InfiniteLine[];
  rays: Ray[];
  polygons: Polygon[];
  circles: Circle[];
  ellipses: Ellipse[];
  ellipticalArcs?: EllipticalArc[]; 
  functionGraphs?: FunctionGraph[];
  integrals?: Integral[]; 
  angles: Angle[];
  texts: TextElement[];
  images?: ImageElement[];
  arcs?: Arc[];
  cylinders?: Cylinder[];
  cones?: Cone[];
  spheres?: Sphere[];
  variables?: Variable[]; // New Array for Dynamic Variables
}

export interface AIResponse {
  geometry: GeometryData;
  explanation: string;
}

export interface TextEntry {
  id?: string;
  svgX: number;    
  svgY: number;
  screenX: number; 
  screenY: number;
  value: string;
  fontSize: number;
  color: ElementColor;
}

export interface SelectionState {
  type: 'point' | 'text' | 'segment' | 'circle' | 'line' | 'ray' | 'ellipse' | 'polygon' | 'arc' | 'cylinder' | 'cone' | 'sphere' | 'angle' | 'ellipticalArc' | 'functionGraph' | 'image' | 'integral' | 'axis';
  id: string;
}

export interface CanvasHandle {
  resetSelection: () => void;
  copyToClipboard: () => Promise<void>;
  startEditingText: () => void;
}
