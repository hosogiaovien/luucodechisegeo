
import { AIResponse, GeometryData, Point } from "../types";
import { generateId } from "../utils/geometry";

const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Trợ lý AI chuyên về hình học phẳng.
Nhiệm vụ: Chuyển đổi đề bài toán (văn bản hoặc hình ảnh) thành cấu trúc dữ liệu JSON để vẽ hình.

--- QUY TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ) ---
1. **KHÔNG ĐƯỢC QUÊN ĐƯỜNG NỐI (SEGMENTS)**:
   - Có điểm là PHẢI có đường.
   - Ví dụ: Tam giác ABC -> Bắt buộc mảng "segments" phải chứa: AB, BC, CA.
   
2. **CẤU TRÚC JSON**:
   {
     "geometry": {
       "points": [{ "id": "A", "x": 300, "y": 200, "label": "A" }, ...],
       "segments": [{ "startPointId": "A", "endPointId": "B", "style": "solid" }, ...],
       "circles": [],
       "angles": [{ "centerId": "A", "point1Id": "B", "point2Id": "C", "isRightAngle": true }]
     },
     "explanation": "..."
   }

3. **KÝ HIỆU**:
   - "Vuông tại A" -> Thêm vào "angles" với isRightAngle: true.
   - "Đường cao" -> Segment nét liền + Góc vuông.
   - "Đường trung tuyến/Phân giác" -> Vẽ segment.

4. **TỌA ĐỘ**: Canvas 1000x800. Hãy dàn trải hình vẽ ra giữa.
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
        // Aggressive fix for common LLM JSON errors
        try {
            // Fix trailing commas
            clean = clean.replace(/,\s*}/g, "}");
            clean = clean.replace(/,\s*]/g, "]");
            // Fix missing quotes on keys
            clean = clean.replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":');
            return JSON.parse(clean);
        } catch (e2) {
            console.error("JSON Parse Error:", e2);
            return null;
        }
    }
}

// --- HEURISTIC ENGINE: THE "BACKUP BRAIN" ---
// Tự động nối điểm và thêm ký hiệu dựa trên phân tích văn bản đề bài
// Chạy sau khi AI trả về kết quả để trám các lỗ hổng.
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!problemText || !geometry.points) return;

    const text = problemText.toUpperCase(); // Normalize text for searching
    const points = geometry.points as any[];
    
    // 1. Map Labels to IDs for fast lookup
    const labelMap: Record<string, string> = {};
    points.forEach(p => {
        if (p.label) labelMap[p.label.toUpperCase()] = p.id;
    });

    const ensureSegment = (label1: string, label2: string) => {
        const id1 = labelMap[label1];
        const id2 = labelMap[label2];
        if (!id1 || !id2) return;

        // Check if segment already exists
        const exists = geometry.segments?.some((s: any) => 
            (s.startPointId === id1 && s.endPointId === id2) || 
            (s.startPointId === id2 && s.endPointId === id1)
        );

        if (!exists) {
            if (!geometry.segments) geometry.segments = [];
            geometry.segments.push({
                id: generateId('s_auto'),
                startPointId: id1,
                endPointId: id2,
                style: 'solid',
                color: 'black',
                strokeWidth: 1.5
            });
        }
    };

    const ensureRightAngle = (centerLabel: string) => {
        const centerId = labelMap[centerLabel];
        if (!centerId) return;

        // Check if angle already exists
        const exists = geometry.angles?.some((a: any) => a.centerId === centerId && a.isRightAngle);
        
        if (!exists) {
            // Need to find 2 neighbors to define the angle
            const neighbors: string[] = [];
            if (geometry.segments) {
                geometry.segments.forEach((s: any) => {
                    if (s.startPointId === centerId) neighbors.push(s.endPointId);
                    if (s.endPointId === centerId) neighbors.push(s.startPointId);
                });
            }

            if (neighbors.length >= 2) {
                if (!geometry.angles) geometry.angles = [];
                geometry.angles.push({
                    id: generateId('ang_auto'),
                    centerId: centerId,
                    point1Id: neighbors[0],
                    point2Id: neighbors[1],
                    isRightAngle: true,
                    color: 'black'
                });
            }
        }
    };

    // --- AUTO-CONNECT PATTERNS ---

    // 1. TAM GIÁC (Triangle) ABC
    // Regex matches: "TAM GIÁC ABC", "TAM GIAC MNP"
    const triRegex = /TAM GI[AÁ]C\s+([A-Z]{3})/g;
    let match;
    while ((match = triRegex.exec(text)) !== null) {
        const [_, labels] = match; // e.g., "ABC"
        ensureSegment(labels[0], labels[1]);
        ensureSegment(labels[1], labels[2]);
        ensureSegment(labels[2], labels[0]);
    }

    // 2. TỨ GIÁC / HÌNH CHỮ NHẬT / HÌNH VUÔNG (Quad) ABCD
    const quadRegex = /(?:TỨ GI[AÁ]C|HÌNH (?:CHỮ NHẬT|VUÔNG|THOI|BÌNH HÀNH|THANG))\s+([A-Z]{4})/g;
    while ((match = quadRegex.exec(text)) !== null) {
        const [_, labels] = match; // e.g., "ABCD"
        ensureSegment(labels[0], labels[1]);
        ensureSegment(labels[1], labels[2]);
        ensureSegment(labels[2], labels[3]);
        ensureSegment(labels[3], labels[0]);
    }

    // 3. ĐOẠN THẲNG / CẠNH (Segment) AB
    const segRegex = /(?:ĐOẠN THẲNG|CẠNH|ĐƯỜNG CAO|TRUNG TUYẾN)\s+([A-Z]{2})/g;
    while ((match = segRegex.exec(text)) !== null) {
        const [_, labels] = match; // e.g., "AB"
        ensureSegment(labels[0], labels[1]);
    }

    // 4. GÓC VUÔNG (Right Angle)
    // "Vuông tại A", "Góc A = 90 độ"
    const rightAngleRegex1 = /VUÔNG TẠI\s+([A-Z])/g;
    while ((match = rightAngleRegex1.exec(text)) !== null) {
        ensureRightAngle(match[1]);
    }
    
    // Explicit 90 degree check
    // "Góc BAC = 90", "A = 90"
    const rightAngleRegex2 = /(?:GÓC\s+)?([A-Z]{1,3})\s*=\s*90/g;
    while ((match = rightAngleRegex2.exec(text)) !== null) {
        const lbl = match[1];
        if (lbl.length === 1) ensureRightAngle(lbl);
        else if (lbl.length === 3) ensureRightAngle(lbl[1]); // Middle char is vertex
    }
}

// --- SMART ID RESOLVER (FIX MISSING LINKS) ---
function resolveGeometryReferences(geometry: any) {
    if (!geometry.points) return;

    const labelToId: Record<string, string> = {};
    const idMap: Record<string, string> = {};

    geometry.points.forEach((p: any) => {
        idMap[p.id] = p.id;
        if (p.label) {
            labelToId[p.label] = p.id;
            labelToId[p.label.toLowerCase()] = p.id;
        }
    });

    const resolve = (ref: string) => {
        if (!ref) return ref;
        if (idMap[ref]) return ref;
        if (labelToId[ref]) return labelToId[ref];
        if (labelToId[ref.toLowerCase()]) return labelToId[ref.toLowerCase()];
        return ref;
    };

    if (geometry.segments) {
        geometry.segments.forEach((s: any) => {
            s.startPointId = resolve(s.startPointId);
            s.endPointId = resolve(s.endPointId);
        });
        geometry.segments = geometry.segments.filter((s: any) => idMap[s.startPointId] && idMap[s.endPointId]);
    }

    if (geometry.angles) {
        geometry.angles.forEach((a: any) => {
            a.centerId = resolve(a.centerId);
            a.point1Id = resolve(a.point1Id);
            a.point2Id = resolve(a.point2Id);
        });
        // Auto-fix neighbors for right angles if missing
        geometry.angles.forEach((a: any) => {
            if (a.isRightAngle && (!a.point1Id || !a.point2Id) && a.centerId) {
                 const neighbors: string[] = [];
                 geometry.segments?.forEach((s: any) => {
                    if (s.startPointId === a.centerId) neighbors.push(s.endPointId);
                    if (s.endPointId === a.centerId) neighbors.push(s.startPointId);
                 });
                 if (neighbors.length >= 2) {
                     a.point1Id = neighbors[0];
                     a.point2Id = neighbors[1];
                 }
            }
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

    // Target roughly 500x400
    const targetSize = 450;
    const currentMaxSize = Math.max(width, height);
    
    let scale = 1;
    if (currentMaxSize < 200 || currentMaxSize > 1000) {
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
    [YÊU CẦU DỰNG HÌNH]
    Đề bài: "${text}"
    
    Hãy trả về JSON chứa tọa độ các điểm (points) và danh sách đường nối (segments).
    QUAN TRỌNG:
    1. Trả về đúng định dạng JSON.
    2. Đừng để các điểm nằm rời rạc, hãy nối chúng theo đề bài (ví dụ Tam giác ABC thì nối AB, BC, CA).
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

                  if (typeof payload === 'string') rawText = payload;
                  else if (payload && typeof payload === 'object') {
                      if (payload.candidates && payload.candidates[0]?.content?.parts?.[0]?.text) {
                          rawText = payload.candidates[0].content.parts[0].text;
                      } else {
                          rawText = JSON.stringify(payload);
                      }
                  }

                  const result = cleanAndParseJSON(rawText);
                  if (!result) throw new Error("Không đọc được JSON.");
                  
                  // Pass the original text to the normalizer for heuristic fixing
                  normalizeAndResolve(result, text, resolve);

              } catch (error: any) {
                  console.error("AI Error:", error);
                  reject(new Error("Lỗi xử lý dữ liệu."));
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

function normalizeAndResolve(result: any, originalText: string, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
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
    ensureArray('circles');
    ensureArray('angles');
    ensureArray('texts');
    
    // 1. Auto-fix IDs
    ['points', 'segments', 'circles', 'texts', 'angles'].forEach(key => {
        if(g[key]) {
            g[key].forEach((item: any, idx: number) => {
                if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
            });
        }
    });

    // 2. HEURISTIC ENHANCEMENT (THE FIX!)
    // Tự động nối điểm dựa trên đề bài nếu AI quên
    enhanceGeometryWithTextAnalysis(g, originalText);

    // 3. Resolve References (Label -> ID)
    resolveGeometryReferences(g);

    // 4. Scale & Center
    scaleAndCenterGeometry(g);
    
    resolve(result);
}
