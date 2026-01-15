
import { AIResponse } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH "HỒN" (Logic Toán Học & Schema) ---

// 1. Mock Type Enum (Để không cần cài thư viện @google/genai trên Vercel)
const Type = {
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT"
};

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

// Schema định nghĩa cấu trúc dữ liệu trả về
const geometrySchema = {
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

// --- HÀM GIAO TIẾP VỚI "DA" (AI STUDIO) ---

const sendToAIStudioProxy = (payload: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 1. Tạo ID duy nhất cho request này
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 2. Hàm lắng nghe phản hồi
    const messageHandler = (event: MessageEvent) => {
      // Kiểm tra xem message có phải là phản hồi cho request này không
      if (event.data?.requestId !== requestId) return;

      if (event.data.type === 'GEMINI_RESULT') {
        window.removeEventListener('message', messageHandler);
        resolve(event.data.payload);
      } else if (event.data.type === 'GEMINI_ERROR') {
        window.removeEventListener('message', messageHandler);
        reject(new Error(event.data.error || "Lỗi từ AI Studio Proxy"));
      }
    };

    // 3. Đăng ký lắng nghe
    window.addEventListener('message', messageHandler);

    // 4. Gửi yêu cầu lên Iframe cha (AI Studio)
    // Lưu ý: targetOrigin '*' là cần thiết để postMessage hoạt động giữa các domain khác nhau
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'DRAW_REQUEST',
            requestId: requestId,
            payload: payload
        }, '*');
    } else {
        // Fallback: Nếu không nằm trong iframe (ví dụ chạy dev localhost), báo lỗi
        console.warn("Đang chạy ở chế độ Standalone (không có Parent Iframe). Chức năng AI sẽ không hoạt động nếu không có API Key.");
        // Ở đây bạn có thể uncomment dòng dưới để test giả lập nếu cần
        // reject(new Error("App đang chạy độc lập, không kết nối được với AI Studio Proxy."));
    }

    // 5. Timeout an toàn (60s cho model suy luận)
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      reject(new Error("Hết thời gian chờ phản hồi từ AI Studio. (Timeout 60s)"));
    }, 60000);
  });
};

// --- HÀM CHÍNH ---

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

  try {
    // Đóng gói yêu cầu để gửi sang "Da" (AI Studio)
    const payload = {
      model: 'gemini-3-pro-preview', // Dùng model mạnh nhất theo yêu cầu
      contents: { parts },
      responseSchema: geometrySchema,
      systemInstruction: SYSTEM_INSTRUCTION,
      thinkingBudget: 16000 // Config cho dòng model suy luận (nếu AI Studio hỗ trợ pass qua)
    };

    console.log("Đang gửi yêu cầu sang AI Studio Proxy...", payload.model);
    
    // Gọi qua cầu nối thay vì gọi trực tiếp
    const jsonText = await sendToAIStudioProxy(payload);
    
    // Xử lý kết quả nhận được
    let result;
    try {
        result = JSON.parse(jsonText);
    } catch (e) {
        console.error("Lỗi parse JSON từ Proxy:", jsonText);
        throw new Error("Dữ liệu trả về từ AI không đúng định dạng JSON.");
    }
    
    // Helper đảm bảo mảng tồn tại (đề phòng AI trả về thiếu trường)
    const ensureArray = (obj: any, key: string) => { if (!obj[key]) obj[key] = []; };
    
    if (!result.geometry) result.geometry = {};
    const geo = result.geometry;

    ensureArray(geo, 'points');
    ensureArray(geo, 'segments');
    ensureArray(geo, 'lines');
    ensureArray(geo, 'circles');
    ensureArray(geo, 'ellipses');
    ensureArray(geo, 'angles');
    ensureArray(geo, 'texts');

    // Đảm bảo ID duy nhất cho các phần tử mới
    geo.points.forEach((p: any) => { if (!p.id) p.id = generateId('p'); });
    ['segments', 'lines', 'circles', 'ellipses', 'angles', 'texts'].forEach(key => {
        // @ts-ignore
        geo[key].forEach((el: any) => { if (!el.id) el.id = generateId(key.slice(0, 3)); });
    });

    return result;

  } catch (error: any) {
    console.error("Gemini Bridge Error:", error);
    throw new Error(error.message || "Không thể kết nối với AI Studio. Hãy đảm bảo bạn đang chạy link này trong khung Code Execution của Google AI Studio.");
  }
};
