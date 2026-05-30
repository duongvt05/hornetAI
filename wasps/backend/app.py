from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from ultralytics import YOLO
from datetime import datetime
import os
import uuid
import cv2
import numpy as np

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
DETECTION_FOLDER = "detections"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DETECTION_FOLDER, exist_ok=True)

# Khởi tạo model YOLOv8 (Sử dụng file trọng số best.pt của bạn)
model = YOLO("best.pt")

# Bộ nhớ tạm lưu lịch sử cảnh báo
history = []

# ── Helpers (Dữ liệu Metadata cho các loài Ong) ──────────────────────────────

SPECIES_META = {
    "Vespa_velutina": {
        "commonName": "Asian Hornet (Ong bắp cày chân vàng)",
        "risk": "HIGH",
        "severity": "critical",
        "description": "Loài xâm lấn nguy hiểm, chuyên săn bắt ong mật. Cần can thiệp khẩn cấp khi phát hiện gần tổ ong.",
        "solution": "Kích hoạt hệ thống âm thanh xua đuổi. Đặt bẫy chọn lọc trong bán kính 50m. Theo dõi sát sao trong 48h tới.",
        "actionTaken": "Đã kích hoạt sóng âm xua đuổi – 18 kHz",
    },
    "Vespa_crabro": {
        "commonName": "European Hornet (Ong bắp cày châu Âu)",
        "risk": "MEDIUM",
        "severity": "warning",
        "description": "Loài bản địa kích thước lớn, có thể đe dọa đàn ong nếu số lượng tấn công nhiều.",
        "solution": "Thu hẹp cửa tổ ong xuống 5mm. Giám sát hàng ngày. Nếu mật độ > 10 con/giờ, cần đặt bẫy.",
        "actionTaken": "Đã ghi nhận cảnh báo – Kích hoạt lưới bảo vệ cửa tổ",
    },
    "Vespula_sp": {
        "commonName": "Common Wasp (Ong vàng/Ong đất)",
        "risk": "LOW",
        "severity": "info",
        "description": "Loài ăn tạp. Mức độ phiền toái trung bình đối với các đàn ong mở vào cuối mùa hè.",
        "solution": "Chưa cần can thiệp khẩn cấp. Đảm bảo cửa tổ ong đã được che chắn cơ bản. Kiểm tra lại sau 24h.",
        "actionTaken": "Đã lưu vào dữ liệu theo dõi – Không kích hoạt hệ thống phòng vệ",
    },
}

DEFAULT_META = {
    "commonName": "Unknown Species (Chưa rõ loài)",
    "risk": "LOW",
    "severity": "info",
    "description": "Phát hiện côn trùng chưa được phân loại. Khuyến nghị kiểm tra thủ công.",
    "solution": "Kiểm tra lại camera và cập nhật cơ sở dữ liệu nhận diện nếu cần thiết.",
    "actionTaken": "Đã gắn cờ yêu cầu kiểm tra thủ công",
}

def get_meta(species: str) -> dict:
    return SPECIES_META.get(species, {**DEFAULT_META, "commonName": species})

def build_detection_entry(species: str, confidence: float, count: int) -> dict:
    meta = get_meta(species)
    return {
        "species": species,
        "commonName": meta["commonName"],
        "confidence": round(confidence * 100, 1),
        "risk": meta["risk"],
        "severity": meta["severity"],
        "description": meta["description"],
        "solution": meta["solution"],
        "actionTaken": meta["actionTaken"],
    }


# ── TÍNH NĂNG MỚI: AI VIDEO STREAMING (MJPEG) ────────────────────────────────

@app.route("/stream/<video_name>")
def stream_video(video_name):
    """
    Stream video với AI nhận diện thời gian thực (MJPEG).
    Đọc từng frame từ video trong thư mục uploads, chạy YOLO, vẽ Bounding Box và gửi về Frontend.
    """
    def generate_frames():
        video_path = os.path.join(UPLOAD_FOLDER, video_name)
        
        # Kiểm tra file có tồn tại không
        if not os.path.exists(video_path):
            print(f"Error: Video file {video_path} not found.")
            return

        cap = cv2.VideoCapture(video_path)
        
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                # Nếu video chạy hết, tự động quay lại frame đầu tiên (Looping)
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            # Chạy mô hình YOLO dự đoán trên frame hiện tại
            # conf=0.4: Bỏ qua các nhận diện có độ tin cậy dưới 40%
            # verbose=False: Tắt log console để server chạy nhẹ hơn
            results = model(frame, conf=0.4, verbose=False)
            
            # Hàm plot() của YOLO tự động vẽ bounding box và nhãn lên frame
            annotated_frame = results[0].plot()

            # Mã hóa frame thành định dạng JPEG để stream
            ret, buffer = cv2.imencode('.jpg', annotated_frame)
            if not ret:
                continue
                
            frame_bytes = buffer.tobytes()

            # Trả về chunk dữ liệu hình ảnh
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                   
    # Cấu hình header multipart/x-mixed-replace để trình duyệt hiểu đây là luồng stream liên tục
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')


# ── CÁC ROUTES API CŨ (XỬ LÝ ẢNH & LƯU LỊCH SỬ) ──────────────────────────────

@app.route("/")
def home():
    return jsonify({"message": "Hornet AI Backend is running", "model": "YOLOv8 best.pt"})

@app.route("/detect", methods=["POST"])
def detect():
    """Nhận diện ong trong một bức ảnh tĩnh tải lên."""
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded. Use field name 'image'."}), 400

    file = request.files["image"]
    filename = f"{uuid.uuid4()}.jpg"
    image_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(image_path)

    results = model(image_path, conf=0.4)

    detections = []
    for r in results:
        total = len(r.boxes)
        for box in r.boxes:
            cls_id = int(box.cls[0])
            species = model.names[cls_id]
            confidence = float(box.conf[0])
            detections.append(build_detection_entry(species, confidence, total))

    severity_order = {"critical": 0, "warning": 1, "info": 2}
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
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "source": "image",
        "filename": filename,
        "count": len(detections),
        "overallSeverity": overall_severity,
        "dominantSpecies": dominant,
        "detections": detections,
        "cameraId": request.form.get("cameraId", "cam-upload"),
        "cameraName": request.form.get("cameraName", "Manual Upload"),
        "location": request.form.get("location", "Upload Station"),
        "thumbnail": f"/uploads/{filename}",
    }

    history.append(event)
    return jsonify(event)

@app.route("/history", methods=["GET"])
def get_history():
    """Trả về danh sách lịch sử cảnh báo, mới nhất xếp trước."""
    return jsonify(list(reversed(history)))

@app.route("/history/<event_id>", methods=["GET"])
def get_history_event(event_id: str):
    """Trả về chi tiết một sự kiện nhận diện theo ID."""
    event = next((e for e in history if e["id"] == event_id), None)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(event)

@app.route("/history", methods=["DELETE"])
def clear_history():
    """Xóa toàn bộ lịch sử (Dùng cho quá trình test)."""
    history.clear()
    return jsonify({"message": "History cleared"})


if __name__ == "__main__":
    # Chạy server ở port 5000, bật debug mode
    app.run(debug=True, port=5000)