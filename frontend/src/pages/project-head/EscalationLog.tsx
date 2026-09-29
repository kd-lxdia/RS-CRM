import React, { useState } from 'react';
import { Card, Table, Tag, Button, Input, Select, Modal, message, Space } from 'antd';
import { Search, Filter, AlertTriangle, User, History } from 'lucide-react';

const { Option } = Select;

const mockEscalations = [
  { id: 'ESC-291', customer: 'Suresh Menon', cid: 'CUST-8007', stage: 'INSTALLATION', mappedUser: 'Vikram Singh', delayDays: 5, severity: 'CRITICAL', lastAction: '2026-03-18' },
  { id: 'ESC-292', customer: 'Sita Ram', cid: 'CUST-8004', stage: 'PROCUREMENT', mappedUser: 'Warehouse Admin', delayDays: 7, severity: 'CRITICAL', lastAction: '2026-03-16' },
  { id: 'ESC-293', customer: 'Raj Kumar', cid: 'CUST-8003', stage: 'SITE_SURVEY', mappedUser: 'Amit S.', delayDays: 3, severity: 'WARNING', lastAction: '2026-03-20' },
];

const EscalationLog: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [noteModal, setNoteModal] = useState<any>(null);

  const resolveEscalation = (record: any) => {
    message.success(`Escalation ${record.id} mathematically bypassed & resolved.`);
  };

  const saveNote = () => {
    message.success(`Administrative timeline note injected directly onto ${noteModal.customer}'s record.`);
    setNoteModal(null);
  };

  const columns = [
    { title: 'Customer', key: 'customer', render: (_: unknown, r: any) => (<div><div className="font-bold text-apple-textLight dark:text-apple-textDark">{r.customer}</div><div className="text-xs text-apple-textMuted font-mono">{r.cid}</div></div>) },
    { 
      title: 'Bottleneck Stage', 
      dataIndex: 'stage', 
      key: 'stage',
      render: (t: string) => <Tag color="default">{t.replace('_', ' ')}</Tag>
    },
    { title: 'Mapped User', dataIndex: 'mappedUser', key: 'mappedUser', render: (t: string) => <span className="flex items-center text-apple-textLight dark:text-apple-textDark font-medium"><User size={14} className="mr-1 text-apple-gray"/> {t}</span> },
    { 
      title: 'SLA Duration', 
      key: 'delay',
      render: (_: unknown, r: any) => (
        <span className={`font-bold ${r.severity === 'CRITICAL' ? 'text-red-600' : 'text-amber-500'}`}>
          {r.delayDays} Days Stuck
        </span>
      )
    },
    { 
      title: 'Severity', 
      dataIndex: 'severity', 
      key: 'severity',
      render: (t: string) => (
        t === 'CRITICAL' 
        ? <Tag color="error" icon={<AlertTriangle size={12} className="mr-1 inline"/>}>Level 2 (&gt;4d)</Tag> 
        : <Tag color="warning" icon={<AlertTriangle size={12} className="mr-1 inline"/>}>Level 1 (2-4d)</Tag>
      )
    },
    { title: 'Last Event', dataIndex: 'lastAction', key: 'lastAction' },
    { 
      title: 'Resolution', 
      key: 'actions',
      render: (_: unknown, r: any) => (
        <Space>
           <Button size="small" type="primary" onClick={() => setNoteModal(r)}>Add Note</Button>
           <Button size="small" className="border-green-600 text-green-600 hover:bg-green-50" onClick={() => resolveEscalation(r)}>Resolve</Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark">Escalation Audit Log</h1>
        <div className="flex gap-3">
          <Input 
             placeholder="Search IDs..." 
             prefix={<Search size={16} className="text-apple-gray"/>} 
             style={{ width: 200 }}
          />
          <Select defaultValue="ALL" style={{ width: 150 }}>
            <Option value="ALL"><Filter size={14} className="inline mr-2 text-apple-gray"/> All Severity</Option>
            <Option value="CRITICAL">Level 2 (&gt;4s)</Option>
            <Option value="WARNING">Level 1 (2-4d)</Option>
          </Select>
        </div>
      </div>

      <Card className="shadow-sm rounded-lg" bodyStyle={{ padding: '0px' }}>
        <Table 
          columns={columns} 
          dataSource={mockEscalations} 
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Modal
        title={`Add Administrative Override: ${noteModal?.customer}`}
        open={!!noteModal}
        onOk={saveNote}
        onCancel={() => setNoteModal(null)}
        okText="Inject Timeline Record"
      >
         <div className="bg-transparent p-3 rounded text-sm text-apple-textMuted mb-4 border border-transparent">
           You are creating a <span className="font-bold text-apple-textLight dark:text-apple-textDark">PROJECT_HEAD</span> explicit note. This will be visible on the timeline audit to all users.
         </div>
         <label className="block text-apple-textLight dark:text-apple-textDark font-medium mb-1">Override Notification Text</label>
         <Input.TextArea rows={4} placeholder="Describe the resolution constraints bridging this SLA gap..." />
      </Modal>

    </div>
  );
};

export default EscalationLog;
