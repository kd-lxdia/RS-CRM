import React, { useState } from 'react';
import { Card, Table, Button, Tag, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Plus, Trash2, Edit2 } from 'lucide-react';

const { Option } = Select;

export const DealerTeam: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form] = Form.useForm();

  const { data: team = [], isLoading } = useQuery({
    queryKey: ['dealerTeam'],
    queryFn: async () => {
      const res = await api.get('/dealer/team');
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editingUser) {
        return api.put(`/dealer/team/${editingUser.id}`, values);
      } else {
        return api.post('/dealer/team', values);
      }
    },
    onSuccess: () => {
      message.success(`Team member ${editingUser ? 'updated' : 'invited'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['dealerTeam'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || 'Failed to save');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/dealer/team/${id}`);
    },
    onSuccess: () => {
      message.success('User access revoked');
      queryClient.invalidateQueries({ queryKey: ['dealerTeam'] });
    }
  });

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { 
      title: 'Role', 
      dataIndex: 'role', 
      key: 'role',
      render: (role: string) => <Tag color="blue">{role.replace(/_/g, ' ')}</Tag>
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <div className="flex gap-2">
          <Button type="text" size="small" icon={<Edit2 size={16} />} onClick={() => {
            setEditingUser(record);
            form.setFieldsValue(record);
            setIsModalOpen(true);
          }} />
          <Popconfirm title="Revoke access for this user?" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Button type="text" danger size="small" icon={<Trash2 size={16} />} disabled={record.role === 'DEALER_ADMIN'} />
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold m-0">Team Management</h1>
          <p className="text-apple-textMuted">Add staff across calling, sales, and operations</p>
        </div>
        <Button type="primary" icon={<Plus size={16} />} onClick={() => {
          setEditingUser(null);
          form.resetFields();
          setIsModalOpen(true);
        }}>
          Add Staff
        </Button>
      </div>

      <Card className="shadow-sm rounded-[1.25rem] border border-transparent border-transparent bg-apple-cardLight dark:bg-apple-cardDark dark:bg-apple-cardDark">
        <Table dataSource={team} columns={columns} rowKey="id" loading={isLoading} />
      </Card>

      <Modal
        title={editingUser ? "Edit Staff" : "Add Staff"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={saveMutation.mutate}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email' }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="phone" label="Phone Number" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              <Option value="DEALER_STAFF">General Staff</Option>
              <Option value="CALLING_STAFF">Calling / Lead Gen</Option>
              <Option value="SALESPERSON">Field Salesperson</Option>
              <Option value="DOCUMENTATION">Documentation Agent</Option>
              <Option value="INSTALLATION">Installation Engineer</Option>
              <Option value="WAREHOUSE">Warehouse Manager</Option>
              <Option value="ACCOUNTANT">Accountant</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DealerTeam;
