
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
   - Chỉ trả về JSON thuần túy, không kèm markdown (nếu có thể).
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

// Hàm trích xuất JSON thông minh từ văn bản hỗn độn
function extractJSONFromText(text: string): any {
    try {
        // 1. Thử parse trực tiếp
        return JSON.parse(text);
    } catch (e) {
        // 2. Tìm kiếm cặp ngoặc nhọn ngoài cùng {}
        const firstOpen = text.indexOf('{');
        const lastClose = text.lastIndexOf('}');
        
        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            const potentialJson = text.substring(firstOpen, lastClose + 1);
            try {
                return JSON.parse(potentialJson);
            } catch (e2) {
                // Nếu vẫn lỗi, thử clean các ký tự lạ
                try {
                    const cleaned = potentialJson.replace(/[\u0000-\u001F]+/g, ""); 
                    return JSON.parse(cleaned);
                } catch(e3) {
                    console.error("Failed to extract JSON", e3);
                }
            }
        }
        throw new Error("Không tìm thấy cấu trúc JSON hợp lệ trong phản hồi.");
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

  // --- CƠ CHẾ CẦU NỐI (BRIDGE) ---
  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      // Tăng timeout lên 180s cho các model suy luận sâu
      const TIMEOUT = 180000; 

      const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'GEMINI_RESULT' && event.data?.requestId === requestId) {
              window.removeEventListener('message', handleMessage);
              clearTimeout(timeoutId);
              
              try {
                  const payload = event.data.payload;
                  let rawText = '';

                  // --- XỬ LÝ PAYLOAD LINH HOẠT ---
                  if (typeof payload === 'string') {
                      // Trường hợp trả về chuỗi trực tiếp
                      rawText = payload;
                  } else if (payload && typeof payload === 'object') {
                      // Trường hợp trả về cấu trúc API chuẩn của Google
                      if (payload.candidates && payload.candidates[0]?.content?.parts?.[0]?.text) {
                          rawText = payload.candidates[0].content.parts[0].text;
                      } 
                      // Trường hợp payload chính là JSON kết quả (do middleware parse sẵn)
                      else if (payload.geometry) {
                          rawText = JSON.stringify(payload);
                      }
                      // Fallback: stringify cả cục
                      else {
                          rawText = JSON.stringify(payload);
                      }
                  }

                  // Sử dụng hàm trích xuất thông minh
                  const result = extractJSONFromText(rawText);
                  
                  // Đảm bảo cấu trúc Geometry luôn tồn tại
                  if (!result.geometry) {
                      result.geometry = { points: [], segments: [], circles: [], ellipses: [], angles: [], texts: [], lines: [] };
                  }
                  
                  const ensureArray = (obj: any, key: string) => { if (!obj[key]) obj[key] = []; };
                  ensureArray(result.geometry, 'points');
                  ensureArray(result.geometry, 'segments');
                  ensureArray(result.geometry, 'circles');
                  ensureArray(result.geometry, 'ellipses');
                  ensureArray(result.geometry, 'angles');
                  ensureArray(result.geometry, 'texts');
                  ensureArray(result.geometry, 'lines');
                  
                  resolve(result);
              } catch (error) {
                  console.error("Lỗi xử lý kết quả từ AI (Bridge):", error);
                  reject(new Error("Dữ liệu trả về từ AI bị lỗi hoặc không đúng định dạng."));
              }
          }

          if (event.data?.type === 'GEMINI_ERROR' && event.data?.requestId === requestId) {
              window.removeEventListener('message', handleMessage);
              clearTimeout(timeoutId);
              reject(new Error(event.data.error || "Có lỗi xảy ra từ phía AI Studio."));
          }
      };

      window.addEventListener('message', handleMessage);

      const timeoutId = setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          reject(new Error("Hết thời gian chờ (180s). Vui lòng thử lại."));
      }, TIMEOUT);

      // --- GỬI POST MESSAGE (HỒN GỌI XÁC) ---
      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              model: 'gemini-3-pro-preview', 
              contents: [{ parts: parts }],
              config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  thinkingConfig: { thinkingBudget: 8192 }, // Sử dụng Thinking Budget
                  responseMimeType: "application/json",
                  responseSchema: RESPONSE_SCHEMA,
              }
          }
      }, '*');
  });
};
