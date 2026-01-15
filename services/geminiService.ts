
import { AIResponse, GeometryData, Point } from "../types";
import { generateId } from "../utils/geometry";

// --- HỆ THỐNG CHỈ DẪN CAO CẤP (SUPER PROMPT V7 - GEOMETRY SPECIALIST) ---
const SYSTEM_INSTRUCTION = `
Bạn là chuyên gia hình học GeoPro. Nhiệm vụ: Chuyển đổi đề bài (Text hoặc Ảnh chứa Text) thành JSON để vẽ lên HTML5 Canvas.

QUY TRÌNH XỬ LÝ:
1. NẾU LÀ ẢNH: Hãy đọc toàn bộ văn bản trong ảnh trước (OCR). Sau đó dùng văn bản đó để dựng hình.
2. PHÂN TÍCH: Tìm các đối tượng: Điểm, Đoạn thẳng, Đường tròn, Góc vuông.
3. TỌA ĐỘ: Hệ quy chiếu Canvas 1000x800. Gốc (0,0) ở góc trên trái. Hãy trải hình ra giữa tâm (500, 400).

CẤU TRÚC JSON BẮT BUỘC (Tuyệt đối tuân thủ):
{
  "geometry": {
    "points": [
      { "id": "A", "x": 500, "y": 200, "label": "A" },
      { "id": "O", "x": 500, "y": 400, "label": "O" }
    ],
    "segments": [
      { "startPointId": "A", "endPointId": "B", "style": "solid" } 
    ],
    "circles": [
      { "centerId": "O", "radiusValue": 150, "label": "Đường tròn (O)" }
    ],
    "angles": [
      { "centerId": "A", "point1Id": "B", "point2Id": "C", "isRightAngle": true }
    ]
  },
  "explanation": "Giải thích ngắn gọn cách dựng."
}

LUẬT VẼ HÌNH:
- Tam giác ABC: Phải có 3 đoạn AB, BC, CA.
- Đường tròn (O): Phải tạo điểm O trước, sau đó tạo circle tham chiếu đến O.
- Vuông góc tại A: Tạo object trong mảng "angles" với "isRightAngle": true.
- Tuyệt đối KHÔNG trả về Markdown, chỉ trả về JSON thuần.
`;

/**
 * Hàm làm sạch và trích xuất JSON
 */
function extractAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;

    let jsonString = text;
    // Cố gắng tìm khối JSON giữa các dấu ngoặc
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = text.substring(firstBrace, lastBrace + 1);
    }

    // Xóa nhiễu Markdown
    jsonString = jsonString
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/\\n/g, ' ') // Xóa xuống dòng trong string
        .trim();

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.warn("JSON chuẩn thất bại, thử sửa lỗi cú pháp...", e);
        try {
            // Sửa lỗi thiếu ngoặc kép ở key
            jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
            // Sửa lỗi dấu phẩy thừa
            jsonString = jsonString.replace(/,(\s*[}\]])/g, '$1');
            return JSON.parse(jsonString);
        } catch (e2) {
            return null; 
        }
    }
}

function removeVietnameseTones(str: string): string {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.toUpperCase(); // Chuyển hết về chữ hoa để dễ regex
    return str;
}

// --- BỘ DỰNG HÌNH THỦ CÔNG (FALLBACK ENGINE V2) ---
// Được kích hoạt khi AI thất bại hoặc trả về dữ liệu thiếu
function manualGeometryExtraction(text: string): GeometryData {
    const cleanText = removeVietnameseTones(text);
    const geometry: GeometryData = {
        points: [], segments: [], circles: [], polygons: [], angles: [], texts: [],
        lines: [], rays: [], ellipses: []
    };
    
    const labelMap: Record<string, any> = {};
    const center = { x: 500, y: 400 };

    // Helper tạo điểm
    const getOrCreatePoint = (label: string, x?: number, y?: number) => {
        if (labelMap[label]) return labelMap[label];
        const px = x ?? (center.x + (Math.random() - 0.5) * 400);
        const py = y ?? (center.y + (Math.random() - 0.5) * 300);
        const p = { 
            id: generateId('p_man'), 
            x: px, y: py, 
            label: label, 
            color: 'black', radius: 4
        };
        geometry.points.push(p);
        labelMap[label] = p;
        return p;
    };

    // Helper nối điểm
    const ensureSegment = (lbl1: string, lbl2: string) => {
        const p1 = getOrCreatePoint(lbl1);
        const p2 = getOrCreatePoint(lbl2);
        const exists = geometry.segments.some(s => 
            (s.startPointId === p1.id && s.endPointId === p2.id) || 
            (s.startPointId === p2.id && s.endPointId === p1.id)
        );
        if (!exists) {
            geometry.segments.push({ 
                id: generateId('s'), 
                startPointId: p1.id, endPointId: p2.id, 
                style: 'solid', color: 'black' 
            });
        }
    };

    // 1. PHÁT HIỆN ĐƯỜNG TRÒN (Quan trọng)
    // Regex: DUONG TRON (O), DUONG TRON TAM I, (O;R)
    const circleRegex = /(?:DUONG TRON|TAM)\s*\(?([A-Z])\)?/g;
    let match;
    while ((match = circleRegex.exec(cleanText)) !== null) {
        const lbl = match[1];
        const p = getOrCreatePoint(lbl, center.x, center.y); // Tâm mặc định ở giữa
        geometry.circles.push({
            id: generateId('c'),
            centerId: p.id,
            radiusValue: 150, // Bán kính mặc định
            color: 'black',
            style: 'solid'
        });
    }

    // 2. PHÁT HIỆN TAM GIÁC
    const triRegex = /TAM GIAC ([A-Z])([A-Z])([A-Z])/g;
    while ((match = triRegex.exec(cleanText)) !== null) {
        const [_, A, B, C] = match;
        // Dựng tam giác đều quanh tâm (nếu chưa có tọa độ)
        if (!labelMap[A] && !labelMap[B] && !labelMap[C]) {
            const r = 180;
            getOrCreatePoint(A, center.x, center.y - r);
            getOrCreatePoint(B, center.x - r * 0.866, center.y + r * 0.5);
            getOrCreatePoint(C, center.x + r * 0.866, center.y + r * 0.5);
        } else {
            getOrCreatePoint(A); getOrCreatePoint(B); getOrCreatePoint(C);
        }
        ensureSegment(A, B); ensureSegment(B, C); ensureSegment(C, A);
    }

    // 3. PHÁT HIỆN TỨ GIÁC / HÌNH CHỮ NHẬT / VUÔNG
    const quadRegex = /(?:TU GIAC|HINH CHU NHAT|HINH VUONG|HINH THANG) ([A-Z])([A-Z])([A-Z])([A-Z])/g;
    while ((match = quadRegex.exec(cleanText)) !== null) {
        const [_, A, B, C, D] = match;
        if (!labelMap[A]) { // Nếu chưa có, vẽ hình chữ nhật
            const w = 200, h = 140;
            getOrCreatePoint(A, center.x - w/2, center.y - h/2);
            getOrCreatePoint(B, center.x + w/2, center.y - h/2);
            getOrCreatePoint(C, center.x + w/2, center.y + h/2);
            getOrCreatePoint(D, center.x - w/2, center.y + h/2);
        }
        ensureSegment(A, B); ensureSegment(B, C); ensureSegment(C, D); ensureSegment(D, A);
    }

    // 4. GÓC VUÔNG (VUONG TAI A)
    const rightAngleRegex = /VUONG (?:TAI|O) ([A-Z])/g;
    while ((match = rightAngleRegex.exec(cleanText)) !== null) {
        const centerLbl = match[1];
        // Tìm 2 điểm lân cận để tạo góc.
        // Logic đơn giản: Tìm 2 điểm bất kỳ đã nối với tâm này.
        const centerPt = getOrCreatePoint(centerLbl);
        const neighbors = geometry.segments
            .filter(s => s.startPointId === centerPt.id || s.endPointId === centerPt.id)
            .map(s => s.startPointId === centerPt.id ? s.endPointId : s.startPointId);
        
        if (neighbors.length >= 2) {
            geometry.angles.push({
                id: generateId('ang'),
                centerId: centerPt.id,
                point1Id: neighbors[0],
                point2Id: neighbors[1],
                isRightAngle: true,
                color: 'black', strokeWidth: 1.5
            });
        }
    }

    // 5. CÁC CỤM TỪ NỐI ĐIỂM (DOAN THANG AB, CANH AC)
    const segRegex = /(?:DOAN|CANH|DUONG|NOI) ([A-Z])([A-Z])/g;
    while ((match = segRegex.exec(cleanText)) !== null) {
        ensureSegment(match[1], match[2]);
    }

    return geometry;
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
  
  // Prompt nhấn mạnh việc phải đọc text từ ảnh
  const promptText = `
    Đề bài toán: "${text}"
    
    YÊU CẦU QUAN TRỌNG:
    1. Nếu có ảnh: Hãy đọc kỹ chữ trong ảnh (OCR) để hiểu đề bài. Đừng chỉ nhìn hình vẽ.
    2. Trả về JSON để vẽ lại hình minh họa cho bài toán này.
    3. Cần xác định rõ:
       - Đường tròn (circles): Phải có centerId và radiusValue.
       - Góc vuông (angles): isRightAngle = true.
       - Điểm và Đoạn thẳng nối chúng.
    
    Nếu không tìm thấy thông tin cụ thể, hãy TỰ GIẢ ĐỊNH tọa độ hợp lý để vẽ một hình minh họa đẹp.
  `;
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 50000; // 50s

      const finalize = (resultData: GeometryData, explanation: string) => {
          cleanup();
          // Đảm bảo dữ liệu mảng luôn tồn tại
          ['points', 'segments', 'circles', 'polygons', 'angles', 'ellipses', 'texts', 'lines', 'rays'].forEach(key => {
              if (!(resultData as any)[key]) (resultData as any)[key] = [];
              // Gán ID nếu thiếu
              (resultData as any)[key].forEach((item: any) => {
                  if (!item.id) item.id = generateId('ai');
              });
          });
          resolve({ geometry: resultData, explanation });
      };

      const cleanup = () => {
          window.removeEventListener('message', handleMessage);
          clearTimeout(timeoutId);
      };

      const handleMessage = (event: MessageEvent) => {
          if (!event.data || typeof event.data !== 'object') return;

          if (event.data.type === 'GEMINI_RESULT' && event.data.requestId === requestId) {
              try {
                  const payload = event.data.payload;
                  let rawText = typeof payload === 'string' ? payload : 
                                (payload.candidates?.[0]?.content?.parts?.[0]?.text || "");

                  console.log("AI Raw:", rawText);

                  // 1. Parse JSON từ AI
                  let parsed = extractAndParseJSON(rawText);
                  
                  // 2. Kiểm tra chất lượng dữ liệu AI
                  let aiSuccess = parsed && parsed.geometry && parsed.geometry.points && parsed.geometry.points.length > 0;

                  // 3. Chạy bộ quét thủ công (Manual Engine) để bổ sung hoặc thay thế
                  const combinedText = text + " " + rawText; // Dùng cả lời giải AI để tìm từ khóa
                  const manualGeo = manualGeometryExtraction(combinedText);

                  if (aiSuccess) {
                      // Hợp nhất: Nếu AI thiếu đường tròn/góc mà Manual tìm thấy -> Bổ sung vào
                      if (parsed.geometry.circles.length === 0 && manualGeo.circles.length > 0) {
                          // Map lại ID điểm từ Manual sang AI (nếu trùng Label)
                          manualGeo.circles.forEach(mc => {
                              const manualCenter = manualGeo.points.find(p => p.id === mc.centerId);
                              const aiCenter = parsed.geometry.points.find((p: any) => p.label === manualCenter?.label);
                              if (aiCenter) {
                                  mc.centerId = aiCenter.id;
                                  parsed.geometry.circles.push(mc);
                              }
                          });
                      }
                      
                      // Bổ sung góc vuông nếu AI quên
                      if (manualGeo.angles.length > 0) {
                           manualGeo.angles.forEach(ma => {
                               if (ma.isRightAngle) {
                                   const mCenter = manualGeo.points.find(p => p.id === ma.centerId);
                                   const aiCenter = parsed.geometry.points.find((p: any) => p.label === mCenter?.label);
                                   if (aiCenter) {
                                       // Tìm 2 điểm nối với tâm trong AI
                                       const neighbors = parsed.geometry.segments
                                            .filter((s: any) => s.startPointId === aiCenter.id || s.endPointId === aiCenter.id)
                                            .map((s: any) => s.startPointId === aiCenter.id ? s.endPointId : s.startPointId);
                                       if (neighbors.length >= 2) {
                                           ma.centerId = aiCenter.id;
                                           ma.point1Id = neighbors[0];
                                           ma.point2Id = neighbors[1];
                                           parsed.geometry.angles.push(ma);
                                       }
                                   }
                               }
                           });
                      }

                      finalize(parsed.geometry, parsed.explanation || "AI đã dựng hình.");
                  } else {
                      // Nếu AI thất bại hoàn toàn -> Dùng Manual
                      if (manualGeo.points.length > 0) {
                          finalize(manualGeo, "AI không trả về hình vẽ. Hệ thống đã tự động dựng hình từ văn bản.");
                      } else {
                          finalize({ points: [], segments: [] } as any, "Không thể dựng hình từ dữ liệu này.");
                      }
                  }

              } catch (error) {
                  console.error("Processing Error:", error);
                  const manualGeo = manualGeometryExtraction(text);
                  finalize(manualGeo, "Lỗi xử lý. Đang hiển thị hình vẽ phác thảo.");
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              console.warn("AI API Error -> Fallback manual");
              const manualGeo = manualGeometryExtraction(text);
              finalize(manualGeo, "Lỗi kết nối AI. Đã chuyển sang chế độ dựng hình Offline.");
          }
      };

      window.addEventListener('message', handleMessage);
      const timeoutId = setTimeout(() => {
          console.warn("Timeout -> Fallback manual");
          const manualGeo = manualGeometryExtraction(text);
          finalize(manualGeo, "Hết thời gian chờ. Đang hiển thị hình phác thảo.");
      }, TIMEOUT);

      // Gửi yêu cầu
      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              model: 'gemini-3-pro-preview', 
              contents: [{ parts: parts }],
              config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  responseMimeType: "application/json"
              }
          }
      }, '*');
  });
};
