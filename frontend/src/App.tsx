import { useMemo, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme, Card, Form, Input, Button, Alert, Select } from 'antd';
import { DashboardLayout } from './layouts/DashboardLayout';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { useSocketNotifications } from './hooks/useSocketNotifications';
import NotificationsPage from './pages/notifications/NotificationsPage';
import { api } from './lib/api';

import { DealerProvider } from './context/DealerContext';
import DealerLayout from './layouts/DealerLayout';
import DealerDashboard from './pages/dealer/DealerDashboard';
import DealerTeam from './pages/dealer/DealerTeam';
import DealerSettings from './pages/dealer/DealerSettings';
import MyCustomers from './pages/documentation/MyCustomers';

import Dashboard from './pages/calling-staff/Dashboard';
import Campaigns from './pages/calling-staff/Campaigns';
import CampaignDetail from './pages/calling-staff/CampaignDetail';
import Templates from './pages/calling-staff/Templates';
import RawLeads from './pages/calling-staff/RawLeads';
import AIVoiceCampaignsPage from './pages/ai-voice/AIVoiceCampaignsPage';
import AIVoiceCampaignDetailPage from './pages/ai-voice/AIVoiceCampaignDetailPage';

import SalespersonLayout from './pages/salesperson/SalespersonLayout';
import SalesDashboard from './pages/salesperson/SalesDashboard';
import LeadsBoard from './pages/salesperson/LeadsBoard';
import VisitMap from './pages/salesperson/VisitMap';
import VisitDetail from './pages/salesperson/VisitDetail';
import LeadDetail from './pages/salesperson/LeadDetail';
import VisitCalendar from './pages/salesperson/VisitCalendar';
import CustomerBoard from './pages/salesperson/CustomerBoard';

import SolarDesignerPage from './pages/solar-designer/index';
import StudioPage from './pages/solar-designer/StudioPage';
import DemoLanding from './pages/DemoLanding';
import AdminSolarConfig from './pages/admin/AdminSolarConfig';
import ProposalViewer from './pages/public/ProposalViewer';

import AdminDashboard from './pages/admin/Dashboard';
import TeamArchitecture from './pages/admin/TeamArchitecture';
import DealerManagement from './pages/admin/DealerManagement';
import UserManagement from './pages/admin/UserManagement';
import SystemSettings from './pages/admin/SystemSettings';
import AuditTrail from './pages/admin/AuditTrail';
import IntegrationsPage from './pages/admin/Integrations';
import BusinessReports from './pages/admin/BusinessReports';
import AdminFinance from './pages/admin/AdminFinance';
import AdminInventory from './pages/admin/AdminInventory';
import ProposalGenerator from './pages/salesperson/ProposalGenerator';
import AdminAttendance from './pages/admin/AdminAttendance';
import Slar2ControlRoom from './pages/founder/Slar2ControlRoom';

import ProjectHeadDashboard from './pages/project-head/Dashboard';
import KanbanBoard from './pages/project-head/KanbanBoard';
import TeamPerformance from './pages/project-head/TeamPerformance';
import EscalationLog from './pages/project-head/EscalationLog';
import QuotationControls from './pages/project-head/QuotationControls';

import DocumentationDashboard from './pages/documentation/Dashboard';

import WarehouseDashboard from './pages/warehouse/Dashboard';
import StockInventory from './pages/warehouse/StockInventory';
import Pipeline from './pages/warehouse/Pipeline';
import StockHistory from './pages/warehouse/StockHistory';

import InstallationDashboard from './pages/installation/Dashboard';
import InstallationMap from './pages/installation/InstallationMap';
import InstallCustomers from './pages/installation/MyCustomers';

import AccountantDashboard from './pages/accountant/Dashboard';
import Receivables from './pages/accountant/Receivables';
import InvoiceCenter from './pages/accountant/InvoiceCenter';
import PaymentHistory from './pages/accountant/PaymentHistory';
import PetrolClaims from './pages/accountant/PetrolClaims';
import Payroll from './pages/accountant/Payroll';
import TasksPage from './pages/tasks/TasksPage';
import CustomerPage from './pages/customer/CustomerPage';
import B2bPiPage from './pages/b2b/B2bPiPage';

const queryClient = new QueryClient();

function getDefaultRoute(role?: string | null) {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'PROJECT_HEAD':
      return '/project-head/dashboard';
    case 'DOCUMENTATION':
      return '/documentation/dashboard';
    case 'WAREHOUSE':
      return '/warehouse/dashboard';
    case 'INSTALLATION':
      return '/installation/dashboard';
    case 'ACCOUNTANT':
      return '/accountant/dashboard';
    case 'SALESPERSON':
      return '/salesperson/dashboard';
    case 'DEALER_ADMIN':
    case 'DEALER_STAFF':
      return '/dealer/dashboard';
    case 'CALLING_STAFF':
      return '/calling-staff/dashboard';
    default:
      return '/calling-staff/dashboard';
  }
}

function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();

  const presets = useMemo(
    () => ({
      admin: { email: 'demo-admin@slarcrm.com', password: 'Password@123', role: 'ADMIN' },
      call: { email: 'demo-calling-01@slarcrm.com', password: 'Password@123', role: 'CALLING_STAFF' },
      sales: { email: 'demo-salesperson-01@slarcrm.com', password: 'Password@123', role: 'SALESPERSON' },
      project_head: { email: 'demo-project-head-01@slarcrm.com', password: 'Password@123', role: 'PROJECT_HEAD' },
      documentation: { email: 'demo-documentation-01@slarcrm.com', password: 'Password@123', role: 'DOCUMENTATION' },
      warehouse: { email: 'demo-warehouse-01@slarcrm.com', password: 'Password@123', role: 'WAREHOUSE' },
      installation: { email: 'demo-installation-01@slarcrm.com', password: 'Password@123', role: 'INSTALLATION' },
      accountant: { email: 'demo-accountant-01@slarcrm.com', password: 'Password@123', role: 'ACCOUNTANT' },
      dealer: { email: 'demo-dealer-admin@slarcrm.com', password: 'Password@123', role: 'DEALER_ADMIN' },
      dealer_staff: { email: 'demo-dealer-staff@slarcrm.com', password: 'Password@123', role: 'DEALER_STAFF' },
    }),
    []
  );

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      // Use real authentication API
      const response = await api.post('/auth/login', {
        email: values.email,
        password: values.password
      });

      const { accessToken, refreshToken, user } = response.data;
      
      login(accessToken, refreshToken, user);
      navigate(getDefaultRoute(user.role), { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-apple-gray dark:bg-black selection:bg-apple-blue/20">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-[14px] bg-apple-blue flex items-center justify-center shadow-lg shadow-apple-blue/30 mb-4 transform transition-transform hover:scale-105 duration-300">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-apple-textLight dark:text-apple-textDark m-0">Slar CRM</h1>
          <p className="text-apple-textMuted mt-2 text-[15px] font-medium tracking-tight">Sign in to your workspace</p>
        </div>

        <div className="apple-card p-8 sm:p-10 backdrop-blur-3xl bg-white/70 dark:bg-apple-cardDark/70">
          <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ ...presets.admin, preset: 'admin' }} requiredMark={false} size="large">
            <Form.Item label={<span className="font-semibold text-apple-textMuted text-[13px] tracking-tight uppercase">EMAIL</span>} name="email" rules={[{ required: true }, { type: 'email' }]} className="mb-4">
              <Input autoComplete="email" className="bg-apple-gray dark:bg-black border-transparent hover:border-black/10 focus:border-apple-blue dark:hover:border-white/10 dark:focus:border-apple-blue transition-colors px-4 py-3 rounded-[12px]" placeholder="name@example.com" />
            </Form.Item>
            <Form.Item label={<span className="font-semibold text-apple-textMuted text-[13px] tracking-tight uppercase">PASSWORD</span>} name="password" rules={[{ required: true }]} className="mb-6">
              <Input.Password autoComplete="current-password" className="bg-apple-gray dark:bg-black border-transparent hover:border-black/10 focus:border-apple-blue dark:hover:border-white/10 dark:focus:border-apple-blue transition-colors px-4 py-3 rounded-[12px]" placeholder="********" />
            </Form.Item>
            <Form.Item label={<span className="font-semibold text-apple-textMuted text-[13px] tracking-tight uppercase">DEMO PRESET</span>} name="preset" className="mb-8">
              <Select
                className="w-full"
                options={[
                  { value: 'admin', label: 'Admin Access' },
                  { value: 'call', label: 'Marketing' },
                  { value: 'sales', label: 'Salesperson' },
                  { value: 'project_head', label: 'Project Head' },
                  { value: 'documentation', label: 'Documentation' },
                  { value: 'warehouse', label: 'Warehouse Team' },
                  { value: 'installation', label: 'Installation Crew' },
                  { value: 'accountant', label: 'Finance & Accounting' },
                  { value: 'dealer', label: 'Dealer Admin' },
                  { value: 'dealer_staff', label: 'Dealer Staff' },
                ]}
                onChange={(value) => form.setFieldsValue({ 
                  email: presets[value as keyof typeof presets].email,
                  password: presets[value as keyof typeof presets].password 
                })}
              />
            </Form.Item>
            {error ? <Alert type="error" message={error} className="mb-6 rounded-[12px] border-red-500/20 bg-red-500/10 text-red-600 font-medium" showIcon /> : null}
            <Button type="primary" htmlType="submit" loading={loading} block className="h-12 text-[15px] font-semibold tracking-tight shadow-md shadow-apple-blue/20 hover:shadow-apple-blue/30 border-0 rounded-[14px]">
              Continue to Workspace â†’
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles }: { children: JSX.Element; allowedRoles?: string[] }) {
  const token = useAuthStore((s) => s.accessToken);
  const userRole = useAuthStore((s) => s.user?.role);

  if (!token) return <Navigate to="/login" replace />;

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to={getDefaultRoute(userRole)} replace />;
  }

  return children;
}

function RootRedirect() {
  const token = useAuthStore((s) => s.accessToken);
  const userRole = useAuthStore((s) => s.user?.role);
  return <Navigate to={token ? getDefaultRoute(userRole) : '/login'} replace />;
}

function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocketNotifications();
  return <>{children}</>;
}

export default function App() {
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <QueryClientProvider client={queryClient}>
    <ConfigProvider 
      theme={{ 
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm, 
        token: { 
          colorPrimary: '#0071e3', // Apple Blue
          borderRadius: 12,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          colorBgBase: isDarkMode ? '#000000' : '#f5f5f7',
          colorBgContainer: isDarkMode ? '#1c1c1e' : '#ffffff',
          colorBgElevated: isDarkMode ? '#2c2c2e' : '#ffffff',
          colorBorder: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          controlHeight: 40,
          boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
        },
        components: {
          Layout: {
            bodyBg: isDarkMode ? '#000000' : '#f5f5f7',
            headerBg: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
            siderBg: isDarkMode ? '#000000' : '#f5f5f7',
          },
          Card: {
            lineWidth: 0,
            boxShadowTertiary: isDarkMode ? '0 4px 24px rgba(0,0,0,0.2)' : '0 4px 24px rgba(0,0,0,0.04)',
            borderRadiusOuter: 18,
          },
          Button: {
            borderRadius: 20,
            paddingInline: 20,
          },
          Menu: {
            itemBorderRadius: 8,
            itemHoverBg: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            itemSelectedBg: isDarkMode ? 'rgba(0,113,227,0.15)' : '#e8f0fe',
            itemSelectedColor: '#0071e3',
          }
        }
      }}
    >
      <BrowserRouter>
        <SocketProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          
          <Route
            path="/calling-staff"
            element={
              <ProtectedRoute allowedRoles={['CALLING_STAFF', 'DEALER_ADMIN', 'ADMIN']}>
                <DealerProvider>
                  <DashboardLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="templates" element={<Templates />} />
            <Route path="raw-leads" element={<RawLeads />} />
            <Route path="b2b-pi" element={<B2bPiPage />} />
            <Route path="ai-voice-campaigns" element={<AIVoiceCampaignsPage />} />
            <Route path="ai-voice-campaigns/:id" element={<AIVoiceCampaignDetailPage />} />
            <Route path="solar-config" element={<AdminSolarConfig />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <DealerProvider>
                  <DashboardLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="team" element={<TeamArchitecture />} />
            <Route path="dealers" element={<DealerManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="settings" element={<SystemSettings />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="reports" element={<BusinessReports />} />
            <Route path="finance" element={<AdminFinance />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="audit" element={<AuditTrail />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="slar-2-control-room" element={<Slar2ControlRoom />} />
            <Route path="b2b-pi" element={<B2bPiPage />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>

          <Route
            path="/project-head"
            element={
              <ProtectedRoute allowedRoles={['PROJECT_HEAD', 'ADMIN']}>
                <DealerProvider>
                  <DashboardLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ProjectHeadDashboard />} />
            <Route path="kanban" element={<KanbanBoard />} />
            <Route path="team" element={<TeamPerformance />} />
            <Route path="quotation-controls" element={<QuotationControls />} />
            <Route path="b2b-pi" element={<B2bPiPage />} />
            <Route path="escalations" element={<EscalationLog />} />
            <Route path="slar-2-control-room" element={<Slar2ControlRoom />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>

          <Route
            path="/documentation"
            element={
              <ProtectedRoute allowedRoles={['DOCUMENTATION', 'ADMIN']}>
                <DealerProvider>
                  <DashboardLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DocumentationDashboard />} />
            <Route path="customers" element={<MyCustomers />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>

          <Route
            path="/warehouse"
            element={
              <ProtectedRoute allowedRoles={['WAREHOUSE', 'ADMIN']}>
                <DealerProvider>
                  <DashboardLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<WarehouseDashboard />} />
            <Route path="inventory" element={<StockInventory />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="history" element={<StockHistory />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>

          <Route
            path="/installation"
            element={
              <ProtectedRoute allowedRoles={['INSTALLATION', 'ADMIN']}>
                <DealerProvider>
                  <DashboardLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<InstallationDashboard />} />
            <Route path="map" element={<InstallationMap />} />
            <Route path="customers" element={<InstallCustomers />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>

          <Route
            path="/accountant"
            element={
              <ProtectedRoute allowedRoles={['ACCOUNTANT', 'ADMIN']}>
                <DealerProvider>
                  <DashboardLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AccountantDashboard />} />
            <Route path="receivables" element={<Receivables />} />
            <Route path="invoices" element={<InvoiceCenter />} />
            <Route path="payments" element={<PaymentHistory />} />
            <Route path="petrol-claims" element={<PetrolClaims />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>

          <Route
            path="/salesperson"
            element={
              <ProtectedRoute allowedRoles={['SALESPERSON', 'DEALER_ADMIN', 'ADMIN']}>
                <DealerProvider>
                  <SalespersonLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<SalesDashboard />} />
            <Route path="leads" element={<LeadsBoard />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="route" element={<VisitMap />} />
            <Route path="customer" element={<CustomerBoard />} />
            <Route path="b2b-pi" element={<B2bPiPage />} />
            <Route path="visits/:id" element={<VisitDetail />} />
            <Route path="solar-designer" element={<SolarDesignerPage />} />
            <Route path="proposal-generator" element={<ProposalGenerator />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>

          <Route path="/proposal-generator" element={<ProtectedRoute><ProposalGenerator /></ProtectedRoute>} />
          <Route path="/solar-designer" element={<ProtectedRoute><SolarDesignerPage /></ProtectedRoute>} />
          <Route path="/studio/:designId?" element={<ProtectedRoute><StudioPage /></ProtectedRoute>} />
          
          {/* Public Demo Routes - No Auth Required */}
          <Route path="/demo" element={<DemoLanding />} />
          <Route path="/demo/solar-designer" element={<SolarDesignerPage />} />
          <Route path="/demo/studio" element={<StudioPage />} />
          
          {/* Public Proposal Viewer - No Auth Required */}
          <Route path="/proposal/view/:token" element={<ProposalViewer />} />

          <Route
            path="/dealer"
            element={
              <ProtectedRoute allowedRoles={['DEALER_ADMIN', 'DEALER_STAFF']}>
                <DealerProvider>
                  <DealerLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DealerDashboard />} />
            <Route path="my-customers" element={<MyCustomers />} />
            <Route path="team" element={<DealerTeam />} />
            <Route path="settings" element={<DealerSettings />} />
            <Route path="tasks" element={<TasksPage />} />
          </Route>

          {/* Shared Customer Detail Page - Accessible by all authenticated users */}
          <Route
            path="/customer/:id"
            element={
              <ProtectedRoute>
                <DealerProvider>
                  <DashboardLayout />
                </DealerProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<CustomerPage />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
        </SocketProvider>
      </BrowserRouter>
    </ConfigProvider>
    </QueryClientProvider>
  );
}


