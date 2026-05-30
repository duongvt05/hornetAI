"use client"

import { useState, useEffect, useCallback } from 'react';
import type { Notification } from '@/lib/types';

const BACKEND_URL = 'http://localhost:5000';

// ─── Singleton state ngoài React ────────────────────────────────────────────
// Tất cả component gọi useNotifications() đều trỏ vào CÙNG mảng này.
let sharedNotifications: Notification[] = [];
const listeners = new Set<() => void>();

function broadcast() {
  listeners.forEach(fn => fn());
}

// ─── SSE singleton — chỉ MỘT kết nối cho cả app ────────────────────────────
let esInstance: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let mountCount = 0;

function connectSSE() {
  if (esInstance) return;

  esInstance = new EventSource(`${BACKEND_URL}/events`);

  esInstance.onmessage = (e) => {
    if (e.data === 'connected' || e.data.startsWith(':')) return;
    try {
      const raw = JSON.parse(e.data);
      if (!raw.dominantSpecies && raw.count === 0) return;

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
        link:       `/dashboard/detection-history`,
        imageUrl:   raw.thumbnail ? `${BACKEND_URL}${raw.thumbnail}` : undefined,
      };

      // Tránh duplicate
      if (sharedNotifications.some(n => n.id === notif.id)) return;
      sharedNotifications = [notif, ...sharedNotifications];
      broadcast();
    } catch {}
  };

  esInstance.onerror = () => {
    esInstance?.close();
    esInstance = null;
    retryTimer = setTimeout(connectSSE, 3000);
  };
}

function disconnectSSE() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  esInstance?.close();
  esInstance = null;
}

function mutate(updater: (prev: Notification[]) => Notification[]) {
  sharedNotifications = updater(sharedNotifications);
  broadcast();
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const rerender = () => setTick(t => t + 1);
    listeners.add(rerender);
    mountCount++;
    connectSSE();

    return () => {
      listeners.delete(rerender);
      mountCount--;
      if (mountCount === 0) disconnectSSE();
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

  return { notifications: sharedNotifications, markAsRead, markAllAsRead, clearAllNotifications, clearNotification };
}