
import { Point, InfiniteLine, Segment, Ray, FunctionGraph, Variable } from '../types';
import { getLineEquation, getIntersectionLinear, evaluateMathExpression } from './geometry';

// Helper to get 2 points defining a linear object (Segment, Line, Ray)
const getDefiningPoints = (objectId: string, segments: Segment[], lines: InfiniteLine[], rays: Ray[], pointMap: Map<string, Point>): [Point, Point] | null => {
    const seg = segments.find(s => s.id === objectId);
    if (seg) {
        const p1 = pointMap.get(seg.startPointId);
        const p2 = pointMap.get(seg.endPointId);
        return (p1 && p2) ? [p1, p2] : null;
    }
    const l = lines.find(li => li.id === objectId);
    if (l) {
        const p1 = pointMap.get(l.p1Id);
        const p2 = pointMap.get(l.p2Id);
        return (p1 && p2) ? [p1, p2] : null;
    }
    const r = rays.find(ra => ra.id === objectId);
    if (r) {
        const p1 = pointMap.get(r.startPointId);
        const p2 = pointMap.get(r.directionPointId);
        return (p1 && p2) ? [p1, p2] : null;
    }
    return null;
};

// Numerical solver using Secant Method to find root of f(x) = 0 near initial guess
const findRoot = (
    formula1: string, 
    formula2: string | null, // null implies y=0 (X-axis)
    initialX: number, 
    variables: Record<string, number>
): number | null => {
    let x0 = initialX;
    let x1 = initialX + 0.1; // Small step
    const maxIter = 10;
    const tolerance = 1e-6;

    const evalDiff = (x: number) => {
        const y1 = evaluateMathExpression(formula1, x, variables);
        const y2 = formula2 ? evaluateMathExpression(formula2, x, variables) : 0;
        return y1 - y2;
    };

    for (let i = 0; i < maxIter; i++) {
        const y0 = evalDiff(x0);
        const y1 = evalDiff(x1);
        
        if (Math.abs(y1) < tolerance) return x1;
        if (Math.abs(y1 - y0) < 1e-9) break; // Avoid division by zero

        // Secant method formula
        const x2 = x1 - y1 * (x1 - x0) / (y1 - y0);
        x0 = x1;
        x1 = x2;
    }
    
    // Fallback: if converged reasonably close
    if (Math.abs(evalDiff(x1)) < 0.1) return x1;
    return null;
};

export const resolveConstraints = (
    points: Point[], 
    lines: InfiniteLine[], 
    segments: Segment[], 
    rays: Ray[], 
    functionGraphs: FunctionGraph[] = [], 
    variables: Variable[] = [],
    gridSize: number = 50
): Point[] => {
    // Create a map for fast point lookup
    const pointMap = new Map(points.map(p => [p.id, p]));
    const updatedPoints = [...points];
    const updatedPointMap = new Map(pointMap); // Mutable map for updates in this cycle

    // Helper to update a point in our local list
    const updatePoint = (id: string, x: number, y: number) => {
        const p = updatedPointMap.get(id);
        if (p) {
            // Check if position actually changed significantly to avoid jitter
            if (Math.abs(p.x - x) > 1e-4 || Math.abs(p.y - y) > 1e-4) {
                const newP = { ...p, x, y };
                updatedPointMap.set(id, newP);
                const idx = updatedPoints.findIndex(pt => pt.id === id);
                if (idx !== -1) updatedPoints[idx] = newP;
            }
        }
    };

    // Prepare Variable Map for Math Eval
    const variableMap: Record<string, number> = {};
    variables.forEach(v => {
        if (v.name) variableMap[v.name.toLowerCase()] = v.value;
    });

    // 1. Resolve Line Constraints (Perpendicular / Parallel)
    lines.forEach(line => {
        if (line.constraint) {
            const { type, sourceId, throughPointId } = line.constraint;
            const throughPoint = updatedPointMap.get(throughPointId);
            const sourcePoints = getDefiningPoints(sourceId, segments, lines, rays, updatedPointMap);

            if (throughPoint && sourcePoints) {
                const [p1, p2] = sourcePoints;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                let ux, uy;

                // Calculate direction vector based on constraint type
                if (type === 'parallel') {
                    ux = dx; uy = dy;
                } else { // perpendicular
                    ux = -dy; uy = dx;
                }

                // Normalize
                const len = Math.hypot(ux, uy);
                if (len > 0) { ux /= len; uy /= len; }

                const EXTENT = 2000;
                updatePoint(line.p1Id, throughPoint.x - ux * EXTENT, throughPoint.y - uy * EXTENT);
                updatePoint(line.p2Id, throughPoint.x + ux * EXTENT, throughPoint.y + uy * EXTENT);
            }
        }
    });

    // 2. Resolve Point Constraints
    points.forEach(point => {
        if (point.constraint) {
            
            // A. Intersection
            if (point.constraint.type === 'intersection') {
                const { id1, id2 } = point.constraint;
                if (id1 && id2) {
                    
                    // Identify object types
                    const graph1 = functionGraphs.find(g => g.id === id1);
                    const graph2 = functionGraphs.find(g => g.id === id2);
                    const isAxisX1 = id1 === 'axis-x';
                    const isAxisY1 = id1 === 'axis-y';
                    const isAxisX2 = id2 === 'axis-x';
                    const isAxisY2 = id2 === 'axis-y';

                    // CASE: Graph intersection (Graph vs Graph OR Graph vs Axis)
                    if (graph1 || graph2) {
                        let targetX: number | null = null;
                        let targetY: number | null = null;

                        // Case 1: Graph vs Y-Axis (x = 0)
                        if ((graph1 && isAxisY2) || (graph2 && isAxisY1)) {
                            const g = graph1 || graph2!;
                            const yVal = evaluateMathExpression(g.formula, 0, variableMap);
                            if (!isNaN(yVal)) {
                                targetX = 0;
                                targetY = -yVal * gridSize;
                            }
                        }
                        // Case 2: Graph vs X-Axis (y = 0) -> Solve f(x) = 0
                        else if ((graph1 && isAxisX2) || (graph2 && isAxisX1)) {
                            const g = graph1 || graph2!;
                            // Use current point X as initial guess to stay on the same branch
                            const currentMathX = point.x / gridSize;
                            const root = findRoot(g.formula, null, currentMathX, variableMap);
                            if (root !== null) {
                                targetX = root * gridSize;
                                targetY = 0;
                            }
                        }
                        // Case 3: Graph vs Graph -> Solve f(x) = g(x)
                        else if (graph1 && graph2) {
                            const currentMathX = point.x / gridSize;
                            const root = findRoot(graph1.formula, graph2.formula, currentMathX, variableMap);
                            if (root !== null) {
                                const yVal = evaluateMathExpression(graph1.formula, root, variableMap);
                                targetX = root * gridSize;
                                targetY = -yVal * gridSize;
                            }
                        }

                        // Apply update if solution found
                        if (targetX !== null && targetY !== null) {
                            updatePoint(point.id, targetX, targetY);
                        }
                    } 
                    // CASE: Linear Intersection
                    else {
                        const pts1 = getDefiningPoints(id1, segments, lines, rays, updatedPointMap);
                        const pts2 = getDefiningPoints(id2, segments, lines, rays, updatedPointMap);

                        if (pts1 && pts2) {
                            const l1 = getLineEquation(pts1[0], pts1[1]);
                            const l2 = getLineEquation(pts2[0], pts2[1]);
                            const intersect = getIntersectionLinear(l1, l2);
                            
                            if (intersect) {
                                updatePoint(point.id, intersect.x, intersect.y);
                            }
                        }
                    }
                }
            } 
            
            // B. On Function Graph (Fix point to graph when vars change)
            else if (point.constraint.type === 'onFunctionGraph') {
                const { graphId, xParam } = point.constraint;
                const graph = functionGraphs.find(g => g.id === graphId);
                
                if (graph && xParam !== undefined) {
                    // xParam is the math coordinate x.
                    const mathY = evaluateMathExpression(graph.formula, xParam, variableMap);
                    
                    if (!isNaN(mathY)) {
                        const newSvgX = xParam * gridSize;
                        const newSvgY = -mathY * gridSize;
                        updatePoint(point.id, newSvgX, newSvgY);
                    }
                }
            }

            // C. On Axis
            else if (point.constraint.type === 'onAxis') {
                const { axis } = point.constraint;
                if (axis === 'x') {
                    updatePoint(point.id, point.x, 0); // Keep X, force Y=0
                } else if (axis === 'y') {
                    updatePoint(point.id, 0, point.y); // Keep Y, force X=0
                }
            }

            // D. Rotation
            else if (point.constraint.type === 'rotation') {
                const { centerId, originalPointId, angle } = point.constraint;
                const center = updatedPointMap.get(centerId || '');
                const original = updatedPointMap.get(originalPointId || '');
                
                if (center && original && angle) {
                    let angleVal = parseFloat(angle);
                    if (isNaN(angleVal)) {
                        // Variable lookup
                        angleVal = evaluateMathExpression(angle, 0, variableMap);
                    }
                    
                    if (!isNaN(angleVal)) {
                        const rad = angleVal * (Math.PI / 180);
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        const dx = original.x - center.x;
                        const dy = original.y - center.y;
                        
                        const newX = center.x + dx * cos - dy * sin;
                        const newY = center.y + dx * sin + dy * cos;
                        
                        updatePoint(point.id, newX, newY);
                    }
                }
            }
        }
    });

    return updatedPoints;
};
