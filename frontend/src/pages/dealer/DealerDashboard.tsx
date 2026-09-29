import React from 'react';
import { Row, Col, Statistic, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Users, UserCheck, IndianRupee, Target } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DashboardCard } from '../../components/DashboardCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const { Title, Text } = Typography;

const mockPipelineData = [
  { stage: 'New', leads: 45 },
  { stage: 'Contacted', leads: 30 },
  { stage: 'Surveyed', leads: 20 },
  { stage: 'Proposals', leads: 15 },
  { stage: 'Won', leads: 8 },
];

export const DealerDashboard: React.FC = () => {
  const { accessToken } = useAuthStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dealerDashboard'],
    queryFn: async () => {
      // Mocked if backend not running
      // const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/dealer/dashboard`, {
      //   headers: { Authorization: `Bearer ${accessToken}` }
      // });
      // return res.data.data;
      return { customerCount: 45, leadCount: 120, teamCount: 8, revenue: 1500000 };
    },
    refetchInterval: 30000
  });

  return (
    <div className="space-y-6">
      <div>
        <Title level={3} className="m-0">Overview</Title>
        <Text type="secondary" className="text-apple-textMuted">Real-time metrics for your company operations</Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={isLoading} className="border-l-4 border-blue-500">
            <Statistic title="Total Customers" value={stats?.customerCount || 0} prefix={<Users size={20} className="text-blue-500 mr-2" />} />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={isLoading} className="border-l-4 border-orange-500">
            <Statistic title="Active Leads" value={stats?.leadCount || 0} prefix={<Target size={20} className="text-orange-500 mr-2" />} />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={isLoading} className="border-l-4 border-emerald-500">
            <Statistic title="Team Members" value={stats?.teamCount || 0} prefix={<UserCheck size={20} className="text-emerald-500 mr-2" />} />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <DashboardCard loading={isLoading} className="border-l-4 border-purple-500">
            <Statistic title="Total Revenue" value={stats?.revenue || 0} precision={0} prefix={<IndianRupee size={20} className="text-purple-500 mr-2" />} />
          </DashboardCard>
        </Col>
      </Row>
      
      <Row gutter={[24, 24]}>
         <Col xs={24} lg={16}>
            <DashboardCard title="Activity Pipeline" loading={isLoading} className="h-full">
               <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={mockPipelineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="stage" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{ fill: '#f1f5f9', opacity: 0.5 }} />
                        <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </DashboardCard>
         </Col>
      </Row>
    </div>
  );
};

export default DealerDashboard;
