
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
Bạn là "GeoSmart Expert" - Chuyên gia hình học phẳng (2D) và không gian (3D) cấp Olympiad.
Nhiệm vụ: Phân tích đề bài, giải toán và sinh dữ liệu JSON để vẽ lên canvas SVG (1000x800).

--- QUY TẮC DỰNG HÌNH & TỌA ĐỘ (BẮT BUỘC) ---
1. TỌA ĐỘ VÀ BỐ CỤC:
   - Trung tâm canvas là (500, 400).
   - Tam giác/Đa giác: Nên đặt trọng tâm gần (500, 450). Cạnh đáy nên nằm ngang.
   - Hình không gian: Đặt đáy ở khoảng y=600, đỉnh ở y=200.
2. QUY TẮC 3D:
   - Các cạnh bị khuất PHẢI có thuộc tính "style": "dashed".
3. TRẢ VỀ JSON:
   - Chỉ trả về JSON thuần túy, KHÔNG được bọc trong markdown block (ví dụ: không dùng \`\`\`json).
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
              style: { type: Type.STRING },
              color: { type: Type.STRING }
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
              radiusValue: { type: Type.NUMBER },
              color: { type: Type.STRING },
              style: { type: Type.STRING }
            },
            required: ["id", "centerId", "radiusValue"]
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
// Hàm này chịu trách nhiệm "dọn rác" trong chuỗi trả về từ AI
function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    
    let clean = text;

    // 1. Loại bỏ Markdown Code Blocks (```json ... ``` hoặc ``` ... ```)
    clean = clean.replace(/```json/gi, "").replace(/```/g, "");

    // 2. Tìm khối JSON hợp lệ đầu tiên và cuối cùng (để loại bỏ lời dẫn chuyện ở đầu/cuối)
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }

    // 3. Xóa các dòng comment // (AI đôi khi quen tay thêm vào dù là JSON)
    // Lưu ý: Regex này an toàn cho JSON hình học, nhưng cẩn thận nếu URL có chứa //
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
    [GEOMETRY SOLVER REQUEST]
    Đề bài: "${text}"
    Yêu cầu:
    1. Phân tích đề bài.
    2. Tính toán tọa độ (Canvas 1000x800).
    3. Trả về JSON đúng cấu trúc đã định nghĩa.
  `;
  
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      // Tăng timeout lên 3 phút để AI có thời gian suy nghĩ
      const TIMEOUT = 180000; 

      const cleanup = () => {
          window.removeEventListener('message', handleMessage);
          clearTimeout(timeoutId);
      };

      const handleMessage = (event: MessageEvent) => {
          // Lọc tin nhắn rác, chỉ nhận object
          if (!event.data || typeof event.data !== 'object') return;

          if (event.data.type === 'GEMINI_RESULT' && event.data.requestId === requestId) {
              cleanup();
              
              try {
                  const payload = event.data.payload;
                  let rawText = '';

                  // --- XỬ LÝ PAYLOAD ĐA DẠNG TỪ BRIDGE ---
                  if (typeof payload === 'string') {
                      rawText = payload;
                  } else if (payload && typeof payload === 'object') {
                      // Trường hợp trả về cấu trúc API chuẩn của Google (candidates -> content -> parts)
                      if (payload.candidates && payload.candidates[0]?.content?.parts?.[0]?.text) {
                          rawText = payload.candidates[0].content.parts[0].text;
                      } 
                      // Trường hợp payload chính là JSON kết quả (đã được parse bởi middleware bên ngoài)
                      else if (payload.geometry) {
                          // Đã là object mong muốn, dùng luôn
                          normalizeAndResolve(payload, resolve);
                          return;
                      }
                      // Fallback: stringify cả cục để regex tìm JSON
                      else {
                          rawText = JSON.stringify(payload);
                      }
                  }

                  // Parse và làm sạch chuỗi
                  const result = cleanAndParseJSON(rawText);

                  if (!result) {
                      throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi của AI.");
                  }
                  
                  normalizeAndResolve(result, resolve);

              } catch (error: any) {
                  console.error("Lỗi xử lý kết quả từ AI:", error);
                  reject(new Error("Dữ liệu trả về bị lỗi hoặc không đúng định dạng."));
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
          reject(new Error("Hết thời gian chờ (180s). Vui lòng thử lại."));
      }, TIMEOUT);

      // --- GỬI POST MESSAGE (CẦU NỐI) ---
      // Gửi đi cấu hình mạnh nhất để đảm bảo kết quả tốt nhất
      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              model: 'gemini-3-pro-preview', // Sử dụng model xịn
              contents: [{ parts: parts }],
              config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  thinkingConfig: { thinkingBudget: 8192 }, // Bật chế độ suy nghĩ sâu
                  responseMimeType: "application/json",
                  responseSchema: RESPONSE_SCHEMA,
              }
          }
      }, '*');
  });
};

// Hàm phụ trợ: Chuẩn hóa dữ liệu trước khi trả về App
function normalizeAndResolve(result: any, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    // Nếu AI trả về thẳng object geometry mà không bọc trong root
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: "Đã tạo hình vẽ." };
    }
    
    // Đảm bảo cấu trúc Geometry luôn tồn tại và đủ mảng
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
