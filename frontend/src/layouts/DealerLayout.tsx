import React from 'react';
import { Layout, Menu, Typography, Dropdown, Avatar, Spin, Button as AntButton } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserCog, Settings, LogOut, Hexagon, Shield, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useDealer } from '../context/DealerContext';
import NotificationBell from '../components/NotificationBell';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export const DealerLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { settings, loading } = useDealer();

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-transparent dark:bg-black"><Spin size="large" /></div>;
  }

  // Strictly block if not dealer admin or staff
  if (user?.role !== 'DEALER_ADMIN' && user?.role !== 'DEALER_STAFF') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-transparent dark:bg-black text-center gap-4">
        <Shield size={64} className="text-red-500" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-apple-textMuted dark:text-gray-400">Only Dealer Administrators can access this portal.</p>
        <button className="text-blue-600 font-semibold" onClick={() => navigate('/')}>Return Home</button>
      </div>
    );
  }

  const menuItems = [
    { key: '/dealer/dashboard', icon: <LayoutDashboard size={18} />, label: 'Overview' },
    { key: '/dealer/my-customers', icon: <Users size={18} />, label: 'My Customers' }, // Can reuse main CRM pages via route alias
    { key: '/dealer/team', icon: <UserCog size={18} />, label: 'Manage Team' },
    { key: '/dealer/settings', icon: <Settings size={18} />, label: 'My Company' },
    { key: '/dealer/tasks', icon: <Settings size={18} />, label: 'Tasks' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = (
    <div className="apple-card">
      <div className="px-3 py-2 border-b border-transparent border-transparent mb-2">
        <p className="font-semibold text-apple-textLight dark:text-apple-textDark dark:text-gray-200">{user.name}</p>
        <p className="text-xs text-apple-textMuted dark:text-gray-400">{user.role}</p>
      </div>
      <button 
        onClick={handleLogout}
        className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors text-sm font-medium"
      >
        <LogOut size={16} /> Sign Out
      </button>
    </div>
  );

  return (
    <Layout className="min-h-screen">
      <Sider width={220} className="border-r border-transparent border-transparent bg-apple-cardLight dark:bg-apple-cardDark dark:bg-apple-cardDark" breakpoint="lg" collapsedWidth="0" theme={isDarkMode ? 'dark' : 'light'}>
        <div className="h-16 flex items-center px-6 border-b border-transparent border-transparent bg-apple-cardLight dark:bg-apple-cardDark dark:bg-apple-cardDark">
          <Hexagon className="text-blue-600 mr-3" size={28} />
          <Title level={4} className="m-0 text-apple-textLight dark:text-apple-textDark dark:text-slate-200 truncate tracking-tight font-semibold" style={{ margin: 0, fontSize: '1.1rem' }}>
            {settings?.companyName || 'My Dealer Portal'}
          </Title>
        </div>
        
        <div className="p-4">
          <Text className="text-xs font-semibold text-apple-gray dark:text-apple-textMuted uppercase tracking-widest mb-2 block px-2">Portal Menu</Text>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            onClick={({ key }) => navigate(key)}
            items={menuItems}
            className="border-none bg-transparent"
          />
        </div>
      </Sider>

      <Layout className="bg-[#f5f5f7] dark:bg-black">
        <Header className="h-16 px-6 bg-apple-cardLight dark:bg-apple-cardDark/80 dark:bg-apple-cardDark/80 backdrop-blur-md border-b border-transparent border-transparent flex items-center justify-between sticky top-0 z-10 w-full transition-all duration-300">
          <div className="flex items-center gap-4">
            {/* Context breadcrumb or page title could go here */}
          </div>
          <div className="flex items-center gap-4">
            <AntButton
              type="text"
              icon={isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              onClick={toggleTheme}
            />
            <NotificationBell />
            <Dropdown trigger={['click']} dropdownRender={() => userMenu} placement="bottomRight">
              <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-800 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-transparent dark:hover:border-gray-700">
                <Avatar className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold">{user.name.charAt(0)}</Avatar>
                <div className="hidden md:block text-sm">
                  <span className="font-semibold text-apple-textLight dark:text-apple-textDark dark:text-slate-300 block leading-tight">{user.name}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default DealerLayout;
