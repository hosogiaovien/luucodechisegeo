
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI "GEOSMART EXPERT" ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Chuyên gia hình học.
Nhiệm vụ: Phân tích đề bài và trả về JSON để vẽ hình.

--- QUY TẮC JSON (BẮT BUỘC) ---
1. "points": [{ "id": "A", "x": 500, "y": 200, "label": "A" }, ...]
   - Canvas 1000x800. Tâm (500, 400).
   - Đặt tâm hình chính (O) tại (500, 400).
2. "segments": [{ "startPointId": "A", "endPointId": "B" }, ...]
   - QUAN TRỌNG: Phải nối các điểm thành hình (Tam giác, Tứ giác, Đường cao...).
3. "circles": [{ "centerId": "O", "radiusPointId": "A" }] 
   - Nếu có "Đường tròn (O)", BẮT BUỘC trả về object trong mảng "circles".
4. "explanation": "Giải thích ngắn gọn..."

KHÔNG dùng Markdown. Chỉ trả về JSON thuần.
`;

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

// Xử lý text thô để regex hoạt động tốt nhất
function normalizeTextForHeuristic(str: string): string {
    // 1. Xóa dấu tiếng Việt
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
    
    // 2. Chuyển về chữ hoa và xóa ký tự đặc biệt thừa
    return str.toUpperCase().replace(/[^A-Z0-9\s\(\)]/g, " ");
}

// --- HEURISTIC ENGINE (Bộ não phụ - Phiên bản Aggressive) ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) return;
    
    const text = normalizeTextForHeuristic(problemText); 
    const points = geometry.points as any[];
    
    // 1. AUTO-LABELING (Quan trọng: Gán nhãn nếu AI quên)
    let labelIndex = 0;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    points.forEach(p => {
        if (!p.label || p.label.trim() === "") {
            while (points.some(existing => existing.label === alphabet[labelIndex])) {
                labelIndex = (labelIndex + 1) % alphabet.length;
            }
            p.label = alphabet[labelIndex];
        }
    });

    // Map Label -> ID
    const labelMap: Record<string, string> = {};
    points.forEach(p => {
        if (p.label) labelMap[p.label.toUpperCase()] = p.id;
    });

    // Helper: Nối 2 điểm an toàn
    const ensureSegment = (id1: string, id2: string) => {
        if (!id1 || !id2 || id1 === id2) return;
        if (!geometry.segments) geometry.segments = [];
        
        // Kiểm tra trùng lặp
        const exists = geometry.segments.some((s: any) => 
            (s.startPointId === id1 && s.endPointId === id2) || 
            (s.startPointId === id2 && s.endPointId === id1)
        );

        if (!exists) {
            geometry.segments.push({
                id: generateId('s_auto'),
                startPointId: id1,
                endPointId: id2,
                style: 'solid',
                color: 'black',
                strokeWidth: 1.5
            });
        }
    };

    // --- A. TỰ ĐỘNG VẼ ĐƯỜNG TRÒN (Logic thông minh) ---
    // Quét: "DUONG TRON (O)" hoặc "TAM O"
    const circleRegex = /(?:DUONG TRON|D\.TRON)\s*\(?([A-Z])\)?|TAM\s+([A-Z])|\(([A-Z])\)/g;
    let cMatch;
    const centersProcessed = new Set<string>();

    while ((cMatch = circleRegex.exec(text)) !== null) {
        const centerLabel = cMatch[1] || cMatch[2] || cMatch[3];
        const centerId = labelMap[centerLabel];
        
        if (centerId && !centersProcessed.has(centerId)) {
            centersProcessed.add(centerId);
            if (!geometry.circles) geometry.circles = [];
            
            const hasCircle = geometry.circles.some((c: any) => c.centerId === centerId);
            if (!hasCircle) {
                // Heuristic tìm bán kính: Tìm điểm xa nhất có vẻ liên quan
                let radius = 120; // Mặc định
                let radiusPointId = undefined;
                const centerPt = points.find(p => p.id === centerId);
                
                if (centerPt) {
                    let candidates: {id: string, dist: number}[] = [];
                    points.forEach(p => {
                        if (p.id !== centerId) {
                            const d = Math.hypot(p.x - centerPt.x, p.y - centerPt.y);
                            if (d > 20 && d < 450) { 
                                candidates.push({id: p.id, dist: d});
                            }
                        }
                    });
                    
                    if (candidates.length > 0) {
                        // Ưu tiên điểm xuất hiện trong văn bản gần chữ "Đường tròn" hoặc "Bán kính"
                        // Nếu không, lấy điểm xa nhất để bao quát hình
                        candidates.sort((a,b) => b.dist - a.dist); 
                        radiusPointId = candidates[0].id;
                        radius = candidates[0].dist;
                    }
                }

                geometry.circles.push({
                    id: generateId('c_auto'),
                    centerId: centerId,
                    radiusPointId: radiusPointId,
                    radiusValue: radiusPointId ? undefined : radius,
                    color: 'black',
                    style: 'solid'
                });
            }
        }
    }

    // --- B. QUÉT MẠNH MẼ CÁC CẶP ĐIỂM (THE "OLD FILE" MAGIC) ---
    // Chiến thuật: Bất kỳ khi nào thấy 2 chữ cái in hoa đi liền nhau (ví dụ "AB", "OM", "MA")
    // Hoặc cách nhau bởi dấu cách/dấu bằng, hãy nối chúng lại.
    // Đây là cách xử lý "OM=3R", "tiếp tuyến MA", "vuông góc MO"
    
    // Pattern 1: Dính liền (AB, OM, MA...)
    const pairRegex = /([A-Z])([A-Z])/g;
    let pMatch;
    // Reset regex index just in case
    pairRegex.lastIndex = 0;
    
    while ((pMatch = pairRegex.exec(text)) !== null) {
        const l1 = pMatch[1];
        const l2 = pMatch[2];
        const p1 = labelMap[l1];
        const p2 = labelMap[l2];
        
        // Chỉ nối nếu cả 2 điểm thực sự tồn tại trong danh sách Points
        if (p1 && p2) {
            ensureSegment(p1, p2);
        }
    }

    // --- C. XỬ LÝ ĐA GIÁC (TAM GIAC ABC...) ---
    const polyRegex = /(?:TAM GIAC|TU GIAC|HINH CHU NHAT|HINH VUONG)\s+([A-Z\s]+)/g;
    let polyMatch;
    while ((polyMatch = polyRegex.exec(text)) !== null) {
        // Lấy chuỗi label "A B C" hoặc "ABC"
        const rawLabels = polyMatch[1].replace(/\s/g, "");
        if (rawLabels.length >= 3) {
            for (let i = 0; i < rawLabels.length; i++) {
                const l1 = rawLabels[i];
                const l2 = rawLabels[(i + 1) % rawLabels.length];
                const p1 = labelMap[l1];
                const p2 = labelMap[l2];
                if (p1 && p2) ensureSegment(p1, p2);
            }
        }
    }

    // --- D. SAFETY NET (LƯỚI AN TOÀN CUỐI CÙNG) ---
    // Nếu sau tất cả mà KHÔNG CÓ đoạn thẳng nào, nối tuần tự A->B->C->...->A
    // Đây là logic của file cũ mà bạn thích
    const segmentCount = geometry.segments ? geometry.segments.length : 0;
    if (segmentCount === 0 && points.length >= 2) {
        // Sắp xếp điểm theo thứ tự xuất hiện trong mảng (thường là thứ tự AI tạo ra)
        // Thay vì sort theo tọa độ (gây rối), ta nối theo index
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            // Nếu có ít điểm (<6), nối vòng tròn. Nếu nhiều điểm, nối hở để tránh rối.
            if (i < points.length - 1) {
                 ensureSegment(p1.id, points[i+1].id);
            } else if (points.length <= 5) {
                 // Đóng vòng cho ít điểm
                 ensureSegment(p1.id, points[0].id);
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
    
    const targetW = 600; 
    const targetH = 500;
    const scale = Math.min(targetW / width, targetH / height); 

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const targetX = 500;
    const targetY = 400;

    geometry.points.forEach((p: any) => {
        p.x = (p.x - centerX) * scale + targetX;
        p.y = (p.y - centerY) * scale + targetY;
    });
    
    if (geometry.circles) {
        geometry.circles.forEach((c: any) => { if(c.radiusValue) c.radiusValue *= scale; });
    }
}

function normalizeAndResolve(result: any, originalText: string, resolvePromise: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: result.explanation || "Đã dựng hình." };
    }
    if (!result.geometry) result.geometry = { points: [], segments: [], circles: [], angles: [], texts: [] };
    
    // Fallback explanation
    if (!result.explanation) result.explanation = "Hình vẽ được tạo dựa trên phân tích đề bài.";

    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles', 'ellipses', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (!g[key]) g[key] = [];
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    resolveGeometryReferences(g);
    
    // HEURISTIC ENGINE: Fill in the gaps (The MAGIC part)
    enhanceGeometryWithTextAnalysis(g, originalText);
    
    resolveGeometryReferences(g);
    scaleAndCenterGeometry(g);
    
    resolvePromise(result);
}

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
    YÊU CẦU:
    1. Points: Tọa độ hợp lý (Tâm 500,400).
    2. Segments: Nối các điểm tương ứng.
    3. Circles: Nếu có đường tròn, trả về "circles".
    4. Explanation: Giải thích.
    Trả về JSON.
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
