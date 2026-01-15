
import React, { useState, useEffect } from 'react';
import { MousePointer2, Dot, Minus, MoreHorizontal, EyeOff, Trash2, Type, GripHorizontal, Palette, PenLine, Eye, Pencil, Square, Hash, PaintBucket, LayoutGrid, Grid, Grip, CircleDot, PieChart, Moon, MoveLeft, MoveRight, ArrowLeftRight, LocateFixed, FunctionSquare, Image as ImageIcon, Scaling, RotateCw, Waves, Combine, Calculator } from 'lucide-react';
import { SelectionState, GeometryData, Point, FunctionGraph, ImageElement, Integral } from '../../types';
import { calculateAngle } from '../../utils/geometry';

interface SelectionToolbarProps {
  selectedElements: SelectionState[];
  batchUpdate: (updates: any) => void;
  batchDelete: () => void;
  onEdit: () => void; // Callback để mở khung sửa text
  data?: GeometryData;
  gridSize?: number; 
  onCreateIntegral?: (id1: string, id2: string) => void;
  onAngleValueChange?: (id: string, value: number) => void; // Callback cập nhật giá trị góc
}

// Bảng màu mở rộng
const PRESET_COLORS = [
  '#000000', // Đen
  '#4b5563', // Xám đậm
  '#dc2626', // Đỏ
  '#ea580c', // Cam đậm
  '#d97706', // Vàng nghệ
  '#16a34a', // Xanh lá
  '#0891b2', // Cyan
  '#2563eb', // Xanh dương
  '#7c3aed', // Tím
  '#db2777', // Hồng
  '#854d0e', // Nâu
];

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ selectedElements, batchUpdate, batchDelete, onEdit, data, gridSize = 50, onCreateIntegral, onAngleValueChange }) => {
  const [nameInput, setNameInput] = useState('');
  
  const [currentSize, setCurrentSize] = useState<number>(4);
  const [currentStroke, setCurrentStroke] = useState<number>(1.5);
  
  // Coordinate Inputs
  const [coordX, setCoordX] = useState<string>('0');
  const [coordY, setCoordY] = useState<string>('0');
  
  // Function Graph Input
  const [funcFormula, setFuncFormula] = useState<string>('');
  
  // Angle Value Input
  const [angleValue, setAngleValue] = useState<string>('');

  const singlePointSelected = selectedElements.length === 1 && selectedElements[0].type === 'point';
  const singleGraphSelected = selectedElements.length === 1 && selectedElements[0].type === 'functionGraph';
  const singleImageSelected = selectedElements.length === 1 && selectedElements[0].type === 'image';
  const twoGraphsSelected = selectedElements.length === 2 && selectedElements.every(el => el.type === 'functionGraph');
  
  const hasPointType = selectedElements.some(el => el.type === 'point');
  const hasLineType = selectedElements.some(el => ['segment', 'line', 'ray', 'circle', 'ellipse', 'arc', 'cylinder', 'cone', 'sphere', 'ellipticalArc', 'functionGraph', 'integral'].includes(el.type));
  const hasSegmentType = selectedElements.some(el => el.type === 'segment');
  const hasFillableType = selectedElements.some(el => ['polygon', 'circle', 'arc', 'ellipse', 'ellipticalArc', 'integral'].includes(el.type));
  const hasTextType = selectedElements.some(el => el.type === 'text');
  const hasAngleType = selectedElements.some(el => el.type === 'angle');
  const hasArcType = selectedElements.some(el => el.type === 'arc' || el.type === 'ellipticalArc');
  const hasIntegralType = selectedElements.some(el => el.type === 'integral');
  
  const singleAngleSelected = selectedElements.length === 1 && selectedElements[0].type === 'angle';

  // Lấy dữ liệu điểm đang chọn để hiển thị tọa độ
  let currentPoint: Point | undefined;
  if (singlePointSelected && data) {
      currentPoint = data.points.find(p => p.id === selectedElements[0].id);
  }
  
  // Lấy dữ liệu hàm số đang chọn
  let currentGraph: FunctionGraph | undefined;
  if (singleGraphSelected && data) {
      currentGraph = data.functionGraphs?.find(g => g.id === selectedElements[0].id);
  }

  // Lấy dữ liệu ảnh đang chọn
  let currentImage: ImageElement | undefined;
  if (singleImageSelected && data) {
      currentImage = data.images?.find(img => img.id === selectedElements[0].id);
  }
  
  // Lấy dữ liệu Integral
  let currentIntegral: Integral | undefined;
  if (hasIntegralType && selectedElements.length === 1 && data) {
      currentIntegral = data.integrals?.find(i => i.id === selectedElements[0].id);
  }

  // Lấy dữ liệu Góc đang chọn
  let currentAngle: any = null;
  if (singleAngleSelected && data) {
      currentAngle = data.angles.find(a => a.id === selectedElements[0].id);
  }

  // Effect để update input khi chọn điểm mới hoặc đồ thị mới
  useEffect(() => {
      setNameInput('');
      
      if (singlePointSelected && currentPoint) {
          const mathX = Math.round((currentPoint.x / gridSize) * 100) / 100;
          const mathY = Math.round((-currentPoint.y / gridSize) * 100) / 100;
          setCoordX(mathX.toString());
          setCoordY(mathY.toString());
      }
      
      if (singleGraphSelected && currentGraph) {
          setFuncFormula(currentGraph.formula);
      }

      if (singleAngleSelected && currentAngle && data) {
          const p1 = data.points.find(p => p.id === currentAngle.point1Id);
          const center = data.points.find(p => p.id === currentAngle.centerId);
          const p2 = data.points.find(p => p.id === currentAngle.point2Id);
          if (p1 && center && p2) {
              const deg = calculateAngle(p1, center, p2);
              setAngleValue(Math.round(deg).toString());
          }
      }
  }, [selectedElements, currentPoint, currentGraph, currentAngle, singlePointSelected, singleGraphSelected, singleAngleSelected, gridSize, data]);

  if (selectedElements.length === 0) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNameInput(e.target.value);
    batchUpdate({ label: e.target.value });
  };

  const handleCoordChange = (axis: 'x' | 'y', value: string) => {
      if (axis === 'x') setCoordX(value);
      else setCoordY(value);

      const numVal = parseFloat(value);
      if (!isNaN(numVal)) {
          if (axis === 'x') {
              batchUpdate({ x: numVal * gridSize });
          } else {
              // SVG Y is inverted
              batchUpdate({ y: -numVal * gridSize });
          }
      }
  }
  
  const handleFormulaChange = (value: string) => {
      setFuncFormula(value);
      batchUpdate({ formula: value });
  }

  const handleAngleValueSubmit = (e: React.ChangeEvent<HTMLInputElement>) => {
      setAngleValue(e.target.value);
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && onAngleValueChange && singleAngleSelected) {
          onAngleValueChange(selectedElements[0].id, val);
      }
  }

  const isAnyHidden = data && selectedElements.some(sel => {
     const collection = (data as any)[sel.type + 's'] || (data as any)['functionGraphs'] || (data as any)['images'] || (data as any)['integrals']; 
     if (Array.isArray(collection)) {
         const item = collection.find((i: any) => i.id === sel.id);
         return item && item.hidden;
     }
     return false;
  });

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-xl shadow-2xl rounded-3xl p-3 border border-indigo-100 flex flex-col gap-3 z-40 animate-in slide-in-from-bottom-5 max-w-[95vw] exclude-export">
      
      {/* Hàng 1: Các công cụ chính */}
      <div className="flex items-center gap-4 px-2">
        <div className="pr-4 border-r border-slate-200">
            <span className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-2">
            <MousePointer2 size={16} className="text-indigo-600" />
            {selectedElements.length}
            </span>
        </div>

        {/* Create Intersection Area Button */}
        {twoGraphsSelected && onCreateIntegral && (
            <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                <button 
                    onClick={() => onCreateIntegral(selectedElements[0].id, selectedElements[1].id)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
                >
                    <Combine size={14} />
                    Tô vùng giao
                </button>
            </div>
        )}

        {/* Nút Sửa Text (QUAN TRỌNG) */}
        {hasTextType && (
            <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                <button 
                    onClick={onEdit}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
                >
                    <Pencil size={14} />
                    Sửa nội dung
                </button>
            </div>
        )}
        
        {/* Sửa Công Thức Đồ Thị */}
        {singleGraphSelected && (
            <div className="flex items-center gap-2 border-r pr-4 border-slate-200 w-48">
                <FunctionSquare size={16} className="text-slate-400 flex-shrink-0" />
                <span className="text-[9px] font-bold text-slate-400">f(x)=</span>
                <input 
                    type="text" 
                    value={funcFormula}
                    onChange={(e) => handleFormulaChange(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-indigo-700 focus:outline-none focus:border-indigo-500"
                    placeholder="sin(x)..."
                />
            </div>
        )}

        {/* SỬA ẢNH (Kích thước & Opacity) */}
        {singleImageSelected && currentImage && (
            <div className="flex items-center gap-3 border-r pr-4 border-slate-200">
                <div className="flex items-center gap-2">
                    <Scaling size={16} className="text-slate-400" />
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {Math.round(currentImage.width)} x {Math.round(currentImage.height)}
                    </span>
                </div>
                {/* Opacity Slider */}
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400">Mờ:</span>
                    <input 
                        type="range" min="0" max="1" step="0.1" 
                        value={currentImage.opacity !== undefined ? currentImage.opacity : 1}
                        onChange={(e) => batchUpdate({ opacity: parseFloat(e.target.value) })}
                        className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                    />
                </div>
                {/* Rotation Slider */}
                <div className="flex items-center gap-2">
                    <RotateCw size={14} className="text-slate-400" />
                    <input 
                        type="range" min="0" max="360" step="5" 
                        value={currentImage.rotation || 0}
                        onChange={(e) => batchUpdate({ rotation: parseFloat(e.target.value) })}
                        className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                        title={`Xoay: ${currentImage.rotation || 0}°`}
                    />
                </div>
            </div>
        )}

        {/* CÔNG CỤ CHỈNH SỬA GÓC */}
        {singleAngleSelected && currentAngle && (
             <div className="flex items-center gap-3 border-r pr-4 border-slate-200">
                 {/* Input Số đo độ */}
                 <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5" title="Thay đổi số đo độ">
                    <Calculator size={14} className="text-slate-400" />
                    <input 
                        type="number" 
                        value={angleValue}
                        onChange={handleAngleValueSubmit}
                        className="w-10 bg-transparent text-xs font-bold focus:outline-none text-right"
                    />
                    <span className="text-[10px] text-slate-400 font-serif">°</span>
                 </div>

                 {/* Nút Ẩn/Hiện Số đo (Toggle showLabel) */}
                 <button 
                    onClick={() => batchUpdate({ showLabel: !currentAngle.showLabel })}
                    className={`p-1.5 rounded-lg transition-all flex items-center gap-1 ${currentAngle.showLabel ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'text-slate-400 hover:bg-slate-50'}`}
                    title={currentAngle.showLabel ? "Ẩn số đo" : "Hiện số đo"}
                 >
                     {currentAngle.showLabel ? <Eye size={16} /> : <EyeOff size={16} />}
                 </button>

                 <div className="w-[1px] h-6 bg-slate-100"></div>

                 {/* Góc vuông */}
                 <button 
                    onClick={() => batchUpdate({ isRightAngle: !currentAngle?.isRightAngle, arcCount: 1, hasTick: false })}
                    className={`p-1.5 rounded-lg transition-all ${currentAngle?.isRightAngle ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}
                    title="Góc vuông"
                 >
                     <Square size={18} />
                 </button>

                 <div className="w-[1px] h-6 bg-slate-100"></div>

                 {/* Số lượng cung: 1, 2, 3 */}
                 <div className="flex bg-slate-100 rounded-lg p-0.5">
                     <button 
                        onClick={() => batchUpdate({ isRightAngle: false, arcCount: 1 })}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${!currentAngle?.isRightAngle && currentAngle?.arcCount === 1 ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                     >1</button>
                     <button 
                        onClick={() => batchUpdate({ isRightAngle: false, arcCount: 2 })}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${!currentAngle?.isRightAngle && currentAngle?.arcCount === 2 ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                     >2</button>
                     <button 
                        onClick={() => batchUpdate({ isRightAngle: false, arcCount: 3 })}
                        className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${!currentAngle?.isRightAngle && currentAngle?.arcCount === 3 ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                     >3</button>
                 </div>

                 <div className="w-[1px] h-6 bg-slate-100"></div>

                 {/* Gạch chéo */}
                 <button 
                    onClick={() => batchUpdate({ isRightAngle: false, hasTick: !currentAngle?.hasTick })}
                    className={`p-1.5 rounded-lg transition-all ${currentAngle?.hasTick ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100'}`}
                    title="Có gạch chéo"
                 >
                     <Hash size={18} />
                 </button>
             </div>
        )}

        {singlePointSelected && (
            <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                <Type size={16} className="text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Tên..." 
                    value={nameInput}
                    onChange={handleNameChange}
                    className="w-12 px-2 py-1 text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-slate-50"
                />
                
                {/* Coordinates Input */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5">
                    <span className="text-[9px] font-bold text-slate-400">x:</span>
                    <input 
                        type="number" 
                        value={coordX}
                        onChange={(e) => handleCoordChange('x', e.target.value)}
                        className="w-10 bg-transparent text-xs font-bold focus:outline-none text-right"
                    />
                </div>
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5">
                    <span className="text-[9px] font-bold text-slate-400">y:</span>
                    <input 
                        type="number" 
                        value={coordY}
                        onChange={(e) => handleCoordChange('y', e.target.value)}
                        className="w-10 bg-transparent text-xs font-bold focus:outline-none text-right"
                    />
                </div>

                <div className="w-[1px] h-6 bg-slate-100 mx-1"></div>

                {/* Projection Lines Toggle */}
                <button 
                    onClick={() => batchUpdate({ showCoordProj: !currentPoint?.showCoordProj })}
                    className={`p-1.5 rounded-lg transition-all ${currentPoint?.showCoordProj ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'text-slate-400 hover:bg-slate-50'}`}
                    title="Hiện nét gióng tọa độ"
                >
                    <LocateFixed size={16} />
                </button>
                {/* Projection Color Picker - Only show if active */}
                {currentPoint?.showCoordProj && (
                    <div className="relative group w-4 h-4">
                        <div className="w-full h-full rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: currentPoint.projColor || '#94a3b8' }}></div>
                        <input type="color" value={currentPoint.projColor || '#94a3b8'} onChange={(e) => batchUpdate({ projColor: e.target.value })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-auto z-10" title="Màu nét gióng" />
                    </div>
                )}
            </div>
        )}

        {hasPointType && !singlePointSelected && (
            <div className="flex items-center gap-2 border-r pr-4 border-slate-200 group relative">
                <Dot size={20} className="text-slate-500" />
                <div className="flex flex-col items-center">
                    <input 
                        type="range" min="2" max="10" step="0.5" defaultValue="4" 
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCurrentSize(val);
                            batchUpdate({ radius: val });
                        }} 
                        className="w-20 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                    />
                </div>
            </div>
        )}

        {(hasTextType || hasAngleType) && (
            <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                <span className="text-[10px] font-bold text-slate-400">Cỡ chữ</span>
                <input 
                    type="range" min="10" max="60" step="2" 
                    defaultValue={hasAngleType ? (currentAngle?.fontSize || 12) : 24} 
                    onChange={(e) => batchUpdate({ fontSize: parseInt(e.target.value) })} 
                    className="w-20 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                />
            </div>
        )}

        {(hasLineType || hasAngleType) && (
            <div className="flex items-center gap-3 border-r pr-4 border-slate-200">
                <div className="flex items-center gap-2">
                    <GripHorizontal size={18} className="text-slate-500" />
                    <input 
                        type="range" min="0.5" max="6" step="0.5" defaultValue="1.5" 
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCurrentStroke(val);
                            batchUpdate({ strokeWidth: val });
                        }} 
                        className="w-20 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                    />
                </div>
                
                {!hasAngleType && !hasIntegralType && (
                    <>
                    <div className="w-[1px] h-6 bg-slate-100"></div>
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button onClick={() => batchUpdate({ style: 'solid' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md transition-all" title="Nét liền"><Minus size={16} /></button>
                        <button onClick={() => batchUpdate({ style: 'dashed' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md transition-all" title="Nét đứt"><MoreHorizontal size={16} /></button>
                        <button onClick={() => batchUpdate({ style: 'dotted' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md transition-all" title="Nét chấm"><PenLine size={16} /></button>
                        
                        {/* New Line Styles */}
                        <button onClick={() => batchUpdate({ style: 'dashdot' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md transition-all" title="Gạch chấm">
                            <svg width="16" height="16" viewBox="0 0 16 16" className="stroke-current fill-none stroke-[2px]"><path d="M1,8 L6,8 M9,8 L9,8 M12,8 L15,8" strokeLinecap="round" /></svg>
                        </button>
                        <button onClick={() => batchUpdate({ style: 'longdash' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md transition-all" title="Gạch dài">
                            <svg width="16" height="16" viewBox="0 0 16 16" className="stroke-current fill-none stroke-[2px]"><path d="M1,8 L7,8 M10,8 L16,8" strokeLinecap="round" /></svg>
                        </button>
                    </div>
                    </>
                )}

                {hasSegmentType && (
                    <>
                    <div className="w-[1px] h-6 bg-slate-100"></div>
                    <div className="flex flex-col gap-1 items-center">
                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                            <button onClick={() => batchUpdate({ arrows: 'none' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Không mũi tên"><Minus size={16} /></button>
                            <button onClick={() => batchUpdate({ arrows: 'start' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Mũi tên đầu"><MoveLeft size={16} /></button>
                            <button onClick={() => batchUpdate({ arrows: 'end' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Mũi tên cuối"><MoveRight size={16} /></button>
                            <button onClick={() => batchUpdate({ arrows: 'both' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Hai đầu"><ArrowLeftRight size={16} /></button>
                        </div>
                        {/* Kích thước mũi tên */}
                        <div className="flex items-center gap-1">
                            <span className="text-[8px] font-bold text-slate-400 uppercase">Size:</span>
                            <div className="flex bg-slate-100 rounded-md p-0.5">
                                <button onClick={() => batchUpdate({ arrowSize: 1 })} className="px-1.5 py-0.5 text-[8px] font-bold hover:bg-white rounded hover:text-indigo-600 transition-all">S</button>
                                <button onClick={() => batchUpdate({ arrowSize: 2 })} className="px-1.5 py-0.5 text-[8px] font-bold hover:bg-white rounded hover:text-indigo-600 transition-all">M</button>
                                <button onClick={() => batchUpdate({ arrowSize: 3 })} className="px-1.5 py-0.5 text-[8px] font-bold hover:bg-white rounded hover:text-indigo-600 transition-all">L</button>
                            </div>
                        </div>
                    </div>
                    {/* MARKER SETTINGS - NEW */}
                    <div className="w-[1px] h-6 bg-slate-100 mx-1"></div>
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button onClick={() => batchUpdate({ marker: 'none' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Không đánh dấu"><Minus size={16} className="rotate-45" /></button>
                        <button onClick={() => batchUpdate({ marker: 'tick1' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md font-bold text-xs" title="1 gạch">|</button>
                        <button onClick={() => batchUpdate({ marker: 'tick2' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md font-bold text-xs" title="2 gạch">||</button>
                        <button onClick={() => batchUpdate({ marker: 'tick3' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md font-bold text-xs" title="3 gạch">|||</button>
                        <button onClick={() => batchUpdate({ marker: 'cross' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md font-bold text-xs" title="Dấu X">X</button>
                        <button onClick={() => batchUpdate({ marker: 'tickCross' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md font-bold text-xs" title="Gạch chéo">|X</button>
                    </div>
                    </>
                )}
            </div>
        )}
        
        {/* Fill Styles for selected items */}
        {hasFillableType && (
            <div className="flex items-center gap-2 border-r pr-4 border-slate-200">
                 <button onClick={() => batchUpdate({ fillStyle: 'none' })} className="p-1.5 hover:bg-white hover:text-red-500 rounded-md" title="Không tô"><Minus size={16} className="rotate-45"/></button>
                 <button onClick={() => batchUpdate({ fillStyle: 'solid' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Màu đặc"><PaintBucket size={16}/></button>
                 <button onClick={() => batchUpdate({ fillStyle: 'hatch' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Gạch chéo"><LayoutGrid size={16} className="rotate-45"/></button>
                 <button onClick={() => batchUpdate({ fillStyle: 'dots' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Chấm"><Grip size={16}/></button>
                 
                 {/* New Fills */}
                 <button onClick={() => batchUpdate({ fillStyle: 'grid' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Lưới"><Grid size={16}/></button>
                 <button onClick={() => batchUpdate({ fillStyle: 'zigzag' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Ziczac">
                    <svg width="16" height="16" viewBox="0 0 16 16" className="stroke-current fill-none stroke-[2px]"><path d="M2,10 L5,6 L8,10 L11,6 L14,10" /></svg>
                 </button>
                 <button onClick={() => batchUpdate({ fillStyle: 'bricks' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Gạch">
                    <svg width="16" height="16" viewBox="0 0 16 16" className="stroke-current fill-none stroke-[2px]"><path d="M2,4 L14,4 M2,8 L14,8 M2,12 L14,12 M6,4 L6,8 M10,8 L10,12" /></svg>
                 </button>
                 <button onClick={() => batchUpdate({ fillStyle: 'waves' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Sóng"><Waves size={16}/></button>

                 {hasArcType && (
                    <>
                        <div className="w-[1px] h-6 bg-slate-100 mx-1"></div>
                        <button onClick={() => batchUpdate({ fillMode: 'segment' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Viên phân (Segment)"><Moon size={16} className="rotate-90"/></button>
                        <button onClick={() => batchUpdate({ fillMode: 'sector' })} className="p-1.5 hover:bg-white hover:text-indigo-600 rounded-md" title="Hình quạt (Sector)"><PieChart size={16}/></button>
                    </>
                 )}
            </div>
        )}

        <div className="flex items-center gap-2">
            <button 
                onClick={() => batchUpdate({ hidden: !isAnyHidden })} 
                className={`p-2 rounded-xl transition-all ${isAnyHidden ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`} 
                title={isAnyHidden ? "Hiện đối tượng" : "Ẩn đối tượng"}
            >
                {isAnyHidden ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button onClick={batchDelete} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all" title="Xóa">
                <Trash2 size={18}/>
            </button>
        </div>
      </div>

      <div className="w-full h-[1px] bg-slate-100"></div>

      <div className="flex flex-col gap-1 px-2">
          {/* Stroke Color Picker */}
          {!hasIntegralType && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Palette size={16} className="text-slate-400 mr-2 flex-shrink-0" />
            <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Nét:</span>
            {PRESET_COLORS.map(c => (
                <button 
                    key={c} 
                    onClick={() => batchUpdate({ color: c })} 
                    className="w-5 h-5 rounded-full border border-slate-200 hover:scale-110 transition-transform shadow-sm flex-shrink-0" 
                    style={{ backgroundColor: c }} 
                    title={c}
                />
            ))}
            
            <div className="w-[1px] h-4 bg-slate-200 mx-1 flex-shrink-0"></div>
            
            <div className="relative group w-5 h-5">
                <input 
                    type="color" 
                    onChange={(e) => batchUpdate({ color: e.target.value })}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                />
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 border border-slate-200 shadow-sm flex items-center justify-center text-white text-[8px] font-bold group-hover:scale-110 transition-transform pointer-events-none">
                    +
                </div>
            </div>
          </div>
          )}

          {/* Fill Color Picker (Only if fillable) */}
          {hasFillableType && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide border-t border-slate-100 pt-1 mt-1">
                <PaintBucket size={16} className="text-slate-400 mr-2 flex-shrink-0" />
                <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Nền:</span>
                {PRESET_COLORS.map(c => (
                    <button 
                        key={`fill-${c}`} 
                        onClick={() => batchUpdate({ fillColor: c })} 
                        className="w-5 h-5 rounded-md border border-slate-200 hover:scale-110 transition-transform shadow-sm flex-shrink-0" 
                        style={{ backgroundColor: c }} 
                        title={`Nền: ${c}`}
                    />
                ))}
                
                <div className="w-[1px] h-4 bg-slate-200 mx-1 flex-shrink-0"></div>
                
                <div className="relative group w-5 h-5">
                    <input 
                        type="color" 
                        onChange={(e) => batchUpdate({ fillColor: e.target.value })}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                    />
                    <div className="w-full h-full rounded-md bg-gradient-to-br from-blue-400 to-emerald-400 border border-slate-200 shadow-sm flex items-center justify-center text-white text-[8px] font-bold group-hover:scale-110 transition-transform pointer-events-none">
                        +
                    </div>
                </div>

                <div className="w-[1px] h-4 bg-slate-200 mx-2 flex-shrink-0"></div>

                {/* Opacity Slider */}
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-400">Mờ:</span>
                    <input 
                        type="range" min="0" max="1" step="0.1" 
                        // Note: Using the first selected element's opacity as initial value
                        value={selectedElements.length > 0 && data ? ((data as any)[selectedElements[0].type + 's'] || data.integrals || []).find((el: any) => el.id === selectedElements[0].id)?.fillOpacity ?? 0.2 : 0.2}
                        onChange={(e) => batchUpdate({ fillOpacity: parseFloat(e.target.value) })}
                        className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                    />
                </div>
              </div>
          )}
      </div>

    </div>
  );
};
