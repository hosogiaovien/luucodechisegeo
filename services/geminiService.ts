
import { AIResponse, GeometryData } from "../types";
import { generateId } from "../utils/geometry";

// --- CẤU HÌNH AI: GEOMETRY ENGINE ---
const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Trợ lý AI chuyên về hình học phẳng.
Nhiệm vụ: Chuyển đổi đề bài toán thành cấu trúc JSON để vẽ hình.

--- BẮT BUỘC ---
1. **POINTS & SEGMENTS**: 
   - Trả về danh sách điểm với toạ độ (x,y) hợp lý để tạo thành hình vẽ cân đối.
   - BẮT BUỘC phải trả về danh sách "segments" (đoạn thẳng nối các điểm).
   - Ví dụ: Tam giác ABC -> segments nối A-B, B-C, C-A.
   - Ví dụ: Tứ giác ABCD -> segments nối A-B, B-C, C-D, D-A.
2. **ANGLES**: Nếu đề có góc (ví dụ: "góc ABC = 60 độ"), hãy trả về trong mảng "angles".
3. **OUTPUT**: Chỉ trả về JSON thuần, không markdown.
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

// Helper: Remove Vietnamese tones for easier regex matching
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

// --- HEURISTIC ENGINE (Tự động nối điểm dựa trên văn bản) ---
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points || geometry.points.length === 0) return;
    
    // Normalize text
    const rawText = problemText.toUpperCase();
    const text = removeVietnameseTones(rawText); 
    const points = geometry.points as any[];
    
    // 1. Build Map: Label -> ID
    const labelMap: Record<string, string> = {};
    points.forEach(p => {
        if (p.label) {
            labelMap[p.label.trim().toUpperCase()] = p.id;
        }
    });

    const ensureSegment = (id1: string, id2: string) => {
        if (!id1 || !id2 || id1 === id2) return;
        if (!geometry.segments) geometry.segments = [];
        
        // Check exist
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
    };

    // --- A. REGEX MATCHING ---
    
    // 1. "TAM GIAC ABC" -> A-B, B-C, C-A
    const triRegex = /TAM GIAC\s+([A-Z]{3})/g;
    let match;
    while ((match = triRegex.exec(text)) !== null) {
        const labels = match[1];
        const p1 = labelMap[labels[0]];
        const p2 = labelMap[labels[1]];
        const p3 = labelMap[labels[2]];
        if(p1 && p2) ensureSegment(p1, p2);
        if(p2 && p3) ensureSegment(p2, p3);
        if(p3 && p1) ensureSegment(p3, p1);
    }

    // 2. "TU GIAC ABCD" / "HINH CHU NHAT ABCD" -> A-B, B-C, C-D, D-A
    const quadRegex = /(?:TU GIAC|HINH CHU NHAT|HINH VUONG|HINH THANG|HINH BINH HANH)\s+([A-Z]{4})/g;
    while ((match = quadRegex.exec(text)) !== null) {
        const labels = match[1];
        const p1 = labelMap[labels[0]];
        const p2 = labelMap[labels[1]];
        const p3 = labelMap[labels[2]];
        const p4 = labelMap[labels[3]];
        if(p1 && p2) ensureSegment(p1, p2);
        if(p2 && p3) ensureSegment(p2, p3);
        if(p3 && p4) ensureSegment(p3, p4);
        if(p4 && p1) ensureSegment(p4, p1);
    }

    // --- B. SAFETY NET (Fallback Loop) ---
    // Nếu vẫn chưa có segment nào (AI lười + Regex trượt), nối vòng tròn các điểm
    if ((!geometry.segments || geometry.segments.length === 0) && points.length >= 3) {
        // Chỉ nối vòng nếu số điểm <= 6 (tránh nối lung tung bài toán nhiều điểm phụ)
        if (points.length <= 6) {
            for (let i = 0; i < points.length; i++) {
                const current = points[i];
                const next = points[(i + 1) % points.length];
                ensureSegment(current.id, next.id);
            }
        } else {
            // Nối 3 điểm đầu
            ensureSegment(points[0].id, points[1].id);
            ensureSegment(points[1].id, points[2].id);
            ensureSegment(points[2].id, points[0].id);
        }
    }
}

function resolveGeometryReferences(geometry: any) {
    if (!geometry.points) return;
    const labelToId: Record<string, string> = {};
    const idMap: Record<string, boolean> = {};

    // First pass: Index IDs and Labels
    geometry.points.forEach((p: any) => {
        // Ensure ID
        if (!p.id) p.id = generateId('p_gen');
        idMap[p.id] = true;
        if (p.label) labelToId[p.label.trim().toUpperCase()] = p.id;
    });

    const resolve = (ref: string) => {
        if (!ref) return null;
        if (idMap[ref]) return ref; // Already an ID
        return labelToId[ref.trim().toUpperCase()] || null; // Resolve Label -> ID
    };

    // Fix Segments
    if (geometry.segments) {
        geometry.segments.forEach((s: any) => {
            s.startPointId = resolve(s.startPointId) || s.startPointId;
            s.endPointId = resolve(s.endPointId) || s.endPointId;
        });
        // Filter valid segments
        geometry.segments = geometry.segments.filter((s: any) => idMap[s.startPointId] && idMap[s.endPointId]);
    }
    
    // Fix Angles
    if (geometry.angles) {
        geometry.angles.forEach((a: any) => {
            a.centerId = resolve(a.centerId) || a.centerId;
            a.point1Id = resolve(a.point1Id) || a.point1Id;
            a.point2Id = resolve(a.point2Id) || a.point2Id;
        });
        geometry.angles = geometry.angles.filter((a: any) => idMap[a.centerId] && idMap[a.point1Id] && idMap[a.point2Id]);
    }
    
    // Fix Circles
    if (geometry.circles) {
        geometry.circles.forEach((c: any) => {
            c.centerId = resolve(c.centerId) || c.centerId;
            if(c.radiusPointId) c.radiusPointId = resolve(c.radiusPointId) || c.radiusPointId;
        });
        geometry.circles = geometry.circles.filter((c: any) => idMap[c.centerId]);
    }
}

function scaleAndCenterGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;
    
    // 1. Calculate Bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Filter to ignore obviously bad points (like 0,0 if rest are far away)
    const nonZeroPoints = geometry.points.filter((p:any) => Math.abs(p.x) > 10 || Math.abs(p.y) > 10);
    const pointsToUse = nonZeroPoints.length > 2 ? nonZeroPoints : geometry.points;

    pointsToUse.forEach((p: any) => {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    if (!isFinite(minX)) return;

    let width = maxX - minX;
    let height = maxY - minY;
    
    if (width < 1) width = 100; // avoid div 0
    if (height < 1) height = 100;

    // 2. Target Size (Scale to ~600px width for best visibility)
    const targetW = 600;
    const targetH = 500;
    
    const scaleX = targetW / width;
    const scaleY = targetH / height;
    const scale = Math.min(scaleX, scaleY); // Maintain Aspect Ratio

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const targetX = 500; // Canvas center X
    const targetY = 400; // Canvas center Y

    // Apply transform
    geometry.points.forEach((p: any) => {
        p.x = (p.x - centerX) * scale + targetX;
        p.y = (p.y - centerY) * scale + targetY;
    });
    
    if (geometry.circles) {
        geometry.circles.forEach((c: any) => { 
            if(c.radiusValue) c.radiusValue *= scale; 
        });
    }
}

function normalizeAndResolve(result: any, originalText: string, resolve: (value: AIResponse | PromiseLike<AIResponse>) => void) {
    if (!result.geometry && result.points) {
        result = { geometry: result, explanation: "Đã tạo hình vẽ." };
    }
    if (!result.geometry) result.geometry = { points: [], segments: [], circles: [], angles: [], texts: [] };
    
    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles'].forEach(key => {
        if (!g[key]) g[key] = [];
        // Auto ID if missing
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    // 1. Fix IDs based on Labels (A -> p_A)
    resolveGeometryReferences(g);

    // 2. HEURISTIC: Auto-connect points based on text (Tam giac ABC...) AND Safety Net (Loop connect)
    // Use Detected Text from AI if available (better for Images), otherwise Original Text
    const textToAnalyze = result.detected_text ? (result.detected_text + " " + originalText) : originalText;
    enhanceGeometryWithTextAnalysis(g, textToAnalyze);

    // 3. Fix IDs again (in case Heuristic added segments with Labels)
    resolveGeometryReferences(g);

    // 4. Center View
    scaleAndCenterGeometry(g);
    
    resolve(result);
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
    Đề bài (Text Input): "${text}"
    
    NẾU LÀ ẢNH:
    1. Đọc kỹ văn bản trong ảnh (OCR) và điền vào trường "detected_text".
    2. Xác định các điểm và hình học từ văn bản đó.
    
    YÊU CẦU OUTPUT JSON:
    {
      "detected_text": "...",
      "points": [ {"label":"A", "x":..., "y":...}, ... ],
      "segments": [ {"from":"A", "to":"B"}, ... ],
      "angles": [],
      "circles": []
    }
    Cực kỳ quan trọng: Hãy liệt kê "segments" đầy đủ để nối các điểm. Đừng để hình bị rời rạc.
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
                  reject(new Error("Lỗi xử lý AI."));
              }
          }

          if (event.data.type === 'GEMINI_ERROR' && event.data.requestId === requestId) {
              cleanup();
              reject(new Error(event.data.error || "Lỗi kết nối."));
          }
      };

      window.addEventListener('message', handleMessage);
      
      const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error("Quá thời gian chờ."));
      }, TIMEOUT);

      if (window.parent && window.parent !== window) {
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
      } else {
          reject(new Error("Vui lòng chạy trong môi trường AI Studio."));
      }
  });
};
