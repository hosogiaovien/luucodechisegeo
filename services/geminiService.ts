
import { AIResponse } from "../types";

// --- TỰ ĐỊNH NGHĨA TYPE (Không import từ @google/genai) ---
const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN'
};

const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Chuyên gia hình học.
Nhiệm vụ: Phân tích đề bài và sinh dữ liệu JSON để vẽ lên canvas SVG (1000x800).

--- QUY TẮC VẼ HÌNH (QUAN TRỌNG NHẤT) ---
1. **QUY MÔ TỌA ĐỘ (SCALE)**: 
   - KHÔNG dùng tọa độ nhỏ (ví dụ 1, 2, 3). HÃY DÙNG TỌA ĐỘ PIXEL LỚN.
   - Ví dụ: Thay vì A(0, 3), hãy dùng A(500, 300).
   - Khoảng cách giữa các điểm chính nên từ 200 đến 400 đơn vị.
2. **NỐI ĐIỂM (CONNECTIVITY)**:
   - Nếu tạo điểm A, B, C -> BẮT BUỘC tạo segments nối chúng (AB, BC, CA).
   - Đừng để điểm nằm trơ trọi.
3. **BỐ CỤC**:
   - Trung tâm hình vẽ nên ở (500, 400).
   - Trục Y trong SVG hướng xuống dưới.

--- OUTPUT FORMAT ---
Chỉ trả về JSON thuần túy. KHÔNG dùng Markdown block.
`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    geometry: {
      type: Type.OBJECT,
      properties: {
        points: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              label: { type: Type.STRING },
              color: { type: Type.STRING }
            },
            required: ["id", "x", "y", "label"]
          }
        },
        segments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              startPointId: { type: Type.STRING },
              endPointId: { type: Type.STRING },
              style: { type: Type.STRING }, // 'solid' | 'dashed' | 'dotted'
              color: { type: Type.STRING },
              label: { type: Type.STRING } // Optional label for segment
            },
            required: ["id", "startPointId", "endPointId", "style"]
          }
        },
        lines: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING } } } },
        circles: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              centerId: { type: Type.STRING },
              radiusValue: { type: Type.NUMBER }, // Pixel value
              radiusPointId: { type: Type.STRING }, // Or define radius by a point on circle
              color: { type: Type.STRING },
              style: { type: Type.STRING }
            },
            required: ["id", "centerId"]
          }
        },
        ellipses: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              cx: { type: Type.NUMBER },
              cy: { type: Type.NUMBER },
              rx: { type: Type.NUMBER },
              ry: { type: Type.NUMBER },
              rotation: { type: Type.NUMBER },
              color: { type: Type.STRING },
              style: { type: Type.STRING }
            },
            required: ["id", "cx", "cy", "rx", "ry"]
          }
        },
        angles: { 
          type: Type.ARRAY, 
          items: { 
            type: Type.OBJECT, 
            properties: { 
              id: { type: Type.STRING }, 
              centerId: { type: Type.STRING },
              point1Id: { type: Type.STRING },
              point2Id: { type: Type.STRING },
              isRightAngle: { type: Type.BOOLEAN },
              color: { type: Type.STRING }
            },
            required: ["id", "centerId", "point1Id", "point2Id"]
          } 
        },
        texts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING } } } }
      },
      required: ["points", "segments", "circles", "angles", "texts"]
    },
    explanation: { type: Type.STRING }
  },
  required: ["geometry", "explanation"]
};

// --- AGGRESSIVE JSON CLEANER ---
function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    
    let clean = text;
    clean = clean.replace(/```json/gi, "").replace(/```/g, "");
    
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    clean = clean.replace(/^\s*\/\/.*$/gm, "");

    try {
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        console.log("Failed Text:", clean);
        return null;
    }
}

// --- AUTO SCALING & CENTERING ENGINE ---
function scaleAndCenterGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // 1. Calculate Bounds
    geometry.points.forEach((p: any) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX;
    let height = maxY - minY;
    
    // Handle degenerate cases (single point)
    if (width === 0) width = 1;
    if (height === 0) height = 1;

    // 2. Determine Scale Factor
    // Target size is roughly 400px (half screen).
    // If the shape is tiny (e.g., width < 50), it means AI used small math coords.
    // If shape is already large, scale might be near 1.
    const targetSize = 400;
    const currentMaxSize = Math.max(width, height);
    
    let scale = 1;
    if (currentMaxSize < 300) {
        scale = targetSize / currentMaxSize;
    }

    // 3. Apply Scaling (relative to origin 0,0 temporarily)
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
                if (e.cx) e.cx *= scale; // Will be recentered later
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
            // Text positions often come from AI, assume they need same transform
            // If they were originally near points, scale/translate keeps them relative
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
  
  const promptText = `
    [GEOMETRY REQUEST]
    Đề bài: "${text}"
    
    Yêu cầu:
    1. Tính toán tọa độ (Canvas 1000x800).
    2. NỐI CÁC ĐIỂM (Segments). Đừng để điểm rời rạc.
    3. Trả về JSON.
  `;
  
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 180000; 

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
                          normalizeAndResolve(payload, resolve);
                          return;
                      } else {
                          rawText = JSON.stringify(payload);
                      }
                  }

                  const result = cleanAndParseJSON(rawText);

                  if (!result) {
                      throw new Error("Không tìm thấy JSON hợp lệ.");
                  }
                  
                  normalizeAndResolve(result, resolve);

              } catch (error: any) {
                  console.error("Lỗi xử lý AI:", error);
                  reject(new Error("Dữ liệu trả về bị lỗi."));
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              cleanup();
              reject(new Error(event.data.error || "Lỗi AI Studio."));
          }
      };

      window.addEventListener('message', handleMessage);

      const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Hết thời gian chờ."));
      }, TIMEOUT);

      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              model: 'gemini-3-pro-preview', 
              contents: [{ parts: parts }],
              config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  thinkingConfig: { thinkingBudget: 8192 },
                  responseMimeType: "application/json",
                  responseSchema: RESPONSE_SCHEMA,
              }
          }
      }, '*');
  });
};

function normalizeAndResolve(result: any, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: "Đã tạo hình vẽ." };
    }
    
    if (!result.geometry) {
        result.geometry = { points: [], segments: [], circles: [], ellipses: [], angles: [], texts: [], lines: [] };
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
    
    // --- ÁP DỤNG SCALE VÀ CENTER ---
    scaleAndCenterGeometry(g);
    
    resolve(result);
}
