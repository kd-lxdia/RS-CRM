import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Input, Select, DatePicker, Button, Tag, Progress, Space, Spin } from 'antd';
import { Search, Filter, Download, Eye } from 'lucide-react';
import ChecklistDrawer from './ChecklistDrawer';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';

const { Option } = Select;
const { RangePicker } = DatePicker;

const MyCustomers: React.FC = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const { data: customerData = [], isLoading } = useQuery({
    queryKey: ['documentation-my-customers'],
    queryFn: async () => {
      const res = await backendApi.get('/documentation/my-customers');
      const raw: any[] = res.data.data ?? [];

      // Normalize raw Customer + docChecklist into the shape the table expects
      return raw.map((c: any) => {
        const dl = c.docChecklist;
        const schemes: string[] = [];
        if (dl) {
          schemes.push('PM Surya Ghar');
          if (dl.cmSchemeApplicable) schemes.push('CM Scheme');
          if (dl.loanApplicable) schemes.push('Loan');
          schemes.push('Net Metering');
        }

        const pct: number = c.completionPercentage ?? 0;
        const status =
          pct === 100 ? 'COMPLETE' : pct > 0 ? 'IN_PROGRESS' : 'OVERDUE';

        return {
          ...c,
          customerId: c.id,            // customer primary key
          schemes,
          assignedDate: c.createdAt
            ? new Date(c.createdAt).toLocaleDateString('en-IN')
            : '-',
          status,
        };
      });
    },
    refetchInterval: 30000,
  });

  const filteredData = useMemo(() => {
    let result = customerData;
    if (searchText) {
      result = result.filter((c: any) => c.name.toLowerCase().includes(searchText.toLowerCase()) || c.customerCode.toLowerCase().includes(searchText.toLowerCase()));
    }
    if (statusFilter !== 'ALL') {
      result = result.filter((c: any) => {
        if (statusFilter === 'COMPLETE') return c.completionPercentage === 100;
        if (statusFilter === 'IN_PROGRESS') return c.completionPercentage > 0 && c.completionPercentage < 100;
        if (statusFilter === 'OVERDUE') return c.completionPercentage < 100;
        return true;
      });
    }
    return result;
  }, [searchText, statusFilter, customerData]);

  const handleOpenDrawer = (record: any) => {
    setSelectedCustomer(record);
    setDrawerVisible(true);
  };

  const columns = [
    {
      title: 'Customer Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
      render: (text: string, record: any) => (
        <div>
          <div 
            className="font-semibold text-blue-600 cursor-pointer hover:underline" 
            onClick={() => navigate(`/customer/${record.customerId}`)}
          >
            {text}
          </div>
          <div className="text-xs text-apple-textMuted">{record.customerCode}</div>
        </div>
      ),
    },
    {
      title: 'Assigned Date',
      dataIndex: 'assignedDate',
      key: 'assignedDate',
      sorter: (a: any, b: any) => new Date(a.assignedDate).valueOf() - new Date(b.assignedDate).valueOf(),
    },
    {
      title: 'Applicable Schemes',
      key: 'schemes',
      dataIndex: 'schemes',
      render: (schemes: string[] | undefined) => (
        <Space size={[0, 4]} wrap>
          {(schemes ?? []).map(s => <Tag key={s} color="blue">{s}</Tag>)}
        </Space>
      ),
    },
    {
      title: 'Completion %',
      dataIndex: 'completionPercentage',
      key: 'completionPercentage',
      sorter: (a: any, b: any) => a.completionPercentage - b.completionPercentage,
      render: (val: number) => (
        <div className="w-32">
          <Progress percent={val} size="small" status={val === 100 ? 'success' : val < 30 ? 'exception' : 'active'} />
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      dataIndex: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'COMPLETE') color = 'success';
        if (status === 'IN_PROGRESS') color = 'processing';
        if (status === 'OVERDUE') color = 'error';
        return <Tag color={color}>{status}</Tag>;
      },
      filters: [
        { text: 'Complete', value: 'COMPLETE' },
        { text: 'In Progress', value: 'IN_PROGRESS' },
        { text: 'Overdue', value: 'OVERDUE' },
      ],
      onFilter: (value: any, record: any) => record.status === value,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button 
            size="small" 
            icon={<Eye size={14} />}
            onClick={() => navigate(`/customer/${record.customerId}`)}
          >
            View
          </Button>
          <Button 
            size="small" 
            type="primary" 
            ghost 
            onClick={() => handleOpenDrawer(record)}
          >
            Update
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 bg-transparent min-h-[calc(100vh-4rem)]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark dark:text-white tracking-tight">My Customers</h1>
        <Button icon={<Download size={16} />} type="default">Export List</Button>
      </div>

      {isLoading && customerData.length === 0 ? (
        <div className="p-10 flex justify-center"><Spin size="large" /></div>
      ) : null}

      <div className="apple-card">
        <div className="flex items-center text-apple-textMuted dark:text-apple-gray font-medium mr-2">
           <Filter size={18} className="mr-2" /> Filters
        </div>
        
        <Input 
          prefix={<Search size={16} className="text-apple-gray" />} 
          placeholder="Search by name or code..." 
          className="w-64"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
        
        <Select defaultValue="ALL" className="w-40" onChange={setStatusFilter}>
          <Option value="ALL">All Statuses</Option>
          <Option value="IN_PROGRESS">In Progress</Option>
          <Option value="COMPLETE">Complete</Option>
          <Option value="OVERDUE">Overdue</Option>
        </Select>

        <RangePicker className="w-64" />
      </div>

      <div className="apple-card">
        <Table 
          columns={columns} 
          dataSource={filteredData} 
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </div>

      <ChecklistDrawer 
        visible={drawerVisible} 
        onClose={() => setDrawerVisible(false)} 
        customer={selectedCustomer}
        onUpdate={(updatedData) => {
          setDrawerVisible(false);
        }}
      />
    </div>
  );
};

export default MyCustomers;
