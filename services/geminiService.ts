
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI "MATH ENGINE" ---
const SYSTEM_INSTRUCTION = `
Bạn là một "Geometry Engine" (Máy tính hình học) chính xác tuyệt đối. 
Nhiệm vụ: Dựng hình từ đề bài toán học, tính toán tọa độ (x,y) dựa trên các định lý hình học.

--- QUY TRÌNH TƯ DUY (BẮT BUỘC) ---
1. **Thiết lập hệ tọa độ**: 
   - Chọn tâm hình (thường là tâm đường tròn O hoặc một đỉnh tam giác) làm gốc tọa độ hoặc tâm Canvas (500, 400).
   - Chọn đơn vị độ dài chuẩn (ví dụ R = 150px).

2. **Tính toán tọa độ (QUAN TRỌNG NHẤT)**:
   - KHÔNG random tọa độ. Phải tính toán.
   - Ví dụ: "Cho đường tròn (O; R), điểm M sao cho OM = 2R".
     => O(500, 400). R=150. M(500 + 2*150, 400) = (800, 400).
   - Ví dụ: "Kẻ tiếp tuyến MA (A là tiếp điểm)".
     => Tam giác OAM vuông tại A. Dùng hệ thức lượng để tìm tọa độ A.
     => cos(MOA) = R/OM = 1/2 => Góc MOA = 60 độ.
     => A.x = O.x + R*cos(60), A.y = O.y - R*sin(60).

3. **Xác định đối tượng cần vẽ**:
   - Chỉ vẽ những đoạn thẳng có thực trong đề bài (Cạnh, đường cao, trung tuyến, tiếp tuyến).
   - Không nối các điểm không liên quan.

--- OUTPUT FORMAT (JSON ONLY) ---
{
  "points": [
    { "id": "O", "x": 500, "y": 400, "label": "O" },
    { "id": "M", "x": 800, "y": 400, "label": "M" },
    { "id": "A", "x": 575, "y": 270, "label": "A" }
  ],
  "segments": [
    { "startPointId": "O", "endPointId": "M", "style": "solid" },
    { "startPointId": "M", "endPointId": "A", "style": "solid" }, 
    { "startPointId": "O", "endPointId": "A", "style": "solid" }
  ],
  "circles": [
    { "centerId": "O", "radiusPointId": "A" }
  ],
  "angles": [
    { "centerId": "A", "point1Id": "O", "point2Id": "M", "isRightAngle": true }
  ],
  "explanation": "Giải thích ngắn gọn cách tính..."
}
`;

function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    // Tìm khối JSON đầu tiên và cuối cùng
    let clean = text.replace(/```json/gi, "").replace(/```/g, "");
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    try {
        // Fix lỗi dấu phẩy cuối cùng trong mảng/object thường gặp ở LLM
        clean = clean.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return null;
    }
}

// --- LOGIC XỬ LÝ DỮ LIỆU ---
// Không còn dùng Heuristic nối điểm bừa bãi. 
// Chỉ chuẩn hóa ID và đảm bảo dữ liệu hợp lệ.

function normalizeAndResolve(result: any, resolvePromise: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: result.explanation || "Đã dựng hình." };
    }
    
    // Khởi tạo structure nếu thiếu
    if (!result.geometry) result.geometry = { points: [], segments: [], circles: [], angles: [], texts: [] };
    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles'].forEach(key => {
        if (!g[key]) g[key] = [];
    });

    // 1. Map ID và Label
    // Đôi khi AI trả về ID khác nhau nhưng Label giống nhau, hoặc refer bằng Label
    const labelToId: Record<string, string> = {};
    const idMap: Record<string, boolean> = {};

    g.points.forEach((p: any) => {
        // Đảm bảo ID
        if (!p.id) p.id = generateId('p_ai');
        // Chuẩn hóa tọa độ về số
        p.x = Number(p.x);
        p.y = Number(p.y);
        
        idMap[p.id] = true;
        if (p.label) {
            labelToId[p.label.toUpperCase()] = p.id;
        }
    });

    // Hàm resolve reference (chuyển Label thành ID nếu cần)
    const resolveRef = (ref: string): string => {
        if (!ref) return ref;
        if (idMap[ref]) return ref; // Đã là ID đúng
        return labelToId[ref.toUpperCase()] || ref; // Thử tìm theo Label
    };

    // 2. Fix Segments
    if (g.segments) {
        const validSegments: any[] = [];
        g.segments.forEach((s: any) => {
            s.startPointId = resolveRef(s.startPointId);
            s.endPointId = resolveRef(s.endPointId);
            s.id = generateId('s_ai');
            
            // Chỉ giữ lại segment nếu cả 2 đầu mút đều tồn tại
            if (idMap[s.startPointId] && idMap[s.endPointId] && s.startPointId !== s.endPointId) {
                validSegments.push(s);
            }
        });
        g.segments = validSegments;
    }

    // 3. Fix Circles
    if (g.circles) {
        g.circles.forEach((c: any) => {
            c.id = generateId('c_ai');
            c.centerId = resolveRef(c.centerId);
            if (c.radiusPointId) c.radiusPointId = resolveRef(c.radiusPointId);
        });
        // Lọc circle hỏng
        g.circles = g.circles.filter((c: any) => idMap[c.centerId]);
    }

    // 4. Fix Angles
    if (g.angles) {
        g.angles.forEach((a: any) => {
            a.id = generateId('ang_ai');
            a.centerId = resolveRef(a.centerId);
            a.point1Id = resolveRef(a.point1Id);
            a.point2Id = resolveRef(a.point2Id);
        });
        g.angles = g.angles.filter((a: any) => idMap[a.centerId] && idMap[a.point1Id] && idMap[a.point2Id]);
    }

    // 5. Auto Scale & Center (Quan trọng: Đảm bảo hình nằm giữa màn hình bất kể AI tính hệ trục nào)
    scaleAndCenterGeometry(g);

    resolvePromise(result);
}

function scaleAndCenterGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;
    
    // Tìm bounding box của hệ tọa độ do AI tính
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    geometry.points.forEach((p: any) => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX;
    let height = maxY - minY;
    
    // Nếu AI trả về tất cả điểm trùng nhau hoặc lỗi
    if (width === 0) width = 100; 
    if (height === 0) height = 100;

    // Mục tiêu: Vẽ trong khung 600x500 ở giữa màn hình (Canvas 1000x800)
    // Scale sao cho hình vừa vặn, chừa lề
    const targetW = 500; 
    const targetH = 400;
    
    // Tính tỉ lệ scale
    const scaleX = targetW / width;
    const scaleY = targetH / height;
    const scale = Math.min(scaleX, scaleY); // Giữ tỉ lệ khung hình (aspect ratio)

    // Tâm của hình hiện tại
    const currentCenterX = (minX + maxX) / 2;
    const currentCenterY = (minY + maxY) / 2;

    // Tâm màn hình mong muốn
    const targetCenterX = 500;
    const targetCenterY = 400;

    // Áp dụng biến đổi
    geometry.points.forEach((p: any) => {
        p.x = (p.x - currentCenterX) * scale + targetCenterX;
        p.y = (p.y - currentCenterY) * scale + targetCenterY; // Flip Y nếu cần, nhưng SVG y xuống là dương, thường AI toán học y lên là dương. 
        // Tuy nhiên, Gemini thường trả về hệ SVG nếu prompt tốt. 
        // Để an toàn, ta giữ nguyên hướng trục Y của AI, chỉ scale.
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
  
  // Prompt nhấn mạnh vào việc TÍNH TOÁN (Math) thay vì VẼ (Draw)
  const promptText = `
    Đề bài toán học: "${text}"
    
    YÊU CẦU:
    1. Hãy đóng vai một phần mềm hình học động (như GeoGebra).
    2. Tự thiết lập một hệ trục tọa độ phù hợp.
    3. TÍNH TOÁN chính xác tọa độ (x, y) của các điểm dựa trên đề bài. 
       - Ví dụ: Tam giác đều cạnh 100 => A(0,0), B(100,0), C(50, 86.6).
       - Ví dụ: Tiếp tuyến => Phải vuông góc với bán kính.
    4. Xác định chính xác các đoạn thẳng (segments) cần nối. KHÔNG nối thừa.
    5. Trả về kết quả dưới dạng JSON.
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
                  if (!result) throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi.");
                  
                  normalizeAndResolve(result, resolve);

              } catch (error: any) {
                  console.error("AI Processing Error:", error);
                  reject(new Error("Lỗi xử lý dữ liệu toán học."));
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
                  model: 'gemini-3-pro-preview', // Dùng model mạnh nhất về Logic/Math
                  contents: [{ parts: parts }],
                  config: {
                      systemInstruction: SYSTEM_INSTRUCTION,
                      responseMimeType: "application/json",
                      thinkingConfig: { thinkingBudget: 16000 } // Bật chế độ suy nghĩ sâu
                  }
              }
          }, '*');
      } else {
          console.warn("Standalone Mode: Chức năng AI yêu cầu chạy trong môi trường AI Studio.");
          reject(new Error("Vui lòng chạy ứng dụng này trong môi trường AI Studio (Iframe)."));
      }
  });
};
