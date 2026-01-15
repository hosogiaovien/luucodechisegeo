
import { AIResponse } from "../types";

// --- TỰ ĐỊNH NGHĨA TYPE (Thay vì import từ @google/genai) ---
const Type = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN'
};

// --- GIỮ NGUYÊN SYSTEM INSTRUCTION CHUẨN TỪ FILE BẠN CUNG CẤP ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Chuyên gia hình học phẳng (2D) và không gian (3D) cấp Olympiad.
Nhiệm vụ: Phân tích đề bài, giải toán và sinh dữ liệu JSON để vẽ lên canvas SVG (1000x800).

--- QUY TẮC DỰNG HÌNH & TỌA ĐỘ (BẮT BUỘC) ---

1. TỌA ĐỘ VÀ BỐ CỤC:
   - Trung tâm canvas là (500, 400).
   - Tam giác/Đa giác: Nên đặt trọng tâm gần (500, 450). Cạnh đáy nên nằm ngang.
   - Hình không gian (Trụ, Nón, Lăng trụ, Chóp): Đặt đáy ở khoảng y=600, đỉnh ở y=200.
   - Trục tọa độ 3D (nếu cần): O(500, 500), Ox hướng xuống trái, Oy hướng phải, Oz hướng lên.

2. QUY TẮC 2D (Tam giác, Đường tròn, Tứ giác):
   - Tam giác ABC: A thường ở trên đỉnh, B bên trái, C bên phải.
   - Đường cao/Trung tuyến/Phân giác: Tính toán giao điểm chính xác (Trực tâm, Trọng tâm, Tâm nội tiếp).
   - Đường tròn ngoại tiếp/nội tiếp: Phải tính đúng tâm và bán kính.

3. QUY TẮC 3D (Hình không gian):
   - Phép chiếu: Sử dụng phép chiếu song song (oblique projection).
   - Nét đứt (Dashed Lines): CÁC CẠNH BỊ KHUẤT PHẢI CÓ 'style': 'dashed'.
     - Ví dụ: Hình chóp S.ABCD đáy vuông, thì cạnh AD và DC thường bị khuất (nếu nhìn từ phía trước).
   - Đáy tròn (Trụ, Nón): Dùng 'ellipses' để vẽ đáy. Tỉ lệ rx/ry thường là 3:1 hoặc 4:1 để tạo cảm giác phối cảnh.
     - Ví dụ: Đáy trụ tâm (500, 600), rx=100, ry=30. Nửa cung sau có thể cần chia thành 2 segment cong hoặc vẽ đè segment nét đứt (nhưng đơn giản nhất là vẽ ellipse nét liền hoặc đứt tùy ngữ cảnh).
     - Tốt nhất với đáy trụ/nón: Vẽ 1 ellipse đáy (thường là nét đứt nếu bị che, hoặc liền nếu nhìn từ trên). Nếu cần tách biệt nửa liền nửa đứt, hãy ưu tiên vẽ ellipse liền cho đơn giản, hoặc dùng 2 cung (không hỗ trợ trong schema hiện tại nên dùng ellipse style 'solid').

4. LOGIC TOÁN HỌC:
   - Vuông góc: Nếu đề bài cho vuông góc, hãy tính tích vô hướng vector = 0.
   - Tỷ lệ: Định lý Talet, Menelaus phải chính xác.

--- CẤU TRÚC JSON ---
Trả về JSON tuân thủ schema. Đặc biệt chú ý:
- "ellipses": Dùng cho đáy hình trụ, nón, cầu.
- "segments": Chứa thuộc tính "style": "dashed" cho đường khuất.
- "explanation": Giải thích ngắn gọn cách dựng (VD: "Dựng hình chóp S.ABCD với đáy là hình bình hành...").
`;

// --- GIỮ NGUYÊN SCHEMA CHUẨN TỪ FILE BẠN CUNG CẤP ---
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
    1. Phân tích loại hình:
       - 2D: Tam giác (thường/vuông/cân/đều), Đường tròn, Hình chữ nhật...
       - 3D: Hình chóp, Lăng trụ, Hình trụ (Cylinder), Hình nón (Cone), Hình cầu...
    2. Tính toán tọa độ các điểm sao cho hình vẽ cân đối trên Canvas 1000x800.
    3. Xác định các đường nét đứt (hidden lines) cho hình 3D.
    4. Trả về JSON đầy đủ các đối tượng.
  `;
  
  parts.push({ text: promptText });

  // --- CƠ CHẾ CẦU NỐI (BRIDGE) ---
  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      // Model 3-Pro + Thinking cần thời gian rất lâu để suy luận, tăng timeout lên 160s
      const TIMEOUT = 160000; 

      const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'GEMINI_RESULT' && event.data?.requestId === requestId) {
              window.removeEventListener('message', handleMessage);
              clearTimeout(timeoutId);
              
              try {
                  const rawPayload = event.data.payload;
                  let result;
                  
                  let jsonString = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
                  jsonString = jsonString.replace(/```json|```/g, '').trim();
                  
                  result = JSON.parse(jsonString);
                  
                  // Helper đảm bảo mảng tồn tại
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
                  console.error("Lỗi parse JSON từ AI:", error);
                  reject(new Error("Dữ liệu trả về từ AI không đúng định dạng JSON."));
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
          reject(new Error("Quá thời gian chờ (160s). Bài toán đang được suy luận sâu, vui lòng thử lại."));
      }, TIMEOUT);

      // --- GỬI POST MESSAGE ---
      // Quan trọng: 
      // 1. Dùng gemini-3-pro-preview
      // 2. contents phải là MẢNG các Content [{parts: [...]}] để API hiểu đúng ngữ cảnh.
      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              model: 'gemini-3-pro-preview', 
              contents: [{ parts: parts }], // Cấu trúc chuẩn: Mảng Content chứa Parts
              config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  thinkingConfig: { thinkingBudget: 16000 }, // Cấu hình Thinking
                  responseMimeType: "application/json",
                  responseSchema: RESPONSE_SCHEMA,
              }
          }
      }, '*');
  });
};
