"use client";

import React from 'react';
import type { Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Info, AlertTriangle, XCircle, AlertOctagon, MapPin, Bug } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  className?: string;
}

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'success': return <Check className="w-5 h-5 text-green-500" />;
    case 'info':    return <Info className="w-5 h-5 text-blue-500" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'error':   return <XCircle className="w-5 h-5 text-red-500" />;
    case 'alert':   return <AlertOctagon className="w-5 h-5 text-orange-500" />;
    default:        return <Info className="w-5 h-5 text-gray-500" />;
  }
};

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkAsRead, className }) => {
  // Dùng router.push thay vì window.location.href để KHÔNG reload trang
  // window.location.href làm mất toàn bộ SSE state → trang trống
  const router = useRouter();

  const handleItemClick = () => {
    if (!notification.read) onMarkAsRead(notification.id);
    if (notification.link) router.push(notification.link);
  };

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all',
        notification.read
          ? 'bg-muted/30 border-border/40'
          : 'bg-background border-border/60 shadow-sm',
        notification.link ? 'cursor-pointer hover:border-primary/40 hover:shadow-md' : 'cursor-default',
        className
      )}
      onClick={handleItemClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon loại thông báo */}
        <div className="pt-0.5 shrink-0">
          <NotificationIcon type={notification.type} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Dòng tiêu đề */}
          <div className="flex justify-between items-start gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={cn(
                'font-semibold text-sm leading-snug',
                notification.read ? 'text-muted-foreground' : 'text-foreground'
              )}>
                {notification.title}
              </h4>
              {!notification.read ? (
                <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                  MỚI
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground shrink-0">Đã xem</span>
              )}
            </div>

            {!notification.read && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-0.5 px-2 text-xs shrink-0"
                onClick={(e) => { e.stopPropagation(); onMarkAsRead(notification.id); }}
              >
                Đánh dấu đã xem
              </Button>
            )}
          </div>

          {/* Nội dung */}
          <p className={cn('text-xs mt-1', notification.read ? 'text-muted-foreground' : 'text-foreground/80')}>
            {notification.message}
          </p>

          {/* Vị trí */}
          {(notification.location || notification.nestId) && (
            <div className="flex items-center gap-1 mt-1.5">
              <MapPin className="w-3 h-3 text-primary/70 shrink-0" />
              <span className="text-xs font-medium text-primary truncate">
                {notification.location ?? notification.nestId}
              </span>
            </div>
          )}

          {/* Loài + độ tin cậy */}
          {(notification.species || notification.confidence) && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {notification.species && (
                <div className="flex items-center gap-1">
                  <Bug className="w-3 h-3 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-600 dark:text-amber-400 italic">{notification.species}</span>
                </div>
              )}
              {notification.confidence && (
                <span className="text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                  {notification.confidence}% tin cậy
                </span>
              )}
            </div>
          )}

          {/* Thời gian */}
          <p className="text-xs text-muted-foreground mt-1.5">
            {new Date(notification.timestamp).toLocaleString('vi-VN')}
          </p>

          {/* Ảnh thumbnail */}
          {notification.imageUrl && (
            <div className="mt-3 rounded-lg overflow-hidden border border-border/40 max-h-48 bg-muted flex items-center">
              <img
                src={notification.imageUrl}
                alt="Ảnh phát hiện ong"
                className="w-full max-h-48 object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        {/* Chấm đỏ */}
        {!notification.read && (
          <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
        )}
      </div>
    </div>
  );
};

export default NotificationItem;