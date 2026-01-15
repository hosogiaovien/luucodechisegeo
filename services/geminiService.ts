
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI "GEOSMART EXPERT" ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Chuyên gia hình học.
Nhiệm vụ: Phân tích đề bài và trả về JSON để vẽ hình.

--- QUY TẮC QUAN TRỌNG ---
1. **Tọa độ (Points)**:
   - Hệ tọa độ SVG 1000x800. Tâm màn hình là (500, 400).
   - Luôn đặt tâm hình chính (ví dụ tâm đường tròn O) tại (500, 400).
   - Các điểm khác tính toán tương đối theo tâm này. Bán kính R thường khoảng 100-150 đơn vị.
   
2. **Cấu trúc JSON trả về**:
   - "points": [{ "id": "A", "x": 500, "y": 250, "label": "A" }, ...]
   - "segments": [{ "startPointId": "A", "endPointId": "B" }, ...] (Nối các điểm liên quan)
   - "circles": [{ "centerId": "O", "radiusPointId": "A" }] (Nếu có đường tròn)
   - "explanation": "Giải thích ngắn gọn cách dựng..."

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

// Hàm chuẩn hóa văn bản để quét heuristic tốt hơn
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
    
    // 2. Chuyển về chữ hoa và giữ lại ký tự chữ cái + số
    return str.toUpperCase();
}

// --- SUPER HEURISTIC ENGINE (Bộ não phụ - Phục hồi sức mạnh cũ) ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) return;
    
    const text = normalizeTextForHeuristic(problemText); 
    const points = geometry.points as any[];
    
    // 1. AUTO-LABELING: Nếu AI quên đặt tên điểm, tự gán A, B, C...
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

    // Map Label -> ID để tra cứu nhanh
    const labelMap: Record<string, string> = {};
    points.forEach(p => {
        if (p.label) labelMap[p.label.toUpperCase()] = p.id;
    });

    // Hàm tạo đoạn thẳng an toàn (không trùng lặp)
    const ensureSegment = (id1: string, id2: string) => {
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
                style: 'solid',
                color: 'black',
                strokeWidth: 1.5
            });
        }
    };

    // --- A. CHIẾN THUẬT "QUÉT CẶP ĐÔI" (OLD SCHOOL MAGIC) ---
    // Tìm bất kỳ cặp 2 chữ cái in hoa nào đi liền hoặc gần nhau
    // Ví dụ: "AB", "OM", "MA", "vuông góc tại H"
    // Regex này bắt: AB, O M, M.A
    const pairRegex = /([A-Z])[\s\.\-\=]*([A-Z])/g;
    let pMatch;
    
    // Reset lastIndex để quét từ đầu
    pairRegex.lastIndex = 0;
    
    while ((pMatch = pairRegex.exec(text)) !== null) {
        const l1 = pMatch[1];
        const l2 = pMatch[2];
        const p1 = labelMap[l1];
        const p2 = labelMap[l2];
        
        // Nếu cả 2 điểm đều tồn tại trong danh sách Points -> NỐI NGAY
        if (p1 && p2) {
            ensureSegment(p1, p2);
        }
    }

    // --- B. TỰ ĐỘNG VẼ ĐƯỜNG TRÒN (AUTO CIRCLE) ---
    // Quét các cụm từ như: "Đường tròn (O)", "Tâm I", "(O;R)"
    const circleRegex = /(?:TRON|TAM|\()\s*([A-Z])/g;
    let cMatch;
    
    if (!geometry.circles) geometry.circles = [];
    const existingCenters = new Set(geometry.circles.map((c: any) => c.centerId));

    while ((cMatch = circleRegex.exec(text)) !== null) {
        const centerLabel = cMatch[1];
        const centerId = labelMap[centerLabel];
        
        if (centerId && !existingCenters.has(centerId)) {
            existingCenters.add(centerId);
            
            // Logic tìm bán kính thông minh:
            // 1. Tìm điểm xa nhất mà có kết nối với tâm (thường là điểm nằm trên đường tròn)
            // 2. Nếu không có, mặc định R = 120
            let radius = 120;
            let radiusPointId = undefined;
            const centerPt = points.find(p => p.id === centerId);
            
            if (centerPt) {
                let candidates: {id: string, dist: number}[] = [];
                points.forEach(p => {
                    if (p.id !== centerId) {
                        const d = Math.hypot(p.x - centerPt.x, p.y - centerPt.y);
                        // Lọc các điểm có khoảng cách hợp lý (không quá gần, không quá xa)
                        if (d > 30 && d < 500) { 
                            candidates.push({id: p.id, dist: d});
                        }
                    }
                });
                
                if (candidates.length > 0) {
                    // Sắp xếp giảm dần theo khoảng cách -> Lấy điểm xa nhất làm bán kính
                    // Vì trong bài toán đường tròn ngoại tiếp, các đỉnh thường nằm trên đường tròn
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

    // --- C. XỬ LÝ ĐA GIÁC (TAM GIAC, TU GIAC) ---
    // Đảm bảo các hình cơ bản được nối kín
    const polyRegex = /(?:TAM GIAC|TU GIAC|HINH CHU NHAT|HINH VUONG)\s+([A-Z\s]+)/g;
    let polyMatch;
    while ((polyMatch = polyRegex.exec(text)) !== null) {
        const rawLabels = polyMatch[1].replace(/\s/g, ""); // "ABC"
        if (rawLabels.length >= 3) {
            for (let i = 0; i < rawLabels.length; i++) {
                const l1 = rawLabels[i];
                const l2 = rawLabels[(i + 1) % rawLabels.length]; // Nối vòng lại điểm đầu
                const p1 = labelMap[l1];
                const p2 = labelMap[l2];
                if (p1 && p2) ensureSegment(p1, p2);
            }
        }
    }

    // --- D. SAFETY NET (Lưới an toàn cuối cùng) ---
    // Nếu hình vẫn quá rời rạc (ít đoạn thẳng), nối các điểm theo thứ tự xuất hiện
    const segmentCount = geometry.segments ? geometry.segments.length : 0;
    if (segmentCount < points.length - 1 && points.length > 1) {
        // Nối chuỗi A->B->C... để ít nhất người dùng thấy được mối quan hệ
        for (let i = 0; i < points.length - 1; i++) {
             ensureSegment(points[i].id, points[i+1].id);
        }
        // Nếu ít điểm (<5), nối điểm cuối về đầu tạo vòng kín
        if (points.length <= 5) {
             ensureSegment(points[points.length-1].id, points[0].id);
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
    
    // Tìm giới hạn (bounding box) của hình vẽ hiện tại
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    geometry.points.forEach((p: any) => {
        p.x = Number(p.x); p.y = Number(p.y);
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX || 1;
    let height = maxY - minY || 1;
    
    // Scale hình về kích thước chuẩn (khoảng 500x400) để dễ nhìn
    const targetW = 500; 
    const targetH = 400;
    const scale = Math.min(targetW / width, targetH / height); 

    // Dịch chuyển về tâm màn hình (500, 400)
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
    
    if (!result.explanation) result.explanation = "Hình vẽ được tạo dựa trên phân tích đề bài.";

    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles', 'ellipses', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (!g[key]) g[key] = [];
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    resolveGeometryReferences(g);
    
    // --- BƯỚC QUAN TRỌNG NHẤT: HEURISTIC ENGINE ---
    // Phân tích văn bản để điền vào chỗ trống mà AI bỏ sót
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
  
  // Prompt đã được tối ưu hóa để yêu cầu JSON chuẩn
  const promptText = `
    Đề bài: "${text}"
    YÊU CẦU:
    1. Points: Tính toán tọa độ (Tâm 500,400).
    2. Segments: Nối các điểm.
    3. Circles: Nếu đề có "đường tròn (O)", BẮT BUỘC trả về "circles": [{"centerId": "O", ...}].
    4. Explanation: Giải thích ngắn gọn.
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
