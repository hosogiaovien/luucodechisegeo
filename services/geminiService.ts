
import { AIResponse, GeometryData, Point } from "../types";
import { generateId } from "../utils/geometry";

// --- HỆ THỐNG CHỈ DẪN NÂNG CẤP (SUPER PROMPT V5) ---
const SYSTEM_INSTRUCTION = `
Bạn là một API hình học. Nhiệm vụ duy nhất của bạn là chuyển đổi đề bài toán học (Text hoặc Ảnh) thành dữ liệu JSON để vẽ lên Canvas.

QUY TẮC TUYỆT ĐỐI:
1. CHỈ TRẢ VỀ JSON. Không giải thích, không markdown, không lời dẫn.
2. Nếu là HÌNH ẢNH: Hãy cố gắng nhận diện các điểm, đoạn thẳng. Nếu ảnh mờ, HÃY DÙNG TEXT ĐỂ SUY LUẬN VÀ VẼ.
3. Nếu là TEXT: Phân tích ngữ nghĩa để tạo điểm và nối chúng lại.
4. TỌA ĐỘ: Hệ quy chiếu Canvas 1000x800. 
   - x: từ 0 đến 1000.
   - y: từ 0 đến 800.
   - Tránh trùng nhau. Phân bố hình rộng ra giữa màn hình.

CẤU TRÚC JSON BẮT BUỘC:
{
  "geometry": {
    "points": [{ "id": "A", "x": 500, "y": 200, "label": "A" }, { "id": "B", "x": 300, "y": 600, "label": "B" }],
    "segments": [{ "startPointId": "A", "endPointId": "B", "style": "solid" }],
    "circles": [],
    "angles": [],
    "polygons": []
  },
  "explanation": "Tóm tắt ngắn gọn các bước dựng hình."
}
`;

/**
 * Hàm làm sạch và trích xuất JSON từ phản hồi hỗn độn của AI
 */
function extractAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;

    let processingText = text;

    // 1. Xóa Markdown Code Blocks
    processingText = processingText.replace(/```json/gi, "").replace(/```/g, "");

    // 2. Tìm khối JSON (Bắt đầu bằng { và kết thúc bằng })
    // Tìm vị trí { đầu tiên
    const firstOpen = processingText.indexOf('{');
    // Tìm vị trí } cuối cùng
    const lastClose = processingText.lastIndexOf('}');

    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        processingText = processingText.substring(firstOpen, lastClose + 1);
    } else {
        // Nếu không tìm thấy cặp ngoặc hợp lệ, thử tìm mảng []
        const firstBracket = processingText.indexOf('[');
        const lastBracket = processingText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
             // Nếu AI trả về mảng, ta bọc nó vào object geometry
             processingText = `{"geometry": {"points": ${processingText.substring(firstBracket, lastBracket + 1)} }}`;
        } else {
             console.error("Không tìm thấy cấu trúc JSON hợp lệ trong:", text);
             return null;
        }
    }

    // 3. Cố gắng Parse JSON chuẩn
    try {
        return JSON.parse(processingText);
    } catch (e) {
        console.warn("Parse chuẩn thất bại, đang thử sửa lỗi cú pháp JSON...", e);
    }

    // 4. Cơ chế sửa lỗi cú pháp (Auto-Repair)
    try {
        // Xóa comment //...
        processingText = processingText.replace(/\/\/.*$/gm, "");
        // Xóa dấu phẩy thừa trước dấu đóng: , } hoặc , ]
        processingText = processingText.replace(/,(\s*[}\]])/g, '$1');
        // Thêm ngoặc kép cho key chưa có ngoặc: { key: ... } -> { "key": ... }
        processingText = processingText.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        // Thay nháy đơn thành nháy kép
        processingText = processingText.replace(/'/g, '"');

        return JSON.parse(processingText);
    } catch (e2) {
        console.error("Không thể sửa lỗi JSON. Raw extracted:", processingText);
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
    return str;
}

// --- LOGIC BỔ SUNG & SỬA LỖI HÌNH HỌC ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) geometry.points = [];
    
    const rawText = problemText.toUpperCase();
    const text = removeVietnameseTones(rawText); 
    
    const labelMap: Record<string, any> = {};
    geometry.points.forEach((p: any) => {
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

    // 1. Nếu AI không trả về điểm nào, tự tạo từ Text (Fallback cực mạnh)
    if (geometry.points.length === 0) {
        // Tìm các chữ cái in hoa đứng cạnh nhau hoặc gần nhau (VD: Tam giác ABC)
        const regex = /\b([A-Z])([A-Z])([A-Z])?\b/g;
        let match;
        const foundLabels = new Set<string>();
        while ((match = regex.exec(rawText)) !== null) {
            foundLabels.add(match[1]);
            foundLabels.add(match[2]);
            if (match[3]) foundLabels.add(match[3]);
        }
        
        // Tạo điểm ngẫu nhiên theo hình tròn
        const labels = Array.from(foundLabels);
        if (labels.length > 0) {
            const cx = 500, cy = 400, r = 200;
            labels.forEach((lbl, i) => {
                const angle = (i / labels.length) * 2 * Math.PI - Math.PI/2;
                const p = {
                    id: generateId('p_fallback'),
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle),
                    label: lbl,
                    color: 'black'
                };
                geometry.points.push(p);
                labelMap[lbl] = p;
            });
        }
    }

    // 2. Tự động nối tam giác, tứ giác từ Text
    const triRegex = /TAM GIAC ([A-Z]{3})/g;
    let match;
    while ((match = triRegex.exec(text)) !== null) {
        const lbls = match[1];
        if (labelMap[lbls[0]] && labelMap[lbls[1]]) ensureSegment(labelMap[lbls[0]].id, labelMap[lbls[1]].id);
        if (labelMap[lbls[1]] && labelMap[lbls[2]]) ensureSegment(labelMap[lbls[1]].id, labelMap[lbls[2]].id);
        if (labelMap[lbls[2]] && labelMap[lbls[0]]) ensureSegment(labelMap[lbls[2]].id, labelMap[lbls[0]].id);
    }

    // 3. Tự động nối đa giác nếu có đủ điểm nhưng thiếu nét (Safety Net)
    const segmentCount = geometry.segments ? geometry.segments.length : 0;
    const pointCount = geometry.points.length;
    
    if (segmentCount < pointCount && pointCount >= 3) {
        // Sắp xếp điểm theo góc để nối vòng
        let cx = 0, cy = 0;
        geometry.points.forEach((p:any) => { cx += p.x; cy += p.y; });
        cx /= pointCount; cy /= pointCount;
        
        const sortedPoints = [...geometry.points].sort((a:any, b:any) => {
            const angA = Math.atan2(a.y - cy, a.x - cx);
            const angB = Math.atan2(b.y - cy, b.x - cx);
            return angA - angB;
        });

        for (let i = 0; i < pointCount; i++) {
            ensureSegment(sortedPoints[i].id, sortedPoints[(i+1)%pointCount].id);
        }
    }
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
            // Lọc bỏ items hỏng (tham chiếu đến ID không tồn tại)
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

function fixAndScaleGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;
    
    // 1. Tính Bounding Box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Kiểm tra và fix tọa độ undefined/null/NaN
    geometry.points.forEach((p: any) => {
        if (typeof p.x !== 'number' || isNaN(p.x)) p.x = Math.random() * 500;
        if (typeof p.y !== 'number' || isNaN(p.y)) p.y = Math.random() * 500;
        
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    const width = maxX - minX;
    const height = maxY - minY;
    
    // 2. Logic Scale thông minh
    // Nếu hình quá bé (tọa độ 0-1 hoặc cụm nhỏ) -> Phóng to
    // Nếu hình quá lớn (> 2000) -> Thu nhỏ
    // Nếu các điểm trùng nhau (width ~ 0) -> "Nổ" (Explode)
    
    const TARGET_WIDTH = 600;
    const TARGET_HEIGHT = 500;
    const CENTER_X = 500;
    const CENTER_Y = 400;

    // Case 1: Điểm trùng nhau (width, height gần 0)
    if (width < 1 && height < 1) {
        const radius = 200;
        const n = geometry.points.length;
        geometry.points.forEach((p: any, i: number) => {
            const ang = (i / n) * 2 * Math.PI - Math.PI/2;
            p.x = CENTER_X + radius * Math.cos(ang);
            p.y = CENTER_Y + radius * Math.sin(ang);
        });
        return;
    }

    // Case 2: Cần Scale
    let scaleX = 1, scaleY = 1;
    if (width > 0) scaleX = TARGET_WIDTH / width;
    if (height > 0) scaleY = TARGET_HEIGHT / height;
    
    // Chọn scale nhỏ nhất để giữ tỷ lệ, nhưng giới hạn không phóng quá to nếu hình đã to
    let scale = Math.min(scaleX, scaleY);
    
    // Nếu hình đang ở hệ quy chiếu chuẩn hóa (0-1), scale sẽ rất lớn (vd 600).
    // Nếu hình đã vẽ pixel (vd width=500), scale sẽ ~ 1.2.
    // Ta chấp nhận scale lớn.
    
    // Trung tâm hiện tại
    const currentCx = (minX + maxX) / 2;
    const currentCy = (minY + maxY) / 2;

    geometry.points.forEach((p: any) => {
        p.x = (p.x - currentCx) * scale + CENTER_X;
        p.y = (p.y - currentCy) * scale + CENTER_Y;
    });
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
    Đề bài toán: "${text}"
    
    HÃY TRẢ VỀ JSON HÌNH HỌC.
    Nếu có ảnh, hãy phân tích ảnh để lấy tọa độ.
    Nếu ảnh mờ hoặc không có ảnh, hãy phân tích Text để tự bịa ra tọa độ hợp lý.
    KHÔNG ĐƯỢC TRẢ VỀ RỖNG. Hãy cố gắng vẽ một cái gì đó liên quan.
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

                  console.log("Raw AI Response:", rawText); // Debug log

                  const result = extractAndParseJSON(rawText);
                  
                  if (!result) {
                      throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi.");
                  }
                  
                  normalizeAndResolve(result, text, resolve);

              } catch (error: any) {
                  console.error("AI Processing Error:", error);
                  // Thay vì reject ngay, hãy thử fallback lần cuối ở đây nếu cần, 
                  // nhưng normalizeAndResolve đã có fallback logic rồi.
                  reject(new Error("Lỗi xử lý dữ liệu AI: " + error.message));
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              cleanup();
              reject(new Error(event.data.error || "Lỗi kết nối AI."));
          }
      };

      window.addEventListener('message', handleMessage);
      const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Quá thời gian chờ (Timeout)."));
      }, TIMEOUT);

      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              model: 'gemini-3-pro-preview', 
              contents: [{ parts: parts }],
              config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  responseMimeType: "application/json" // Force JSON mode natively if supported
              }
          }
      }, '*');
  });
};

function normalizeAndResolve(result: any, originalText: string, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    // Chuẩn hóa cấu trúc: geometry phải tồn tại
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: result.explanation || "Đã tạo hình vẽ." };
    }
    if (!result.geometry) result.geometry = { points: [] };
    
    const g = result.geometry;
    
    // Đảm bảo các mảng tồn tại
    ['points', 'segments', 'circles', 'texts', 'angles', 'cylinders', 'cones', 'spheres', 'polygons'].forEach(key => {
        if (!g[key]) g[key] = [];
        // Gán ID nếu thiếu
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    // 1. Phân tích Text để bổ sung hình nếu AI thiếu sót (Logic Fallback quan trọng)
    enhanceGeometryWithTextAnalysis(g, originalText);

    // 2. Resolve ID (Liên kết các đối tượng bằng ID thay vì Label)
    resolveGeometryReferences(g);

    // 3. Fix & Scale (Chống gom cục, chống tọa độ 0-1)
    fixAndScaleGeometry(g);

    resolve(result);
}
