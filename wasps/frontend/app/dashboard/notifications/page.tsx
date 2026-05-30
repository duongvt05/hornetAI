"use client";

import React, { useState } from 'react';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BellRing, Trash2, CheckCheck, ChevronDown, ChevronUp,
  MapPin, Bug, AlertOctagon, AlertTriangle, Info, Check, XCircle,
  Eye, EyeOff, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';

// ── Icon theo type ─────────────────────────────────────────────────────────
const TypeIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'success': return <Check className="w-4 h-4 text-green-500" />;
    case 'info':    return <Info className="w-4 h-4 text-blue-500" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'error':   return <XCircle className="w-4 h-4 text-red-500" />;
    case 'alert':   return <AlertOctagon className="w-4 h-4 text-orange-500" />;
    default:        return <Info className="w-4 h-4 text-gray-500" />;
  }
};

const typeBorderColor: Record<Notification['type'], string> = {
  success: 'border-l-green-500',
  info:    'border-l-blue-500',
  warning: 'border-l-yellow-500',
  error:   'border-l-red-500',
  alert:   'border-l-orange-500',
};

// ── Notification Row ────────────────────────────────────────────────────────
function NotificationRow({
  notification,
  onMarkAsRead,
  onClear,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onClear: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRead = notification.read;

  const handleToggle = () => {
    if (!isRead) onMarkAsRead(notification.id);
    setExpanded(prev => !prev);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      className={cn(
        'border-l-4 rounded-lg mb-2 overflow-hidden transition-colors',
        typeBorderColor[notification.type],
        isRead
          ? 'bg-muted/30 dark:bg-muted/10'
          : 'bg-background dark:bg-card shadow-sm'
      )}
    >
      {/* ── Header row ── */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={handleToggle}
      >
        <div className="mt-0.5 shrink-0">
          <TypeIcon type={notification.type} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'font-semibold text-sm',
              isRead ? 'text-muted-foreground' : 'text-foreground'
            )}>
              {notification.title}
            </span>

            {/* Trạng thái đọc */}
            {!isRead ? (
              <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-0 h-4">
                Chưa đọc
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Eye className="w-3 h-3" /> Đã xem
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {notification.message}
          </p>

          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
            {new Date(notification.timestamp).toLocaleString('vi-VN')}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Nút xóa */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onClear(notification.id); }}
          >
            <XCircle className="w-3.5 h-3.5" />
          </Button>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* ── Detail expand (chỉ hiện khi chưa đọc HOẶC người dùng chủ động mở) ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border/40 space-y-3">
              {/* Ảnh phát hiện */}
              {notification.imageUrl && (
                <div className="rounded-md overflow-hidden border border-border/40 bg-muted mt-3">
                  <img
                    src={notification.imageUrl}
                    alt="Ảnh phát hiện ong"
                    className="w-full max-h-48 object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {notification.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Vị trí</p>
                      <p className="font-medium text-orange-600 dark:text-orange-400">
                        {notification.location}
                      </p>
                    </div>
                  </div>
                )}

                {notification.species && (
                  <div className="flex items-center gap-2 text-sm">
                    <Bug className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Loài phát hiện</p>
                      <p className="font-medium italic text-amber-600 dark:text-amber-400">
                        {notification.species}
                      </p>
                    </div>
                  </div>
                )}

                {notification.confidence !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Độ tin cậy</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {notification.confidence}%
                      </p>
                    </div>
                  </div>
                )}

                {notification.nestId && (
                  <div className="flex items-center gap-2 text-sm">
                    <Bell className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Camera ID</p>
                      <p className="font-mono text-xs text-primary">{notification.nestId}</p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {notification.message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, clearAllNotifications, clearNotification } = useNotifications();

  const unreadCount = notifications.filter(n => !n.read).length;
  const totalCount  = notifications.length;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BellRing className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Thông báo</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} thông báo chưa đọc`
                : 'Tất cả đã được đọc'}
            </p>
          </div>
        </div>

        {/* Stat badges */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Tổng: {totalCount}
          </Badge>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              Chưa đọc: {unreadCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Action bar */}
      {notifications.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" />
              Đánh dấu tất cả đã đọc
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={clearAllNotifications} className="gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            Xóa tất cả
          </Button>
        </div>
      )}

      {/* List */}
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BellRing className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Không có thông báo nào.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Hệ thống sẽ gửi thông báo khi phát hiện ong.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          {/* Unread section */}
          {unreadCount > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5" /> Chưa đọc ({unreadCount})
              </p>
              <AnimatePresence>
                {notifications.filter(n => !n.read).map(n => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onMarkAsRead={markAsRead}
                    onClear={clearNotification}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Read section */}
          {notifications.filter(n => n.read).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-4 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Đã đọc ({notifications.filter(n => n.read).length})
              </p>
              <AnimatePresence>
                {notifications.filter(n => n.read).map(n => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onMarkAsRead={markAsRead}
                    onClear={clearNotification}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
}