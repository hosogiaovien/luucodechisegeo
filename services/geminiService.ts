
import { AIResponse } from "../types";

// --- ĐỊNH NGHĨA KIỂU DỮ LIỆU CHO SCHEMA (Thay thế Google GenAI Type) ---
const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN'
};

// --- SYSTEM INSTRUCTION "CHUẨN" (Phiên bản ổn định cũ) ---
const SYSTEM_INSTRUCTION = `
Bạn là chuyên gia hình học GeoSmart. Nhiệm vụ của bạn là phân tích bài toán và sinh dữ liệu JSON để vẽ hình trên Canvas SVG 1000x800.

1. TỌA ĐỘ VÀ BỐ CỤC:
   - Gốc tọa độ (0,0) ở góc trên trái. X tăng sang phải, Y tăng xuống dưới.
   - Trung tâm vùng vẽ là (500, 400). Hãy vẽ hình tập trung quanh điểm này.
   - Kích thước hình nên chiếm khoảng 50-70% canvas.

2. YÊU CẦU DỰNG HÌNH:
   - Tính toán tọa độ (x,y) chính xác để đảm bảo các tính chất hình học (vuông góc, song song, bằng nhau).
   - Với hình không gian (3D), các cạnh bị khuất PHẢI có thuộc tính "style": "dashed".
   - Đáy của hình trụ/nón nên được vẽ bằng đối tượng "ellipses".

3. CẤU TRÚC DỮ LIỆU:
   - Trả về JSON khớp hoàn toàn với Schema đã cung cấp.
   - Các mảng (points, segments...) nếu không có dữ liệu thì để rỗng [].
`;

// --- SCHEMA CHI TIẾT (Bao gồm đầy đủ các loại hình) ---
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
              color: { type: Type.STRING },
              radius: { type: Type.NUMBER }
            },
            required: ["id", "x", "y"]
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
              style: { type: Type.STRING, enum: ["solid", "dashed", "dotted"] },
              color: { type: Type.STRING },
              label: { type: Type.STRING }
            },
            required: ["id", "startPointId", "endPointId"]
          }
        },
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
              style: { type: Type.STRING }
            },
            required: ["id", "cx", "cy", "rx", "ry"]
          }
        },
        polygons: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              pointIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              color: { type: Type.STRING },
              fillColor: { type: Type.STRING },
              style: { type: Type.STRING }
            },
            required: ["id", "pointIds"]
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
              showLabel: { type: Type.BOOLEAN }
            },
            required: ["id", "centerId", "point1Id", "point2Id"]
          }
        },
        texts: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER },
              text: { type: Type.STRING },
              fontSize: { type: Type.NUMBER }
            },
            required: ["id", "x", "y", "text"]
          }
        }
      },
      required: ["points", "segments"]
    },
    explanation: { type: Type.STRING }
  },
  required: ["geometry", "explanation"]
};

export const parseGeometryProblem = async (
  text: string,
  base64Image?: string,
  mimeType: string = "image/jpeg"
): Promise<AIResponse> => {
  
  // 1. Chuẩn bị nội dung gửi đi
  const parts: any[] = [];
  
  if (base64Image) {
    parts.push({
      inlineData: { mimeType, data: base64Image },
    });
  }
  
  const promptText = `
    Đề bài: "${text}"
    Yêu cầu: Phân tích đề bài và trả về dữ liệu JSON để vẽ hình minh họa chính xác.
    Tuân thủ System Instruction về tọa độ và các quy tắc vẽ hình (2D/3D).
  `;
  
  parts.push({ text: promptText });

  // 2. Gửi lệnh qua Bridge (PostMessage)
  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 90000; // 90 giây

      const handleMessage = (event: MessageEvent) => {
          // Chỉ nhận phản hồi đúng requestId
          if (event.data?.type === 'GEMINI_RESULT' && event.data?.requestId === requestId) {
              window.removeEventListener('message', handleMessage);
              clearTimeout(timeoutId);
              
              try {
                  const rawPayload = event.data.payload;
                  let result;
                  
                  // Xử lý chuỗi JSON (loại bỏ markdown block nếu có)
                  let jsonString = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
                  jsonString = jsonString.replace(/```json|```/g, '').trim();
                  
                  result = JSON.parse(jsonString);
                  
                  // Đảm bảo các mảng con luôn tồn tại để tránh lỗi undefined
                  if (result.geometry) {
                      const geo = result.geometry;
                      ['points', 'segments', 'circles', 'polygons', 'angles', 'texts', 'ellipses', 'lines', 'rays'].forEach(key => {
                          if (!geo[key]) geo[key] = [];
                      });
                  }
                  
                  resolve(result);
              } catch (error) {
                  console.error("Lỗi parse JSON từ AI:", error);
                  reject(new Error("Dữ liệu trả về từ AI không hợp lệ."));
              }
          }

          if (event.data?.type === 'GEMINI_ERROR' && event.data?.requestId === requestId) {
              window.removeEventListener('message', handleMessage);
              clearTimeout(timeoutId);
              reject(new Error(event.data.error || "Có lỗi từ phía AI Studio."));
          }
      };

      window.addEventListener('message', handleMessage);

      const timeoutId = setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          reject(new Error("Quá thời gian chờ (90s). Vui lòng thử lại."));
      }, TIMEOUT);

      // Gửi cấu hình sang Parent Frame
      // Lưu ý: Dùng model 'gemini-2.0-flash' để có tốc độ và chất lượng tốt nhất hiện tại
      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              model: 'gemini-2.0-flash', 
              systemInstruction: SYSTEM_INSTRUCTION,
              contents: { parts },
              responseSchema: RESPONSE_SCHEMA
          }
      }, '*');
  });
};
