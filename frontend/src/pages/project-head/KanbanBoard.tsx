import React, { useState } from 'react';
import { Card, Tag, Input, Select, Button, Drawer, Typography, Timeline, Badge } from 'antd';
import { Search, Filter, Clock, User, Phone, Mail, MapPin, AlertTriangle } from 'lucide-react';

const { Option } = Select;
const { Text } = Typography;

const STAGES = ['Documentation', 'Site Survey', 'Procurement', 'Dispatch', 'Installation'];

const mockKanban = [
  { id: 'CUST-8001', name: 'Vikram Singh', stage: 'Documentation', days: 5, delay: 'RED', assigned: 'Rahul W.', value: '1.5L' },
  { id: 'CUST-8002', name: 'Neha Patel', stage: 'Documentation', days: 1, delay: 'GREEN', assigned: 'Rahul W.', value: '8.5L' },
  { id: 'CUST-8003', name: 'Raj Kumar', stage: 'Site Survey', days: 3, delay: 'AMBER', assigned: 'Amit S.', value: '4.2L' },
  { id: 'CUST-8004', name: 'Sita Ram', stage: 'Procurement', days: 7, delay: 'RED', assigned: 'Warehouse', value: '12L' },
  { id: 'CUST-8005', name: 'Priya Desai', stage: 'Dispatch', days: 1, delay: 'GREEN', assigned: 'Warehouse', value: '3.1L' },
  { id: 'CUST-8006', name: 'Arjun Mehta', stage: 'Installation', days: 2, delay: 'GREEN', assigned: 'Vikram S.', value: '5L' },
  { id: 'CUST-8007', name: 'Suresh N.', stage: 'Installation', days: 5, delay: 'RED', assigned: 'Vikram S.', value: '2L' },
];

const KanbanBoard: React.FC = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedCust, setSelectedCust] = useState<any>(null);

  const openDrawer = (c: any) => {
    setSelectedCust(c);
    setDrawerVisible(true);
  };

  const renderCard = (c: any) => {
    return (
      <Card 
        key={c.id} 
        className="mb-3 shadow-sm rounded-lg cursor-pointer hover:shadow-md transition-shadow border border-transparent"
        bodyStyle={{ padding: '12px' }}
        onClick={() => openDrawer(c)}
      >
        <div className="flex justify-between items-start mb-2">
           <div>
             <div className="text-xs text-apple-gray font-mono font-medium">{c.id}</div>
             <div className="font-bold text-apple-textLight dark:text-apple-textDark">{c.name}</div>
           </div>
           {c.delay === 'RED' && <Badge color="red" count={`${c.days}d`} title={`${c.days} days in stage`} />}
           {c.delay === 'AMBER' && <Badge color="orange" count={`${c.days}d`} title={`${c.days} days in stage`} />}
           {c.delay === 'GREEN' && <Badge color="green" count={`${c.days}d`} title={`${c.days} days in stage`} />}
        </div>
        <div className="flex justify-between items-end mt-3 text-xs text-apple-textMuted">
          <span className="flex items-center"><User size={12} className="mr-1"/> {c.assigned}</span>
          <span className="font-bold text-apple-textMuted">₹{c.value}</span>
        </div>
      </Card>
    );
  };

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark">Pipeline Kanban</h1>
        <div className="flex gap-3">
          <Input placeholder="Search Customer..." prefix={<Search size={16} className="text-apple-gray" />} className="w-64" />
          <Select defaultValue="ALL" className="w-32">
            <Option value="ALL"><Filter size={14} className="inline mr-2 text-apple-gray"/> Status</Option>
            <Option value="RED">Critical (Red)</Option>
            <Option value="AMBER">Warning (Amber)</Option>
            <Option value="GREEN">On Track</Option>
          </Select>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {STAGES.map(stage => {
          const colData = mockKanban.filter(c => c.stage === stage);
          return (
            <div key={stage} className="flex-1 min-w-[280px] bg-slate-100 p-3 rounded-lg border border-transparent shadow-inner">
               <div className="flex justify-between items-center mb-4 px-1">
                 <h3 className="font-bold text-apple-textLight dark:text-apple-textDark uppercase tracking-wide text-sm">{stage}</h3>
                 <span className="bg-slate-200 text-apple-textMuted px-2 py-0.5 rounded-full text-xs font-bold">{colData.length}</span>
               </div>
               <div className="min-h-[500px]">
                 {colData.map(renderCard)}
               </div>
            </div>
          );
        })}
      </div>

      <Drawer
        title={<span className="font-bold text-lg">{selectedCust?.name} <span className="text-apple-gray text-sm ml-2 font-mono">{selectedCust?.id}</span></span>}
        placement="right"
        width={450}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
         <div className="mb-6 space-y-2">
            <div className="flex items-center text-sm text-apple-textMuted"><User size={14} className="mr-2 text-apple-gray"/> Assigned: <strong className="ml-1 text-apple-textLight dark:text-apple-textDark">{selectedCust?.assigned}</strong></div>
            <div className="flex items-center text-sm text-apple-textMuted"><Clock size={14} className="mr-2 text-apple-gray"/> Days in current stage: <strong className={`ml-1 ${selectedCust?.delay === 'RED' ? 'text-red-600' : 'text-apple-textLight dark:text-apple-textDark'}`}>{selectedCust?.days} days</strong></div>
            <div className="flex items-center text-sm text-apple-textMuted"><Phone size={14} className="mr-2 text-apple-gray"/> +91 98765 43210</div>
         </div>

         <div className="mb-6">
            <h4 className="font-bold text-apple-textLight dark:text-apple-textDark mb-4 border-b pb-2">Deal Progress</h4>
            <Timeline>
              <Timeline.Item color="green"><strong>Lead Converted</strong> (Jan 10) <br/><span className="text-xs text-apple-gray">by Sales Team</span></Timeline.Item>
              <Timeline.Item color="green"><strong>Documentation Started</strong> (Jan 12)</Timeline.Item>
              {selectedCust?.stage === 'Documentation' ? (
                <Timeline.Item color={selectedCust.delay === 'RED' ? 'red' : 'blue'}><strong>Stuck at Documentation</strong> <br/><span className="text-xs text-red-500 font-medium">Pending PM Surya Details</span></Timeline.Item>
              ) : (
                <Timeline.Item color="green"><strong>Documentation Approved</strong> (Jan 15)</Timeline.Item>
              )}
            </Timeline>
         </div>

         {selectedCust?.delay === 'RED' && (
           <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h4 className="font-bold text-red-800 flex items-center mb-2"><AlertTriangle size={16} className="mr-2"/> Administrator Actions</h4>
              <p className="text-sm text-red-700 mb-4">This ticket has breached standard SLA timelines. You may reassign the ticket or escalate.</p>
              <div className="flex gap-2">
                 <Button size="small" type="primary" danger>Force Reassign</Button>
                 <Button size="small">Add Supervisor Note</Button>
              </div>
           </div>
         )}
      </Drawer>
    </div>
  );
};

export default KanbanBoard;
