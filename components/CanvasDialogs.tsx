
import React, { useRef, useEffect } from 'react';
import { X, Check, RotateCcw, RotateCw } from 'lucide-react';
import { renderLatex } from '../utils/geometry';

interface CanvasDialogsProps {
  dialogType: 'angle' | 'segment' | 'point_coord' | 'circle_fixed' | 'function_graph' | 'polygon_regular' | 'rotate_angle' | null;
  setDialogType: (type: 'angle' | 'segment' | 'point_coord' | 'circle_fixed' | 'function_graph' | 'polygon_regular' | 'rotate_angle' | null) => void;
  inputValue1: string;
  setInputValue1: (val: string) => void;
  inputValue2: string;
  setInputValue2: (val: string) => void;
  inputAngleDirection: 'ccw' | 'cw';
  setInputAngleDirection: (dir: 'ccw' | 'cw') => void;
  onAngleSubmit: () => void;
  onSegmentSubmit: () => void;
  onCircleFixedSubmit: () => void;
  onFunctionGraphSubmit: () => void;
  onPointCoordSubmit: () => void;
  onPolygonRegularSubmit: () => void;
  onRotateAngleSubmit: () => void; // New
}

// Math Symbols for Function Graph Dialog
const FUNC_SYMBOLS = [
  { icon: 'x', insert: 'x', tooltip: 'Biến x' },
  { icon: 'x^2', insert: '^2', tooltip: 'Bình phương' },
  { icon: 'x^n', insert: '^', tooltip: 'Lũy thừa' },
  { icon: '\\sqrt{x}', insert: 'sqrt(', tooltip: 'Căn bậc 2' },
  { icon: '\\frac{1}{x}', insert: '1/x', tooltip: 'Phân số' },
  { icon: '\\sin(x)', insert: 'sin(', tooltip: 'Sin' },
  { icon: '\\cos(x)', insert: 'cos(', tooltip: 'Cos' },
  { icon: '\\tan(x)', insert: 'tan(', tooltip: 'Tan' },
  { icon: '\\ln(x)', insert: 'ln(', tooltip: 'Logarit tự nhiên' },
  { icon: '|x|', insert: 'abs(', tooltip: 'Giá trị tuyệt đối' },
  { icon: '\\pi', insert: 'pi', tooltip: 'Pi' },
  { icon: 'e', insert: 'e', tooltip: 'Số e' },
];

export const CanvasDialogs: React.FC<CanvasDialogsProps> = ({
  dialogType, setDialogType,
  inputValue1, setInputValue1,
  inputValue2, setInputValue2,
  inputAngleDirection, setInputAngleDirection,
  onAngleSubmit, onSegmentSubmit, onCircleFixedSubmit, onFunctionGraphSubmit, onPointCoordSubmit, onPolygonRegularSubmit, onRotateAngleSubmit
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialogType === 'function_graph') {
        setTimeout(() => { if(inputRef.current) inputRef.current.focus(); }, 100);
    }
  }, [dialogType]);

  const insertFuncSymbol = (val: string) => {
      const input = inputRef.current;
      if (input) {
          const start = input.selectionStart || 0;
          const end = input.selectionEnd || 0;
          const newValue = inputValue1.substring(0, start) + val + inputValue1.substring(end);
          setInputValue1(newValue);
          setTimeout(() => {
              input.focus();
              input.setSelectionRange(start + val.length, start + val.length);
          }, 10);
      } else {
          setInputValue1(inputValue1 + val);
      }
  }

  if (!dialogType) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-2xl border border-indigo-100 p-4 z-50 animate-in zoom-in-95 w-64 exclude-export">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
            {dialogType === 'angle' && "Nhập số đo góc"}
            {dialogType === 'segment' && "Độ dài đoạn thẳng"}
            {dialogType === 'point_coord' && "Tọa độ điểm"}
            {dialogType === 'circle_fixed' && "Bán kính đường tròn"}
            {dialogType === 'function_graph' && "Nhập công thức hàm số"}
            {dialogType === 'polygon_regular' && "Đa giác đều"}
            {dialogType === 'rotate_angle' && "Góc quay (độ hoặc tên biến)"}
            <button onClick={() => setDialogType(null)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
        </h3>
        
        <div className="space-y-3">
            {dialogType === 'angle' && (
            <>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2">
                    <input 
                        type="number" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} 
                        className="w-full bg-transparent p-2 text-sm font-bold outline-none" autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && onAngleSubmit()}
                    />
                    <span className="text-slate-400 font-serif">°</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setInputAngleDirection('ccw')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition-all ${inputAngleDirection === 'ccw' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}> <RotateCcw size={16} /> Ngược chiều </button>
                    <button onClick={() => setInputAngleDirection('cw')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition-all ${inputAngleDirection === 'cw' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'}`}> <RotateCw size={16} /> Cùng chiều </button>
                </div>
                <button onClick={onAngleSubmit} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"> <Check size={16} /> Tạo góc </button>
            </>
            )}

            {dialogType === 'rotate_angle' && (
            <>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2">
                    <input 
                        type="text" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} 
                        className="w-full bg-transparent p-2 text-sm font-bold outline-none" autoFocus 
                        placeholder="45 hoặc a"
                        onKeyDown={(e) => e.key === 'Enter' && onRotateAngleSubmit()}
                    />
                    <span className="text-slate-400 font-serif">°</span>
                </div>
                <p className="text-[10px] text-slate-400 italic">Nhập số (VD: 90) hoặc tên biến (VD: alpha)</p>
                <button onClick={onRotateAngleSubmit} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"> <Check size={16} /> Xác nhận </button>
            </>
            )}

            {dialogType === 'segment' && (
            <>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2">
                    <input 
                        type="number" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} 
                        className="w-full bg-transparent p-2 text-sm font-bold outline-none" autoFocus placeholder="5"
                        onKeyDown={(e) => e.key === 'Enter' && onSegmentSubmit()}
                    />
                    <span className="text-slate-400 font-bold text-xs">cm</span>
                </div>
                <button onClick={onSegmentSubmit} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"> <Check size={16} /> Tạo đoạn thẳng </button>
            </>
            )}

            {dialogType === 'circle_fixed' && (
            <>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2">
                    <input 
                        type="number" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} 
                        className="w-full bg-transparent p-2 text-sm font-bold outline-none" autoFocus placeholder="3"
                        onKeyDown={(e) => e.key === 'Enter' && onCircleFixedSubmit()}
                    />
                    <span className="text-slate-400 font-bold text-xs">cm</span>
                </div>
                <button onClick={onCircleFixedSubmit} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"> <Check size={16} /> Tạo đường tròn </button>
            </>
            )}

            {dialogType === 'function_graph' && (
            <>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2">
                    <span className="text-slate-400 font-bold text-xs italic">f(x)=</span>
                    <input 
                        ref={inputRef}
                        type="text" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} 
                        className="w-full bg-transparent p-2 text-sm font-bold outline-none font-mono text-indigo-700" 
                        placeholder="sin(x)..."
                        onKeyDown={(e) => e.key === 'Enter' && onFunctionGraphSubmit()}
                    />
                </div>
                
                {/* Math Symbols Palette */}
                <div className="grid grid-cols-4 gap-1 mt-2">
                    {FUNC_SYMBOLS.map((s, i) => (
                        <button
                            key={i}
                            className="h-8 rounded bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center transition-all"
                            onClick={() => insertFuncSymbol(s.insert)}
                            title={s.tooltip}
                            tabIndex={-1} // Prevent focus loss
                        >
                            <span dangerouslySetInnerHTML={{ __html: renderLatex(s.icon) }} />
                        </button>
                    ))}
                </div>

                <button onClick={onFunctionGraphSubmit} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 mt-2"> <Check size={16} /> Vẽ đồ thị </button>
            </>
            )}

            {dialogType === 'point_coord' && (
            <>
                <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2">
                        <span className="text-slate-400 font-bold text-xs">x =</span>
                        <input 
                            type="number" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} 
                            className="w-full bg-transparent p-2 text-sm font-bold outline-none" autoFocus placeholder="0"
                        />
                    </div>
                    <div className="flex-1 flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2">
                        <span className="text-slate-400 font-bold text-xs">y =</span>
                        <input 
                            type="number" value={inputValue2} onChange={(e) => setInputValue2(e.target.value)} 
                            className="w-full bg-transparent p-2 text-sm font-bold outline-none" placeholder="0"
                            onKeyDown={(e) => e.key === 'Enter' && onPointCoordSubmit()}
                        />
                    </div>
                </div>
                <button onClick={onPointCoordSubmit} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"> <Check size={16} /> Tạo điểm </button>
            </>
            )}

            {dialogType === 'polygon_regular' && (
            <>
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Số cạnh (n)</label>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-2">
                            <input 
                                type="number" min="3" value={inputValue1} onChange={(e) => setInputValue1(e.target.value)} 
                                className="w-full bg-transparent p-2 text-sm font-bold outline-none" autoFocus placeholder="5"
                            />
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Cạnh (cm)</label>
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-2">
                            <input 
                                type="number" value={inputValue2} onChange={(e) => setInputValue2(e.target.value)} 
                                className="w-full bg-transparent p-2 text-sm font-bold outline-none" placeholder="3"
                                onKeyDown={(e) => e.key === 'Enter' && onPolygonRegularSubmit()}
                            />
                        </div>
                    </div>
                </div>
                <button onClick={onPolygonRegularSubmit} className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"> <Check size={16} /> Tạo đa giác </button>
            </>
            )}
        </div>
    </div>
  );
};
