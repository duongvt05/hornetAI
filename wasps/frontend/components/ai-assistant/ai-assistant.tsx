"use client"

/**
 * AiAssistant - Nâng cấp với 2 chế độ:
 * 1. "Hỏi đáp" - Chat với Gemini AI về ong bắp cày (qua Flask backend)
 * 2. "Camera"  - Hỏi về những gì camera thấy (logic gốc giữ nguyên)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  BrainCircuit, SendHorizontal, Loader2,
  Camera, MessageSquare, Trash2,
} from 'lucide-react';
import { Button }   from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Camera as CameraType, fetchCameras } from '@/lib/services/cameraService';
import { submitQuery } from '@/lib/services/aiAssistantService';

// ── Types ─────────────────────────────────────────────────────────────────────
type MessageRole   = 'user' | 'assistant' | 'system';
type MessageStatus = 'sending' | 'processing' | 'complete' | 'error';
type ChatMode      = 'camera' | 'general';

interface Message {
  id:            string;
  role:          MessageRole;
  content:       string;
  timestamp:     Date;
  status?:       MessageStatus;
  image_base64?: string;
  mode?:         ChatMode;
}

// Gemini conversation history format
interface GeminiTurn {
  role:  'user' | 'model';
  parts: { text: string }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000';

function getToken() {
  if (typeof window !== 'undefined') return localStorage.getItem('hornet-token') || '';
  return '';
}

const SUGGESTED_CAMERA = [
  'Camera đang thấy gì?',
  'Có ong bắp cày xuất hiện không?',
  'Chụp ảnh hiện tại cho tôi xem',
  'Mức độ nguy hiểm hiện tại là bao nhiêu?',
];

const SUGGESTED_GENERAL = [
  'Vespa velutina nguy hiểm thế nào với ong mật?',
  'Phân biệt ong bắp cày châu Á và châu Âu?',
  'Mùa nào ong bắp cày hoạt động mạnh nhất?',
  'Cách đặt bẫy ong bắp cày hiệu quả?',
  'Thu hẹp cửa tổ ong để làm gì?',
];

// ── Simple markdown renderer ──────────────────────────────────────────────────
function renderMarkdown(text: string) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-black/10 dark:bg-white/10 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/^### (.*$)/gm, '<p class="font-bold mt-2">$1</p>')
    .replace(/^## (.*$)/gm,  '<p class="font-bold text-base mt-3">$1</p>')
    .replace(/^- (.*$)/gm,   '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g,   '<br/>');
  return <div dangerouslySetInnerHTML={{ __html: html }} className="leading-relaxed" />;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AiAssistant() {
  const [cameras, setCameras]               = useState<CameraType[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [query, setQuery]                   = useState('');
  const [messages, setMessages]             = useState<Message[]>([]);
  const [isProcessing, setIsProcessing]     = useState(false);
  const [mode, setMode]                     = useState<ChatMode>('general');
  const [geminiHistory, setGeminiHistory]   = useState<GeminiTurn[]>([]);

  // Tên camera đang được chọn (dùng để inject vào context)
  const selectedCameraName = cameras.find(c => c.id === selectedCamera)?.name ?? selectedCamera;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const { toast }      = useToast();

  // ── Load cameras ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCameras()
      .then(data => {
        setCameras(data);
        if (data.length > 0 && data[0].id) setSelectedCamera(String(data[0].id));
      })
      .catch((err) => {
        console.warn('fetchCameras failed:', err?.message);
        // Không block UI — camera chỉ cần thiết ở chế độ Camera
      });

    setMessages([{
      id: 'welcome',
      role: 'system',
      content: '👋 Xin chào! Tôi là trợ lý AI của HornetAI.\n\n**Hỏi đáp chung** — Hỏi tôi về ong bắp cày, bảo vệ tổ ong, nhận dạng loài...\n\n**Chế độ Camera** — Hỏi về những gì camera đang nhìn thấy theo thời gian thực.',
      timestamp: new Date(),
      status: 'complete',
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = query.trim();
    if (!text || isProcessing) return;

    const userMsgId = `user-${Date.now()}`;
    const asstMsgId = `asst-${Date.now()}`;

    setMessages(prev => [...prev, {
      id: userMsgId, role: 'user', content: text,
      timestamp: new Date(), status: 'sending', mode,
    }]);
    setQuery('');
    setIsProcessing(true);

    setMessages(prev => [...prev, {
      id: asstMsgId, role: 'assistant', content: '',
      timestamp: new Date(), status: 'processing', mode,
    }]);

    try {
      if (mode === 'camera') {
        // ── Camera mode: gọi backend YOLO gốc ─────────────────────────────
        if (!selectedCamera) throw new Error('Vui lòng chọn một camera');

        // Đưa tên camera vào câu hỏi để backend/AI có context rõ ràng hơn
        const queryWithContext = selectedCameraName
          ? `[Camera: ${selectedCameraName}] ${text}`
          : text;

        const res = await submitQuery({
          camera_id: selectedCamera,
          query: queryWithContext,
        });

        if (!res.success) throw new Error(res.error ?? 'Lỗi không xác định từ backend');

        setMessages(prev => prev.map(m =>
          m.id === userMsgId ? { ...m, status: 'complete' } :
          m.id === asstMsgId ? {
            ...m,
            content:      res.response ?? 'AI xử lý xong nhưng không có nội dung.',
            status:       'complete',
            image_base64: res.image_base64,
          } : m
        ));

      } else {
        // ── General mode: gọi /api/v1/ai/chat (Gemini qua Flask) ──────────
        const token = getToken();
        if (!token) throw new Error('Bạn chưa đăng nhập. Vui lòng đăng nhập để dùng AI chat.');

        // Nếu người dùng đang chọn camera, thêm tên camera vào context tin nhắn
        const contextPrefix = selectedCameraName
          ? `[Đang xem camera: ${selectedCameraName}] `
          : '';
        const messageWithContext = contextPrefix + text;

        let response: Response;
        try {
          response = await fetch(`${API_BASE}/api/v1/ai/chat`, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              message: messageWithContext,
              history: geminiHistory,
            }),
          });
        } catch (networkErr: any) {
          throw new Error(`Không kết nối được đến server (${API_BASE}). Hãy kiểm tra backend đang chạy chưa.`);
        }

        if (response.status === 401) {
          throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng xuất và đăng nhập lại.');
        }
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error ?? `Lỗi HTTP ${response.status} từ server`);
        }

        const data = await response.json();
        if (!data.success) throw new Error(data.error ?? `HTTP ${response.status}`);

        // Cập nhật history cho lượt tiếp theo (lưu text gốc không có prefix để UX sạch hơn)
        setGeminiHistory(prev => [
          ...prev,
          { role: 'user',  parts: [{ text: messageWithContext }] },
          { role: 'model', parts: [{ text: data.response }] },
        ]);

        setMessages(prev => prev.map(m =>
          m.id === userMsgId ? { ...m, status: 'complete' } :
          m.id === asstMsgId ? { ...m, content: data.response, status: 'complete' } : m
        ));
      }

    } catch (error: any) {
      const msg = error?.message ?? 'Lỗi không xác định';
      setMessages(prev => prev.map(m =>
        m.id === userMsgId ? { ...m, status: 'error' } :
        m.id === asstMsgId ? { ...m, content: `❌ ${msg}`, status: 'error' } : m
      ));
      toast({ title: 'Lỗi', description: msg, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  }, [query, mode, selectedCamera, isProcessing, geminiHistory, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClear = () => {
    setGeminiHistory([]);
    setMessages([{
      id: `clear-${Date.now()}`, role: 'system',
      content: '🔄 Cuộc hội thoại đã được xóa.',
      timestamp: new Date(), status: 'complete',
    }]);
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const showSuggestions = messages.length <= 2 && !isProcessing;

  return (
    <Card className="h-[calc(100vh-10rem)] flex flex-col">

      {/* ── Header ── */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5" />
              AI Assistant
            </CardTitle>
            <CardDescription>
              {mode === 'general'
                ? 'Hỏi đáp về ong bắp cày, bảo vệ tổ ong'
                : selectedCameraName
                  ? `Phân tích trực tiếp từ: ${selectedCameraName}`
                  : 'Phân tích trực tiếp từ camera'}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode toggle */}
            <div className="flex rounded-lg border overflow-hidden text-sm">
              <button
                onClick={() => setMode('general')}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors
                  ${mode === 'general'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'}`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Hỏi đáp
              </button>
              <button
                onClick={() => setMode('camera')}
                className={`px-3 py-1.5 flex items-center gap-1.5 border-l transition-colors
                  ${mode === 'camera'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'}`}
              >
                <Camera className="h-3.5 w-3.5" />
                Camera
              </button>
            </div>

            {/* Camera selector */}
            {mode === 'camera' && (
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Chọn camera" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map(c => (
                    <SelectItem key={c.id} value={c.id ?? ''}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button variant="ghost" size="sm" onClick={handleClear} title="Xóa hội thoại">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Context badge */}
        {mode === 'general' && geminiHistory.length > 0 && (
          <Badge variant="secondary" className="text-xs w-fit mt-1">
            {geminiHistory.length / 2} lượt — AI đang nhớ ngữ cảnh
          </Badge>
        )}
        {mode === 'camera' && selectedCameraName && (
          <Badge variant="outline" className="text-xs w-fit mt-1 gap-1">
            <Camera className="h-3 w-3" />
            {selectedCameraName}
          </Badge>
        )}
      </CardHeader>

      {/* ── Messages ── */}
      <CardContent className="flex-1 overflow-y-auto px-4 pb-0">
        <div className="space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm
                ${msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : msg.role === 'system'
                  ? 'bg-muted text-muted-foreground text-xs border rounded-bl-sm'
                  : 'bg-secondary text-secondary-foreground rounded-bl-sm'}
                ${msg.status === 'error' ? 'border-destructive border' : ''}`}
              >
                {/* Label + time */}
                <div className="flex justify-between items-center mb-1 gap-3">
                  <span className="text-xs font-semibold opacity-70">
                    {msg.role === 'user' ? 'Bạn' : msg.role === 'system' ? 'Hệ thống' : 'AI Assistant'}
                  </span>
                  <span className="text-xs opacity-50">{formatTime(msg.timestamp)}</span>
                </div>

                {/* Content */}
                {msg.status === 'processing' ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang xử lý...</span>
                  </div>
                ) : msg.role === 'assistant' && msg.mode === 'general' ? (
                  renderMarkdown(msg.content)
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                )}

                {/* Camera image */}
                {msg.image_base64 && (
                  <img
                    src={`data:image/jpeg;base64,${msg.image_base64}`}
                    alt="Camera view"
                    className="mt-2 rounded-lg w-full max-h-[280px] object-contain border"
                  />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </CardContent>

      {/* ── Suggested questions ── */}
      {showSuggestions && (
        <div className="px-4 py-2">
          <p className="text-xs text-muted-foreground mb-2">Gợi ý:</p>
          <div className="flex flex-wrap gap-2">
            {(mode === 'camera' ? SUGGESTED_CAMERA : SUGGESTED_GENERAL).map(q => (
              <button
                key={q}
                onClick={() => { setQuery(q); textareaRef.current?.focus(); }}
                className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <CardFooter className="pt-3 pb-4 flex-col items-start gap-1">
        <div className="flex w-full gap-2 items-end">
          <Textarea
            ref={textareaRef}
            placeholder={
              mode === 'camera'
                ? selectedCameraName
                  ? `Hỏi về ${selectedCameraName}... (Enter gửi)`
                  : 'Hỏi về những gì camera đang thấy... (Enter gửi)'
                : 'Hỏi về ong bắp cày, bảo vệ tổ ong... (Enter gửi, Shift+Enter xuống dòng)'
            }
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing || (mode === 'camera' && !selectedCamera)}
            rows={1}
            className="min-h-[42px] max-h-[120px] resize-none flex-1"
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
            }}
          />
          <Button
            onClick={handleSend}
            disabled={isProcessing || !query.trim() || (mode === 'camera' && !selectedCamera)}
            size="icon" className="h-[42px] w-[42px] shrink-0"
          >
            {isProcessing
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <SendHorizontal className="h-4 w-4" />}
          </Button>
        </div>
        {mode === 'camera' && !selectedCamera && cameras.length === 0 && (
          <p className="text-xs text-muted-foreground">Chưa có camera nào trong hệ thống</p>
        )}
      </CardFooter>
    </Card>
  );
}