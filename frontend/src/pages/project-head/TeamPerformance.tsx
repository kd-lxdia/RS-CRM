import React, { useState } from 'react';
import { Card, Table, Segmented, Row, Col, Avatar, Button, Modal, Tag } from 'antd';
import { User, Trophy, Clock, AlertTriangle, FileCheck, Phone } from 'lucide-react';

const mockTeams = {
  SALES: [
    { id: '1', name: 'Rahul Sharma', active: 12, completed: 45, avgDays: 1.2, overdue: 0 },
    { id: '2', name: 'Priya Singh', active: 18, completed: 32, avgDays: 2.1, overdue: 2 },
    { id: '3', name: 'Amit Desai', active: 8, completed: 25, avgDays: 1.8, overdue: 0 },
  ],
  DOCUMENTATION: [
    { id: '4', name: 'Neha Patel', active: 25, completed: 110, avgDays: 4.5, overdue: 5 },
    { id: '5', name: 'Suresh Menon', active: 15, completed: 85, avgDays: 6.2, overdue: 8 },
  ],
  INSTALLATION: [
    { id: '6', name: 'Vikram Singh', active: 8, completed: 50, avgDays: 2.5, overdue: 1 },
    { id: '7', name: 'Ravi Kumar', active: 12, completed: 40, avgDays: 3.1, overdue: 4 },
  ]
};

const TeamPerformance: React.FC = () => {
  const [role, setRole] = useState<'SALES' | 'DOCUMENTATION' | 'INSTALLATION'>('SALES');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const data = mockTeams[role].sort((a, b) => b.completed - a.completed);

  // Mock modal data
  const userModalColumns = [
    { title: 'Customer', dataIndex: 'customer', key: 'customer' },
    { title: 'Date Assigned', dataIndex: 'assigned', key: 'assigned' },
    { title: 'Status', key: 'status', render: () => <Tag color="processing">Active - In Progress</Tag> },
    { title: 'Action', key: 'action', render: () => <Button size="small" type="link">View Ticket</Button> }
  ];
  
  const userModalData = [
    { id: 1, customer: 'Anita Joshi', assigned: '2026-03-20' },
    { id: 2, customer: 'Rajesh Ram', assigned: '2026-03-21' },
    { id: 3, customer: 'Vikash Jain', assigned: '2026-03-18' },
  ];

  const renderCard = (user: any, index: number) => {
    return (
      <Col xs={24} sm={12} lg={8} key={user.id}>
        <Card className="shadow-sm rounded-lg border border-transparent h-full relative cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedUser(user)}>
          {index === 0 && (
             <div className="absolute -top-3 -right-3 bg-yellow-400 p-2 rounded-full shadow border-2 border-white">
               <Trophy size={16} className="text-white"/>
             </div>
          )}
          <div className="flex items-center mb-4">
             <Avatar size={48} className="bg-blue-100 text-blue-600 mr-3 font-bold" icon={<User size={24}/>} />
             <div>
               <h3 className="font-bold text-apple-textLight dark:text-apple-textDark text-lg mb-0">{user.name}</h3>
               <span className="text-xs text-apple-textMuted font-medium uppercase">{role} TEAM</span>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
             <div className="bg-transparent p-2 rounded">
                <div className="text-xs text-apple-textMuted flex items-center mb-1"><FileCheck size={12} className="mr-1"/> Completed</div>
                <div className="font-bold text-lg text-apple-textLight dark:text-apple-textDark">{user.completed}</div>
             </div>
             <div className="bg-transparent p-2 rounded">
                <div className="text-xs text-apple-textMuted flex items-center mb-1"><User size={12} className="mr-1"/> Active Load</div>
                <div className="font-bold text-lg text-apple-textLight dark:text-apple-textDark">{user.active}</div>
             </div>
          </div>

          <div className="flex justify-between items-center text-sm border-t border-transparent pt-3">
             <span className="flex items-center text-apple-textMuted"><Clock size={14} className="mr-1 text-apple-gray"/> {user.avgDays}d avg time</span>
             {user.overdue > 0 ? (
               <span className="flex items-center text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full"><AlertTriangle size={12} className="mr-1"/> {user.overdue} Overdue</span>
             ) : (
               <span className="text-emerald-500 font-medium text-xs">Exceeding SLAs</span>
             )}
          </div>
        </Card>
      </Col>
    );
  };

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark">Team Performance Rankings</h1>
        <Segmented
          options={[
            { label: 'Sales Execs', value: 'SALES' },
            { label: 'Documentation', value: 'DOCUMENTATION' },
            { label: 'Installations', value: 'INSTALLATION' }
          ]}
          value={role}
          onChange={(v) => setRole(v as any)}
          size="large"
          className="apple-card"
        />
      </div>

      <Row gutter={[24, 24]}>
        {data.map((user, idx) => renderCard(user, idx))}
      </Row>

      <Modal
        title={
          <div className="flex items-center">
            <Avatar className="bg-blue-100 text-blue-600 mr-2" />
            <div>
              <div className="text-lg font-bold">{selectedUser?.name}'s Workload</div>
              <div className="text-sm font-normal text-apple-textMuted">Currently managing {selectedUser?.active} active assignments</div>
            </div>
          </div>
        }
        visible={!!selectedUser}
        onCancel={() => setSelectedUser(null)}
        footer={null}
        width={700}
      >
        <div className="flex gap-4 mb-4 mt-4">
           <Button icon={<Phone size={14}/>}>Call Associate</Button>
           <Button type="primary" danger>Force Reassign Overdue Tickets</Button>
        </div>
        <Table
          columns={userModalColumns}
          dataSource={userModalData}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>

    </div>
  );
};

export default TeamPerformance;
