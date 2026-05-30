"use client"

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Notification } from '@/lib/types';

const BACKEND_URL = 'http://localhost:5000';

// ── Module-level singleton state ─────────────────────────────────────────────
// Lưu trữ ngoài React để tất cả các instance useNotifications() đều
// chia sẻ CÙNG MỘT danh sách — tránh mỗi trang tạo state riêng.

let sharedNotifications: Notification[] = [];
const listeners = new Set<() => void>();

function notifyAll() {
  listeners.forEach(fn => fn());
}

function addNotification(notif: Notification) {
  // Tránh duplicate nếu nhiều tab/component cùng nhận event
  if (sharedNotifications.some(n => n.id === notif.id)) return;
  sharedNotifications = [notif, ...sharedNotifications];
  notifyAll();
}

function updateShared(updater: (prev: Notification[]) => Notification[]) {
  sharedNotifications = updater(sharedNotifications);
  notifyAll();
}

// ── SSE singleton — chỉ một kết nối duy nhất cho cả app ──────────────────────
let esInstance: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let connectionCount = 0; // Đếm số components đang mount

function connectSSE() {
  if (esInstance) return; // Đã có kết nối rồi, không tạo thêm

  esInstance = new EventSource(`${BACKEND_URL}/events`);

  esInstance.onmessage = (e) => {
    if (e.data === 'connected' || e.data.startsWith(':')) return;
    try {
      const event = JSON.parse(e.data);
      if (!event.dominantSpecies && event.count === 0) return;

      const notif: Notification = {
        id: `notif-${event.id}`,
        title: `🐝 Phát hiện ong tại ${event.cameraName || event.location}`,
        message: `${event.count} cá thể – ${event.dominantSpecies ?? 'Không rõ loài'} – Độ tin cậy cao`,
        timestamp: event.timestamp,
        type: event.overallSeverity === 'critical' ? 'alert'
            : event.overallSeverity === 'warning' ? 'warning' : 'info',
        read: false,
        nestId: event.cameraId,
        location: event.location,
        species: event.dominantSpecies,
        confidence: event.detections?.[0]?.confidence,
        link: `/dashboard/notifications`,
        imageUrl: event.thumbnail ? `${BACKEND_URL}${event.thumbnail}` : undefined,
      };

      addNotification(notif);
    } catch {}
  };

  esInstance.onerror = () => {
    esInstance?.close();
    esInstance = null;
    retryTimer = setTimeout(connectSSE, 3000);
  };
}

function disconnectSSE() {
  if (retryTimer) clearTimeout(retryTimer);
  esInstance?.close();
  esInstance = null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications() {
  // Dùng counter để trigger re-render khi sharedNotifications thay đổi
  const [, setTick] = useState(0);

  useEffect(() => {
    // Đăng ký listener để nhận cập nhật từ singleton
    const rerender = () => setTick(t => t + 1);
    listeners.add(rerender);

    // Khởi động SSE lần đầu (chỉ tạo 1 kết nối dù nhiều components mount)
    connectionCount++;
    connectSSE();

    return () => {
      listeners.delete(rerender);
      connectionCount--;
      // Chỉ đóng kết nối khi KHÔNG còn component nào đang dùng
      if (connectionCount === 0) {
        disconnectSSE();
      }
    };
  }, []);

  const markAsRead = useCallback((id: string) => {
    updateShared(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    updateShared(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAllNotifications = useCallback(() => {
    updateShared(() => []);
  }, []);

  const clearNotification = useCallback((id: string) => {
    updateShared(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications: sharedNotifications,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    clearNotification,
  };
}