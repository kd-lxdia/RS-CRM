import { useState } from 'react';
import { Table, Tag, Button, Input, Typography, Space, DatePicker, Select, Dropdown, MenuProps, message } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api as backendApi } from '../../lib/api';
import { PhoneOutlined, EnvironmentOutlined, EyeOutlined, BulbOutlined, PlusOutlined, UploadOutlined, DownloadOutlined, MailOutlined, CloseCircleOutlined, SwapOutlined, EditOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { AddLeadModal } from '../../components/AddLeadModal';
import { UploadLeadsModal } from '../../components/UploadLeadsModal';
import { LogInteractionModal } from '../../components/LogInteractionModal';
import { ScheduleVisitModal } from '../../components/ScheduleVisitModal';

const { Title } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;

const STATUS_COLORS: Record<string, string> = {
  NEW: 'default',
  FOLLOW_UP: 'blue',
  VISIT_SCHEDULED: 'orange',
  PROPOSAL_SENT: 'purple',
  NEGOTIATION: 'magenta',
  WON: 'green',
  LOST: 'red',
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  FOLLOW_UP: 'Follow Up',
  VISIT_SCHEDULED: 'Visit Scheduled',
  PROPOSAL_SENT: 'Proposal Sent',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

interface Lead {
  id: string;
  leadCode: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  status: string;
  createdAt?: string;
}

export default function LeadsBoard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isUploadModalVisible, setUploadModalVisible] = useState(false);

  const [interactionLead, setInteractionLead] = useState<Lead | null>(null);
  const [salesVisitLead, setSalesVisitLead] = useState<Lead | null>(null);

  const [dateRange, setDateRange] = useState<any>(null);
  const [zoneId, setZoneId] = useState<string>();
  const [assignedSalesperson, setAssignedSalesperson] = useState<string>();
  const [status, setStatus] = useState<string>();

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['sales-leads', dateRange, zoneId, assignedSalesperson, status],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (dateRange && dateRange[0]) params.dateFrom = dateRange[0].toISOString();
      if (dateRange && dateRange[1]) params.dateTo = dateRange[1].toISOString();
      if (zoneId) params.zoneId = zoneId;
      if (assignedSalesperson) params.assignedSalesperson = assignedSalesperson;
      if (status) params.status = status
      if (assignedSalesperson) params.assignedSalesperson = assignedSalesperson;
      if (status) params.status = status;
      
      const res = await backendApi.get('/leads', { params });
      
      const demoCustomers: Lead[] = [
        {
          id: 'demo-1',
          leadCode: 'LD-1001',
          name: 'Acme Corp',
          phone: '(555) 123-4567',
          email: 'contact@acmecorp.com',
          city: 'New York',
          address: '123 Business Rd.',
          status: 'NEW',
          createdAt: new Date().toISOString()
        },
        {
          id: 'demo-2',
          leadCode: 'LD-1002',
          name: 'Stark Industries',
          phone: '(555) 987-6543',
          email: 'stark@industries.com',
          city: 'Los Angeles',
          address: 'Avengers Tower',
          status: 'WON',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 'demo-3',
          leadCode: 'LD-1003',
          name: 'Wayne Enterprises',
          phone: '(555) 555-0199',
          email: 'info@wayne.com',
          city: 'Gotham',
          address: '1007 Mountain Drive',
          status: 'FOLLOW_UP',
          createdAt: new Date(Date.now() - 2*86400000).toISOString()
        }
      ];

      const apiLeads = res.data.data?.leads || [];
      return [...demoCustomers, ...apiLeads];
    }
  });

  const leads = (leadsData && leadsData.length > 0) ? leadsData : [];

  const filteredLeads = leads.filter((l: Lead) =>
    l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.phone.includes(searchTerm) ||
    l.leadCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = async () => {
    try {
      const params: any = {};
      if (dateRange && dateRange[0]) params.dateFrom = dateRange[0].toISOString();
      if (dateRange && dateRange[1]) params.dateTo = dateRange[1].toISOString();
      if (zoneId) params.zoneId = zoneId;
      if (assignedSalesperson) params.assignedSalesperson = assignedSalesperson;
      if (status) params.status = status;
      
      const queryParams = new URLSearchParams(params).toString();
      window.open('/api/leads/export/csv?' + queryParams, '_blank');
    } catch(err) { console.error(err); }
  };

  const initiateInteraction = (record: Lead) => {
    setTimeout(() => {
      setInteractionLead(record);
    }, 100);
  };

  const handleQuickAction = (key: string, record: Lead) => {
    if (key === 'sales_visit') {
      setSalesVisitLead(record);
    } else if (['follow_up', 'not_interested', 'lead_lost'].includes(key)) {
      setInteractionLead(record);
    } else {
      message.success(`Action "${key.replace('_', ' ')}" selected for ${record.name}`);
    }
  };

  const getQuickActionMenu = (record: Lead): MenuProps => ({
    onClick: ({ key }) => handleQuickAction(key, record),
    items: [
      { key: 'follow_up', label: 'Follow Up', icon: <PhoneOutlined /> },
      { key: 'sales_visit', label: 'Sales Visit', icon: <EnvironmentOutlined /> },
      { key: 'not_interested', label: 'Not Interested', icon: <CloseCircleOutlined /> },
    ],
  });

  const columns: ColumnsType<Lead> = [
    {
      title: 'Customer',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Lead) => (
        <div>
          <div className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => navigate('/salesperson/leads/' + record.id)}>
            {name}
          </div>
          <div className="text-xs text-gray-500 font-mono mt-1">{record.leadCode}</div>
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record: Lead) => (
        <div className="flex flex-col gap-2 p-1 -ml-1">
          <a
            href={`tel:${record.phone}`}
            onClick={() => initiateInteraction(record)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 w-fit"
          >
            <PhoneOutlined className="text-gray-400" />
            {record.phone}
          </a>
          {record.email && (
            <a
              href={`mailto:${record.email}`}
              onClick={() => initiateInteraction(record)}
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 w-fit mt-1"
            >
              <MailOutlined className="text-gray-400" />
              {record.email}
            </a>
          )}
        </div>
      ),
    },
    {
      title: 'Address',
      key: 'address',
      render: (_, record: Lead) => (
        <div className="flex items-start gap-1 text-sm text-gray-600">
          <EnvironmentOutlined className="text-gray-400 mt-1" />
          <span className="line-clamp-2">{record.address || record.city || '-'}</span>
        </div>
      ),
    },
    {
      title: 'Created Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date?: string) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <CalendarOutlined className="text-gray-400" />
          {date ? new Date(date).toLocaleDateString() : '-'}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'New', value: 'NEW' },
        { text: 'Follow Up', value: 'FOLLOW_UP' },
        { text: 'Visit Scheduled', value: 'VISIT_SCHEDULED' },
        { text: 'Proposal Sent', value: 'PROPOSAL_SENT' },
        { text: 'Negotiation', value: 'NEGOTIATION' },
        { text: 'Won', value: 'WON' },
        { text: 'Lost', value: 'LOST' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Lead) => (
        <Space size="small">
          <Button type="text" size="small" icon={<CloseCircleOutlined />} danger title="Lead Lost" onClick={() => handleQuickAction('lead_lost', record)} />
          <Button type="text" size="small" icon={<PhoneOutlined />} className="text-blue-600" title="Follow Up" onClick={() => handleQuickAction('follow_up', record)} />
          <Button type="text" size="small" icon={<EnvironmentOutlined />} className="text-orange-600" title="Sales Visit" onClick={() => handleQuickAction('sales_visit', record)} />
          <Button type="text" size="small" icon={<SwapOutlined />} className="text-gray-600" title="Reassign" onClick={() => handleQuickAction('reassign', record)} />
          <Button type="text" size="small" icon={<EditOutlined />} className="text-gray-600" title="Edit" onClick={() => handleQuickAction('edit', record)} />
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Title level={3} className="!mb-1">Customer Leads</Title>
          <p className="text-gray-500">Manage and track your customer pipeline.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Button type="primary" size="large" className="bg-blue-600 shadow-md hover:bg-blue-700" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
            Add Customer
          </Button>
          <Button size="large" icon={<UploadOutlined />} onClick={() => setUploadModalVisible(true)}>
            Import Excel
          </Button>
          <Button size="large" icon={<DownloadOutlined />} onClick={handleExport}>
            Export CSV
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <Search
          size="large"
          placeholder="Search by name, code or city"
          allowClear
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <RangePicker size="large" onChange={(dates) => setDateRange(dates)} className="w-full md:w-auto" />
        <Select size="large" allowClear placeholder="Filter by Status" onChange={(val) => setStatus(val)} className="w-full md:w-[180px]">
          <Select.Option value="NEW">New Lead</Select.Option>
          <Select.Option value="CONTACTED">Contacted</Select.Option>
          <Select.Option value="QUALIFIED">Qualified</Select.Option>
          <Select.Option value="PROPOSAL">Proposal</Select.Option>
          <Select.Option value="WON">Won</Select.Option>
          <Select.Option value="LOST">Lost</Select.Option>
          <Select.Option value="ON_HOLD">On Hold</Select.Option>
        </Select>
        <Select allowClear placeholder="Select Zone" onChange={(val) => setZoneId(val)} className="min-w-[150px]">
          {/* Options will be populated from API */}
        </Select>
        <Select allowClear placeholder="Salesperson" onChange={(val) => setAssignedSalesperson(val)} className="min-w-[150px]">
          {/* Options will be populated from API */}
        </Select>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <Table
          columns={columns}
          dataSource={filteredLeads}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Showing ${total} customers`,
            pageSizeOptions: ['10', '20', '50', '100'],
            className: "!px-6 !py-4 !m-0 border-t border-gray-100 bg-gray-50/50"
          }}
          className="custom-leads-table"
        />
      </div>
      
      <AddLeadModal 
        visible={isAddModalVisible} 
        onClose={() => setAddModalVisible(false)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sales-leads'] })}
      />
      
      <UploadLeadsModal 
        visible={isUploadModalVisible} 
        onClose={() => setUploadModalVisible(false)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sales-leads'] })}
      />

      <LogInteractionModal 
        visible={!!interactionLead} 
        lead={interactionLead}
        onClose={() => setInteractionLead(null)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sales-leads'] })}
      />

      <ScheduleVisitModal 
        visible={!!salesVisitLead} 
        lead={salesVisitLead}
        onClose={() => setSalesVisitLead(null)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sales-leads'] })}
      />    </div>
  );
}