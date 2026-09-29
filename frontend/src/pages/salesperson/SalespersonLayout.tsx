import { Layout, Menu, Button as AntButton } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  DashboardOutlined, 
  TeamOutlined, 
  CompassOutlined, 
  CalendarOutlined,
  FileTextOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useDealer } from '../../context/DealerContext';

const { Header, Content, Sider } = Layout;

export default function SalespersonLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { loading } = useDealer();

  const handleMenuClick = (key: string) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
      return;
    }
    navigate(`/salesperson/${key}`);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-transparent dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Layout className="min-h-screen">
      <Sider 
        breakpoint="lg"
        collapsedWidth="0"
        className="fixed h-full z-10 border-r border-transparent border-transparent bg-apple-cardLight dark:bg-apple-cardDark dark:bg-apple-cardDark"
        theme={isDarkMode ? 'dark' : 'light'}
      >
        <div className="h-16 flex items-center justify-center border-b border-transparent border-transparent bg-apple-cardLight dark:bg-apple-cardDark dark:bg-apple-cardDark">
          <h1 className="text-xl font-bold text-blue-600 dark:text-blue-500 tracking-tight">
            Slar CRM
          </h1>
        </div>
        <div className="p-4 border-b border-transparent bg-[#fbfbfd] dark:bg-apple-cardDark border-transparent">
          <p className="font-semibold text-sm truncate dark:text-gray-200">{user?.name}</p>
          <p className="text-xs text-apple-textMuted dark:text-gray-400">Field Sales</p>
        </div>
        <div className="px-4 py-2 flex justify-center border-b border-transparent border-transparent">
          <AntButton 
            type="text" 
            block 
            icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            className="dark:text-gray-300"
          >
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </AntButton>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname.split('/')[2] || 'dashboard']}
          onClick={({ key }) => handleMenuClick(key)}
          style={{ borderRight: 0 }}
          className="bg-transparent"
          items={[
            { key: 'dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
            { key: 'leads', icon: <TeamOutlined />, label: 'My Leads' },
            { key: 'route', icon: <CompassOutlined />, label: 'Sales Route' },
            { key: 'customer', icon: <TeamOutlined />, label: 'Customer' },
            { key: 'b2b-pi', icon: <FileTextOutlined />, label: 'B2B PI' },
            { type: 'divider' },
            { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
          ]}
        />
      </Sider>
      <Layout className="lg:ml-[200px] transition-all bg-[#f5f5f7] dark:bg-black min-h-screen">
        <Header className="bg-apple-cardLight dark:bg-apple-cardDark/80 dark:bg-apple-cardDark/80 backdrop-blur-md px-4 flex items-center justify-between border-b border-transparent border-transparent md:hidden shadow-sm sticky top-0 z-10">
          <div className="font-bold text-lg text-blue-600 dark:text-blue-500 tracking-tight">Slar CRM</div>
          <AntButton 
            type="text" 
            icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            className="dark:text-gray-300"
          />
        </Header>
        <Content className="p-4 md:p-6 bg-[#f5f5f7] dark:bg-black max-w-7xl mx-auto w-full">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

