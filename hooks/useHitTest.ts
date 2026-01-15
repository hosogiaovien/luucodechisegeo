
import { GeometryData, Point } from '../types';
import { evaluateMathExpression } from '../utils/geometry';

interface UseHitTestProps {
    data: GeometryData;
    zoom: number;
    showHidden: boolean;
    gridSize: number;
}

export const useHitTest = ({ data, zoom, showHidden, gridSize }: UseHitTestProps) => {

    // Pre-calculate variable map for dynamic evaluation
    const variableMap: Record<string, number> = {};
    (data.variables || []).forEach(v => {
        if (v.name) variableMap[v.name.toLowerCase()] = v.value;
    });

    const findHitPoint = (x: number, y: number, radius = 20) => 
        (data.points || []).find(p => (showHidden || !p.hidden) && Math.hypot(p.x - x, p.y - y) < radius / zoom);

    const findHitText = (x: number, y: number) => 
        (data.texts || []).find(t => (showHidden || !t.hidden) && Math.hypot(t.x - x, t.y - y) < 40 / zoom);

    const findHitCircle = (x: number, y: number, radius = 10) => {
        const c = (data.circles || []).find(c => {
            const center = data.points.find(p => p.id === c.centerId);
            if (!center) return false;
            let r = c.radiusValue || 50;
            if (c.radiusPointId) {
                const rp = data.points.find(p => p.id === c.radiusPointId);
                if (rp) r = Math.hypot(rp.x - center.x, rp.y - center.y);
            }
            const dist = Math.hypot(x - center.x, y - center.y);
            return Math.abs(dist - r) < radius / zoom && (showHidden || !c.hidden);
        });
        if (c) return { type: 'circle' as const, id: c.id, obj: c };
        return null;
    };
  
    const findHitArc = (x: number, y: number, radius = 10) => {
        const arc = (data.arcs || []).find(a => {
            const center = data.points.find(p => p.id === a.centerId);
            const start = data.points.find(p => p.id === a.startPointId);
            if (!center || !start) return false;
            const r = Math.hypot(start.x - center.x, start.y - center.y);
            const dist = Math.hypot(x - center.x, y - center.y);
            return Math.abs(dist - r) < radius / zoom && (showHidden || !a.hidden);
        });
        if (arc) return { type: 'arc' as const, id: arc.id, obj: arc };
        return null;
    };

    const findHitAngle = (x: number, y: number) => 
        (data.angles || []).find(a => { 
            if (!showHidden && a.hidden) return false; 
            const center = data.points.find(p => p.id === a.centerId); 
            if (!center) return false; 
            const dist = Math.hypot(x - center.x, y - center.y); 
            return dist > 10 && dist < 40; 
        });
  
    const findHitEllipse = (x: number, y: number, radius = 10) => (data.ellipses || []).find(e => { 
        if (!showHidden && e.hidden) return false; 
        let cx = e.cx || 0, cy = e.cy || 0, rx = e.rx || 50, ry = e.ry || 30, rotation = e.rotation || 0;
        if (e.centerId && e.majorAxisPointId && e.minorAxisPointId) {
            const center = data.points.find(p => p.id === e.centerId);
            const pMajor = data.points.find(p => p.id === e.majorAxisPointId);
            const pMinor = data.points.find(p => p.id === e.minorAxisPointId);
            if (center && pMajor && pMinor) {
                cx = center.x; cy = center.y;
                rx = Math.hypot(pMajor.x - center.x, pMajor.y - center.y);
                ry = Math.hypot(pMinor.x - center.x, pMinor.y - center.y);
                rotation = Math.atan2(pMajor.y - center.y, pMajor.x - center.x) * (180/Math.PI);
            }
        }
        const dx = x - cx; const dy = y - cy;
        const angleRad = -rotation * (Math.PI / 180);
        const tx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
        const ty = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
        const val = (tx*tx)/(rx*rx) + (ty*ty)/(ry*ry);
        return Math.abs(val - 1) < 0.2; 
    });
  
    const findHitEllipticalArc = (x: number, y: number, radius = 10) => (data.ellipticalArcs || []).find(arc => {
        if (!showHidden && arc.hidden) return false;
        const center = data.points.find(p => p.id === arc.centerId);
        if(!center) return false;
        const dist = Math.hypot(x - center.x, y - center.y);
        return dist > 10 && dist < 1000;
    });

    const findHitPolygon = (x: number, y: number) => (data.polygons || []).find(poly => { 
        const pts = poly.pointIds.map(id => data.points.find(p => p.id === id)).filter(p => !!p) as Point[]; 
        if (pts.length < 3) return false; 
        const tolerance = 10 / zoom;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
            if (l2 === 0) continue;
            const t = Math.max(0, Math.min(1, ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / l2));
            const projX = p1.x + t * (p2.x - p1.x);
            const projY = p1.y + t * (p2.y - p1.y);
            const dist = Math.hypot(x - projX, y - projY);
            if (dist < tolerance) return true;
        }
        let inside = false; 
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { 
            const xi = pts[i].x, yi = pts[i].y; 
            const xj = pts[j].x, yj = pts[j].y; 
            const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi); 
            if (intersect) inside = !inside; 
        } 
        return inside; 
    });

    const findHitLineLike = (x: number, y: number, radius = 12) => {
        const tolerance = radius / zoom;
        const hitSeg = (data.segments || []).find(s => {
            if (!showHidden && s.hidden) return false;
            const p1 = data.points.find(p => p.id === s.startPointId);
            const p2 = data.points.find(p => p.id === s.endPointId);
            if (!p1 || !p2) return false;
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (dist === 0) return false;
            const d = Math.abs((p2.x - p1.x) * (p1.y - y) - (p1.x - x) * (p2.y - p1.y)) / dist;
            const dot = ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / Math.pow(dist, 2);
            return d < tolerance && dot >= 0 && dot <= 1;
        });
        if (hitSeg) return { type: 'segment' as const, id: hitSeg.id, obj: hitSeg };
        
        const hitLine = (data.lines || []).find(l => {
            if (!showHidden && l.hidden) return false;
            const p1 = data.points.find(p => p.id === l.p1Id);
            const p2 = data.points.find(p => p.id === l.p2Id);
            if (!p1 || !p2) return false;
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (dist === 0) return false;
            const d = Math.abs((p2.x - p1.x) * (p1.y - y) - (p1.x - x) * (p2.y - p1.y)) / dist;
            return d < tolerance;
        });
        if (hitLine) return { type: 'line' as const, id: hitLine.id, obj: hitLine };

        const hitRay = (data.rays || []).find(r => {
            if (!showHidden && r.hidden) return false;
            const p1 = data.points.find(p => p.id === r.startPointId);
            const p2 = data.points.find(p => p.id === r.directionPointId);
            if (!p1 || !p2) return false;
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (dist === 0) return false;
            const d = Math.abs((p2.x - p1.x) * (p1.y - y) - (p1.x - x) * (p2.y - p1.y)) / dist;
            const dot = ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / Math.pow(dist, 2);
            return d < tolerance && dot >= 0; 
        });
        if (hitRay) return { type: 'ray' as const, id: hitRay.id, obj: hitRay };

        return null;
    }

    const findHitFunctionGraph = (x: number, y: number, radius = 10) => {
        const tolerance = radius / zoom;
        const hitGraph = (data.functionGraphs || []).find(g => {
            if (!showHidden && g.hidden) return false;
            const mathX = x / gridSize;
            // PASS VARIABLES TO EVALUATE
            const mathY = evaluateMathExpression(g.formula, mathX, variableMap);
            if (isNaN(mathY)) return false;
            const worldY = -mathY * gridSize;
            const distY = Math.abs(worldY - y);
            return distY < tolerance * 2; 
        });
        if (hitGraph) return { type: 'functionGraph' as const, id: hitGraph.id, obj: hitGraph };
        return null;
    }

    const findHitAxis = (x: number, y: number, radius = 12) => {
        const tolerance = radius / zoom;
        // X-axis: y=0.
        if (Math.abs(y) < tolerance) return { type: 'axis' as const, id: 'axis-x' };
        // Y-axis: x=0.
        if (Math.abs(x) < tolerance) return { type: 'axis' as const, id: 'axis-y' };
        return null;
    }

    return {
        findHitPoint,
        findHitText,
        findHitCircle,
        findHitArc,
        findHitAngle,
        findHitEllipse,
        findHitEllipticalArc,
        findHitPolygon,
        findHitLineLike,
        findHitFunctionGraph,
        findHitAxis
    };
};
