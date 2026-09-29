import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, Tabs, Table, Button, Modal, Form, Input, InputNumber, Switch,
  Select, Typography, Tag, Row, Col, Statistic, message, Upload,
  Popconfirm, Divider, Alert,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  SaveOutlined, SettingOutlined, ThunderboltOutlined, CalculatorOutlined,
  FileTextOutlined, DollarOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

function fmt(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}`; }

// ─── Shared column factory ─────────────────────────────────────────────────────

const editDeleteCols = (onEdit: (r: any) => void, onDelete: (r: any) => void) => ({
  title: 'Actions',
  key: 'actions',
  width: 100,
  render: (_: any, r: any) => (
    <div className="flex gap-1">
      <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(r)} />
      <Popconfirm title="Delete this item?" onConfirm={() => onDelete(r)} okText="Yes" cancelText="No">
        <Button size="small" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    </div>
  ),
});

// ─── Tab: Panels ──────────────────────────────────────────────────────────────

function PanelsTab() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const { data: panelsData, isLoading } = useQuery({
    queryKey: ['admin-panels'],
    queryFn: () => api.get('/admin/solar-config/panels').then(r => r.data.data),
  });
  const panels: any[] = panelsData || [];

  const saveMutation = useMutation({
    mutationFn: (values: any) => api.post('/admin/solar-config/panels', values),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-panels'] }); setModalOpen(false); message.success('Panel saved!'); },
  });

  const openEdit = (row: any) => { setEditing(row); form.setFieldsValue(row); setModalOpen(true); };
  const openAdd = () => { setEditing(null); form.resetFields(); setModalOpen(true); };

  const columns = [
    { title: 'Brand', dataIndex: 'brand', width: 120, sorter: (a: any, b: any) => a.brand.localeCompare(b.brand) },
    { title: 'Model', dataIndex: 'model' },
    { title: 'Wattage', dataIndex: 'wattage', width: 90, render: (v: number) => `${v}W` },
    { title: 'Voc', dataIndex: 'voc', width: 70, render: (v: number) => `${v}V` },
    { title: 'Efficiency', dataIndex: 'efficiency', width: 90, render: (v: number) => `${(v * 100).toFixed(1)}%` },
    { title: 'Size (mm)', key: 'size', width: 110, render: (_: any, r: any) => `${r.length_mm}×${r.width_mm}` },
    { title: 'DCR', dataIndex: 'isDCR', width: 60, render: (v: boolean) => v ? <Tag color="green">DCR</Tag> : <Tag>Non-DCR</Tag> },
    { title: 'Active', dataIndex: 'isActive', width: 70, render: (v: boolean) => <Switch defaultChecked={v !== false} size="small" /> },
    editDeleteCols(openEdit, () => message.warning('Delete not yet seeded in DB')),
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Text className="text-apple-textMuted">Manage solar panels shown in proposal dropdown</Text>
        <div className="flex gap-2">
          <Upload accept=".xlsx,.csv" showUploadList={false} beforeUpload={() => false} onChange={() => message.info('Excel import coming soon')}>
            <Button icon={<UploadOutlined />}>Import Excel</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Panel</Button>
        </div>
      </div>

      <Table dataSource={panels} columns={columns as any} rowKey={(r: any) => `${r.brand}-${r.model}`}
        loading={isLoading} size="small" pagination={{ pageSize: 15 }} scroll={{ x: 900 }} />

      <Modal open={modalOpen} onCancel={() => setModalOpen(false)} title={editing ? 'Edit Panel' : 'Add Panel'}
        onOk={() => form.submit()} okText="Save" width={640}>
        <Form form={form} layout="vertical" onFinish={v => saveMutation.mutate(v)}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="brand" label="Brand" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="model" label="Model" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="wattage" label="Wattage (W)" rules={[{ required: true }]}><InputNumber className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="voc" label="Voc (V)"><InputNumber className="w-full" step={0.1} /></Form.Item></Col>
            <Col span={8}><Form.Item name="vmpp" label="Vmpp (V)"><InputNumber className="w-full" step={0.1} /></Form.Item></Col>
            <Col span={8}><Form.Item name="isc" label="Isc (A)"><InputNumber className="w-full" step={0.01} /></Form.Item></Col>
            <Col span={8}><Form.Item name="impp" label="Impp (A)"><InputNumber className="w-full" step={0.01} /></Form.Item></Col>
            <Col span={8}><Form.Item name="efficiency" label="Efficiency (e.g. 0.215)"><InputNumber className="w-full" step={0.001} /></Form.Item></Col>
            <Col span={8}><Form.Item name="length_mm" label="Length (mm)"><InputNumber className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="width_mm" label="Width (mm)"><InputNumber className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="tempCoeffVoc" label="TempCoeff Voc"><InputNumber className="w-full" step={0.0001} /></Form.Item></Col>
            <Col span={8}><Form.Item name="isDCR" label="DCR Compliant" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={8}><Form.Item name="warranty_years" label="Warranty (years)"><InputNumber className="w-full" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Tab: Inverters ───────────────────────────────────────────────────────────

function InvertersTab() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inverters'],
    queryFn: () => api.get('/admin/solar-config/inverters').then(r => r.data.data),
  });
  const inverters: any[] = data || [];

  const saveMutation = useMutation({
    mutationFn: (values: any) => api.post('/admin/solar-config/inverters', values),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-inverters'] }); setModalOpen(false); message.success('Inverter saved!'); },
  });

  const columns = [
    { title: 'Brand', dataIndex: 'brand', width: 120 },
    { title: 'Model', dataIndex: 'model' },
    { title: 'Capacity', dataIndex: 'capacityKw', render: (v: number) => `${v} kW` },
    { title: 'Phase', dataIndex: 'phase', render: (v: string) => <Tag color={v === 'Three' ? 'blue' : 'purple'}>{v}-Phase</Tag> },
    { title: 'MPPT', dataIndex: 'mpptCount', render: (v: number) => `${v} trackers` },
    { title: 'Max V', dataIndex: 'maxInputVoltage', render: (v: number) => `${v}V` },
    { title: 'Efficiency', dataIndex: 'efficiency', render: (v: number) => `${(v * 100).toFixed(1)}%` },
    { title: 'Warranty', dataIndex: 'warranty_years', render: (v: number) => `${v} yr` },
    { title: 'Active', dataIndex: 'isActive', width: 70, render: (v: boolean) => <Switch defaultChecked={v !== false} size="small" /> },
    { title: 'Actions', key: 'actions', render: (_: any, r: any) => <Button size="small" icon={<EditOutlined />} onClick={() => { form.setFieldsValue(r); setModalOpen(true); }} /> },
  ];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Add Inverter</Button>
      </div>
      <Table dataSource={inverters} columns={columns as any} rowKey={(r: any) => `${r.brand}-${r.model}`} loading={isLoading} size="small" />
      <Modal open={modalOpen} onCancel={() => setModalOpen(false)} title="Add / Edit Inverter" onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={v => saveMutation.mutate(v)}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="brand" label="Brand" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="model" label="Model" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="capacityKw" label="Capacity (kW)"><InputNumber className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="maxInputVoltage" label="Max Input V"><InputNumber className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="mpptCount" label="MPPT Count"><InputNumber className="w-full" min={1} max={6} /></Form.Item></Col>
            <Col span={8}><Form.Item name="efficiency" label="Efficiency (e.g. 0.980)"><InputNumber className="w-full" step={0.001} /></Form.Item></Col>
            <Col span={8}><Form.Item name="phase" label="Phase"><Select><Option value="Single">Single Phase</Option><Option value="Three">Three Phase</Option></Select></Form.Item></Col>
            <Col span={8}><Form.Item name="warranty_years" label="Warranty (years)"><InputNumber className="w-full" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Tab: Pricing ─────────────────────────────────────────────────────────────

function PricingTab() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-pricing'],
    queryFn: () => api.get('/admin/solar-config/pricing').then(r => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => api.patch('/admin/solar-config/pricing', values),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-pricing'] }); message.success('Pricing defaults updated!'); },
  });

  if (data && !form.isFieldsTouched()) form.setFieldsValue(data);

  return (
    <Card bordered={false}>
      <Alert message="These are default rates used when creating new proposals. Salesperson can override per-proposal." type="info" showIcon className="mb-4" />
      <Form form={form} layout="vertical" onFinish={v => saveMutation.mutate(v)} initialValues={data}>
        <Row gutter={[16, 4]}>
          <Col span={8}><Form.Item name="panelRatePerW" label="Panel Rate (₹/W)"><InputNumber className="w-full" min={0} step={0.5} /></Form.Item></Col>
          <Col span={8}><Form.Item name="inverterRatePerKw" label="Inverter Rate (₹/kW)"><InputNumber className="w-full" min={0} step={500} /></Form.Item></Col>
          <Col span={8}><Form.Item name="mountingRatePerKw" label="Mounting Rate (₹/kW)"><InputNumber className="w-full" min={0} step={500} /></Form.Item></Col>
          <Col span={8}><Form.Item name="cablesRatePerKw" label="Cables Rate (₹/kW)"><InputNumber className="w-full" min={0} step={250} /></Form.Item></Col>
          <Col span={8}><Form.Item name="installRatePerKw" label="Install Rate (₹/kW)"><InputNumber className="w-full" min={0} step={250} /></Form.Item></Col>
          <Divider className="col-span-3 !my-2" />
          <Col span={8}><Form.Item name="gstPanelPct" label="GST on Panels (%)"><InputNumber className="w-full" min={0} max={30} /></Form.Item></Col>
          <Col span={8}><Form.Item name="gstInverterPct" label="GST on Inverter (%)"><InputNumber className="w-full" min={0} max={30} /></Form.Item></Col>
          <Col span={8}><Form.Item name="gstInstallPct" label="GST on Install (%)"><InputNumber className="w-full" min={0} max={30} /></Form.Item></Col>
        </Row>
        <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saveMutation.isPending}>
          Save Pricing Defaults
        </Button>
      </Form>
    </Card>
  );
}

// ─── Tab: Subsidy Slabs ───────────────────────────────────────────────────────

function SubsidyTab() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const { data } = useQuery({
    queryKey: ['admin-subsidy'],
    queryFn: () => api.get('/admin/solar-config/subsidy').then(r => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => api.patch('/admin/solar-config/subsidy', values),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-subsidy'] }); message.success('Subsidy slabs updated!'); },
  });

  return (
    <Card bordered={false}>
      <Alert message="Subsidy amounts are set by government — update here when MNRE revises the slabs. Changes take effect immediately for new proposals." type="warning" showIcon className="mb-4" />
      <Form form={form} layout="vertical" onFinish={v => saveMutation.mutate(v)} initialValues={data}>
        <Title level={5}>PM Surya Ghar Yojana</Title>
        <div className="overflow-x-auto">
          <table className="w-full mb-4 text-sm">
            <thead><tr className="bg-slate-100"><th className="p-2 text-left">Min kW</th><th className="p-2 text-left">Max kW</th><th className="p-2 text-left">Rate (₹/kW)</th><th className="p-2 text-left">Flat Amount (₹)</th></tr></thead>
            <tbody>
              {[
                { min: '0', max: '2', rate: '30,000', flat: '—' },
                { min: '2', max: '3', rate: '18,000', flat: '—' },
                { min: '3', max: '∞', rate: '—', flat: '78,000 (cap)' },
              ].map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-apple-cardLight dark:bg-apple-cardDark' : 'bg-transparent'}>
                  <td className="p-2">{r.min} kW</td>
                  <td className="p-2">{r.max}{r.max !== '∞' ? ' kW' : ''}</td>
                  <td className="p-2"><strong>{r.rate}</strong></td>
                  <td className="p-2">{r.flat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Title level={5}>Delhi CM Scheme</Title>
        <div className="overflow-x-auto">
          <table className="w-full mb-4 text-sm">
            <thead><tr className="bg-slate-100"><th className="p-2 text-left">Size</th><th className="p-2 text-left">Amount</th></tr></thead>
            <tbody>
              <tr><td className="p-2">≤ 3 kW</td><td className="p-2"><strong>₹2,000/kW</strong></td></tr>
              <tr className="bg-transparent"><td className="p-2">&gt; 3 kW</td><td className="p-2"><strong>₹6,000 flat</strong></td></tr>
            </tbody>
          </table>
        </div>
        <Form.Item name="effectiveFrom" label="Effective From">
          <Input type="date" className="w-48" />
        </Form.Item>
        <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saveMutation.isPending}>
          Save Subsidy Config
        </Button>
      </Form>
    </Card>
  );
}

// ─── Tab: Proposal Template ───────────────────────────────────────────────────

function TemplateTab() {
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const { data } = useQuery({
    queryKey: ['admin-template'],
    queryFn: () => api.get('/admin/solar-config/template').then(r => r.data.data),
  });

  const saveMutation = useMutation({
    mutationFn: (vals: any) => api.patch('/admin/solar-config/template', vals),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-template'] }); message.success('Template settings saved!'); },
  });

  if (data && !form.isFieldsTouched()) form.setFieldsValue({
    ...data,
    milestone0: data.paymentMilestones?.[0]?.pct,
    milestone1: data.paymentMilestones?.[1]?.pct,
    milestone2: data.paymentMilestones?.[2]?.pct,
    milestone3: data.paymentMilestones?.[3]?.pct,
  });

  return (
    <Card bordered={false}>
      <Form form={form} layout="vertical" onFinish={v => {
        const { milestone0, milestone1, milestone2, milestone3, ...rest } = v;
        saveMutation.mutate({
          ...rest,
          paymentMilestones: [
            { label: 'Booking', pct: milestone0 || 10 },
            { label: 'Material Delivery', pct: milestone1 || 40 },
            { label: 'Installation Start', pct: milestone2 || 30 },
            { label: 'Commissioning', pct: milestone3 || 20 },
          ],
        });
      }}>
        <Row gutter={[16, 4]}>
          <Col span={12}><Form.Item name="companyName" label="Company Name"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="tagline" label="Company Tagline"><Input /></Form.Item></Col>
          <Col span={24}>
            <div className="mb-2">
              <Text strong>Company Logo</Text>
            </div>
            <Upload listType="picture-card" maxCount={1} beforeUpload={() => false}>
              <div><PlusOutlined /><div className="mt-1 text-xs">Upload Logo</div></div>
            </Upload>
          </Col>
          <Col span={24}><Form.Item name="termsText" label="Terms & Conditions Text"><TextArea rows={4} /></Form.Item></Col>
          <Col span={24}><Form.Item name="warrantyText" label="Warranty Text"><TextArea rows={3} /></Form.Item></Col>
          <Col span={24}><Form.Item name="footerText" label="PDF Footer Text"><Input /></Form.Item></Col>
        </Row>

        <Divider>Payment Milestones (%)</Divider>
        <Row gutter={12}>
          {['Booking', 'Material Delivery', 'Installation Start', 'Commissioning'].map((label, i) => (
            <Col key={i} span={6}>
              <Form.Item name={`milestone${i}`} label={label}
                rules={[{ type: 'number', min: 0, max: 100, message: '0–100' }]}>
                <InputNumber className="w-full" min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
          ))}
        </Row>
        <div className="text-xs text-apple-gray mb-4">Milestone percentages should sum to 100%.</div>

        <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saveMutation.isPending}>
          Save Template Settings
        </Button>
      </Form>
    </Card>
  );
}

// ─── Analytics Summary ────────────────────────────────────────────────────────

function AnalyticsCard() {
  const { data } = useQuery({
    queryKey: ['proposal-analytics'],
    queryFn: () => api.get('/proposals/analytics').then(r => r.data.data),
    refetchInterval: 60000,
  });

  if (!data) return null;

  return (
    <Card bordered={false} className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50" title={<><CalculatorOutlined className="mr-2 text-blue-600" />Proposal Analytics</>}>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}><Statistic title="Total Proposals" value={data.total} /></Col>
        <Col xs={12} sm={8} md={4}><Statistic title="This Month" value={data.thisMonth} /></Col>
        <Col xs={12} sm={8} md={4}><Statistic title="Conversion Rate" value={data.conversionRate} suffix="%" /></Col>
        <Col xs={12} sm={8} md={4}><Statistic title="Avg System" value={data.avgSystemKw} suffix="kW" precision={1} /></Col>
        <Col xs={12} sm={8} md={4}><Statistic title="Avg Deal Value" value={`₹${Math.round(data.avgDealValue / 1000)}k`} /></Col>
        <Col xs={12} sm={8} md={4}><Statistic title="Top Brand" value={data.topBrand} /></Col>
      </Row>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TAB_ITEMS = [
  { key: 'panels', label: <><ThunderboltOutlined />Solar Panels</>, children: <PanelsTab /> },
  { key: 'inverters', label: <><SettingOutlined />Inverters</>, children: <InvertersTab /> },
  { key: 'pricing', label: <><DollarOutlined />Pricing Defaults</>, children: <PricingTab /> },
  { key: 'subsidy', label: <><CalculatorOutlined />Subsidy Slabs</>, children: <SubsidyTab /> },
  { key: 'template', label: <><FileTextOutlined />Proposal Template</>, children: <TemplateTab /> },
];

export default function AdminSolarConfig() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div>
        <Title level={3} className="!mb-1">
          <SettingOutlined className="mr-2 text-blue-600" />
          Solar Engine Configuration
        </Title>
        <Text type="secondary">Manage product database, default pricing, subsidy slabs, and proposal template settings.</Text>
      </div>

      <AnalyticsCard />

      <Card bordered={false} className="shadow-sm">
        <Tabs items={TAB_ITEMS} type="card" size="large" />
      </Card>
    </div>
  );
}

