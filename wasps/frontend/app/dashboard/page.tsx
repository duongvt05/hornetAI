"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCamerasClient } from '@/lib/data/cameras';
import { getDetections, Detection } from '@/lib/data/detections';
import { Camera } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { 
  AlertCircle, Loader2, Camera as CameraIcon, Shield, Bell, 
  History, CheckCircle, AlertTriangle, Bug, Thermometer, ArrowRight,
  Info, Zap, Globe, Skull, BookOpen, Eye
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { motion } from 'framer-motion';

// ── Dữ liệu bách khoa về các loài ong ──────────────────────────────────────
const HORNET_SPECIES = [
  {
    id: 'velutina',
    scientificName: 'Vespa velutina',
    commonName: 'Ong vò vẽ châu Á',
    origin: 'Đông Nam Á (Việt Nam, Trung Quốc)',
    risk: 'critical' as const,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10 border-red-500/30',
    size: '2.5–3 cm',
    description: 'Loài xâm lấn nguy hiểm, được phát hiện tại châu Âu từ 2004. Chúng tấn công đàn ong mật, gây thiệt hại nghiêm trọng cho ngành nuôi ong và hệ sinh thái thụ phấn.',
    behavior: 'Săn mồi theo nhóm, bắt ong mật ngay trước tổ. Một đàn ong vò vẽ châu Á có thể tiêu diệt cả một tổ ong mật trong vài giờ.',
    identification: 'Ngực và đầu màu cam/vàng đậm, bụng đen với một dải vàng cam ở đốt thứ 4. Chân vàng ở phần cuối.',
    threatLevel: 'Rất cao',
    emoji: '🐝'
  },
  {
    id: 'crabro',
    scientificName: 'Vespa crabro',
    commonName: 'Ong bắp cày châu Âu',
    origin: 'Châu Âu, Bắc Phi, Châu Á',
    risk: 'warning' as const,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
    size: '2.5–3.5 cm',
    description: 'Loài ong lớn nhất tại châu Âu. Ít hung dữ hơn các loài khác nếu không bị kích động. Đóng vai trò quan trọng trong hệ sinh thái với khả năng kiểm soát côn trùng gây hại.',
    behavior: 'Thường làm tổ trong hốc cây hoặc tường. Bảo vệ tổ mạnh mẽ khi bị đe dọa. Hoạt động cả ban đêm — điểm khác biệt với hầu hết loài ong.',
    identification: 'Màu vàng-nâu-đỏ đặc trưng. Đầu và ngực màu nâu đỏ. Bụng vàng với sọc nâu.',
    threatLevel: 'Trung bình',
    emoji: '🦟'
  },
  {
    id: 'vespula',
    scientificName: 'Vespula sp.',
    commonName: 'Ong vàng thường',
    origin: 'Toàn cầu (trừ vùng cực)',
    risk: 'info' as const,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    size: '1–1.5 cm',
    description: 'Chi ong phổ biến với hàng chục loài trên toàn thế giới. Chúng thường làm tổ dưới đất hoặc trong các khoang rỗng. Ít nguy hiểm hơn ong bắp cày nhưng có thể đốt nhiều lần.',
    behavior: 'Ăn thịt và ngọt. Thường thu hút bởi thức ăn ngọt của con người. Hung dữ vào cuối mùa hè khi thức ăn khan hiếm.',
    identification: 'Kích thước nhỏ, màu vàng-đen tương phản rõ. Ít lông hơn ong mật. Bay nhanh và linh hoạt.',
    threatLevel: 'Thấp',
    emoji: '⚡'
  }
];

// ── Badge mức độ nguy hiểm ─────────────────────────────────────────────────
function RiskBadge({ risk }: { risk: 'critical' | 'warning' | 'info' }) {
  if (risk === 'critical') return <Badge className="bg-red-500/10 text-red-500 border border-red-500/30">Rất nguy hiểm</Badge>;
  if (risk === 'warning')  return <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/30">Nguy hiểm vừa</Badge>;
  return <Badge className="bg-blue-500/10 text-blue-500 border border-blue-500/30">Ít nguy hiểm</Badge>;
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [cameras, setCameras]     = useState<Camera[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading]     = useState({ cameras: true, detections: true });
  const [error, setError]         = useState<string | null>(null);
  const { notifications }         = useNotifications();

  const unreadCount   = notifications.filter(n => !n.read).length;
  const criticalCount = detections.filter(d => d.severity === 'critical').length;
  const isLoading     = loading.cameras || loading.detections;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(prev => ({ ...prev, cameras: true }));
        const cams = await getCamerasClient();
        setCameras(cams);
        setLoading(prev => ({ ...prev, cameras: false }));

        setLoading(prev => ({ ...prev, detections: true }));
        const dets = await getDetections();
        setDetections(dets);
        setLoading(prev => ({ ...prev, detections: false }));
      } catch (err) {
        setError('Không thể tải dữ liệu dashboard. Vui lòng thử lại.');
      }
    };
    fetchData();
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Lỗi kết nối</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 pb-10">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Giám sát IoT và phát hiện ong xâm lấn theo thời gian thực.
          </p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Đang tải dữ liệu…</span>
          </div>
        )}
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Camera */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="bg-card/50 border-border/40 hover:border-primary/20 transition-all h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CameraIcon className="h-5 w-5 text-primary" />
                Trạm Camera IoT
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{cameras.length}</div>
              <p className="text-muted-foreground text-sm">
                {cameras.filter(c => c.status === 'online').length} camera đang hoạt động
              </p>
              <div className="mt-4">
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/settings?tab=cameras">Quản lý Camera</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-card/50 border-border/40 hover:border-primary/20 transition-all h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5 text-primary" />
                Thông báo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold">{notifications.length}</div>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{unreadCount} chưa đọc</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {unreadCount === 0 ? 'Tất cả đã được đọc' : `${unreadCount} thông báo đang chờ`}
              </p>
              <div className="mt-4">
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/notifications">
                    <Eye className="w-3.5 h-3.5 mr-1.5" />
                    Xem thông báo
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Detection */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-card/50 border-border/40 hover:border-primary/20 transition-all h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-primary" />
                AI Detection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border border-green-500/20">
                  Đang hoạt động
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm mt-2">
                YOLOv8 — giám sát toàn bộ camera stream
              </p>
              <div className="mt-4">
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/ai-assistant">AI Assistant</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* History */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-card/50 border-border/40 hover:border-primary/20 transition-all h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-5 w-5 text-primary" />
                Lịch sử phát hiện
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{detections.length}</div>
              <p className="text-sm text-red-500 font-semibold flex items-center gap-1 mt-0.5">
                <Bug className="w-3.5 h-3.5" />
                {criticalCount} sự kiện nguy hiểm cao
              </p>
              <div className="mt-4">
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/detection-history">Xem lịch sử</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Tabs: Detection + Hornet Encyclopedia ───────────────────────────── */}
      <Tabs defaultValue="detections" className="space-y-6">
        <TabsList>
          <TabsTrigger value="detections">Phát hiện gần đây</TabsTrigger>
          <TabsTrigger value="encyclopedia">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
            Bách khoa về Ong
          </TabsTrigger>
          <TabsTrigger value="status">Trạng thái hệ thống</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Recent detections ── */}
        <TabsContent value="detections" className="space-y-6">
          <Card className="bg-card/50 border-border/40">
            <CardHeader>
              <CardTitle>Cảnh báo ong mới nhất</CardTitle>
              <CardDescription>
                Các sự kiện phát hiện ong gần đây từ hệ thống camera IoT.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading.detections ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : detections.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {detections.slice(0, 4).map((det) => (
                      <div
                        key={det.id}
                        className="flex items-center gap-3 p-3 border border-border/40 rounded-md hover:bg-muted/30 transition-colors"
                      >
                        <div className="h-10 w-10 rounded-md overflow-hidden bg-muted flex-shrink-0 border">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={det.thumbnail} alt={det.commonName} className="object-cover h-full w-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{det.commonName}</p>
                          <p className="text-xs text-muted-foreground truncate">{det.cameraName}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <Badge variant={det.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px] font-mono">
                            {det.confidence}%
                          </Badge>
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-500">
                            <Thermometer className="w-3 h-3" />
                            {det.temperature}°C
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/detection-history">Xem toàn bộ lịch sử</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
                  <Bug className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground">Chưa có sự kiện phát hiện nào.</p>
                  <p className="text-xs text-muted-foreground/70">
                    Upload ảnh/video trong trang Live Detection để bắt đầu.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Camera redirect */}
          <Card className="bg-card/50 border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <CameraIcon className="h-5 w-5 text-primary" />
                Giám sát ong trực tiếp
              </CardTitle>
              <CardDescription>
                Xem video trực tiếp với AI phát hiện ong theo thời gian thực.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center text-center py-6 gap-4">
              <p className="text-muted-foreground text-sm">
                Chuyển đến trang xem camera trực tiếp để theo dõi.
              </p>
              <Button asChild>
                <Link href="/dashboard/cameras/live" className="flex gap-2 items-center">
                  Đến trang Camera trực tiếp
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Encyclopedia ── */}
        <TabsContent value="encyclopedia" className="space-y-6">
          {/* Intro */}
          <Card className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <Info className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Hệ thống phân loại ong</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    HornetAI phát hiện 3 loài ong chính thuộc họ <em>Vespidae</em>. 
                    Mỗi loài có mức độ nguy hiểm khác nhau đối với hệ sinh thái nông nghiệp và đàn ong mật.
                    Hệ thống AI sử dụng YOLOv8 để phân biệt chính xác từng loài từ hình ảnh camera.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Species cards */}
          {HORNET_SPECIES.map((sp, idx) => (
            <motion.div
              key={sp.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className={`border ${sp.bgColor} bg-card/50`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{sp.emoji}</span>
                      <div>
                        <CardTitle className={`text-lg ${sp.color}`}>
                          {sp.commonName}
                        </CardTitle>
                        <p className="text-sm italic text-muted-foreground font-mono">
                          {sp.scientificName}
                        </p>
                      </div>
                    </div>
                    <RiskBadge risk={sp.risk} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-md bg-muted/50 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Kích thước</p>
                      <p className="text-sm font-bold mt-0.5">{sp.size}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Nguồn gốc</p>
                      <p className="text-sm font-bold mt-0.5 leading-tight">{sp.origin}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Mức đe dọa</p>
                      <p className={`text-sm font-bold mt-0.5 ${sp.color}`}>{sp.threatLevel}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2.5 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Họ</p>
                      <p className="text-sm font-bold mt-0.5 italic">Vespidae</p>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Globe className={`w-4 h-4 mt-0.5 shrink-0 ${sp.color}`} />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-0.5">Tổng quan</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{sp.description}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Zap className={`w-4 h-4 mt-0.5 shrink-0 ${sp.color}`} />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-0.5">Hành vi</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{sp.behavior}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Eye className={`w-4 h-4 mt-0.5 shrink-0 ${sp.color}`} />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-0.5">Nhận dạng</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{sp.identification}</p>
                      </div>
                    </div>
                  </div>

                  {/* AI detection note */}
                  {sp.risk === 'critical' && (
                    <div className="flex items-center gap-2 p-2.5 rounded-md bg-red-500/5 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-600 dark:text-red-400">
                        <strong>Hệ thống AI sẽ kích hoạt cảnh báo cao</strong> khi phát hiện loài này — báo cáo ngay cho cơ quan kiểm dịch thực vật địa phương.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Fun facts */}
          <Card className="bg-card/50 border-border/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Skull className="w-5 h-5 text-red-500" />
                Tác động đến nông nghiệp
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: '🍯', stat: '50–80%', label: 'Ong mật bị giết trong mùa hè khi có Vespa velutina', color: 'text-red-500' },
                { icon: '🌸', stat: '1/3', label: 'Lương thực toàn cầu phụ thuộc vào ong thụ phấn', color: 'text-amber-500' },
                { icon: '📡', stat: '95%+', label: 'Độ chính xác của AI YOLOv8 trong phân loại ong', color: 'text-green-500' },
              ].map(item => (
                <div key={item.label} className="rounded-lg border border-border/40 bg-muted/20 p-4 text-center">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <div className={`text-2xl font-bold ${item.color}`}>{item.stat}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: System status ── */}
        <TabsContent value="status" className="space-y-6">
          <Card className="bg-card/50 border-border/40">
            <CardHeader>
              <CardTitle>Nhật ký hệ thống</CardTitle>
              <CardDescription>Các cảnh báo phần cứng và cấu hình hệ thống</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 border rounded-md bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">Độ trễ hàng đợi SMS</p>
                      <span className="text-xs text-muted-foreground">2 phút trước</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Cảnh báo SMS khẩn cấp tạm thời qua gateway dự phòng do tắc nghẽn mạng.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border border-border/40 rounded-md">
                  <Bell className="h-5 w-5 text-blue-500 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">Trạm 02 - Vườn táo phía Bắc Online</p>
                      <span className="text-xs text-muted-foreground">1 giờ trước</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Camera kết nối thành công, RTSP stream ổn định 25 FPS.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border border-border/40 rounded-md">
                  <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">Cảnh báo dung lượng Edge Node</p>
                      <span className="text-xs text-muted-foreground">Hôm qua</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Dung lượng đĩa vượt 78%. Sẽ tự động xóa video sau 30 ngày.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border border-border/40 rounded-md">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">AI Model cập nhật thành công</p>
                      <span className="text-xs text-muted-foreground">2 ngày trước</span>
                    </div>
                    <p className="text-xs text-muted-foreground">YOLOv8 v3.2 đã được deploy. Độ chính xác tăng lên 95.8%.</p>
                  </div>
                </div>

                <div className="mt-4">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/notifications">Xem tất cả thông báo</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}