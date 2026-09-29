import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Skeleton } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useDealer } from '../../context/DealerContext';
import { Building2, Mail, Phone, FileText } from 'lucide-react';

export const DealerSettings: React.FC = () => {
  const [form] = Form.useForm();
  const { settings, loading, refreshSettings } = useDealer();

  React.useEffect(() => {
    if (settings) {
      form.setFieldsValue({
        companyName: settings.companyName,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        gstNumber: settings.gstNumber,
      });
    }
  }, [settings, form]);

  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      await api.put('/dealer/settings', values);
    },
    onSuccess: () => {
      message.success('Company settings updated');
      refreshSettings();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || 'Failed to update settings');
    }
  });

  if (loading) return <Skeleton active />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold m-0">My Company</h1>
        <p className="text-apple-textMuted">Manage your business profile and contact details.</p>
      </div>

      <Card className="shadow-sm">
        <Form layout="vertical" form={form} onFinish={updateMutation.mutate}>
          <Form.Item label="Company / Entity Name" name="companyName" rules={[{ required: true }]}>
            <Input prefix={<Building2 size={16} className="text-apple-gray mr-2" />} size="large" />
          </Form.Item>
          
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Contact Email" name="contactEmail">
              <Input prefix={<Mail size={16} className="text-apple-gray mr-2" />} size="large" />
            </Form.Item>
            <Form.Item label="Contact Phone" name="contactPhone">
              <Input prefix={<Phone size={16} className="text-apple-gray mr-2" />} size="large" />
            </Form.Item>
          </div>

          <Form.Item label="GST/Tax Registration Number" name="gstNumber">
            <Input prefix={<FileText size={16} className="text-apple-gray mr-2" />} size="large" />
          </Form.Item>

          <Button type="primary" htmlType="submit" size="large" loading={updateMutation.isPending}>
            Save Changes
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default DealerSettings;
