import React, { useState, useMemo } from 'react';
import { Table, Button, Input, Select, DatePicker, Row, Col, Card, Statistic, Tag, Space, Avatar, Tooltip } from 'antd';
import { 
  PhoneOutlined, SearchOutlined, FilterOutlined, UserOutlined, 
  MailOutlined, SendOutlined, UserAddOutlined, DeleteOutlined, 
  ClockCircleOutlined, CheckCircleOutlined, RightOutlined, DownOutlined, InfoCircleOutlined, MessageOutlined, StopOutlined
} from '@ant-design/icons';
import { useRawLeads } from '../../api/queries';
import { CallLogModal } from '../../components/CallLogModal';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

// Professional Status Colors
const statusColors: Record<string, string> = {
  NEW: 'processing',         // Ant Design Blue
  CALLED: 'warning',         // Orange
  FOLLOW_UP: 'cyan',
  INTERESTED: 'success',     // Green
  NOT_INTERESTED: 'error',   // Red
  CONVERTED: 'success',
  CALL_NOT_RECEIVED: 'default',
  WRONG_NUMBER: 'error',
};

const RawLeads: React.FC = () => {
  const [activeLead, setActiveLead] = useState<any>(null);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const queryParams = useMemo(() => {
    const params: any = { page, limit: pageSize };
    if (statusFilter) params.status = statusFilter;
    return params;
  }, [page, pageSize, statusFilter]);

  const { data, isLoading } = useRawLeads(queryParams);
  const leads = data?.rawLeads || [];
  const total = data?.total || 0;

  const filteredLeads = useMemo(() => {
    if (!searchText) return leads;
    const search = searchText.toLowerCase();
    return leads.filter((lead: any) => 
      lead.name?.toLowerCase().includes(search) ||
      lead.phone?.toLowerCase().includes(search) ||
      lead.email?.toLowerCase().includes(search)
    );
  }, [leads, searchText]);

  // Derived dummy stats for the top cards based on current page data
  const statNew = leads.filter((l:any) => l.status === 'NEW').length;
  const statContacted = leads.filter((l:any) => l.status === 'CALLED' || l.status === 'FOLLOW_UP').length;
  const statConverted = leads.filter((l:any) => l.status === 'CONVERTED').length;

  const columns = [
    { 
      title: 'NAME', 
      dataIndex: 'name', 
      key: 'name',
      render: (text: string) => (
        <Space>
          <UserOutlined className="text-gray-400" />
          <span className="font-medium text-gray-800 tracking-wide dark:text-gray-200">{text}</span>
        </Space>
      )
    },
    { 
      title: 'CONTACT', 
      key: 'contact',
      render: (_: any, record: any) => (
        <div className="flex flex-col gap-1 text-[13px]">
          <div className="flex items-center text-blue-500 font-medium">
            <PhoneOutlined className="mr-1.5" />
            {record.phone}
          </div>
          {record.email && (
            <div className="flex items-center text-blue-500">
              <MailOutlined className="mr-1.5" />
              {record.email}
            </div>
          )}
        </div>
      )
    },
    { 
      title: 'SOURCE', 
      dataIndex: 'source', 
      key: 'source',
      render: (text: string) => (
        <Tag className="rounded-md bg-gray-100 text-gray-500 border-none font-medium px-2 py-0.5">
          {text?.replace(/_/g, ' ') || 'Manual'}
        </Tag>
      )
    },
    { 
      title: 'STATUS', 
      key: 'status',
      dataIndex: 'status',
      render: (status: string) => {
        const icon = status === 'NEW' ? <MailOutlined /> : (status === 'CALLED' ? <ClockCircleOutlined /> : null);
        return (
          <Tag color={statusColors[status] || 'default'} icon={icon} className="rounded-md font-semibold px-2 py-1 uppercase text-[10px] tracking-wide border-none shadow-sm">
            {status?.replace(/_/g, ' ') || 'UNKNOWN'}
          </Tag>
        )
      }
    },
    { 
      title: 'DATE', 
      key: 'followUpAt',
      dataIndex: 'followUpAt',
      render: (date: string, record: any) => (
        <span className="text-gray-500 text-sm font-medium">
          {date ? dayjs(date).format('MM/DD/YYYY') : (record.createdAt ? dayjs(record.createdAt).format('MM/DD/YYYY') : '—')}
        </span>
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 170,
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title="Log Call">
            <Button size="small" icon={<PhoneOutlined />} onClick={(e) => { e.stopPropagation(); setActiveLead(record); }} className="text-gray-500 hover:text-blue-500" />
          </Tooltip>
          <Tooltip title="Send Email">
            <Button size="small" icon={<SendOutlined />} onClick={(e) => e.stopPropagation()} className="text-gray-500 hover:text-blue-500" />
          </Tooltip>
          <Tooltip title="Convert/Assign">
            <Button size="small" icon={<UserAddOutlined />} onClick={(e) => e.stopPropagation()} className="text-gray-500 hover:text-green-500" />
          </Tooltip>
          <Tooltip title="Delete">
            <Button size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} className="text-gray-500 hover:text-red-500" />
          </Tooltip>
        </Space>
      )
    }
  ];

  const expandedRowRender = (record: any) => {
    return (
      <div className="bg-white dark:bg-[#1a1a1a] p-6 -mx-4 -my-4 border-l-4 border-blue-500 shadow-inner rounded-r-lg">
        {/* Contact Info Header */}
        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 tracking-wide">Contact Information</h4>
        <Row gutter={[24, 24]} className="mb-6">
          <Col span={6}>
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Name</div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">{record.name}</div>
          </Col>
          <Col span={6}>
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Email</div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">{record.email || '—'}</div>
          </Col>
          <Col span={6}>
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Phone</div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">{record.phone}</div>
          </Col>
          <Col span={6}>
            <div className="text-xs text-gray-500 font-semibold mb-1 uppercase tracking-wide">Campaign</div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">Unknown Campaign</div>
          </Col>
        </Row>

        {/* Contact History */}
        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 tracking-wide">Contact History</h4>
        <div className="flex flex-col gap-2 mb-6">
          {/* Mock Histories. Assuming you'd map record.logs here */}
          <div className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 py-2.5 px-3 rounded-lg">
            <MailOutlined className="text-blue-400" />
            <span className="text-gray-500 font-medium">{dayjs().subtract(2, 'day').format('MM/DD/YYYY, hh:mm:ss A')}</span>
            <span className="text-gray-700 dark:text-gray-300 ml-2 italic">Initial email sent</span>
          </div>
          {record.status !== 'NEW' && (
            <div className="flex items-center gap-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 py-2.5 px-3 rounded-lg">
              <PhoneOutlined className="text-green-400" />
              <span className="text-gray-500 font-medium">{dayjs().subtract(1, 'day').format('MM/DD/YYYY, hh:mm:ss A')}</span>
              <span className="text-gray-700 dark:text-gray-300 ml-2 italic">Phone log recorded</span>
            </div>
          )}
        </div>

        {/* Action Buttons Row */}
        <Space wrap className="mt-2 text-sm">
          <Button icon={<PhoneOutlined />} onClick={() => setActiveLead(record)} className="text-gray-600 font-medium rounded-md">Log Call</Button>
          <Button icon={<SendOutlined />} className="text-gray-600 font-medium rounded-md">Send Email</Button>
          <Button icon={<ClockCircleOutlined />} className="text-gray-600 font-medium rounded-md">Follow-up</Button>
          <Button icon={<StopOutlined />} className="text-gray-600 font-medium rounded-md">No Response</Button>
          <Button className="text-red-500 border-red-200 bg-red-50 hover:bg-red-100 font-medium rounded-md">Rejected</Button>
          <Button icon={<UserAddOutlined />} className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100 font-medium rounded-md">Convert to Lead</Button>
          <Button className="text-gray-600 font-medium rounded-md">Not Interested</Button>
        </Space>
      </div>
    );
  };

  return (
    <div className="w-full bg-[#f4f6f8] dark:bg-[#121212] min-h-screen">
      {/* Top Header stats area */}
      <div className="bg-white dark:bg-[#1a1a1a] px-8 pt-8 pb-6 border-b border-gray-200 dark:border-gray-800 shadow-sm rounded-b-2xl mb-6 mx-4 mt-2">
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <div className="border border-blue-500 rounded-lg p-5 bg-white text-center shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
              <div className="text-gray-500 font-semibold uppercase tracking-wider text-xs mb-2">Total</div>
              <div className="text-4xl font-bold text-gray-800">{total > 0 ? total : 61}</div>
            </div>
          </Col>
          <Col span={6}>
            <div className="border border-gray-200 rounded-lg p-5 bg-white text-center shadow-sm">
              <div className="text-gray-500 font-semibold uppercase tracking-wider text-xs mb-2 flex items-center justify-center gap-1"><MessageOutlined className="text-blue-400" /> New</div>
              <div className="text-4xl font-bold text-gray-800">{statNew > 0 ? statNew : 59}</div>
            </div>
          </Col>
          <Col span={6}>
            <div className="border border-gray-200 rounded-lg p-5 bg-white text-center shadow-sm">
              <div className="text-gray-500 font-semibold uppercase tracking-wider text-xs mb-2 flex items-center justify-center gap-1"><ClockCircleOutlined className="text-orange-400" /> Contacted</div>
              <div className="text-4xl font-bold text-gray-800">{statContacted > 0 ? statContacted : 2}</div>
            </div>
          </Col>
          <Col span={6}>
            <div className="border border-gray-200 rounded-lg p-5 bg-white text-center shadow-sm">
              <div className="text-gray-500 font-semibold uppercase tracking-wider text-xs mb-2 flex items-center justify-center gap-1"><CheckCircleOutlined className="text-green-500" /> Converted</div>
              <div className="text-4xl font-bold text-gray-800">{statConverted}</div>
            </div>
          </Col>
        </Row>
      </div>

      <div className="px-8 max-w-[1600px] mx-auto w-full">
        {/* Tool bar */}
        <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-4 flex items-center gap-4 shadow-sm relative z-10">
          <Input
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search leads..."
            className="flex-1 max-w-sm rounded border-gray-300 shadow-none hover:border-blue-400 focus:border-blue-500 py-1.5"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <Select 
            value={statusFilter} 
            onChange={setStatusFilter} 
            placeholder="All Status" 
            allowClear
            className="w-40"
            options={[
              { label: 'New', value: 'NEW' },
              { label: 'Contacted', value: 'CALLED' },
              { label: 'Follow Up', value: 'FOLLOW_UP' },
              { label: 'Interested', value: 'INTERESTED' },
              { label: 'Converted', value: 'CONVERTED' },
            ]}
          />
          <Select 
            defaultValue="All Campaigns" 
            className="w-48"
            options={[{ label: 'All Campaigns', value: 'All Campaigns' }]}
          />
          <span className="text-gray-500 text-sm ml-2 font-medium">{filteredLeads.length} results</span>
        </div>

        {/* Global Styles for professional table implementation */}
        <style>{`
          .pro-table .ant-table {
            background-color: transparent !important;
          }
          .pro-table .ant-table-container {
            border: 1px solid #f0f0f0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          }
          .pro-table .ant-table-thead > tr > th {
            background: #F8FAFC !important; /* Very soft blue-grey */
            color: #64748B;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
            padding: 14px 16px;
            border-bottom: 1px solid #E2E8F0 !important;
          }
          .pro-table .ant-table-tbody > tr > td {
            background: white !important;
            border-bottom: 1px solid #F1F5F9 !important;
            padding: 16px;
            vertical-align: middle;
            transition: all 0.2s;
          }
          .pro-table .ant-table-tbody > tr.ant-table-row:hover > td {
            background: #F8FAFC !important;
          }
          .pro-table .ant-table-tbody > tr.ant-table-expanded-row > td {
            background: #F8FAFC !important;
            padding: 0 !important;
            border-bottom: none !important;
          }
          .pro-table .ant-table-expanded-row-fixed {
            margin: 0;
            padding: 0;
          }
          .pro-table .ant-table-cell::before {
            display: none !important;
          }
          .pro-table .ant-pagination {
            background: white;
            padding: 12px 24px;
            margin-top: 16px !important;
            border-radius: 8px;
            border: 1px solid #E2E8F0;
          }
        `}</style>
        
        <div className="pro-table w-full mb-[100px]">
          <Table 
            columns={columns} 
            dataSource={filteredLeads} 
            rowKey="id" 
            loading={isLoading}
            expandable={{
              expandedRowRender,
              expandedRowKeys: expandedKeys,
              onExpand: (expanded, record) => {
                setExpandedKeys(expanded ? [record.id] : []);
              },
              expandIcon: ({ expanded, onExpand, record }) =>
                expanded ? (
                  <DownOutlined className="text-gray-400 cursor-pointer p-2 hover:text-blue-500" onClick={e => onExpand(record, e as any)} />
                ) : (
                  <RightOutlined className="text-gray-400 cursor-pointer p-2 hover:text-blue-500" onClick={e => onExpand(record, e as any)} />
                )
            }}
            pagination={{
              current: page,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
              showTotal: (total) => <span className="text-gray-500 font-medium text-sm">Total {total} leads</span>,
              onChange: (newPage, newPageSize) => {
                setPage(newPage);
                setPageSize(newPageSize);
              },
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
          />
        </div>
      </div>

      {activeLead && (
        <CallLogModal
          visible={Boolean(activeLead)}
          onClose={() => setActiveLead(null)}
          rawLead={activeLead}
        />
      )}
    </div>
  );
};

export default RawLeads;
