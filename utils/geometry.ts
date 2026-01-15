
import { Point, LineStyle } from '../types';
import katex from 'katex';

export const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const calculateAngle = (p1: Point, center: Point, p2: Point): number => {
  const ang1 = Math.atan2(p1.y - center.y, p1.x - center.x);
  const ang2 = Math.atan2(p2.y - center.y, p2.x - center.x);
  let deg = (ang2 - ang1) * (180 / Math.PI);
  if (deg < 0) deg += 360;
  return deg;
};

// Generate a unique ID
export const generateId = (prefix: string = 'el'): string => {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
};

export const VIEWBOX_WIDTH = 1000;
export const VIEWBOX_HEIGHT = 800;

export const renderLatex = (text: string) => {
  try {
    return katex.renderToString(text, {
      throwOnError: false,
      displayMode: false,
      output: 'html',
    });
  } catch (e) {
    return text;
  }
};

// --- Math Helpers ---

export const evaluateMathExpression = (formula: string, x: number, variables: Record<string, number> = {}): number => {
    try {
        let jsFormula = formula.toLowerCase();
        
        // 1. Normalize Powers
        jsFormula = jsFormula.replace(/\^/g, '**');
        
        // 2. Replace Constants
        jsFormula = jsFormula.replace(/\bpi\b/g, 'Math.PI');
        jsFormula = jsFormula.replace(/\be\b/g, 'Math.E');

        // 3. Handle Implicit Multiplication (The Tricky Part)
        
        // 3a. Digit followed by x, (, or var (e.g., 2x, 2(x+1), 2a)
        jsFormula = jsFormula.replace(/(\d)(?=\s*(x|\(|[a-z]))/g, '$1*');
        
        // 3b. 'x' followed by parenthesis (e.g., x(x+1))
        jsFormula = jsFormula.replace(/(x)(?=\s*\()/g, '$1*');

        // 3c. Variable followed by 'x' (e.g., ax, bx, mx)
        // We match any single letter (except 'x' itself to avoid x*x loop if careless, though 'xx' isn't valid single var usually)
        // We look for [a-z] followed by x. 
        // Note: This effectively breaks words like "max" into "ma*x" unless protected.
        // But we replace math functions later, so we must be careful.
        // Strategy: Only do this for known variable names if possible, OR
        // simpler: Do it for single chars that are NOT part of standard functions.
        // For this app context (y=ax+b), simply replacing char+x is usually what user wants.
        
        // Protect standard functions by temporarily renaming or just rely on them usually being followed by (
        // Let's iterate user variables to be safe and precise.
        Object.keys(variables).forEach(v => {
            // If variable is 'a', replace 'ax' with 'a*x'
            // Use word boundary for variable start, lookahead for x
            if (v.length === 1 && v !== 'x') {
                 const regex = new RegExp(`\\b${v}x`, 'g');
                 jsFormula = jsFormula.replace(regex, `${v}*x`);
            }
        });

        // Fallback generic implicit mult for single chars followed by x (e.g. y = mx + c where m isn't defined yet but user expects it to work if they define m later)
        // This regex finds a letter (not x) followed immediately by x
        jsFormula = jsFormula.replace(/([a-wy-z])(x)/g, '$1*$2');

        // 4. Replace Standard Math Functions
        // We use word boundaries \b to ensure we don't replace 'sin' inside 'asin' incorrectly if ordered wrong
        const functions = [
            'sin', 'cos', 'tan', 'abs', 'sqrt', 'log', 'exp', 'floor', 'ceil', 'round', 
            'acos', 'asin', 'atan', 'atan2'
        ];
        
        functions.forEach(fn => {
            jsFormula = jsFormula.replace(new RegExp(`\\b${fn}\\b`, 'g'), `Math.${fn}`);
        });
        
        // ln is special
        jsFormula = jsFormula.replace(/\bln\b/g, 'Math.log');

        // Prepare keys and values for Function constructor
        const varKeys = Object.keys(variables);
        const varValues = Object.values(variables);

        // Create function with arguments: x, ...variableNames
        const f = new Function('x', ...varKeys, `return ${jsFormula};`);
        
        // Execute
        const result = f(x, ...varValues);
        return result;
    } catch (e) {
        return NaN;
    }
};

export const getLineEquation = (p1: Point, p2: Point) => {
  const a = p1.y - p2.y;
  const b = p2.x - p1.x;
  const c = -a * p1.x - b * p1.y;
  return { a, b, c };
};

export const getIntersectionLinear = (l1: {a:number, b:number, c:number}, l2: {a:number, b:number, c:number}) => {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-9) return null; // Song song
  return {
    x: (l1.b * l2.c - l2.b * l1.c) / det,
    y: (l2.a * l1.c - l1.a * l2.c) / det
  };
};

export const isPointOnSegment = (p: {x:number, y:number}, s1: Point, s2: Point) => {
    const minX = Math.min(s1.x, s2.x) - 0.1;
    const maxX = Math.max(s1.x, s2.x) + 0.1;
    const minY = Math.min(s1.y, s2.y) - 0.1;
    const maxY = Math.max(s1.y, s2.y) + 0.1;
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
};

export const isPointOnRay = (p: {x:number, y:number}, start: Point, dir: Point) => {
    const vx = dir.x - start.x;
    const vy = dir.y - start.y;
    const vpx = p.x - start.x;
    const vpy = p.y - start.y;
    return vx * vpx + vy * vpy >= -1e-9;
}

// --- Style Helpers ---
export const getDashArray = (style: LineStyle): string => {
    switch (style) {
        case 'dashed': return '10,8';
        case 'dotted': return '2,5';
        case 'dashdot': return '10,5,2,5'; // Gạch - Chấm
        case 'longdash': return '20,10';   // Gạch dài
        case 'solid': 
        default: return '0';
    }
};
