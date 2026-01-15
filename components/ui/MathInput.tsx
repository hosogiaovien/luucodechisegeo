
import React, { useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { TextEntry, ElementColor } from '../../types';
import { renderLatex } from '../../utils/geometry';

interface MathInputProps {
  textEntry: TextEntry;
  setTextEntry: (val: TextEntry | null) => void;
  onComplete: () => void;
}

const MATH_SYMBOLS = [
  // Cấu trúc cơ bản
  { icon: '\\frac{\\square}{\\square}', insert: '\\frac{a}{b}', tooltip: 'Phân số' },
  { icon: '\\sqrt{\\square}', insert: '\\sqrt{x}', tooltip: 'Căn bậc 2' },
  { icon: '\\sqrt[n]{\\square}', insert: '\\sqrt[n]{x}', tooltip: 'Căn bậc n' },
  { icon: '\\square^2', insert: '^{2}', tooltip: 'Mũ bình phương' },
  { icon: '\\square_n', insert: '_{n}', tooltip: 'Chỉ số dưới' },
  
  // Hình học
  { icon: '\\widehat{ABC}', insert: '\\widehat{ABC}', tooltip: 'Góc' },
  { icon: '\\vec{v}', insert: '\\vec{v}', tooltip: 'Vector' },
  { icon: '^\\circ', insert: '^\\circ', tooltip: 'Độ' },
  { icon: '\\triangle', insert: '\\triangle', tooltip: 'Tam giác' },
  { icon: '\\angle', insert: '\\angle', tooltip: 'Góc (Ký hiệu)' },
  { icon: '\\perp', insert: '\\perp', tooltip: 'Vuông góc' },
  { icon: '\\parallel', insert: '\\parallel', tooltip: 'Song song' },

  // Quan hệ
  { icon: '=', insert: '=', tooltip: 'Bằng' }, 
  { icon: '\\neq', insert: '\\neq', tooltip: 'Khác' }, 
  { icon: '\\approx', insert: '\\approx', tooltip: 'Xấp xỉ' }, 
  { icon: '\\le', insert: '\\le', tooltip: 'Nhỏ hơn hoặc bằng' }, 
  { icon: '\\ge', insert: '\\ge', tooltip: 'Lớn hơn hoặc bằng' }, 
  { icon: '\\pm', insert: '\\pm', tooltip: 'Cộng trừ' },

  // Logic & Tập hợp
  { icon: '\\Rightarrow', insert: '\\Rightarrow', tooltip: 'Suy ra' }, 
  { icon: '\\Leftrightarrow', insert: '\\Leftrightarrow', tooltip: 'Tương đương' },
  { icon: '\\in', insert: '\\in', tooltip: 'Thuộc' }, 
  { icon: '\\subset', insert: '\\subset', tooltip: 'Con của' }, 
  
  // Ký tự đặc biệt
  { icon: '\\pi', insert: '\\pi', tooltip: 'Pi' }, 
  { icon: '\\infty', insert: '\\infty', tooltip: 'Vô cực' },
  { icon: '\\alpha', insert: '\\alpha', tooltip: 'Alpha' }, 
  { icon: '\\beta', insert: '\\beta', tooltip: 'Beta' }, 
  { icon: '\\Omega', insert: '\\Omega', tooltip: 'Omega' },
  
  // Hệ phương trình
  { icon: '\\begin{cases} x \\\\ y \\end{cases}', insert: '\\begin{cases} x \\\\ y \\end{cases}', tooltip: 'Hệ phương trình' }
];

export const MathInput: React.FC<MathInputProps> = ({ textEntry, setTextEntry, onComplete }) => {
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textInputRef.current) {
      textInputRef.current.focus();
      if (textEntry.id) textInputRef.current.select();
    }
  }, [textEntry.id]);

  const insertSymbol = (val: string) => {
    const input = textInputRef.current;
    if (input) {
       const start = input.selectionStart || 0;
       const end = input.selectionEnd || 0;
       const newValue = textEntry.value.substring(0, start) + val + textEntry.value.substring(end);
       setTextEntry({ ...textEntry, value: newValue });
       setTimeout(() => {
           input.focus();
           // Thông minh: đặt con trỏ vào giữa cặp ngoặc {} đầu tiên nếu có
           const firstBrace = val.indexOf('{');
           if (firstBrace !== -1) {
               const newCursorPos = start + firstBrace + 1;
               input.setSelectionRange(newCursorPos, newCursorPos);
           } else {
               input.setSelectionRange(start + val.length, start + val.length);
           }
       }, 10);
    }
  };

  return (
    <div 
        className="symbol-popup absolute z-50"
        style={{ left: textEntry.screenX, top: textEntry.screenY }}
    >
        <div className="bg-white rounded-xl shadow-2xl border border-indigo-200 p-2 flex flex-col gap-2 w-[320px] animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2">
                <input
                    ref={textInputRef}
                    type="text"
                    value={textEntry.value}
                    onChange={(e) => setTextEntry({ ...textEntry, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') onComplete(); if (e.key === 'Escape') setTextEntry(null); }}
                    onBlur={(e) => { if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest('.symbol-panel')) onComplete(); }}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Nhập LaTeX..."
                    autoFocus
                />
                <button onClick={onComplete} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md"><Check size={16} /></button>
            </div>

            <div className="flex items-center justify-between px-1 symbol-panel">
                <div className="flex gap-1">
                    {(['black', '#ef4444', '#3b82f6', '#10b981'] as ElementColor[]).map(c => (
                        <button key={c} onClick={() => setTextEntry({ ...textEntry, color: c })} className={`w-5 h-5 rounded-full border border-slate-200 ${textEntry.color === c ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`} style={{ backgroundColor: c }} />
                    ))}
                </div>
                <div className="flex items-center gap-1 bg-slate-100 rounded px-1">
                    <span className="text-[10px] font-bold text-slate-500 px-1">Size</span>
                    <input type="range" min="14" max="60" step="2" value={textEntry.fontSize} onChange={(e) => setTextEntry({ ...textEntry, fontSize: parseInt(e.target.value) })} className="w-16 h-1" />
                </div>
            </div>
            
            <div className="symbol-panel bg-slate-50 rounded-lg border border-slate-100 p-2">
                <div className="grid grid-cols-6 gap-1.5 max-h-[160px] overflow-y-auto">
                    {MATH_SYMBOLS.map((s, i) => (
                        <button
                            key={i}
                            className={`h-8 rounded hover:bg-white hover:shadow hover:text-indigo-600 text-xs font-medium text-slate-700 flex items-center justify-center transition-all border border-transparent hover:border-slate-200 bg-white shadow-sm ${s.tooltip.length > 10 ? 'col-span-2' : ''}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertSymbol(s.insert)}
                            title={s.tooltip}
                        >
                            <span dangerouslySetInnerHTML={{ __html: renderLatex(s.icon) }} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};
