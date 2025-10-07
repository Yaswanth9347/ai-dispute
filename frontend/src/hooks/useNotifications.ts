'use client';

import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import getSocket from '@/lib/socket';
import { apiFetch } from '@/lib/fetchClient';

interface AppNotification {
  notification_id?: string; // DB uses notification_id
  id?: string; // fallback
  notification_type?: string;
  type?: string;
  title: string;
  message: string;
  created_at?: string;
  timestamp?: string;
  is_read?: boolean;
  read?: boolean;
  action_url?: string;
  actionUrl?: string;
  action_data?: any;
  metadata?: any;
  case_id?: string | number;
}

export function useNotifications() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const resp = await apiFetch('/notifications');
      const data = await resp.json();
      const items: AppNotification[] = (data.data || []).map((n: any) => ({
        ...n,
        read: n.is_read ?? n.read,
        id: n.notification_id || n.id,
        timestamp: n.created_at || n.timestamp
      }));
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const socketInstance = getSocket(token);

    const onConnect = () => {
      console.log('✅ Notifications socket connected');
      setIsConnected(true);
      fetchNotifications();
    };

    const onDisconnect = () => {
      console.log('❌ Notifications socket disconnected');
      setIsConnected(false);
    };

    const onNotification = (notification: any) => {
      const n: AppNotification = {
        ...notification,
        id: notification.notificationId || notification.notification_id || notification.id,
        read: notification.read ?? notification.is_read ?? false,
        timestamp: notification.createdAt || notification.created_at || notification.timestamp
      };

      console.log('🔔 New notification:', n);
      setNotifications((prev) => [n, ...prev]);
      setUnreadCount((prev) => prev + (n.read ? 0 : 1));

      // Browser notification
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          // eslint-disable-next-line no-new
          new (window as any).Notification(n.title, {
            body: n.message,
            icon: '/icon.png'
          });
        }
      } catch (e) {
        // ignore
      }
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('notification', onNotification);
    socketInstance.on('case_notification', onNotification);

    setSocket(socketInstance as Socket);

    return () => {
      try {
        socketInstance.off('connect', onConnect);
        socketInstance.off('disconnect', onDisconnect);
        socketInstance.off('notification', onNotification);
        socketInstance.off('case_notification', onNotification);
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await apiFetch(`/notifications/${notificationId}/read`, { method: 'PUT' });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId || n.notification_id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiFetch('/notifications/read-all', { method: 'PUT' });

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await apiFetch(`/notifications/${notificationId}`, { method: 'DELETE' });

      setNotifications((prev) => prev.filter((n) => !(n.id === notificationId || n.notification_id === notificationId)));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window && (window as any).Notification.permission === 'default') {
      await (window as any).Notification.requestPermission();
    }
  }, []);

  return {
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestPermission,
  };
}
