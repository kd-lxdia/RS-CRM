import React, { useState, useEffect } from 'react';
import { Col, Row, Statistic, Table, List, Tag, Button, Progress, message } from 'antd';
import { PhoneOutlined, ArrowRightOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCampaigns, useRawLeads } from '../../api/queries';
import { FunnelChart, Funnel, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { DashboardCard } from '../../components/DashboardCard';
import { useSocketNotifications } from '../../hooks/useSocketNotifications';
import { io } from 'socket.io-client';

const statusColors: Record<string, string> = {
  DRAFT: 'default',
  SCHEDULED: 'purple',
  RUNNING: 'green',
  PAUSED: 'warning',
  COMPLETED: 'blue',
};

const COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c'];

const Dashboard: React.FC = () => {
  // Setup Socket for Campaign Progress
  const [liveCampaigns, setLiveCampaigns] = useState<any[]>([]);

  useEffect(() => {
    // In a real app this would connect to the authenticated socket
    const socket = io('http://localhost:3000', { autoConnect: false });
    // socket.connect();
    socket.on('CAMPAIGN_PROGRESS', (data: any) => {
      setLiveCampaigns(prev => {
        const idx = prev.findIndex(c => c.id === data.campaignId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], sent: data.sent, delivered: data.delivered };
          return updated;
        }
        return prev;
      });
    });
    return () => {
      socket.off('CAMPAIGN_PROGRESS');
      // socket.disconnect();
    };
  }, []);

  // Fetch campaigns
  const { data: campaignData, isLoading: campaignsLoading } = useCampaigns({ limit: 5 });
  const { data: activeCampaigns } = useCampaigns({ status: 'RUNNING', limit: 1 });
  
  // Sync live campaigns init
  useEffect(() => {
    if (campaignData?.campaigns) {
      setLiveCampaigns(campaignData.campaigns);
    }
  }, [campaignData]);

  // Fetch raw leads metrics
  const todayStart = dayjs().startOf('day').toISOString();
  const todayEnd = dayjs().endOf('day').toISOString();
  
  const { data: followUpsData, isLoading: followUpsLoading } = useRawLeads({ 
    followUpFrom: todayStart, 
    followUpTo: todayEnd,
    limit: 50 
  });
  
  const { data: totalLeadsData } = useRawLeads({ limit: 1 });
  const { data: convertedLeadsData } = useRawLeads({ status: 'CONVERTED', limit: 1 });
  
  const totalLeads = totalLeadsData?.total || 0;
  const convertedLeads = convertedLeadsData?.total || 0;
  // Mock 'Interested' and 'Follow-up' sizes for funnel
  const funnelData = [
    { value: totalLeads || 100, name: 'Total Contacted' },
    { value: Math.floor((totalLeads || 100) * 0.6), name: 'Interested' },
    { value: Math.floor((totalLeads || 100) * 0.4), name: 'Follow-up' },
    { value: convertedLeads || Math.floor((totalLeads || 100) * 0.1), name: 'Converted' }
  ];

  // Countdown clock to next follow-up
  const [nextFollowUp, setNextFollowUp] = useState<string>('--:--:--');
  useEffect(() => {
    const nextItem = followUpsData?.rawLeads?.find((l: any) => new Date(l.followUpAt) > new Date());
    if (!nextItem) return;
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(nextItem.followUpAt).getTime();
      const distance = target - now;
      if (distance < 0) {
        setNextFollowUp('Overdue!');
        clearInterval(interval);
      } else {
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setNextFollowUp(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [followUpsData]);

  const handleStartCall = (record: any) => {
    message.success(`Call started with ${record.name}. Call logged.`);
  };

  const followUpColumns = [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      key: 'name',
      render: (text: string) => <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate block max-w-[120px]" title={text}>{text}</span>
    },
    { 
      title: 'Phone', 
      dataIndex: 'phone', 
      key: 'phone',
      render: (text: string) => <span className="text-gray-500 dark:text-gray-400 text-sm tracking-wide font-mono">{text}</span>
    },
    { 
      title: 'Scheduled', 
      key: 'followUpAt', 
      render: (_: any, record: any) => <span className="text-gray-500 dark:text-gray-400 text-sm">{dayjs(record.followUpAt).format('HH:mm A')}</span> 
    },
    { 
      title: 'Action', 
      key: 'action', 
      render: (_: any, record: any) => (
        <div className="flex gap-2">
          <Button type="primary" size="small" icon={<PhoneOutlined />} onClick={() => handleStartCall(record)} className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black border-none shadow-sm transition-all font-medium rounded-md text-xs">
            Start Call
          </Button>
          <Button size="small" icon={<ArrowRightOutlined />} className="rounded-md text-xs">Convert</Button>
        </div>
      ) 
    },
  ];

  const overdueFollowUps = followUpsData?.rawLeads?.filter((l: any) => new Date(l.followUpAt) < new Date()).slice(0, 5) || [];

  return (
    <div className="flex flex-col gap-6 p-4">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <DashboardCard loading={followUpsLoading}>
            <Statistic title="Today's Follow-ups" value={followUpsData?.total || 0} valueStyle={{ color: '#cf1322' }} />
            <div className="mt-2 text-sm text-gray-500 font-mono">Next: {nextFollowUp}</div>
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <DashboardCard loading={campaignsLoading}>
            <Statistic title="Active Campaigns" value={activeCampaigns?.total || 0} valueStyle={{ color: '#3f8600' }} prefix={<MegaphoneIcon />} />
          </DashboardCard>
        </Col>
        <Col xs={24} sm={12} md={12}>
          <DashboardCard title="Conversion Funnel" loading={totalLeadsData === undefined}>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip />
                  <Funnel
                    dataKey="value"
                    data={funnelData}
                    isAnimationActive
                  >
                    <LabelList position="right" fill="#aaa" stroke="none" dataKey="name" />
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <DashboardCard title="Quick Dial: Overdue Follow-ups" empty={overdueFollowUps.length === 0} emptyMessage="No overdue follow-ups!">
            <Table 
              dataSource={overdueFollowUps} 
              columns={followUpColumns} 
              rowKey="id" 
              pagination={false} 
              loading={followUpsLoading} 
              size="middle"
            />
          </DashboardCard>

          <DashboardCard title="Today's Scheduled Follow-ups" className="mt-6" empty={followUpsData?.rawLeads?.length === 0}>
            <Table 
              dataSource={followUpsData?.rawLeads || []} 
              columns={followUpColumns} 
              rowKey="id" 
              pagination={{ pageSize: 5 }} 
              loading={followUpsLoading} 
              size="middle"
            />
          </DashboardCard>
        </Col>
        
        <Col xs={24} lg={8}>
          <DashboardCard title="Live Campaign Overview" extra={<SyncOutlined className="text-gray-400" />}>
            <List
              loading={campaignsLoading}
              itemLayout="horizontal"
              dataSource={liveCampaigns}
              renderItem={(item: any) => {
                const percent = item.target > 0 ? Math.round((item.sent / item.target) * 100) : 0;
                return (
                  <List.Item>
                    <div className="w-full">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold">{item.name}</span>
                        <Tag color={statusColors[item.status] || 'default'}>{item.status}</Tag>
                      </div>
                      <Progress percent={percent} size="small" />
                      <div className="text-xs text-gray-500 mt-1">
                        Sent: {item.sent} / {item.target || 0} | Delivered: {item.delivered}
                      </div>
                    </div>
                  </List.Item>
                );
              }}
            />
          </DashboardCard>
        </Col>
      </Row>
    </div>
  );
};

const MegaphoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'text-top' }}>
    <path d="M3 11l18-5v12L3 14v-3z"></path>
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path>
  </svg>
);

export default Dashboard;
