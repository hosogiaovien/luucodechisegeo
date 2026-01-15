
import { AIResponse } from "../types";

const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Trợ lý AI chuyên về hình học phẳng.
Nhiệm vụ: Chuyển đổi đề bài toán (văn bản hoặc hình ảnh) thành cấu trúc dữ liệu JSON để vẽ hình.

--- QUY TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ) ---
1. **KHÔNG BAO GIỜ CHỈ TRẢ VỀ ĐIỂM (POINTS)**.
   - Một hình vẽ hình học VÔ NGHĨA nếu thiếu các đường nối (Segments).
   - Nếu bạn tạo điểm A và B, hãy tự hỏi: "A và B có nối với nhau không?". Nếu có (là cạnh tam giác, đường chéo...), PHẢI tạo Segment nối chúng.

2. **CẤU TRÚC DỮ LIỆU CHUẨN**:
   - **points**: [{ id: "A", x: 100, y: 100, label: "A" }, ...]
   - **segments**: [{ startPointId: "A", endPointId: "B", style: "solid" }, ...] 
     -> LƯU Ý: \`startPointId\` và \`endPointId\` phải trùng khớp với \`id\` hoặc \`label\` của các điểm trong mảng \`points\`.
   - **angles**: [{ point1Id: "B", centerId: "A", point2Id: "C", isRightAngle: true }] (Dùng cho góc vuông hoặc góc thường).
   - **circles**: [{ centerId: "O", radiusPointId: "A" }] (Đường tròn tâm O bán kính OA).

3. **PHÂN TÍCH TỪ KHÓA**:
   - "Vuông góc tại A" -> Tạo đối tượng **angles** với \`isRightAngle: true\` tại đỉnh A.
   - "Trung điểm M của BC" -> Tạo điểm M nằm giữa B và C, và nhớ tạo segment BM, MC (hoặc BC).
   - "Đường cao AH" -> Tạo điểm H trên cạnh đối diện, tạo segment AH, và tạo ký hiệu góc vuông tại H.

4. **HỆ TỌA ĐỘ**:
   - Canvas kích thước 1000x800. Gốc (0,0) ở góc trên trái.
   - Hãy tính toán tọa độ sao cho hình vẽ nằm thoáng, rộng, căn giữa (x khoảng 300-700, y khoảng 200-600).

--- VÍ DỤ JSON MẪU (HỌC THEO CẤU TRÚC NÀY) ---
Input: "Cho tam giác ABC vuông tại A."
Output:
{
  "geometry": {
    "points": [
      { "id": "A", "x": 200, "y": 500, "label": "A" },
      { "id": "B", "x": 200, "y": 200, "label": "B" },
      { "id": "C", "x": 600, "y": 500, "label": "C" }
    ],
    "segments": [
      { "id": "AB", "startPointId": "A", "endPointId": "B" },
      { "id": "AC", "startPointId": "A", "endPointId": "C" },
      { "id": "BC", "startPointId": "B", "endPointId": "C" }
    ],
    "angles": [
      { "id": "angA", "point1Id": "B", "centerId": "A", "point2Id": "C", "isRightAngle": true }
    ]
  },
  "explanation": "Vẽ tam giác vuông ABC với góc A = 90 độ."
}
`;

// --- ROBUST JSON PARSER ---
function cleanAndParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    
    let clean = text;
    // Remove Markdown
    clean = clean.replace(/```json/gi, "").replace(/```/g, "");
    
    // Extract JSON object
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    } else {
        return null; 
    }

    // Remove Comments
    clean = clean.replace(/\/\/.*$/gm, ""); 
    clean = clean.replace(/\/\*[\s\S]*?\*\//g, "");

    try {
        return JSON.parse(clean);
    } catch (e) {
        // Try fixing trailing commas
        try {
            clean = clean.replace(/,\s*}/g, "}");
            clean = clean.replace(/,\s*]/g, "]");
            return JSON.parse(clean);
        } catch (e2) {
            console.error("JSON Parse Error:", e2);
            return null;
        }
    }
}

// --- SMART ID RESOLVER (FIX MISSING LINKS) ---
// AI thường trả về ID đoạn thẳng là "A", "B" (theo label) thay vì ID thực (ví dụ "p1", "p2").
// Hàm này sẽ map lại cho đúng.
function resolveGeometryReferences(geometry: any) {
    if (!geometry.points) return;

    const labelToId: Record<string, string> = {};
    const idMap: Record<string, string> = {};

    // 1. Build Lookup Maps
    geometry.points.forEach((p: any) => {
        // Map original ID to itself
        idMap[p.id] = p.id;
        // Map Label to ID (e.g. "A" -> "p_123")
        if (p.label) {
            labelToId[p.label] = p.id;
            labelToId[p.label.toLowerCase()] = p.id; // Support lowercase
        }
    });

    const resolve = (ref: string) => {
        if (!ref) return ref;
        // Case 1: Ref is already a valid ID
        if (idMap[ref]) return ref;
        // Case 2: Ref is a Label (e.g. "A")
        if (labelToId[ref]) return labelToId[ref];
        if (labelToId[ref.toLowerCase()]) return labelToId[ref.toLowerCase()];
        return ref; // Fallback
    };

    // 2. Fix Segments
    if (geometry.segments) {
        geometry.segments.forEach((s: any) => {
            s.startPointId = resolve(s.startPointId);
            s.endPointId = resolve(s.endPointId);
        });
        // Filter out broken segments where IDs couldn't be resolved
        geometry.segments = geometry.segments.filter((s: any) => 
            idMap[s.startPointId] && idMap[s.endPointId]
        );
    }

    // 3. Fix Circles
    if (geometry.circles) {
        geometry.circles.forEach((c: any) => {
            c.centerId = resolve(c.centerId);
            if (c.radiusPointId) c.radiusPointId = resolve(c.radiusPointId);
        });
    }

    // 4. Fix Angles
    if (geometry.angles) {
        geometry.angles.forEach((a: any) => {
            a.centerId = resolve(a.centerId);
            a.point1Id = resolve(a.point1Id);
            a.point2Id = resolve(a.point2Id);
        });
    }
}

// --- AUTO SCALING & CENTERING ---
function scaleAndCenterGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    geometry.points.forEach((p: any) => {
        if (typeof p.x !== 'number') p.x = parseFloat(p.x);
        if (typeof p.y !== 'number') p.y = parseFloat(p.y);
        
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX;
    let height = maxY - minY;
    
    if (!isFinite(width)) width = 0;
    if (!isFinite(height)) height = 0;
    if (width === 0) width = 1;
    if (height === 0) height = 1;

    const targetSize = 450;
    const currentMaxSize = Math.max(width, height);
    
    let scale = 1;
    if (currentMaxSize < 300) {
        scale = targetSize / currentMaxSize;
    } else if (currentMaxSize > 1500) {
        scale = targetSize / currentMaxSize;
    }

    if (scale !== 1) {
        geometry.points.forEach((p: any) => { p.x *= scale; p.y *= scale; });
        if (geometry.circles) geometry.circles.forEach((c: any) => { if (c.radiusValue) c.radiusValue *= scale; });
        if (geometry.ellipses) geometry.ellipses.forEach((e: any) => { 
            if (e.rx) e.rx *= scale; if (e.ry) e.ry *= scale; 
            if (e.cx) e.cx *= scale; if (e.cy) e.cy *= scale; 
        });
        minX *= scale; maxX *= scale; minY *= scale; maxY *= scale;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const TARGET_CENTER_X = 500;
    const TARGET_CENTER_Y = 400;
    const dx = TARGET_CENTER_X - centerX;
    const dy = TARGET_CENTER_Y - centerY;

    geometry.points.forEach((p: any) => { p.x += dx; p.y += dy; });
    if (geometry.texts) geometry.texts.forEach((t: any) => { if (t.x !== undefined) t.x = t.x * scale + dx; if (t.y !== undefined) t.y = t.y * scale + dy; });
    if (geometry.ellipses) geometry.ellipses.forEach((e: any) => { if (e.cx !== undefined) e.cx += dx; if (e.cy !== undefined) e.cy += dy; });
    if (geometry.images) geometry.images.forEach((i: any) => { i.x = i.x * scale + dx; i.y = i.y * scale + dy; });
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
    [YÊU CẦU DỰNG HÌNH]
    Đề bài: "${text}"
    
    Hãy phân tích và trả về JSON vẽ hình.
    QUAN TRỌNG:
    1. Đừng quên nối các điểm (segments). Ví dụ: Tam giác ABC phải có segments AB, BC, CA.
    2. Nếu có góc vuông, hãy thêm vào mảng "angles" với isRightAngle: true.
    3. Nếu là input hình ảnh, hãy cố gắng nhận diện và vẽ lại đầy đủ các đường nét.
  `;
  
  parts.push({ text: promptText });

  return new Promise((resolve, reject) => {
      const requestId = Date.now().toString();
      const TIMEOUT = 120000; 

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
                  let rawText = '';

                  if (typeof payload === 'string') {
                      rawText = payload;
                  } else if (payload && typeof payload === 'object') {
                      if (payload.candidates && payload.candidates[0]?.content?.parts?.[0]?.text) {
                          rawText = payload.candidates[0].content.parts[0].text;
                      } else if (payload.geometry) {
                          normalizeAndResolve(payload, resolve);
                          return;
                      } else {
                          rawText = JSON.stringify(payload);
                      }
                  }

                  const result = cleanAndParseJSON(rawText);
                  if (!result) throw new Error("Không thể đọc dữ liệu JSON.");
                  
                  normalizeAndResolve(result, resolve);

              } catch (error: any) {
                  console.error("Lỗi xử lý AI:", error);
                  reject(new Error("Dữ liệu trả về không hợp lệ."));
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
          reject(new Error("Quá thời gian chờ."));
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

function normalizeAndResolve(result: any, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: "Đã tạo hình vẽ." };
    }
    
    if (!result.geometry) {
        if (result.geometryData) result.geometry = result.geometryData;
        else result.geometry = { points: [], segments: [], circles: [], ellipses: [], angles: [], texts: [], lines: [] };
    }
    
    const g = result.geometry;
    const ensureArray = (key: string) => { if (!g[key]) g[key] = []; };
    
    ensureArray('points');
    ensureArray('segments');
    ensureArray('lines');
    ensureArray('circles');
    ensureArray('ellipses');
    ensureArray('angles');
    ensureArray('texts');
    
    // 1. Auto-fix IDs if missing
    ['points', 'segments', 'circles', 'texts', 'angles'].forEach(key => {
        if(g[key]) {
            g[key].forEach((item: any, idx: number) => {
                if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
            });
        }
    });

    // 2. RESOLVE REFERENCES (Map Label "A" -> ID "p_1")
    resolveGeometryReferences(g);

    // 3. SCALE & CENTER
    scaleAndCenterGeometry(g);
    
    resolve(result);
}
