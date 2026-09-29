import React, { useState } from 'react';
import { Card, Input, Select, Tag, Button, Empty } from 'antd';
import { Search, Bell, Filter, CheckCheck } from 'lucide-react';
import { useNotificationStore, AppNotification } from '../../store/notificationStore';
import { formatDistanceToNow, format } from 'date-fns';

const { Option } = Select;

const TYPE_COLORS: Record<string, string> = {
  FOLLOW_UP_DUE: 'blue',
  PAYMENT_DUE: 'orange',
  PAYMENT_RECEIVED: 'green',
  INVOICE_OVERDUE: 'red',
  TASK_DELAY_2D: 'orange',
  TASK_DELAY_4D: 'red',
  LOW_STOCK_ALERT: 'volcano',
  BOM_RECEIVED: 'cyan',
  DISPATCH_READY: 'geekblue',
  INSTALLATION_COMPLETE: 'green',
  VISIT_REMINDER_1HR: 'purple',
  SYSTEM_ALERT: 'magenta',
};

const NotificationsPage: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filtered = notifications.filter((n) => {
    const matchesSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.message.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || n.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Group by day
  const grouped: Record<string, AppNotification[]> = {};
  for (const n of filtered) {
    const day = format(new Date(n.createdAt), 'yyyy-MM-dd');
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(n);
  }
  const sortedDays = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  const dayLabel = (day: string) => (day === today ? 'Today' : day === yesterday ? 'Yesterday' : format(new Date(day), 'MMMM d, yyyy'));

  const uniqueTypes = [...new Set(notifications.map((n) => n.type))];

  return (
    <div className="p-6 bg-transparent min-h-screen max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark flex items-center">
          <Bell className="mr-2 text-blue-500" size={24} />
          All Notifications
        </h1>
        <Button
          icon={<CheckCheck size={16} />}
          onClick={markAllAsRead}
          disabled={notifications.every((n) => n.isRead)}
        >
          Mark All Read
        </Button>
      </div>

      {/* Filters */}
      <Card className="shadow-sm mb-6 rounded-lg">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search notifications..."
            prefix={<Search size={16} className="text-apple-gray" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 220 }}>
            <Option value="ALL">
              <Filter size={14} className="inline mr-1 text-apple-gray" /> All Types
            </Option>
            {uniqueTypes.map((t) => (
              <Option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </Option>
            ))}
          </Select>
        </div>
      </Card>

      {/* Grouped list */}
      {filtered.length === 0 ? (
        <Card className="shadow-sm rounded-lg">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notifications found." />
        </Card>
      ) : (
        sortedDays.map((day) => (
          <div key={day} className="mb-6">
            <div className="text-xs font-bold text-apple-textMuted uppercase tracking-widest mb-3 pl-1">
              {dayLabel(day)}
            </div>
            <Card className="shadow-sm rounded-lg overflow-hidden" bodyStyle={{ padding: 0 }}>
              {grouped[day].map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={`flex gap-4 px-5 py-4 border-b border-transparent last:border-0 cursor-pointer hover:bg-transparent transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Tag color={TYPE_COLORS[n.type] || 'default'} className="text-xs m-0">
                        {n.type.replace(/_/g, ' ')}
                      </Tag>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                    </div>
                    <div className={`text-sm ${!n.isRead ? 'font-semibold text-slate-900' : 'text-apple-textLight dark:text-apple-textDark'}`}>
                      {n.title}
                    </div>
                    <div className="text-xs text-apple-textMuted mt-0.5">{n.message}</div>
                  </div>
                  <div className="text-xs text-apple-gray shrink-0 pt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        ))
      )}
    </div>
  );
};

export default NotificationsPage;
