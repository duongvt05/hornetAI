from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from ultralytics import YOLO
from datetime import datetime
import os
import uuid
import cv2
import numpy as np
import queue
import threading
import requests as req

# ─── KHỞI TẠO APP ────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

detection_queue = queue.Queue()

UPLOAD_FOLDER    = "uploads"
DETECTION_FOLDER = "detections"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DETECTION_FOLDER, exist_ok=True)

model   = YOLO("best.pt")
history = []

# ─── TELEGRAM CONFIG ──────────────────────────────────────────────────────────
TELEGRAM_TOKEN   = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

def send_telegram(event: dict):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    severity_emoji = {"critical": "🚨", "warning": "⚠️", "info": "ℹ️"}
    emoji   = severity_emoji.get(event["overallSeverity"], "🐝")
    caption = (
        f"{emoji} *Phát hiện ong!*\n"
        f"📍 *Tổ:* {event['cameraName']} – {event['location']}\n"
        f"🐝 *Loài:* {event.get('dominantSpecies', 'Không rõ')}\n"
        f"🔢 *Số lượng:* {event['count']} cá thể\n"
        f"⏰ *Thời gian:* {event['timestamp'][:19].replace('T', ' ')}\n"
        f"📊 *Mức độ:* {event['overallSeverity'].upper()}"
    )
    image_path = os.path.join(UPLOAD_FOLDER, event["filename"])
    try:
        with open(image_path, "rb") as photo:
            req.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto",
                data={"chat_id": TELEGRAM_CHAT_ID, "caption": caption, "parse_mode": "Markdown"},
                files={"photo": photo},
                timeout=10,
            )
        print(f"✅ Đã gửi Telegram!")
    except Exception as e:
        print(f"❌ Telegram error: {e}")

# ─── METADATA LOÀI ONG ────────────────────────────────────────────────────────
SPECIES_META = {
    "Vespa_velutina": {
        "commonName":  "Asian Hornet (Ong bắp cày chân vàng)",
        "risk":        "HIGH",
        "severity":    "critical",
        "description": "Loài xâm lấn nguy hiểm, chuyên săn bắt ong mật. Cần can thiệp khẩn cấp khi phát hiện gần tổ ong.",
        "solution":    "Kích hoạt hệ thống âm thanh xua đuổi. Đặt bẫy chọn lọc trong bán kính 50m. Theo dõi sát sao trong 48h tới.",
        "actionTaken": "Đã kích hoạt sóng âm xua đuổi – 18 kHz",
    },
    "Vespa_crabro": {
        "commonName":  "European Hornet (Ong bắp cày châu Âu)",
        "risk":        "MEDIUM",
        "severity":    "warning",
        "description": "Loài bản địa kích thước lớn, có thể đe dọa đàn ong nếu số lượng tấn công nhiều.",
        "solution":    "Thu hẹp cửa tổ ong xuống 5mm. Giám sát hàng ngày. Nếu mật độ > 10 con/giờ, cần đặt bẫy.",
        "actionTaken": "Đã ghi nhận cảnh báo – Kích hoạt lưới bảo vệ cửa tổ",
    },
    "Vespula_sp": {
        "commonName":  "Common Wasp (Ong vàng/Ong đất)",
        "risk":        "LOW",
        "severity":    "info",
        "description": "Loài ăn tạp. Mức độ phiền toái trung bình đối với các đàn ong mở vào cuối mùa hè.",
        "solution":    "Chưa cần can thiệp khẩn cấp. Đảm bảo cửa tổ ong đã được che chắn cơ bản. Kiểm tra lại sau 24h.",
        "actionTaken": "Đã lưu vào dữ liệu theo dõi – Không kích hoạt hệ thống phòng vệ",
    },
}

DEFAULT_META = {
    "commonName":  "Unknown Species (Chưa rõ loài)",
    "risk":        "LOW",
    "severity":    "info",
    "description": "Phát hiện côn trùng chưa được phân loại. Khuyến nghị kiểm tra thủ công.",
    "solution":    "Kiểm tra lại camera và cập nhật cơ sở dữ liệu nhận diện nếu cần thiết.",
    "actionTaken": "Đã gắn cờ yêu cầu kiểm tra thủ công",
}

def get_meta(species: str) -> dict:
    return SPECIES_META.get(species, {**DEFAULT_META, "commonName": species})

def build_detection_entry(species: str, confidence: float, count: int) -> dict:
    meta = get_meta(species)
    return {
        "species":     species,
        "commonName":  meta["commonName"],
        "confidence":  round(confidence * 100, 1),
        "risk":        meta["risk"],
        "severity":    meta["severity"],
        "description": meta["description"],
        "solution":    meta["solution"],
        "actionTaken": meta["actionTaken"],
    }

# ─── SSE ENDPOINT ─────────────────────────────────────────────────────────────
@app.route("/events")
def stream_events():
    """SSE endpoint – frontend subscribe để nhận thông báo realtime."""
    def generate():
        import json
        yield "data: connected\n\n"
        while True:
            try:
                event = detection_queue.get(timeout=30)
                yield f"data: {json.dumps(event)}\n\n"
            except queue.Empty:
                yield ": ping\n\n"
    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

# ─── VIDEO STREAMING (MJPEG) ──────────────────────────────────────────────────
@app.route("/stream/<video_name>")
def stream_video(video_name):
    def generate_frames():
        video_path = os.path.join(UPLOAD_FOLDER, video_name)
        if not os.path.exists(video_path):
            print(f"Error: Video file {video_path} not found.")
            return
        cap = cv2.VideoCapture(video_path)
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            results        = model(frame, conf=0.4, verbose=False)
            annotated_frame = results[0].plot()
            ret, buffer    = cv2.imencode(".jpg", annotated_frame)
            if not ret:
                continue
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")
    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")

# ─── ROUTES ───────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return jsonify({"message": "Hornet AI Backend is running", "model": "YOLOv8 best.pt"})

@app.route("/detect", methods=["POST"])
def detect():
    """Nhận diện ong trong một bức ảnh tĩnh tải lên."""
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded. Use field name 'image'."}), 400

    file       = request.files["image"]
    filename   = f"{uuid.uuid4()}.jpg"
    image_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(image_path)

    results    = model(image_path, conf=0.4)
    detections = []
    for r in results:
        total = len(r.boxes)
        for box in r.boxes:
            cls_id    = int(box.cls[0])
            species   = model.names[cls_id]
            confidence = float(box.conf[0])
            detections.append(build_detection_entry(species, confidence, total))

    severity_order   = {"critical": 0, "warning": 1, "info": 2}
    overall_severity = "info"
    if detections:
        overall_severity = min(
            [d["severity"] for d in detections],
            key=lambda s: severity_order.get(s, 99),
        )

    dominant = None
    if detections:
        from collections import Counter
        dominant = Counter(d["species"] for d in detections).most_common(1)[0][0]

    event = {
        "id":              str(uuid.uuid4()),
        "timestamp":       datetime.now().isoformat(),
        "source":          "image",
        "filename":        filename,
        "count":           len(detections),
        "overallSeverity": overall_severity,
        "dominantSpecies": dominant,
        "detections":      detections,
        "cameraId":        request.form.get("cameraId",   "cam-upload"),
        "cameraName":      request.form.get("cameraName", "Manual Upload"),
        "location":        request.form.get("location",   "Upload Station"),
        "thumbnail":       f"/uploads/{filename}",
    }

    history.append(event)
    detection_queue.put(event)   # SSE realtime
    threading.Thread(target=send_telegram, args=(event,), daemon=True).start()  # Telegram (non-blocking)
    return jsonify(event)

@app.route("/history", methods=["GET"])
def get_history():
    return jsonify(list(reversed(history)))

@app.route("/history/<event_id>", methods=["GET"])
def get_history_event(event_id: str):
    event = next((e for e in history if e["id"] == event_id), None)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(event)

@app.route("/history", methods=["DELETE"])
def clear_history():
    history.clear()
    return jsonify({"message": "History cleared"})

# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)