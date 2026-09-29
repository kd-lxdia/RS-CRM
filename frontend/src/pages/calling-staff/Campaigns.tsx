import React, { useState } from 'react';
import { Table, Button, Drawer, Tag, Steps, Form, Input, Select, DatePicker, message, Card } from 'antd';
import { PlusOutlined, UploadOutlined, EyeOutlined } from '@ant-design/icons';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { 
  useCampaigns, useCreateCampaign, useUpdateCampaignStatus, 
  useTemplates, useParseExcel, useBulkUploadLeads 
} from '../../api/queries';

const { Step } = Steps;

const statusColors: Record<string, string> = {
  DRAFT: 'default',
  SCHEDULED: 'purple',
  RUNNING: 'green',
  PAUSED: 'warning',
  COMPLETED: 'blue',
};

const Campaigns: React.FC = () => {
  const navigate = useNavigate();
  const { data: campaignData, isLoading } = useCampaigns({ limit: 100 });
  const createCampaign = useCreateCampaign();
  const updateStatus = useUpdateCampaignStatus();
  const parseExcel = useParseExcel();
  const bulkUpload = useBulkUploadLeads();
  const { data: templatesData } = useTemplates();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  
  // Wizard state
  const [parsedData, setParsedData] = useState<any>(null);
  const [mappedContacts, setMappedContacts] = useState<any[]>([]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    try {
      const res = await parseExcel.mutateAsync(acceptedFiles[0]);
      setParsedData(res);
      // Auto-map if headers match 'name', 'phone', 'email' case-insensitive
      const mapped = res.parsedData.map((row: any) => {
        const out: any = {};
        Object.keys(row).forEach(k => {
          const lk = k.toLowerCase();
          if (lk.includes('name')) out.name = row[k];
          if (lk.includes('phone') || lk.includes('mobile')) out.phone = String(row[k]);
          if (lk.includes('email')) out.email = row[k];
        });
        return out;
      });
      setMappedContacts(mapped.filter((m: any) => m.name && m.phone));
      message.success(`Parsed ${res.totalRows} rows, auto-mapped ${mapped.filter((m: any) => m.name && m.phone).length} valid contacts.`);
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || 'Error parsing file');
    }
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } });

  const handleNext = () => {
    form.validateFields().then(() => setCurrentStep(c => c + 1));
  };

  const handleFinish = async () => {
    try {
      const values = form.getFieldsValue();
      const scheduledAt = values.scheduleType === 'LATER' ? values.scheduledAt?.toISOString() : new Date().toISOString();
      
      const newCamp = await createCampaign.mutateAsync({
        name: values.name,
        type: values.type,
        templateId: values.templateId,
        scheduledAt: values.scheduleType === 'LATER' ? scheduledAt : null,
      });

      // Import leads
      if (mappedContacts.length > 0) {
        const records = mappedContacts.map(m => ({ ...m, campaignId: newCamp.id, source: 'EXCEL_UPLOAD' }));
        await bulkUpload.mutateAsync(records);
      }

      if (values.scheduleType === 'NOW') {
        await updateStatus.mutateAsync({ id: newCamp.id, status: 'RUNNING' });
      }

      message.success('Campaign created successfully');
      setDrawerOpen(false);
      setCurrentStep(0);
      form.resetFields();
      setParsedData(null);
      setMappedContacts([]);
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || 'Failed to create campaign');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (text: string) => <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{text}</span> },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (text: string) => <span className="text-gray-500 dark:text-gray-400 text-sm">{text}</span> },
    { 
      title: 'Status', 
      key: 'status', 
      render: (_: any, r: any) => <Tag color={statusColors[r.status]} className="rounded-full px-2 py-0 border-none font-medium shadow-sm">{r.status}</Tag> 
    },
    { 
      title: 'Scheduled', 
      key: 'startedAt', 
      render: (_: any, r: any) => <span className="text-gray-500 dark:text-gray-400 text-sm">{r.startedAt ? dayjs(r.startedAt).format('MMM D, HH:mm') : '—'}</span> 
    },
    { title: 'Sent', dataIndex: 'sent', key: 'sent', render: (text: number) => <span className="text-gray-500 dark:text-gray-400 font-mono text-sm">{text}</span> },
    { title: 'Delivered', dataIndex: 'delivered', key: 'delivered', render: (text: number) => <span className="text-gray-500 dark:text-gray-400 font-mono text-sm">{text}</span> },
    { 
      title: 'Actions', 
      key: 'actions', 
      render: (_: any, r: any) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/calling-staff/campaigns/${r.id}`)} className="rounded-md font-medium text-xs">
          View
        </Button>
      ) 
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 bg-apple-gray dark:bg-black w-full min-h-full">
      {/* Injecting pristine table overrides for uniform Apple-like UI */}
      <style>{`
        .pristine-table .ant-table {
          background: transparent;
        }
        .pristine-table .ant-table-container {
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.06);
          background: #ffffff;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.02);
        }
        .dark .pristine-table .ant-table-container {
          background: #101010;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 4px 24px rgba(0,0,0,0.2);
        }
        .pristine-table .ant-table-thead > tr > th {
          background: #FAFAFA !important;
          border-bottom: 1px solid #F0F0F0 !important;
          color: #71717A;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          padding: 16px 20px;
        }
        .dark .pristine-table .ant-table-thead > tr > th {
          background: #18181B !important;
          border-bottom: 1px solid #27272A !important;
          color: #A1A1AA;
        }
        .pristine-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #F4F4F5 !important;
          padding: 16px 20px;
          background: transparent !important;
          transition: background 0.15s ease;
        }
        .dark .pristine-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #27272A !important;
        }
        .pristine-table .ant-table-tbody > tr:hover > td {
          background: #FAFAFB !important;
        }
        .dark .pristine-table .ant-table-tbody > tr:hover > td {
          background: #18181B !important;
        }
        .pristine-table .ant-pagination {
          margin: 24px 0 0 0 !important;
          background: white;
          padding: 12px 24px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 4px 24px rgba(0,0,0,0.02);
        }
        .dark .pristine-table .ant-pagination {
          background: #101010;
          border: 1px solid rgba(255,255,255,0.08);
        }
      `}</style>
      <div className="flex justify-between items-center max-w-7xl mx-auto w-full pt-2 px-2">
        <div>
          <h2 className="text-[32px] leading-tight font-bold text-gray-900 dark:text-white tracking-tight m-0">Campaigns</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 mb-0 text-sm">Manage and track your active outreach campaigns</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)} className="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-black border-none shadow-sm rounded-lg font-medium h-9">New Campaign</Button>
      </div>

      <div className="w-full pristine-table max-w-7xl mx-auto">
        <Table 
          columns={columns} 
          dataSource={campaignData?.campaigns || []} 
          rowKey="id" 
          loading={isLoading} 
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </div>

      <Drawer
        title="Create New Campaign"
        width={700}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { overflowY: 'auto' } }}
        footer={
          <div className="flex justify-between">
            <Button onClick={() => setCurrentStep(c => Math.max(0, c - 1))} disabled={currentStep === 0}>Back</Button>
            {currentStep < 2 ? (
              <Button type="primary" onClick={handleNext}>Next</Button>
            ) : (
              <Button type="primary" onClick={handleFinish} loading={createCampaign.isPending || bulkUpload.isPending}>Confirm & Create</Button>
            )}
          </div>
        }
      >
        <Steps current={currentStep} className="mb-8">
          <Step title="Details" />
          <Step title="Contacts" />
          <Step title="Schedule" />
        </Steps>

        <Form form={form} layout="vertical" className={currentStep === 0 ? 'block' : 'hidden'}>
          <Form.Item name="name" label="Campaign Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Summer Solar Offer" />
          </Form.Item>
          <Form.Item name="type" label="Campaign Type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="WHATSAPP">WhatsApp</Select.Option>
              <Select.Option value="EMAIL">Email</Select.Option>
              <Select.Option value="BOTH">Both</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="templateId" label="Select Template" rules={[{ required: true }]}>
            <Select>
              {templatesData?.map((t: any) => (
                <Select.Option key={t.id} value={t.id}>{t.name} ({t.type})</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>

        <div className={currentStep === 1 ? 'block' : 'hidden'}>
          <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors bg-gray-50 mb-6">
            <input {...getInputProps()} />
            <UploadOutlined className="text-3xl text-gray-400 mb-2" />
            <p className="ant-upload-text font-medium text-gray-700">Click or drag Excel file (.xlsx) to upload</p>
            <p className="ant-upload-hint text-gray-500 text-sm">Automatically maps Name, Phone, and Email columns.</p>
          </div>

          {parsedData && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Preview (First 5 rows) - {mappedContacts.length} total mapped records</h4>
              <Table 
                dataSource={parsedData.previewRows.map((r: any, i: number) => ({...r, key: i}))} 
                columns={parsedData.headers.map((h: string) => ({ title: h, dataIndex: h, key: h }))}
                pagination={false}
                size="small"
                scroll={{ x: true, y: 300 }}
              />
            </div>
          )}
        </div>

        <Form form={form} layout="vertical" className={currentStep === 2 ? 'block' : 'hidden'} initialValues={{ scheduleType: 'NOW' }}>
          <Form.Item name="scheduleType" label="When would you like to send this?">
            <Select getPopupContainer={(trigger) => trigger.parentNode}>
              <Select.Option value="NOW">Send Immediately</Select.Option>
              <Select.Option value="LATER">Schedule for Later</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item 
            noStyle 
            shouldUpdate={(prev, curr) => prev.scheduleType !== curr.scheduleType}
          >
            {({ getFieldValue }) => getFieldValue('scheduleType') === 'LATER' ? (
              <Form.Item name="scheduledAt" label="Select Date and Time" rules={[{ required: true }]}>
                <DatePicker 
                  showTime 
                  className="w-full" 
                  placement="bottomLeft"
                  disabledDate={d => d && (d.valueOf() < dayjs().startOf('day').valueOf())} 
                  disabledTime={(selectedDate) => {
                    const now = dayjs();
                    if (selectedDate && selectedDate.isSame(now, 'day')) {
                      return {
                        disabledHours: () => Array.from({ length: 24 }, (_, i) => i).filter(h => h < now.hour()),
                        disabledMinutes: (selectedHour) => {
                          if (selectedHour === now.hour()) return Array.from({ length: 60 }, (_, i) => i).filter(m => m < now.minute());
                          return [];
                        },
                        disabledSeconds: () => []
                      };
                    }
                    return { disabledHours: () => [], disabledMinutes: () => [], disabledSeconds: () => [] };
                  }}
                  getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
                />
              </Form.Item>
            ) : null}
          </Form.Item>

          {/* Spacer to guarantee scrollable space to force downward opening instead of up-clipping */}
          <div style={{ height: '400px' }} />
        </Form>
      </Drawer>
    </div>
  );
};

export default Campaigns;
