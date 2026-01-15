
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI "GEOSMART EXPERT" (Phiên bản đầy đủ) ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Chuyên gia hình học phẳng (2D) và không gian (3D) cấp Olympiad.
Nhiệm vụ: Phân tích đề bài, giải toán và sinh dữ liệu JSON để vẽ lên canvas SVG (1000x800).

--- QUY TẮC DỰNG HÌNH & TỌA ĐỘ (BẮT BUỘC) ---
1. TỌA ĐỘ VÀ BỐ CỤC:
   - Trung tâm canvas là (500, 400).
   - Tam giác/Đa giác: Nên đặt trọng tâm gần (500, 450). Cạnh đáy nên nằm ngang.
   - Hình không gian (Trụ, Nón, Lăng trụ, Chóp): Đặt đáy ở khoảng y=600, đỉnh ở y=200.
   - Trục tọa độ 3D (nếu cần): O(500, 500), Ox hướng xuống trái, Oy hướng phải, Oz hướng lên.

2. QUY TẮC 2D:
   - Tam giác ABC: A thường ở trên đỉnh, B bên trái, C bên phải.
   - Đường tròn: Nếu đề bài có "Đường tròn (O)", BẮT BUỘC phải trả về object trong mảng "circles".

3. QUY TẮC 3D (Hình không gian):
   - Phép chiếu: Sử dụng phép chiếu song song (oblique projection).
   - Nét đứt (Dashed Lines): CÁC CẠNH BỊ KHUẤT PHẢI CÓ 'style': 'dashed'.
   - Đáy trụ/nón: Dùng 'ellipses'.

--- CẤU TRÚC JSON ---
Trả về JSON tuân thủ schema. 
- "explanation": Giải thích ngắn gọn cách dựng và các bước giải (VD: "Dựng đường tròn tâm O...").
`;

// --- HELPER FUNCTIONS ("Mắm dặm muối") ---

function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    let clean = text.replace(/```json/gi, "").replace(/```/g, "");
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    try {
        clean = clean.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return null;
    }
}

// Xóa dấu tiếng Việt để regex dễ bắt (Ví dụ: "Tam giác" -> "TAM GIAC")
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
    return str.toUpperCase();
}

// --- HEURISTIC ENGINE (Bộ não phụ) ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) return;
    
    const text = removeVietnameseTones(problemText); 
    const points = geometry.points as any[];
    
    // 1. Map Label -> ID
    const labelMap: Record<string, string> = {};
    points.forEach(p => {
        if (p.label) {
            labelMap[p.label.toUpperCase()] = p.id;
        }
    });

    const ensureSegment = (id1: string, id2: string, style: string = 'solid') => {
        if (!id1 || !id2 || id1 === id2) return;
        if (!geometry.segments) geometry.segments = [];
        
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

    // --- A. TỰ ĐỘNG VẼ ĐƯỜNG TRÒN ---
    // Tìm: "DUONG TRON (O)", "TAM O", "(O)"
    const circleRegex = /(?:DUONG TRON|D\.TRON)\s*\(?([A-Z])\)?|TAM\s+([A-Z])|\(([A-Z])\)/g;
    let cMatch;
    while ((cMatch = circleRegex.exec(text)) !== null) {
        const centerLabel = cMatch[1] || cMatch[2] || cMatch[3];
        const centerId = labelMap[centerLabel];
        
        if (centerId) {
            if (!geometry.circles) geometry.circles = [];
            const hasCircle = geometry.circles.some((c: any) => c.centerId === centerId);
            
            if (!hasCircle) {
                // Heuristic tìm bán kính: Tìm điểm xa nhất có vẻ liên quan
                let radius = 150; // Mặc định
                let radiusPointId = undefined;
                const centerPt = points.find(p => p.id === centerId);
                
                if (centerPt) {
                    let maxDist = 0;
                    points.forEach(p => {
                        if (p.id !== centerId) {
                            const d = Math.hypot(p.x - centerPt.x, p.y - centerPt.y);
                            if (d > maxDist && d < 400) { 
                                maxDist = d;
                                radiusPointId = p.id; // Dùng điểm này làm điểm trên đường tròn
                            }
                        }
                    });
                    if (maxDist > 50) radius = maxDist;
                }

                geometry.circles.push({
                    id: generateId('c_auto'),
                    centerId: centerId,
                    radiusValue: radiusPointId ? undefined : radius,
                    radiusPointId: radiusPointId,
                    color: 'black',
                    style: 'solid'
                });
            }
        }
    }

    // --- B. TỰ ĐỘNG NỐI ĐA GIÁC ---
    // 1. "TAM GIAC ABC" -> Connect A-B-C-A
    const triRegex = /TAM GIAC\s+([A-Z]{3})/g;
    let match;
    while ((match = triRegex.exec(text)) !== null) {
        const labels = match[1];
        const p1 = labelMap[labels[0]], p2 = labelMap[labels[1]], p3 = labelMap[labels[2]];
        if(p1 && p2) ensureSegment(p1, p2);
        if(p2 && p3) ensureSegment(p2, p3);
        if(p3 && p1) ensureSegment(p3, p1);
    }

    // 2. "TU GIAC ABCD" ...
    const quadRegex = /(?:TU GIAC|HINH CHU NHAT|HINH VUONG|HINH THANG|HINH BINH HANH)\s+([A-Z]{4})/g;
    while ((match = quadRegex.exec(text)) !== null) {
        const labels = match[1];
        const p1 = labelMap[labels[0]], p2 = labelMap[labels[1]], p3 = labelMap[labels[2]], p4 = labelMap[labels[3]];
        if(p1 && p2) ensureSegment(p1, p2);
        if(p2 && p3) ensureSegment(p2, p3);
        if(p3 && p4) ensureSegment(p3, p4);
        if(p4 && p1) ensureSegment(p4, p1);
    }

    // 3. "CANH AB", "DOAN MN", "NOI O VOI A"
    const segRegex = /(?:CANH|DOAN|NOI|TIEP TUYEN|DUONG THANG)\s+(?:CUA\s+)?([A-Z])(?:\s+VOI\s+)?([A-Z])/g;
    while ((match = segRegex.exec(text)) !== null) {
        const p1 = labelMap[match[1]];
        const p2 = labelMap[match[2]];
        if (p1 && p2) ensureSegment(p1, p2);
    }

    // --- C. SAFETY NET (Lưới an toàn) ---
    // Nếu có > 2 điểm nhưng KHÔNG CÓ đường nối nào -> Nối vòng tròn để tạo hình
    const segmentCount = geometry.segments ? geometry.segments.length : 0;
    if (segmentCount === 0 && points.length >= 3) {
        // Chỉ áp dụng nếu số lượng điểm nhỏ (để tránh nối lung tung)
        if (points.length <= 6) {
            for (let i = 0; i < points.length; i++) {
                const current = points[i];
                const next = points[(i + 1) % points.length];
                ensureSegment(current.id, next.id);
            }
        }
    }
}

// Chuẩn hóa ID tham chiếu
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

// Căn giữa hình vẽ vào Canvas
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

// Hàm xử lý chính cho kết quả trả về từ AI
function normalizeAndResolve(result: any, originalText: string, resolvePromise: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    // Đảm bảo cấu trúc dữ liệu
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: result.explanation || "Đã tạo hình vẽ." };
    }
    if (!result.geometry) result.geometry = { points: [], segments: [], circles: [], angles: [], texts: [] };
    
    // Ưu tiên explanation từ AI nếu có, nếu không thì dùng text mặc định
    if (!result.explanation) result.explanation = "Đã tạo hình vẽ dựa trên phân tích đề bài.";

    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles', 'ellipses', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (!g[key]) g[key] = [];
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    // 1. Resolve IDs
    resolveGeometryReferences(g);

    // 2. HEURISTIC ENGINE (Quan trọng nhất: Nối điểm, Thêm vòng tròn)
    enhanceGeometryWithTextAnalysis(g, originalText);

    // 3. Resolve lại lần nữa cho các đối tượng mới tạo
    resolveGeometryReferences(g);

    // 4. Căn giữa
    scaleAndCenterGeometry(g);
    
    resolvePromise(result);
}

// --- MAIN EXPORT ---

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
    Yêu cầu:
    1. Trả về JSON để vẽ hình.
    2. Đảm bảo có đầy đủ "points", "segments" (nối các điểm), và "circles" (nếu có đường tròn).
    3. Cung cấp trường "explanation" giải thích cách dựng hình.
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
                  
                  // Áp dụng "Mắm dặm muối" (Heuristics + Logic)
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
          reject(new Error("Vui lòng chạy ứng dụng này trong môi trường AI Studio (Iframe)."));
      }
  });
};
