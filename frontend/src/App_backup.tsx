import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './layouts/DashboardLayout';
import { useAuthStore } from './store/authStore';
import { useSocketNotifications } from './hooks/useSocketNotifications';
import NotificationsPage from './pages/notifications/NotificationsPage';

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

// Salesperson Components
import SalespersonLayout from './pages/salesperson/SalespersonLayout';
import SalesDashboard from './pages/salesperson/SalesDashboard';
import LeadsBoard from './pages/salesperson/LeadsBoard';
import VisitMap from './pages/salesperson/VisitMap';
import VisitDetail from './pages/salesperson/VisitDetail';

// Solar Designer
import SolarDesignerPage from './pages/solar-designer/index';

// Salesperson Solar Designer
import SolarDesigner from './pages/salesperson/SolarDesigner';

// Admin Solar Config
import AdminSolarConfig from './pages/admin/AdminSolarConfig';

const Login = () => {
  const login = useAuthStore((s) => s.login);
  return (
    <div className="flex items-center justify-center p-20">
      <button 
        className="bg-blue-600 text-white px-4 py-2 rounded"
        onClick={() => login('dummy-token', 'dummy-refresh', { id: '1', name: 'Test Caller', role: 'CALLING_STAFF' as any, dealerId: null, zoneId: null })}
      >
        Simulate Login
      </button>
    </div>
  );
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const ProtectedRoute = ({ children, allowedRoles }: { children: JSX.Element, allowedRoles?: string[] }) => {
  const token = useAuthStore((s) => s.accessToken);
  const userRole = useAuthStore((s) => s.user?.role);

  if (!token) return <Navigate to="/login" replace />;

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Redirect to a "not authorized" page or dashboard based on role
    // For simplicity, redirecting to login or a generic dashboard
    return <Navigate to="/login" replace />; // Or to a /not-authorized page
  }

  return children;
};

function SocketProvider({ children }: { children: React.ReactNode }) {
  useSocketNotifications();
  return <>{children}</>;
}

export default function App() {
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
      <QueryClientProvider client={queryClient}>
        <DealerProvider>
          <BrowserRouter>
            <SocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/calling-staff" element={<ProtectedRoute allowedRoles={['CALLING_STAFF', 'DEALER_ADMIN', 'ADMIN']}><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="campaigns/:id" element={<CampaignDetail />} />
              <Route path="templates" element={<Templates />} />
              <Route path="raw-leads" element={<RawLeads />} />
              <Route path="solar-config" element={<AdminSolarConfig />} />
            </Route>

            {/* Salesperson Routes */}
            <Route path="/salesperson" element={
              <ProtectedRoute allowedRoles={['SALESPERSON', 'DEALER_ADMIN', 'ADMIN']}>
                <SalespersonLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<SalesDashboard />} />
              <Route path="leads" element={<LeadsBoard />} />
              <Route path="route" element={<VisitMap />} />
              <Route path="visits/:id" element={<VisitDetail />} />
              <Route path="solar-designer" element={<SolarDesigner />} />
            </Route>

            {/* Solar Designer — accessible to all roles */}
            <Route path="/solar-designer" element={<ProtectedRoute><SolarDesignerPage /></ProtectedRoute>} />

            {/* Notifications — all authenticated users */}
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

            {/* Dealer Portal */}
            <Route path="/dealer" element={
              <ProtectedRoute allowedRoles={['DEALER_ADMIN']}>
                <DealerLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DealerDashboard />} />
              <Route path="my-customers" element={<MyCustomers />} />
              <Route path="team" element={<DealerTeam />} />
              <Route path="settings" element={<DealerSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/calling-staff/dashboard" replace />} />
          </Routes>
          </SocketProvider>
        </BrowserRouter>
        </DealerProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
}
