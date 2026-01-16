
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI: GEOMETRY ENGINE ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Pro" - Chuyên gia hình học.
Nhiệm vụ: Chuyển đổi đề bài (Text/Ảnh) thành JSON để vẽ hình trên Canvas 1000x800.

--- QUY TẮC BẮT BUỘC ---
1. **TRÍCH XUẤT**: 
   - Nếu là ảnh, hãy OCR kỹ nội dung để tìm tên các điểm (A, B, C...).
   - Trả về trường "detected_text" chứa nội dung đề bài.
   
2. **DỰNG HÌNH**:
   - **Points**: Tạo các điểm với toạ độ (x, y). Hãy trải rộng hình ra, đừng vẽ dính chùm.
     + Ví dụ: A(200, 200), B(600, 200), C(400, 500).
   - **Segments**: **QUAN TRỌNG NHẤT**. Phải liệt kê các đoạn thẳng nối các điểm.
     + Tam giác ABC => segments: ["A-B", "B-C", "C-A"].
     + Tứ giác ABCD => segments: ["A-B", "B-C", "C-D", "D-A"].
     + Đường cao AH => segments: ["A-H"].

3. **OUTPUT JSON**:
{
  "detected_text": "...",
  "points": [ { "label": "A", "x": 500, "y": 200 }, ... ],
  "segments": [ { "from": "A", "to": "B" }, ... ],
  "circles": [ { "center": "O", "radiusPoint": "A" } ],
  "angles": [ { "p1": "A", "center": "B", "p2": "C", "deg": 90 } ]
}
Chỉ trả về JSON. Không giải thích thêm.
`;

// --- XỬ LÝ JSON MẠNH MẼ ---
function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    
    // 1. Tìm vị trí bắt đầu và kết thúc của JSON object thực sự
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    
    if (firstOpen === -1 || lastClose === -1 || lastClose <= firstOpen) {
        throw new Error("Không tìm thấy dữ liệu JSON hợp lệ trong phản hồi.");
    }

    let clean = text.substring(firstOpen, lastClose + 1);

    // 2. Sửa lỗi JSON phổ biến do AI sinh ra
    clean = clean
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/,\s*}/g, "}") // Xóa dấu phẩy thừa cuối object
        .replace(/,\s*]/g, "]") // Xóa dấu phẩy thừa cuối array
        .replace(/\\"/g, '"');  // Fix escape quote sai

    try {
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error Raw:", clean);
        // Cố gắng cứu vãn bằng cách eval (rủi ro nhưng hiệu quả với lỗi cú pháp nhỏ)
        // Lưu ý: Trong môi trường production thực tế nên hạn chế, nhưng ở đây dùng để fix lỗi AI
        try {
            // eslint-disable-next-line no-new-func
            return new Function(`return ${clean}`)();
        } catch (e2) {
            throw new Error("Dữ liệu hỏng, không thể đọc.");
        }
    }
}

// --- HEURISTIC ENGINE: TỰ ĐỘNG NỐI ĐIỂM (CỨU CÁNH) ---
function autoConnectPoints(geometry: any, text: string) {
    if (!geometry.points || geometry.points.length < 2) return;

    // 1. Chuẩn hóa text để tìm từ khóa
    const cleanText = text.toUpperCase().replace(/[^A-Z0-9\s]/g, " "); 
    const pointLabels = geometry.points.map((p: any) => p.label?.toUpperCase()).filter((l:any) => l);
    const labelToId: Record<string, string> = {};
    geometry.points.forEach((p: any) => { if(p.label) labelToId[p.label.toUpperCase()] = p.id; });

    // Helper tạo segment
    const addSeg = (l1: string, l2: string) => {
        const id1 = labelToId[l1];
        const id2 = labelToId[l2];
        if (id1 && id2 && id1 !== id2) {
            // Kiểm tra trùng
            const exists = geometry.segments.some((s: any) => 
                (s.startPointId === id1 && s.endPointId === id2) || 
                (s.startPointId === id2 && s.endPointId === id1)
            );
            if (!exists) {
                geometry.segments.push({
                    id: generateId('s_auto'),
                    startPointId: id1,
                    endPointId: id2,
                    style: 'solid',
                    color: 'black',
                    strokeWidth: 1.5
                });
            }
        }
    };

    // 2. Quét các chuỗi điểm liền nhau trong văn bản (VD: "TAM GIAC ABC", "HINH CHU NHAT MNPQ")
    // Regex tìm các từ có 3-4 chữ cái in hoa liên tiếp là tên điểm
    const potentialShapes = cleanText.match(/\b[A-Z]{3,5}\b/g) || [];
    
    potentialShapes.forEach(shapeStr => {
        // Kiểm tra xem các ký tự trong chuỗi có phải là điểm đã tạo không
        const validPoints = shapeStr.split('').filter(char => labelToId[char]);
        
        // Nếu chuỗi hợp lệ (VD: "ABC" và cả A, B, C đều có trên hình)
        if (validPoints.length >= 3) {
            // Nối vòng tròn: A-B, B-C, C-A
            for (let i = 0; i < validPoints.length; i++) {
                addSeg(validPoints[i], validPoints[(i + 1) % validPoints.length]);
            }
        }
    });

    // 3. Fallback cuối cùng: Nếu hình chưa có nét nào và có ít điểm (< 6), nối vòng tròn theo thứ tự khai báo
    if ((!geometry.segments || geometry.segments.length === 0) && geometry.points.length >= 3 && geometry.points.length <= 6) {
        for (let i = 0; i < geometry.points.length; i++) {
            const p1 = geometry.points[i];
            const p2 = geometry.points[(i + 1) % geometry.points.length];
            // Chỉ nối nếu chưa có
            geometry.segments.push({
                id: generateId('s_fallback'),
                startPointId: p1.id,
                endPointId: p2.id,
                style: 'solid',
                color: 'black',
                strokeWidth: 1.5
            });
        }
    }
}

// --- SCALING ENGINE: PHÓNG TO HÌNH BÉ ---
function smartScaleAndCenter(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Lọc bỏ điểm rác (0,0) nếu đa số điểm khác nằm xa
    // Hoặc nếu tất cả đều nhỏ (0-1) thì giữ nguyên để scale sau
    const points = geometry.points;
    
    points.forEach((p: any) => {
        // Fix string to number types safely
        p.x = Number(p.x);
        p.y = Number(p.y);
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX;
    let height = maxY - minY;

    // A. PHÁT HIỆN TOẠ ĐỘ CHUẨN HÓA (0.0 - 1.0)
    // Nếu hình quá bé (dưới 10px), chắc chắn là toạ độ chuẩn hóa -> Phóng to 100 lần trước
    if (width < 50 || height < 50) {
        const preScale = 100;
        points.forEach((p: any) => { p.x *= preScale; p.y *= preScale; });
        if (geometry.circles) geometry.circles.forEach((c: any) => { if(c.radiusValue) c.radiusValue *= preScale; });
        // Recalculate bounds
        minX *= preScale; maxX *= preScale; minY *= preScale; maxY *= preScale;
        width *= preScale; height *= preScale;
    }

    // B. CĂN GIỮA VÀ FIT VÀO MÀN HÌNH (800x600)
    // Target Box
    const targetW = 600; 
    const targetH = 500;
    const targetCenterX = 500; // Canvas center X (1000/2)
    const targetCenterY = 400; // Canvas center Y (800/2)

    // Tránh chia cho 0
    if (width < 1) width = 100;
    if (height < 1) height = 100;

    const scaleX = targetW / width;
    const scaleY = targetH / height;
    const scale = Math.min(scaleX, scaleY, 5); // Max scale 5x để tránh phóng quá đại

    const currentCenterX = (minX + maxX) / 2;
    const currentCenterY = (minY + maxY) / 2;

    points.forEach((p: any) => {
        p.x = (p.x - currentCenterX) * scale + targetCenterX;
        p.y = (p.y - currentCenterY) * scale + targetCenterY;
    });

    // Scale bán kính đường tròn (nếu là số cố định)
    if (geometry.circles) {
        geometry.circles.forEach((c: any) => { 
            if (c.radiusValue) c.radiusValue *= scale; 
        });
    }
}

function resolveIds(geometry: any) {
    // Đảm bảo mọi thứ có ID và liên kết đúng
    const labelToId: Record<string, string> = {};
    
    // 1. Points
    geometry.points.forEach((p: any, idx: number) => {
        if (!p.id) p.id = generateId(`p_${idx}`);
        if (p.label) labelToId[p.label.trim().toUpperCase()] = p.id;
        // Mặc định màu đen nếu thiếu
        if (!p.color) p.color = 'black';
    });

    const resolve = (val: string) => {
        if (!val) return null;
        // Nếu là ID có sẵn (do mình tạo)
        if (geometry.points.some((p:any) => p.id === val)) return val;
        // Nếu là Label (A, B, C) -> Map sang ID
        return labelToId[val.trim().toUpperCase()] || null;
    };

    // 2. Segments (Convert Label -> ID)
    if (geometry.segments) {
        const validSegments: any[] = [];
        geometry.segments.forEach((s: any) => {
            // AI có thể trả về {from: "A", to: "B"} hoặc {startPointId: "A", ...}
            let start = resolve(s.startPointId || s.from || s.start);
            let end = resolve(s.endPointId || s.to || s.end);
            
            if (start && end) {
                if (!s.id) s.id = generateId('s');
                s.startPointId = start;
                s.endPointId = end;
                s.style = s.style || 'solid';
                s.color = s.color || 'black';
                s.strokeWidth = s.strokeWidth || 1.5;
                validSegments.push(s);
            }
        });
        geometry.segments = validSegments;
    } else {
        geometry.segments = [];
    }

    // 3. Circles
    if (geometry.circles) {
        const validCircles: any[] = [];
        geometry.circles.forEach((c: any) => {
            const center = resolve(c.centerId || c.center);
            const radiusP = resolve(c.radiusPointId || c.radiusPoint);
            
            if (center) {
                if (!c.id) c.id = generateId('c');
                c.centerId = center;
                if (radiusP) c.radiusPointId = radiusP;
                if (!c.radiusValue && !c.radiusPointId) c.radiusValue = 100; // Mặc định
                c.color = c.color || 'black';
                validCircles.push(c);
            }
        });
        geometry.circles = validCircles;
    } else {
        geometry.circles = [];
    }
    
    // 4. Angles
    if (geometry.angles) {
        const validAngles: any[] = [];
        geometry.angles.forEach((a: any) => {
            // format: {p1:"A", center:"B", p2:"C"}
            const p1 = resolve(a.p1 || a.point1Id);
            const center = resolve(a.center || a.centerId);
            const p2 = resolve(a.p2 || a.point2Id);
            if (p1 && center && p2) {
                validAngles.push({
                    id: generateId('ang'),
                    point1Id: p1,
                    centerId: center,
                    point2Id: p2,
                    isRightAngle: a.deg === 90 || a.isRightAngle,
                    showLabel: true,
                    color: 'black'
                });
            }
        });
        geometry.angles = validAngles;
    }
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
  
  // Prompt cực mạnh để ép AI trả về Segment
  const promptText = `
    TASK: Phân tích đề bài hình học (Text hoặc Ảnh) -> JSON.
    INPUT TEXT: "${text || "Đọc từ ảnh"}"
    
    YÊU CẦU ĐẶC BIỆT:
    1. Đọc tên các điểm (A, B, C...).
    2. Nối các điểm thành hình (Segments).
       - Thấy "Tam giác ABC" -> BẮT BUỘC trả về segments: A-B, B-C, C-A.
       - Thấy "Hình vuông ABCD" -> BẮT BUỘC trả về segments: A-B, B-C, C-D, D-A.
    3. Toạ độ: Hãy ước lượng toạ độ sao cho hình cân đối, đẹp.
    
    FORMAT JSON:
    {
      "detected_text": "Trích xuất lại đề bài",
      "points": [ {"label": "A", "x": 100, "y": 100}, {"label": "B", "x": 300, "y": 100}, ... ],
      "segments": [ {"from": "A", "to": "B"}, {"from": "B", "to": "C"}, ... ],
      "circles": [],
      "angles": []
    }
  `;
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 300000; // 5 phút

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
                  let rawText = typeof payload === 'string' ? payload : 
                                (payload.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(payload));

                  // 1. Parse JSON
                  const result = cleanAndParseJSON(rawText);
                  if (!result) throw new Error("JSON invalid");
                  
                  if (!result.geometry && result.points) {
                      // Nếu AI trả về flat object thay vì nested geometry
                      result.geometry = result; 
                  }
                  if (!result.geometry) result.geometry = { points: [], segments: [] };

                  // 2. Resolve IDs (Map Label -> ID)
                  resolveIds(result.geometry);

                  // 3. Fallback Auto-Connect (Nếu AI quên segments)
                  // Kết hợp text nhận diện được từ AI và text người dùng nhập
                  const fullText = (result.geometry.detected_text || "") + " " + text;
                  autoConnectPoints(result.geometry, fullText);

                  // 4. Smart Scale (Phóng to nếu hình bé)
                  smartScaleAndCenter(result.geometry);
                  
                  resolve({
                      geometry: result.geometry,
                      explanation: result.geometry.detected_text || "Đã dựng hình thành công."
                  });

              } catch (error: any) {
                  console.error("AI Processing Error:", error);
                  reject(new Error("Lỗi xử lý dữ liệu (JSON hỏng). Thử lại với ảnh rõ hơn."));
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              cleanup();
              reject(new Error(event.data.error || "Lỗi kết nối AI."));
          }
      };

      window.addEventListener('message', handleMessage);
      
      const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Hết thời gian chờ (5 phút)."));
      }, TIMEOUT);

      // Gửi yêu cầu ra ngoài (giả lập môi trường AI Studio)
      if (window.parent && window.parent !== window) {
          window.parent.postMessage({
              type: 'DRAW_REQUEST',
              requestId,
              payload: {
                  model: 'gemini-3-pro-preview', 
                  contents: [{ parts: parts }],
                  config: {
                      systemInstruction: SYSTEM_INSTRUCTION,
                      responseMimeType: "application/json",
                      thinkingConfig: { thinkingBudget: 4096 } // Thinking giúp AI suy luận hình tốt hơn
                  }
              }
          }, '*');
      } else {
          // Fallback cho môi trường dev local (nếu không có parent frame)
          reject(new Error("Vui lòng chạy trong môi trường tích hợp AI."));
      }
  });
};
