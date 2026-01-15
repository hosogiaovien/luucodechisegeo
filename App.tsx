
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import InputPanel from './components/InputPanel';
import { GeometryData, ToolType, LineStyle, FillStyle, Variable, CanvasHandle, AppMode } from './types';
import { Copy, Check, MousePointerSquareDashed, MousePointer2, Minus, MoreHorizontal, GripHorizontal, CircleDot, Type, Eye, EyeOff, Moon, Grid, PaintBucket, LayoutGrid, Grip, AlignJustify, PieChart, MoveRight, ArrowLeftRight, MoveLeft, PanelRightOpen, PanelRightClose, Calculator, Waves, PenLine } from 'lucide-react';
import { generateId } from './utils/geometry';
import { VariablePanel } from './components/ui/VariablePanel';
import { ChartEditor } from './components/ChartEditor'; 
import { SolidsEditor } from './components/SolidsEditor'; // NEW IMPORT

const INITIAL_DATA: GeometryData = {
  points: [],
  segments: [],
  lines: [],
  rays: [],
  polygons: [],
  circles: [],
  ellipses: [],
  angles: [],
  texts: [],
  variables: []
};

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('GEOMETRY');
  const [geometryData, setGeometryData] = useState<GeometryData>(INITIAL_DATA);
  const [history, setHistory] = useState<GeometryData[]>([INITIAL_DATA]);
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.SELECT);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(false); 
  const [showVariables, setShowVariables] = useState(false); 
  const [gridSize, setGridSize] = useState(50);
  const [isCopied, setIsCopied] = useState(false);
  const [showHidden, setShowHidden] = useState(false); 
  
  const [globalStrokeWidth, setGlobalStrokeWidth] = useState<number>(1.5); 
  const [globalPointSize, setGlobalPointSize] = useState<number>(4); 
  const [globalLineStyle, setGlobalLineStyle] = useState<LineStyle>('solid');
  const [globalFillStyle, setGlobalFillStyle] = useState<FillStyle>('none'); 
  const [globalFillColor, setGlobalFillColor] = useState<string>('#4f46e5'); 
  const [globalArrowStyle, setGlobalArrowStyle] = useState<'none' | 'start' | 'end' | 'both'>('none');

  const [autoLabelPoints, setAutoLabelPoints] = useState<boolean>(true);
  const [arcModeMajor, setArcModeMajor] = useState<boolean>(false);
  const [arcFillMode, setArcFillMode] = useState<'segment' | 'sector'>('segment'); 
  
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsPanelOpen(false);
    }
  }, []);

  const canvasRef = useRef<CanvasHandle>(null);

  const updateGeometry = useCallback((newData: GeometryData | ((prev: GeometryData) => GeometryData)) => {
    setGeometryData(prev => {
        let next = typeof newData === 'function' ? newData(prev) : newData;
        
        next = {
            ...INITIAL_DATA,
            ...next,
            points: next.points || [],
            segments: next.segments || [],
            lines: next.lines || [],
            rays: next.rays || [],
            polygons: next.polygons || [],
            circles: next.circles || [],
            ellipses: next.ellipses || [],
            angles: next.angles || [],
            texts: next.texts || [],
            arcs: next.arcs || [],
            variables: next.variables || []
        };

        if (JSON.stringify(next) !== JSON.stringify(prev)) {
            setHistory(h => [...h.slice(-29), next]);
        }
        return next;
    });
  }, []);

  // --- ANIMATION LOOP ---
  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
        setGeometryData(prev => {
            if (!prev.variables || !prev.variables.some(v => v.isPlaying)) {
                return prev;
            }

            const nextVariables = prev.variables.map(v => {
                if (!v.isPlaying) return v;

                let nextValue = v.value;
                if (v.animationDirection === 'backward') {
                    nextValue -= v.step;
                    if (nextValue <= v.min) {
                        nextValue = v.min;
                        v.isPlaying = false;
                    }
                } else {
                    nextValue += v.step;
                    if (nextValue >= v.max) {
                        nextValue = v.max;
                        v.isPlaying = false;
                    }
                }
                nextValue = Math.round(nextValue * 1000) / 1000;
                return { ...v, value: nextValue, isPlaying: v.isPlaying };
            });

            return { ...prev, variables: nextVariables };
        });

        animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleUndo = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const prevState = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setGeometryData(prevState);
    }
  };

  const handleClear = () => {
    if (window.confirm("Xóa toàn bộ bản vẽ?")) {
      updateGeometry(INITIAL_DATA);
      if (canvasRef.current) canvasRef.current.resetSelection();
    }
  };

  const handleCopy = async () => {
      if (canvasRef.current) {
          await canvasRef.current.copyToClipboard();
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      }
  };

  const handleAddVariable = () => {
      updateGeometry(prev => {
          const nextVarName = String.fromCharCode(97 + (prev.variables?.length || 0)); 
          const newVar: Variable = {
              id: generateId('var'),
              name: nextVarName,
              value: 1,
              min: -10,
              max: 10,
              step: 0.1
          };
          return { ...prev, variables: [...(prev.variables || []), newVar] };
      });
  };

  const handleUpdateVariable = (id: string, updates: Partial<Variable>) => {
      updateGeometry(prev => ({
          ...prev,
          variables: (prev.variables || []).map(v => v.id === id ? { ...v, ...updates } : v)
      }));
  };

  const handleDeleteVariable = (id: string) => {
      updateGeometry(prev => ({
          ...prev,
          variables: (prev.variables || []).filter(v => v.id !== id)
      }));
  };

  const handleToggleAnimation = (id: string, direction: 'forward' | 'backward' | 'stop') => {
      updateGeometry(prev => ({
          ...prev,
          variables: (prev.variables || []).map(v => {
              if (v.id === id) {
                  if (direction === 'stop') return { ...v, isPlaying: false };
                  return { ...v, isPlaying: true, animationDirection: direction };
              }
              return v;
          })
      }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            handleUndo();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  return (
    <div className="flex h-screen w-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 overflow-hidden text-slate-900 relative">
      <Toolbar 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
        onClear={handleClear}
        onUndo={handleUndo}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showAxes={showAxes}
        setShowAxes={setShowAxes}
        showVariables={showVariables}
        setShowVariables={setShowVariables}
        appMode={appMode} 
        setAppMode={setAppMode} 
      />

      {/* MAIN CONTENT AREA */}
      {appMode === 'CHART' ? (
          <div className="flex-1 w-full h-full relative">
              <ChartEditor />
          </div>
      ) : appMode === 'SOLIDS' ? (
          <div className="flex-1 w-full h-full relative">
              <SolidsEditor />
          </div>
      ) : (
          /* GEOMETRY MODE (Existing Content) */
          <>
            <div className="flex-1 relative flex flex-col min-w-0"> 
                {/* HEADER (Only for Geometry) */}
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-white/50 flex items-center px-2 sm:px-4 shadow-sm z-20 justify-between gap-2 sm:gap-4 exclude-export">
                    {/* BRANDING */}
                    <a 
                    href="https://www.facebook.com/hungquoc9" 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer group flex-shrink-0"
                    title="Ghé thăm Facebook Quốc Hưng"
                    >
                        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
                            H
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-[10px] sm:text-xs font-bold text-slate-700 leading-none">Quốc Hưng</span>
                            <h1 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-purple-700 text-[10px] sm:text-xs leading-none mt-0.5">GeoPro</h1>
                        </div>
                    </a>
                    
                    {/* SCROLLABLE SETTINGS CONTAINER */}
                    <div className="flex-1 overflow-x-auto scrollbar-hide mask-fade-sides min-w-0">
                        <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap px-2">
                            
                            {/* TOOL SPECIFIC SETTINGS */}
                            {(activeTool === ToolType.POLYGON || activeTool === ToolType.CIRCLE || activeTool === ToolType.ARC || activeTool === ToolType.ELLIPTICAL_ARC || activeTool === ToolType.FILL || activeTool === ToolType.ELLIPSE) && (
                                <div className="flex items-center gap-2 bg-white border border-indigo-100 rounded-xl px-2 py-1.5 shadow-sm">
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase ml-1 mr-1">Kiểu:</span>
                                    
                                    <button onClick={() => setGlobalFillStyle('none')} className={`p-1.5 rounded-lg transition-all ${globalFillStyle === 'none' ? 'bg-indigo-50 shadow text-red-500' : 'text-slate-400 hover:text-red-500'}`} title="Không tô"><Minus size={16} className="rotate-45" /></button>
                                    <button onClick={() => setGlobalFillStyle('solid')} className={`p-1.5 rounded-lg transition-all ${globalFillStyle === 'solid' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-indigo-600'}`} title="Màu đặc"><PaintBucket size={16} /></button>
                                    
                                    <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>

                                    <button onClick={() => setGlobalFillStyle('hatch')} className={`p-1.5 rounded-lg transition-all ${globalFillStyle === 'hatch' ? 'bg-indigo-50 shadow text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}><LayoutGrid size={16} className="rotate-45"/></button>
                                    <button onClick={() => setGlobalFillStyle('grid')} className={`p-1.5 rounded-lg transition-all ${globalFillStyle === 'grid' ? 'bg-indigo-50 shadow text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}><Grid size={16} /></button>
                                    <button onClick={() => setGlobalFillStyle('zigzag')} className={`p-1.5 rounded-lg transition-all ${globalFillStyle === 'zigzag' ? 'bg-indigo-50 shadow text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`}><span className="text-[10px] font-bold">Z</span></button>
                                    
                                    <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                                    
                                    {/* Color Picker for Fill */}
                                    <div className="relative group cursor-pointer w-5 h-5">
                                        <div className="w-full h-full rounded-full shadow-sm border border-slate-200" style={{ backgroundColor: globalFillColor }}></div>
                                        <input type="color" value={globalFillColor} onChange={(e) => setGlobalFillColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Màu nền" />
                                    </div>
                                </div>
                            )}

                            {/* ARROW SETTINGS FOR SEGMENT */}
                            {activeTool === ToolType.SEGMENT && (
                                <div className="flex items-center gap-2 bg-white border border-indigo-100 rounded-xl px-2 py-1.5 shadow-sm">
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase ml-1">Mũi tên:</span>
                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                        <button onClick={() => setGlobalArrowStyle('none')} className={`p-1.5 rounded-md transition-all ${globalArrowStyle === 'none' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><Minus size={16} /></button>
                                        <button onClick={() => setGlobalArrowStyle('end')} className={`p-1.5 rounded-md transition-all ${globalArrowStyle === 'end' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><MoveRight size={16} /></button>
                                        <button onClick={() => setGlobalArrowStyle('both')} className={`p-1.5 rounded-md transition-all ${globalArrowStyle === 'both' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><ArrowLeftRight size={16} /></button>
                                    </div>
                                </div>
                            )}

                            {(activeTool === ToolType.ARC || activeTool === ToolType.ELLIPTICAL_ARC) && (
                                <div className="flex items-center gap-2 bg-white border border-indigo-100 rounded-xl px-3 py-1.5 shadow-sm">
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Cung:</span>
                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                        <button onClick={() => setArcModeMajor(false)} className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${!arcModeMajor ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Nhỏ</button>
                                        <button onClick={() => setArcModeMajor(true)} className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${arcModeMajor ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>Lớn</button>
                                    </div>
                                    <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                                        <button onClick={() => setArcFillMode('segment')} className={`p-1.5 rounded-md ${arcFillMode === 'segment' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`} title="Viên phân"><Moon size={14} className="rotate-90" /></button>
                                        <button onClick={() => setArcFillMode('sector')} className={`p-1.5 rounded-md ${arcFillMode === 'sector' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`} title="Hình quạt"><PieChart size={14} /></button>
                                    </div>
                                </div>
                            )}

                            {/* GENERAL SETTINGS */}
                            <div className="flex items-center gap-3 bg-white/80 border border-white rounded-xl px-3 py-1.5 shadow-sm">
                                <div className={`flex items-center gap-2 transition-opacity ${showGrid ? 'opacity-100' : 'opacity-30 pointer-events-none'}`} title="Lưới">
                                    <Grid size={14} className="text-slate-400"/>
                                    <input type="range" min="20" max="100" step="10" value={gridSize} onChange={(e) => setGridSize(parseFloat(e.target.value))} className="w-12 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                </div>

                                <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>

                                <button onClick={() => setShowHidden(!showHidden)} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${showHidden ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-100'}`}>
                                    {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>

                                <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>

                                <button onClick={() => setAutoLabelPoints(!autoLabelPoints)} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${autoLabelPoints ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-100'}`} title="Tên điểm">
                                    <Type size={16} />
                                    <div className={`w-1.5 h-1.5 rounded-full ${autoLabelPoints ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                </button>

                                <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
                                
                                {/* Size & Stroke */}
                                <div className="flex items-center gap-2">
                                    <CircleDot size={14} className="text-slate-400"/>
                                    <input type="range" min="2" max="8" step="0.5" value={globalPointSize} onChange={(e) => setGlobalPointSize(parseFloat(e.target.value))} className="w-12 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" title="Kích thước điểm" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <GripHorizontal size={14} className="text-slate-400"/>
                                    <input type="range" min="0.5" max="5" step="0.5" value={globalStrokeWidth} onChange={(e) => setGlobalStrokeWidth(parseFloat(e.target.value))} className="w-12 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" title="Độ dày nét" />
                                </div>

                                <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>

                                <div className="flex bg-slate-100 rounded-lg p-0.5">
                                    <button onClick={() => setGlobalLineStyle('solid')} className={`p-1 rounded-md transition-all ${globalLineStyle === 'solid' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><Minus size={16} /></button>
                                    <button onClick={() => setGlobalLineStyle('dashed')} className={`p-1 rounded-md transition-all ${globalLineStyle === 'dashed' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><MoreHorizontal size={16} /></button>
                                    <button onClick={() => setGlobalLineStyle('dotted')} className={`p-1 rounded-md transition-all ${globalLineStyle === 'dotted' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><PenLine size={16} /></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACTION BUTTONS (Right Side) */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Export Button - Visible on all screens now */}
                        <button 
                            onClick={handleCopy}
                            className={`flex items-center gap-2 px-2 py-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 border border-white/20 ${
                                isCopied ? 'bg-emerald-500 text-white' : 'bg-slate-900 hover:bg-black text-white'
                            }`}
                            title="Sao chép ảnh vào Clipboard (Smart Crop)"
                        >
                            {isCopied ? <Check size={18} /> : <MousePointerSquareDashed size={18} />}
                            <span className="hidden xl:inline">{isCopied ? 'Đã chép' : 'Xuất'}</span>
                        </button>

                        {/* Panel Toggle Button */}
                        <button 
                            onClick={() => setIsPanelOpen(!isPanelOpen)}
                            className={`p-2 rounded-xl border transition-all active:scale-95 shadow-sm ${
                                isPanelOpen 
                                ? 'bg-indigo-600 text-white border-indigo-600' 
                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                            title={isPanelOpen ? "Đóng bảng AI" : "Mở bảng vẽ AI"}
                        >
                            {isPanelOpen ? <PanelRightOpen size={20} /> : <Calculator size={20} />}
                        </button>
                    </div>
                </header>

                <Canvas 
                ref={canvasRef}
                data={geometryData} 
                setData={updateGeometry} 
                activeTool={activeTool}
                showGrid={showGrid}
                showAxes={showAxes} 
                currentStrokeWidth={globalStrokeWidth}
                currentPointSize={globalPointSize}
                currentLineStyle={globalLineStyle}
                currentFillStyle={globalFillStyle}
                currentFillColor={globalFillColor} 
                autoLabelPoints={autoLabelPoints}
                showHidden={showHidden}
                arcModeMajor={arcModeMajor} 
                gridSize={gridSize}
                arcFillMode={arcFillMode} 
                currentArrowStyle={globalArrowStyle}
                onToolChange={setActiveTool} // Pass setActiveTool here
                />
                
                {/* Variable Manager Overlay */}
                <div className="exclude-export">
                    <VariablePanel 
                        variables={geometryData.variables || []}
                        isOpen={showVariables} // Use state from Toolbar
                        onClose={() => setShowVariables(false)}
                        onAddVariable={handleAddVariable}
                        onUpdateVariable={handleUpdateVariable}
                        onDeleteVariable={handleDeleteVariable}
                        onToggleAnimation={handleToggleAnimation} // Pass the handler
                    />
                </div>
            </div>

            <div className="exclude-export">
                <InputPanel 
                    setGeometryData={updateGeometry} 
                    isOpen={isPanelOpen} 
                    onClose={() => setIsPanelOpen(false)} 
                />
            </div>
          </>
      )}
    </div>
  );
};

export default App;
