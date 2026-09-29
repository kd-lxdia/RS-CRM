import React, { useEffect } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Space, Typography, message } from 'antd';
import { FileText, IndianRupee, Save, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';

const { Title, Text } = Typography;

const settingKeys = {
  quotationFormat: 'QUOTATION_FORMAT_TEMPLATE',
  paymentConditions: 'QUOTATION_PAYMENT_CONDITIONS',
  termsConditions: 'QUOTATION_TERMS_AND_CONDITIONS',
};

const defaultValues = {
  quotationFormat:
    'Rocker Solar EPC Quotation\n\nCustomer: {{customerName}}\nProject Capacity: {{capacityKw}} kW\nModule: {{moduleBrand}} {{moduleWattage}}W\nInverter: {{inverterBrand}} {{inverterKw}}kW\nTotal Project Value: Rs. {{sellingPrice}}\nValidity: 7 days',
  paymentConditions:
    '1. Booking advance: 20% with order confirmation.\n2. Material dispatch: 60% before dispatch from warehouse.\n3. Installation completion: 15% after I&C completion.\n4. Final handover/net-metering: 5% before final handover.',
  termsConditions:
    '1. Price is valid only for the quoted BOM and site condition.\n2. Extra civil/structure work will be charged after written approval.\n3. Dispatch can be blocked if payment milestone is overdue.\n4. Warranty and subsidy are subject to OEM/DISCOM/government rules.',
};

const QuotationControls: React.FC = () => {
  const [form] = Form.useForm();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['project-head-quotation-settings'],
    queryFn: async () => {
      const res = await backendApi.get('/system-settings');
      return res.data.data || [];
    },
  });

  useEffect(() => {
    const byKey = new Map(settings.map((setting: any) => [setting.key, setting.value]));
    form.setFieldsValue({
      quotationFormat: byKey.get(settingKeys.quotationFormat) || defaultValues.quotationFormat,
      paymentConditions: byKey.get(settingKeys.paymentConditions) || defaultValues.paymentConditions,
      termsConditions: byKey.get(settingKeys.termsConditions) || defaultValues.termsConditions,
    });
  }, [form, settings]);

  const saveSettings = useMutation({
    mutationFn: async (values: typeof defaultValues) => {
      await Promise.all([
        backendApi.put(`/system-settings/${settingKeys.quotationFormat}`, { value: values.quotationFormat }),
        backendApi.put(`/system-settings/${settingKeys.paymentConditions}`, { value: values.paymentConditions }),
        backendApi.put(`/system-settings/${settingKeys.termsConditions}`, { value: values.termsConditions }),
      ]);
    },
    onSuccess: () => message.success('Quotation format and conditions saved'),
    onError: (error: any) => message.error(error.response?.data?.error?.message || 'Failed to save quotation controls'),
  });

  const onFinish = (values: typeof defaultValues) => {
    saveSettings.mutate(values);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Title level={2} className="!mb-0">Quotation Controls</Title>
        <Text type="secondary">
          Project Head manager-level controls for quotation format, payment conditions, and terms & conditions.
        </Text>
      </div>

      <Alert
        type="info"
        showIcon
        message="Manager control active"
        description="Sales team can prepare quotations, but low-margin quotation approval and master quotation text are controlled by Project Head/Admin."
      />

      <Card loading={isLoading}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={[24, 16]}>
            <Col xs={24} lg={12}>
              <Form.Item
                name="quotationFormat"
                label={<Space><FileText size={16} /> Quotation Format</Space>}
                rules={[{ required: true, message: 'Quotation format is required' }]}
              >
                <Input.TextArea rows={14} placeholder="Enter quotation template with placeholders" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="paymentConditions"
                label={<Space><IndianRupee size={16} /> Payment Conditions</Space>}
                rules={[{ required: true, message: 'Payment conditions are required' }]}
              >
                <Input.TextArea rows={6} placeholder="Enter payment milestones and conditions" />
              </Form.Item>
              <Form.Item
                name="termsConditions"
                label={<Space><ShieldCheck size={16} /> Terms and Conditions</Space>}
                rules={[{ required: true, message: 'Terms and conditions are required' }]}
              >
                <Input.TextArea rows={6} placeholder="Enter quotation terms and conditions" />
              </Form.Item>
            </Col>
          </Row>
          <div className="flex justify-end">
            <Button type="primary" htmlType="submit" icon={<Save size={16} />} loading={saveSettings.isPending}>
              Save Quotation Controls
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default QuotationControls;
