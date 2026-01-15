
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
Bạn là "GeoSmart Expert" - Chuyên gia hình học phẳng (2D) và không gian (3D).
Nhiệm vụ: Phân tích đề bài và sinh dữ liệu JSON để vẽ lên canvas SVG (1000x800).

--- QUY TẮC VẼ HÌNH (QUAN TRỌNG NHẤT) ---
1. **KHÔNG ĐƯỢC ĐỂ ĐIỂM RỜI RẠC (CRITICAL)**:
   - Nếu bạn tạo ra các điểm (Points), bạn BẮT BUỘC phải tạo các đoạn thẳng (Segments) nối chúng lại theo ngữ cảnh.
   - Ví dụ: Đề bài "Tam giác ABC" -> Phải có điểm A, B, C VÀ các đoạn thẳng nối AB, BC, CA.
   - Ví dụ: "Đường cao AH" -> Phải có đoạn thẳng nối A và H.
   - Ví dụ: "Tứ giác ABCD" -> Phải nối A-B, B-C, C-D, D-A.
2. **TỌA ĐỘ VÀ BỐ CỤC**:
   - Canvas 1000x800. Đặt hình vẽ ở trung tâm (khoảng 500, 400).
   - Hình vẽ phải lớn, rõ ràng (chiếm khoảng 50-70% diện tích).
   - Tránh để các điểm quá gần nhau hoặc trùng nhau.
3. **ĐỐI TƯỢNG HÌNH HỌC**:
   - Đường tròn: Phải có tâm và bán kính rõ ràng.
   - Góc vuông: Nếu có (ví dụ AH vuông góc BC), hãy thêm vào mảng "angles" với isRightAngle: true.
4. **HÌNH KHÔNG GIAN (3D)**:
   - Các cạnh bị khuất (nét đứt) PHẢI có thuộc tính "style": "dashed".
   - Các cạnh nhìn thấy: "style": "solid".

--- OUTPUT FORMAT ---
Chỉ trả về JSON thuần túy. KHÔNG dùng Markdown block (như \`\`\`json).
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

    // 1. Remove Markdown
    clean = clean.replace(/```json/gi, "").replace(/```/g, "");

    // 2. Find JSON bounds
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }

    // 3. Remove Comments (// ...)
    clean = clean.replace(/^\s*\/\/.*$/gm, "");

    try {
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        console.log("Failed Text:", clean);
        return null;
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
    
    Yêu cầu quan trọng:
    1. Tính toán tọa độ chính xác.
    2. NỐI CÁC ĐIỂM LẠI VỚI NHAU. Đừng để các điểm nằm rời rạc.
       - Nếu có A, B, C -> Hãy tạo segments nối A-B, B-C, C-A.
       - Nếu có đường tròn (O) -> Hãy tạo circle.
    3. Trả về JSON đúng cấu trúc.
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
                      throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi của AI.");
                  }
                  
                  normalizeAndResolve(result, resolve);

              } catch (error: any) {
                  console.error("Lỗi xử lý kết quả từ AI:", error);
                  reject(new Error("Dữ liệu trả về bị lỗi."));
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              cleanup();
              reject(new Error(event.data.error || "Có lỗi xảy ra từ phía AI Studio."));
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
    
    resolve(result);
}
