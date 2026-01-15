
import { AIResponse, GeometryData, Point } from "../types";
import { generateId } from "../utils/geometry";

// --- HỆ THỐNG CHỈ DẪN V8 - COORDINATE ANCHORING ---
const SYSTEM_INSTRUCTION = `
Bạn là GeoEngine - Máy tạo dữ liệu hình học.
Nhiệm vụ: Chuyển đổi đề bài (Text/Ảnh) thành JSON tọa độ để vẽ lên Canvas 1000x800.

QUY TẮC TỌA ĐỘ (BẮT BUỘC):
1. Canvas: Rộng 1000, Cao 800.
2. Điểm Gốc: Luôn đặt điểm quan trọng nhất (Tâm đường tròn hoặc Đỉnh tam giác) tại (500, 400).
3. Đơn vị: 1 đơn vị = 1 pixel. Độ dài cạnh trung bình: 200-300px.

KHI GẶP CÁC HÌNH CƠ BẢN, HÃY DÙNG TỌA ĐỘ MẪU SAU (Thay tên điểm tương ứng):
- Tam giác đều ABC (A ở trên): A(500, 250), B(350, 550), C(650, 550).
- Tam giác vuông ABC (Vuông tại A): A(400, 500), B(400, 200), C(800, 500).
- Đường tròn (O): Tâm O(500, 400), Bán kính 150.
- Hình vuông ABCD: A(350, 250), B(650, 250), C(650, 550), D(350, 550).

CẤU TRÚC JSON OUTPUT (Chỉ trả về JSON này, không Markdown):
{
  "geometry": {
    "points": [
      { "id": "p1", "label": "A", "x": 500, "y": 250 },
      { "id": "p2", "label": "B", "x": 350, "y": 550 }
    ],
    "segments": [
      { "startPointId": "p1", "endPointId": "p2" }
    ],
    "circles": [
      { "centerId": "p1", "radiusValue": 150 }
    ],
    "angles": [
      { "centerId": "p1", "point1Id": "p2", "point2Id": "p3", "isRightAngle": true }
    ]
  },
  "explanation": "Tóm tắt ngắn gọn: Dựng tam giác đều ABC."
}

YÊU CẦU XỬ LÝ ẢNH:
- Nếu là ảnh: Hãy trích xuất TÊN ĐIỂM và QUAN HỆ HÌNH HỌC (vuông góc, song song, tiếp tuyến).
- Sau đó map vào các TỌA ĐỘ MẪU ở trên. Đừng cố tính toán chính xác tuyệt đối, hãy ưu tiên hình vẽ ĐẸP và CÂN ĐỐI.
`;

function extractAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    let jsonString = text;
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = text.substring(firstBrace, lastBrace + 1);
    }
    // Cleanup
    jsonString = jsonString
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/\n/g, '')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

    try {
        return JSON.parse(jsonString);
    } catch (e) {
        // Cố gắng cứu JSON lỗi nhẹ
        try {
            const fixed = jsonString.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
            return JSON.parse(fixed);
        } catch(e2) {
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
    str = str.toUpperCase();
    return str;
}

// --- BỘ DỰNG HÌNH THỦ CÔNG (FALLBACK ENGINE V3) ---
function manualGeometryExtraction(text: string): GeometryData {
    const cleanText = removeVietnameseTones(text);
    const geometry: GeometryData = {
        points: [], segments: [], circles: [], polygons: [], angles: [], texts: [],
        lines: [], rays: [], ellipses: []
    };
    
    const labelMap: Record<string, any> = {};
    const center = { x: 500, y: 400 };

    const getOrCreatePoint = (label: string, x?: number, y?: number) => {
        if (labelMap[label]) return labelMap[label];
        // Nếu không có tọa độ, random nhẹ quanh tâm để không trùng nhau
        const px = x ?? (center.x + (Math.random() - 0.5) * 200);
        const py = y ?? (center.y + (Math.random() - 0.5) * 200);
        const p = { 
            id: generateId('p_man'), x: px, y: py, label: label, 
            color: 'black', radius: 4 
        };
        geometry.points.push(p);
        labelMap[label] = p;
        return p;
    };

    const ensureSegment = (lbl1: string, lbl2: string) => {
        const p1 = getOrCreatePoint(lbl1);
        const p2 = getOrCreatePoint(lbl2);
        const exists = geometry.segments.some(s => 
            (s.startPointId === p1.id && s.endPointId === p2.id) || 
            (s.startPointId === p2.id && s.endPointId === p1.id)
        );
        if (!exists) geometry.segments.push({ id: generateId('s'), startPointId: p1.id, endPointId: p2.id, style: 'solid', color: 'black' });
    };

    // 1. TAM GIÁC (Ưu tiên cao nhất để định hình khung)
    // Regex bắt: TAM GIAC ABC, TAM GIAC VUONG ABC
    const triRegex = /TAM GIAC(?:\s*VUONG|(?:\s*DEU)|(?:\s*CAN))?\s+([A-Z])([A-Z])([A-Z])/g;
    let match;
    while ((match = triRegex.exec(cleanText)) !== null) {
        const [_, A, B, C] = match;
        // Template Tam giác
        getOrCreatePoint(A, 500, 200);
        getOrCreatePoint(B, 300, 550);
        getOrCreatePoint(C, 700, 550);
        ensureSegment(A, B); ensureSegment(B, C); ensureSegment(C, A);
    }

    // 2. HÌNH VUÔNG / CHỮ NHẬT
    const quadRegex = /(?:HINH VUONG|HINH CHU NHAT|TU GIAC)\s+([A-Z])([A-Z])([A-Z])([A-Z])/g;
    while ((match = quadRegex.exec(cleanText)) !== null) {
        const [_, A, B, C, D] = match;
        // Template Hình chữ nhật
        getOrCreatePoint(A, 300, 250);
        getOrCreatePoint(B, 700, 250);
        getOrCreatePoint(C, 700, 550);
        getOrCreatePoint(D, 300, 550);
        ensureSegment(A, B); ensureSegment(B, C); ensureSegment(C, D); ensureSegment(D, A);
    }

    // 3. ĐƯỜNG TRÒN (Quan trọng: Bắt cả dạng (O) và (O;R))
    // Regex: DUONG TRON (O), DUONG TRON TAM I
    const circleRegex = /(?:DUONG TRON|NOI TIEP|NGOAI TIEP)\s*(?:\(T?A?M?\s*([A-Z]))/g;
    while ((match = circleRegex.exec(cleanText)) !== null) {
        const lbl = match[1]; // Tên tâm (O, I...)
        const p = getOrCreatePoint(lbl, center.x, center.y); // Tâm mặc định ở giữa
        geometry.circles.push({
            id: generateId('c'),
            centerId: p.id,
            radiusValue: 150,
            color: 'black',
            style: 'solid'
        });
    }
    // Bắt dạng ngắn gọn: Cho đường tròn (O)
    const circleShortRegex = /TRON\s*\(([A-Z])\)/g;
    while ((match = circleShortRegex.exec(cleanText)) !== null) {
        if (!labelMap[match[1]]) { // Chỉ tạo nếu chưa có
            const p = getOrCreatePoint(match[1], center.x, center.y);
            geometry.circles.push({ id: generateId('c'), centerId: p.id, radiusValue: 150 });
        }
    }

    // 4. ĐOẠN THẲNG LẺ
    const segRegex = /(?:DOAN|CANH|NOI)\s+([A-Z])([A-Z])/g;
    while ((match = segRegex.exec(cleanText)) !== null) {
        ensureSegment(match[1], match[2]);
    }

    // 5. GÓC VUÔNG
    const rightAngleRegex = /VUONG TAI ([A-Z])/g;
    while ((match = rightAngleRegex.exec(cleanText)) !== null) {
        const centerLbl = match[1];
        if (labelMap[centerLbl]) {
            const centerPt = labelMap[centerLbl];
            // Tìm 2 điểm hàng xóm
            const neighbors = geometry.segments
                .filter(s => s.startPointId === centerPt.id || s.endPointId === centerPt.id)
                .map(s => s.startPointId === centerPt.id ? s.endPointId : s.startPointId);
            
            if (neighbors.length >= 2) {
                geometry.angles.push({
                    id: generateId('ang'),
                    centerId: centerPt.id,
                    point1Id: neighbors[0],
                    point2Id: neighbors[1],
                    isRightAngle: true, color: 'black'
                });
            }
        }
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
    Đề bài: "${text}"
    1. Đọc kỹ đề bài (Text hoặc Chữ trong ảnh).
    2. Xác định dạng hình học chính (Tam giác, Đường tròn, Tứ giác...).
    3. Trả về JSON chứa danh sách điểm (points) với tọa độ cụ thể (x, y) để vẽ hình.
    
    Lưu ý: Nếu đề bài không cho tọa độ, hãy TỰ GIẢ ĐỊNH tọa độ sao cho hình vẽ cân đối ở giữa Canvas 1000x800.
    Ưu tiên: 
    - Tâm đường tròn hoặc trọng tâm hình ở (500, 400).
    - Hình to rõ ràng (cạnh ~200-300 đơn vị).
  `;
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 60000; // Tăng timeout lên 60s

      const finalize = (resultData: GeometryData, explanation: string) => {
          cleanup();
          ['points', 'segments', 'circles', 'polygons', 'angles', 'ellipses', 'texts', 'lines', 'rays'].forEach(key => {
              if (!(resultData as any)[key]) (resultData as any)[key] = [];
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

                  // 1. Parse JSON
                  let parsed = extractAndParseJSON(rawText);
                  
                  // 2. Chạy Manual Engine song song để đối chiếu
                  const combinedText = text + " " + rawText; 
                  const manualGeo = manualGeometryExtraction(combinedText);

                  // 3. Logic Hợp nhất thông minh
                  if (parsed && parsed.geometry && parsed.geometry.points && parsed.geometry.points.length > 0) {
                      // AI thành công -> Kiểm tra xem có thiếu sót gì so với Manual không
                      
                      // Nếu AI thiếu đường tròn mà Manual tìm thấy -> Thêm vào
                      if ((!parsed.geometry.circles || parsed.geometry.circles.length === 0) && manualGeo.circles.length > 0) {
                          if (!parsed.geometry.circles) parsed.geometry.circles = [];
                          // Map ID tâm từ Manual sang AI
                          manualGeo.circles.forEach(mc => {
                              const mCenter = manualGeo.points.find(p => p.id === mc.centerId);
                              const aiCenter = parsed.geometry.points.find((p: any) => p.label === mCenter?.label);
                              if (aiCenter) {
                                  mc.centerId = aiCenter.id;
                                  parsed.geometry.circles.push(mc);
                              } else {
                                  // Nếu AI chưa có tâm này, thêm cả điểm tâm vào
                                  const newId = generateId('p_added');
                                  parsed.geometry.points.push({ ...mCenter, id: newId });
                                  mc.centerId = newId;
                                  parsed.geometry.circles.push(mc);
                              }
                          });
                      }

                      finalize(parsed.geometry, parsed.explanation || "AI đã dựng hình.");
                  } else {
                      // AI thất bại -> Dùng hoàn toàn Manual
                      console.warn("AI JSON invalid. Using Fallback.");
                      if (manualGeo.points.length > 0) {
                          finalize(manualGeo, "AI không trả về dữ liệu chuẩn. Hệ thống đã tự động dựng hình từ phân tích văn bản.");
                      } else {
                          // Fallback cuối cùng: Vẽ một tam giác mặc định nếu không tìm thấy gì
                          const defaultGeo = manualGeometryExtraction("TAM GIAC ABC");
                          finalize(defaultGeo, "Không tìm thấy thông tin hình học. Đã vẽ hình mẫu.");
                      }
                  }

              } catch (error) {
                  console.error("Processing Error:", error);
                  const manualGeo = manualGeometryExtraction(text);
                  finalize(manualGeo, "Lỗi xử lý AI. Đang hiển thị hình phác thảo.");
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              const manualGeo = manualGeometryExtraction(text);
              finalize(manualGeo, "Lỗi kết nối AI. Đã chuyển sang chế độ dựng hình Offline.");
          }
      };

      window.addEventListener('message', handleMessage);
      const timeoutId = setTimeout(() => {
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
