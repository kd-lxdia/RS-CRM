import React, { useState } from 'react';
import { Card, Table, Tag, DatePicker, Select, Input } from 'antd';
import { Search, Filter, ArrowUpRight, ArrowDownRight, RefreshCcw } from 'lucide-react';

const { RangePicker } = DatePicker;
const { Option } = Select;

// Mock History
const mockHistory = [
  { id: 'TX-1001', date: '2026-03-22 09:30 AM', item: 'Trina Solar 540W', sku: 'TS-540', type: 'IN', qty: 200, ref: 'INV-44122', user: 'Rahul W.' },
  { id: 'TX-1002', date: '2026-03-22 10:45 AM', item: 'Trina Solar 540W', sku: 'TS-540', type: 'OUT', qty: 15, ref: 'DISPATCH-CUST-8815', user: 'Rahul W.' },
  { id: 'TX-1003', date: '2026-03-21 04:20 PM', item: 'Growatt MIN 5000', sku: 'GW-5K', type: 'OUT', qty: 2, ref: 'DISPATCH-CUST-8812', user: 'Amit S.' },
  { id: 'TX-1004', date: '2026-03-21 02:00 PM', item: '4mm DC Cable', sku: 'DC-4MM', type: 'ADJUSTMENT', qty: -10, ref: 'AUDIT-01', user: 'Warehouse Admin' },
  { id: 'TX-1005', date: '2026-03-20 11:15 AM', item: 'MC4 Connectors', sku: 'MC4-1', type: 'IN', qty: 500, ref: 'INV-44120', user: 'Rahul W.' },
];

const StockHistory: React.FC = () => {
  const [searchText, setSearchText] = useState('');

  const columns = [
    { title: 'TX ID', dataIndex: 'id', key: 'id', render: (t: string) => <span className="font-mono text-xs text-apple-gray">{t}</span> },
    { title: 'Date/Time', dataIndex: 'date', key: 'date', width: 160 },
    { 
      title: 'Item', 
      key: 'item',
      render: (_: unknown, r: any) => (
        <div>
          <div className="font-medium text-apple-textLight dark:text-apple-textDark">{r.item}</div>
          <div className="text-xs font-mono text-apple-gray">{r.sku}</div>
        </div>
      )
    },
    { 
      title: 'Type', 
      dataIndex: 'type', 
      key: 'type',
      render: (t: string) => {
        if (t === 'IN') return <Tag color="success" icon={<ArrowDownRight size={12} className="mr-1 inline"/>}>Stock IN</Tag>;
        if (t === 'OUT') return <Tag color="error" icon={<ArrowUpRight size={12} className="mr-1 inline"/>}>Stock OUT</Tag>;
        return <Tag color="warning" icon={<RefreshCcw size={12} className="mr-1 inline"/>}>Adj</Tag>;
      }
    },
    { 
      title: 'Qty Delta', 
      key: 'qty',
      render: (_: unknown, r: any) => (
        <span className={`font-bold ${r.type === 'IN' || (r.type === 'ADJUSTMENT' && r.qty > 0) ? 'text-green-600' : 'text-red-500'}`}>
          {r.qty > 0 ? '+' : ''}{r.qty}
        </span>
      )
    },
    { title: 'Reference', dataIndex: 'ref', key: 'ref', render: (t: string) => <span className="text-blue-500 cursor-pointer">{t}</span> },
    { title: 'Performed By', dataIndex: 'user', key: 'user' },
  ];

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark mb-6">Stock Transaction History</h1>

      <Card className="shadow-sm rounded-lg" bodyStyle={{ padding: '16px 24px' }}>
        <div className="flex flex-wrap gap-4 mb-6 pt-2">
           <Input 
             placeholder="Search Item, SKU, Ref..." 
             prefix={<Search size={16} className="text-apple-gray"/>} 
             value={searchText}
             onChange={e => setSearchText(e.target.value)}
             style={{ width: 250 }}
           />
           <RangePicker />
           <Select defaultValue="ALL" style={{ width: 150 }}>
             <Option value="ALL"><Filter size={14} className="inline mr-2 align-middle text-apple-gray"/>All Types</Option>
             <Option value="IN">Stock IN</Option>
             <Option value="OUT">Stock OUT</Option>
             <Option value="ADJUSTMENT">Adjustment</Option>
           </Select>
        </div>

        <Table 
          columns={columns} 
          dataSource={mockHistory} 
          rowKey="id"
          pagination={{ pageSize: 15 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default StockHistory;
