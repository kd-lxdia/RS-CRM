import React, { useState } from 'react';
import { Card, Table, Button, Form, Input, Select, Drawer, Space, message, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from '../../api/queries';

const { TextArea } = Input;

const Templates: React.FC = () => {
  const { data: templates = [], isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  
  // Real-time preview values
  const [previewBody, setPreviewBody] = useState('');
  const [templateType, setTemplateType] = useState('WHATSAPP');

  const openDrawer = (record?: any) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue({
        name: record.name,
        type: record.type,
        subject: record.subject,
        body: record.body,
        variables: record.variables,
      });
      setPreviewBody(record.body);
      setTemplateType(record.type);
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ type: 'WHATSAPP', variables: ['name', 'dealerName'] });
      setPreviewBody('');
      setTemplateType('WHATSAPP');
    }
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingId) {
        await updateTemplate.mutateAsync({ id: editingId, data: values });
        message.success('Template updated');
      } else {
        await createTemplate.mutateAsync(values);
        message.success('Template created');
      }
      setDrawerOpen(false);
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || 'Failed to save template');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { 
      title: 'Type', 
      dataIndex: 'type', 
      key: 'type',
      render: (t: string) => <Tag color={t === 'WHATSAPP' ? 'green' : t === 'EMAIL' ? 'blue' : 'purple'}>{t}</Tag>
    },
    { title: 'Subject', dataIndex: 'subject', key: 'subject', render: (val: string) => val || '-' },
    { 
      title: 'Actions', 
      key: 'actions',
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openDrawer(r)} />
          <Popconfirm title="Are you sure you want to delete this template?" onConfirm={async () => {
            try {
              await deleteTemplate.mutateAsync(r.id);
              message.success('Template deleted');
            } catch (err: any) {
              message.error(err.response?.data?.error?.message || 'Failed to delete template');
            }
          }}>
            <Button size="small" danger icon={<DeleteOutlined />} loading={deleteTemplate.isPending && r.id === deleteTemplate.variables} /> 
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold m-0">Template Builder</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()}>New Template</Button>
      </div>

      <Card bordered={false} className="shadow-sm p-0 overflow-hidden">
        <Table columns={columns} dataSource={templates} rowKey="id" loading={isLoading} />
      </Card>

      <Drawer
        title={editingId ? 'Edit Template' : 'Create Template'}
        width={800}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSave} loading={createTemplate.isPending || updateTemplate.isPending}>
              Save Template
            </Button>
          </div>
        }
      >
        <div className="flex gap-6 h-full">
          <div className="flex-1 overflow-y-auto pr-4">
            <Form form={form} layout="vertical" onValuesChange={(_, all) => {
              setPreviewBody(all.body || '');
              setTemplateType(all.type);
            }}>
              <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Welcome Message" />
              </Form.Item>
              <Form.Item name="type" label="Channel" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="WHATSAPP">WhatsApp</Select.Option>
                  <Select.Option value="EMAIL">Email</Select.Option>
                  <Select.Option value="BOTH">Both</Select.Option>
                </Select>
              </Form.Item>
              
              {templateType !== 'WHATSAPP' && (
                <Form.Item name="subject" label="Email Subject">
                  <Input placeholder="Subject line..." />
                </Form.Item>
              )}

              <Form.Item name="variables" label="Available Variables (Press enter to add)">
                <Select mode="tags" placeholder="e.g. name, date" />
              </Form.Item>

              <Form.Item name="body" label="Message Body" rules={[{ required: true }]}>
                {templateType === 'EMAIL' || templateType === 'BOTH' ? (
                  <ReactQuill theme="snow" style={{ height: '240px', marginBottom: '40px' }} />
                ) : (
                  <TextArea rows={8} placeholder="Hello {{name}}, your appointment is at {{time}}..." />
                )}
              </Form.Item>
            </Form>
          </div>
          <div className="flex-1 bg-gray-50 p-4 border border-gray-200 rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-4">Live Preview</h3>
            <div className="p-4 bg-apple-cardLight dark:bg-apple-cardDark rounded shadow-sm border border-gray-100 min-h-[300px]">
              {templateType === 'WHATSAPP' ? (
                <div className="whitespace-pre-wrap">{previewBody.replace(/{{(.*?)}}/g, (match) => {
                  return `<span class="bg-yellow-100 text-yellow-800 px-1 rounded">${match}</span>`;
                })}</div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: previewBody.replace(/{{(.*?)}}/g, '<span style="background:#fef08a;padding:2px;border-radius:4px;">$1</span>') }} />
              )}
            </div>
            <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-sm rounded">
              Use <code className="bg-apple-cardLight dark:bg-apple-cardDark px-1 py-0.5 rounded">{'{{variableName}}'}</code> syntax to insert dynamic tags.
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default Templates;
