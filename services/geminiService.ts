
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI: CHUYÊN GIA TỌA ĐỘ ---
const SYSTEM_INSTRUCTION = `
Bạn là "Geometry Coordinate Solver" (Máy tính tọa độ hình học).
Nhiệm vụ DUY NHẤT: Tính toán tọa độ (x, y) của các điểm trong đề bài toán hình học phẳng.

--- QUY TẮC CỐT LÕI ---
1. **Hệ trục**: 
   - Canvas SVG kích thước lớn. Gốc tọa độ (0,0) ở góc trên-trái.
   - Chọn tâm hình chính (ví dụ tâm đường tròn ngoại tiếp hoặc trọng tâm) đặt tại **(500, 400)**.
   - Trục Y hướng xuống (theo chuẩn SVG).

2. **Input**: Đề bài toán (văn bản/ảnh).

3. **Output**: Chỉ trả về JSON danh sách "points". 
   - "label": Tên điểm (A, B, C, O, M...).
   - "x", "y": Tọa độ số thực chính xác.
   - KHÔNG cần trả về danh sách đoạn thẳng (segments) hay đường tròn (circles). Tôi sẽ tự nối chúng dựa trên tên điểm.

4. **Tư duy hình học**:
   - Dùng các định lý hình học (Pythagoras, Lượng giác, Vector) để tính điểm phụ.
   - Nếu đề bài không cho độ dài cụ thể, hãy TỰ CHỌN một đơn vị chuẩn (ví dụ R = 150 đơn vị) để hình vẽ đẹp và cân đối.

--- JSON MẪU ---
{
  "points": [
    { "id": "p1", "label": "O", "x": 500, "y": 400 },
    { "id": "p2", "label": "A", "x": 650, "y": 400 },
    { "id": "p3", "label": "M", "x": 800, "y": 250 }
  ],
  "explanation": "Chọn R=150. O(500,400). A thuộc (O) nên..."
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
function autoConnectDots(geometry: any, problemText: string) {
    if (!geometry.points || geometry.points.length === 0) return;

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

    const text = problemText.toUpperCase()
        .replace(/ĐƯỜNG TRÒN/g, "CIRCLE")
        .replace(/TAM GIÁC/g, "TRIANGLE")
        .replace(/TỨ GIÁC/g, "QUAD")
        .replace(/ĐƯỜNG KÍNH/g, "DIAMETER")
        .replace(/BÁN KÍNH/g, "RADIUS")
        .replace(/TIẾP TUYẾN/g, "TANGENT");

    // A. QUÉT CẶP ĐIỂM (AB, BC...)
    const pairRegex = /([A-Z])([A-Z])/g;
    let match;
    while ((match = pairRegex.exec(text)) !== null) {
        addSegment(match[1], match[2]);
    }
    
    // B. QUÉT CẶP ĐIỂM CÁCH NHAU
    const splitRegex = /([A-Z])\s+(?:VÀ|VỚI|AND|WITH|-)\s+([A-Z])/g;
    while ((match = splitRegex.exec(text)) !== null) {
        addSegment(match[1], match[2]);
    }

    // C. XỬ LÝ ĐƯỜNG TRÒN
    const circleRegex = /(?:CIRCLE|TÂM|\()\s*([A-Z])/g;
    const processedCenters = new Set<string>();

    while ((match = circleRegex.exec(text)) !== null) {
        const centerLabel = match[1];
        const centerId = labelMap[centerLabel];

        if (centerId && !processedCenters.has(centerId)) {
            processedCenters.add(centerId);
            
            let radiusPointId = undefined;
            let radiusValue = 120; 

            const centerPt = points.find(p => p.id === centerId);
            if (centerPt) {
                let candidates: {id: string, dist: number}[] = [];
                points.forEach(p => {
                    if (p.id !== centerId) {
                        const d = Math.hypot(p.x - centerPt.x, p.y - centerPt.y);
                        if (d > 20 && d < 800) candidates.push({id: p.id, dist: d});
                    }
                });
                
                if (candidates.length > 0) {
                    candidates.sort((a, b) => b.dist - a.dist);
                    const maxDist = candidates[0].dist;
                    radiusPointId = candidates[0].id;
                    radiusValue = maxDist;
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

    // D. ĐA GIÁC
    const polyRegex = /(?:TRIANGLE|QUAD|HÌNH)\s+([A-Z]{3,})/g;
    while ((match = polyRegex.exec(text)) !== null) {
        const str = match[1]; 
        for (let i = 0; i < str.length; i++) {
            addSegment(str[i], str[(i + 1) % str.length]);
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

    autoConnectDots(g, originalText);
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
    1. Trả về JSON danh sách "points".
    2. Mỗi point PHẢI có "label" (tên điểm) và tọa độ "x", "y".
    3. Tính toán tọa độ chính xác. Đặt tâm hình chính tại (500, 400).
    4. KHÔNG cần trả về segments/circles.
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
