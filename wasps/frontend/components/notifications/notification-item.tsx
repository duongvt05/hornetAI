"use client";

import React from 'react';
import type { Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check, Info, AlertTriangle, XCircle, AlertOctagon, MapPin, Bug } from 'lucide-react';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  className?: string;
}

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  switch (type) {
    case 'success':
      return <Check className="w-5 h-5 text-green-500" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-500" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'alert':
      return <AlertOctagon className="w-5 h-5 text-orange-500" />;
    default:
      return <Info className="w-5 h-5 text-gray-500" />;
  }
};

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkAsRead, className }) => {
  const handleItemClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  return (
    <Card
      className={cn(
        'mb-2 transition-all hover:shadow-md',
        notification.read ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-background dark:bg-gray-700/50',
        notification.link ? 'cursor-pointer' : 'cursor-default',
        className
      )}
      onClick={handleItemClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start space-x-3">
          <div className="pt-1">
            <NotificationIcon type={notification.type} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Tiêu đề + badge Mới/Đã xem + nút mark as read */}
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className={cn(
                  'font-semibold text-sm',
                  notification.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'
                )}>
                  {notification.title}
                </h4>
                {/* Badge trạng thái */}
                {!notification.read ? (
                  <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                    MỚI
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                    Đã xem
                  </span>
                )}
              </div>

              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-xs shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                >
                  Đánh dấu đã xem
                </Button>
              )}
            </div>

            {/* Nội dung thông báo */}
            <p className={cn(
              'text-xs mt-0.5',
              notification.read ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'
            )}>
              {notification.message}
            </p>

            {/* Vị trí tổ ong */}
            {(notification.location || notification.nestId) && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                <p className="text-xs font-medium text-orange-600 dark:text-orange-400 truncate">
                  {notification.location ?? notification.nestId}
                </p>
              </div>
            )}

            {/* Loài ong + độ tin cậy */}
            {(notification.species || notification.confidence) && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {notification.species && (
                  <div className="flex items-center gap-1">
                    <Bug className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-xs text-amber-600 dark:text-amber-400 italic">
                      {notification.species}
                    </span>
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
            <p className={cn(
              'text-xs mt-1',
              notification.read ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'
            )}>
              {new Date(notification.timestamp).toLocaleString('vi-VN')}
            </p>

            {/* Ảnh phát hiện */}
            {notification.imageUrl && (
              <img
                src={notification.imageUrl}
                alt="Ảnh phát hiện ong"
                className="mt-2 rounded-md max-h-32 object-cover"
              />
            )}
          </div>

          {/* Chấm đỏ chưa đọc */}
          {!notification.read && (
            <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 shrink-0" />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationItem;