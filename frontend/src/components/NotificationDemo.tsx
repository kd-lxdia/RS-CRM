import React, { useState } from 'react';
import { Button, Space, message, Popconfirm } from 'antd';
import { Bell, Plus, Trash2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface NotificationDemoProps {
  onRefresh?: () => void;
}

export const NotificationDemo: React.FC<NotificationDemoProps> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);

  const createDemoNotifications = async () => {
    try {
      setLoading(true);
      await api.post('/notifications/demo');
      message.success('Demo notifications created successfully!');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error creating demo notifications:', error);
      message.error('Failed to create demo notifications');
    } finally {
      setLoading(false);
    }
  };

  const clearNotifications = async () => {
    try {
      setClearLoading(true);
      await api.delete('/notifications/clear');
      message.success('All notifications cleared!');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error clearing notifications:', error);
      message.error('Failed to clear notifications');
    } finally {
      setClearLoading(false);
    }
  };

  const createTestNotification = async () => {
    try {
      await api.post('/notifications/test', {
        type: 'TEST',
        title: 'Test Notification',
        message: `Test notification created at ${new Date().toLocaleTimeString()}`
      });
      message.success('Test notification created!');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error creating test notification:', error);
      message.error('Failed to create test notification');
    }
  };

  return (
    <div className="notification-demo-section bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-4 mb-0">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={16} className="text-white" />
        <span className="font-medium text-white">Notification Demo</span>
      </div>
      
      <Space wrap>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          loading={loading}
          onClick={createDemoNotifications}
          className="bg-white/20 hover:bg-white/30 border-white/30 text-white backdrop-blur-sm"
        >
          Create Demo Notifications
        </Button>
        
        <Button
          icon={<RefreshCw size={16} />}
          onClick={createTestNotification}
          className="bg-white/10 hover:bg-white/20 border-white/20 text-white backdrop-blur-sm"
        >
          Add Test Notification
        </Button>
        
        <Popconfirm
          title="Clear all notifications?"
          description="This will permanently delete all your notifications."
          onConfirm={clearNotifications}
          okText="Yes, Clear All"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button
            icon={<Trash2 size={16} />}
            loading={clearLoading}
            className="bg-red-500/20 hover:bg-red-500/30 border-red-400/30 text-white backdrop-blur-sm"
          >
            Clear All
          </Button>
        </Popconfirm>
      </Space>
      
      <div className="mt-3 text-sm text-white/80">
        Use these buttons to test the notification system with realistic demo data.
      </div>
    </div>
  );
};