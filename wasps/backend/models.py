from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

db = SQLAlchemy()
bcrypt = Bcrypt()


# ─── MODEL: USER ─────────────────────────────────────────────────────────────
class User(db.Model):
    __tablename__ = 'users'

    id         = db.Column(db.Integer, primary_key=True)
    username   = db.Column(db.String(80), unique=True, nullable=False)
    password   = db.Column(db.String(200), nullable=False)
    full_name  = db.Column(db.String(120), nullable=False)
    role       = db.Column(db.String(20), default='worker')  # admin | worker
    avatar_url = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active  = db.Column(db.Boolean, default=True)

    def set_password(self, raw_password: str):
        self.password = bcrypt.generate_password_hash(raw_password).decode('utf-8')

    def check_password(self, raw_password: str) -> bool:
        return bcrypt.check_password_hash(self.password, raw_password)

    def to_dict(self):
        return {
            'id':        self.id,
            'username':  self.username,
            'full_name': self.full_name,
            'role':      self.role,
            'avatar_url':self.avatar_url,
            'created_at':self.created_at.isoformat(),
            'is_active': self.is_active,
        }


# ─── MODEL: DETECTION EVENT ──────────────────────────────────────────────────
class DetectionEvent(db.Model):
    __tablename__ = 'detection_events'

    id               = db.Column(db.String(36), primary_key=True)  # UUID
    timestamp        = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    source           = db.Column(db.String(20))       # 'image' | 'stream'
    filename         = db.Column(db.String(200))
    count            = db.Column(db.Integer, default=0)
    overall_severity = db.Column(db.String(20))       # critical | warning | info
    dominant_species = db.Column(db.String(100))
    camera_id        = db.Column(db.String(100))
    camera_name      = db.Column(db.String(200))
    location         = db.Column(db.String(200))
    detections_json  = db.Column(db.Text)             # JSON string

    def to_dict(self):
        import json
        return {
            'id':              self.id,
            'timestamp':       self.timestamp.isoformat(),
            'source':          self.source,
            'filename':        self.filename,
            'count':           self.count,
            'overallSeverity': self.overall_severity,
            'dominantSpecies': self.dominant_species,
            'cameraId':        self.camera_id,
            'cameraName':      self.camera_name,
            'location':        self.location,
            'detections':      json.loads(self.detections_json or '[]'),
            'thumbnail':       f'/uploads/{self.filename}',
        }


# ─── MODEL: CAMERA ───────────────────────────────────────────────────────────
class Camera(db.Model):
    __tablename__ = 'cameras'

    id         = db.Column(db.String(100), primary_key=True)
    name       = db.Column(db.String(200), nullable=False)
    location   = db.Column(db.String(200))
    rtsp_url   = db.Column(db.String(500))
    status     = db.Column(db.String(20), default='offline')
    model      = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active  = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id':         self.id,
            'name':       self.name,
            'location':   self.location,
            'rtsp_url':   self.rtsp_url,
            'status':     self.status,
            'model':      self.model,
            'created_at': self.created_at.isoformat(),
            'is_active':  self.is_active,
        }


# ─── MODEL: SETTINGS ─────────────────────────────────────────────────────────
class Setting(db.Model):
    __tablename__ = 'settings'

    key        = db.Column(db.String(100), primary_key=True)
    value      = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)