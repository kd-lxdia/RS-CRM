import { useState } from 'react';
import { Badge, Button, Dropdown, Empty } from 'antd';
import { Bell, CheckCheck, ArrowRight, AlertCircle, CreditCard, Package, Clock, User } from 'lucide-react';
import { useNotificationStore, AppNotification } from '../store/notificationStore';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const typeIcon = (type: string) => {
  if (type.includes('PAYMENT') || type.includes('INVOICE')) return <CreditCard size={16} className="text-emerald-500" />;
  if (type.includes('STOCK') || type.includes('BOM') || type.includes('DISPATCH')) return <Package size={16} className="text-orange-500" />;
  if (type.includes('DELAY') || type.includes('ESCALAT')) return <AlertCircle size={16} className="text-red-500" />;
  if (type.includes('VISIT') || type.includes('FOLLOW')) return <Clock size={16} className="text-blue-500" />;
  if (type.includes('USER') || type.includes('ASSIGN')) return <User size={16} className="text-purple-500" />;
  return <Bell size={16} className="text-apple-gray" />;
};

function NotificationItem({ n, onRead }: { n: AppNotification; onRead: (id: string) => void }) {
  return (
    <div
      onClick={() => onRead(n.id)}
      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-transparent transition-colors border-b border-transparent last:border-0 ${!n.isRead ? 'bg-blue-50/40' : ''}`}
    >
      <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${!n.isRead ? 'font-semibold text-slate-900' : 'font-medium text-apple-textLight dark:text-apple-textDark'}`}>{n.title}</div>
        <div className="text-xs text-apple-textMuted truncate">{n.message}</div>
        <div className="text-xs text-apple-gray mt-0.5">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </div>
      </div>
      {!n.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();

  const recent = notifications.slice(0, 8);

  const dropdown = (
    <div className="w-[380px] bg-apple-cardLight dark:bg-apple-cardDark rounded-xl shadow-2xl border border-transparent overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-transparent flex items-center justify-between bg-transparent">
        <span className="font-bold text-apple-textLight dark:text-apple-textDark">Notifications</span>
        {unreadCount > 0 && (
          <Button
            type="text"
            size="small"
            icon={<CheckCheck size={14} />}
            onClick={markAllAsRead}
            className="text-blue-600 text-xs"
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto">
        {recent.length === 0 ? (
          <div className="py-10">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="You're all caught up!" />
          </div>
        ) : (
          recent.map((n) => (
            <NotificationItem key={n.id} n={n} onRead={(id) => { markAsRead(id); setOpen(false); }} />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 border-t border-transparent text-center cursor-pointer hover:bg-transparent transition-colors"
        onClick={() => { navigate('/notifications'); setOpen(false); }}
      >
        <span className="text-blue-600 text-sm font-semibold flex items-center justify-center gap-1">
          View All Notifications <ArrowRight size={14} />
        </span>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      dropdownRender={() => dropdown}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors text-apple-textMuted">
          <Bell size={20} />
        </button>
      </Badge>
    </Dropdown>
  );
}

export default NotificationBell;
