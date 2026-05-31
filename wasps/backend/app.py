from flask import Flask, request, jsonify, Response, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)
from ultralytics import YOLO
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os, uuid, cv2, numpy as np, threading, time, json, requests as req
from collections import Counter

from models import db, bcrypt, User, DetectionEvent, Camera, Setting

# ─── LOAD ENV ─────────────────────────────────────────────────────────────────
load_dotenv()

# ─── KHỞI TẠO APP ────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ─── DATABASE CONFIG ──────────────────────────────────────────────────────────
DB_USER = os.environ.get("DB_USER", "hornet_user")
DB_PASS = os.environ.get("DB_PASSWORD", "HornetAI@2024")
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "3306")
DB_NAME = os.environ.get("DB_NAME", "hornetai")

app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "change-me")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)

db.init_app(app)
bcrypt.init_app(app)
jwt = JWTManager(app)

UPLOAD_FOLDER    = "uploads"
DETECTION_FOLDER = "detections"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DETECTION_FOLDER, exist_ok=True)

model = YOLO("best.pt")

# ─── KHỞI TẠO DB + SEED ADMIN ────────────────────────────────────────────────
def init_db():
    with app.app_context():
        db.create_all()
        # Tạo admin mặc định nếu chưa có
        if not User.query.filter_by(username="admin").first():
            admin = User(
                username="admin",
                full_name="Admin User",
                role="admin",
            )
            admin.set_password("admin123")
            db.session.add(admin)
            db.session.commit()
            print("✅ Đã tạo tài khoản admin mặc định (admin / admin123)")

# ─── PUB/SUB SSE ──────────────────────────────────────────────────────────────
import queue as qmod

_subscribers: list = []
_sub_lock = threading.Lock()

def _publish(event: dict):
    with _sub_lock:
        dead = []
        for q in _subscribers:
            try:
                q.put_nowait(event)
            except Exception:
                dead.append(q)
        for q in dead:
            _subscribers.remove(q)

def _subscribe():
    q = qmod.Queue()
    with _sub_lock:
        _subscribers.append(q)
    return q

def _unsubscribe(q):
    with _sub_lock:
        try:
            _subscribers.remove(q)
        except ValueError:
            pass

ALERT_COOLDOWN    = 30
camera_last_alert = {}
camera_lock       = threading.Lock()

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
    except Exception as e:
        print(f"❌ Telegram error: {e}")

# ─── SPECIES META ─────────────────────────────────────────────────────────────
SPECIES_META = {
    "Vespa_velutina": {
        "commonName":  "Asian Hornet (Ong bắp cày chân vàng)",
        "risk":        "HIGH",
        "severity":    "critical",
        "description": "Loài xâm lấn nguy hiểm, chuyên săn bắt ong mật.",
        "solution":    "Kích hoạt hệ thống âm thanh xua đuổi. Đặt bẫy chọn lọc trong bán kính 50m.",
        "actionTaken": "Đã kích hoạt sóng âm xua đuổi – 18 kHz",
    },
    "Vespa_crabro": {
        "commonName":  "European Hornet (Ong bắp cày châu Âu)",
        "risk":        "MEDIUM",
        "severity":    "warning",
        "description": "Loài bản địa kích thước lớn, có thể đe dọa đàn ong.",
        "solution":    "Thu hẹp cửa tổ ong xuống 5mm. Giám sát hàng ngày.",
        "actionTaken": "Đã ghi nhận cảnh báo – Kích hoạt lưới bảo vệ cửa tổ",
    },
    "Vespula_sp": {
        "commonName":  "Common Wasp (Ong vàng/Ong đất)",
        "risk":        "LOW",
        "severity":    "info",
        "description": "Loài ăn tạp. Mức độ phiền toái trung bình.",
        "solution":    "Chưa cần can thiệp khẩn cấp.",
        "actionTaken": "Đã lưu vào dữ liệu theo dõi",
    },
}

DEFAULT_META = {
    "commonName":  "Unknown Species",
    "risk":        "LOW",
    "severity":    "info",
    "description": "Phát hiện côn trùng chưa được phân loại.",
    "solution":    "Kiểm tra lại camera.",
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

def create_and_dispatch_event(detections: list, frame, cam_id: str, cam_name: str, location: str):
    if not detections:
        return

    severity_order   = {"critical": 0, "warning": 1, "info": 2}
    overall_severity = min([d["severity"] for d in detections],
                           key=lambda s: severity_order.get(s, 99))
    dominant = Counter(d["species"] for d in detections).most_common(1)[0][0]

    filename   = f"{uuid.uuid4()}.jpg"
    image_path = os.path.join(UPLOAD_FOLDER, filename)
    cv2.imwrite(image_path, frame)

    event_id = str(uuid.uuid4())
    event = {
        "id":              event_id,
        "timestamp":       datetime.now().isoformat(),
        "source":          "stream",
        "filename":        filename,
        "count":           len(detections),
        "overallSeverity": overall_severity,
        "dominantSpecies": dominant,
        "detections":      detections,
        "cameraId":        cam_id,
        "cameraName":      cam_name,
        "location":        location,
        "thumbnail":       f"/uploads/{filename}",
    }

    # Lưu vào MySQL
    with app.app_context():
        db_event = DetectionEvent(
            id=event_id,
            timestamp=datetime.now(),
            source="stream",
            filename=filename,
            count=len(detections),
            overall_severity=overall_severity,
            dominant_species=dominant,
            camera_id=cam_id,
            camera_name=cam_name,
            location=location,
            detections_json=json.dumps(detections),
        )
        db.session.add(db_event)
        db.session.commit()

    _publish(event)
    threading.Thread(target=send_telegram, args=(event,), daemon=True).start()

# ═══════════════════════════════════════════════════════════════════════════════
# API ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

# ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
@app.route("/auth/login", methods=["POST"])
def login():
    data     = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Vui lòng nhập đầy đủ thông tin"}), 400

    user = User.query.filter_by(username=username, is_active=True).first()

    if not user or not user.check_password(password):
        return jsonify({"error": "Sai tên đăng nhập hoặc mật khẩu"}), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "username": user.username}
    )
    return jsonify({
        "token": access_token,
        "user":  user.to_dict(),
    })


@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json()

    username  = data.get("username", "").strip()
    password  = data.get("password", "")
    full_name = data.get("full_name", "").strip()
    role      = data.get("role", "worker")

    # Validation
    if not username or not password or not full_name:
        return jsonify({"error": "Vui lòng nhập đầy đủ thông tin"}), 400
    if len(username) < 3:
        return jsonify({"error": "Tên đăng nhập phải ít nhất 3 ký tự"}), 400
    if len(password) < 6:
        return jsonify({"error": "Mật khẩu phải ít nhất 6 ký tự"}), 400
    if role not in ["admin", "worker"]:
        return jsonify({"error": "Role không hợp lệ"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Tên đăng nhập đã tồn tại"}), 409

    new_user = User(username=username, full_name=full_name, role=role)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "Đăng ký thành công", "user": new_user.to_dict()}), 201


@app.route("/auth/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict())


@app.route("/auth/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id     = get_jwt_identity()
    user        = User.query.get(user_id)
    data        = request.get_json()
    old_pass    = data.get("old_password", "")
    new_pass    = data.get("new_password", "")

    if not user.check_password(old_pass):
        return jsonify({"error": "Mật khẩu hiện tại không đúng"}), 400
    if len(new_pass) < 6:
        return jsonify({"error": "Mật khẩu mới phải ít nhất 6 ký tự"}), 400

    user.set_password(new_pass)
    db.session.commit()
    return jsonify({"message": "Đã đổi mật khẩu thành công"})


# ─── SETTINGS ROUTES ──────────────────────────────────────────────────────────
@app.route("/settings", methods=["GET"])
@jwt_required()
def get_settings():
    settings = Setting.query.all()
    result   = {}
    for s in settings:
        try:
            result[s.key] = json.loads(s.value)
        except Exception:
            result[s.key] = s.value
    return jsonify(result)


@app.route("/settings", methods=["POST"])
@jwt_required()
def save_settings():
    data = request.get_json()
    for key, value in data.items():
        setting = Setting.query.get(key)
        if setting:
            setting.value      = json.dumps(value)
            setting.updated_at = datetime.utcnow()
        else:
            setting = Setting(key=key, value=json.dumps(value))
            db.session.add(setting)
    db.session.commit()
    return jsonify({"message": "Đã lưu settings"})


@app.route("/settings/<key>", methods=["GET"])
@jwt_required()
def get_setting(key: str):
    setting = Setting.query.get(key)
    if not setting:
        return jsonify({"error": "Key not found"}), 404
    try:
        return jsonify({key: json.loads(setting.value)})
    except Exception:
        return jsonify({key: setting.value})


# ─── CAMERAS ROUTES (DB-backed) ───────────────────────────────────────────────
@app.route("/api/v1/cameras", methods=["GET"])
@jwt_required()
def get_cameras():
    cameras = Camera.query.filter_by(is_active=True).all()
    return jsonify([c.to_dict() for c in cameras])


@app.route("/api/v1/cameras", methods=["POST"])
@jwt_required()
def create_camera():
    data   = request.get_json()
    cam_id = str(uuid.uuid4())[:8]
    cam    = Camera(
        id       = cam_id,
        name     = data.get("name", "Camera mới"),
        location = data.get("location", ""),
        rtsp_url = data.get("rtsp_url", ""),
        model    = data.get("model", ""),
    )
    db.session.add(cam)
    db.session.commit()
    return jsonify(cam.to_dict()), 201


@app.route("/api/v1/cameras/<cam_id>", methods=["DELETE"])
@jwt_required()
def delete_camera(cam_id: str):
    cam = Camera.query.get(cam_id)
    if not cam:
        return jsonify({"error": "Camera not found"}), 404
    cam.is_active = False
    db.session.commit()
    return jsonify({"message": "Đã xóa camera"})


# ─── DETECTION ROUTES ─────────────────────────────────────────────────────────
@app.route("/")
def home():
    return jsonify({"message": "Hornet AI Backend is running", "model": "YOLOv8"})


@app.route("/detect", methods=["POST"])
def detect():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file       = request.files["image"]
    filename   = f"{uuid.uuid4()}.jpg"
    image_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(image_path)

    results    = model(image_path, conf=0.4)
    detections = []
    for r in results:
        for box in r.boxes:
            cls_id     = int(box.cls[0])
            species    = model.names[cls_id]
            confidence = float(box.conf[0])
            detections.append(build_detection_entry(species, confidence, len(r.boxes)))

    severity_order   = {"critical": 0, "warning": 1, "info": 2}
    overall_severity = "info"
    dominant = None

    if detections:
        overall_severity = min([d["severity"] for d in detections],
                               key=lambda s: severity_order.get(s, 99))
        dominant = Counter(d["species"] for d in detections).most_common(1)[0][0]

    event_id = str(uuid.uuid4())
    event = {
        "id":              event_id,
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

    # Lưu vào MySQL
    db_event = DetectionEvent(
        id=event_id,
        timestamp=datetime.now(),
        source="image",
        filename=filename,
        count=len(detections),
        overall_severity=overall_severity,
        dominant_species=dominant,
        camera_id=event["cameraId"],
        camera_name=event["cameraName"],
        location=event["location"],
        detections_json=json.dumps(detections),
    )
    db.session.add(db_event)
    db.session.commit()

    if detections:
        _publish(event)
        threading.Thread(target=send_telegram, args=(event,), daemon=True).start()
    return jsonify(event)


@app.route("/history", methods=["GET"])
def get_history():
    page     = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    events   = (DetectionEvent.query
                .order_by(DetectionEvent.timestamp.desc())
                .paginate(page=page, per_page=per_page, error_out=False))
    return jsonify([e.to_dict() for e in events.items])


@app.route("/history/<event_id>", methods=["GET"])
def get_history_event(event_id: str):
    event = DetectionEvent.query.get(event_id)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(event.to_dict())


@app.route("/history", methods=["DELETE"])
@jwt_required()
def clear_history():
    DetectionEvent.query.delete()
    db.session.commit()
    return jsonify({"message": "History cleared"})


# ─── SSE ENDPOINT ─────────────────────────────────────────────────────────────
@app.route("/events")
def stream_events():
    client_queue = _subscribe()

    def generate():
        yield "data: connected\n\n"
        try:
            while True:
                try:
                    event = client_queue.get(timeout=25)
                    yield f"data: {json.dumps(event)}\n\n"
                except qmod.Empty:
                    yield ": ping\n\n"
        finally:
            _unsubscribe(client_queue)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ─── VIDEO STREAMING ──────────────────────────────────────────────────────────
@app.route("/stream/<video_name>")
def stream_video(video_name):
    cam_id   = request.args.get("camId",    video_name)
    cam_name = request.args.get("camName",  video_name)
    location = request.args.get("location", "Live Camera")

    def generate_frames():
        video_path = os.path.join(UPLOAD_FOLDER, video_name)
        if not os.path.exists(video_path):
            return
        cap = cv2.VideoCapture(video_path)
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            results         = model(frame, conf=0.4, verbose=False)
            annotated_frame = results[0].plot()
            boxes = results[0].boxes
            if boxes and len(boxes) > 0:
                with camera_lock:
                    last_alert = camera_last_alert.get(cam_id, 0)
                    now        = time.time()
                    if now - last_alert > ALERT_COOLDOWN:
                        camera_last_alert[cam_id] = now
                        detections = []
                        for box in boxes:
                            cls_id     = int(box.cls[0])
                            species    = model.names[cls_id]
                            confidence = float(box.conf[0])
                            detections.append(build_detection_entry(species, confidence, len(boxes)))
                        threading.Thread(
                            target=create_and_dispatch_event,
                            args=(detections, frame.copy(), cam_id, cam_name, location),
                            daemon=True,
                        ).start()
            ret, buffer = cv2.imencode(".jpg", annotated_frame)
            if not ret:
                continue
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")

    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")


@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename: str):
    return send_from_directory(os.path.abspath(UPLOAD_FOLDER), filename)


# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    app.run(debug=False, port=5000, threaded=True)