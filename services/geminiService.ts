
import { AIResponse, GeometryData, Point } from "../types";
import { generateId } from "../utils/geometry";

// --- HỆ THỐNG CHỈ DẪN CAO CẤP (SUPER PROMPT V5 - GEOMETRY ENGINE) ---
// Đây là phần "Hồn" quan trọng nhất, nằm an toàn trên Vercel
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Pro" - Một Engine tính toán hình học chính xác tuyệt đối.
Nhiệm vụ: Chuyển đổi đề bài toán học (Văn bản hoặc Hình ảnh) thành dữ liệu JSON để render lên Canvas SVG (1000x800).

--- QUY TẮC TÍNH TOÁN TỌA ĐỘ (BẮT BUỘC) ---
1. **HỆ TỌA ĐỘ**: 
   - Gốc (0,0) ở góc trên bên trái. Tâm màn hình khoảng (500, 400).
   - Hãy đặt hình vẽ vào giữa màn hình. Ví dụ: Điểm chính giữa của hình nên ở (500, 400).
   - Đơn vị: 1 đơn vị toán học ≈ 50 pixel.

2. **LOGIC HÌNH HỌC (QUAN TRỌNG NHẤT)**:
   - Đừng đoán tọa độ ngẫu nhiên. Hãy tính toán!
   - Nếu "Tam giác đều ABC cạnh a": A=(500, 200), B=(300, 546), C=(700, 546). (Tính theo sin/cos 60 độ).
   - Nếu "Hình vuông ABCD": Các cạnh phải bằng nhau và vuông góc tuyệt đối.
   - Nếu "Đường tròn tâm O": O=(500, 400).
   - **Tuyệt đối không để các điểm dính chùm vào nhau.** Khoảng cách giữa các điểm nối với nhau tối thiểu phải là 100 đơn vị.

3. **CẤU TRÚC JSON**:
{
  "geometry": {
    "points": [
      { "id": "A", "x": 500, "y": 200, "label": "A" },
      { "id": "B", "x": 300, "y": 500, "label": "B" }
    ],
    "segments": [
      { "startPointId": "A", "endPointId": "B", "style": "solid" }
    ],
    "circles": [
      { "centerId": "O", "radiusPointId": "A", "label": "(O)" }
    ],
    "angles": [
      { "centerId": "A", "point1Id": "B", "point2Id": "C", "isRightAngle": true }
    ],
    "texts": [
      { "x": 500, "y": 600, "text": "Hinh 1", "fontSize": 20 }
    ]
  },
  "explanation": "Giải thích ngắn gọn các bước dựng hình..."
}

--- XỬ LÝ ĐẦU VÀO ---
- **NẾU LÀ ẢNH**: Phân tích topo học của hình. Điểm nào nối điểm nào? Có góc vuông không? Có song song không? Dựng lại hình chuẩn dựa trên logic đó (đừng copy độ méo của ảnh tay vẽ).
- **NẾU LÀ TEXT**: Phân tích từ khóa: "Vuông tại", "Đều", "Cân", "Nội tiếp", "Trọng tâm".
`;

function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    
    let clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    // Tìm JSON object
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }

    try {
        return JSON.parse(clean);
    } catch (e) {
        console.warn("JSON lỗi nhẹ, đang fix...", e);
        try {
            clean = clean
                .replace(/,\s*([\]}])/g, '$1') // Xóa dấu phẩy thừa cuối mảng/object
                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Quote key
                .replace(/'/g, '"'); // Single quote -> Double quote
            return JSON.parse(clean);
        } catch (e2) {
            console.error("JSON Error Fatal:", clean);
            return null;
        }
    }
}

function removeVietnameseTones(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

// --- LOGIC HẬU XỬ LÝ (GIỮ NGUYÊN ĐỂ ĐẢM BẢO CHẤT LƯỢNG HÌNH) ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) return;
    const textUpper = removeVietnameseTones(problemText).toUpperCase();
    const idMap: Record<string, any> = {};
    const labelMap: Record<string, any> = {};

    geometry.points.forEach((p: any) => {
        idMap[p.id] = p;
        if (p.label) labelMap[p.label.toUpperCase()] = p;
    });

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
                startPointId: id1, endPointId: id2,
                style: 'solid', color: 'black', strokeWidth: 1.5
            });
        }
    };

    const ensureRightAngle = (centerId: string, p1Id: string, p2Id: string) => {
        if (!geometry.angles) geometry.angles = [];
        const exists = geometry.angles.some((a: any) => a.centerId === centerId);
        if (!exists) {
            geometry.angles.push({
                id: generateId('ang_auto'),
                centerId: centerId, point1Id: p1Id, point2Id: p2Id,
                isRightAngle: true, color: 'black', strokeWidth: 1.5
            });
        }
    };

    const triRegex = /TAM GIAC ([A-Z]{3})/g;
    let match;
    while ((match = triRegex.exec(textUpper)) !== null) {
        const [A, B, C] = match[1].split('');
        if (labelMap[A] && labelMap[B]) ensureSegment(labelMap[A].id, labelMap[B].id);
        if (labelMap[B] && labelMap[C]) ensureSegment(labelMap[B].id, labelMap[C].id);
        if (labelMap[C] && labelMap[A]) ensureSegment(labelMap[C].id, labelMap[A].id);
    }

    const rightAtRegex = /VUONG TAI ([A-Z])/g;
    while ((match = rightAtRegex.exec(textUpper)) !== null) {
        const centerLbl = match[1];
        const centerPt = labelMap[centerLbl];
        if (centerPt) {
            const connectedPoints = (geometry.segments || [])
                .filter((s: any) => s.startPointId === centerPt.id || s.endPointId === centerPt.id)
                .map((s: any) => s.startPointId === centerPt.id ? s.endPointId : s.startPointId);
            
            if (connectedPoints.length >= 2) {
                ensureRightAngle(centerPt.id, connectedPoints[0], connectedPoints[1]);
            }
        }
    }
}

function fixAndScaleGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;
    const seen = new Set();
    geometry.points.forEach((p: any) => {
        const key = `${Math.round(p.x)},${Math.round(p.y)}`;
        if (seen.has(key)) { p.x += (Math.random() - 0.5) * 50; p.y += (Math.random() - 0.5) * 50; }
        seen.add(key);
    });

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    geometry.points.forEach((p: any) => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    const width = maxX - minX;
    const height = maxY - minY;
    const TARGET_W = 600;
    const TARGET_H = 500;
    const CENTER_X = 500;
    const CENTER_Y = 400;
    const safeW = width === 0 ? 1 : width;
    const safeH = height === 0 ? 1 : height;

    let scale = 1;
    if (safeW < 100 && safeH < 100) scale = 50;
    else {
        const scaleX = TARGET_W / safeW;
        const scaleY = TARGET_H / safeH;
        scale = Math.min(scaleX, scaleY, 1.5);
        if (scale < 0.2) scale = 0.2;
    }

    const currentCX = (minX + maxX) / 2;
    const currentCY = (minY + maxY) / 2;

    geometry.points.forEach((p: any) => {
        p.x = CENTER_X + (p.x - currentCX) * scale;
        p.y = CENTER_Y + (p.y - currentCY) * scale;
    });
}

function resolveGeometryReferences(geometry: any) {
    if (!geometry.points) return;
    const labelToId: Record<string, string> = {};
    const idMap: Record<string, any> = {};

    geometry.points.forEach((p: any) => {
        idMap[p.id] = p;
        if (p.label) labelToId[p.label.toUpperCase()] = p.id;
    });

    const resolve = (ref: string) => {
        if (!ref) return ref;
        if (idMap[ref]) return ref; 
        return labelToId[ref.toUpperCase()] || ref; 
    };

    ['segments', 'lines', 'rays', 'circles', 'arcs', 'angles', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (geometry[key]) {
            geometry[key].forEach((item: any) => {
                for (const prop in item) {
                    if (prop.endsWith('Id') && typeof item[prop] === 'string') {
                        item[prop] = resolve(item[prop]);
                    }
                }
            });
            geometry[key] = geometry[key].filter((item: any) => {
                for (const prop in item) {
                    if (prop.endsWith('Id') && typeof item[prop] === 'string') {
                        if (!idMap[item[prop]]) return false;
                    }
                }
                return true;
            });
        }
    });
}

// --- CẦU NỐI COMMUNICATION (BRIDGE) ---
export const parseGeometryProblem = async (
  text: string,
  base64Image?: string,
  mimeType: string = "image/jpeg"
): Promise<AIResponse> => {
  
  return new Promise((resolve, reject) => {
      // 1. Tạo Request ID để khớp phản hồi
      const requestId = Date.now().toString();
      const TIMEOUT = 90000; // 90 giây cho an toàn

      const cleanup = () => {
          window.removeEventListener('message', handleMessage);
          clearTimeout(timeoutId);
      };

      // 2. Lắng nghe phản hồi từ "Da" (AI Studio)
      const handleMessage = (event: MessageEvent) => {
          // Kiểm tra đúng loại message và ID
          if (event.data?.type === 'GEMINI_RESULT' && event.data?.requestId === requestId) {
              cleanup();
              try {
                  const rawText = event.data.text;
                  const result = cleanAndParseJSON(rawText);
                  
                  if (!result) throw new Error("AI trả về dữ liệu không đúng định dạng JSON.");
                  
                  // Chạy Hậu Xử Lý tại Vercel (Hồn)
                  normalizeAndResolve(result, text, resolve);

              } catch (error: any) {
                  console.error("Processing Error:", error);
                  reject(new Error("Lỗi xử lý dữ liệu từ AI: " + error.message));
              }
          }

          if (event.data?.type === 'GEMINI_ERROR' && event.data?.requestId === requestId) {
              cleanup();
              reject(new Error(event.data.error || "Lỗi kết nối đến Gemini AI."));
          }
      };

      window.addEventListener('message', handleMessage);
      const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Hết thời gian chờ AI Studio phản hồi (Timeout)."));
      }, TIMEOUT);

      // 3. Gửi lệnh "Vẽ đi" lên AI Studio (Parent Window)
      // Chúng ta gửi kèm SYSTEM_INSTRUCTION để đảm bảo AI Studio dù không có code logic 
      // vẫn biết phải cấu hình model như thế nào.
      
      const payload = {
          text: text,
          image: base64Image ? { data: base64Image, mimeType: mimeType } : null,
          systemInstruction: SYSTEM_INSTRUCTION // Gửi kèm não bộ sang
      };

      // Kiểm tra xem có đang chạy trong Iframe không
      if (window.parent === window) {
          // Nếu chạy trực tiếp (dev mode) không qua iframe, báo lỗi hoặc dùng mock
          console.warn("Đang chạy chế độ Standalone (không có AI Studio Parent).");
          // reject(new Error("Vui lòng chạy ứng dụng này bên trong Google AI Studio để sử dụng API miễn phí."));
          // Tuy nhiên, để bạn test local, ta có thể uncomment dòng trên.
      }

      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload
      }, '*');
  });
};

function normalizeAndResolve(result: any, originalText: string, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: "Đã dựng hình thành công." };
    }
    if (!result.geometry) result.geometry = { points: [] };
    
    const g = result.geometry;
    
    ['points', 'segments', 'circles', 'texts', 'angles', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (!g[key]) g[key] = [];
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    resolveGeometryReferences(g);
    fixAndScaleGeometry(g);
    enhanceGeometryWithTextAnalysis(g, originalText);
    resolveGeometryReferences(g);
    
    resolve(result);
}
