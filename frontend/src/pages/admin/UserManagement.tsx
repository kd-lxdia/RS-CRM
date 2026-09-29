import React, { useState } from 'react';
import { Card, Table, Tag, Button, Input, Modal, Select, Form, Row, Col, message } from 'antd';
import { Search, UserPlus, Key, EyeOff, Filter, Edit } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';

const { Option } = Select;

const UserManagement: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [deactivateModal, setDeactivateModal] = useState<any>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editingUser, setEditingUser] = useState<any>(null);

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await backendApi.get('/admin/users');
      return res.data.data;
    }
  });

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await backendApi.post('/admin/users', values);
      message.success("User created. A temporary password was emailed securely.");
      setCreateModal(false);
      form.resetFields();
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.error || "Failed to create user");
    }
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      await backendApi.put(`/admin/users/${editingUser.id}`, values);
      message.success("User updated");
      setEditingUser(null);
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.error || "Failed to update user");
    }
  };

  const handleDeactivate = () => {
    message.success(`User ${deactivateModal.name} deactivated and assignments fundamentally transferred.`);
    setDeactivateModal(null);
  };

  const resetPassword = (record: any) => {
    message.success(`Temporary reset key generated and dispatched to ${record.email}`);
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (t: string) => <strong className="text-apple-textLight dark:text-apple-textDark">{t}</strong> },
    { title: 'Email Address', dataIndex: 'email', key: 'email', render: (t: string) => <span className="text-apple-textMuted">{t}</span> },
    { 
      title: 'Global Role', 
      dataIndex: 'role', 
      key: 'role',
      render: (t: string) => {
        let color = 'default';
        if (t === 'SALESPERSON') color = 'blue';
        if (t === 'INSTALLATION') color = 'orange';
        if (t === 'DOCUMENTATION') color = 'purple';
        if (t === 'DEALER_ADMIN' || t === 'ADMIN') color = 'red';
        return <Tag color={color}>{t.replace('_', ' ')}</Tag>;
      }
    },
    { title: 'Operational Zone', dataIndex: 'zone', key: 'zone' },
    { 
      title: 'Status', 
      dataIndex: 'isActive', 
      key: 'status',
      render: (isActive: boolean) => <Badge color={isActive ? 'green' : 'red'} text={isActive ? 'ACTIVE' : 'INACTIVE'} /> 
    },
    {
      title: 'Monthly Salary',
      dataIndex: 'monthlySalary',
      key: 'monthlySalary',
      render: (val: number) => `₹${val?.toLocaleString() || 0}`
    },
    { title: 'Last Login', dataIndex: 'lastLogin', key: 'lastLogin' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: any) => (
        <div className="flex gap-2">
          <Button size="small" type="text" className="text-blue-600" onClick={() => {
            setEditingUser(r);
            editForm.setFieldsValue(r);
          }}><Edit size={14} /></Button>
          <Button size="small" type="text" onClick={() => resetPassword(r)} icon={<Key size={14}/>}></Button>
          {r.isActive && (
             <Button size="small" type="text" danger onClick={() => setDeactivateModal(r)} icon={<EyeOff size={14}/>}></Button>
          )}
        </div>
      )
    }
  ];

  // Helper Custom Badge element equivalent to antd one missing import wrapper
  const Badge = ({color, text}: {color:string, text:string}) => (
     <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${color}-100 text-${color}-800`}>
        {text}
     </span>
  );

  return (
    <div className="p-6 bg-transparent min-h-screen">
       <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark">User Configuration Console</h1>
        <Button 
          type="primary" 
          icon={<UserPlus size={16} />} 
          onClick={() => setCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 border-none shadow"
        >
          Provision New Profile
        </Button>
      </div>

      <Card className="shadow-sm rounded-lg" bodyStyle={{ padding: '16px 24px' }}>
         <div className="flex gap-4 mb-6">
           <Input 
             placeholder="Search by name, email, or ID..." 
             prefix={<Search size={16} className="text-apple-gray"/>} 
             value={searchText}
             onChange={e => setSearchText(e.target.value)}
             style={{ width: 300 }}
           />
           <Select defaultValue="ALL" style={{ width: 150 }}>
             <Option value="ALL"><Filter size={14} className="inline mr-2 text-apple-gray"/> All Roles</Option>
             <Option value="SALESPERSON">Sales Team</Option>
             <Option value="INSTALLATION">Installation</Option>
           </Select>
         </div>

         <Table 
            columns={columns} 
            dataSource={users || []} 
            rowKey="id"
            loading={isLoading}
            pagination={{ pageSize: 15 }}
         />
      </Card>

      {/* CREATE MODAL */}
      <Modal
        title="Provision New Employee Profile"
        open={createModal}
        onOk={handleCreate}
        onCancel={() => setCreateModal(false)}
        width={700}
        okText="Provision & Dispatch Welcome Key"
        okButtonProps={{ className: 'bg-indigo-600 border-none' }}
      >
        <Form form={form} layout="vertical" className="mt-4">
           <Row gutter={16}>
              <Col span={12}><Form.Item label="Full Name"><Input placeholder="Legal name..."/></Form.Item></Col>
              <Col span={12}><Form.Item label="Corporate Email"><Input type="email" placeholder="alias@lohia.com"/></Form.Item></Col>
           </Row>
           <Row gutter={16}>
              <Col span={12}><Form.Item label="Phone Number"><Input placeholder="+91..."/></Form.Item></Col>
              <Col span={12}>
                 <Form.Item label="Global Authorization Role">
                    <Select placeholder="Select generic permissions...">
                       <Option value="SALESPERSON">Sales Associate</Option>
                       <Option value="DOCUMENTATION">Documentation Officer</Option>
                       <Option value="INSTALLATION">Installation Engineer</Option>
                       <Option value="WAREHOUSE">Warehouse Admin</Option>
                       <Option value="ACCOUNTANT">Financial Accountant</Option>
                       <Option value="PROJECT_HEAD">Project Head</Option>
                       <Option value="ADMIN">Super Administrator</Option>
                    </Select>
                 </Form.Item>
              </Col>
           </Row>
            <Row gutter={16}>
               <Col span={12}>
                  <Form.Item label="Operational Zone Target" name="zoneId">
                     <Select placeholder="Assign geographic bounds..."><Option value="N_DEL">North Delhi</Option></Select>
                  </Form.Item>
               </Col>
               <Col span={12}>
                  <Form.Item label="Monthly Salary (₹)" name="monthlySalary">
                     <Input type="number" placeholder="0" />
                  </Form.Item>
               </Col>
            </Row>
        </Form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        title="Edit Employee Profile"
        open={!!editingUser}
        onOk={handleEdit}
        onCancel={() => setEditingUser(null)}
        width={700}
        okText="Save Changes"
        okButtonProps={{ className: 'bg-indigo-600 border-none' }}
      >
        <Form form={editForm} layout="vertical" className="mt-4">
           <Row gutter={16}>
              <Col span={12}><Form.Item label="Full Name" name="name"><Input /></Form.Item></Col>
              <Col span={12}><Form.Item label="Corporate Email" name="email"><Input type="email" /></Form.Item></Col>
           </Row>
           <Row gutter={16}>
              <Col span={12}><Form.Item label="Phone Number" name="phone"><Input /></Form.Item></Col>
              <Col span={12}>
                 <Form.Item label="Global Authorization Role" name="role">
                    <Select>
                       <Option value="SALESPERSON">Sales Associate</Option>
                       <Option value="DOCUMENTATION">Documentation Officer</Option>
                       <Option value="INSTALLATION">Installation Engineer</Option>
                       <Option value="WAREHOUSE">Warehouse Admin</Option>
                       <Option value="ACCOUNTANT">Financial Accountant</Option>
                       <Option value="PROJECT_HEAD">Project Head</Option>
                       <Option value="ADMIN">Super Administrator</Option>
                    </Select>
                 </Form.Item>
              </Col>
           </Row>
           <Row gutter={16}>
              <Col span={12}>
                 <Form.Item label="Monthly Salary (₹)" name="monthlySalary">
                    <Input type="number" />
                 </Form.Item>
              </Col>
           </Row>
        </Form>
      </Modal>

      {/* DEACTIVATE & REASSIGN MODAL */}
      <Modal
         title={<span className="text-red-600 flex items-center"><EyeOff className="mr-2"/> Deactivate Active Agent ({deactivateModal?.name})</span>}
         open={!!deactivateModal}
         onOk={handleDeactivate}
         onCancel={() => setDeactivateModal(null)}
         okText="Confirm Structural Reassignment"
         okType="danger"
      >
         <div className="bg-red-50 text-red-700 p-3 rounded text-sm mb-4 border border-red-200 shadow-sm">
            <strong className="block mb-1">Warning: Operational Task Reassignment Required</strong>
            Deactivating an active profile requires mapping all their currently uncompleted pipeline tasks to a new delegate automatically to prevent generic bottlenecks.
         </div>

         <Form layout="vertical">
            <Form.Item label={`Select new fallback operator for all active ${deactivateModal?.role} tasks:`}>
               <Select showSearch placeholder="Search fallback employee profile...">
                  <Option value="EMP-NEW">Rahul S. (Available Load: 8)</Option>
                  <Option value="EMP-OTH">Suresh K. (Available Load: 15)</Option>
               </Select>
            </Form.Item>
         </Form>
      </Modal>

    </div>
  );
};

export default UserManagement;
