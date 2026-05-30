"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Notification } from '@/lib/types';

const BACKEND_URL = 'http://localhost:5000';

interface NotificationsContextValue {
  notifications: Notification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
  clearNotification: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource(`${BACKEND_URL}/events`);

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
            link: `/dashboard/notifications`,
            imageUrl: event.thumbnail ? `${BACKEND_URL}${event.thumbnail}` : undefined,
          };

          setNotifications(prev => [notif, ...prev]);
        } catch {}
      };

      es.onerror = () => {
        es.close();
        retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimer);
      es?.close();
    };
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAllNotifications = useCallback(() => setNotifications([]), []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ notifications, markAsRead, markAllAsRead, clearAllNotifications, clearNotification }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used inside <NotificationsProvider>');
  }
  return ctx;
}