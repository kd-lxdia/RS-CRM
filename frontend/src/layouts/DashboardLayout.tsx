import React, { useState, useEffect } from 'react';
import { Layout, Menu, Dropdown, Avatar, Badge, theme, Button as AntButton, message } from 'antd';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Megaphone, FileText, Users, Bell, LogOut, User, Sun, Moon, Phone, MapPin, ShieldCheck, BarChart3, IndianRupee, Package } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useDealer } from '../context/DealerContext';
import { NotificationPanel } from '../components/NotificationPanel';
import { useNotificationStore } from '../store/notificationStore';

import { api } from '../lib/api';
import backendApi from '../lib/axios';

const { Header, Sider, Content } = Layout;

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { loading } = useDealer();
  const { token } = theme.useToken();
  const [notificationPanelVisible, setNotificationPanelVisible] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const { unreadCount, setNotifications: setStoreNotifications } = useNotificationStore();
  

  
  // Fetch initial notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications?pageSize=10');
        setStoreNotifications(response.data.notifications);
      } catch (error) {
        console.error('Error fetching initial notifications:', error);
      }
    };
    
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-apple-cardLight dark:bg-apple-cardDark dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMarkAttendance = () => {
    if (!navigator.geolocation) {
      message.error('Geolocation is not supported by your browser');
      return;
    }
    setAttendanceLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await backendApi.post('/attendance/mark', { lat: latitude, lng: longitude });
          if (res.data.success) {
            message.success(res.data.message);
          } else {
            message.error(res.data.message);
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Failed to mark attendance. Ensure you are within 200m of office or site.');
        } finally {
          setAttendanceLoading(false);
        }
      },
      (error) => {
        setAttendanceLoading(false);
        message.error('Please allow location access to mark attendance');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getMenuItems = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return [
          { key: '/admin/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
          { key: '/admin/reports', icon: <BarChart3 size={18} />, label: 'Business Command Center' },
          { key: '/admin/slar-2-control-room', icon: <ShieldCheck size={18} />, label: 'SLAR 2.0 Control' },
          { type: 'divider' as const },
          { key: '/admin/finance', icon: <IndianRupee size={18} />, label: 'Finance & Accounts' },
          { key: '/admin/inventory', icon: <Package size={18} />, label: 'Inventory' },
          { key: '/admin/b2b-pi', icon: <FileText size={18} />, label: 'B2B PI Control' },
          { type: 'divider' as const },
          { key: '/admin/team', icon: <Users size={18} />, label: 'Team Architecture' },
          { key: '/admin/users', icon: <Users size={18} />, label: 'User Management' },
          { key: '/admin/dealers', icon: <Users size={18} />, label: 'Dealer Management' },
          { key: '/admin/attendance', icon: <Users size={18} />, label: 'Attendance' },
          { type: 'divider' as const },
          { key: '/admin/integrations', icon: <FileText size={18} />, label: 'Integrations & AI' },
          { key: '/admin/settings', icon: <FileText size={18} />, label: 'System Settings' },
          { key: '/admin/audit', icon: <FileText size={18} />, label: 'Audit Trail' },
          { key: '/admin/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
      case 'PROJECT_HEAD':
        return [
          { key: '/project-head/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
          { key: '/project-head/slar-2-control-room', icon: <ShieldCheck size={18} />, label: 'SLAR 2.0 Control' },
          { key: '/project-head/kanban', icon: <FileText size={18} />, label: 'Kanban Board' },
          { key: '/project-head/team', icon: <Users size={18} />, label: 'Team Performance' },
          { key: '/project-head/quotation-controls', icon: <FileText size={18} />, label: 'Quotation Controls' },
          { key: '/project-head/b2b-pi', icon: <FileText size={18} />, label: 'B2B PI Approvals' },
          { key: '/project-head/escalations', icon: <FileText size={18} />, label: 'Escalations' },
          { key: '/project-head/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
      case 'DOCUMENTATION':
        return [
          { key: '/documentation/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
          { key: '/documentation/customers', icon: <Users size={18} />, label: 'My Customers' },
          { key: '/documentation/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
      case 'WAREHOUSE':
        return [
          { key: '/warehouse/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
          { key: '/warehouse/inventory', icon: <FileText size={18} />, label: 'Stock Inventory' },
          { key: '/warehouse/pipeline', icon: <FileText size={18} />, label: 'Pipeline' },
          { key: '/warehouse/history', icon: <FileText size={18} />, label: 'Stock History' },
          { key: '/warehouse/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
      case 'INSTALLATION':
        return [
          { key: '/installation/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
          { key: '/installation/map', icon: <FileText size={18} />, label: 'Today\'s Map' },
          { key: '/installation/customers', icon: <Users size={18} />, label: 'My Customers' },
          { key: '/installation/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
      case 'ACCOUNTANT':
        return [
          { key: '/accountant/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
          { key: '/accountant/receivables', icon: <FileText size={18} />, label: 'Receivables' },
          { key: '/accountant/invoices', icon: <FileText size={18} />, label: 'Invoice Center' },
          { key: '/accountant/payments', icon: <FileText size={18} />, label: 'Payment History' },
          { key: '/accountant/petrol-claims', icon: <FileText size={18} />, label: 'Petrol Claims' },
          { key: '/accountant/payroll', icon: <FileText size={18} />, label: 'Staff Payroll' },
          { key: '/accountant/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
      case 'SALESPERSON':
        return [
          { key: '/salesperson/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
          { key: '/salesperson/leads', icon: <Users size={18} />, label: 'My Leads' },
          { key: '/salesperson/route', icon: <FileText size={18} />, label: 'Today Route' },
          { key: '/salesperson/customer', icon: <Users size={18} />, label: 'Customer' },
          { key: '/salesperson/proposal-generator', icon: <FileText size={18} />, label: 'Proposal Generator' },
          { key: '/salesperson/solar-designer', icon: <FileText size={18} />, label: 'Solar Designer' },
          { key: '/salesperson/b2b-pi', icon: <FileText size={18} />, label: 'B2B PI' },
          { key: '/salesperson/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
      case 'DEALER_ADMIN':
        return [
          { key: '/dealer/dashboard', icon: <LayoutDashboard size={18} />, label: 'Overview' },
          { key: '/dealer/my-customers', icon: <Users size={18} />, label: 'My Customers' },
          { key: '/dealer/team', icon: <Users size={18} />, label: 'Manage Team' },
          { key: '/dealer/settings', icon: <FileText size={18} />, label: 'My Company' },
          { key: '/dealer/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
      case 'DEALER_STAFF':
        return [
          { key: '/dealer/dashboard', icon: <LayoutDashboard size={18} />, label: 'Overview' },
          { key: '/dealer/my-customers', icon: <Users size={18} />, label: 'My Customers' },
          { key: '/dealer/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
      case 'CALLING_STAFF':
      default:
        return [
          { key: '/calling-staff/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
          { key: '/calling-staff/campaigns', icon: <Megaphone size={18} />, label: 'Campaigns' },
          { key: '/calling-staff/templates', icon: <FileText size={18} />, label: 'Templates' },
          { key: '/calling-staff/raw-leads', icon: <Users size={18} />, label: 'Raw Leads' },
          { key: '/calling-staff/b2b-pi', icon: <FileText size={18} />, label: 'Create B2B PI' },
          { key: '/calling-staff/ai-voice-campaigns', icon: <Phone size={18} />, label: 'AI Voice Campaigns' },
          { key: '/calling-staff/tasks', icon: <FileText size={18} />, label: 'Tasks' },
        ];
    }
  };

  const menuItems = getMenuItems(user?.role);

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider 
        breakpoint="lg" 
        collapsedWidth="0" 
        width={220}
        className="border-r border-black/5 dark:border-white/10 bg-apple-gray dark:bg-black"
        theme={isDarkMode ? 'dark' : 'light'}
        style={{
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
          overflow: 'auto',
          background: isDarkMode ? '#000000' : '#f5f5f7'
        }}
      >
        <div className="h-16 flex items-center justify-center bg-transparent mt-4 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-apple-blue flex items-center justify-center shadow-lg shadow-apple-blue/30">
              <Sun size={18} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-apple-textLight dark:text-apple-textDark m-0">Slar</h1>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, padding: '16px 12px', background: 'transparent' }}
        />
      </Sider>
      <Layout style={{ background: 'transparent' }}>
        <Header className="px-6 flex justify-end items-center border-b border-black/5 dark:border-white/10 glass-panel sticky top-0 z-50">
          <div className="flex items-center gap-5">
            <AntButton
              type="text"
              shape="circle"
              icon={isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              onClick={toggleTheme}
              className="flex flex-col items-center justify-center text-apple-textMuted hover:text-apple-textLight dark:hover:text-white"
            />
            <AntButton
              type="primary"
              shape="round"
              icon={<MapPin size={16} />}
              loading={attendanceLoading}
              onClick={handleMarkAttendance}
              className="bg-apple-blue hover:bg-apple-blue/90 shadow-md font-medium"
            >
              Mark Attendance
            </AntButton>
            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-apple-cardLight dark:bg-apple-cardDark/10 transition-colors cursor-pointer"
                onClick={() => setNotificationPanelVisible(true)}
              >
                <Bell className="text-apple-textMuted hover:text-apple-textLight dark:hover:text-white transition-colors" size={18} />
              </div>
            </Badge>
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', icon: <User size={14} />, label: 'Profile' },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogOut size={14} />, label: 'Logout', onClick: handleLogout },
                ],
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className="flex items-center gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-apple-cardLight dark:bg-apple-cardDark/10 px-3 py-1.5 rounded-full transition-all">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-medium tracking-tight leading-tight">{user?.name || 'User'}</span>
                  <span className="text-[11px] text-apple-textMuted tracking-tight leading-tight">{user?.role === 'CALLING_STAFF' ? 'MARKETING' : (user?.role?.replace('_', ' ') || 'Role')}</span>
                </div>
                <Avatar style={{ backgroundColor: token.colorPrimary, border: '2px solid transparent' }} className="shadow-sm">{user?.name?.[0] || 'U'}</Avatar>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content 
          className="m-6 p-8 apple-card"
          style={{ minHeight: 280, margin: '24px' }}
        >
          <Outlet />
        </Content>
      </Layout>
      
      <NotificationPanel
        visible={notificationPanelVisible}
        onClose={() => setNotificationPanelVisible(false)}
      />
    </Layout>
  );
};
