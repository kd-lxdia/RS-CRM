import React, { useState } from 'react';
import { Card, Table, Tag, Input, Select, Button, DatePicker } from 'antd';
import { Search, Download, ShieldCheck, User, Settings, Lock } from 'lucide-react';

const { RangePicker } = DatePicker;

// Generic Audit Tracking Rows
const mockAudit = [
  { id: 'LOG-419992', ts: '2026-03-22 11:30:10', actor: 'Admin Master', action: 'DEACTIVATE_USER', target: 'suresh.m@lohia.com', ip: '102.45.11.2' },
  { id: 'LOG-419991', ts: '2026-03-22 11:15:05', actor: 'System CRON', action: 'SLA_ESCALATE_CRITICAL', target: 'CUST-8007', ip: 'Localhost' },
  { id: 'LOG-419990', ts: '2026-03-22 10:45:00', actor: 'Vikram Singh', action: 'MARK_COMPLETED', target: 'CUST-8006 (Installation)', ip: '192.168.1.10' },
  { id: 'LOG-419989', ts: '2026-03-21 16:20:11', actor: 'Admin Master', action: 'MODIFY_CONFIG', target: 'Subsidy Parameters', ip: '102.45.11.2' },
  { id: 'LOG-419988', ts: '2026-03-21 14:10:00', actor: 'Priya Patel', action: 'REASSIGN_DEALER', target: 'DLR-902', ip: '45.10.88.1' },
  { id: 'LOG-419987', ts: '2026-03-20 09:00:15', actor: 'System CRON', action: 'GENERATE_BOM', target: 'CUST-8004', ip: 'Localhost' },
];

const AuditTrail: React.FC = () => {
  const [searchText, setSearchText] = useState('');

  const columns = [
    { title: 'Trace ID', dataIndex: 'id', key: 'id', render: (t: string) => <span className="font-mono text-xs text-apple-gray">{t}</span> },
    { title: 'Global Timestamp', dataIndex: 'ts', key: 'ts', width: 180 },
    { 
      title: 'Initiator Actor', 
      dataIndex: 'actor', 
      key: 'actor',
      render: (t: string) => (
         <span className="flex items-center text-apple-textLight dark:text-apple-textDark font-medium">
           {t.includes('CRON') ? <Settings size={14} className="mr-1 text-apple-gray"/> : <User size={14} className="mr-1 text-apple-gray"/>}
           {t}
         </span>
      )
    },
    { 
      title: 'Immutable Action Sequence', 
      dataIndex: 'action', 
      key: 'action',
      render: (t: string) => {
        let color = 'default';
        if (t.includes('DEACTIVATE') || t.includes('CRITICAL')) color = 'red';
        else if (t.includes('MODIFY') || t.includes('REASSIGN')) color = 'orange';
        else if (t.includes('COMPLETED') || t.includes('GENERATE')) color = 'green';
        return <Tag color={color} className="font-mono text-xs tracking-tight">{t}</Tag>;
      }
    },
    { title: 'Modification Target', dataIndex: 'target', key: 'target', render: (t: string) => <span className="font-semibold text-apple-textLight dark:text-apple-textDark">{t}</span> },
    { title: 'Origin Pointer (IP)', dataIndex: 'ip', key: 'ip', render: (t: string) => <span className="text-xs text-apple-textMuted font-mono">{t}</span> },
  ];

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark flex items-center"><ShieldCheck className="mr-2 text-indigo-600"/> Immutable Operations Ledger</h1>
        <Button 
          type="primary" 
          icon={<Download size={16} />} 
          className="bg-slate-800 hover:bg-slate-900 border-none shadow-sm"
        >
          Export Raw Trace Logs
        </Button>
      </div>

      <Card className="shadow-sm rounded-lg" bodyStyle={{ padding: '24px' }}>
        <div className="flex gap-4 mb-6">
           <Input 
             placeholder="Search IDs, Users, Action Type..." 
             prefix={<Search size={16} className="text-apple-gray"/>} 
             value={searchText}
             onChange={e => setSearchText(e.target.value)}
             style={{ width: 350 }}
           />
           <RangePicker className="w-64" />
           <Select defaultValue="ALL" style={{ width: 200 }}>
             <Select.Option value="ALL"><Lock size={14} className="inline mr-2 text-apple-gray"/> All Operation Bounds</Select.Option>
             <Select.Option value="USER_MANAGEMENT">Authentication / Identity</Select.Option>
             <Select.Option value="CONFIG">System Configuration</Select.Option>
             <Select.Option value="DB_AUTO">Algorithmic Tasks (CRON)</Select.Option>
           </Select>
        </div>

        <Table 
          columns={columns} 
          dataSource={mockAudit} 
          rowKey="id"
          pagination={{ pageSize: 20 }}
          size="small"
          bordered
        />
      </Card>
      
      <div className="text-center mt-6 text-xs text-apple-gray flex items-center justify-center">
         <Lock size={12} className="mr-1"/> Audit logs are permanently immutable at the database constraint layer. They cannot be patched or destroyed.
      </div>
    </div>
  );
};

export default AuditTrail;
