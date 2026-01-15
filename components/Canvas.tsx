
import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState, useCallback } from 'react';
import { CanvasHandle, GeometryData, ToolType, SelectionState, LineStyle, FillStyle } from '../types';
import { useCanvas } from '../hooks/useCanvas';
import GridLayer from './GridLayer';
import { GeometryLayer } from './GeometryLayer';
import { CanvasOverlay } from './CanvasOverlay';
import { SelectionToolbar } from './ui/SelectionToolbar';
import { CanvasDialogs } from './CanvasDialogs';
import { MathInput } from './ui/MathInput';
import { CanvasDefinitions } from './CanvasDefinitions';
import { Maximize, MousePointer2 } from 'lucide-react';

interface CanvasProps {
  data: GeometryData;
  setData: (data: GeometryData | ((prev: GeometryData) => GeometryData)) => void;
  activeTool: ToolType;
  showGrid: boolean;
  showAxes: boolean;
  currentStrokeWidth: number;
  currentPointSize: number;
  currentLineStyle: LineStyle;
  currentFillStyle: FillStyle;
  currentFillColor: string;
  autoLabelPoints: boolean;
  showHidden: boolean;
  arcModeMajor: boolean;
  gridSize: number;
  arcFillMode: 'segment' | 'sector';
  currentArrowStyle: 'none' | 'start' | 'end' | 'both';
  onToolChange?: (tool: ToolType) => void; 
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>((props, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [viewSize, setViewSize] = useState({ width: 1000, height: 800 });

    useEffect(() => {
        const updateSize = () => {
            if (wrapperRef.current) {
                setViewSize({
                    width: wrapperRef.current.clientWidth,
                    height: wrapperRef.current.clientHeight
                });
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const {
        pan, zoom, mousePos,
        activePoints, selectionBox, selectionStart,
        selectedElements, setSelectedElements,
        textEntry, setTextEntry,
        dialogType, setDialogType,
        dialogValues, setDialogValues,
        hoveredElement,
        exportBox, // NEW
        handleMouseDown, handleMouseMove, handleMouseUp,
        handleWheel,
        handleCopy, resetSelection, startEditingText,
        onResizeHandleMouseDown,
        setDraggedLabelId, setDraggedFunctionLabelId,
        handleDoubleClickText,
        batchUpdateElement, batchDeleteElement,
        handleAngleUpdate,
        submitDialogs,
        createIntegral,
        insertImage,
        setDraggedIds,
        resetView,
        // New exports for cursor logic
        isPanning,
        isSpacePressed
    } = useCanvas(svgRef, props);

    // --- Image Tool Handling ---
    useEffect(() => {
        if (props.activeTool === ToolType.IMAGE && fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, [props.activeTool]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            insertImage(e.target.files[0]);
            if (props.onToolChange) props.onToolChange(ToolType.SELECT);
        }
        e.target.value = '';
    };

    // --- Global Paste for Image ---
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        insertImage(file);
                        e.preventDefault(); 
                        if (props.onToolChange) props.onToolChange(ToolType.SELECT);
                        return;
                    }
                }
            }
        };
        
        const el = wrapperRef.current;
        if (el) {
            el.addEventListener('paste', handlePaste);
        }
        return () => {
            if (el) el.removeEventListener('paste', handlePaste);
        };
    }, [insertImage, props.onToolChange]);


    useImperativeHandle(ref, () => ({
        resetSelection,
        copyToClipboard: handleCopy,
        startEditingText
    }));

    // Cursor Logic
    const getCursorClass = () => {
        if (isPanning) return 'cursor-grabbing';
        if (isSpacePressed) return 'cursor-grab';
        
        switch (props.activeTool) {
            case ToolType.FILL:
                return 'cursor-fill';
            case ToolType.MIDPOINT:
            case ToolType.PERPENDICULAR:
            case ToolType.PARALLEL:
            case ToolType.INTERSECT:
                return 'cursor-pointer'; // Finger pointer
            case ToolType.SELECT_AREA:
                return 'cursor-crosshair';
            default:
                return 'cursor-default';
        }
    };

    return (
        <div ref={wrapperRef} className={`relative w-full h-full overflow-hidden bg-white select-none outline-none ${getCursorClass()}`} tabIndex={0}>
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
             />

             <div className="exclude-export">
                 <CanvasDialogs 
                     dialogType={dialogType}
                     setDialogType={setDialogType}
                     inputValue1={dialogValues.v1}
                     setInputValue1={(v) => setDialogValues(prev => ({...prev, v1: v}))}
                     inputValue2={dialogValues.v2}
                     setInputValue2={(v) => setDialogValues(prev => ({...prev, v2: v}))}
                     inputAngleDirection={dialogValues.angleDir}
                     setInputAngleDirection={(v) => setDialogValues(prev => ({...prev, angleDir: v}))}
                     onAngleSubmit={submitDialogs.onAngleSubmit}
                     onSegmentSubmit={submitDialogs.onSegmentSubmit}
                     onCircleFixedSubmit={submitDialogs.onCircleFixedSubmit}
                     onFunctionGraphSubmit={submitDialogs.onFunctionGraphSubmit}
                     onPointCoordSubmit={submitDialogs.onPointCoordSubmit}
                     onPolygonRegularSubmit={submitDialogs.onPolygonRegularSubmit}
                     onRotateAngleSubmit={submitDialogs.onRotateAngleSubmit}
                 />

                 {textEntry && (
                     <MathInput 
                         textEntry={textEntry} 
                         setTextEntry={setTextEntry} 
                         onComplete={() => {
                             if (textEntry.value.trim() !== '') {
                                 submitDialogs.onTextSubmit(textEntry);
                             } else {
                                 setTextEntry(null);
                             }
                         }} 
                     />
                 )}
                 
                 <SelectionToolbar 
                     selectedElements={selectedElements}
                     batchUpdate={batchUpdateElement}
                     batchDelete={batchDeleteElement}
                     onEdit={startEditingText}
                     data={props.data}
                     gridSize={props.gridSize}
                     onAngleValueChange={handleAngleUpdate}
                     onCreateIntegral={createIntegral}
                 />

                 {/* Zoom and Hint Overlay */}
                 <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2 pointer-events-none z-30">
                    <button 
                        onClick={resetView}
                        className="pointer-events-auto flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95"
                        title="Đặt lại góc nhìn về trung tâm"
                    >
                        <Maximize size={14} />
                        {Math.round(zoom * 100)}%
                    </button>
                    <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg text-[10px] font-bold text-white">
                        <MousePointer2 size={12} />
                        <span>Space + Drag để di chuyển</span>
                    </div>
                 </div>
             </div>

             <svg 
                ref={svgRef} 
                width="100%" 
                height="100%"
                className="touch-none block outline-none" 
                onMouseDown={handleMouseDown} 
                onMouseMove={handleMouseMove} 
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
                tabIndex={0}
             >
                <CanvasDefinitions data={props.data} showHidden={props.showHidden} />
                
                <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                    <GridLayer 
                        pan={pan} zoom={zoom} 
                        width={viewSize.width} height={viewSize.height}
                        gridSize={props.gridSize} 
                        visible={props.showGrid} 
                        showAxes={props.showAxes}
                    />

                    <GeometryLayer 
                        data={props.data}
                        activeTool={props.activeTool}
                        selectedElements={selectedElements}
                        activePoints={activePoints}
                        hoveredElement={hoveredElement}
                        pan={pan} zoom={zoom} viewSize={viewSize}
                        gridSize={props.gridSize}
                        onResizeHandleMouseDown={onResizeHandleMouseDown}
                        onSelectionChange={(sel, dragged) => {
                             setSelectedElements(sel);
                             if (dragged) {
                                 setDraggedIds(dragged.map(d => d.id));
                             }
                        }}
                        setDraggedLabelId={setDraggedLabelId}
                        setDraggedFunctionLabelId={setDraggedFunctionLabelId}
                        handleDoubleClickText={handleDoubleClickText}
                    />

                    <CanvasOverlay 
                        activeTool={props.activeTool}
                        activePoints={activePoints}
                        data={props.data}
                        mousePos={mousePos}
                        selectionBox={selectionBox}
                        selectionStart={selectionStart}
                        arcModeMajor={props.arcModeMajor}
                        arcFillMode={props.arcFillMode}
                        zoom={zoom}
                        exportBox={exportBox} // NEW
                    />
                </g>
             </svg>
        </div>
    );
});

export default Canvas;
