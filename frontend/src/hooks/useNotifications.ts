import { useEffect } from 'react';
import { api } from '../lib/api';
import { useNotificationStore } from '../store/notificationStore';

export function useNotifications() {
  const { setNotifications, unreadCount } = useNotificationStore();

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications?pageSize=50');
      setNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return {
    fetchNotifications,
    unreadCount
  };
}