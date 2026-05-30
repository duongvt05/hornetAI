"use client"

import { useState, useEffect, useCallback } from 'react';
import type { Notification } from '@/lib/types';

const BACKEND_URL = 'http://localhost:5000';
const STORAGE_KEY = 'hornet_notifications';

// ─── Persist helpers ─────────────────────────────────────────────────────────
function loadFromStorage(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(notifications: Notification[]) {
  if (typeof window === 'undefined') return;
  try {
    // Giữ tối đa 100 thông báo gần nhất
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 100)));
  } catch {}
}

// ─── Singleton state ngoài React ─────────────────────────────────────────────
let sharedNotifications: Notification[] = loadFromStorage();
const listeners = new Set<() => void>();

function broadcast() {
  listeners.forEach(fn => fn());
}

function mutate(updater: (prev: Notification[]) => Notification[]) {
  sharedNotifications = updater(sharedNotifications);
  saveToStorage(sharedNotifications);
  broadcast();
}

// ─── SSE singleton — KHÔNG bao giờ tự disconnect khi navigate ───────────────
// Chỉ disconnect khi tab đóng (beforeunload)
let esInstance: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let sseStarted = false;  // chỉ start 1 lần

function connectSSE() {
  if (esInstance && esInstance.readyState !== EventSource.CLOSED) return;

  console.log('[SSE] Connecting to', `${BACKEND_URL}/events`);
  esInstance = new EventSource(`${BACKEND_URL}/events`);

  esInstance.onopen = () => {
    console.log('[SSE] Connected ✅');
  };

  esInstance.onmessage = (e) => {
    // Bỏ qua keepalive và connected message
    const data = e.data?.trim();
    if (!data || data === 'connected' || data.startsWith(':')) return;

    try {
      const raw = JSON.parse(data);

      // Chỉ hiện thông báo khi thực sự phát hiện ong
      if (!raw.dominantSpecies || raw.count === 0) return;

      const notif: Notification = {
        id:         `notif-${raw.id}`,
        title:      `🐝 Phát hiện ong tại ${raw.cameraName || raw.location}`,
        message:    `${raw.count} cá thể – ${raw.dominantSpecies ?? 'Không rõ loài'} – Độ tin cậy cao`,
        timestamp:  raw.timestamp,
        type:       raw.overallSeverity === 'critical' ? 'alert'
                  : raw.overallSeverity === 'warning'  ? 'warning' : 'info',
        read:       false,
        nestId:     raw.cameraId,
        location:   raw.location,
        species:    raw.dominantSpecies,
        confidence: raw.detections?.[0]?.confidence,
        link:       `/dashboard/notifications`,
        imageUrl:   raw.thumbnail ? `${BACKEND_URL}${raw.thumbnail}` : undefined,
      };

      // Tránh duplicate
      if (sharedNotifications.some(n => n.id === notif.id)) return;

      console.log('[SSE] New notification:', notif.title);
      mutate(prev => [notif, ...prev]);
    } catch (err) {
      console.warn('[SSE] Parse error:', err, 'raw data:', e.data);
    }
  };

  esInstance.onerror = (err) => {
    console.warn('[SSE] Connection error, retrying in 3s...', err);
    esInstance?.close();
    esInstance = null;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(connectSSE, 3000);
  };
}

// Khởi động SSE ngay khi module được load (client-side only)
// Không phụ thuộc vào component lifecycle
if (typeof window !== 'undefined' && !sseStarted) {
  sseStarted = true;
  connectSSE();

  // Cleanup khi tab đóng
  window.addEventListener('beforeunload', () => {
    if (retryTimer) clearTimeout(retryTimer);
    esInstance?.close();
  });
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useNotifications() {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Đăng ký re-render khi có notification mới
    const rerender = () => setTick(t => t + 1);
    listeners.add(rerender);

    // Đảm bảo SSE đang chạy (phòng trường hợp cold start)
    if (typeof window !== 'undefined' && !sseStarted) {
      sseStarted = true;
      connectSSE();
    }

    return () => {
      listeners.delete(rerender);
      // KHÔNG disconnect SSE khi component unmount
      // SSE chạy suốt phiên làm việc
    };
  }, []);

  const markAsRead = useCallback((id: string) => {
    mutate(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    mutate(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAllNotifications = useCallback(() => {
    mutate(() => []);
  }, []);

  const clearNotification = useCallback((id: string) => {
    mutate(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications: sharedNotifications,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    clearNotification,
  };
}