
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI "GEOSMART EXPERT" ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Chuyên gia hình học.
Nhiệm vụ: Phân tích đề bài và trả về JSON để vẽ hình.

--- QUY TẮC JSON (BẮT BUỘC) ---
1. "points": [{ "id": "A", "x": 500, "y": 200, "label": "A" }, ...]
   - Tọa độ Canvas: 1000x800. Tâm (500, 400).
   - Đặt tâm hình chính (như tâm đường tròn O) tại (500, 400).
2. "segments": [{ "startPointId": "A", "endPointId": "B" }, ...]
   - QUAN TRỌNG: Phải nối TẤT CẢ các điểm có quan hệ với nhau (cạnh tam giác, đường cao, bán kính, tiếp tuyến...).
3. "circles": [{ "centerId": "O", "radiusPointId": "A" }] 
   - Nếu đề bài có "Đường tròn (O)", BẮT BUỘC phải trả về mảng "circles".
4. "explanation": "Giải thích ngắn gọn các bước dựng hình và logic toán học..."

KHÔNG sử dụng Markdown. Chỉ trả về JSON thuần.
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

// --- BỘ NÃO PHÂN TÍCH VĂN BẢN (Improved) ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) return;
    
    const text = removeVietnameseTones(problemText); 
    const points = geometry.points as any[];
    
    // Map Label -> ID
    const labelMap: Record<string, string> = {};
    points.forEach(p => {
        if (p.label) labelMap[p.label.toUpperCase()] = p.id;
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

    // 1. TỰ ĐỘNG VẼ ĐƯỜNG TRÒN (QUAN TRỌNG)
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
            
            // Check nếu AI chưa vẽ
            const hasCircle = geometry.circles.some((c: any) => c.centerId === centerId);
            if (!hasCircle) {
                // Heuristic: Tìm điểm xa nhất có vẻ là bán kính (thường < 400px)
                // Ví dụ: Đề bài "Cho đường tròn (O), điểm M nằm ngoài..." -> O nối với điểm tiếp xúc
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
                    // Sắp xếp giảm dần, lấy điểm có khoảng cách hợp lý nhất (không quá xa)
                    // Thường các điểm trên đường tròn sẽ có khoảng cách xấp xỉ nhau.
                    if (candidates.length > 0) {
                        // Thử tìm cụm điểm (cluster) có khoảng cách gần nhau -> đó là bán kính
                        candidates.sort((a,b) => a.dist - b.dist);
                        // Lấy điểm trung vị hoặc điểm xuất hiện nhiều nhất? 
                        // Đơn giản: Lấy điểm đầu tiên trong nhóm lớn nhất (nếu có A, B thuộc đường tròn thì OA ~ OB)
                        radiusPointId = candidates[0].id; // Lấy điểm gần nhất làm tham chiếu (thường là bán kính)
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

    // 2. TỰ ĐỘNG NỐI CÁC CẶP ĐIỂM XUẤT HIỆN TRONG VĂN BẢN (Aggressive Connecting)
    // Tìm tất cả cặp 2 chữ cái in hoa đi liền: "AB", "OM", "MA", "CD"...
    // Đây là cách hiệu quả nhất để bắt "đoạn thẳng AB", "cạnh OM", "vectơ MA"
    const pairRegex = /\b([A-Z])([A-Z])\b/g;
    let pMatch;
    while ((pMatch = pairRegex.exec(text)) !== null) {
        const p1 = labelMap[pMatch[1]];
        const p2 = labelMap[pMatch[2]];
        // Chỉ nối nếu cả 2 điểm đều tồn tại trong danh sách Points
        if (p1 && p2) {
            ensureSegment(p1, p2);
        }
    }

    // 3. XỬ LÝ TAM GIÁC / TỨ GIÁC (Để đảm bảo khép kín)
    const polyRegex = /(?:TAM GIAC|TU GIAC|HINH CHU NHAT|HINH VUONG)\s+([A-Z]+)/g;
    let polyMatch;
    while ((polyMatch = polyRegex.exec(text)) !== null) {
        const labels = polyMatch[1];
        for (let i = 0; i < labels.length; i++) {
            const l1 = labels[i];
            const l2 = labels[(i + 1) % labels.length];
            const p1 = labelMap[l1];
            const p2 = labelMap[l2];
            if (p1 && p2) ensureSegment(p1, p2);
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
        result = { geometry: result, explanation: result.explanation || "Đã dựng hình xong." };
    }
    if (!result.geometry) result.geometry = { points: [], segments: [], circles: [], angles: [], texts: [] };
    
    // Đảm bảo explanation không bị mất
    if (!result.explanation) result.explanation = "Đã phân tích và dựng hình theo đề bài.";

    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles', 'ellipses', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (!g[key]) g[key] = [];
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    resolveGeometryReferences(g);
    
    // CHẠY HEURISTIC MỚI (Aggressive)
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
    
    YÊU CẦU DỰNG HÌNH:
    1. Points: Tính toán tọa độ hợp lý để hình vẽ cân đối (Tâm Canvas 500,400).
    2. Segments: Nối các cặp điểm liên quan (ví dụ: AB, OM, MA...).
    3. Circles: Nếu có đường tròn, trả về mảng "circles".
    4. Explanation: Viết lời giải thích ngắn gọn về cách dựng.
    
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
