
import React, { useState, useRef, useMemo } from 'react';
import { ChartConfig, ChartDataPoint, ChartType, PatternType } from '../types';
import { BarChart3, PieChart, LineChart, Plus, Trash2, Scissors, Check, Crop, MousePointer2 } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'];

const PATTERNS: { id: PatternType, label: string }[] = [
    { id: 'none', label: 'Không (Màu đặc)' },
    { id: 'hatch', label: 'Gạch chéo (Phải)' },
    { id: 'hatch-cross', label: 'Caro (Chéo)' },
    { id: 'dots', label: 'Chấm bi' },
    { id: 'lines-vertical', label: 'Sọc dọc' },
    { id: 'lines-horizontal', label: 'Sọc ngang' },
    { id: 'grid', label: 'Lưới vuông' },
    { id: 'lines-diagonal-right', label: 'Sọc chéo phải' }, 
    { id: 'lines-diagonal-left', label: 'Sọc chéo trái' },
];

const DEFAULT_CONFIG: ChartConfig = {
    title: 'Biểu đồ thống kê',
    xAxisLabel: 'Danh mục',
    yAxisLabel: 'Giá trị',
    type: 'column',
    series: [
        { id: 's1', label: 'Chuỗi 1', color: COLORS[6], pattern: 'none' }
    ],
    data: [
        { id: '1', label: 'A', values: [10], color: COLORS[0], pattern: 'none' },
        { id: '2', label: 'B', values: [25], color: COLORS[1], pattern: 'none' },
        { id: '3', label: 'C', values: [15], color: COLORS[2], pattern: 'none' },
        { id: '4', label: 'D', values: [30], color: COLORS[3], pattern: 'none' },
    ],
    showValues: true,
    showLegend: true,
    barWidth: 0.6,
    startFromZero: true,
    gridLines: true
};

export const ChartEditor: React.FC = () => {
    const [config, setConfig] = useState<ChartConfig>(DEFAULT_CONFIG);
    const [isCopied, setIsCopied] = useState(false);
    
    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    const chartRef = useRef<HTMLDivElement>(null);

    // --- ACTIONS ---

    const addSeries = () => {
        const nextId = `s${Date.now()}`;
        const nextColor = COLORS[(config.series.length + 2) % COLORS.length];
        setConfig(prev => ({
            ...prev,
            series: [...prev.series, { id: nextId, label: `Chuỗi ${prev.series.length + 1}`, color: nextColor, pattern: 'none' }],
            data: prev.data.map(d => ({ ...d, values: [...d.values, 0] }))
        }));
    };

    const removeSeries = (index: number) => {
        if (config.series.length <= 1) return;
        setConfig(prev => ({
            ...prev,
            series: prev.series.filter((_, i) => i !== index),
            data: prev.data.map(d => ({ ...d, values: d.values.filter((_, i) => i !== index) }))
        }));
    };

    const updateSeries = (index: number, field: keyof typeof config.series[0], value: any) => {
        setConfig(prev => ({
            ...prev,
            series: prev.series.map((s, i) => i === index ? { ...s, [field]: value } : s)
        }));
    };

    const addDataPoint = () => {
        const nextId = Date.now().toString();
        const nextColor = COLORS[config.data.length % COLORS.length];
        const newValues = new Array(config.series.length).fill(10);
        
        setConfig(prev => ({
            ...prev,
            data: [...prev.data, { id: nextId, label: 'Mới', values: newValues, color: nextColor, pattern: 'none' }]
        }));
    };

    const removeDataPoint = (id: string) => {
        setConfig(prev => ({
            ...prev,
            data: prev.data.filter(d => d.id !== id)
        }));
    };

    const updateDataPoint = (id: string, field: keyof ChartDataPoint, value: any) => {
        setConfig(prev => ({
            ...prev,
            data: prev.data.map(d => d.id === id ? { ...d, [field]: value } : d)
        }));
    };

    const updateDataValue = (pointId: string, seriesIndex: number, value: number) => {
        setConfig(prev => ({
            ...prev,
            data: prev.data.map(d => {
                if (d.id === pointId) {
                    const newValues = [...d.values];
                    newValues[seriesIndex] = value;
                    return { ...d, values: newValues };
                }
                return d;
            })
        }));
    };

    // --- MOUSE HANDLERS FOR SELECTION ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isSelectionMode || !chartRef.current) return;
        const rect = chartRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setSelectionStart({ x, y });
        setSelectionBox({ x, y, width: 0, height: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isSelectionMode || !selectionStart || !chartRef.current) return;
        const rect = chartRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        setSelectionBox({
            x: Math.min(selectionStart.x, currentX),
            y: Math.min(selectionStart.y, currentY),
            width: Math.abs(currentX - selectionStart.x),
            height: Math.abs(currentY - selectionStart.y)
        });
    };

    const handleMouseUp = () => {
        setSelectionStart(null);
    };

    const handleExport = async () => {
        if (chartRef.current) {
            try {
                let options: any = { 
                    backgroundColor: 'rgba(0,0,0,0)', 
                    pixelRatio: 3, 
                    filter: (node: any) => {
                        // Exclude buttons and selection overlay from screenshot
                        if (node.tagName === 'BUTTON') return false;
                        if (node.classList && node.classList.contains('selection-overlay')) return false;
                        return true;
                    }
                };

                // Use Selection Box Crop if active and valid
                if (isSelectionMode && selectionBox && selectionBox.width > 5 && selectionBox.height > 5) {
                    options.width = selectionBox.width;
                    options.height = selectionBox.height;
                    options.style = {
                        transform: `translate(${-selectionBox.x}px, ${-selectionBox.y}px)`,
                        width: chartRef.current.scrollWidth + 'px', 
                        height: chartRef.current.scrollHeight + 'px'
                    };
                }

                const blob = await htmlToImage.toBlob(chartRef.current, options);
                
                if (blob) {
                    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                }
            } catch (e) {
                console.error("Export failed", e);
                alert("Lỗi khi sao chép ảnh. Vui lòng thử lại.");
            }
        }
    };

    // --- RENDER HELPERS ---

    const getFillId = (pattern: PatternType, color: string) => {
        if (pattern === 'none' || !pattern) return undefined;
        const safeColor = color.replace(/[^a-z0-9]/gi, '');
        return `chart-pattern-${pattern}-${safeColor}`;
    };

    const getFillStyle = (pattern: PatternType, color: string) => {
        if (!pattern || pattern === 'none' || pattern === 'solid') return color;
        return `url(#${getFillId(pattern, color)})`;
    };

    const wrapText = (text: string, maxChars: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            if (currentLine.length + 1 + words[i].length <= maxChars) {
                currentLine += ' ' + words[i];
            } else {
                lines.push(currentLine);
                currentLine = words[i];
            }
        }
        lines.push(currentLine);
        return lines;
    };

    const calculateNiceScale = (maxValue: number) => {
        if (maxValue === 0) return { max: 10, step: 2 };
        
        const tickCount = 6; 
        let step = maxValue / tickCount;
        const mag = Math.pow(10, Math.floor(Math.log10(step)));
        const normalizedStep = step / mag;
        
        let niceStep;
        if (normalizedStep < 1.5) niceStep = 1;
        else if (normalizedStep < 3) niceStep = 2; 
        else if (normalizedStep < 7) niceStep = 5;
        else niceStep = 10;

        step = niceStep * mag;
        const max = Math.ceil(maxValue / step) * step;
        
        return { max, step };
    };

    const renderDefinitions = () => {
        const combos = new Set<string>();
        const addCombo = (p: PatternType, c: string) => {
            if (p && p !== 'none' && p !== 'solid') combos.add(`${p}|${c}`);
        };

        config.series.forEach(s => addCombo(s.pattern, s.color));
        config.data.forEach(d => addCombo(d.pattern || 'none', d.color || 'black'));

        return (
            <defs>
                <marker id="arrow-axis" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#334155" />
                </marker>

                {Array.from(combos).map(combo => {
                    const [pat, col] = combo.split('|') as [PatternType, string];
                    const id = getFillId(pat, col);
                    return (
                        <pattern key={id} id={id} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform={pat === 'hatch' || pat === 'hatch-cross' ? "rotate(45)" : ""}>
                            {pat.includes('hatch') && <line x1="0" y1="0" x2="0" y2="8" stroke={col} strokeWidth="2" />}
                            {pat === 'hatch-cross' && <line x1="0" y1="0" x2="8" y2="0" stroke={col} strokeWidth="2" />}
                            {pat === 'lines-vertical' && <line x1="2" y1="0" x2="2" y2="8" stroke={col} strokeWidth="2" />}
                            {pat === 'lines-horizontal' && <line x1="0" y1="2" x2="8" y2="2" stroke={col} strokeWidth="2" />}
                            {pat === 'grid' && <path d="M 0 0 L 8 0 M 0 0 L 0 8" stroke={col} strokeWidth="1.5" fill="none" />}
                            {pat === 'dots' && <circle cx="4" cy="4" r="1.5" fill={col} />}
                            {pat === 'lines-diagonal-right' && <path d="M-2,10 L10,-2 M2,10 L10,2 M-2,6 L6,-2" stroke={col} strokeWidth="2" />}
                            {pat === 'lines-diagonal-left' && <path d="M-2,-2 L10,10 M2,-2 L10,6 M-2,2 L6,10" stroke={col} strokeWidth="2" />}
                        </pattern>
                    );
                })}
            </defs>
        );
    };

    // --- RENDER CHART LOGIC ---
    const renderChart = () => {
        const width = 800;
        let height = 500;
        
        // --- SCALING CALCULATIONS ---
        let allValues: number[] = [];
        config.data.forEach(d => allValues.push(...d.values));
        let rawMax = Math.max(...allValues, 0);
        const { max: maxValue, step: niceStep } = calculateNiceScale(rawMax);

        // --- PADDING CALCULATIONS ---
        const xLabelLen = config.xAxisLabel.length;
        const dynamicRightPadding = Math.max(60, xLabelLen * 9 + 30); 
        const padding = { top: 60, right: dynamicRightPadding, bottom: 60, left: 80 };

        // --- PIE SPECIFIC CALCULATIONS (Height & Layout) ---
        let pieLayout = null;
        if (config.type === 'pie') {
            const piePadding = { top: 60, right: 60, bottom: 30, left: 60 }; // Reduced bottom padding
            const total = config.data.reduce((sum, d) => sum + (d.values[0] || 0), 0);
            
            // Legend
            const maxLabelLen = Math.max(...config.data.map(d => (d.label?.length || 0) + 5)); 
            let legendW = Math.max(120, Math.min(300, maxLabelLen * 8));
            
            // Calculate Legend Height beforehand
            let currentLegendY = 0;
            const legendItems = config.data.map(d => {
                const maxChars = Math.floor(legendW / 7); 
                const wrappedLines = wrapText(d.label || '', maxChars);
                const lineHeight = 16;
                const blockHeight = Math.max(20, wrappedLines.length * lineHeight);
                const item = { d, wrappedLines, y: currentLegendY, blockHeight };
                currentLegendY += blockHeight + 12; 
                return item;
            });

            // Adjust Height based on content (Min 400, Max expands)
            height = Math.max(450, currentLegendY + piePadding.top + piePadding.bottom + 20);

            // Chart positioning
            const availableW = width - piePadding.left - piePadding.right;
            const chartW = availableW - legendW - 20; 
            const r = Math.min(chartW, height - piePadding.top - piePadding.bottom) / 2;
            const cx = piePadding.left + chartW / 2;
            const cy = piePadding.top + (height - piePadding.top - piePadding.bottom) / 2;
            const legendX = width - piePadding.right - legendW;

            pieLayout = { total, r, cx, cy, legendX, legendItems, piePadding };
        }

        const chartH = height - padding.top - padding.bottom;
        const getY = (val: number) => chartH - (val / maxValue) * chartH;

        const renderAxes = (chartW: number) => {
            const ticks = [];
            for (let v = 0; v <= maxValue; v += niceStep) {
                ticks.push(v);
            }

            return (
                <g className="axes">
                    {/* Grid Lines */}
                    {config.gridLines && ticks.map(val => {
                        if (val === 0) return null; 
                        const y = getY(val);
                        return <line key={`grid-${val}`} x1={0} y1={y} x2={chartW} y2={y} stroke="#e2e8f0" strokeDasharray="4,4" />;
                    })}

                    {/* Axes Lines */}
                    <line x1={0} y1={chartH} x2={0} y2={-20} stroke="#334155" strokeWidth={2} markerEnd="url(#arrow-axis)" />
                    <line x1={0} y1={chartH} x2={chartW + 20} y2={chartH} stroke="#334155" strokeWidth={2} markerEnd="url(#arrow-axis)" />
                    
                    {/* Y Ticks */}
                    {ticks.map(val => {
                        const y = getY(val);
                        return (
                            <g key={`tick-${val}`}>
                                <line x1={-5} y1={y} x2={0} y2={y} stroke="#334155" strokeWidth={2} />
                                <text x={-10} y={y + 4} textAnchor="end" fontSize="12" fill="#64748b" fontWeight="500">{val}</text>
                            </g>
                        );
                    })}

                    {/* Axis Labels */}
                    <text x={chartW + 25} y={chartH + 5} textAnchor="start" fontWeight="bold" fill="#334155" fontSize="14" fontStyle="italic">
                        {config.xAxisLabel}
                    </text>
                    <text x={0} y={-30} textAnchor="middle" fontWeight="bold" fill="#334155" fontSize="14" fontStyle="italic">
                        {config.yAxisLabel}
                    </text>
                </g>
            );
        };

        // --- RENDER TYPES ---

        // --- COLUMN CHART ---
        if (config.type === 'column') {
            const legendW = 120;
            const chartW = width - padding.left - padding.right - (config.showLegend && config.series.length > 1 ? legendW : 0);
            const slotWidth = chartW / config.data.length;
            const availableWidth = slotWidth * config.barWidth; 
            const singleBarWidth = availableWidth / config.series.length;

            return (
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full font-sans select-none">
                    {renderDefinitions()}
                    <text x={width/2} y={30} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1e293b">{config.title}</text>
                    <g transform={`translate(${padding.left}, ${padding.top})`}>
                        {renderAxes(chartW)}
                        {config.data.map((d, i) => {
                            const groupStartX = i * slotWidth + (slotWidth - availableWidth) / 2;
                            return (
                                <g key={d.id}>
                                    {d.values.map((val, j) => {
                                        if (j >= config.series.length) return null;
                                        const series = config.series[j];
                                        const x = groupStartX + j * singleBarWidth;
                                        const h = (val / maxValue) * chartH;
                                        const y = chartH - h;
                                        let fill = getFillStyle(series.pattern, series.color);
                                        if (config.series.length === 1) fill = getFillStyle(d.pattern || series.pattern, d.color || series.color);
                                        return (
                                            <g key={`${d.id}-${j}`}>
                                                <rect x={x} y={y} width={singleBarWidth - 2} height={h} fill={fill} stroke={config.series.length===1 ? (d.color||series.color) : series.color} strokeWidth={1} />
                                                {config.showValues && (
                                                    <text x={x + singleBarWidth/2} y={y - 5} textAnchor="middle" fontSize="11" fill="#334155" fontWeight="bold">{val}</text>
                                                )}
                                            </g>
                                        );
                                    })}
                                    <text x={i * slotWidth + slotWidth/2} y={chartH + 20} textAnchor="middle" fontSize="12" fill="#334155" fontWeight="600">{d.label}</text>
                                </g>
                            );
                        })}
                        {config.showLegend && config.series.length > 1 && (
                            <g transform={`translate(${chartW + 40}, 0)`}>
                                {config.series.map((s, i) => (
                                    <g key={s.id} transform={`translate(0, ${i * 30})`}>
                                        <rect width={24} height={16} rx={2} fill={getFillStyle(s.pattern, s.color)} stroke={s.color} />
                                        <text x={30} y={12} fontSize="12" fill="#334155" fontWeight="500">{s.label}</text>
                                    </g>
                                ))}
                            </g>
                        )}
                    </g>
                </svg>
            );
        }

        // --- LINE CHART ---
        if (config.type === 'line') {
             const legendW = 120;
             const chartW = width - padding.left - padding.right - (config.showLegend && config.series.length > 1 ? legendW : 0);
             const xPadding = chartW / (config.data.length * 2); 
             const step = (chartW - 2 * xPadding) / (Math.max(1, config.data.length - 1));

            return (
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full font-sans select-none">
                    {renderDefinitions()}
                    <text x={width/2} y={30} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1e293b">{config.title}</text>
                    <g transform={`translate(${padding.left}, ${padding.top})`}>
                        {renderAxes(chartW)}
                        {config.series.map((s, j) => {
                            const points = config.data.map((d, i) => {
                                const x = config.data.length > 1 ? xPadding + i * step : chartW/2;
                                const val = d.values[j] || 0;
                                const y = getY(val);
                                return `${x},${y}`;
                            }).join(' ');
                            return (
                                <g key={s.id}>
                                    <polyline points={points} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.pattern === 'dots' ? '1,5' : s.pattern === 'hatch' ? '5,5' : 'none'} />
                                    {config.data.map((d, i) => {
                                        const x = config.data.length > 1 ? xPadding + i * step : chartW/2;
                                        const val = d.values[j] || 0;
                                        const y = getY(val);
                                        return (
                                            <g key={`${d.id}-${j}`}>
                                                <circle cx={x} cy={y} r={5} fill="white" stroke={s.color} strokeWidth={2} />
                                                {config.showValues && (
                                                    <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fill="#334155" fontWeight="bold">{val}</text>
                                                )}
                                                {j === 0 && (
                                                    <text x={x} y={chartH + 20} textAnchor="middle" fontSize="12" fill="#334155" fontWeight="600">{d.label}</text>
                                                )}
                                            </g>
                                        );
                                    })}
                                </g>
                            );
                        })}
                        {config.showLegend && config.series.length > 1 && (
                            <g transform={`translate(${chartW + 40}, 0)`}>
                                {config.series.map((s, i) => (
                                    <g key={s.id} transform={`translate(0, ${i * 30})`}>
                                        <line x1={0} y1={8} x2={24} y2={8} stroke={s.color} strokeWidth={3} />
                                        <circle cx={12} cy={8} r={3} fill="white" stroke={s.color} strokeWidth={2} />
                                        <text x={32} y={12} fontSize="12" fill="#334155" fontWeight="500">{s.label}</text>
                                    </g>
                                ))}
                            </g>
                        )}
                    </g>
                </svg>
            );
        }

        // --- PIE CHART (Smart Layout & Dynamic Height) ---
        if (config.type === 'pie' && pieLayout) {
            const { total, r, cx, cy, legendX, legendItems, piePadding } = pieLayout;
            let startAngle = 0;

            return (
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full font-sans select-none">
                    {renderDefinitions()}
                    <text x={cx} y={30} textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1e293b">{config.title}</text>
                    <g>
                        {config.data.map((d) => {
                            const val = d.values[0] || 0;
                            const sliceAngle = (val / total) * 2 * Math.PI;
                            const endAngle = startAngle + sliceAngle;
                            const x1 = cx + r * Math.cos(startAngle - Math.PI/2);
                            const y1 = cy + r * Math.sin(startAngle - Math.PI/2);
                            const x2 = cx + r * Math.cos(endAngle - Math.PI/2);
                            const y2 = cy + r * Math.sin(endAngle - Math.PI/2);
                            const midAngle = startAngle + sliceAngle / 2 - Math.PI/2;
                            const tx = cx + (r * 0.7) * Math.cos(midAngle);
                            const ty = cy + (r * 0.7) * Math.sin(midAngle);
                            const largeArc = sliceAngle > Math.PI ? 1 : 0;
                            const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                            startAngle = endAngle;
                            const percent = total > 0 ? Math.round((val / total) * 100) : 0;
                            const fill = getFillStyle(d.pattern || 'none', d.color || '#333');
                            return (
                                <g key={d.id}>
                                    <path d={pathData} fill={fill} stroke="white" strokeWidth={2} />
                                    {percent > 2 && (
                                        <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fill="#000" stroke="#fff" strokeWidth="3" paintOrder="stroke" fontWeight="bold" fontSize="14">
                                            {percent}%
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </g>
                    <g transform={`translate(${legendX}, ${piePadding.top})`}>
                        {legendItems.map((item: any) => (
                            <g key={item.d.id} transform={`translate(0, ${item.y})`}>
                                <rect width={24} height={16} rx={2} fill={getFillStyle(item.d.pattern || 'none', item.d.color || '#333')} stroke={item.d.color} strokeWidth={1.5} />
                                <text x={32} y={12} fontSize="12" fill="#334155" fontWeight="500">
                                    {item.wrappedLines.map((line: string, lineIdx: number) => (
                                        <tspan key={lineIdx} x={32} dy={lineIdx === 0 ? 0 : 16}>{line}</tspan>
                                    ))}
                                </text>
                            </g>
                        ))}
                    </g>
                </svg>
            );
        }

        return null;
    };

    return (
        <div className="flex h-full w-full bg-slate-50">
            {/* LEFT PANEL */}
            <div className="w-96 bg-white border-r border-slate-200 flex flex-col h-full z-10 shadow-lg">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="text-indigo-600" /> Editor Biểu Đồ
                    </h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                    {/* (Chart Type, Info, Series, Data sections skipped for brevity, same as before) */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Loại biểu đồ</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'column', icon: BarChart3, label: 'Cột (Bar)' },
                                { id: 'line', icon: LineChart, label: 'Đường (Line)' },
                                { id: 'pie', icon: PieChart, label: 'Tròn (Pie)' }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setConfig(prev => ({ ...prev, type: t.id as ChartType }))}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${config.type === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-200'}`}
                                >
                                    <t.icon size={20} />
                                    <span className="text-[10px] font-bold mt-1">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Thông tin chung</label>
                        <input type="text" value={config.title} onChange={e => setConfig({...config, title: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none" placeholder="Tên biểu đồ" />
                        {config.type !== 'pie' && (
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" value={config.xAxisLabel} onChange={e => setConfig({...config, xAxisLabel: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:border-indigo-500 outline-none" placeholder="Trục hoành (X)" />
                                <input type="text" value={config.yAxisLabel} onChange={e => setConfig({...config, yAxisLabel: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:border-indigo-500 outline-none" placeholder="Trục tung (Y)" />
                            </div>
                        )}
                    </div>

                    {config.type !== 'pie' && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Chuỗi dữ liệu (Series)</label>
                                <button onClick={addSeries} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded transition-colors flex items-center gap-1 text-xs font-bold"><Plus size={14}/> Thêm</button>
                            </div>
                            <div className="space-y-2">
                                {config.series.map((s, i) => (
                                    <div key={s.id} className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
                                        <input type="color" value={s.color} onChange={e => updateSeries(i, 'color', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-none bg-transparent" />
                                        <select value={s.pattern} onChange={e => updateSeries(i, 'pattern', e.target.value)} className="w-8 h-6 bg-slate-100 text-[10px] rounded border-none outline-none cursor-pointer">
                                            {PATTERNS.map(p => <option key={p.id} value={p.id}>{p.id.substring(0,2)}</option>)}
                                        </select>
                                        <input type="text" value={s.label} onChange={e => updateSeries(i, 'label', e.target.value)} className="flex-1 bg-transparent text-xs font-bold outline-none border-b border-transparent focus:border-indigo-300"/>
                                        <button onClick={() => removeSeries(i)} className="text-slate-300 hover:text-red-500" disabled={config.series.length <= 1}><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Dữ liệu chi tiết</label>
                            <button onClick={addDataPoint} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded transition-colors flex items-center gap-1 text-xs font-bold" title="Thêm dòng"><Plus size={14}/> Thêm mục</button>
                        </div>
                        <div className="space-y-2">
                            {config.data.map((d) => (
                                <div key={d.id} className="flex flex-col gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100 group">
                                    <div className="flex items-center gap-2">
                                        {(config.type === 'pie' || (config.type === 'column' && config.series.length === 1)) && (
                                            <>
                                                <input type="color" value={d.color} onChange={e => updateDataPoint(d.id, 'color', e.target.value)} className="w-5 h-5 rounded cursor-pointer border-none bg-transparent" />
                                                <select value={d.pattern || 'none'} onChange={e => updateDataPoint(d.id, 'pattern', e.target.value)} className="w-8 h-5 bg-white text-[10px] rounded border border-slate-200 outline-none">
                                                    {PATTERNS.map(p => <option key={p.id} value={p.id}>{p.id.substring(0,2)}</option>)}
                                                </select>
                                            </>
                                        )}
                                        <input type="text" value={d.label} onChange={e => updateDataPoint(d.id, 'label', e.target.value)} className="flex-1 bg-transparent text-xs font-bold outline-none border-b border-transparent focus:border-indigo-300" placeholder="Tên mục"/>
                                        <button onClick={() => removeDataPoint(d.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 pl-7">
                                        {config.series.map((s, idx) => (
                                            <div key={s.id} className="flex items-center gap-1">
                                                {config.series.length > 1 && <div className="w-2 h-2 rounded-full" style={{background: s.color}}></div>}
                                                <input type="number" value={d.values[idx] || 0} onChange={e => updateDataValue(d.id, idx, parseFloat(e.target.value))} className="w-full bg-white px-1 py-0.5 rounded border border-slate-200 text-xs text-right outline-none focus:border-indigo-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={config.showValues} onChange={e => setConfig({...config, showValues: e.target.checked})} className="accent-indigo-600" />
                            Hiển thị giá trị
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={config.showLegend} onChange={e => setConfig({...config, showLegend: e.target.checked})} className="accent-indigo-600" />
                            Hiển thị chú thích
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={config.gridLines} onChange={e => setConfig({...config, gridLines: e.target.checked})} className="accent-indigo-600" />
                            Đường lưới
                        </label>
                        {config.type !== 'pie' && config.type !== 'line' && (
                            <div className="space-y-1 pt-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Độ rộng cột</label>
                                <input type="range" min="0.1" max="0.9" step="0.1" value={config.barWidth} onChange={e => setConfig({...config, barWidth: parseFloat(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
                    {/* Toggle Export Selection Area */}
                    <button 
                        onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectionStart(null); setSelectionBox(null); }}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl font-bold transition-all text-xs border ${isSelectionMode ? 'bg-green-50 border-green-200 text-green-700 shadow-inner' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Crop size={16} /> 
                        {isSelectionMode ? 'Đang chọn vùng...' : 'Vùng chọn xuất hình'}
                    </button>

                    <button 
                        onClick={handleExport}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${isCopied ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}
                    >
                        {isCopied ? <Check size={18} /> : <Scissors size={18} />}
                        <span id="btn-export-text">{isCopied ? 'Đã sao chép!' : (selectionBox && selectionBox.width > 0 ? 'Xuất vùng chọn' : 'Click để copy ảnh')}</span>
                    </button>
                    <p className="text-[10px] text-center text-slate-400">
                        {isSelectionMode ? "Kéo chuột trên hình để chọn vùng" : "Ảnh sẽ tự động cắt sát vùng nội dung (Smart Crop)"}
                    </p>
                </div>
            </div>

            {/* RIGHT PANEL: PREVIEW */}
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-8 overflow-auto relative">
                <div 
                    ref={chartRef}
                    className={`bg-white rounded-2xl shadow-xl border border-slate-200 p-2 w-[800px] flex items-center justify-center relative select-none ${isSelectionMode ? 'cursor-crosshair' : 'cursor-default'}`}
                    // Dynamic Aspect Ratio based on content if simple, but wrapper width is fixed 800px.
                    // The SVG controls the height.
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                >
                    {/* Selection Overlay */}
                    {isSelectionMode && selectionBox && (
                        <div 
                            className="selection-overlay absolute border-2 border-green-500 bg-green-500/10 pointer-events-none z-50"
                            style={{
                                left: selectionBox.x,
                                top: selectionBox.y,
                                width: selectionBox.width,
                                height: selectionBox.height,
                                borderStyle: 'dashed'
                            }}
                        />
                    )}
                    
                    {renderChart()}
                </div>
            </div>
        </div>
    );
};
