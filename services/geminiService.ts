
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Image as ImageIcon, Loader2, Info, X, ClipboardPaste, Clipboard, Calculator, Lightbulb, Camera, Video, StopCircle, UploadCloud } from 'lucide-react';
import { parseGeometryProblem } from '../services/geminiService';
import { GeometryData } from '../types';

interface InputPanelProps {
  setGeometryData: (data: GeometryData) => void;
  isOpen: boolean;
  onClose: () => void;
}

const InputPanel: React.FC<InputPanelProps> = ({ setGeometryData, isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // Drag state
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLDivElement>(null); // Ref for panel focus
  
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  // Unified Paste Handler
  const handlePaste = useCallback((e: ClipboardEvent | React.ClipboardEvent) => {
      const items = 'clipboardData' in e ? e.clipboardData.items : (e as any).originalEvent?.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setSelectedImage(event.target.result as string);
                setError(null); 
                setShowCamera(false);
              }
            };
            reader.readAsDataURL(file);
            e.preventDefault(); // Stop text paste if image found
            return;
          }
        }
      }
  }, []);

  // Global paste listener (backup) + Focus management
  useEffect(() => {
    if (isOpen) {
        window.addEventListener('paste', handlePaste as any);
    }
    return () => {
        window.removeEventListener('paste', handlePaste as any);
    };
  }, [isOpen, handlePaste]);

  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (isLoading) {
          setLoadingProgress(0);
          setLoadingStatus("Đang khởi động tư duy hình học...");
          
          // Các mốc thời gian giả lập (trên tổng 3-4 phút)
          const statuses = [
              { p: 5, t: "Đang phân tích đề bài & nhận diện hình ảnh..." },
              { p: 15, t: "Đang thiết lập hệ trục tọa độ..." },
              { p: 30, t: "Đang tính toán các điểm (Thinking Process)..." },
              { p: 50, t: "Đang giải hệ phương trình giao điểm..." },
              { p: 70, t: "Kiểm tra tính logic của các điểm..." },
              { p: 85, t: "Đang tạo dữ liệu JSON..." },
              { p: 95, t: "Hoàn tất..." }
          ];
          
          let step = 0;
          // Chạy chậm hơn: update mỗi 500ms
          interval = setInterval(() => {
              setLoadingProgress(prev => {
                  const target = statuses[step] ? statuses[step].p : 99;
                  
                  // Tăng rất chậm để phù hợp với timeout 5 phút
                  // Nếu chưa đạt target, tăng 0.5
                  if (prev < target) {
                       return prev + 0.5; 
                  } else {
                       if (statuses[step]) setLoadingStatus(statuses[step].t);
                       if (step < statuses.length - 1) step++;
                       return prev; // Giữ nguyên, đợi step tiếp theo
                  }
              });
          }, 800); // 800ms mỗi tick để kéo dài thời gian
      } else {
          setLoadingProgress(100);
      }
      return () => clearInterval(interval);
  }, [isLoading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          setSelectedImage(reader.result as string);
          setShowCamera(false);
      };
      reader.readAsDataURL(file);
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
  };

  const startCamera = async () => {
    try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        setShowCamera(true);
    } catch (err) {
        console.error("Camera error", err);
        setError("Không thể truy cập camera. Vui lòng cấp quyền.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setSelectedImage(dataUrl);
            stopCamera();
        }
    }
  };

  const handleGenerate = async () => {
    if (!prompt && !selectedImage) {
        setError("Vui lòng nhập đề bài hoặc dán ảnh.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setExplanation(null);
    try {
      let base64Data = undefined;
      let mimeType = "image/jpeg";
      if (selectedImage) {
          const matches = selectedImage.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
              mimeType = matches[1];
              base64Data = matches[2];
          }
      }
      const response = await parseGeometryProblem(prompt, base64Data, mimeType);
      
      const geom = response.geometry;
      
      // KIỂM TRA QUAN TRỌNG: Nếu không có điểm nào, coi như thất bại
      if (geom && geom.points && geom.points.length > 0) {
          
          // --- CENTERING LOGIC ---
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          geom.points.forEach(p => {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
          });
          
          if (minX !== Infinity) {
              const centerX = (minX + maxX) / 2;
              const centerY = (minY + maxY) / 2;
              // Dịch chuyển toàn bộ điểm về gốc (0,0)
              geom.points.forEach(p => { p.x -= centerX; p.y -= centerY; });
              geom.texts.forEach(t => { t.x -= centerX; t.y -= centerY; });
              if (geom.images) geom.images.forEach(img => { img.x -= centerX; img.y -= centerY; });
              if (geom.functionGraphs) geom.functionGraphs.forEach(g => { 
                  if(g.labelX !== undefined) g.labelX -= centerX; 
                  if(g.labelY !== undefined) g.labelY -= centerY; 
              });
          }
          // -----------------------

          setGeometryData(geom);
          setExplanation(response.explanation || "Đã hoàn tất dựng hình.");
      } else {
          // Trường hợp AI trả lời nhưng không có hình
          if (response.explanation) {
              setExplanation(response.explanation + "\n\n(Lưu ý: AI không tìm thấy đối tượng hình học nào để vẽ)");
          } else {
              setError("AI không thể nhận diện bài toán hoặc không tạo ra hình vẽ nào.");
          }
      }
      
    } catch (err: any) {
      setError(err.message || "Lỗi xử lý logic.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
        ref={panelRef}
        className={`
            fixed inset-y-0 right-0 w-full sm:w-96 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col h-full
            lg:static lg:shadow-none lg:z-auto
            animate-in slide-in-from-right-10 duration-300 outline-none
        `}
        tabIndex={0}
        onPaste={handlePaste}
    >
      <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-white flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Calculator className="text-indigo-600" size={20} />
          Vẽ hình học bằng Ai
        </h2>
        <button 
            onClick={onClose} 
            className="lg:hidden p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
        >
            <X size={20} />
        </button>
      </div>

      <div className="p-5 flex-1 overflow-y-auto space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex justify-between">
            Nhập đề bài (Text)
            <button onClick={() => navigator.clipboard.readText().then(setPrompt)} className="text-indigo-500 hover:underline">Dán</button>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-sm h-32 resize-none leading-relaxed shadow-inner"
            placeholder="Ví dụ: Cho đường tròn (O) đường kính AB. Tiếp tuyến tại C cắt tiếp tuyến tại A và B ở M và N..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex justify-between items-center">
             <span>Ảnh đề bài (Import)</span>
             {showCamera && <span className="text-red-500 flex items-center gap-1 animate-pulse"><div className="w-2 h-2 rounded-full bg-red-500"></div> LIVE</span>}
          </label>
          
          <div 
            className={`border-2 border-dashed rounded-2xl overflow-hidden transition-all relative ${
                isDragging ? 'border-indigo-500 bg-indigo-50 scale-105' : 
                (selectedImage || showCamera ? 'border-indigo-500 bg-slate-900' : 'border-slate-200 bg-slate-50 hover:border-indigo-400')
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
             
             <div className={`${showCamera ? 'block' : 'hidden'} relative w-full aspect-video bg-black`}>
                 <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                 <canvas ref={canvasRef} className="hidden" />
                 <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-4">
                     <button onClick={capturePhoto} className="w-12 h-12 rounded-full bg-white border-4 border-slate-300 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all" title="Chụp">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-white"></div>
                     </button>
                     <button onClick={stopCamera} className="w-12 h-12 rounded-full bg-slate-800/80 text-white flex items-center justify-center hover:bg-red-500/80 transition-all" title="Hủy">
                        <X size={20} />
                     </button>
                 </div>
             </div>

             {!showCamera && (
                 selectedImage ? (
                    <div className="relative w-full h-48 flex items-center justify-center bg-slate-50/50 p-3 group">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none"></div>
                        <img 
                          src={selectedImage} 
                          alt="Preview" 
                          className="relative z-10 max-h-full max-w-full object-contain rounded-lg shadow-sm border border-slate-200 bg-white" 
                        />
                        <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }} 
                            className="absolute top-2 right-2 p-1.5 bg-white text-slate-500 rounded-full shadow-md hover:bg-red-50 hover:text-red-500 z-20 border border-slate-100 transition-all opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0"
                            title="Xóa ảnh"
                        >
                            <X size={14}/>
                        </button>
                    </div>
                ) : (
                    <div className="p-6 flex flex-col gap-3 items-center justify-center min-h-[160px]">
                        <div className="flex gap-4 w-full">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 transition-all group shadow-sm"
                            >
                                <ImageIcon className="text-slate-400 group-hover:text-indigo-500" size={24} />
                                <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-600 uppercase">Chọn ảnh</span>
                            </button>
                            <button 
                                onClick={startCamera}
                                className="flex-1 flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 transition-all group shadow-sm"
                            >
                                <Camera className="text-slate-400 group-hover:text-indigo-500" size={24} />
                                <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-600 uppercase">Chụp ảnh</span>
                            </button>
                        </div>
                        <span className="text-[10px] text-slate-400 text-center font-medium mt-1 flex items-center gap-1">
                            {isDragging ? <span className="text-indigo-600 font-bold">Thả ảnh vào đây...</span> : 'Hoặc dán ảnh (Ctrl+V) / Kéo thả'}
                        </span>
                    </div>
                )
             )}
             <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
          </div>
        </div>

        <div className="space-y-3">
            {isLoading && (
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">{loadingStatus}</span>
                        <span className="text-[10px] font-bold text-indigo-400">{Math.round(loadingProgress)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 transition-all duration-300 ease-out" style={{ width: `${loadingProgress}%` }} />
                    </div>
                </div>
            )}
            
            <button
              onClick={handleGenerate}
              disabled={isLoading || showCamera}
              className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 text-sm uppercase tracking-widest"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
              {isLoading ? 'Đang suy nghĩ (3-5 phút)...' : 'Dựng Hình Ngay'}
            </button>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-600 text-[10px] font-bold rounded-xl border border-red-100 animate-in shake">{error}</div>}
        {explanation && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Info size={14} className="text-indigo-500" /> Phân tích toán học</h3>
                <div className="p-5 bg-slate-900 text-slate-300 text-xs rounded-2xl leading-relaxed font-mono whitespace-pre-line border-l-4 border-indigo-500 shadow-xl">
                    {explanation}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default InputPanel;
