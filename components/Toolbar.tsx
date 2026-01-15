
import React, { useState } from 'react';
import { ToolType, AppMode } from '../types';
import { 
  Grid, Undo2, MousePointer2, PaintBucket, Type, Move, Image as ImageIcon, Sliders, Hexagon, FlipHorizontal, Repeat, RotateCcw,
  BarChart3, Compass, Box
} from 'lucide-react';

interface ToolbarProps {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  onClear: () => void;
  onUndo: () => void;
  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  showAxes: boolean;
  setShowAxes: (show: boolean) => void;
  showVariables: boolean; 
  setShowVariables: (show: boolean) => void;
  appMode: AppMode; // NEW PROP
  setAppMode: (mode: AppMode) => void; // NEW PROP
}

// --- GEOGEBRA STYLE ICONS ---
// Custom SVG components to mimic the look and feel of GeoGebra tools
const GeoIcon = ({ type }: { type: ToolType }) => {
  const pointStyle = { fill: '#1565C0', stroke: 'none' }; // GeoGebra Blue Points
  const lineStyle = { stroke: '#333', strokeWidth: 2, fill: 'none' };
  const fillStyle = { fill: 'rgba(21, 101, 192, 0.2)', stroke: '#1565C0', strokeWidth: 2 };

  switch (type) {
    case ToolType.SELECT:
      return <MousePointer2 size={24} className="text-slate-700" />;
    
    case ToolType.SELECT_AREA:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <rect x="4" y="4" width="16" height="16" stroke="#1565C0" strokeWidth="2" fill="rgba(21, 101, 192, 0.1)" strokeDasharray="4,2" />
          <path d="M4,4 L9,9" stroke="#1565C0" strokeWidth="1" />
        </svg>
      );

    case ToolType.FILL:
      return <PaintBucket size={24} className="text-indigo-600" />;

    case ToolType.TEXT:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <text x="12" y="18" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#333">ABC</text>
        </svg>
      );
    
    case ToolType.IMAGE:
      return <ImageIcon size={24} className="text-pink-600" />;

    case ToolType.POINT:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <circle cx="12" cy="12" r="4" {...pointStyle} />
          <text x="16" y="8" fontSize="10" fill="#333" fontWeight="bold">A</text>
        </svg>
      );
    
    case ToolType.POINT_COORD:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="12" y1="4" x2="12" y2="20" stroke="#ccc" strokeWidth="1" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#ccc" strokeWidth="1" />
          <circle cx="16" cy="8" r="3.5" {...pointStyle} />
          <text x="8" y="20" fontSize="8" fill="#333" fontWeight="bold">(x,y)</text>
        </svg>
      );

    case ToolType.MIDPOINT:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="4" y1="20" x2="20" y2="4" stroke="#999" strokeWidth="2" />
          <circle cx="4" cy="20" r="2.5" fill="#1565C0" />
          <circle cx="20" cy="4" r="2.5" fill="#1565C0" />
          <circle cx="12" cy="12" r="3.5" fill="#D32F2F" /> {/* Red for midpoint */}
        </svg>
      );

    case ToolType.INTERSECT:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="4" y1="4" x2="20" y2="20" stroke="#333" strokeWidth="2" />
          <line x1="4" y1="20" x2="20" y2="4" stroke="#333" strokeWidth="2" />
          <circle cx="12" cy="12" r="3.5" fill="#D32F2F" />
        </svg>
      );

    case ToolType.SEGMENT:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="4" y1="18" x2="20" y2="6" stroke="#333" strokeWidth="2" />
          <circle cx="4" cy="18" r="3" {...pointStyle} />
          <circle cx="20" cy="6" r="3" {...pointStyle} />
        </svg>
      );
    
    case ToolType.SEGMENT_FIXED:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="4" y1="18" x2="20" y2="6" stroke="#333" strokeWidth="2" />
          <circle cx="4" cy="18" r="3" {...pointStyle} />
          <circle cx="20" cy="6" r="3" {...pointStyle} />
          <text x="14" y="20" fontSize="8" fill="#333" fontWeight="bold">cm</text>
        </svg>
      );

    case ToolType.LINE:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="2" y1="20" x2="22" y2="4" stroke="#333" strokeWidth="2" />
          <circle cx="7" cy="16" r="3" {...pointStyle} />
          <circle cx="17" cy="8" r="3" {...pointStyle} />
        </svg>
      );

    case ToolType.RAY:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="4" y1="18" x2="22" y2="6" stroke="#333" strokeWidth="2" />
          <circle cx="4" cy="18" r="3" {...pointStyle} />
          <circle cx="13" cy="12" r="2.5" {...pointStyle} />
        </svg>
      );

    case ToolType.PERPENDICULAR:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="4" y1="20" x2="20" y2="20" stroke="#333" strokeWidth="2" />
          <line x1="12" y1="20" x2="12" y2="4" stroke="#333" strokeWidth="2" />
          <path d="M12,16 L16,16 L16,20" fill="none" stroke="#666" strokeWidth="1" />
          <circle cx="12" cy="14" r="3" {...pointStyle} />
        </svg>
      );

    case ToolType.PARALLEL:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="4" y1="8" x2="20" y2="8" stroke="#333" strokeWidth="2" />
          <line x1="4" y1="16" x2="20" y2="16" stroke="#333" strokeWidth="2" />
          <circle cx="12" cy="16" r="3" {...pointStyle} />
        </svg>
      );

    case ToolType.POLYGON:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M12,4 L4,18 L20,18 Z" {...fillStyle} />
          <circle cx="12" cy="4" r="2.5" {...pointStyle} />
          <circle cx="4" cy="18" r="2.5" {...pointStyle} />
          <circle cx="20" cy="18" r="2.5" {...pointStyle} />
        </svg>
      );
    
    case ToolType.POLYGON_REGULAR:
      return <Hexagon size={24} className="text-indigo-600" />;

    case ToolType.CIRCLE:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <circle cx="12" cy="12" r="9" stroke="#333" strokeWidth="2" fill="none" />
          <circle cx="12" cy="12" r="3" {...pointStyle} />
          <circle cx="21" cy="12" r="2.5" {...pointStyle} />
        </svg>
      );
    
    case ToolType.CIRCLE_FIXED:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <circle cx="12" cy="12" r="9" stroke="#333" strokeWidth="2" fill="none" />
          <circle cx="12" cy="12" r="3" {...pointStyle} />
          <line x1="12" y1="12" x2="21" y2="12" stroke="#333" strokeWidth="1" strokeDasharray="2,1"/>
          <text x="14" y="10" fontSize="8" fill="#333" fontWeight="bold">r</text>
        </svg>
      );

    case ToolType.ARC:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M4,18 A10,10 0 0,1 20,18" stroke="#333" strokeWidth="2" fill="none" />
          <circle cx="12" cy="18" r="2.5" {...pointStyle} />
          <circle cx="4" cy="18" r="2.5" {...pointStyle} />
          <circle cx="20" cy="18" r="2.5" {...pointStyle} />
        </svg>
      );

    case ToolType.ELLIPSE:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <ellipse cx="12" cy="12" rx="10" ry="6" stroke="#333" strokeWidth="2" fill="none" />
          <circle cx="5" cy="12" r="2" {...pointStyle} />
          <circle cx="19" cy="12" r="2" {...pointStyle} />
        </svg>
      );

    case ToolType.ELLIPTICAL_ARC:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M2,12 A10,6 0 0,1 22,12" stroke="#333" strokeWidth="2" fill="none" />
          <circle cx="2" cy="12" r="2" {...pointStyle} />
          <circle cx="22" cy="12" r="2" {...pointStyle} />
        </svg>
      );
    
    case ToolType.FUNCTION_GRAPH:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M3,12 C6,12 6,4 12,12 C18,20 18,12 21,12" stroke="#1565C0" strokeWidth="2" fill="none" />
          <text x="16" y="8" fontSize="8" fill="#333" fontWeight="bold">f(x)</text>
        </svg>
      );

    case ToolType.ANGLE:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="18" y1="18" x2="6" y2="18" stroke="#333" strokeWidth="2" />
          <line x1="6" y1="18" x2="14" y2="6" stroke="#333" strokeWidth="2" />
          <path d="M10,18 A4,4 0 0,0 8.5,14" stroke="#1565C0" strokeWidth="2" fill="rgba(21, 101, 192, 0.2)" />
          <circle cx="6" cy="18" r="2.5" {...pointStyle} />
          <circle cx="18" cy="18" r="2.5" {...pointStyle} />
          <circle cx="14" cy="6" r="2.5" {...pointStyle} />
        </svg>
      );

    case ToolType.ANGLE_FIXED:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="18" y1="18" x2="6" y2="18" stroke="#333" strokeWidth="2" />
          <line x1="6" y1="18" x2="14" y2="6" stroke="#333" strokeWidth="2" />
          <path d="M10,18 A4,4 0 0,0 8.5,14" stroke="#1565C0" strokeWidth="2" fill="none" />
          <text x="14" y="14" fontSize="8" fill="#333" fontWeight="bold">α</text>
        </svg>
      );

    case ToolType.SPHERE:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <circle cx="12" cy="12" r="9" stroke="#1565C0" strokeWidth="1.5" fill="rgba(21, 101, 192, 0.1)" />
          <ellipse cx="12" cy="12" rx="9" ry="3" stroke="#1565C0" strokeWidth="1" fill="none" strokeDasharray="2,2" />
          <circle cx="12" cy="12" r="2" fill="#1565C0" />
        </svg>
      );

    case ToolType.CYLINDER:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <ellipse cx="12" cy="6" rx="8" ry="3" stroke="#1565C0" strokeWidth="1.5" fill="rgba(21, 101, 192, 0.1)" />
          <path d="M4,6 L4,18 A8,3 0 0,0 20,18 L20,6" stroke="#1565C0" strokeWidth="1.5" fill="rgba(21, 101, 192, 0.1)" />
          <path d="M4,18 A8,3 0 0,1 20,18" stroke="#1565C0" strokeWidth="1.5" strokeDasharray="3,2" fill="none" />
        </svg>
      );

    case ToolType.CONE:
      return (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M12,2 L4,18 A8,3 0 0,0 20,18 Z" stroke="#1565C0" strokeWidth="1.5" fill="rgba(21, 101, 192, 0.1)" />
          <path d="M4,18 A8,3 0 0,1 20,18" stroke="#1565C0" strokeWidth="1.5" strokeDasharray="3,2" fill="none" />
        </svg>
      );
    
    case ToolType.SYMMETRY_CENTRAL:
      return <Repeat size={24} className="text-indigo-600" />;
    
    case ToolType.SYMMETRY_AXIAL:
      return <FlipHorizontal size={24} className="text-indigo-600" />;
    
    case ToolType.ROTATE:
      return <RotateCcw size={24} className="text-indigo-600" />;

    default:
      return null;
  }
};

const Toolbar: React.FC<ToolbarProps> = ({ 
    activeTool, setActiveTool, onClear, onUndo, showGrid, setShowGrid, showAxes, setShowAxes,
    showVariables, setShowVariables, appMode, setAppMode
}) => {
  // State for managing the "hoisted" tooltip to avoid clipping issues in scrollable areas
  const [tooltip, setTooltip] = useState<{ text: string; top: number; left: number } | null>(null);

  const toolGroups = [
    {
      label: 'Cơ bản',
      items: [
        { type: ToolType.SELECT, label: 'Di chuyển' },
        { type: ToolType.POINT, label: 'Điểm mới' },
        { type: ToolType.POINT_COORD, label: 'Điểm (tọa độ)' }, 
        { type: ToolType.SEGMENT, label: 'Đoạn thẳng' },
        { type: ToolType.SEGMENT_FIXED, label: 'Đoạn thẳng (độ dài cố định)' }, 
        { type: ToolType.LINE, label: 'Đường thẳng' },
        { type: ToolType.POLYGON, label: 'Đa giác' },
        { type: ToolType.POLYGON_REGULAR, label: 'Đa giác đều' }, // NEW TOOL
        { type: ToolType.CIRCLE, label: 'Đường tròn (tâm & điểm)' },
        { type: ToolType.CIRCLE_FIXED, label: 'Đường tròn (biết bán kính)' }, 
        { type: ToolType.FUNCTION_GRAPH, label: 'Đồ thị hàm số' },
      ]
    },
    {
      label: 'Dựng hình',
      items: [
        { type: ToolType.MIDPOINT, label: 'Trung điểm' },
        { type: ToolType.PERPENDICULAR, label: 'Đường vuông góc' },
        { type: ToolType.PARALLEL, label: 'Đường song song' },
        { type: ToolType.INTERSECT, label: 'Giao điểm' },
        { type: ToolType.RAY, label: 'Tia đi qua 2 điểm' },
      ]
    },
    {
      label: 'Biến hình',
      items: [
        { type: ToolType.SYMMETRY_CENTRAL, label: 'Đối xứng qua tâm' },
        { type: ToolType.SYMMETRY_AXIAL, label: 'Đối xứng qua trục' },
        { type: ToolType.ROTATE, label: 'Phép quay' }, // NEW
      ]
    },
    {
      label: 'Đường Cong',
      items: [
        { type: ToolType.ARC, label: 'Cung tròn' },
        { type: ToolType.ELLIPSE, label: 'Elip' },
        { type: ToolType.ELLIPTICAL_ARC, label: 'Cung Elip' },
      ]
    },
    {
      label: 'Đo lường',
      items: [
        { type: ToolType.ANGLE, label: 'Góc' },
        { type: ToolType.ANGLE_FIXED, label: 'Góc với số đo cho trước' },
        { type: ToolType.TEXT, label: 'Chèn Văn bản' },
      ]
    },
    {
      label: 'Khối 3D',
      items: [
        { type: ToolType.SPHERE, label: 'Hình cầu' },
        { type: ToolType.CYLINDER, label: 'Hình trụ' },
        { type: ToolType.CONE, label: 'Hình nón' },
      ]
    },
    {
      label: 'Khác',
      items: [
        { type: ToolType.SELECT_AREA, label: 'Vùng chọn Xuất Hình' },
        { type: ToolType.FILL, label: 'Tô màu' },
        { type: ToolType.IMAGE, label: 'Chèn ảnh (Ctrl+V)' }, // Added Image Tool
      ]
    }
  ];

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, label: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      text: label,
      top: rect.top + rect.height / 2, // Center vertically relative to button
      left: rect.right + 12 // Position to the right of the button with some gap
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="bg-white border-r border-slate-200 w-[10.5rem] flex-shrink-0 flex flex-col shadow-sm z-30 h-full relative exclude-export">
      
      {/* MODE SWITCHER BUTTONS */}
      <div className="p-3 border-b border-slate-100 mb-2 flex flex-col gap-2">
          {/* GEOMETRY MODE */}
          <button
              onClick={() => setAppMode('GEOMETRY')}
              onMouseEnter={(e) => handleMouseEnter(e, "Chế độ Hình Học")}
              onMouseLeave={handleMouseLeave}
              className={`w-full h-10 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm border ${appMode === 'GEOMETRY' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}
          >
              <Compass size={20} />
              <span className="text-[10px] font-bold uppercase">Hình Học</span>
          </button>

          {/* CHART MODE */}
          <button
              onClick={() => setAppMode('CHART')}
              onMouseEnter={(e) => handleMouseEnter(e, "Chế độ Biểu Đồ")}
              onMouseLeave={handleMouseLeave}
              className={`w-full h-10 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm border ${appMode === 'CHART' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300'}`}
          >
              <BarChart3 size={20} />
              <span className="text-[10px] font-bold uppercase">Biểu Đồ</span>
          </button>

          {/* SOLIDS MODE (NEW) */}
          <button
              onClick={() => setAppMode('SOLIDS')}
              onMouseEnter={(e) => handleMouseEnter(e, "Triển khai Hình 3D")}
              onMouseLeave={handleMouseLeave}
              className={`w-full h-10 rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm border ${appMode === 'SOLIDS' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-500 border-slate-200 hover:border-orange-300'}`}
          >
              <Box size={20} />
              <span className="text-[10px] font-bold uppercase">3D Solids</span>
          </button>
      </div>

      {appMode === 'GEOMETRY' ? (
        <>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-2">
                <div className="flex flex-col gap-6">
                    {toolGroups.map((group, gIdx) => (
                        <div key={gIdx} className="flex flex-col gap-2 relative">
                            {/* Group Label */}
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 border-b border-slate-50 pb-1 mb-1">
                                {group.label}
                            </h3>
                            {/* Items Grid - Changed to 3 columns */}
                            <div className="grid grid-cols-3 gap-x-2 gap-y-2 place-items-center">
                                {group.items.map((tool) => (
                                <button
                                    key={tool.type}
                                    onClick={() => setActiveTool(tool.type)}
                                    onMouseEnter={(e) => handleMouseEnter(e, tool.label)}
                                    onMouseLeave={handleMouseLeave}
                                    className={`w-10 h-10 rounded-lg transition-all duration-200 flex items-center justify-center relative group z-10 border ${
                                    activeTool === tool.type
                                        ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 shadow-sm'
                                        : 'bg-white border-transparent hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <GeoIcon type={tool.type} />
                                </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer Controls */}
            <div className="mt-auto p-2 pb-4 bg-white border-t border-slate-100 pt-3">
                <div className="grid grid-cols-2 gap-2 relative place-items-center">
                    
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        onMouseEnter={(e) => handleMouseEnter(e, "Bật/Tắt lưới")}
                        onMouseLeave={handleMouseLeave}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all z-10 border ${showGrid ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Grid size={20} />
                    </button>
                    
                    <button
                        onClick={() => setShowAxes(!showAxes)}
                        onMouseEnter={(e) => handleMouseEnter(e, "Bật/Tắt Hệ trục tọa độ")}
                        onMouseLeave={handleMouseLeave}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all z-10 border ${showAxes ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Move size={20} />
                    </button>

                    <button
                        onClick={() => setShowVariables(!showVariables)}
                        onMouseEnter={(e) => handleMouseEnter(e, "Bảng biến số / Tham số")}
                        onMouseLeave={handleMouseLeave}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all z-10 border ${showVariables ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Sliders size={20} />
                    </button>

                    <button
                        onClick={onUndo}
                        onMouseEnter={(e) => handleMouseEnter(e, "Hoàn tác (Ctrl+Z)")}
                        onMouseLeave={handleMouseLeave}
                        className="w-10 h-10 rounded-lg flex items-center justify-center transition-all bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 z-10 hover:shadow-sm"
                    >
                        <Undo2 size={20} />
                    </button>
                </div>
            </div>
        </>
      ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              {appMode === 'CHART' ? <BarChart3 size={48} className="mb-2 opacity-20" /> : <Box size={48} className="mb-2 opacity-20" />}
              <p className="text-xs font-bold text-slate-300 uppercase">
                  {appMode === 'CHART' ? 'Trình biên tập Biểu đồ' : 'Mô phỏng Hình Không Gian'}
              </p>
          </div>
      )}

      {/* FIXED TOOLTIP PORTAL */}
      {tooltip && (
        <div 
            className="fixed z-[9999] px-3 py-1.5 bg-slate-800 text-white text-[12px] font-medium rounded-md pointer-events-none shadow-xl transition-opacity animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap"
            style={{ 
                top: tooltip.top, 
                left: tooltip.left, 
                transform: 'translateY(-50%)' 
            }}
        >
            <div className="absolute top-1/2 -left-1 w-2 h-2 bg-slate-800 rotate-45 -translate-y-1/2" />
            {tooltip.text}
        </div>
      )}
    </div>
  );
};

export default Toolbar;
