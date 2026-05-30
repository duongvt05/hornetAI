"use client"

import { useState, useEffect, useCallback } from 'react';
import type { Notification } from '@/lib/types';

const BACKEND_URL = 'http://localhost:5000';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Lắng nghe SSE từ backend
  useEffect(() => {
    const es = new EventSource(`${BACKEND_URL}/events`);
    
    es.onmessage = (e) => {
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
          link: `/dashboard/detection-history`,
          imageUrl: event.thumbnail ? `${BACKEND_URL}${event.thumbnail}` : undefined,
        };
        
        setNotifications(prev => [notif, ...prev]);
        
        // Gửi Web Push nếu đã đăng ký (bước 5)
        sendPushNotification(notif);
      } catch {}
    };
    
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAllNotifications = useCallback(() => setNotifications([]), []);
  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return { notifications, markAsRead, markAllAsRead, clearAllNotifications, clearNotification };
}

function sendPushNotification(notif: Notification) {
  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(notif.title, {
        body: notif.message,
        icon: '/icon-192.png',
        badge: '/icon-72.png',
        tag: notif.nestId ?? 'hornet-alert',
        data: { url: notif.link },
      });
    });
  }
}