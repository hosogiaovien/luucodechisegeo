
import { AIResponse } from "../types";

// --- CẤU HÌNH LOẠI DỮ LIỆU ĐỂ TẠO SCHEMA JSON ---
const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN'
};

// --- BỘ NÃO SIÊU CẤP: HƯỚNG DẪN AI VẼ HÌNH CHUẨN SGK ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoPro Math Engine" - Chuyên gia dựng hình học toán học số 1 thế giới.
Nhiệm vụ: Phân tích đề bài và trả về JSON để vẽ lên Canvas SVG (Kích thước 1000x800).

--- 1. HỆ TỌA ĐỘ VÀ BỐ CỤC (CỰC KỲ QUAN TRỌNG) ---
*   **Gốc tọa độ màn hình:** (0, 0) ở góc trên cùng bên trái. x tăng sang phải, y tăng xuống dưới.
*   **Trung tâm vùng vẽ:** Điểm (500, 450). Hãy vẽ hình tập trung quanh điểm này.
*   **Kích thước chuẩn:**
    *   Cạnh đáy tam giác/tứ giác: khoảng 300-400 đơn vị.
    *   Bán kính đường tròn ngoại tiếp: khoảng 150-200 đơn vị.
    *   Hình không gian: Chiều cao khoảng 300-400 đơn vị.

--- 2. QUY TẮC DỰNG HÌNH 2D ---
*   **Tam giác ABC:**
    *   Nếu không đặc biệt: Vẽ A(500, 200), B(350, 600), C(650, 600).
    *   Nếu vuông tại A: Đặt A ở trên hoặc dưới sao cho nhìn rõ góc vuông.
    *   Nếu đều: Căn chỉnh y của B và C bằng nhau.
*   **Đường tròn:** Luôn xác định rõ tâm và bán kính (radiusValue).

--- 3. QUY TẮC DỰNG HÌNH 3D (BẮT BUỘC TUÂN THỦ) ---
*   **Góc nhìn:** Sử dụng phép chiếu song song (Oblique Projection).
*   **Hình Chóp / Hình Nón:**
    *   Đáy nằm ngang thấp (khoảng y=600).
    *   Đỉnh nằm cao ngay giữa (khoảng y=200).
    *   Ví dụ S.ABCD: Đáy ABCD là hình bình hành nhìn nghiêng.
*   **Hình Trụ / Hình Nón (Đáy tròn):**
    *   Dùng đối tượng "ellipses" để vẽ đáy.
    *   Tỉ lệ Ellipse: rx / ry khoảng 3.5 đến 4 (Ví dụ rx=100 thì ry=25).
    *   Đáy dưới: Vẽ 1 ellipse nét đứt (hoặc 2 cung: nửa sau đứt, nửa trước liền).
*   **Nét Đứt (Hidden Lines):**
    *   Tất cả các cạnh bị khuất bởi mặt phẳng phía trước PHẢI có thuộc tính 'style': 'dashed'.
    *   Ví dụ Hình chóp tứ giác: Cạnh đáy phía sau và cạnh bên phía sau là nét đứt.

--- 4. CẤU TRÚC JSON TRẢ VỀ ---
Bạn chỉ trả về JSON thuần túy, không Markdown. Cấu trúc yêu cầu:
{
  "geometry": {
    "points": [ { "id": "A", "x": 500, "y": 200, "label": "A" }, ... ],
    "segments": [ 
       { "id": "AB", "startPointId": "A", "endPointId": "B", "style": "solid" },
       { "id": "AD", "startPointId": "A", "endPointId": "D", "style": "dashed" } // Nét đứt
    ],
    "circles": [],
    "ellipses": [ // Dùng cho đáy trụ, nón, cầu
       { "id": "base", "cx": 500, "cy": 600, "rx": 100, "ry": 30, "style": "dashed" } 
    ],
    "polygons": [], // Tùy chọn, dùng để tô màu mặt
    "labels": [],
    "angles": []
  },
  "explanation": "Giải thích ngắn gọn cách dựng..."
}
`;

// Schema định nghĩa cấu trúc JSON trả về (Gửi kèm request để AI Studio dùng)
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
              style: { type: Type.STRING }, // "solid" | "dashed"
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

export const parseGeometryProblem = async (
  text: string,
  base64Image?: string,
  mimeType: string = "image/jpeg"
): Promise<AIResponse> => {
  
  // 1. Chuẩn bị nội dung Prompt
  const parts: any[] = [];
  
  if (base64Image) {
    parts.push({
      inlineData: { mimeType, data: base64Image },
    });
  }
  
  // Prompt cụ thể cho từng yêu cầu vẽ
  const promptText = `
    [YÊU CẦU DỰNG HÌNH]
    Đề bài: "${text}"
    
    Hãy tính toán tọa độ (x,y) cho các điểm sao cho:
    1. Hình vẽ nằm giữa canvas 1000x800.
    2. Các cạnh khuất (trong hình không gian) phải có style="dashed".
    3. Đảm bảo tỷ lệ hình học chính xác (vuông góc, song song, bằng nhau).
    
    Trả về JSON khớp với Schema đã định nghĩa.
  `;
  
  parts.push({ text: promptText });

  // 2. CƠ CHẾ POST MESSAGE (BRIDGE)
  // Gửi cấu hình đầy đủ sang Parent Iframe (AI Studio)
  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 90000; // Tăng timeout lên 90s cho các bài toán khó

      const handleMessage = (event: MessageEvent) => {
          // Lọc tin nhắn: Chỉ nhận tin đúng Type và đúng Request ID
          if (event.data?.type === 'GEMINI_RESULT' && event.data?.requestId === requestId) {
              window.removeEventListener('message', handleMessage);
              clearTimeout(timeoutId);
              
              try {
                  // AI Studio trả về text JSON, ta parse tại đây để đảm bảo Type Safety
                  const rawPayload = event.data.payload;
                  let result;

                  // Xử lý trường hợp AI trả về Markdown ```json ... ```
                  let jsonString = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
                  jsonString = jsonString.replace(/```json|```/g, '').trim();
                  
                  result = JSON.parse(jsonString);
                  
                  // Helper đảm bảo mảng tồn tại (Logic cũ)
                  const ensureArray = (obj: any, key: string) => { if (!obj[key]) obj[key] = []; };
                  if (result.geometry) {
                      ensureArray(result.geometry, 'points');
                      ensureArray(result.geometry, 'segments');
                      ensureArray(result.geometry, 'circles');
                      ensureArray(result.geometry, 'ellipses');
                      ensureArray(result.geometry, 'angles');
                      ensureArray(result.geometry, 'texts');
                      ensureArray(result.geometry, 'lines');
                  }
                  
                  resolve(result);
              } catch (error) {
                  console.error("Parse Error:", error);
                  reject(new Error("Lỗi xử lý dữ liệu từ AI. Hãy thử lại."));
              }
          }

          if (event.data?.type === 'GEMINI_ERROR' && event.data?.requestId === requestId) {
              window.removeEventListener('message', handleMessage);
              clearTimeout(timeoutId);
              reject(new Error(event.data.error || "AI Studio báo lỗi."));
          }
      };

      // Lắng nghe phản hồi
      window.addEventListener('message', handleMessage);

      // Timeout an toàn
      const timeoutId = setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          reject(new Error("Quá thời gian chờ (90s). Mạng chậm hoặc AI đang bận."));
      }, TIMEOUT);

      // GỬI LỆNH ĐI (Hồn gọi Da)
      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              // Yêu cầu model thông minh nhất có thể
              model: 'gemini-2.0-flash', 
              systemInstruction: SYSTEM_INSTRUCTION,
              contents: { parts },
              responseSchema: RESPONSE_SCHEMA,
              thinkingBudget: 12000 
          }
      }, '*');
  });
};
