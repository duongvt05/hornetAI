"use client"

/**
 * SettingsPage - Làm lại để kết nối với backend thực (Flask + MySQL)
 *
 * THAY ĐỔI SO VỚI BẢN CŨ:
 * 1. Bỏ localStorage → lưu/load từ backend qua /settings (GET/POST + JWT)
 * 2. Thêm tab "Notifications" → cấu hình Telegram bot token/chat_id đang dùng trong app.py
 * 3. Tab "Advanced" → bỏ các mục không liên quan (Face recognition, Smart Home, OAuth...)
 *    và thay bằng: YOLO confidence threshold, alert cooldown, model path
 * 4. Tất cả settings đều được đọc/ghi vào bảng `settings` trong MySQL
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Monitor, Camera, Clock, Database,
  Users, BookOpen, Bell, Bot, Loader2, Save,
} from 'lucide-react';

// ── Import các tab giữ nguyên ──────────────────────────────────────────────
import CameraSettings from '@/components/settings/camera-tab/setting-camera';
import UserSettings   from '@/components/settings/user-tab/setting-users';
import RulesSettings  from '@/components/settings/rules-tab/setting-rule';

// ── Helpers ─────────────────────────────────────────────────────────────────
const API = 'http://localhost:5000'; // Flask backend

function getToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') || '';
  }
  return '';
}

async function loadSettings(): Promise<Record<string, any>> {
  const res = await fetch(`${API}/settings`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Không thể tải cài đặt');
  return res.json();
}

async function saveSettings(data: Record<string, any>) {
  const res = await fetch(`${API}/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Không thể lưu cài đặt');
  return res.json();
}

// ── Sub-component: GeneralTab ────────────────────────────────────────────────
function GeneralTab({ settings, onSave }: {
  settings: Record<string, any>;
  onSave: (key: string, value: any) => void;
}) {
  const [systemName, setSystemName] = useState(settings.systemName ?? 'WaspGuard AI');
  const [timezone, setTimezone]     = useState(settings.timezone   ?? 'Asia/Ho_Chi_Minh');
  const [dateFormat, setDateFormat] = useState(settings.dateFormat  ?? 'DD/MM/YYYY');
  const [timeFormat, setTimeFormat] = useState(settings.timeFormat  ?? '24h');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    setSystemName(settings.systemName ?? 'WaspGuard AI');
    setTimezone(settings.timezone     ?? 'Asia/Ho_Chi_Minh');
    setDateFormat(settings.dateFormat ?? 'DD/MM/YYYY');
    setTimeFormat(settings.timeFormat ?? '24h');
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await onSave('general', { systemName, timezone, dateFormat, timeFormat });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cài đặt chung</CardTitle>
        <CardDescription>Tên hệ thống, múi giờ và định dạng hiển thị</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-sm font-medium">Tên hệ thống</label>
          <Input
            className="mt-1"
            value={systemName}
            onChange={e => setSystemName(e.target.value)}
            placeholder="VD: WaspGuard AI"
          />
          <p className="text-xs text-muted-foreground mt-1">Hiển thị trên thanh tiêu đề và báo cáo</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Múi giờ</label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="UTC+8">UTC+8 (China Standard)</SelectItem>
                <SelectItem value="UTC+1">UTC+1 (Europe)</SelectItem>
                <SelectItem value="UTC-5">UTC-5 (Eastern US)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Định dạng ngày</label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Định dạng giờ</label>
            <Select value={timeFormat} onValueChange={setTimeFormat}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 giờ (13:30)</SelectItem>
                <SelectItem value="12h">12 giờ (1:30 PM)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang lưu...</> : <><Save className="mr-2 h-4 w-4" />Lưu thay đổi</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Sub-component: NotificationTab (Telegram) ─────────────────────────────
// Liên kết trực tiếp với TELEGRAM_TOKEN và TELEGRAM_CHAT_ID trong app.py
function NotificationTab({ settings, onSave }: {
  settings: Record<string, any>;
  onSave: (key: string, value: any) => void;
}) {
  const notif = settings.notifications ?? {};
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(notif.telegramEnabled ?? false);
  const [botToken, setBotToken]               = useState<string>(notif.botToken         ?? '');
  const [chatId, setChatId]                   = useState<string>(notif.chatId           ?? '');
  const [cooldown, setCooldown]               = useState<number>(notif.alertCooldown    ?? 30);
  const [minSeverity, setMinSeverity]         = useState<string>(notif.minSeverity      ?? 'info');
  const [saving, setSaving]                   = useState(false);

  useEffect(() => {
    const n = settings.notifications ?? {};
    setTelegramEnabled(n.telegramEnabled ?? false);
    setBotToken(n.botToken      ?? '');
    setChatId(n.chatId          ?? '');
    setCooldown(n.alertCooldown ?? 30);
    setMinSeverity(n.minSeverity ?? 'info');
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await onSave('notifications', {
      telegramEnabled, botToken, chatId,
      alertCooldown: cooldown, minSeverity,
    });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cài đặt thông báo</CardTitle>
        <CardDescription>
          Cấu hình Telegram bot để nhận cảnh báo khi phát hiện ong bắp cày
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Telegram toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Bật thông báo Telegram</p>
            <p className="text-sm text-muted-foreground">
              Gửi ảnh + thông tin phát hiện qua Telegram bot
            </p>
          </div>
          <Switch checked={telegramEnabled} onCheckedChange={setTelegramEnabled} />
        </div>

        {/* Bot Token + Chat ID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Bot Token</label>
            <Input
              className="mt-1 font-mono"
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGHIjklmno..."
              type="password"
              disabled={!telegramEnabled}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lấy từ @BotFather trên Telegram.
              Tương ứng với <code>TELEGRAM_BOT_TOKEN</code> trong <code>.env</code>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Chat ID</label>
            <Input
              className="mt-1 font-mono"
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="-100123456789"
              disabled={!telegramEnabled}
            />
            <p className="text-xs text-muted-foreground mt-1">
              ID của group/channel nhận thông báo.
              Tương ứng với <code>TELEGRAM_CHAT_ID</code> trong <code>.env</code>
            </p>
          </div>
        </div>

        {/* Alert cooldown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">
              Thời gian nghỉ giữa 2 cảnh báo (giây): <strong>{cooldown}s</strong>
            </label>
            <input
              type="range" min={5} max={300} step={5}
              value={cooldown}
              onChange={e => setCooldown(Number(e.target.value))}
              className="mt-2 w-full"
              disabled={!telegramEnabled}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5s</span><span>5 phút</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tương ứng <code>ALERT_COOLDOWN</code> trong <code>app.py</code> (hiện = 30s)
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Mức độ tối thiểu để gửi thông báo</label>
            <Select value={minSeverity} onValueChange={setMinSeverity} disabled={!telegramEnabled}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Tất cả (Info + Warning + Critical)</SelectItem>
                <SelectItem value="warning">Warning + Critical</SelectItem>
                <SelectItem value="critical">Chỉ Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          ℹ️ Sau khi lưu, backend cần khởi động lại để áp dụng Bot Token và Chat ID mới (vì Flask đọc từ <code>.env</code> lúc khởi động). Các cài đặt cooldown và severity sẽ có hiệu lực ngay.
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang lưu...</> : <><Save className="mr-2 h-4 w-4" />Lưu cài đặt thông báo</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Sub-component: AIModelTab ─────────────────────────────────────────────
// Cấu hình YOLO model — liên kết với app.py dòng: model = YOLO("best.pt")
function AIModelTab({ settings, onSave }: {
  settings: Record<string, any>;
  onSave: (key: string, value: any) => void;
}) {
  const ai = settings.aiModel ?? {};
  const [confidence, setConfidence]   = useState<number>(ai.confidence   ?? 0.4);
  const [cooldown, setCooldown]       = useState<number>(ai.cooldown     ?? 30);
  const [modelPath, setModelPath]     = useState<string>(ai.modelPath    ?? 'best.pt');
  const [iouThresh, setIouThresh]     = useState<number>(ai.iouThreshold ?? 0.45);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    const a = settings.aiModel ?? {};
    setConfidence(a.confidence   ?? 0.4);
    setCooldown(a.cooldown       ?? 30);
    setModelPath(a.modelPath     ?? 'best.pt');
    setIouThresh(a.iouThreshold  ?? 0.45);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await onSave('aiModel', { confidence, cooldown, modelPath, iouThreshold: iouThresh });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cài đặt AI / YOLO Model</CardTitle>
        <CardDescription>
          Tinh chỉnh độ nhạy phát hiện và cấu hình mô hình YOLOv8
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Confidence threshold */}
          <div>
            <label className="text-sm font-medium">
              Ngưỡng tin cậy (Confidence): <strong>{(confidence * 100).toFixed(0)}%</strong>
            </label>
            <input
              type="range" min={0.1} max={0.9} step={0.05}
              value={confidence}
              onChange={e => setConfidence(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10% (nhạy hơn, nhiều false positive)</span>
              <span>90%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tương ứng tham số <code>conf=0.4</code> trong <code>model(frame, conf=...)</code>
            </p>
          </div>

          {/* IOU threshold */}
          <div>
            <label className="text-sm font-medium">
              Ngưỡng IOU (Non-Max Suppression): <strong>{(iouThresh * 100).toFixed(0)}%</strong>
            </label>
            <input
              type="range" min={0.1} max={0.9} step={0.05}
              value={iouThresh}
              onChange={e => setIouThresh(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10%</span><span>90%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Điều chỉnh mức độ gộp các bounding box trùng nhau
            </p>
          </div>
        </div>

        {/* Model path */}
        <div>
          <label className="text-sm font-medium">Đường dẫn file model (.pt)</label>
          <Input
            className="mt-1 font-mono"
            value={modelPath}
            onChange={e => setModelPath(e.target.value)}
            placeholder="best.pt hoặc /path/to/model.pt"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Tương ứng <code>model = YOLO("best.pt")</code> trong <code>app.py</code>.
            Thay đổi cần restart backend.
          </p>
        </div>

        {/* Stream cooldown */}
        <div>
          <label className="text-sm font-medium">
            Cooldown cảnh báo per camera (giây): <strong>{cooldown}s</strong>
          </label>
          <input
            type="range" min={5} max={300} step={5}
            value={cooldown}
            onChange={e => setCooldown(Number(e.target.value))}
            className="mt-2 w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5s</span><span>5 phút</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tương ứng <code>ALERT_COOLDOWN = 30</code> trong <code>app.py</code>.
            Tránh spam cảnh báo cho cùng 1 camera.
          </p>
        </div>

        {/* Species info */}
        <div className="rounded-lg border p-4 space-y-2">
          <p className="font-medium text-sm">Loài được hỗ trợ bởi model hiện tại</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            {[
              { key: 'Vespa_velutina', label: 'Ong bắp cày chân vàng', badge: 'CRITICAL', color: 'bg-red-100 text-red-700' },
              { key: 'Vespa_crabro',   label: 'Ong bắp cày châu Âu',    badge: 'WARNING',  color: 'bg-yellow-100 text-yellow-700' },
              { key: 'Vespula_sp',     label: 'Ong vàng (Ong đất)',      badge: 'INFO',     color: 'bg-blue-100 text-blue-700'   },
            ].map(s => (
              <div key={s.key} className={`rounded p-2 flex items-center justify-between ${s.color}`}>
                <span className="font-medium">{s.label}</span>
                <span className="text-xs font-bold">{s.badge}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Được định nghĩa trong <code>SPECIES_META</code> trong <code>app.py</code>
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang lưu...</> : <><Save className="mr-2 h-4 w-4" />Lưu cài đặt AI</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Sub-component: RetentionTab (giữ lại nhưng kết nối backend) ───────────
function RetentionTab({ settings, onSave }: {
  settings: Record<string, any>;
  onSave: (key: string, value: any) => void;
}) {
  const ret = settings.retention ?? {};
  const [imageRetention, setImageRetention] = useState<string>(ret.imageRetention ?? '30d');
  const [eventRetention, setEventRetention] = useState<string>(ret.eventRetention ?? '90d');
  const [autoDelete, setAutoDelete]         = useState<boolean>(ret.autoDelete    ?? true);
  const [saving, setSaving]                 = useState(false);

  useEffect(() => {
    const r = settings.retention ?? {};
    setImageRetention(r.imageRetention ?? '30d');
    setEventRetention(r.eventRetention ?? '90d');
    setAutoDelete(r.autoDelete         ?? true);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await onSave('retention', { imageRetention, eventRetention, autoDelete });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lưu trữ dữ liệu</CardTitle>
        <CardDescription>
          Cấu hình thời gian lưu ảnh phát hiện và log sự kiện trong MySQL
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Lưu ảnh phát hiện</label>
            <Select value={imageRetention} onValueChange={setImageRetention}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 ngày</SelectItem>
                <SelectItem value="14d">14 ngày</SelectItem>
                <SelectItem value="30d">30 ngày</SelectItem>
                <SelectItem value="60d">60 ngày</SelectItem>
                <SelectItem value="90d">90 ngày</SelectItem>
                <SelectItem value="forever">Giữ mãi mãi</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Ảnh lưu trong thư mục <code>uploads/</code> trên backend
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Lưu log sự kiện</label>
            <Select value={eventRetention} onValueChange={setEventRetention}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">30 ngày</SelectItem>
                <SelectItem value="60d">60 ngày</SelectItem>
                <SelectItem value="90d">90 ngày</SelectItem>
                <SelectItem value="180d">6 tháng</SelectItem>
                <SelectItem value="365d">1 năm</SelectItem>
                <SelectItem value="forever">Giữ mãi mãi</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Bản ghi trong bảng <code>detection_events</code> (MySQL)
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Tự động xóa dữ liệu cũ</p>
            <p className="text-sm text-muted-foreground">
              Tự động xóa ảnh và log vượt quá thời hạn lưu trữ
            </p>
          </div>
          <Switch checked={autoDelete} onCheckedChange={setAutoDelete} />
        </div>

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-sm">
          ⚠️ Cần tạo cronjob hoặc Celery task trên backend để thực hiện tự động xóa theo các cài đặt này.
          Hiện tại bạn có thể xóa thủ công qua <code>DELETE /history</code>.
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang lưu...</> : <><Save className="mr-2 h-4 w-4" />Lưu cài đặt</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const searchParams          = useSearchParams();
  const tabParam              = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings]   = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // ── Load settings from backend on mount ────────────────────────────────
  useEffect(() => {
    const validTabs = ['general', 'cameras', 'users', 'rules', 'notifications', 'ai-model', 'retention'];
    if (tabParam && validTabs.includes(tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    (async () => {
      try {
        const data = await loadSettings();
        setSettings(data);
      } catch (err) {
        toast({ title: 'Lỗi', description: 'Không thể tải cài đặt từ server', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Generic save handler ────────────────────────────────────────────────
  const handleSave = useCallback(async (key: string, value: any) => {
    try {
      await saveSettings({ [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
      toast({ title: 'Đã lưu', description: `Cài đặt "${key}" đã được cập nhật.` });
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể lưu cài đặt. Kiểm tra kết nối backend.', variant: 'destructive' });
    }
  }, [toast]);

  // ── Legacy adapters cho CameraSettings / UserSettings / RulesSettings ──
  const legacySubmit = (data: any, name: string) => handleSave(name, data);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Đang tải cài đặt...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cài đặt hệ thống</h1>
        <p className="text-muted-foreground">Quản lý cấu hình HornetAI — lưu trực tiếp vào MySQL</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 py-2">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="general"       className="flex gap-2 items-center"><Monitor className="h-4 w-4" /><span className="hidden md:block">Chung</span></TabsTrigger>
            <TabsTrigger value="cameras"       className="flex gap-2 items-center"><Camera className="h-4 w-4" /><span className="hidden md:block">Camera</span></TabsTrigger>
            <TabsTrigger value="users"         className="flex gap-2 items-center"><Users className="h-4 w-4" /><span className="hidden md:block">Người dùng</span></TabsTrigger>
            <TabsTrigger value="rules"         className="flex gap-2 items-center"><BookOpen className="h-4 w-4" /><span className="hidden md:block">Quy tắc</span></TabsTrigger>
            <TabsTrigger value="notifications" className="flex gap-2 items-center"><Bell className="h-4 w-4" /><span className="hidden md:block">Thông báo</span></TabsTrigger>
            <TabsTrigger value="ai-model"      className="flex gap-2 items-center"><Bot className="h-4 w-4" /><span className="hidden md:block">AI Model</span></TabsTrigger>
            <TabsTrigger value="retention"     className="flex gap-2 items-center"><Clock className="h-4 w-4" /><span className="hidden md:block">Lưu trữ</span></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general">
          <GeneralTab settings={settings} onSave={handleSave} />
        </TabsContent>

        <TabsContent value="cameras">
          {/* CameraSettings giữ nguyên — đã kết nối API /api/v1/cameras */}
          <CameraSettings onSubmit={legacySubmit} isSubmitting={false} />
        </TabsContent>

        <TabsContent value="users">
          {/* UserSettings giữ nguyên — đã kết nối API /auth/* */}
          <UserSettings onSubmit={legacySubmit} isSubmitting={false} />
        </TabsContent>

        <TabsContent value="rules">
          <RulesSettings onSubmit={legacySubmit} isSubmitting={false} />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationTab settings={settings} onSave={handleSave} />
        </TabsContent>

        <TabsContent value="ai-model">
          <AIModelTab settings={settings} onSave={handleSave} />
        </TabsContent>

        <TabsContent value="retention">
          <RetentionTab settings={settings} onSave={handleSave} />
        </TabsContent>
      </Tabs>
    </div>
  );
}