
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI: GEOMETRY ENGINE ---
const SYSTEM_INSTRUCTION = `
Bạn là "Geometry Solver" - Chuyên gia dựng hình học.
Nhiệm vụ: Phân tích đề bài (Text hoặc Ảnh) và trả về dữ liệu dựng hình JSON.

--- INPUT LOGIC ---
1. Ưu tiên nội dung trong "Text Input" nếu nó là đề bài toán.
2. Nếu "Text Input" rỗng hoặc chỉ là lệnh (vd: "vẽ bài này", "giải giúp"), hãy OCR đọc đề từ Ảnh (nếu có).

--- OUTPUT JSON FORMAT ---
{
  "points": [ { "id": "p1", "label": "A", "x": 500, "y": 200 }, ... ],
  "segments": [ { "from": "A", "to": "B" }, { "from": "B", "to": "C" } ... ],
  "circles": [ { "center": "O", "radiusPoint": "A" } ],
  "detected_text": "Nội dung đề bài nhận diện được (nếu dùng ảnh)",
  "explanation": "Giải thích ngắn gọn."
}

--- QUY TẮC DỰNG HÌNH ---
1. **Tọa độ**: Canvas 1000x800. Gốc (0,0) trên-trái. Tâm hình chính tại **(500, 400)**.
2. **Segments**: BẮT BUỘC liệt kê các đoạn thẳng cần vẽ. Đừng để người dùng tự nối.
   - Ví dụ: Tam giác ABC -> segments: AB, BC, CA.
3. **Circles**: Liệt kê đường tròn nếu có.
4. Chọn đơn vị độ dài hợp lý (ví dụ R=150) để hình to, rõ, đẹp.
`;

function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    // Tìm JSON block đầu tiên và cuối cùng để tránh rác
    let clean = text.replace(/```json/gi, "").replace(/```/g, "");
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    try {
        // Sửa lỗi JSON phổ biến do AI sinh ra
        clean = clean.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return null;
    }
}

// --- BỘ MÁY NỐI ĐIỂM (FALLBACK) ---
// Chỉ chạy khi AI quên trả về "segments" trong JSON
function fallbackAutoConnect(geometry: any, problemText: string) {
    // Logic cũ: quét văn bản để nối điểm (AB, BC...)
    // Chỉ dùng khi AI không trả về segments rõ ràng
    if (!geometry.segments) geometry.segments = [];
    if (!geometry.circles) geometry.circles = [];
    if (geometry.segments.length > 0) return; // AI đã làm tốt, không cần can thiệp

    if (!problemText) return;

    const points = geometry.points as any[];
    const labelMap: Record<string, string> = {};
    const existingSegments = new Set<string>(); 

    points.forEach(p => {
        if (p.label) labelMap[p.label.trim().toUpperCase()] = p.id;
    });

    const addSegment = (label1: string, label2: string) => {
        const id1 = labelMap[label1];
        const id2 = labelMap[label2];
        if (id1 && id2 && id1 !== id2) {
            const key = [id1, id2].sort().join('-');
            if (!existingSegments.has(key)) {
                existingSegments.add(key);
                geometry.segments.push({
                    id: generateId('s_auto'),
                    startPointId: id1, endPointId: id2,
                    style: 'solid', color: 'black', strokeWidth: 1.5
                });
            }
        }
    };

    let safeText = problemText.toUpperCase()
        .replace(/ĐƯỜNG TRÒN/g, "__CIRCLE__")
        .replace(/TAM GIÁC/g, "__TRI__")
        .replace(/TỨ GIÁC/g, "__QUAD__");

    // 1. Quét chuỗi điểm liên tục (ABC -> AB, BC)
    const sequenceRegex = /\b[A-Z]{2,}\b/g;
    let match;
    while ((match = sequenceRegex.exec(safeText)) !== null) {
        const str = match[0];
        let validPointsCount = 0;
        for (let char of str) if (labelMap[char]) validPointsCount++;
        
        if (validPointsCount >= str.length * 0.7) { // Nếu đa số là điểm
            for (let i = 0; i < str.length - 1; i++) {
                if (labelMap[str[i]] && labelMap[str[i+1]]) addSegment(str[i], str[i+1]);
            }
            // Nối khép kín nếu là đa giác
            const prefix = safeText.substring(Math.max(0, match.index - 15), match.index);
            if (prefix.includes("__TRI__") || prefix.includes("__QUAD__")) {
                if (labelMap[str[0]] && labelMap[str[str.length-1]]) addSegment(str[0], str[str.length-1]);
            }
        }
    }
}

function normalizeAndResolve(result: any, userText: string, resolvePromise: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: result.explanation || "Đã dựng hình." };
    }
    
    if (!result.geometry) result.geometry = { points: [], segments: [], circles: [], angles: [], texts: [] };
    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles'].forEach(key => {
        if (!g[key]) g[key] = [];
    });

    // 1. Chuẩn hóa Points
    const labelToId: Record<string, string> = {};
    g.points.forEach((p: any, index: number) => {
        if (!p.id) p.id = `p_${index}`;
        p.x = Number(p.x);
        p.y = Number(p.y);
        if (!p.label) {
            const alphabet = "ABCDEFGHIKLMNPQRSTUVWXYZ";
            p.label = alphabet[index % alphabet.length];
        }
        labelToId[p.label.trim().toUpperCase()] = p.id;
    });

    // 2. Xử lý Segments từ AI (Ưu tiên số 1)
    if (result.segments && Array.isArray(result.segments)) {
        result.segments.forEach((seg: any) => {
            const fromId = labelToId[seg.from?.trim().toUpperCase()];
            const toId = labelToId[seg.to?.trim().toUpperCase()];
            if (fromId && toId) {
                g.segments.push({
                    id: generateId('s_ai'),
                    startPointId: fromId,
                    endPointId: toId,
                    style: 'solid', color: 'black', strokeWidth: 1.5
                });
            }
        });
    }

    // 3. Xử lý Circles từ AI
    if (result.circles && Array.isArray(result.circles)) {
        result.circles.forEach((c: any) => {
            const centerId = labelToId[c.center?.trim().toUpperCase()];
            const radiusId = labelToId[c.radiusPoint?.trim().toUpperCase()];
            if (centerId) {
                g.circles.push({
                    id: generateId('c_ai'),
                    centerId: centerId,
                    radiusPointId: radiusId,
                    radiusValue: radiusId ? undefined : (c.radius || 150),
                    style: 'solid', color: 'black', strokeWidth: 1.5
                });
            }
        });
    }

    // 4. Fallback Auto Connect (Nếu AI lười không trả segments)
    // Dùng detected_text từ AI nếu userText quá ngắn
    const textToScan = (userText && userText.length > 10) ? userText : (result.detected_text || "");
    fallbackAutoConnect(g, textToScan);
    
    // 5. Scale & Center
    scaleAndCenterGeometry(g);
    
    // Clean up temp fields from AI JSON result so they don't pollute GeometryData
    delete result.segments; 
    delete result.circles;
    
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
    Đề bài (Text Input): "${text}"
    
    YÊU CẦU QUAN TRỌNG:
    1. Nếu "Text Input" có nội dung toán học cụ thể, hãy vẽ theo đó.
    2. Nếu "Text Input" rỗng hoặc chung chung, HÃY DÙNG ẢNH ĐỂ GIẢI.
    3. Output JSON MẪU:
       {
         "detected_text": "...",
         "points": [ {"label":"A", "x":..., "y":...}, ... ],
         "segments": [ {"from":"A", "to":"B"}, {"from":"B", "to":"C"}, {"from":"C", "to":"A"} ... ],
         "circles": [ {"center":"O", "radiusPoint":"A"} ]
       }
    4. CỰC KỲ QUAN TRỌNG: Hãy liệt kê rõ "segments" (các đoạn thẳng) để tôi biết nối điểm nào với điểm nào. Đừng chỉ trả về mỗi points.
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
