
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI "GEOSMART" ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Trợ lý AI chuyên về hình học phẳng (2D) và không gian (3D).
Nhiệm vụ: Chuyển đổi đề bài toán thành JSON để vẽ lên Canvas SVG (1000x800).

--- QUY TẮC CỐT LÕI (BẮT BUỘC) ---
1. **KHÔNG BAO GIỜ TRẢ VỀ ĐIỂM LẺ LOI**:
   - Nếu tạo điểm A, B, C -> BẮT BUỘC phải kiểm tra xem chúng có tạo thành tam giác/đoạn thẳng không để tạo "segments".
   - Nếu đề bài nhắc đến "Đường tròn (O)" -> BẮT BUỘC trả về object trong mảng "circles".
2. **STYLE**:
   - Hình không gian: Cạnh khuất dùng "style": "dashed".
   - Đường phụ (đường cao, trung tuyến): Nên dùng màu khác hoặc nét mảnh.
3. **OUTPUT**: Trả về JSON thuần trong block code.
`;

// --- CÔNG CỤ XỬ LÝ TEXT (HEURISTICS) ---

function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    // Làm sạch markdown
    let clean = text.replace(/```json/gi, "").replace(/```/g, "");
    // Cắt lấy phần JSON {}
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    try {
        // Fix lỗi cú pháp phổ biến của LLM (dấu phẩy thừa cuối mảng/object)
        clean = clean.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return null;
    }
}

function removeVietnameseTones(str: string): string {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.toUpperCase(); // Trả về chữ hoa để dễ so sánh
}

// --- BỘ NÃO "NÊM NẾM" (AUTO-CONNECT & FIXING) ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) return;
    
    const text = removeVietnameseTones(problemText); 
    const points = geometry.points as any[];
    
    // 1. Map Label -> ID
    const labelMap: Record<string, string> = {};
    points.forEach(p => {
        if (p.label) labelMap[p.label.toUpperCase()] = p.id;
    });

    const ensureSegment = (id1: string, id2: string, style: string = 'solid') => {
        if (!id1 || !id2 || id1 === id2) return;
        if (!geometry.segments) geometry.segments = [];
        
        // Kiểm tra đã có đường nối chưa
        const exists = geometry.segments.some((s: any) => 
            (s.startPointId === id1 && s.endPointId === id2) || 
            (s.startPointId === id2 && s.endPointId === id1)
        );

        if (!exists) {
            geometry.segments.push({
                id: generateId('s_auto'),
                startPointId: id1,
                endPointId: id2,
                style: style,
                color: 'black',
                strokeWidth: 1.5
            });
        }
    };

    // --- A. TỰ ĐỘNG VẼ ĐƯỜNG TRÒN NẾU THIẾU ---
    // Tìm: "DUONG TRON (O)" hoặc "(O)" hoặc "TAM O"
    const circleRegex = /(?:DUONG TRON|D\.TRON)\s*\(?([A-Z])\)?|TAM\s+([A-Z])/g;
    let cMatch;
    while ((cMatch = circleRegex.exec(text)) !== null) {
        const centerLabel = cMatch[1] || cMatch[2];
        const centerId = labelMap[centerLabel];
        
        if (centerId) {
            // Kiểm tra xem đã có đường tròn tâm này chưa
            if (!geometry.circles) geometry.circles = [];
            const hasCircle = geometry.circles.some((c: any) => c.centerId === centerId);
            
            if (!hasCircle) {
                // Nếu chưa có, tạo đường tròn mặc định hoặc tìm điểm đi qua
                // Tìm bán kính: Thử tìm điểm nào xa tâm nhất (thường là điểm nằm trên đường tròn)
                let radius = 120; // Mặc định
                let radiusPointId = undefined;
                
                // Heuristic: Nếu đề bài là "Đường tròn (O) đường kính AB", thì A, B nằm trên đường tròn
                // Tìm điểm nào đó trong danh sách có vẻ liên quan (xa O một khoảng hợp lý)
                const centerPt = points.find(p => p.id === centerId);
                if (centerPt) {
                    let maxDist = 0;
                    points.forEach(p => {
                        if (p.id !== centerId) {
                            const d = Math.hypot(p.x - centerPt.x, p.y - centerPt.y);
                            if (d > maxDist && d < 400) { // Giới hạn canvas
                                maxDist = d;
                                radiusPointId = p.id;
                            }
                        }
                    });
                    if (maxDist > 50) radius = maxDist;
                }

                geometry.circles.push({
                    id: generateId('c_auto'),
                    centerId: centerId,
                    radiusValue: radiusPointId ? undefined : radius,
                    radiusPointId: radiusPointId, // Nếu có điểm trên đường tròn thì dùng điểm đó
                    color: 'black',
                    style: 'solid'
                });
            }
        }
    }

    // --- B. TỰ ĐỘNG NỐI HÌNH ĐA GIÁC ---
    // 1. Tam giác ABC...
    const triRegex = /TAM GIAC\s+([A-Z]{3})/g;
    let match;
    while ((match = triRegex.exec(text)) !== null) {
        const labels = match[1];
        const p1 = labelMap[labels[0]], p2 = labelMap[labels[1]], p3 = labelMap[labels[2]];
        if(p1 && p2) ensureSegment(p1, p2);
        if(p2 && p3) ensureSegment(p2, p3);
        if(p3 && p1) ensureSegment(p3, p1);
    }

    // 2. Tứ giác ABCD...
    const quadRegex = /(?:TU GIAC|HINH CHU NHAT|HINH VUONG|HINH THANG|HINH BINH HANH)\s+([A-Z]{4})/g;
    while ((match = quadRegex.exec(text)) !== null) {
        const labels = match[1];
        const p1 = labelMap[labels[0]], p2 = labelMap[labels[1]], p3 = labelMap[labels[2]], p4 = labelMap[labels[3]];
        if(p1 && p2) ensureSegment(p1, p2);
        if(p2 && p3) ensureSegment(p2, p3);
        if(p3 && p4) ensureSegment(p3, p4);
        if(p4 && p1) ensureSegment(p4, p1);
    }

    // --- C. TỰ ĐỘNG NỐI CÁC CẶP ĐIỂM LẺ (Explicit Segments) ---
    // VD: "cạnh AB", "đoạn thẳng MN", "nối O với M", "tiếp tuyến MA"
    const segRegex = /(?:CANH|DOAN|NOI|TIEP TUYEN|DUONG THANG)\s+(?:CUA\s+)?([A-Z])(?:\s+VOI\s+)?([A-Z])/g;
    while ((match = segRegex.exec(text)) !== null) {
        const p1 = labelMap[match[1]];
        const p2 = labelMap[match[2]];
        if (p1 && p2) ensureSegment(p1, p2);
    }
    // Pattern dính liền: "AB", "OM" (nguy hiểm hơn nên cần check kỹ context hoặc chỉ chạy khi segments quá ít)
    // Nếu segments < 3, chạy quét cặp đôi ngẫu nhiên trong text (VD: "tính độ dài AB")
    if ((geometry.segments?.length || 0) < 3) {
        const pairRegex = /\b([A-Z])([A-Z])\b/g;
        while ((match = pairRegex.exec(text)) !== null) {
            // Bỏ qua các từ khóa phổ biến viết tắt 2 chữ cái (nếu có)
            const p1 = labelMap[match[1]];
            const p2 = labelMap[match[2]];
            // Chỉ nối nếu khoảng cách < 600 (tránh nối lung tung xa quá)
            if (p1 && p2) ensureSegment(p1, p2);
        }
    }

    // --- D. SAFETY NET (Lưới an toàn cuối cùng) ---
    // Nếu vẫn chưa có đường nào và có > 2 điểm -> Nối vòng tròn để người dùng thấy hình
    const segmentCount = geometry.segments ? geometry.segments.length : 0;
    if (segmentCount === 0 && points.length >= 3) {
        // Chỉ áp dụng với số lượng điểm nhỏ để tránh rối
        if (points.length <= 6) {
            for (let i = 0; i < points.length; i++) {
                const current = points[i];
                const next = points[(i + 1) % points.length];
                ensureSegment(current.id, next.id);
            }
        }
    }
}

function resolveGeometryReferences(geometry: any) {
    if (!geometry.points) return;
    const labelToId: Record<string, string> = {};
    const idMap: Record<string, string> = {};

    geometry.points.forEach((p: any) => {
        idMap[p.id] = p.id;
        if (p.label) labelToId[p.label.toUpperCase()] = p.id;
    });

    const resolve = (ref: string) => {
        if (!ref) return ref;
        if (idMap[ref]) return ref;
        return labelToId[ref.toUpperCase()] || ref;
    };

    if (geometry.segments) {
        geometry.segments.forEach((s: any) => {
            s.startPointId = resolve(s.startPointId);
            s.endPointId = resolve(s.endPointId);
        });
        geometry.segments = geometry.segments.filter((s: any) => idMap[s.startPointId] && idMap[s.endPointId]);
    }
    
    if (geometry.circles) {
        geometry.circles.forEach((c: any) => {
            c.centerId = resolve(c.centerId);
            if(c.radiusPointId) c.radiusPointId = resolve(c.radiusPointId);
        });
    }

    if (geometry.angles) {
        geometry.angles.forEach((a: any) => {
            a.centerId = resolve(a.centerId);
            a.point1Id = resolve(a.point1Id);
            a.point2Id = resolve(a.point2Id);
        });
    }
}

function scaleAndCenterGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    geometry.points.forEach((p: any) => {
        p.x = Number(p.x); p.y = Number(p.y);
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX || 1;
    let height = maxY - minY || 1;
    
    // Target 600x500 (có padding)
    const targetW = 600; 
    const targetH = 500;
    const scale = Math.min(targetW / width, targetH / height); 

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const targetX = 500; // SVG center
    const targetY = 400;

    geometry.points.forEach((p: any) => {
        p.x = (p.x - centerX) * scale + targetX;
        p.y = (p.y - centerY) * scale + targetY;
    });
    
    if (geometry.circles) {
        geometry.circles.forEach((c: any) => { if(c.radiusValue) c.radiusValue *= scale; });
    }
    
    if (geometry.ellipses) {
        geometry.ellipses.forEach((e: any) => {
            e.cx = (e.cx - centerX) * scale + targetX;
            e.cy = (e.cy - centerY) * scale + targetY;
            e.rx *= scale;
            e.ry *= scale;
        });
    }
}

// Hàm chuẩn hóa cuối cùng
function normalizeAndResolve(result: any, originalText: string, resolvePromise: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    // Nếu AI trả về root là mảng points thay vì object geometry
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: "Đã tạo hình vẽ." };
    }
    if (!result.geometry) result.geometry = { points: [], segments: [], circles: [], angles: [], texts: [] };
    
    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles', 'ellipses', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (!g[key]) g[key] = [];
        // Gán ID nếu thiếu
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    // 1. Chuyển đổi Label tham chiếu thành ID
    resolveGeometryReferences(g);

    // 2. KÍCH HOẠT "HEURISTIC ENGINE": Tự động nối điểm và thêm hình dựa trên văn bản
    enhanceGeometryWithTextAnalysis(g, originalText);

    // 3. Resolve lại lần nữa cho các đường mới tạo
    resolveGeometryReferences(g);

    // 4. Căn giữa và Scale
    scaleAndCenterGeometry(g);
    
    resolvePromise(result);
}

// --- MAIN SERVICE ---

export const parseGeometryProblem = async (
  text: string,
  base64Image?: string,
  mimeType: string = "image/jpeg"
): Promise<AIResponse> => {
  
  const parts: any[] = [];
  if (base64Image) {
    parts.push({ inlineData: { mimeType, data: base64Image } });
  }
  
  const promptText = `
    Đề bài: "${text}"
    Yêu cầu: Trả về JSON vẽ hình học.
    1. Points: Tính toán tọa độ hợp lý.
    2. Segments: Nối các điểm để tạo thành hình (Tam giác, Tứ giác, Đường cao...).
    3. Circles: Nếu đề bài có đường tròn, hãy trả về trong mảng "circles".
    Chỉ trả về JSON.
  `;
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 60000; 

      const cleanup = () => {
          window.removeEventListener('message', handleMessage);
          clearTimeout(timeoutId);
      };

      const handleMessage = (event: MessageEvent) => {
          if (!event.data || typeof event.data !== 'object') return;

          if (event.data.type === 'GEMINI_RESULT' && event.data.requestId === requestId) {
              cleanup();
              try {
                  const payload = event.data.payload;
                  let rawText = typeof payload === 'string' ? payload : 
                                (payload.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(payload));

                  const result = cleanAndParseJSON(rawText);
                  if (!result) throw new Error("JSON invalid");
                  
                  // Áp dụng Heuristic để sửa lỗi thiếu hình
                  normalizeAndResolve(result, text, resolve);

              } catch (error: any) {
                  console.error("AI Processing Error:", error);
                  reject(new Error("Lỗi xử lý dữ liệu từ AI."));
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              cleanup();
              reject(new Error(event.data.error || "Lỗi kết nối AI Studio."));
          }
      };

      window.addEventListener('message', handleMessage);
      
      const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Hết thời gian chờ phản hồi (60s)."));
      }, TIMEOUT);

      // Gửi sang Iframe cha (AI Studio)
      if (window.parent && window.parent !== window) {
          window.parent.postMessage({
              type: 'DRAW_REQUEST',
              requestId,
              payload: {
                  model: 'gemini-3-pro-preview', 
                  contents: [{ parts: parts }],
                  config: {
                      systemInstruction: SYSTEM_INSTRUCTION,
                      responseMimeType: "application/json",
                      thinkingConfig: { thinkingBudget: 16000 }
                  }
              }
          }, '*');
      } else {
          console.warn("Standalone Mode: Chức năng AI yêu cầu chạy trong môi trường AI Studio.");
          // Reject hoặc Mock data để test
          reject(new Error("Vui lòng chạy ứng dụng này trong môi trường AI Studio (Iframe)."));
      }
  });
};
