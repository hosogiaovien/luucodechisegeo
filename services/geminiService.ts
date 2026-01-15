
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI: CHUYÊN GIA TỌA ĐỘ ---
// Chỉ tập trung vào việc trả về danh sách Points chính xác kèm Label.
const SYSTEM_INSTRUCTION = `
Bạn là "Geometry Coordinate Solver". 
Nhiệm vụ DUY NHẤT: Tính toán tọa độ (x, y) của các điểm trong đề bài.

--- QUY TẮC ---
1. **Hệ trục**: Gốc (500, 400). Trục Y hướng xuống (theo SVG).
2. **Input**: Đề bài toán hình học.
3. **Output**: JSON chứa danh sách "points". 
   - BẮT BUỘC phải có "label" (tên điểm: A, B, O, M...).
   - "x", "y": Số thực.
4. **Logic tính toán**:
   - Nếu đề có "Đường tròn (O; R)", đặt O(500,400), R=150.
   - Các điểm khác tính theo lượng giác/hình học vector.
   - KHÔNG cần trả về "segments" hay "circles", chỉ cần Points thật chuẩn.

--- JSON MẪU ---
{
  "points": [
    { "id": "p1", "label": "O", "x": 500, "y": 400 },
    { "id": "p2", "label": "A", "x": 650, "y": 400 },
    { "id": "p3", "label": "M", "x": 800, "y": 250 }
  ],
  "explanation": "O là tâm..."
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

// --- BỘ MÁY DỰNG HÌNH TỰ ĐỘNG (AUTO-CONSTRUCTION ENGINE) ---
// Đây là phần quan trọng nhất: Code tự động nối điểm dựa trên văn bản
function autoConnectDots(geometry: any, problemText: string) {
    if (!geometry.points || geometry.points.length === 0) return;

    // 1. Chuẩn bị dữ liệu
    const points = geometry.points as any[];
    // Map Label -> ID (Ví dụ: "A" -> "p_123")
    const labelMap: Record<string, string> = {};
    const existingSegments = new Set<string>(); // Để tránh trùng lặp

    points.forEach(p => {
        if (p.label) {
            // Chuẩn hóa label (bỏ khoảng trắng, uppercase)
            const cleanLabel = p.label.trim().toUpperCase();
            labelMap[cleanLabel] = p.id;
            // Đảm bảo label hiển thị đẹp
            p.label = p.label.trim(); 
        }
    });

    if (!geometry.segments) geometry.segments = [];
    if (!geometry.circles) geometry.circles = [];

    // Helper tạo segment
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

    // 2. PHÂN TÍCH VĂN BẢN ĐỂ NỐI ĐIỂM
    // Chuẩn hóa văn bản đề bài
    const text = problemText.toUpperCase()
        .replace(/ĐƯỜNG TRÒN/g, "CIRCLE")
        .replace(/TAM GIÁC/g, "TRIANGLE")
        .replace(/TỨ GIÁC/g, "QUAD")
        .replace(/ĐƯỜNG KÍNH/g, "DIAMETER")
        .replace(/BÁN KÍNH/g, "RADIUS")
        .replace(/TIẾP TUYẾN/g, "TANGENT");

    // A. QUÉT CẶP ĐIỂM (AB, BC, CA...)
    // Logic: Tìm 2 chữ cái in hoa đứng cạnh nhau. Nếu cả 2 đều là điểm đã biết -> Nối.
    const pairRegex = /([A-Z])([A-Z])/g;
    let match;
    while ((match = pairRegex.exec(text)) !== null) {
        addSegment(match[1], match[2]);
    }
    
    // B. QUÉT CẶP ĐIỂM CÁCH NHAU (A và B, A với B)
    const splitRegex = /([A-Z])\s+(?:VÀ|VỚI|AND|WITH|-)\s+([A-Z])/g;
    while ((match = splitRegex.exec(text)) !== null) {
        addSegment(match[1], match[2]);
    }

    // C. XỬ LÝ ĐƯỜNG TRÒN (CIRCLE)
    // Tìm các mẫu: (O), (O;R), Tâm O
    const circleRegex = /(?:CIRCLE|TÂM|\()\s*([A-Z])/g;
    const processedCenters = new Set<string>();

    while ((match = circleRegex.exec(text)) !== null) {
        const centerLabel = match[1];
        const centerId = labelMap[centerLabel];

        if (centerId && !processedCenters.has(centerId)) {
            processedCenters.add(centerId);
            
            // Tìm bán kính tự động
            let radiusPointId = undefined;
            let radiusValue = 120; // Mặc định

            // C1. Tìm trong đề bài xem có "bán kính OM" hay "đường kính AB" không
            // Tìm chữ cái đứng sau tâm O (ví dụ OA, OB) -> đó là bán kính
            const radiusRegex = new RegExp(`${centerLabel}([A-Z])`, 'g');
            let rMatch;
            while ((rMatch = radiusRegex.exec(text)) !== null) {
                const targetLabel = rMatch[1];
                if (labelMap[targetLabel]) {
                    radiusPointId = labelMap[targetLabel];
                    break; // Ưu tiên điểm đầu tiên tìm thấy
                }
            }

            // C2. Nếu không tìm thấy text, tìm điểm xa nhất trong danh sách AI trả về (thường là điểm nằm trên đường tròn)
            if (!radiusPointId) {
                const centerPt = points.find(p => p.id === centerId);
                let candidates: {id: string, dist: number}[] = [];
                points.forEach(p => {
                    if (p.id !== centerId) {
                        const d = Math.hypot(p.x - centerPt.x, p.y - centerPt.y);
                        if (d > 50 && d < 600) candidates.push({id: p.id, dist: d});
                    }
                });
                // Sắp xếp khoảng cách giảm dần -> Lấy điểm xa nhất làm bán kính (heuristic khá đúng cho hình học phẳng)
                if (candidates.length > 0) {
                    candidates.sort((a, b) => b.dist - a.dist);
                    // Nhóm các điểm có khoảng cách xấp xỉ nhau (cùng nằm trên đường tròn)
                    const maxDist = candidates[0].dist;
                    const onCircle = candidates.filter(c => Math.abs(c.dist - maxDist) < 10);
                    // Lấy điểm đầu tiên trong nhóm xa nhất
                    if (onCircle.length > 0) radiusPointId = onCircle[0].id;
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

    // D. ĐA GIÁC (TRIANGLE ABC...)
    // Nối kín các đỉnh
    const polyRegex = /(?:TRIANGLE|QUAD|HÌNH)\s+([A-Z]{3,})/g;
    while ((match = polyRegex.exec(text)) !== null) {
        const str = match[1]; // ABC
        for (let i = 0; i < str.length; i++) {
            const l1 = str[i];
            const l2 = str[(i + 1) % str.length];
            addSegment(l1, l2);
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

    // 1. Chuẩn hóa Points (Quan trọng: Đảm bảo ID và Label)
    g.points.forEach((p: any, index: number) => {
        if (!p.id) p.id = `p_${index}`;
        p.x = Number(p.x);
        p.y = Number(p.y);
        // Nếu AI quên label, thử gán theo thứ tự A, B, C...
        if (!p.label) {
            const alphabet = "ABCDEFGHIKLMNPQRSTUVWXYZ";
            p.label = alphabet[index % alphabet.length];
        }
    });

    // 2. KÍCH HOẠT AUTO-CONNECT (Code nối dây thay cho AI)
    autoConnectDots(g, originalText);

    // 3. Scale & Center (Đưa hình về giữa màn hình)
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

    // Nếu các điểm quá gần nhau hoặc trùng nhau
    if (maxX - minX < 10) { maxX += 50; minX -= 50; }
    if (maxY - minY < 10) { maxY += 50; minY -= 50; }

    const width = maxX - minX;
    const height = maxY - minY;
    
    // Scale về khung nhìn 500x400
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
  
  // Prompt nhấn mạnh vào việc TÍNH TỌA ĐỘ
  const promptText = `
    Đề bài: "${text}"
    YÊU CẦU:
    1. Trả về JSON danh sách "points".
    2. Mỗi point PHẢI có "label" (tên điểm trong đề bài) và tọa độ "x", "y".
    3. Tính toán tọa độ chính xác. Đặt tâm hình chính tại (500, 400).
    4. KHÔNG cần vẽ segments/circles (tôi sẽ tự nối). CHỈ CẦN POINTS VÀ LABELS CHÍNH XÁC.
  `;
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      // Tăng timeout lên một chút để AI suy nghĩ kỹ tọa độ
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
                  if (!result) throw new Error("AI không trả về dữ liệu hợp lệ.");
                  
                  normalizeAndResolve(result, text, resolve);

              } catch (error: any) {
                  console.error("AI Processing Error:", error);
                  reject(new Error("Lỗi xử lý dữ liệu."));
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              cleanup();
              reject(new Error(event.data.error || "Lỗi kết nối."));
          }
      };

      window.addEventListener('message', handleMessage);
      
      const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Hết thời gian (60s)."));
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
          console.warn("Standalone Mode");
          reject(new Error("Vui lòng chạy trong môi trường AI Studio."));
      }
  });
};
