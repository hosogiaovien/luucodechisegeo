
import { AIResponse } from "../types";

const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Chuyên gia hình học và vẽ hình SVG.
Nhiệm vụ: Phân tích đề bài toán hình học và trả về dữ liệu JSON để vẽ lên canvas (1000x800).

--- QUY TẮC VẼ HÌNH (QUAN TRỌNG) ---
1. **TỌA ĐỘ (COORDINATES)**:
   - Hệ tọa độ SVG: X (0-1000), Y (0-800). Gốc (0,0) ở góc trên trái.
   - Hình vẽ phải nằm ở trung tâm (khoảng 500, 400).
   - Kích thước hình phải lớn (chiếm 60-80% khung hình).
   - Đừng dùng tọa độ quá nhỏ (ví dụ 1, 2, 3). Hãy nhân lên (ví dụ 100, 200).

2. **ĐỐI TƯỢNG (OBJECTS)**:
   - **Points (Điểm)**: { id, x, y, label, color }.
   - **Segments (Đoạn thẳng)**: { id, startPointId, endPointId, style, color, label }.
     - **BẮT BUỘC**: Nếu tạo ra các điểm, BẠN PHẢI TẠO SEGMENTS NỐI CHÚNG.
     - Ví dụ: Tam giác ABC -> Phải có 3 segments: AB, BC, CA.
     - Ví dụ: Hình bình hành ABCD -> 4 segments: AB, BC, CD, DA.
     - Đừng để các điểm nằm rời rạc trừ khi đề bài yêu cầu điểm độc lập.
   - **Circles (Đường tròn)**: { id, centerId, radiusValue, radiusPointId, color }.
   - **Angles (Góc)**: { id, point1Id, centerId, point2Id, isRightAngle, arcCount }.

3. **PHÂN TÍCH ĐỀ BÀI**:
   - Nếu đề bài là "Cho tam giác ABC...", hãy vẽ 3 điểm A, B, C và 3 đoạn thẳng nối chúng.
   - Nếu có "đường cao AH", vẽ điểm H trên BC và đoạn AH.
   - Nếu có "đường tròn tâm O", vẽ điểm O và đường tròn.

--- OUTPUT FORMAT ---
Trả về JSON duy nhất. Không dùng Markdown code block. Không comment (//).
Cấu trúc JSON:
{
  "geometry": {
    "points": [...],
    "segments": [...],
    "circles": [...],
    "angles": [...],
    "texts": [...]
  },
  "explanation": "Giải thích ngắn gọn cách dựng hình..."
}
`;

// --- ROBUST JSON PARSER ---
function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    
    let clean = text;
    // 1. Remove Markdown code blocks
    clean = clean.replace(/```json/gi, "").replace(/```/g, "");
    
    // 2. Extract JSON object
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    } else {
        return null; // No JSON found
    }

    // 3. Remove Comments (Single line // and Multi line /* */)
    clean = clean.replace(/\/\/.*$/gm, ""); 
    clean = clean.replace(/\/\*[\s\S]*?\*\//g, "");

    // 4. Try parsing
    try {
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error (First Attempt):", e);
        
        // 5. Attempt repairs for common LLM JSON errors
        try {
            // Fix trailing commas
            clean = clean.replace(/,\s*}/g, "}");
            clean = clean.replace(/,\s*]/g, "]");
            return JSON.parse(clean);
        } catch (e2) {
            console.error("JSON Parse Error (After Repair):", e2);
            return null;
        }
    }
}

// --- AUTO SCALING & CENTERING ENGINE ---
function scaleAndCenterGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // 1. Calculate Bounds
    geometry.points.forEach((p: any) => {
        if (typeof p.x !== 'number') p.x = parseFloat(p.x);
        if (typeof p.y !== 'number') p.y = parseFloat(p.y);
        
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX;
    let height = maxY - minY;
    
    // Handle degenerate cases
    if (!isFinite(width)) width = 0;
    if (!isFinite(height)) height = 0;
    if (width === 0) width = 1;
    if (height === 0) height = 1;

    // 2. Determine Scale Factor
    // Target size is roughly 400px-500px.
    const targetSize = 450;
    const currentMaxSize = Math.max(width, height);
    
    let scale = 1;
    // Scale up if tiny (e.g. math coords < 20), scale down if huge
    if (currentMaxSize < 300) {
        scale = targetSize / currentMaxSize;
    } else if (currentMaxSize > 1500) {
        scale = targetSize / currentMaxSize;
    }

    // 3. Apply Scaling
    if (scale !== 1) {
        geometry.points.forEach((p: any) => {
            p.x *= scale;
            p.y *= scale;
        });
        if (geometry.circles) {
            geometry.circles.forEach((c: any) => {
                if (c.radiusValue) c.radiusValue *= scale;
            });
        }
        if (geometry.ellipses) {
            geometry.ellipses.forEach((e: any) => {
                if (e.rx) e.rx *= scale;
                if (e.ry) e.ry *= scale;
                if (e.cx) e.cx *= scale;
                if (e.cy) e.cy *= scale;
            });
        }
        // Recalculate bounds after scaling
        minX *= scale; maxX *= scale;
        minY *= scale; maxY *= scale;
    }

    // 4. Centering
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const TARGET_CENTER_X = 500;
    const TARGET_CENTER_Y = 400;
    
    const dx = TARGET_CENTER_X - centerX;
    const dy = TARGET_CENTER_Y - centerY;

    geometry.points.forEach((p: any) => {
        p.x += dx;
        p.y += dy;
    });

    if (geometry.texts) {
        geometry.texts.forEach((t: any) => {
            if (t.x !== undefined && t.y !== undefined) {
                t.x = t.x * scale + dx;
                t.y = t.y * scale + dy;
            }
        });
    }
    
    if (geometry.ellipses) {
        geometry.ellipses.forEach((e: any) => {
            if (e.cx !== undefined) e.cx += dx;
            if (e.cy !== undefined) e.cy += dy;
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
    parts.push({
      inlineData: { mimeType, data: base64Image },
    });
  }
  
  // Explicitly mentioning constraints in user prompt to reinforce system instruction
  const promptText = `
    [GEOMETRY REQUEST]
    Đề bài: "${text}"
    
    Yêu cầu:
    1. Tính toán tọa độ các điểm.
    2. **QUAN TRỌNG**: Tạo danh sách "segments" để nối các điểm lại (ví dụ nối các cạnh tam giác, đường cao...). Đừng chỉ trả về mỗi điểm.
    3. Trả về JSON hợp lệ theo cấu trúc đã quy định.
  `;
  
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 120000; // 2 minutes

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
                  let rawText = '';

                  if (typeof payload === 'string') {
                      rawText = payload;
                  } else if (payload && typeof payload === 'object') {
                      if (payload.candidates && payload.candidates[0]?.content?.parts?.[0]?.text) {
                          rawText = payload.candidates[0].content.parts[0].text;
                      } else if (payload.geometry) {
                          // Direct object return (rare but possible with some proxies)
                          normalizeAndResolve(payload, resolve);
                          return;
                      } else {
                          rawText = JSON.stringify(payload);
                      }
                  }

                  const result = cleanAndParseJSON(rawText);

                  if (!result) {
                      console.log("Failed Raw Text:", rawText);
                      throw new Error("Không thể đọc dữ liệu JSON từ AI.");
                  }
                  
                  normalizeAndResolve(result, resolve);

              } catch (error: any) {
                  console.error("Lỗi xử lý kết quả AI:", error);
                  reject(new Error("Dữ liệu trả về không đúng định dạng."));
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              cleanup();
              reject(new Error(event.data.error || "Lỗi kết nối đến AI Server."));
          }
      };

      window.addEventListener('message', handleMessage);

      const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Hết thời gian chờ phản hồi (Timeout)."));
      }, TIMEOUT);

      // Sending request without strict responseSchema to allow flexible reasoning text if needed, 
      // but demanding JSON output via instructions.
      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              model: 'gemini-3-pro-preview', 
              contents: [{ parts: parts }],
              config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  responseMimeType: "application/json",
                  // removed responseSchema to avoid strict validation failures
                  // removed thinkingConfig
              }
          }
      }, '*');
  });
};

function normalizeAndResolve(result: any, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    // Handle cases where AI might wrap it differently
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: "Đã tạo hình vẽ." };
    }
    
    if (!result.geometry) {
        // Try to find geometry inside standard keys
        if (result.geometryData) result.geometry = result.geometryData;
        else result.geometry = { points: [], segments: [], circles: [], ellipses: [], angles: [], texts: [], lines: [] };
    }
    
    const g = result.geometry;
    const ensureArray = (key: string) => { if (!g[key]) g[key] = []; };
    
    ensureArray('points');
    ensureArray('segments');
    ensureArray('lines');
    ensureArray('circles');
    ensureArray('ellipses');
    ensureArray('angles');
    ensureArray('texts');
    
    // Auto-fix IDs if missing
    ['points', 'segments', 'circles', 'texts'].forEach(key => {
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    // --- AUTO SCALE & CENTER ---
    scaleAndCenterGeometry(g);
    
    resolve(result);
}
