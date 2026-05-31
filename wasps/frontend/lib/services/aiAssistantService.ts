/**
 * AI Assistant Service
 * Backend chạy tại port 5000 (Flask).
 * Chế độ camera: lấy snapshot từ stream → gọi /api/v1/ai/chat kèm context ảnh.
 * Chế độ general: gọi /api/v1/ai/chat trực tiếp.
 */

const API_BASE = 'http://localhost:5000';

function getToken(): string {
  if (typeof window !== 'undefined') return localStorage.getItem('hornet-token') || '';
  return '';
}

export interface QueryRequest {
  camera_id: string;   // tên file video, vd: "cam2_hive.mp4"
  query: string;
}

export interface QueryResponse {
  success: boolean;
  response?: string;
  error?: string | null;
  camera_id?: string;
  camera_name?: string;
  image_base64?: string;
}

/**
 * Lấy snapshot base64 từ stream của camera (video name = camera_id)
 * Dùng canvas để capture frame đầu tiên của thẻ <video> nếu có,
 * hoặc fetch blob từ /stream/<video_name>.
 */
async function fetchCameraSnapshot(cameraId: string): Promise<string | null> {
  try {
    const streamUrl = `${API_BASE}/stream/${encodeURIComponent(cameraId)}?camId=${cameraId}`;
    // Fetch 1 frame MJPEG (multipart) — lấy chunk đầu tiên
    const res = await fetch(streamUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalLen = 0;

    // Đọc cho đến khi tìm thấy boundary JPEG hoàn chỉnh
    while (true) {
      const { done, value } = await reader.read();
      if (done || totalLen > 200_000) break;
      chunks.push(value);
      totalLen += value.length;

      // Ghép chunks để tìm JPEG
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) { merged.set(c, offset); offset += c.length; }

      // Tìm SOI (FF D8) và EOI (FF D9) của JPEG
      const soi = findBytes(merged, [0xFF, 0xD8]);
      const eoi = findBytes(merged, [0xFF, 0xD9]);
      if (soi !== -1 && eoi !== -1 && eoi > soi) {
        reader.cancel();
        const jpegBytes = merged.slice(soi, eoi + 2);
        return uint8ToBase64(jpegBytes);
      }
    }
    reader.cancel();
    return null;
  } catch {
    return null;
  }
}

function findBytes(arr: Uint8Array, pattern: number[]): number {
  for (let i = 0; i <= arr.length - pattern.length; i++) {
    if (pattern.every((b, j) => arr[i + j] === b)) return i;
  }
  return -1;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Gửi câu hỏi về camera → lấy snapshot → hỏi AI chat kèm context
 */
export const submitQuery = async (request: QueryRequest): Promise<QueryResponse> => {
  const token = getToken();
  if (!token) {
    return { success: false, error: 'Bạn chưa đăng nhập. Vui lòng đăng nhập lại.' };
  }

  const { camera_id, query } = request;

  // 1. Thử lấy snapshot từ stream
  const snapshot = await fetchCameraSnapshot(camera_id);

  // 2. Lấy context detection gần nhất từ /history
  let contextText = '';
  try {
    const histRes = await fetch(`${API_BASE}/history?per_page=5`);
    if (histRes.ok) {
      const events = await histRes.json();
      const camEvents = events.filter((e: any) => e.cameraId === camera_id).slice(0, 3);
      if (camEvents.length > 0) {
        contextText = '\n\nDữ liệu phát hiện gần nhất từ camera này:\n' +
          camEvents.map((e: any) =>
            `- ${e.dominantSpecies ?? 'không xác định'} (${e.overallSeverity}) lúc ${new Date(e.timestamp).toLocaleTimeString('vi-VN')}, ${e.count} cá thể`
          ).join('\n');
      }
    }
  } catch { /* bỏ qua */ }

  // 3. Gửi tới /api/v1/ai/chat
  const message = `[Camera: ${camera_id}] ${query}${contextText}${snapshot ? '\n\n(Đã chụp ảnh hiện tại từ camera)' : ''}`;

  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message, history: [] }),
    });

    if (res.status === 401) {
      return { success: false, error: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' };
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error ?? `Lỗi HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      success:      data.success,
      response:     data.response,
      error:        data.error,
      camera_id,
      image_base64: snapshot ?? undefined,
    };
  } catch (e: any) {
    return { success: false, error: `Không kết nối được server (port 5000): ${e?.message}` };
  }
};