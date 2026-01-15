
import { AIResponse, GeometryData, Point } from "../types";
import { generateId } from "../utils/geometry";

// --- HỆ THỐNG CHỈ DẪN NÂNG CẤP (SUPER PROMPT V3) ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Pro" - Chuyên gia hình học và thị giác máy tính.
Nhiệm vụ: Chuyển đổi đề bài (Text hoặc Hình ảnh) thành JSON cấu trúc để vẽ lên Canvas 1000x800.

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
  "explanation": "Giải thích..."
}

--- QUY TẮC QUAN TRỌNG ---
1. **HÌNH ẢNH**: Nếu đầu vào là ảnh, hãy cố gắng xác định mọi đường nối. Nếu thấy một đa giác, hãy nối khép kín.
2. **KÍCH THƯỚC**: Hãy dùng hệ tọa độ lớn (x từ 0-1000, y từ 0-800). ĐỪNG dùng số nhỏ (0-1).
3. **ĐỐI TƯỢNG**: 
   - Thấy "Hình nón" -> tạo "cones".
   - Thấy "Hình trụ" -> tạo "cylinders".
   - Thấy "Đường tròn" -> tạo "circles".
   - Thấy "Tiếp tuyến" -> vẽ đoạn thẳng vuông góc bán kính.
`;

function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    let clean = text.replace(/```json/gi, "").replace(/```/g, "");
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    try {
        clean = clean.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        return JSON.parse(clean);
    } catch (e) {
        console.error("JSON Parse Error", e);
        return null;
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
    
    const labelMap: Record<string, any> = {};
    const idMap: Record<string, any> = {};
    geometry.points.forEach((p: any) => {
        idMap[p.id] = p;
        if (p.label) labelMap[p.label.toUpperCase()] = p;
    });

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

    // 1. Tự động tạo hình cơ bản từ Text (Tam giác, Tứ giác)
    const triRegex = /TAM GIAC ([A-Z]{3})/g;
    let match;
    while ((match = triRegex.exec(text)) !== null) {
        const lbls = match[1];
        if (labelMap[lbls[0]] && labelMap[lbls[1]]) ensureSegment(labelMap[lbls[0]].id, labelMap[lbls[1]].id);
        if (labelMap[lbls[1]] && labelMap[lbls[2]]) ensureSegment(labelMap[lbls[1]].id, labelMap[lbls[2]].id);
        if (labelMap[lbls[2]] && labelMap[lbls[0]]) ensureSegment(labelMap[lbls[2]].id, labelMap[lbls[0]].id);
    }

    const quadRegex = /(?:TU GIAC|HINH CHU NHAT|HINH VUONG|HINH THANG|HINH BINH HANH)\s+([A-Z]{4})/g;
    while ((match = quadRegex.exec(text)) !== null) {
        const lbls = match[1];
        for(let i=0; i<4; i++) {
            const p1 = labelMap[lbls[i]];
            const p2 = labelMap[lbls[(i+1)%4]];
            if (p1 && p2) ensureSegment(p1.id, p2.id);
        }
    }

    // 2. Logic Hình Học Cao Cấp (Nón, Trụ, Cầu, Đường Tròn)
    // Nếu trong đề có từ khóa nhưng AI chưa tạo object, ta tự tạo
    
    // a. Đường tròn tâm O
    const circleRegex = /DUONG TRON (?:TAM )?([A-Z])/g;
    while ((match = circleRegex.exec(text)) !== null) {
        const center = labelMap[match[1]];
        if (center && (!geometry.circles || !geometry.circles.some((c:any) => c.centerId === center.id))) {
            if (!geometry.circles) geometry.circles = [];
            geometry.circles.push({
                id: generateId('c_auto'),
                centerId: center.id,
                radiusValue: 100, // Default radius if no point found
                color: 'black'
            });
        }
    }

    // b. Hình trụ (Cylinder)
    if (text.includes("HINH TRU")) {
        if (!geometry.cylinders || geometry.cylinders.length === 0) {
            // Cố gắng tìm 2 tâm đáy O, O'
            const centers = geometry.points.filter((p:any) => p.label && (p.label.includes('O') || p.label.includes('I')));
            if (centers.length >= 2) {
                if(!geometry.cylinders) geometry.cylinders = [];
                // Tạo điểm bán kính ảo
                const rPoint = { id: generateId('p_rad'), x: centers[1].x + 80, y: centers[1].y, label: '', hidden: true };
                geometry.points.push(rPoint);
                geometry.cylinders.push({
                    id: generateId('cyl_auto'),
                    bottomCenterId: centers[0].id,
                    topCenterId: centers[1].id,
                    radiusPointId: rPoint.id,
                    color: 'black'
                });
            }
        }
    }

    // 3. SAFETY NET CHO HÌNH ẢNH (Ảnh -> Điểm -> Thiếu Nét)
    // Nếu có > 2 điểm mà ít đoạn thẳng -> Nối vòng
    const segmentCount = geometry.segments ? geometry.segments.length : 0;
    const pointCount = geometry.points.length;
    
    if (segmentCount < pointCount && pointCount >= 3) {
        // Sắp xếp điểm theo góc để nối thành vòng tròn (tránh nối chéo lung tung)
        // 1. Tìm tâm
        let cx = 0, cy = 0;
        geometry.points.forEach((p:any) => { cx += p.x; cy += p.y; });
        cx /= pointCount; cy /= pointCount;
        
        // 2. Sort theo góc quanh tâm
        const sortedPoints = [...geometry.points].sort((a:any, b:any) => {
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
        if (idMap[ref]) return ref; 
        return labelToId[ref.toUpperCase()] || ref; 
    };

    ['segments', 'lines', 'rays', 'circles', 'arcs', 'angles', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (geometry[key]) {
            geometry[key].forEach((item: any) => {
                for (const prop in item) {
                    if (prop.endsWith('Id') && typeof item[prop] === 'string') {
                        item[prop] = resolve(item[prop]);
                    }
                }
            });
            // Lọc bỏ items hỏng
            geometry[key] = geometry[key].filter((item: any) => {
                for (const prop in item) {
                    if (prop.endsWith('Id') && typeof item[prop] === 'string') {
                        if (!idMap[item[prop]]) return false;
                    }
                }
                return true;
            });
        }
    });
}

// --- FIX & SCALE: CHỐNG GOM CỤC ---
function fixAndScaleGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;
    
    // 1. Kiểm tra tọa độ hỏng (tất cả về 0 hoặc trùng nhau)
    let allZero = true;
    let allSame = true;
    const firstP = geometry.points[0];
    
    geometry.points.forEach((p: any) => {
        if (p.x !== 0 || p.y !== 0) allZero = false;
        if (Math.abs(p.x - firstP.x) > 1 || Math.abs(p.y - firstP.y) > 1) allSame = false;
        // Fix undefined/null
        if (p.x === undefined) p.x = 0;
        if (p.y === undefined) p.y = 0;
    });

    // Nếu hỏng -> Explode points thành vòng tròn để user chỉnh
    if (allZero || allSame) {
        const radius = 200;
        const cx = 500;
        const cy = 400;
        const n = geometry.points.length;
        geometry.points.forEach((p: any, i: number) => {
            const ang = (i / n) * 2 * Math.PI;
            p.x = cx + radius * Math.cos(ang);
            p.y = cy + radius * Math.sin(ang);
        });
        return; // Đã fix xong, không cần scale nữa
    }

    // 2. Tính Bounding Box hiện tại
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    geometry.points.forEach((p: any) => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX;
    let height = maxY - minY;
    
    // Nếu width/height quá nhỏ (< 10 đơn vị) -> Có thể là tọa độ chuẩn hóa (0-1) hoặc lỗi
    if (width < 10 || height < 10) {
        // Phóng to cực mạnh
        const scaleFactor = 400 / Math.max(width, height, 0.1); // Tránh chia 0
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        
        geometry.points.forEach((p: any) => {
            p.x = (p.x - cx) * scaleFactor + 500;
            p.y = (p.y - cy) * scaleFactor + 400;
        });
    } else {
        // Scale bình thường để fit vào 1000x800
        const targetW = 600;
        const targetH = 500;
        const scaleX = width > 0 ? targetW / width : 1;
        const scaleY = height > 0 ? targetH / height : 1;
        const scale = Math.min(scaleX, scaleY, 1.5); // Không phóng to quá mức nếu hình đã to

        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        geometry.points.forEach((p: any) => {
            p.x = (p.x - cx) * scale + 500;
            p.y = (p.y - cy) * scale + 400;
        });
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
    YÊU CẦU XỬ LÝ:
    1. Trích xuất các điểm, đoạn thẳng, đường tròn...
    2. NẾU LÀ ẢNH: Hãy nhìn kỹ các nét vẽ. Nếu thấy một hình khép kín (tam giác, tứ giác...), HÃY TRẢ VỀ CÁC SEGMENT NỐI CHÚNG. Đừng chỉ trả về điểm.
    3. TỌA ĐỘ: Hãy ước lượng tọa độ sao cho hình cân đối. Đừng để các điểm trùng nhau.
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

function normalizeAndResolve(result: any, originalText: string, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: "Đã tạo hình vẽ." };
    }
    if (!result.geometry) result.geometry = { points: [] };
    
    const g = result.geometry;
    
    ['points', 'segments', 'circles', 'texts', 'angles', 'cylinders', 'cones', 'spheres'].forEach(key => {
        if (!g[key]) g[key] = [];
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    // 1. Resolve ID References
    resolveGeometryReferences(g);

    // 2. Fix & Scale Coordinates (ANTI-CLUMPING)
    fixAndScaleGeometry(g);

    // 3. Heuristic Enhancement (Auto-Connect, Auto-Shapes)
    enhanceGeometryWithTextAnalysis(g, originalText);

    // 4. Resolve again (for newly added heuristic items)
    resolveGeometryReferences(g);
    
    resolve(result);
}
