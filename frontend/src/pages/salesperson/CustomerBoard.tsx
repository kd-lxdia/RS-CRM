import { useState } from 'react';
import { Table, Tag, Button, Input, Typography, Space, DatePicker, Select, message } from 'antd';
import { PhoneOutlined, EnvironmentOutlined, MailOutlined, CalendarOutlined, PlusOutlined, UploadOutlined, DownloadOutlined, FileTextOutlined, FileDoneOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';

const { Title } = Typography;
const { Search } = Input;
const { RangePicker } = DatePicker;

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  INACTIVE: 'red',
  PENDING: 'orange',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  PENDING: 'Pending',
};

interface Customer {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  status: string;
  createdAt?: string;
}

const DEMO_CUSTOMERS: Customer[] = [
  {
    id: "cus_1",
    customerCode: "CUS-001",
    name: "John Doe",
    phone: "+1 555-0100",
    email: "john.doe@example.com",
    city: "New York",
    address: "123 Solar Way",
    status: "ACTIVE",
    createdAt: "2026-03-15T10:00:00Z"
  },
  {
    id: "cus_2",
    customerCode: "CUS-002",
    name: "Jane Smith",
    phone: "+1 555-0101",
    email: "jane.smith@example.com",
    city: "Los Angeles",
    address: "456 Panel Ave",
    status: "PENDING",
    createdAt: "2026-04-10T14:30:00Z"
  },
  {
    id: "cus_3",
    customerCode: "CUS-003",
    name: "Acme Corp",
    phone: "+1 555-0102",
    email: "contact@acmecorp.com",
    city: "Chicago",
    address: "789 Enterprise Blvd",
    status: "ACTIVE",
    createdAt: "2026-01-20T09:15:00Z"
  }
];

export default function CustomerBoard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<string>();

  const filteredCustomers = DEMO_CUSTOMERS.filter((c: Customer) =>
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.customerCode.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!status || c.status === status)
  );

  const columns: ColumnsType<Customer> = [
    {
      title: 'Customer',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Customer) => (
        <div>
          <div className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => navigate('/customer/' + record.id)}>
            {name}
          </div>
          <div className="text-xs text-gray-500 font-mono mt-1">{record.customerCode}</div>
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record: Customer) => (
        <div className="flex flex-col gap-2 p-1 -ml-1">
          <a
            href={`tel:${record.phone}`}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 w-fit"
          >
            <PhoneOutlined className="text-gray-400" />
            {record.phone}
          </a>
          {record.email && (
            <a
              href={`mailto:${record.email}`}
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
      render: (_, record: Customer) => (
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
        { text: 'Active', value: 'ACTIVE' },
        { text: 'Pending', value: 'PENDING' },
        { text: 'Inactive', value: 'INACTIVE' },
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
      render: (_, record: Customer) => (
        <Space size="small">
          <Button type="text" size="small" icon={<FileTextOutlined />} className="text-blue-600" title="View Details" onClick={() => navigate('/customer/' + record.id)} />
          <Button type="text" size="small" icon={<FileDoneOutlined />} className="text-purple-600" title="Solar Studio" onClick={() => navigate('/studio')} />
          <Button type="text" size="small" icon={<EnvironmentOutlined />} className="text-orange-600" title="Schedule Visit" onClick={() => message.info('Scheduling visit for ' + record.name)} />
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Title level={4} className="!mb-0">My Customers</Title>
        
        <div className="flex flex-wrap gap-2">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('Add Customer logic here')}>
            Add Customer
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => message.info('Upload Customers logic here')}>
            Upload Excel
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => message.info('Export Customers logic here')}>
            Export Data
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm">
        <Search
          placeholder="Search customers..."
          allowClear
          onChange={e => setSearchTerm(e.target.value)}
          className="max-w-xs"
        />
        <RangePicker />
        <Select allowClear placeholder="Select Status" onChange={(val) => setStatus(val)} className="min-w-[150px]">
          <Select.Option value="ACTIVE">Active</Select.Option>
          <Select.Option value="PENDING">Pending</Select.Option>
          <Select.Option value="INACTIVE">Inactive</Select.Option>
        </Select>
      </div>

      <Table
        columns={columns}
        dataSource={filteredCustomers}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => 'Total ' + total + ' customers',
          pageSizeOptions: ['10', '20', '50', '100'],
        }}
        className="bg-white rounded-lg shadow-sm"
      />
    </div>
  );
}
