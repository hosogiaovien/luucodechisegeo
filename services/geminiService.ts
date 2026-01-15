
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI "GEOSMART EXPERT" (PHIÊN BẢN NÂNG CẤP) ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Chuyên gia hình học phẳng.
Nhiệm vụ: Chuyển đổi đề bài toán thành JSON tọa độ để vẽ hình chính xác.

--- QUY TẮC TỌA ĐỘ VÀ DỰNG HÌNH ---
1. **Canvas**: 1000x800. Tâm (500, 400).
2. **Đường tròn (O)**: Luôn đặt tâm O tại (500, 400). Bán kính R ~ 120-150.
3. **Tiếp tuyến (Tangent)**: 
   - Nếu "Tiếp tuyến tại A của (O)", điểm A nằm trên đường tròn.
   - Vẽ đoạn thẳng tiếp tuyến (ví dụ Ax) sao cho góc OAx = 90 độ.
4. **Đường kính (Diameter)**:
   - "Đường kính AB": A và B phải đối xứng qua tâm O.
5. **Dây cung (Chord)**:
   - "Dây cung CD": C và D nằm trên đường tròn.
6. **Đường cao (Altitude)**:
   - "Đường cao AH của tam giác ABC": H thuộc BC, vector AH vuông góc BC.
7. **Phân giác (Bisector)**:
   - "AD là phân giác góc A": Góc BAD = Góc CAD.
8. **Trung điểm (Midpoint)**:
   - "M là trung điểm BC": xM = (xB+xC)/2, yM = (yB+yC)/2.

--- CẤU TRÚC JSON TRẢ VỀ (KHÔNG MARKDOWN) ---
{
  "points": [
    { "id": "O", "x": 500, "y": 400, "label": "O" },
    { "id": "A", "x": 620, "y": 400, "label": "A" }
  ],
  "segments": [
    { "startPointId": "O", "endPointId": "A" }
  ],
  "circles": [
    { "centerId": "O", "radiusPointId": "A" }
  ],
  "explanation": "Giải thích ngắn gọn các bước dựng hình..."
}
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

// Chuẩn hóa văn bản để Heuristic "bắt" dính từ khóa tốt hơn
function normalizeTextForHeuristic(str: string): string {
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

// --- HEURISTIC ENGINE (BỘ NÃO PHỤ - PHIÊN BẢN CƯỜNG HÓA) ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) return;
    
    const text = normalizeTextForHeuristic(problemText); 
    const points = geometry.points as any[];
    
    // 1. AUTO-LABELING: Đảm bảo mọi điểm đều có nhãn
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

    // Hàm nối điểm an toàn
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

    // --- A. QUÉT CẶP ĐIỂM (LOGIC FILE CŨ - MẠNH MẼ) ---
    // Nối tất cả các cặp chữ cái viết hoa đi liền nhau hoặc cách nhau bởi ký tự đặc biệt
    // Ví dụ: "AB", "O, M", "MA", "vuông góc MO"
    const pairRegex = /([A-Z])[\s\.\-\=\,\;]*([A-Z])/g;
    let pMatch;
    pairRegex.lastIndex = 0;
    
    while ((pMatch = pairRegex.exec(text)) !== null) {
        const l1 = pMatch[1];
        const l2 = pMatch[2];
        const p1 = labelMap[l1];
        const p2 = labelMap[l2];
        
        // Cấm nối một số cặp phổ biến không phải đoạn thẳng nếu cần (ví dụ "CM" trong cm unit)
        // Nhưng ở đây ta ưu tiên vẽ đủ hơn vẽ thiếu.
        if (p1 && p2) {
            ensureSegment(p1, p2);
        }
    }

    // --- B. TỰ ĐỘNG PHÁT HIỆN VÀ VẼ ĐƯỜNG TRÒN ---
    // Tìm: "(O)", "Đường tròn tâm I", "(O; R)"
    const circleRegex = /(?:TRON|TAM|\()\s*([A-Z])/g;
    let cMatch;
    
    if (!geometry.circles) geometry.circles = [];
    const existingCenters = new Set(geometry.circles.map((c: any) => c.centerId));

    while ((cMatch = circleRegex.exec(text)) !== null) {
        const centerLabel = cMatch[1];
        const centerId = labelMap[centerLabel];
        
        if (centerId && !existingCenters.has(centerId)) {
            existingCenters.add(centerId);
            const centerPt = points.find(p => p.id === centerId);
            
            // Logic tìm bán kính:
            // Quét xem điểm nào trong danh sách points có khoảng cách ~R tiêu chuẩn hoặc xa nhất
            let radius = 120;
            let radiusPointId = undefined;
            
            if (centerPt) {
                let candidates: {id: string, dist: number, label: string}[] = [];
                points.forEach(p => {
                    if (p.id !== centerId) {
                        const d = Math.hypot(p.x - centerPt.x, p.y - centerPt.y);
                        // Chỉ xét các điểm có khoảng cách hợp lý
                        if (d > 30 && d < 600) { 
                            candidates.push({id: p.id, dist: d, label: p.label});
                        }
                    }
                });
                
                if (candidates.length > 0) {
                    // Ưu tiên 1: Điểm được nhắc đến cùng tâm O trong văn bản (VD: "bán kính OA")
                    // Ưu tiên 2: Điểm xa nhất (thường là điểm nằm trên đường tròn ngoại tiếp)
                    
                    // Tìm trong văn bản xem có cụm từ "O[X]" không (ví dụ OA, OB)
                    const mentionRegex = new RegExp(`${centerLabel}([A-Z])`, 'g');
                    let mMatch;
                    let mentionedPointId = null;
                    while ((mMatch = mentionRegex.exec(text)) !== null) {
                        const targetLabel = mMatch[1];
                        const cand = candidates.find(c => c.label === targetLabel);
                        if (cand) { mentionedPointId = cand.id; break; }
                    }

                    if (mentionedPointId) {
                        radiusPointId = mentionedPointId;
                    } else {
                        // Lấy điểm xa nhất làm bán kính (Heuristic cho bài toán tiếp tuyến/ngoại tiếp)
                        candidates.sort((a,b) => b.dist - a.dist);
                        radiusPointId = candidates[0].id;
                        radius = candidates[0].dist;
                    }
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

    // --- C. XỬ LÝ ĐA GIÁC ---
    const polyRegex = /(?:TAM GIAC|TU GIAC|HINH CHU NHAT|HINH VUONG)\s+([A-Z\s]+)/g;
    let polyMatch;
    while ((polyMatch = polyRegex.exec(text)) !== null) {
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

    // --- D. SAFETY NET (LƯỚI AN TOÀN) ---
    // Nếu quá ít đoạn thẳng, nối chuỗi để hình không bị rỗng
    const segmentCount = geometry.segments ? geometry.segments.length : 0;
    if (segmentCount < points.length / 1.5 && points.length > 2) {
        for (let i = 0; i < points.length - 1; i++) {
             ensureSegment(points[i].id, points[i+1].id);
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
    
    const targetW = 500; 
    const targetH = 400;
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
    
    if (!result.explanation) result.explanation = "Hình vẽ được tạo dựa trên phân tích đề bài.";

    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles', 'ellipses', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (!g[key]) g[key] = [];
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    resolveGeometryReferences(g);
    
    // --- KẾT HỢP SỨC MẠNH HEURISTIC (MAGIC) ---
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
  
  // Prompt đã được tối ưu hóa với các định nghĩa hình học
  const promptText = `
    Đề bài: "${text}"
    
    YÊU CẦU DỰNG HÌNH CHÍNH XÁC:
    1. Xác định các đối tượng: Điểm, Đoạn thẳng, Đường tròn (Tâm, Bán kính).
    2. Quan hệ hình học:
       - Tiếp tuyến (Tangent): Vuông góc bán kính tại tiếp điểm.
       - Đường kính (Diameter): Đi qua tâm.
       - Dây cung (Chord): Nối 2 điểm trên đường tròn.
       - Phân giác: Chia đôi góc.
       - Đường cao: Vuông góc cạnh đối diện.
    3. Trả về JSON chứa "points", "segments", "circles".
    4. Explanation: Giải thích ngắn gọn cách tính tọa độ.
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
