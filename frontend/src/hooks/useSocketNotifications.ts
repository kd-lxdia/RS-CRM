import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { notification as antdNotification } from 'antd';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore, AppNotification } from '../store/notificationStore';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_BASE_URL } from '../lib/endpoints';

export function useSocketNotifications() {
  const user = useAuthStore((s) => s.user);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const socket: Socket = io(SOCKET_BASE_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      socket?.emit('join_user_room', user.id);
      // Join global company-wide broadcast room for generic state syncs if needed, though we can stick to user rooms
    });

    socket.on('notification', (payload: AppNotification) => {
      addNotification(payload);

      // Show antd toast
      antdNotification.open({
        message: payload.title,
        description: payload.message,
        placement: 'topRight',
        duration: 5,
      });
    });

    socket.on('escalation_triggered', (data: any) => {
      // High-priority alert
      antdNotification.error({
        message: 'Task Escalated!',
        description: `A task has been escalated to level ${data.escalation?.escalationLevel || 1}. Reason: ${data.escalation?.reason}`,
        placement: 'topRight',
        duration: 0, // Doesn't close automatically
      });
    });

    // Global real-time data sync listener
    socket.on('entity_updated', (data: { entityType: string; entityId: string }) => {
      if (data.entityType === 'CUSTOMER') {
        queryClient.invalidateQueries({ queryKey: ['customer', data.entityId] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } else if (data.entityType === 'LEAD') {
        queryClient.invalidateQueries({ queryKey: ['lead', data.entityId] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
    });

    return () => {
      socket?.disconnect();
    };
  }, [user?.id, queryClient]);
}
