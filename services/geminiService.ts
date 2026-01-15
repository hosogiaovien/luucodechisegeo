
import { AIResponse, GeometryData, Point } from "../types";
import { generateId } from "../utils/geometry";

// --- HỆ THỐNG CHỈ DẪN NÂNG CẤP (SUPER PROMPT) ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Pro" - Chuyên gia hình học và thị giác máy tính.
Nhiệm vụ: Chuyển đổi đề bài (Text hoặc Hình ảnh) thành JSON cấu trúc để vẽ lên Canvas.

--- ĐỊNH DẠNG JSON MONG MUỐN ---
{
  "geometry": {
    "points": [{ "id": "A", "x": 100, "y": 100, "label": "A" }],
    "segments": [{ "startPointId": "A", "endPointId": "B", "style": "solid" }],
    "circles": [{ "centerId": "O", "radiusPointId": "A" }], 
    "cylinders": [{ "bottomCenterId": "O1", "topCenterId": "O2", "radiusPointId": "A" }],
    "cones": [{ "bottomCenterId": "O", "apexId": "S", "radiusPointId": "A" }],
    "spheres": [{ "centerId": "O", "radiusPointId": "M" }],
    "angles": [{ "centerId": "A", "point1Id": "B", "point2Id": "C", "isRightAngle": true }]
  },
  "explanation": "Giải thích ngắn gọn cách dựng hình..."
}

--- QUY TẮC XỬ LÝ QUAN TRỌNG ---
1. **HÌNH ẢNH (QUAN TRỌNG NHẤT)**: 
   - Nếu đầu vào là ảnh: Bạn PHẢI nhìn kỹ các đường nét. Nếu thấy đoạn thẳng nối A và B, BẮT BUỘC phải thêm vào mảng "segments".
   - Đừng để các điểm nằm rời rạc. Nếu là hình vẽ tay tam giác, hãy nối 3 điểm đó lại.
   - Nếu thấy hình tròn, hãy trả về "circles". Nếu thấy hình trụ/nón/cầu, trả về "cylinders"/"cones"/"spheres".

2. **VĂN BẢN (TEXT)**:
   - "Đường tròn tâm O": Tạo điểm O và thêm vào mảng "circles".
   - "Tiếp tuyến": Vẽ đoạn thẳng tiếp xúc đường tròn (hoặc vuông góc bán kính).
   - "Hình trụ/Nón/Cầu": Dùng các mảng "cylinders", "cones", "spheres" tương ứng. Đừng vẽ thủ công bằng elip nếu có thể dùng đối tượng 3D chuẩn.
   - "Vuông tại A": Thêm vào "angles" với isRightAngle: true.

3. **TỌA ĐỘ**: Canvas rộng 1000x800. Hãy phân bố hình vẽ cân đối ở giữa (khoảng x: 300-700, y: 200-600).
`;

function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    let clean = text.replace(/```json/gi, "").replace(/```/g, "");
    
    // Tìm JSON object đầu tiên và cuối cùng
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    
    try {
        // Sửa lỗi JSON phổ biến do AI sinh ra
        clean = clean.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"); // Xóa dấu phẩy thừa
        clean = clean.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":'); // Đảm bảo key có ngoặc kép
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return null;
    }
}

// Helper: Xóa dấu tiếng Việt để xử lý regex dễ hơn
function removeVietnameseTones(str: string): string {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str;
}

// --- LOGIC TOÁN HỌC & HEURISTIC ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) return;
    
    const rawText = problemText.toUpperCase();
    const text = removeVietnameseTones(rawText); 
    const points = geometry.points as any[];
    
    // 1. Tạo Map: Label -> Point Object & ID
    const labelMap: Record<string, any> = {};
    const idMap: Record<string, any> = {};
    points.forEach(p => {
        idMap[p.id] = p;
        if (p.label) labelMap[p.label.toUpperCase()] = p;
    });

    // Helper tạo đoạn thẳng
    const ensureSegment = (id1: string, id2: string) => {
        if (!id1 || !id2 || id1 === id2) return;
        if (!geometry.segments) geometry.segments = [];
        const exists = geometry.segments.some((s: any) => 
            (s.startPointId === id1 && s.endPointId === id2) || 
            (s.startPointId === id2 && s.endPointId === id1)
        );
        if (!exists) {
            geometry.segments.push({
                id: generateId('s_auto'),
                startPointId: id1, endPointId: id2,
                style: 'solid', color: 'black', strokeWidth: 1.5
            });
        }
    };

    // Helper tạo góc vuông
    const ensureRightAngle = (centerLabel: string) => {
        const p = labelMap[centerLabel];
        if (!p) return;
        if (!geometry.angles) geometry.angles = [];
        // Tìm 2 điểm nối với center này để tạo góc
        const neighbors: string[] = [];
        if (geometry.segments) {
            geometry.segments.forEach((s: any) => {
                if (s.startPointId === p.id) neighbors.push(s.endPointId);
                if (s.endPointId === p.id) neighbors.push(s.startPointId);
            });
        }
        if (neighbors.length >= 2) {
            const exists = geometry.angles.some((a: any) => a.centerId === p.id && a.isRightAngle);
            if (!exists) {
                geometry.angles.push({
                    id: generateId('ang_auto'),
                    centerId: p.id, point1Id: neighbors[0], point2Id: neighbors[1],
                    isRightAngle: true, color: 'black'
                });
            }
        }
    };

    // --- A. XỬ LÝ TRUNG ĐIỂM (Logic Toán Học) ---
    // Regex: "M LA TRUNG DIEM CUA AB" hoặc "TRUNG DIEM M CUA AB"
    const midpointRegex = /(?:([A-Z]) LA TRUNG DIEM (?:CUA)? ([A-Z]{2}))|(?:TRUNG DIEM ([A-Z]) (?:CUA)? ([A-Z]{2}))/g;
    let midMatch;
    while ((midMatch = midpointRegex.exec(text)) !== null) {
        const midLabel = midMatch[1] || midMatch[3];
        const segmentLabels = midMatch[2] || midMatch[4];
        const pA = labelMap[segmentLabels[0]];
        const pB = labelMap[segmentLabels[1]];
        
        if (pA && pB && !labelMap[midLabel]) {
            // Tự động tính toán và tạo điểm trung điểm nếu AI quên
            const midPoint = {
                id: generateId('p_mid'),
                x: (pA.x + pB.x) / 2,
                y: (pA.y + pB.y) / 2,
                label: midLabel,
                color: 'black',
                radius: 4
            };
            geometry.points.push(midPoint);
            labelMap[midLabel] = midPoint; // Update map
            idMap[midPoint.id] = midPoint;
            
            // Nối A-M và M-B (hoặc đảm bảo A-B tồn tại và M nằm trên đó)
            ensureSegment(pA.id, midPoint.id);
            ensureSegment(midPoint.id, pB.id);
        }
    }

    // --- B. XỬ LÝ ĐƯỜNG TRÒN ---
    // "DUONG TRON TAM O"
    const circleRegex = /DUONG TRON TAM ([A-Z])/g;
    let circMatch;
    while ((circMatch = circleRegex.exec(text)) !== null) {
        const centerLabel = circMatch[1];
        const center = labelMap[centerLabel];
        if (center) {
            if (!geometry.circles) geometry.circles = [];
            // Kiểm tra xem đã có đường tròn tâm này chưa
            const exists = geometry.circles.some((c: any) => c.centerId === center.id);
            if (!exists) {
                // Tìm một điểm khác để làm bán kính, hoặc mặc định bán kính
                let radiusPointId = undefined;
                let radiusValue = 80; // Default px
                
                // Thử tìm điểm nào đó nối với tâm
                const neighborSeg = geometry.segments?.find((s: any) => s.startPointId === center.id || s.endPointId === center.id);
                if (neighborSeg) {
                    radiusPointId = neighborSeg.startPointId === center.id ? neighborSeg.endPointId : neighborSeg.startPointId;
                    radiusValue = undefined; // Use point
                }

                geometry.circles.push({
                    id: generateId('c_auto'),
                    centerId: center.id,
                    radiusPointId: radiusPointId,
                    radiusValue: radiusValue,
                    color: 'black',
                    style: 'solid'
                });
            }
        }
    }

    // --- C. NỐI ĐIỂM CƠ BẢN (Text Pattern) ---
    // Tam giác
    const triRegex = /TAM GIAC ([A-Z]{3})/g;
    let match;
    while ((match = triRegex.exec(text)) !== null) {
        const lbls = match[1];
        if (labelMap[lbls[0]] && labelMap[lbls[1]]) ensureSegment(labelMap[lbls[0]].id, labelMap[lbls[1]].id);
        if (labelMap[lbls[1]] && labelMap[lbls[2]]) ensureSegment(labelMap[lbls[1]].id, labelMap[lbls[2]].id);
        if (labelMap[lbls[2]] && labelMap[lbls[0]]) ensureSegment(labelMap[lbls[2]].id, labelMap[lbls[0]].id);
    }
    // Tứ giác
    const quadRegex = /(?:TU GIAC|HINH CHU NHAT|HINH VUONG|HINH THANG|HINH BINH HANH)\s+([A-Z]{4})/g;
    while ((match = quadRegex.exec(text)) !== null) {
        const lbls = match[1];
        for(let i=0; i<4; i++) {
            const p1 = labelMap[lbls[i]];
            const p2 = labelMap[lbls[(i+1)%4]];
            if (p1 && p2) ensureSegment(p1.id, p2.id);
        }
    }
    // Góc vuông
    const rightAngleRegex = /VUONG TAI\s+([A-Z])/g;
    while ((match = rightAngleRegex.exec(text)) !== null) {
        ensureRightAngle(match[1]);
    }

    // --- D. SAFETY NET (LƯỚI AN TOÀN CHO HÌNH ẢNH) ---
    // Nếu AI trả về điểm từ ảnh nhưng KHÔNG CÓ đoạn thẳng nào (thường xảy ra với ảnh)
    // Hoặc số đoạn thẳng quá ít so với số điểm.
    const segmentCount = geometry.segments ? geometry.segments.length : 0;
    const pointCount = points.length;
    
    // Logic: Nếu có > 2 điểm mà không có đường nối -> Nối vòng (Convex Hull giả lập)
    if (segmentCount === 0 && pointCount >= 3) {
        // Sắp xếp điểm theo góc để nối thành vòng tròn (tránh nối chéo lung tung)
        // 1. Tìm tâm
        let cx = 0, cy = 0;
        points.forEach(p => { cx += p.x; cy += p.y; });
        cx /= pointCount; cy /= pointCount;
        
        // 2. Sort theo góc quanh tâm
        const sortedPoints = [...points].sort((a, b) => {
            const angA = Math.atan2(a.y - cy, a.x - cx);
            const angB = Math.atan2(b.y - cy, b.x - cx);
            return angA - angB;
        });

        // 3. Nối vòng
        for (let i = 0; i < pointCount; i++) {
            ensureSegment(sortedPoints[i].id, sortedPoints[(i+1)%pointCount].id);
        }
    }
}

// Xử lý ID tham chiếu (Label -> ID)
function resolveGeometryReferences(geometry: any) {
    if (!geometry.points) return;
    const labelToId: Record<string, string> = {};
    const idMap: Record<string, any> = {};

    geometry.points.forEach((p: any) => {
        idMap[p.id] = p;
        if (p.label) labelToId[p.label.toUpperCase()] = p.id;
    });

    const resolve = (ref: string) => {
        if (!ref) return ref;
        if (idMap[ref]) return ref; // Đã là ID đúng
        return labelToId[ref.toUpperCase()] || ref; // Thử tìm theo Label
    };

    const processCollection = (key: string, fields: string[]) => {
        if (geometry[key]) {
            geometry[key].forEach((item: any) => {
                fields.forEach(field => {
                    if (item[field]) item[field] = resolve(item[field]);
                });
            });
            // Lọc bỏ các item có tham chiếu hỏng (không tìm thấy ID)
            geometry[key] = geometry[key].filter((item: any) => 
                fields.every(field => !item[field] || idMap[item[field]])
            );
        }
    };

    processCollection('segments', ['startPointId', 'endPointId']);
    processCollection('lines', ['p1Id', 'p2Id']);
    processCollection('rays', ['startPointId', 'directionPointId']);
    processCollection('circles', ['centerId', 'radiusPointId']);
    processCollection('arcs', ['centerId', 'startPointId', 'endPointId']);
    processCollection('angles', ['centerId', 'point1Id', 'point2Id']);
    processCollection('cylinders', ['bottomCenterId', 'topCenterId', 'radiusPointId']);
    processCollection('cones', ['bottomCenterId', 'apexId', 'radiusPointId']);
    processCollection('spheres', ['centerId', 'radiusPointId']);
}

// Scale và căn giữa hình
function scaleAndCenterGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;
    
    // 1. Tính Bounding Box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    geometry.points.forEach((p: any) => {
        p.x = Number(p.x); p.y = Number(p.y);
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX || 1;
    let height = maxY - minY || 1;
    
    // 2. Tính Scale Factor (Target size ~ 400px)
    const TARGET_SIZE = 450;
    const currentSize = Math.max(width, height);
    let scale = 1;
    
    // Chỉ scale nếu hình quá nhỏ (<100) hoặc quá lớn (>800)
    if (currentSize < 150 || currentSize > 800) {
        scale = TARGET_SIZE / currentSize;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const canvasCenterX = 500; // SVG center
    const canvasCenterY = 400;

    // 3. Apply Transform
    geometry.points.forEach((p: any) => {
        p.x = (p.x - centerX) * scale + canvasCenterX;
        p.y = (p.y - centerY) * scale + canvasCenterY;
    });
    
    // Scale các giá trị bán kính nếu có
    if (geometry.circles) {
        geometry.circles.forEach((c: any) => { if(c.radiusValue) c.radiusValue *= scale; });
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
  
  const promptText = `
    Đề bài: "${text}"
    YÊU CẦU:
    1. Trả về JSON chứa mảng "points", "segments".
    2. Nếu có hình tròn/trụ/nón/cầu, dùng mảng "circles"/"cylinders"/"cones"/"spheres".
    3. QUAN TRỌNG: Nếu là hình ảnh, hãy tìm mọi đường nối (segments) có thể thấy và trả về. Đừng để các điểm rời rạc.
  `;
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 60000; 

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

                  const result = cleanAndParseJSON(rawText);
                  if (!result) throw new Error("JSON invalid");
                  
                  normalizeAndResolve(result, text, resolve);

              } catch (error: any) {
                  console.error("AI Error:", error);
                  reject(new Error("Lỗi xử lý AI: " + error.message));
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
          reject(new Error("Quá thời gian chờ (Timeout)."));
      }, TIMEOUT);

      window.parent.postMessage({
          type: 'DRAW_REQUEST',
          requestId,
          payload: {
              model: 'gemini-3-pro-preview', // Dùng model mạnh nhất cho reasoning
              contents: [{ parts: parts }],
              config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  responseMimeType: "application/json"
              }
          }
      }, '*');
  });
};

function normalizeAndResolve(result: any, originalText: string, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: "Đã tạo hình vẽ." };
    }
    if (!result.geometry) result.geometry = { points: [] };
    
    const g = result.geometry;
    
    // Init arrays
    ['points', 'segments', 'circles', 'texts', 'angles', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (!g[key]) g[key] = [];
        // Auto ID
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    // 1. Resolve References (Label -> ID)
    resolveGeometryReferences(g);

    // 2. HEURISTIC: Auto-connect, Auto-Midpoint, Auto-Circle based on text
    enhanceGeometryWithTextAnalysis(g, originalText);

    // 3. Resolve again (in case heuristic added items with Labels)
    resolveGeometryReferences(g);

    // 4. Center View
    scaleAndCenterGeometry(g);
    
    resolve(result);
}
