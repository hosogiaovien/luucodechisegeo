
import React, { useState, useRef, useEffect } from 'react';
import { Variable } from '../../types';
import { Plus, Trash2, Sliders, X, GripHorizontal, Play, Pause, RotateCcw } from 'lucide-react';

interface VariablePanelProps {
  variables: Variable[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateVariable: (id: string, updates: Partial<Variable>) => void;
  onAddVariable: () => void;
  onDeleteVariable: (id: string) => void;
  onToggleAnimation: (id: string, direction: 'forward' | 'backward' | 'stop') => void; // New Prop
}

export const VariablePanel: React.FC<VariablePanelProps> = ({ 
    variables, isOpen, onClose, onUpdateVariable, onAddVariable, onDeleteVariable, onToggleAnimation 
}) => {
  const [position, setPosition] = useState({ x: 80, y: 120 });
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
      if (panelRef.current) {
          isDragging.current = true;
          const rect = panelRef.current.getBoundingClientRect();
          dragOffset.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
          };
      }
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isDragging.current) {
              setPosition({
                  x: e.clientX - dragOffset.current.x,
                  y: e.clientY - dragOffset.current.y
              });
          }
      };

      const handleMouseUp = () => {
          isDragging.current = false;
      };

      if (isOpen) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
        ref={panelRef}
        className="fixed w-64 bg-white/95 backdrop-blur-xl shadow-xl rounded-xl border border-indigo-100 flex flex-col z-[100] animate-in zoom-in-95 duration-200 exclude-export"
        style={{ left: position.x, top: position.y }}
    >
        {/* Header - Compact */}
        <div 
            className="px-2 py-1.5 bg-slate-50 border-b border-indigo-50 flex items-center justify-between cursor-move select-none rounded-t-xl group"
            onMouseDown={handleMouseDown}
        >
            <div className="flex items-center gap-1.5 text-indigo-800 font-bold text-xs">
                <Sliders size={12} /> 
                <span className="uppercase text-[10px] tracking-wider">Tham số</span>
            </div>
            <div className="flex items-center">
                <GripHorizontal size={12} className="text-slate-300 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button 
                    onClick={onClose}
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition-colors"
                >
                    <X size={12} />
                </button>
            </div>
        </div>

        {/* Variables List */}
        <div className="p-2 flex flex-col gap-2 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {variables.length === 0 && (
                <div className="text-center py-4">
                    <p className="text-[10px] text-slate-400 mb-1">Chưa có tham số</p>
                    <button 
                        onClick={onAddVariable}
                        className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                    >
                        + Thêm
                    </button>
                </div>
            )}

            {variables.map(v => (
                <div key={v.id} className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm hover:border-indigo-200 transition-all">
                    {/* Top Row: Name = Value + Controls */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="flex items-center bg-indigo-50 rounded px-1.5 py-0.5 border border-indigo-100">
                            <input 
                                type="text" 
                                value={v.name}
                                onChange={(e) => onUpdateVariable(v.id, { name: e.target.value })}
                                className="w-6 bg-transparent text-xs font-bold text-indigo-700 outline-none text-center"
                                placeholder="a"
                            />
                        </div>
                        
                        <span className="text-slate-300 font-bold text-xs">=</span>

                        <input 
                            type="number" 
                            value={v.value}
                            onChange={(e) => onUpdateVariable(v.id, { value: parseFloat(e.target.value) })}
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400 text-right"
                            step={v.step}
                        />

                        {/* Animation Controls */}
                        <div className="flex items-center gap-0.5 bg-slate-100 rounded-md p-0.5">
                            {/* REPLAY (Run backwards) */}
                            <button 
                                onClick={() => onToggleAnimation(v.id, v.isPlaying && v.animationDirection === 'backward' ? 'stop' : 'backward')}
                                className={`p-1 rounded transition-all ${v.isPlaying && v.animationDirection === 'backward' ? 'bg-indigo-500 text-white' : 'hover:bg-white hover:text-indigo-600 text-slate-400'}`}
                                title="Chạy ngược"
                            >
                                {v.isPlaying && v.animationDirection === 'backward' ? <Pause size={10} fill="currentColor" /> : <RotateCcw size={10} />}
                            </button>
                            
                            {/* PLAY (Run forwards) */}
                            <button 
                                onClick={() => onToggleAnimation(v.id, v.isPlaying && v.animationDirection === 'forward' ? 'stop' : 'forward')}
                                className={`p-1 rounded transition-all ${v.isPlaying && v.animationDirection === 'forward' ? 'bg-indigo-500 text-white' : 'hover:bg-white hover:text-indigo-600 text-slate-400'}`}
                                title="Chạy xuôi"
                            >
                                {v.isPlaying && v.animationDirection === 'forward' ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                            </button>
                        </div>

                        <button 
                            onClick={() => onDeleteVariable(v.id)}
                            className="text-slate-300 hover:text-red-500 p-0.5 transition-colors"
                            title="Xóa"
                        >
                            <Trash2 size={10} />
                        </button>
                    </div>

                    {/* Slider Row */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[8px] text-slate-400 font-mono w-4 text-right">{v.min}</span>
                        <input 
                            type="range" 
                            min={v.min} max={v.max} step={v.step}
                            value={v.value}
                            onChange={(e) => onUpdateVariable(v.id, { value: parseFloat(e.target.value) })}
                            className="flex-1 h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
                        />
                        <span className="text-[8px] text-slate-400 font-mono w-4">{v.max}</span>
                    </div>

                    {/* Settings Details (Inline, very compact) */}
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50 gap-1">
                        <div className="flex gap-1 flex-1">
                            <input 
                                type="number" 
                                className="w-full bg-transparent text-[8px] text-slate-400 outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-400 text-center" 
                                value={v.min} 
                                onChange={e => onUpdateVariable(v.id, {min: parseFloat(e.target.value)})}
                                title="Min"
                            />
                            <input 
                                type="number" 
                                className="w-full bg-transparent text-[8px] text-slate-400 outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-400 text-center" 
                                value={v.max} 
                                onChange={e => onUpdateVariable(v.id, {max: parseFloat(e.target.value)})}
                                title="Max"
                            />
                            <input 
                                type="number" 
                                className="w-full bg-transparent text-[8px] text-slate-400 outline-none border-b border-transparent hover:border-slate-200 focus:border-indigo-400 text-center" 
                                value={v.step} 
                                onChange={e => onUpdateVariable(v.id, {step: parseFloat(e.target.value)})}
                                title="Bước nhảy"
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Footer Add Button */}
        {variables.length > 0 && (
            <div className="px-2 pb-2">
                <button 
                    onClick={onAddVariable}
                    className="w-full flex items-center justify-center gap-1 bg-slate-50 hover:bg-white border border-slate-200 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 py-1 rounded-lg text-[10px] font-bold transition-all"
                >
                    <Plus size={10} /> Thêm biến
                </button>
            </div>
        )}
    </div>
  );
};
