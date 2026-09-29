import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Statistic, Progress, Table, Tag, Button } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useCampaign, useUpdateCampaignStatus } from '../../api/queries';

const CampaignDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(id as string);
  const updateStatus = useUpdateCampaignStatus();

  if (isLoading) return <div>Loading...</div>;
  if (!campaign) return <div>Campaign not found</div>;

  const totalContacts = campaign.rawLeads?.length || campaign.totalContacts || 0;
  const sent = campaign.sent || 0;
  const delivered = campaign.delivered || 0;
  const opened = campaign.opened || 0;
  const failed = campaign.failed || 0;
  
  const completionPercent = totalContacts > 0 ? Math.round((sent / totalContacts) * 100) : 0;

  const handleStatusChange = (status: string) => {
    updateStatus.mutate({ id: campaign.id, status });
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Lead Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag>{s}</Tag> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/calling-staff/campaigns')} />
          <h2 className="text-2xl font-bold m-0">{campaign.name}</h2>
          <Tag color="cyan">{campaign.status}</Tag>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'PAUSED' || campaign.status === 'DRAFT' ? (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStatusChange('RUNNING')}>
              Start/Resume
            </Button>
          ) : campaign.status === 'RUNNING' ? (
            <Button danger icon={<PauseCircleOutlined />} onClick={() => handleStatusChange('PAUSED')}>
              Pause
            </Button>
          ) : null}
        </div>
      </div>

      <Card bordered={false} className="shadow-sm">
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="font-semibold text-gray-600">Campaign Progress</span>
            <span>{completionPercent}% sent</span>
          </div>
          <Progress percent={completionPercent} status={campaign.status === 'RUNNING' ? 'active' : 'normal'} />
        </div>

        <Row gutter={[16, 16]}>
          <Col span={4}><Statistic title="Total Contacts" value={totalContacts} /></Col>
          <Col span={4}><Statistic title="Sent" value={sent} valueStyle={{ color: '#1677ff' }} /></Col>
          <Col span={4}><Statistic title="Delivered" value={delivered} valueStyle={{ color: '#52c41a' }} /></Col>
          <Col span={4}><Statistic title="Opened" value={opened} valueStyle={{ color: '#722ed1' }} /></Col>
          <Col span={4}><Statistic title="Failed" value={failed} valueStyle={{ color: '#cf1322' }} /></Col>
        </Row>
      </Card>

      <Card title="Recipients list" bordered={false} className="shadow-sm">
        <Table 
          columns={columns} 
          dataSource={campaign.rawLeads || []} 
          rowKey="id" 
          pagination={{ pageSize: 15 }} 
        />
      </Card>
    </div>
  );
};

export default CampaignDetail;
