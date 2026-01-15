
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI: GEOMETRY ENGINE ---
const SYSTEM_INSTRUCTION = `
Bạn là "Geometry Solver" - Chuyên gia dựng hình học toán học.
Nhiệm vụ: Phân tích đề bài (Text hoặc Ảnh) và trả về dữ liệu JSON để vẽ hình.

--- QUY TẮC XỬ LÝ (QUAN TRỌNG) ---
1. **ƯU TIÊN TUYỆT ĐỐI**: Nếu người dùng nhập Text, hãy vẽ theo Text. Nếu Text rỗng, **BẮT BUỘC** phải đọc nội dung từ Ảnh (OCR).
2. **PHÂN TÍCH HÌNH HỌC**:
   - Khi thấy "Tam giác ABC", phải tự động tạo 3 đoạn thẳng: AB, BC, CA.
   - Khi thấy "Tứ giác ABCD", tạo 4 đoạn: AB, BC, CD, DA.
   - Khi thấy "Đường tròn (O)", tạo đường tròn tâm O.
3. **HỆ TRỤC**:
   - Canvas 1000x800. Gốc (0,0) trên-trái.
   - Tâm hình chính đặt tại (500, 400).
   - Chọn đơn vị độ dài lớn (ví dụ R=150) để hình rõ đẹp.

--- OUTPUT JSON FORMAT (BẮT BUỘC) ---
{
  "detected_text": "Trích xuất lại nguyên văn đề bài (đặc biệt quan trọng nếu dùng ảnh)",
  "points": [ 
    { "label": "A", "x": 500, "y": 200 }, 
    { "label": "B", "x": 300, "y": 600 } 
  ],
  "segments": [ 
    { "from": "A", "to": "B" }, 
    { "from": "B", "to": "C" }, 
    { "from": "C", "to": "A" } 
  ],
  "circles": [ 
    { "center": "O", "radiusPoint": "A" } 
  ]
}
Hãy chắc chắn rằng mọi điểm quan trọng đều được nối với nhau đúng theo đề bài. Đừng để các điểm rời rạc.
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

// --- BỘ MÁY NỐI ĐIỂM (FALLBACK) ---
// Chạy khi AI quên trả về "segments" hoặc khi cần bổ sung
function fallbackAutoConnect(geometry: any, problemText: string) {
    if (!problemText) return;

    const points = geometry.points as any[];
    const labelMap: Record<string, string> = {};
    const existingSegments = new Set<string>(); 

    // Index các segments đã có từ AI để tránh trùng
    if (!geometry.segments) geometry.segments = [];
    if (!geometry.circles) geometry.circles = [];
    
    geometry.segments.forEach((s: any) => {
        const k = [s.startPointId, s.endPointId].sort().join('-');
        existingSegments.add(k);
    });

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
        .replace(/TỨ GIÁC/g, "__QUAD__")
        .replace(/HÌNH CHỮ NHẬT/g, "__RECT__")
        .replace(/HÌNH VUÔNG/g, "__SQUARE__");

    // 1. Quét chuỗi điểm liên tục dính liền (ABC -> AB, BC)
    const sequenceRegex = /\b[A-Z]{2,}\b/g;
    let match;
    while ((match = sequenceRegex.exec(safeText)) !== null) {
        const str = match[0];
        let validPointsCount = 0;
        for (let char of str) if (labelMap[char]) validPointsCount++;
        
        // Nếu chuỗi chủ yếu là các điểm có thực (tránh từ viết tắt tiếng Anh nhầm lẫn)
        if (validPointsCount >= str.length * 0.7) { 
            for (let i = 0; i < str.length - 1; i++) {
                if (labelMap[str[i]] && labelMap[str[i+1]]) addSegment(str[i], str[i+1]);
            }
            // Nối khép kín nếu có từ khóa hình học phía trước
            const prefix = safeText.substring(Math.max(0, match.index - 20), match.index);
            if (prefix.includes("__TRI__") || prefix.includes("__QUAD__") || prefix.includes("__RECT__") || prefix.includes("__SQUARE__")) {
                if (labelMap[str[0]] && labelMap[str[str.length-1]]) addSegment(str[0], str[str.length-1]);
            }
        }
    }

    // 2. Quét chuỗi điểm có khoảng trắng (VD: "Tam giác A B C")
    // Regex tìm các chữ cái đơn lẻ đứng gần nhau
    const spacedRegex = /(?:__TRI__|__QUAD__|__RECT__|__SQUARE__|HÌNH)\s+([A-Z](?:\s*[,.-]?\s*[A-Z]){2,})/g;
    while ((match = spacedRegex.exec(safeText)) !== null) {
        const pointStr = match[1].replace(/[^A-Z]/g, ''); // Lọc lấy chỉ chữ cái
        if (pointStr.length >= 3) {
             for (let i = 0; i < pointStr.length - 1; i++) {
                addSegment(pointStr[i], pointStr[i+1]);
            }
            // Khép kín
            addSegment(pointStr[0], pointStr[pointStr.length-1]);
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

    // 4. Fallback Auto Connect
    // Sử dụng detected_text từ AI nếu userText quá ngắn hoặc rỗng
    // Logic mới: Luôn chạy fallback quét thêm text để bổ sung những đoạn mà AI có thể sót
    const textToScan = (userText && userText.trim().length > 5) ? userText : (result.detected_text || "");
    fallbackAutoConnect(g, textToScan);
    
    // 5. Scale & Center
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

    // Tránh lỗi chia cho 0 nếu tất cả điểm trùng nhau
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
  
  // LOGIC PROMPT MỚI: Phân biệt rõ trường hợp Text vs Ảnh
  let promptText = "";
  
  if (text && text.trim().length > 5) {
      // Có text -> Ưu tiên vẽ theo text
      promptText = `
        Đề bài (Text Input): "${text}"
        YÊU CẦU: Vẽ hình dựa trên nội dung văn bản trên. Trả về JSON gồm points, segments, circles.
      `;
  } else {
      // Không có text (hoặc quá ngắn) -> Bắt buộc đọc ảnh
      promptText = `
        INPUT LÀ HÌNH ẢNH ĐỀ BÀI TOÁN.
        NHIỆM VỤ:
        1. Đọc nội dung chữ trong ảnh (OCR) và điền vào trường "detected_text".
        2. Dựa vào nội dung đó, xác định các điểm và CÁC ĐOẠN THẲNG CẦN NỐI.
        3. Trả về JSON gồm points, segments (RẤT QUAN TRỌNG), circles.
        Ví dụ: Nếu ảnh có đề "Tam giác ABC", hãy trả về points A,B,C và segments AB,BC,CA.
      `;
  }

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
