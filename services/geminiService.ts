
import { AIResponse, GeometryData, Point } from "../types";
import { generateId } from "../utils/geometry";

const SYSTEM_INSTRUCTION = `
Bạn là "GeoSmart Expert" - Trợ lý AI chuyên về hình học phẳng.
Nhiệm vụ: Chuyển đổi đề bài toán thành cấu trúc JSON để vẽ hình.

--- BẮT BUỘC ---
1. **POINTS & SEGMENTS**: Tạo điểm là PHẢI tạo đường nối (segments).
   - Tam giác ABC -> segments: [{startPointId:"A", endPointId:"B"}, {startPointId:"B", endPointId:"C"}, {startPointId:"C", endPointId:"A"}]
   - Tứ giác ABCD -> nối vòng quanh.
2. **ANGLES**: "Vuông tại A" -> angles: [{centerId:"A", point1Id:"B", point2Id:"C", isRightAngle:true}]
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
        // Fix common JSON errors from LLMs
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

// --- SUPER HEURISTIC ENGINE ---
// Tự động nối điểm dựa trên phân tích đề bài VÀ logic dự phòng
function enhanceGeometryWithTextAnalysis(geometry: any, problemText: string) {
    if (!geometry.points) return;
    
    // Normalize text: Uppercase + No Tones
    const rawText = problemText.toUpperCase();
    const text = removeVietnameseTones(rawText); 
    const points = geometry.points as any[];
    
    // 1. Build Map: Label -> ID
    const labelMap: Record<string, string> = {};
    const idMap: Record<string, any> = {};
    points.forEach(p => {
        idMap[p.id] = p;
        if (p.label) {
            labelMap[p.label.toUpperCase()] = p.id;
            // Also map unaccented/accented variations if possible, mostly handled by raw input cleanup
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

    // --- A. TEXT BASED CONNECTING ---
    // 1. "TAM GIAC ABC" -> Connect A-B-C-A
    const triRegex = /TAM GIAC\s+([A-Z]{3})/g;
    let match;
    while ((match = triRegex.exec(text)) !== null) {
        const [_, labels] = match;
        const p1 = labelMap[labels[0]];
        const p2 = labelMap[labels[1]];
        const p3 = labelMap[labels[2]];
        if(p1 && p2) ensureSegment(p1, p2);
        if(p2 && p3) ensureSegment(p2, p3);
        if(p3 && p1) ensureSegment(p3, p1);
    }

    // 2. "TU GIAC ABCD" / "HINH CHU NHAT ABCD" -> Connect A-B-C-D-A
    const quadRegex = /(?:TU GIAC|HINH CHU NHAT|HINH VUONG|HINH THANG|HINH BINH HANH)\s+([A-Z]{4})/g;
    while ((match = quadRegex.exec(text)) !== null) {
        const [_, labels] = match;
        const p1 = labelMap[labels[0]];
        const p2 = labelMap[labels[1]];
        const p3 = labelMap[labels[2]];
        const p4 = labelMap[labels[3]];
        if(p1 && p2) ensureSegment(p1, p2);
        if(p2 && p3) ensureSegment(p2, p3);
        if(p3 && p4) ensureSegment(p3, p4);
        if(p4 && p1) ensureSegment(p4, p1);
    }

    // --- B. FALLBACK "SAFETY NET" (Cơ chế chống lười của AI) ---
    // Nếu AI trả về điểm nhưng KHÔNG CÓ (hoặc quá ít) đường nối -> Tự động nối vòng
    const segmentCount = geometry.segments ? geometry.segments.length : 0;
    
    if (segmentCount === 0 && points.length >= 3) {
        // Giả định: Các điểm được khai báo theo thứ tự vẽ (A, B, C...)
        // Nối tuần tự: 0->1->2->...->0
        // Chỉ áp dụng nếu số lượng điểm nhỏ (ví dụ < 6) để tránh nối lung tung trong bài toán phức tạp
        if (points.length <= 5) {
            for (let i = 0; i < points.length; i++) {
                const current = points[i];
                const next = points[(i + 1) % points.length];
                ensureSegment(current.id, next.id);
            }
        } else {
            // Nếu nhiều điểm hơn, ít nhất nối 3 điểm đầu thành tam giác để người dùng thấy gì đó
            ensureSegment(points[0].id, points[1].id);
            ensureSegment(points[1].id, points[2].id);
            ensureSegment(points[2].id, points[0].id);
        }
    }
}

function resolveGeometryReferences(geometry: any) {
    if (!geometry.points) return;
    const labelToId: Record<string, string> = {};
    const idMap: Record<string, string> = {};

    geometry.points.forEach((p: any) => {
        idMap[p.id] = p.id;
        if (p.label) labelToId[p.label.toUpperCase()] = p.id;
    });

    const resolve = (ref: string) => {
        if (!ref) return ref;
        if (idMap[ref]) return ref;
        return labelToId[ref.toUpperCase()] || ref;
    };

    if (geometry.segments) {
        geometry.segments.forEach((s: any) => {
            s.startPointId = resolve(s.startPointId);
            s.endPointId = resolve(s.endPointId);
        });
        // Remove broken segments
        geometry.segments = geometry.segments.filter((s: any) => idMap[s.startPointId] && idMap[s.endPointId]);
    }
    
    // Fix Angles
    if (geometry.angles) {
        geometry.angles.forEach((a: any) => {
            a.centerId = resolve(a.centerId);
            a.point1Id = resolve(a.point1Id);
            a.point2Id = resolve(a.point2Id);
        });
    }
}

// --- AUTO SCALING ---
function scaleAndCenterGeometry(geometry: any) {
    if (!geometry.points || geometry.points.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    geometry.points.forEach((p: any) => {
        p.x = Number(p.x); p.y = Number(p.y);
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });

    let width = maxX - minX || 1;
    let height = maxY - minY || 1;
    const scale = Math.min(400 / width, 400 / height); // Target size 400px

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const targetX = 500; // SVG center
    const targetY = 400;

    geometry.points.forEach((p: any) => {
        p.x = (p.x - centerX) * scale + targetX;
        p.y = (p.y - centerY) * scale + targetY;
    });
    
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
    Hãy trả về JSON vẽ hình học.
    QUAN TRỌNG:
    1. Trả về đúng định dạng JSON bên trong khối \`\`\`json \`\`\`.
    2. Đảm bảo mọi điểm (points) đều được nối (segments) hợp lý. Nếu là tam giác ABC, hãy nối AB, BC, CA.
    3. Đừng quên các mảng: "points", "segments", "angles".
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
    if (!result.geometry) result.geometry = { points: [], segments: [], circles: [], angles: [], texts: [] };
    
    const g = result.geometry;
    ['points', 'segments', 'circles', 'texts', 'angles'].forEach(key => {
        if (!g[key]) g[key] = [];
        // Auto ID
        g[key].forEach((item: any, idx: number) => {
            if (!item.id) item.id = `${key.slice(0,3)}_${Date.now()}_${idx}`;
        });
    });

    // 1. Fix IDs based on Labels (A -> p_A)
    resolveGeometryReferences(g);

    // 2. HEURISTIC: Auto-connect points based on text (Tam giac ABC...) AND Safety Net (Loop connect)
    enhanceGeometryWithTextAnalysis(g, originalText);

    // 3. Fix IDs again (in case Heuristic added segments with Labels)
    resolveGeometryReferences(g);

    // 4. Center View
    scaleAndCenterGeometry(g);
    
    resolve(result);
}
