'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileText,
  Megaphone,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationService, NotificationData } from '@/lib/notifications';
import { NOTIFICATION_POLL_INTERVAL_MS } from '@/lib/program-defaults';
import { useAuth } from '@/hooks/useAuth';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const loadNotifications = () => {
      const userNotifications = notificationService.getNotificationsForUser(user.id);
      setNotifications(userNotifications);
      setUnreadCount(notificationService.getUnreadCount(user.id));
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, NOTIFICATION_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAsRead = (notificationId: string) => {
    notificationService.markAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = () => {
    if (!user) return;

    notificationService.markAllAsRead(user.id);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    setUnreadCount(0);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'referral_submitted':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'referral_approved':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'referral_rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'commission_approved':
        return <CircleDollarSign className="h-4 w-4 text-emerald-600" />;
      case 'payout_processed':
        return <CreditCard className="h-4 w-4 text-violet-600" />;
      case 'affiliate_registered':
        return <UserPlus className="h-4 w-4 text-blue-600" />;
      default:
        return <Megaphone className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open notifications"
        className="relative"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-lg border bg-popover text-popover-foreground shadow-xl">
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="mx-auto mb-2 h-8 w-8" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className={`flex w-full items-start gap-3 border-b p-4 text-left transition-colors hover:bg-muted/60 ${
                      !notification.read ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span
                          className={`text-sm font-medium ${
                            !notification.read ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {notification.title}
                        </span>
                        {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">{notification.message}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatTimeAgo(notification.timestamp)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
        </>
      )}
    </div>
  );
}
