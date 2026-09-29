import React, { useState, useEffect } from 'react';
import { Drawer, List, Badge, Button, Typography, Empty, Spin, Divider, Tag } from 'antd';
import { Bell, X, Check, CheckCheck, Trash2, Clock, AlertTriangle, Package, User } from 'lucide-react';
import { api } from '../lib/api';
import { useNotificationStore } from '../store/notificationStore';
import { formatDistanceToNow } from 'date-fns';
import { NotificationDemo } from './NotificationDemo';
import '../styles/notifications.css';

const { Text, Title } = Typography;

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

interface NotificationPanelProps {
  visible: boolean;
  onClose: () => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'TASK_DUE_SOON':
    case 'TASK_OVERDUE':
    case 'TASK_OVERDUE_ALERT':
      return <Clock size={16} className="text-orange-500" />;
    case 'TASK_ASSIGNED':
    case 'TASK_COMPLETED':
      return <User size={16} className="text-blue-500" />;
    case 'LOW_STOCK':
    case 'LOW_STOCK_SUMMARY':
      return <Package size={16} className="text-red-500" />;
    default:
      return <Bell size={16} className="text-gray-500" />;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'TASK_OVERDUE':
    case 'TASK_OVERDUE_ALERT':
    case 'LOW_STOCK':
      return 'red';
    case 'TASK_DUE_SOON':
      return 'orange';
    case 'TASK_ASSIGNED':
    case 'TASK_COMPLETED':
      return 'blue';
    case 'LOW_STOCK_SUMMARY':
      return 'volcano';
    default:
      return 'default';
  }
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ visible, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { setNotifications: setStoreNotifications } = useNotificationStore();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
      setStoreNotifications(response.data.notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      const notification = notifications.find(n => n.id === id);
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    
    // Navigate to relevant page based on entity type
    if (notification.entityType === 'TASK' && notification.entityId) {
      // You can add navigation logic here
      console.log('Navigate to task:', notification.entityId);
    }
  };

  return (
    <Drawer
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={20} />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Badge count={unreadCount} size="small" />
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              type="text"
              size="small"
              icon={<CheckCheck size={16} />}
              onClick={markAllAsRead}
              className="text-blue-600 hover:text-blue-700"
            >
              Mark all read
            </Button>
          )}
        </div>
      }
      placement="right"
      onClose={onClose}
      open={visible}
      width={400}
      className="notification-drawer"
      styles={{
        body: { padding: 0 }
      }}
    >
      <div className="notification-demo-section p-4 border-b border-gray-200 dark:border-gray-700">
        <NotificationDemo onRefresh={fetchNotifications} />
      </div>
      
      <div className="notification-list-container">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Spin size="large" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="notification-empty-state p-6">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div className="text-center">
                  <div className="text-gray-500 dark:text-gray-400 mb-2">No notifications yet</div>
                  <div className="text-sm text-gray-400">Use the demo buttons above to create sample notifications</div>
                </div>
              }
            />
          </div>
        ) : (
          <List
            dataSource={notifications}
            renderItem={(notification) => (
              <List.Item
                className={`notification-item cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 px-4 py-3 ${
                  !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
                actions={[
                  <Button
                    type="text"
                    size="small"
                    icon={<Trash2 size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  />
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700">
                      {getNotificationIcon(notification.type)}
                    </div>
                  }
                  title={
                    <div className="flex items-center justify-between">
                      <Text strong={!notification.isRead} className="text-sm">
                        {notification.title}
                      </Text>
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full notification-badge" />
                        )}
                        <Tag color={getNotificationColor(notification.type)}>
                          {notification.type.replace(/_/g, ' ')}
                        </Tag>
                      </div>
                    </div>
                  }
                  description={
                    <div className="space-y-1">
                      <Text className="text-xs text-gray-600 dark:text-gray-400">
                        {notification.message}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </Drawer>
  );
};