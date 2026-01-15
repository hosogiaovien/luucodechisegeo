
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI: CHUYÊN GIA TỌA ĐỘ & OCR ---
const SYSTEM_INSTRUCTION = `
Bạn là "Geometry Solver". Nhiệm vụ:
1. Đọc hiểu đề bài toán hình học (từ văn bản hoặc hình ảnh).
2. Tính toán tọa độ (x, y) của các điểm quan trọng.
3. Trích xuất lại nội dung đề bài (OCR) để tôi có thể xử lý nối điểm.

--- QUY TẮC CỐT LÕI ---
1. **Hệ trục**: Canvas 1000x800. Gốc (0,0) góc trên-trái.
   - Đặt tâm hình (ví dụ tâm đường tròn ngoại tiếp) tại **(500, 400)**.
   - Trục Y hướng xuống.
2. **Output JSON**:
   {
     "points": [ { "id": "p1", "label": "A", "x": 500, "y": 200 }, ... ],
     "detected_text": "Trích xuất lại nguyên văn đề bài từ ảnh (nếu có) hoặc copy lại input.",
     "explanation": "Giải thích ngắn gọn cách dựng (tùy chọn)."
   }
3. **Logic**:
   - Nếu đề bài là ảnh, BẮT BUỘC phải điền trường "detected_text".
   - Tự chọn đơn vị độ dài hợp lý (ví dụ R=150) nếu đề không cho số cụ thể.
   - KHÔNG cần trả về segments/circles (code sẽ tự nối dựa trên "detected_text").
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

// --- BỘ MÁY DỰNG HÌNH TỰ ĐỘNG (AUTO-CONSTRUCTION ENGINE) ---
function autoConnectDots(geometry: any, problemText: string) {
    if (!geometry.points || geometry.points.length === 0) return;
    if (!problemText) return; // Không có text thì chịu thua

    const points = geometry.points as any[];
    const labelMap: Record<string, string> = {};
    const existingSegments = new Set<string>(); 

    points.forEach(p => {
        if (p.label) {
            const cleanLabel = p.label.trim().toUpperCase();
            labelMap[cleanLabel] = p.id;
            p.label = p.label.trim(); 
        }
    });

    if (!geometry.segments) geometry.segments = [];
    if (!geometry.circles) geometry.circles = [];

    const addSegment = (label1: string, label2: string) => {
        const id1 = labelMap[label1];
        const id2 = labelMap[label2];
        if (id1 && id2 && id1 !== id2) {
            const key = [id1, id2].sort().join('-');
            if (!existingSegments.has(key)) {
                existingSegments.add(key);
                geometry.segments.push({
                    id: generateId('s_auto'),
                    startPointId: id1,
                    endPointId: id2,
                    style: 'solid',
                    color: 'black',
                    strokeWidth: 1.5
                });
            }
        }
    };

    // 1. CHUẨN HÓA VĂN BẢN ĐỂ TRÁNH NHẦM LẪN
    // Thay thế các từ khóa bằng Token đặc biệt để không bị regex bắt nhầm các chữ cái trong đó (VD: I trong CIRCLE)
    let safeText = problemText.toUpperCase();
    
    const keywords = [
        { key: "ĐƯỜNG TRÒN", token: "__CIRCLE__" },
        { key: "TAM GIÁC", token: "__TRI__" },
        { key: "TỨ GIÁC", token: "__QUAD__" },
        { key: "HÌNH CHỮ NHẬT", token: "__RECT__" },
        { key: "HÌNH VUÔNG", token: "__SQUARE__" },
        { key: "ĐƯỜNG KÍNH", token: "__DIAMETER__" },
        { key: "BÁN KÍNH", token: "__RADIUS__" },
        { key: "TIẾP TUYẾN", token: "__TANGENT__" },
        { key: "CẮT", token: "__INTERSECT__" },
        { key: "TẠI", token: "__AT__" }
    ];

    keywords.forEach(kw => {
        safeText = safeText.replace(new RegExp(kw.key, 'g'), kw.token);
    });

    // 2. QUÉT CÁC CHUỖI ĐIỂM LIÊN TỤC (VD: "ABC", "MNPQ")
    // Regex tìm các chuỗi chữ cái in hoa liên tiếp (độ dài >= 2)
    // Lưu ý: Chỉ match nếu các chữ cái đó LÀ ĐIỂM ĐÃ BIẾT
    const sequenceRegex = /\b[A-Z]{2,}\b/g;
    let match;
    
    while ((match = sequenceRegex.exec(safeText)) !== null) {
        const str = match[0];
        // Kiểm tra xem chuỗi này có phải là tập hợp các điểm không hay là từ tiếng Anh/Việt chưa được replace
        let validPointsCount = 0;
        for (let i = 0; i < str.length; i++) {
            if (labelMap[str[i]]) validPointsCount++;
        }

        // Nếu đa số ký tự là điểm (trên 50%), ta coi đây là chuỗi điểm
        if (validPointsCount >= str.length / 2) {
            // Nối liền kề: A-B, B-C, C-D...
            for (let i = 0; i < str.length - 1; i++) {
                if (labelMap[str[i]] && labelMap[str[i+1]]) {
                    addSegment(str[i], str[i+1]);
                }
            }
            // Nếu có từ khóa tam giác/tứ giác phía trước, nối khép kín (Last -> First)
            const prefix = safeText.substring(Math.max(0, match.index - 15), match.index);
            if (prefix.includes("__TRI__") || prefix.includes("__QUAD__") || prefix.includes("__RECT__") || prefix.includes("__SQUARE__")) {
                if (labelMap[str[0]] && labelMap[str[str.length-1]]) {
                    addSegment(str[0], str[str.length-1]);
                }
            }
        }
    }

    // 3. QUÉT CẶP ĐIỂM CÁCH NHAU (A và B, A với B, đoạn AB)
    const splitRegex = /([A-Z])\s+(?:VÀ|VỚI|AND|WITH|-|\.|,)\s+([A-Z])/g;
    while ((match = splitRegex.exec(safeText)) !== null) {
        if (labelMap[match[1]] && labelMap[match[2]]) {
            addSegment(match[1], match[2]);
        }
    }

    // 4. XỬ LÝ ĐƯỜNG TRÒN
    const circleRegex = /(?:__CIRCLE__|TÂM|\()\s*([A-Z])/g;
    const processedCenters = new Set<string>();

    while ((match = circleRegex.exec(safeText)) !== null) {
        const centerLabel = match[1];
        const centerId = labelMap[centerLabel];

        if (centerId && !processedCenters.has(centerId)) {
            processedCenters.add(centerId);
            
            let radiusPointId = undefined;
            let radiusValue = 150; 

            // Logic tìm bán kính: Tìm điểm xa nhất trong danh sách có vẻ thuộc đường tròn
            const centerPt = points.find(p => p.id === centerId);
            if (centerPt) {
                let candidates: {id: string, dist: number}[] = [];
                points.forEach(p => {
                    if (p.id !== centerId) {
                        const d = Math.hypot(p.x - centerPt.x, p.y - centerPt.y);
                        // Lọc nhiễu: Bán kính không quá nhỏ hoặc quá lớn
                        if (d > 40 && d < 900) candidates.push({id: p.id, dist: d});
                    }
                });
                
                // Gom nhóm các điểm có khoảng cách xấp xỉ nhau
                if (candidates.length > 0) {
                    candidates.sort((a, b) => b.dist - a.dist);
                    // Lấy nhóm xa nhất làm bán kính
                    const maxDist = candidates[0].dist;
                    const onCircle = candidates.filter(c => Math.abs(c.dist - maxDist) < 20);
                    
                    if (onCircle.length > 0) {
                        radiusPointId = onCircle[0].id;
                        radiusValue = maxDist;
                    }
                }
            }

            geometry.circles.push({
                id: generateId('c_auto'),
                centerId: centerId,
                radiusPointId: radiusPointId,
                radiusValue: radiusPointId ? undefined : radiusValue,
                color: 'black',
                style: 'solid'
            });
        }
    }
}

function normalizeAndResolve(result: any, originalText: string, resolvePromise: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: result.explanation || "Đã dựng hình." };
    }
    
    if (!result.geometry) result.geometry = { points: [], segments: [], circles: [], angles: [], texts: [] };
    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles'].forEach(key => {
        if (!g[key]) g[key] = [];
    });

    g.points.forEach((p: any, index: number) => {
        if (!p.id) p.id = `p_${index}`;
        p.x = Number(p.x);
        p.y = Number(p.y);
        if (!p.label) {
            const alphabet = "ABCDEFGHIKLMNPQRSTUVWXYZ";
            p.label = alphabet[index % alphabet.length];
        }
    });

    // --- QUAN TRỌNG: SỬ DỤNG TEXT TỪ AI NẾU INPUT RỖNG ---
    // Nếu người dùng upload ảnh, originalText sẽ rỗng.
    // Ta dùng detected_text do AI đọc được để nối điểm.
    const textToScan = (result.detected_text && result.detected_text.length > originalText.length) 
        ? result.detected_text 
        : originalText;

    autoConnectDots(g, textToScan || ""); // Fallback empty string
    
    scaleAndCenterGeometry(g);
    resolvePromise(result);
}

function scaleAndCenterGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    geometry.points.forEach((p: any) => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    if (maxX - minX < 10) { maxX += 50; minX -= 50; }
    if (maxY - minY < 10) { maxY += 50; minY -= 50; }

    const width = maxX - minX;
    const height = maxY - minY;
    
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
        geometry.circles.forEach((c: any) => { 
            if(c.radiusValue) c.radiusValue *= scale; 
        });
    }
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
    1. Trả về JSON danh sách "points" có tọa độ chính xác.
    2. Nếu có ảnh, HÃY TRÍCH XUẤT LẠI ĐỀ BÀI vào trường "detected_text". Điều này rất quan trọng để tôi vẽ các đoạn thẳng.
    3. Hệ trục SVG (500,400) làm tâm.
  `;
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 300000; // 5 phút

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
                  if (!result) throw new Error("AI không trả về dữ liệu hợp lệ.");
                  
                  normalizeAndResolve(result, text, resolve);

              } catch (error: any) {
                  console.error("AI Processing Error:", error);
                  reject(new Error("Lỗi xử lý dữ liệu (JSON hỏng)."));
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
          reject(new Error("Hết thời gian chờ (5 phút)."));
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
          reject(new Error("Vui lòng chạy trong môi trường AI Studio."));
      }
  });
};
