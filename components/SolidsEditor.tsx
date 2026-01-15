
import React, { useState, useRef, useEffect } from 'react';
import { Box, Cylinder, Triangle, Pyramid, Check, Scissors, Settings2, Hexagon, Rotate3d } from 'lucide-react';
import { SolidType } from '../types';
import * as htmlToImage from 'html-to-image';

interface SolidConfig {
    type: SolidType | 'prism';
    unfoldProgress: number; // 0 (Closed) to 100 (Open)
    showLabels: boolean;
    rotationX: number;
    rotationY: number;
    dimA: number; // Rộng / Bán kính
    dimB: number; // Sâu
    dimH: number; // Cao
    numSides: number; // Số cạnh đáy (cho lăng trụ)
}

const SOLID_TYPES: { id: SolidType | 'prism', label: string, icon: any }[] = [
    { id: 'cube', label: 'Lập Phương', icon: Box },
    { id: 'rectangular_prism', label: 'Hộp Chữ Nhật', icon: Box },
    { id: 'prism', label: 'Lăng Trụ Đứng', icon: Hexagon },
    { id: 'square_pyramid', label: 'Chóp Tứ Giác', icon: Pyramid },
    { id: 'tetrahedron', label: 'Tứ Diện Đều', icon: Triangle },
    { id: 'cylinder', label: 'Hình Trụ', icon: Cylinder },
    { id: 'cone', label: 'Hình Nón', icon: Triangle },
];

export const SolidsEditor: React.FC = () => {
    const [config, setConfig] = useState<SolidConfig>({
        type: 'rectangular_prism',
        unfoldProgress: 0,
        showLabels: true,
        rotationX: -15,
        rotationY: 0,
        dimA: 1.5, 
        dimB: 1.5,
        dimH: 2,
        numSides: 3 
    });
    const [isCopied, setIsCopied] = useState(false);
    const renderRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    // RESET CAMERA WHEN SHAPE CHANGES
    useEffect(() => {
        // Với Hình Trụ và Hình Nón, đặt góc xoay về 0 để nhìn thẳng (như hình 2D SGK)
        // Các hình khối khác giữ góc nghiêng 3D để dễ nhìn khối
        const isRoundShape = config.type === 'cylinder' || config.type === 'cone';
        
        setConfig(prev => ({
            ...prev,
            rotationX: isRoundShape ? 0 : -15,
            rotationY: isRoundShape ? 0 : -15,
            unfoldProgress: 0 // Auto close when switching
        }));
    }, [config.type]);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Strict check: Only rotate if left mouse button is held down
        if (e.buttons !== 1) {
            isDragging.current = false;
            return;
        }
        
        if (!isDragging.current) return;
        
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        
        setConfig(prev => ({
            ...prev,
            rotationY: prev.rotationY + dx * 0.4, // Reduced sensitivity
            rotationX: prev.rotationX - dy * 0.4
        }));
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    const handleExport = async () => {
        if (renderRef.current) {
            try {
                const blob = await htmlToImage.toBlob(renderRef.current, { 
                    backgroundColor: 'white', 
                    pixelRatio: 3 
                });
                if (blob) {
                    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                }
            } catch (e) {
                console.error("Export failed", e);
            }
        }
    };

    // --- 3D MATH HELPERS ---
    type Point3D = { x: number, y: number, z: number };
    type Face = { points: Point3D[], color: string, label?: { text: string, pos?: Point3D }, borderColor?: string, dashed?: boolean };

    const rotate = (p: Point3D): Point3D => {
        const radX = config.rotationX * Math.PI / 180;
        const radY = config.rotationY * Math.PI / 180;
        // Rotate Y
        let x = p.x * Math.cos(radY) - p.z * Math.sin(radY);
        let z = p.x * Math.sin(radY) + p.z * Math.cos(radY);
        let y = p.y;
        // Rotate X
        let y2 = y * Math.cos(radX) - z * Math.sin(radX);
        let z2 = y * Math.sin(radX) + z * Math.cos(radX);
        return { x, y: y2, z: z2 };
    };

    const project = (p: Point3D, cx: number, cy: number, scale: number) => {
        const rotated = rotate(p);
        const f = 1000; // Increased Focal length for less distortion
        const dist = f / (f - rotated.z);
        return {
            x: cx + rotated.x * scale * dist,
            y: cy + rotated.y * scale * dist,
            z: rotated.z 
        };
    };

    // Rotate point P around axis defined by Pivot and Vector
    const rotateAroundAxis = (p: Point3D, pivot: Point3D, axis: Point3D, angle: number): Point3D => {
        const x = p.x - pivot.x;
        const y = p.y - pivot.y;
        const z = p.z - pivot.z;

        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const t = 1 - c;
        const { x: ux, y: uy, z: uz } = axis;

        const nx = x*(c + ux*ux*t) + y*(ux*uy*t - uz*s) + z*(ux*uz*t + uy*s);
        const ny = x*(uy*ux*t + uz*s) + y*(c + uy*uy*t) + z*(uy*uz*t - ux*s);
        const nz = x*(uz*ux*t - uy*s) + y*(uz*uy*t + ux*s) + z*(c + uz*uz*t);

        return { x: nx + pivot.x, y: ny + pivot.y, z: nz + pivot.z };
    };

    // --- MAIN RENDERER ---
    const renderSolid = () => {
        const width = 800;
        const height = 600;
        const cx = width / 2;
        const cy = height / 2;
        const scale = 160; // Increased scale
        const t = config.unfoldProgress / 100; // 0 to 1

        let faces: Face[] = [];

        // Colors
        const cBase = '#cbd5e1'; // Slate 300
        const cSide1 = '#fca5a5'; // Red 300
        const cSide2 = '#93c5fd'; // Blue 300
        const cSide3 = '#86efac'; // Green 300
        const cSide4 = '#fdba74'; // Orange 300
        const cTop = '#f0abfc'; // Purple 300
        const cSideGeneric = [cSide1, cSide2, cSide3, cSide4, '#fcd34d', '#22d3ee', '#f472b6'];

        // --- SHAPE GENERATION LOGIC ---

        if (config.type === 'cube' || config.type === 'rectangular_prism') {
            const w = (config.type === 'cube' ? config.dimA : config.dimA); 
            const d = (config.type === 'cube' ? config.dimA : config.dimB);
            const h = (config.type === 'cube' ? config.dimA : config.dimH);
            
            const hw = w/2; const hd = d/2; const hh = h/2;

            // 1. BASE (Fixed in Center)
            const pBase = [{x:-hw, y:hh, z:-hd}, {x:hw, y:hh, z:-hd}, {x:hw, y:hh, z:hd}, {x:-hw, y:hh, z:hd}];
            faces.push({ points: pBase, color: cBase, label: {text: 'Đáy dưới'} });

            // 2. FRONT (Attached to z=hd)
            // Unfold: Flap DOWN (Z+ direction). Needs Negative rotation around X axis.
            let pFront = [{x:-hw, y:hh, z:hd}, {x:hw, y:hh, z:hd}, {x:hw, y:-hh, z:hd}, {x:-hw, y:-hh, z:hd}];
            pFront = pFront.map(p => rotateAroundAxis(p, {x:0, y:hh, z:hd}, {x:1, y:0, z:0}, t * -Math.PI/2));
            faces.push({ points: pFront, color: cSide1, label: {text: 'Mặt bên'} });

            // 3. BACK (Attached to z=-hd)
            // Unfold: Flap UP (Z- direction). Needs Positive rotation around X axis.
            let pBack = [{x:hw, y:hh, z:-hd}, {x:-hw, y:hh, z:-hd}, {x:-hw, y:-hh, z:-hd}, {x:hw, y:-hh, z:-hd}];
            pBack = pBack.map(p => rotateAroundAxis(p, {x:0, y:hh, z:-hd}, {x:1, y:0, z:0}, t * Math.PI/2));
            faces.push({ points: pBack, color: cSide2, label: {text: 'Mặt bên'} });

            // 4. RIGHT (Attached to x=hw)
            // Unfold: Flap RIGHT (X+ direction). Needs Positive rotation around Z axis.
            let pRight = [{x:hw, y:hh, z:hd}, {x:hw, y:hh, z:-hd}, {x:hw, y:-hh, z:-hd}, {x:hw, y:-hh, z:hd}];
            pRight = pRight.map(p => rotateAroundAxis(p, {x:hw, y:hh, z:0}, {x:0, y:0, z:1}, t * Math.PI/2));
            faces.push({ points: pRight, color: cSide4, label: {text: 'Mặt bên'} });

            // 5. LEFT (Attached to x=-hw)
            // Unfold: Flap LEFT (X- direction). Needs Negative rotation around Z axis.
            let pLeft = [{x:-hw, y:hh, z:-hd}, {x:-hw, y:hh, z:hd}, {x:-hw, y:-hh, z:hd}, {x:-hw, y:-hh, z:-hd}];
            pLeft = pLeft.map(p => rotateAroundAxis(p, {x:-hw, y:hh, z:0}, {x:0, y:0, z:1}, t * -Math.PI/2));
            faces.push({ points: pLeft, color: cSide3, label: {text: 'Mặt bên'} });

            // 6. TOP (Attached to BACK face)
            // Moves with Back face, then unfolds relative to it.
            // Hinge: Top edge of Back face (which is moving).
            // Initially at y=-hh. Hinge is (..., -hh, -hd).
            let pTop = [{x:-hw, y:-hh, z:-hd}, {x:hw, y:-hh, z:-hd}, {x:hw, y:-hh, z:hd}, {x:-hw, y:-hh, z:hd}];
            // 1. Unfold relative to Back (Rotate +90 deg around X relative to hinge to flip out)
            pTop = pTop.map(p => rotateAroundAxis(p, {x:0, y:-hh, z:-hd}, {x:1,y:0,z:0}, t * Math.PI/2));
            // 2. Move with Back (Rotate +90 deg around X global hinge)
            pTop = pTop.map(p => rotateAroundAxis(p, {x:0, y:hh, z:-hd}, {x:1,y:0,z:0}, t * Math.PI/2));
            faces.push({ points: pTop, color: cTop, label: {text: 'Đáy trên'} });
        }

        else if (config.type === 'tetrahedron') {
            const a = config.dimA * 2; 
            const rIn = a / (2 * Math.sqrt(3));
            const rCircum = a / Math.sqrt(3);
            const H = a * Math.sqrt(6) / 3;
            
            // Center Base
            const p1 = { x: 0, y: 0, z: -rCircum };
            const p2 = { x: a/2, y: 0, z: rIn };
            const p3 = { x: -a/2, y: 0, z: rIn };
            const apex = { x: 0, y: -H, z: 0 };

            const yOff = H/3;
            [p1, p2, p3].forEach(p => p.y += yOff);
            apex.y += yOff;

            faces.push({ points: [p1, p2, p3], color: cBase, label: {text: 'Đáy'} });

            // Unfold Angle: Dihedral to Flat (PI).
            // Dihedral of Reg Tetrahedron ~ 70.5 deg.
            // Angle to rotate = 180 - 70.5 = 109.5 deg.
            // Direction: Outward. Changed from negative to positive.
            const dihedral = Math.acos(1/3);
            const unfoldAngle = (Math.PI - dihedral) * t;

            const edges = [
                { pA: p1, pB: p2, col: cSide1 },
                { pA: p2, pB: p3, col: cSide2 },
                { pA: p3, pB: p1, col: cSide3 }
            ];

            edges.forEach(e => {
                const axis = { x: e.pB.x - e.pA.x, y: 0, z: e.pB.z - e.pA.z };
                const len = Math.hypot(axis.x, axis.z);
                axis.x /= len; axis.z /= len;
                
                // Flip sign to positive for outward unfolding
                const pts = [e.pA, e.pB, apex].map(p => rotateAroundAxis(p, e.pA, axis, unfoldAngle));
                faces.push({ points: pts, color: e.col, label: {text: 'Mặt bên'} });
            });
        }

        else if (config.type === 'prism') {
            const n = config.numSides;
            const r = config.dimA * 1.5; 
            const h = config.dimH * 1.5;
            const yBot = h/2;
            const yTop = -h/2;

            const baseVerts: Point3D[] = [];
            for (let i = 0; i < n; i++) {
                const ang = (2 * Math.PI * i) / n - Math.PI / 2; 
                baseVerts.push({ x: r * Math.cos(ang), y: yBot, z: r * Math.sin(ang) });
            }

            faces.push({ points: [...baseVerts], color: cBase, label: {text: 'Đáy dưới'} });

            for (let i = 0; i < n; i++) {
                const pA = baseVerts[i];
                const pB = baseVerts[(i + 1) % n];
                const pAt = { ...pA, y: yTop };
                const pBt = { ...pB, y: yTop };

                const axis = { x: pB.x - pA.x, y: 0, z: pB.z - pA.z };
                const len = Math.hypot(axis.x, axis.z);
                const normAxis = { x: axis.x/len, y: 0, z: axis.z/len };

                // Rotate OUTWARDS. Changed to positive for "flapping out".
                let facePts = [pA, pB, pBt, pAt];
                facePts = facePts.map(p => rotateAroundAxis(p, pA, normAxis, t * Math.PI/2));
                
                faces.push({ points: facePts, color: cSideGeneric[i % cSideGeneric.length], label: {text: 'Mặt bên'} });

                // Attach Top to Face 0 (Back face)
                if (i === 0) {
                    const topVerts: Point3D[] = baseVerts.map(v => ({ ...v, y: yTop }));
                    // 1. Unfold Top relative to Side 0 (Match side direction)
                    let finalTop = topVerts.map(p => rotateAroundAxis(p, pAt, normAxis, t * Math.PI/2));
                    // 2. Unfold Side 0 (Match side direction)
                    finalTop = finalTop.map(p => rotateAroundAxis(p, pA, normAxis, t * Math.PI/2));
                    
                    faces.push({ points: finalTop, color: cTop, label: {text: 'Đáy trên'} });
                }
            }
        }

        else if (config.type === 'cylinder') {
            const r = config.dimA * 0.9;
            const h = config.dimH * 1.5;
            const yTop = -h/2;
            const yBot = h/2;
            const segments = 32;

            // NET LAYOUT:
            // Unfold flat onto the Z=0 plane (XY plane).
            // This ensures it looks like a 2D drawing when rotation is 0.
            
            // 1. BODY TRANSFORMATION
            const gridW = 32;
            for(let i=0; i<gridW; i++) {
                const u1 = -Math.PI + (i/gridW)*2*Math.PI;
                const u2 = -Math.PI + ((i+1)/gridW)*2*Math.PI;
                
                const transform = (u: number, y: number) => {
                    const x_cyl = r * Math.sin(u);
                    const z_cyl = r * Math.cos(u); 
                    
                    // Unroll to flat plane.
                    // u ranges -PI to PI. x ranges -PI*r to PI*r.
                    const x_flat = r * u; 
                    const z_flat = 0; // Flat on XY plane

                    return {
                        x: x_cyl * (1-t) + x_flat * t,
                        y: y,
                        z: z_cyl * (1-t) + z_flat * t
                    };
                };

                const p1 = transform(u1, yTop);
                const p2 = transform(u2, yTop);
                const p3 = transform(u2, yBot);
                const p4 = transform(u1, yBot);
                
                const col = i % 2 === 0 ? cSide1 : cSide2;
                const label = i === gridW/2 && config.showLabels ? {text:'Mặt xung quanh', pos:{x:0, y:0, z:0}} : undefined;
                faces.push({ points: [p1, p2, p3, p4], color: col, borderColor:'none', label });
            }

            // 2. TOP & BOTTOM CIRCLES
            const topCircle = [];
            const botCircle = [];
            for(let i=0; i<segments; i++) {
                const ang = 2*Math.PI*i/segments;
                // 3D Positions (Caps)
                const pt3D_Top = { x: r*Math.sin(ang), y: yTop, z: r*Math.cos(ang) };
                const pt3D_Bot = { x: r*Math.sin(ang), y: yBot, z: r*Math.cos(ang) };

                // 2D Positions (Flattened)
                // Center Top: (0, yTop - r).
                // Center Bot: (0, yBot + r).
                // Note: Standard net usually has circles touching the rectangle edge.
                // Top circle center at (0, yTop - r) implies tangent at (0, yTop).
                // All on Z=0 plane.
                const pt2D_Top = { x: r*Math.sin(ang), y: (yTop - r) + r*Math.cos(ang), z: 0 };
                const pt2D_Bot = { x: r*Math.sin(ang), y: (yBot + r) - r*Math.cos(ang), z: 0 };

                // Interpolate
                topCircle.push({
                    x: pt3D_Top.x * (1-t) + pt2D_Top.x * t,
                    y: pt3D_Top.y * (1-t) + pt2D_Top.y * t,
                    z: pt3D_Top.z * (1-t) + pt2D_Top.z * t
                });
                botCircle.push({
                    x: pt3D_Bot.x * (1-t) + pt2D_Bot.x * t,
                    y: pt3D_Bot.y * (1-t) + pt2D_Bot.y * t,
                    z: pt3D_Bot.z * (1-t) + pt2D_Bot.z * t
                });
            }
            
            faces.push({ points: topCircle, color: cTop, label: {text: 'Đáy trên'} });
            faces.push({ points: botCircle, color: cBase, label: {text: 'Đáy dưới'} });
        }

        else if (config.type === 'cone') {
            const r = config.dimA;
            const h = config.dimH * 1.5;
            const yBase = h/2;
            const yApex = -h/2;
            const segments = 32;
            
            const L = Math.hypot(r, h);
            
            // 2D Layout Geometry (Centered on Y axis)
            const apex2D = { x: 0, y: -L/2 }; 
            // Lowest point of Fan Arc (where u=0)
            const touchPointY = apex2D.y + L; // = L/2
            // Center of Base Circle (radius r below touch point)
            const circleCenterY = touchPointY + r; 

            // 1. BASE CIRCLE
            const botCircle = [];
            for(let i=0; i<segments; i++) {
                const ang = 2*Math.PI*i/segments;
                // 3D Position
                const p3 = { x: r*Math.sin(ang), y: yBase, z: r*Math.cos(ang) };
                
                // 2D Position
                // Tangent at top (angle 0 corresponds to touch point in 2D logic below)
                // Using formula: y = Cy - r * cos(ang).
                // At ang=0, y = Cy - r = touchPointY. Matches.
                const p2 = { 
                    x: r * Math.sin(ang), 
                    y: circleCenterY - r * Math.cos(ang), 
                    z: 0 
                };
                
                botCircle.push({
                    x: p3.x * (1-t) + p2.x * t,
                    y: p3.y * (1-t) + p2.y * t,
                    z: p3.z * (1-t) + p2.z * t
                });
            }
            faces.push({ points: botCircle, color: cBase, label: {text: 'Đáy'} });

            // 2. CONE SECTOR (Fan)
            const gridW = 32;
            for(let i=0; i<gridW; i++) {
                const u1 = -Math.PI + (i/gridW)*2*Math.PI;
                const u2 = -Math.PI + ((i+1)/gridW)*2*Math.PI;
                
                const transform = (u: number, isBase: boolean) => {
                    // 3D (Standard Cone)
                    const x3 = isBase ? r * Math.sin(u) : 0;
                    const z3 = isBase ? r * Math.cos(u) : 0;
                    const y3 = isBase ? yBase : yApex;
                    
                    // 2D (Fan)
                    // Map u (from -PI to PI) to angleInFan.
                    // u=0 corresponds to the center of the unrolled fan (lowest Y point).
                    const angleInFan = u * (r/L); 
                    
                    // Coordinates relative to Apex
                    // x = L * sin(ang), y = L * cos(ang) -> This puts angle 0 at bottom (positive Y).
                    const dx = L * Math.sin(angleInFan);
                    const dy = L * Math.cos(angleInFan);
                    
                    const x2 = isBase ? apex2D.x + dx : apex2D.x;
                    const y2 = isBase ? apex2D.y + dy : apex2D.y;
                    const z2 = 0;

                    return {
                        x: x3 * (1-t) + x2 * t,
                        y: y3 * (1-t) + y2 * t,
                        z: z3 * (1-t) + z2 * t
                    };
                };

                const p1 = transform(u1, false);
                const p2 = transform(u2, false);
                const p3 = transform(u2, true);
                const p4 = transform(u1, true);
                
                const col = i % 2 === 0 ? cSide1 : cSide2;
                const label = i === gridW/2 && config.showLabels ? {text:'Mặt xung quanh', pos:{x:0, y:0, z:0}} : undefined;
                faces.push({ points: [p1, p3, p4], color: col, borderColor:'none', label });
            }
        }
        
        else if (config.type === 'square_pyramid') {
             const w = config.dimA * 1.5; 
             const h = config.dimH * 1.5;
             const hw = w/2;
             const yBase = h/3;
             const pBase = [{x:-hw,y:yBase,z:-hw}, {x:hw,y:yBase,z:-hw}, {x:hw,y:yBase,z:hw}, {x:-hw,y:yBase,z:hw}];
             faces.push({ points: pBase, color: cBase, label: {text: 'Đáy'} });
 
             const apex = {x:0, y: yBase - h, z:0};
             const slope = Math.atan2(h, hw);
             const unfoldAngle = (Math.PI - slope) * t;
 
             // Open OUTWARDS -> Negative Rotation
             let fFront = [apex, {x:hw,y:yBase,z:hw}, {x:-hw,y:yBase,z:hw}];
             fFront = fFront.map(p => rotateAroundAxis(p, {x:0,y:yBase,z:hw}, {x:1,y:0,z:0}, -unfoldAngle));
             faces.push({ points: fFront, color: cSide1, label: {text: 'Mặt bên'} });

             let fBack = [apex, {x:-hw,y:yBase,z:-hw}, {x:hw,y:yBase,z:-hw}];
             fBack = fBack.map(p => rotateAroundAxis(p, {x:0,y:yBase,z:-hw}, {x:1,y:0,z:0}, unfoldAngle));
             faces.push({ points: fBack, color: cSide2, label: {text: 'Mặt bên'} });

             let fRight = [apex, {x:hw,y:yBase,z:-hw}, {x:hw,y:yBase,z:hw}];
             fRight = fRight.map(p => rotateAroundAxis(p, {x:hw,y:yBase,z:0}, {x:0,y:0,z:1}, unfoldAngle));
             faces.push({ points: fRight, color: cSide4, label: {text: 'Mặt bên'} });

             let fLeft = [apex, {x:-hw,y:yBase,z:hw}, {x:-hw,y:yBase,z:-hw}];
             fLeft = fLeft.map(p => rotateAroundAxis(p, {x:-hw,y:yBase,z:0}, {x:0,y:0,z:1}, -unfoldAngle));
             faces.push({ points: fLeft, color: cSide3, label: {text: 'Mặt bên'} });
        }

        // --- SORT & RENDER ---
        const facesWithDepth = faces.map(f => {
            const projected = f.points.map(p => project(p, cx, cy, scale));
            const z = projected.reduce((s, p) => s + p.z, 0) / projected.length;
            return { ...f, projected, z };
        });

        facesWithDepth.sort((a, b) => b.z - a.z); 

        return (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                <defs>
                    <filter id="solid-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.15"/>
                    </filter>
                </defs>
                {facesWithDepth.map((face, i) => (
                    <g key={i}>
                        <path 
                            d={`M ${face.projected.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')} Z`} 
                            fill={face.color} 
                            stroke={face.borderColor || "white"} 
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                            style={{ opacity: 0.9, filter: 'url(#solid-glow)' }}
                        />
                        {config.showLabels && face.label && (
                            <text 
                                x={project(face.label.pos || { // Centroid
                                    x: face.points.reduce((s,p)=>s+p.x,0)/face.points.length,
                                    y: face.points.reduce((s,p)=>s+p.y,0)/face.points.length,
                                    z: face.points.reduce((s,p)=>s+p.z,0)/face.points.length
                                }, cx, cy, scale).x} 
                                y={project(face.label.pos || {
                                    x: face.points.reduce((s,p)=>s+p.x,0)/face.points.length,
                                    y: face.points.reduce((s,p)=>s+p.y,0)/face.points.length,
                                    z: face.points.reduce((s,p)=>s+p.z,0)/face.points.length
                                }, cx, cy, scale).y} 
                                textAnchor="middle" 
                                dominantBaseline="middle" 
                                fontSize="12" 
                                fontWeight="bold" 
                                fill="#1e293b"
                                style={{ pointerEvents: 'none', textShadow: '0 2px 4px rgba(255,255,255,0.8)' }}
                            >
                                {face.label.text}
                            </text>
                        )}
                    </g>
                ))}
            </svg>
        );
    };

    return (
        <div className="flex h-full w-full bg-slate-50">
            {/* LEFT PANEL */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full z-10 shadow-lg">
                <div className="p-4 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Box className="text-orange-600" /> Triển khai 3D
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-1">Chọn hình và kéo thanh trượt để xem trải phẳng.</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                    {/* SHAPE SELECTOR */}
                    <div className="grid grid-cols-2 gap-3">
                        {SOLID_TYPES.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setConfig({ ...config, type: s.id as any })}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${config.type === s.id ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-100 bg-white text-slate-500 hover:border-orange-200'}`}
                            >
                                <s.icon size={24} />
                                <span className="text-[10px] font-bold mt-2 text-center">{s.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* SLIDER - UNFOLD */}
                    <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-700 uppercase">Mức độ mở</label>
                            <span className="text-xs font-bold text-orange-600">{config.unfoldProgress}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="100" step="1" 
                            value={config.unfoldProgress} 
                            onChange={e => setConfig({...config, unfoldProgress: parseInt(e.target.value)})}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
                            <span>Đóng (3D)</span>
                            <span>Mở (2D)</span>
                        </div>
                    </div>

                    {/* DIMENSION SLIDERS */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-100 pb-1">
                            <Settings2 size={12}/> Kích thước
                        </div>
                        
                        {config.type === 'prism' && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                                    <span>Số cạnh đáy (n)</span>
                                    <span>{config.numSides}</span>
                                </div>
                                <input 
                                    type="range" min="3" max="10" step="1"
                                    value={config.numSides}
                                    onChange={e => setConfig({...config, numSides: parseInt(e.target.value)})}
                                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                                <span>Rộng / Bán kính (a)</span>
                                <span>{config.dimA.toFixed(1)}</span>
                            </div>
                            <input 
                                type="range" min="0.5" max="3.5" step="0.1"
                                value={config.dimA}
                                onChange={e => setConfig({...config, dimA: parseFloat(e.target.value)})}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                            />
                        </div>

                        {(config.type === 'rectangular_prism') && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                                    <span>Sâu (b)</span>
                                    <span>{config.dimB.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" min="0.5" max="3.5" step="0.1"
                                    value={config.dimB}
                                    onChange={e => setConfig({...config, dimB: parseFloat(e.target.value)})}
                                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                                />
                            </div>
                        )}

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-600 font-bold">
                                <span>Cao (h)</span>
                                <span>{config.dimH.toFixed(1)}</span>
                            </div>
                            <input 
                                type="range" min="0.5" max="4" step="0.1"
                                value={config.dimH}
                                onChange={e => setConfig({...config, dimH: parseFloat(e.target.value)})}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer p-2 hover:bg-slate-50 rounded-lg">
                            <input type="checkbox" checked={config.showLabels} onChange={e => setConfig({...config, showLabels: e.target.checked})} className="accent-orange-600 w-4 h-4" />
                            Hiện tên các mặt
                        </label>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <button 
                        onClick={handleExport}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${isCopied ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}
                    >
                        {isCopied ? <Check size={18} /> : <Scissors size={18} />}
                        <span>{isCopied ? 'Đã lưu ảnh!' : 'Chụp ảnh hình vẽ'}</span>
                    </button>
                </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 overflow-hidden relative"
                 onMouseDown={handleMouseDown}
                 onMouseMove={handleMouseMove}
                 onMouseUp={handleMouseUp}
                 onMouseLeave={handleMouseUp}
            >
                <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-500 shadow-sm pointer-events-none flex items-center gap-2">
                    <Rotate3d size={14}/> <span>Giữ chuột trái và kéo để xoay</span>
                </div>

                <div 
                    ref={renderRef}
                    className="w-full h-full bg-white rounded-2xl shadow-xl border border-slate-200 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
                >
                    {renderSolid()}
                </div>
            </div>
        </div>
    );
};
