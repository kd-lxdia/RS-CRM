import React, { useState } from 'react';
import { Card, Table, Tag, DatePicker, Select, Input, Button, Row, Col } from 'antd';
import { Search, Download, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import CustomerLink from '../../components/CustomerLink';

const { RangePicker } = DatePicker;
const { Option } = Select;

const mockPayments = [
  { id: 'PAY-10041', date: '2026-03-22', customer: 'Anjali Desai', amount: 35000, milestone: 'FIRST_INSTALLMENT', mode: 'NEFT', ref: 'UTRIB5109281' },
  { id: 'PAY-10042', date: '2026-03-22', customer: 'Rajesh Kumar', amount: 150000, milestone: 'BOOKING', mode: 'UPI', ref: 'ICICI412999' },
  { id: 'PAY-10043', date: '2026-03-21', customer: 'Neha Patel', amount: 80000, milestone: 'SECOND_INSTALLMENT', mode: 'CASH', ref: 'REC-551' },
  { id: 'PAY-10044', date: '2026-03-20', customer: 'Vikram Singh', amount: 50000, milestone: 'FINAL', mode: 'CHEQUE', ref: 'CHQ-100882' },
];

const PaymentHistory: React.FC = () => {
  const [searchText, setSearchText] = useState('');

  const handleExport = async () => {
    const response = await api.get('/payments/export', { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payments_export.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const columns = [
    { title: 'Receipt ID', dataIndex: 'id', key: 'id', render: (t: string) => <span className="font-mono text-xs text-blue-600 font-bold">{t}</span> },
    { title: 'Date', dataIndex: 'date', key: 'date' },
    { title: 'Customer', dataIndex: 'customer', key: 'customer', render: (t: string, r: any) => <CustomerLink name={t} customerId={r.id} /> },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (val: number) => <span className="font-bold text-apple-textLight dark:text-apple-textDark">₹{val.toLocaleString()}</span> },
    { 
      title: 'Milestone', 
      dataIndex: 'milestone', 
      key: 'milestone',
      render: (t: string) => {
         const color = t === 'BOOKING' ? 'blue' : t === 'FINAL' ? 'success' : 'processing';
         return <Tag color={color}>{t.replace('_', ' ')}</Tag>;
      }
    },
    { title: 'Mode', dataIndex: 'mode', key: 'mode' },
    { title: 'Reference', dataIndex: 'ref', key: 'ref', render: (t: string) => <span className="text-apple-textMuted text-xs font-mono">{t}</span> },
    { 
      title: 'Receipt', 
      key: 'receipt',
      render: () => <Button size="small" type="text" className="text-emerald-600" icon={<FileText size={14} />} />
    }
  ];

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark">Payment History</h1>
        <Button 
          type="primary" 
          icon={<Download size={16} />} 
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={handleExport}
        >
          Export CSV Ledger
        </Button>
      </div>

      <Card className="shadow-sm rounded-lg" bodyStyle={{ padding: '20px 24px' }}>
        <div className="bg-slate-100/50 p-4 border border-transparent rounded-lg mb-6">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <label className="block text-xs font-semibold text-apple-textMuted mb-1 leading-none uppercase tracking-wider">Search</label>
              <Input 
                placeholder="Customer Name, Receipt ID..." 
                prefix={<Search size={16} className="text-apple-gray"/>} 
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </Col>
            <Col xs={24} md={6}>
              <label className="block text-xs font-semibold text-apple-textMuted mb-1 leading-none uppercase tracking-wider">Date Range</label>
              <RangePicker className="w-full" />
            </Col>
            <Col xs={24} md={6}>
              <label className="block text-xs font-semibold text-apple-textMuted mb-1 leading-none uppercase tracking-wider">Milestone</label>
              <Select defaultValue="ALL" className="w-full">
                <Option value="ALL">All Milestones</Option>
                <Option value="BOOKING">Booking</Option>
                <Option value="FIRST_INSTALLMENT">First Installment</Option>
                <Option value="FINAL">Final</Option>
              </Select>
            </Col>
            <Col xs={24} md={6}>
              <label className="block text-xs font-semibold text-apple-textMuted mb-1 leading-none uppercase tracking-wider">Payment Mode</label>
              <Select defaultValue="ALL" className="w-full">
                <Option value="ALL">All Modes</Option>
                <Option value="NEFT">NEFT / RTGS</Option>
                <Option value="UPI">UPI</Option>
                <Option value="CASH">Cash</Option>
                <Option value="CHEQUE">Cheque</Option>
              </Select>
            </Col>
          </Row>
        </div>

        <Table 
          columns={columns} 
          dataSource={mockPayments} 
          rowKey="id"
          pagination={{ pageSize: 20 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default PaymentHistory;
