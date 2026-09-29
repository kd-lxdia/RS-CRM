import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Divider, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Send, ShieldCheck } from 'lucide-react';
import backendApi from '../../lib/axios';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  GENERATED: 'green',
  APPROVAL_PENDING: 'gold',
  APPROVED: 'blue',
  REJECTED: 'red',
  SENT: 'purple',
  DRAFT: 'default',
};

const B2bPiPage: React.FC = () => {
  const [form] = Form.useForm();
  const [materialForm] = Form.useForm();
  const [materialOpen, setMaterialOpen] = useState(false);
  const [useNewParty, setUseNewParty] = useState(false);
  const [approval, setApproval] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [approvalRemark, setApprovalRemark] = useState('');
  const userRole = useAuthStore((state) => state.user?.role);
  const canApprove = userRole === 'ADMIN' || userRole === 'PROJECT_HEAD';
  const canCreatePi = userRole === 'CALLING_STAFF' || userRole === 'SALESPERSON' || userRole === 'ADMIN';
  const queryClient = useQueryClient();

  const { data: parties = [], isLoading: partiesLoading } = useQuery({
    queryKey: ['b2b-parties'],
    queryFn: async () => {
      const res = await backendApi.get('/b2b-pi/parties');
      return res.data.data || [];
    },
  });

  const { data: priceItems = [], isLoading: priceLoading } = useQuery({
    queryKey: ['b2b-price-items'],
    queryFn: async () => {
      const res = await backendApi.get('/b2b-pi/price-items');
      return res.data.data || [];
    },
  });

  const { data: pis = [], isLoading: pisLoading } = useQuery({
    queryKey: ['b2b-pis'],
    queryFn: async () => {
      const res = await backendApi.get('/b2b-pi/pis');
      return res.data.data || [];
    },
    refetchInterval: 30000,
  });

  const priceItemMap = useMemo(() => new Map(priceItems.map((item: any) => [item.id, item])), [priceItems]);

  const createPi = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        partyId: useNewParty ? undefined : values.partyId,
        party: useNewParty ? values.party : undefined,
        validityDate: values.validityDate,
        freightAmount: values.freightAmount || 0,
        paymentTerms: values.paymentTerms,
        dispatchTimeline: values.dispatchTimeline,
        maxAdjustmentPercent: 2,
        lines: values.lines,
      };
      const res = await backendApi.post('/b2b-pi/pis', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      message.success(data.status === 'APPROVAL_PENDING' ? 'PI saved as draft and sent for approval' : 'PI generated within approval limit');
      form.resetFields();
      setUseNewParty(false);
      queryClient.invalidateQueries({ queryKey: ['b2b-pis'] });
      queryClient.invalidateQueries({ queryKey: ['b2b-parties'] });
    },
    onError: (error: any) => message.error(error.response?.data?.error?.message || error.message || 'Failed to create PI'),
  });

  const canAddMaterial = userRole === 'ADMIN' || userRole === 'PROJECT_HEAD';
  const createMaterial = useMutation({
    mutationFn: async (values: any) => {
      const res = await backendApi.post('/b2b-pi/price-items', values);
      return res.data.data;
    },
    onSuccess: (data) => {
      message.success(`Material "${data.itemName}" added to price list`);
      materialForm.resetFields();
      setMaterialOpen(false);
      queryClient.invalidateQueries({ queryKey: ['b2b-price-items'] });
    },
    onError: (error: any) => message.error(error.response?.data?.error?.message || error.message || 'Failed to add material'),
  });

  const approvalMutation = useMutation({
    mutationFn: async () => {
      if (!approval) throw new Error('No PI selected.');
      const endpoint = approval.action === 'approve' ? 'approve' : 'reject';
      const res = await backendApi.post(`/b2b-pi/pis/${approval.id}/${endpoint}`, { remark: approvalRemark });
      return res.data.data;
    },
    onSuccess: () => {
      message.success(approval?.action === 'approve' ? 'PI approved' : 'PI rejected');
      setApproval(null);
      setApprovalRemark('');
      queryClient.invalidateQueries({ queryKey: ['b2b-pis'] });
    },
    onError: (error: any) => message.error(error.response?.data?.error?.message || error.message || 'Approval action failed'),
  });

  const sendPi = useMutation({
    mutationFn: async (id: string) => {
      const res = await backendApi.post(`/b2b-pi/pis/${id}/send`);
      return res.data.data;
    },
    onSuccess: () => {
      message.success('PI marked as sent');
      queryClient.invalidateQueries({ queryKey: ['b2b-pis'] });
    },
    onError: (error: any) => message.error(error.response?.data?.error?.message || 'Unable to send PI'),
  });

  const piColumns = [
    { title: 'PI No.', dataIndex: 'piNumber', key: 'piNumber', render: (value: string) => <span className="font-semibold">{value}</span> },
    { title: 'Party', dataIndex: ['party', 'firmName'], key: 'party' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (value: string) => <Tag color={statusColor[value] || 'default'}>{value}</Tag> },
    { title: 'Max Adj.', dataIndex: 'maxLineAdjustmentPercent', key: 'maxLineAdjustmentPercent', render: (value: number) => `${Number(value || 0).toFixed(2)}%` },
    { title: 'Margin Impact', dataIndex: 'marginImpactAmount', key: 'marginImpactAmount', render: (value: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}` },
    { title: 'Total', dataIndex: 'totalAmount', key: 'totalAmount', render: (value: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}` },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, row: any) => (
        <Space wrap>
          {canApprove && row.status === 'APPROVAL_PENDING' ? (
            <>
              <Button size="small" type="primary" onClick={() => setApproval({ id: row.id, action: 'approve' })}>Approve</Button>
              <Button size="small" danger onClick={() => setApproval({ id: row.id, action: 'reject' })}>Reject</Button>
            </>
          ) : null}
          {['GENERATED', 'APPROVED'].includes(row.status) ? (
            <Button size="small" icon={<Send size={14} />} loading={sendPi.isPending && sendPi.variables === row.id} onClick={() => sendPi.mutate(row.id)}>
              Mark Sent
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Title level={2} className="!mb-1 flex items-center gap-2"><FileText /> B2B Instant PI</Title>
        <Text type="secondary">
          {canCreatePi
            ? 'Calling team creates dealer/party PI with 2% price-control.'
            : 'Project Head manager approval queue for B2B PI requests.'}
        </Text>
      </div>

      <Alert
        type="info"
        showIcon
        message="Acceptance Test 1 rule active"
        description="Adjustment up to 2% generates PI. Adjustment above 2% keeps PI in approval-pending status until Project Head/Admin approves it with a remark."
      />

      {priceItems.length === 0 && !priceLoading ? (
        <Alert
          type="warning"
          showIcon
          message="Price list khali hai"
          description={canAddMaterial
            ? 'PI banane se pehle materials add karein — "Add Material" button se panels/inverters/structure ke rate daalein.'
            : 'Price list mein abhi koi material nahi hai. Admin/Project Head se material add karwayein.'}
          action={canAddMaterial ? <Button type="primary" onClick={() => setMaterialOpen(true)}>Add Material</Button> : undefined}
        />
      ) : null}

      {canCreatePi ? (
      <Card
        title={<Space><Plus size={16} /> Create PI</Space>}
        extra={canAddMaterial ? <Button onClick={() => setMaterialOpen(true)} icon={<Plus size={14} />}>Add Material</Button> : null}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            validityDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
            freightAmount: 0,
            lines: [{ quantity: 1, adjustmentPercent: 0 }],
          }}
          onFinish={(values) => createPi.mutate(values)}
        >
          <Row gutter={[16, 0]}>
            <Col xs={24}>
              <Button type={useNewParty ? 'primary' : 'default'} onClick={() => setUseNewParty(!useNewParty)}>
                {useNewParty ? 'Using New Party' : 'Use New Party'}
              </Button>
            </Col>
            {!useNewParty ? (
              <Col xs={24} md={12}>
                <Form.Item name="partyId" label="Existing B2B Party / Dealer" rules={[{ required: true, message: 'Select a party' }]}>
                  <Select
                    loading={partiesLoading}
                    showSearch
                    optionFilterProp="label"
                    options={parties.map((party: any) => ({ value: party.id, label: `${party.firmName} - ${party.phone}` }))}
                  />
                </Form.Item>
              </Col>
            ) : (
              <>
                <Col xs={24} md={8}><Form.Item name={['party', 'partyName']} label="Party Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name={['party', 'firmName']} label="Firm Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name={['party', 'gstNumber']} label="GST Number"><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name={['party', 'contactPerson']} label="Contact Person" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name={['party', 'phone']} label="Phone" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name={['party', 'email']} label="Email"><Input /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name={['party', 'billingAddress']} label="Billing Address" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name={['party', 'shippingAddress']} label="Shipping Address" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item></Col>
              </>
            )}
            <Col xs={24} md={8}><Form.Item name="validityDate" label="Validity Date" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="paymentTerms" label="Payment Terms"><Input placeholder="30% advance, balance before dispatch" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="dispatchTimeline" label="Dispatch Timeline"><Input placeholder="3-5 working days" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="freightAmount" label="Freight"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Divider />

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <div className="space-y-3">
                {fields.map((field) => {
                  const { key, ...fieldProps } = field;
                  return (
                  <Row gutter={[16, 0]} key={key} align="middle">
                    <Col xs={24} md={8}>
                      <Form.Item {...fieldProps} name={[field.name, 'priceListItemId']} label="Material" rules={[{ required: true }]}>
                        <Select
                          loading={priceLoading}
                          showSearch
                          optionFilterProp="label"
                          options={priceItems.map((item: any) => ({
                            value: item.id,
                            label: `${item.sku} - ${item.itemName} - Rs. ${Number(item.basePrice).toLocaleString('en-IN')}`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item {...fieldProps} name={[field.name, 'quantity']} label="Qty" rules={[{ required: true }]}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item {...fieldProps} name={[field.name, 'adjustmentPercent']} label="Adjustment %">
                        <InputNumber style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item shouldUpdate noStyle>
                        {() => {
                          const line = form.getFieldValue(['lines', field.name]) || {};
                          const item: any = priceItemMap.get(line.priceListItemId);
                          const base = Number(item?.basePrice || 0);
                          const final = base * (1 + Number(line.adjustmentPercent || 0) / 100);
                          return (
                            <Form.Item {...fieldProps} name={[field.name, 'adjustmentReason']} label={`Reason / Final: Rs. ${Math.round(final).toLocaleString('en-IN')}`}>
                              <Input placeholder="Mandatory if adjustment is not 0" />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={2}>
                      <Button danger onClick={() => remove(field.name)} disabled={fields.length === 1}>Remove</Button>
                    </Col>
                  </Row>
                  );
                })}
                <Button onClick={() => add({ quantity: 1, adjustmentPercent: 0 })}>Add Line</Button>
              </div>
            )}
          </Form.List>

          <div className="flex justify-end mt-6">
            <Button type="primary" htmlType="submit" loading={createPi.isPending} icon={<ShieldCheck size={16} />}>
              Generate / Request Approval
            </Button>
          </div>
        </Form>
      </Card>
      ) : null}

      <Card title="PI History and Approval Queue">
        <Table columns={piColumns} dataSource={pis} rowKey="id" loading={pisLoading} pagination={{ pageSize: 8 }} />
      </Card>

      <Modal
        title="Add Material to Price List"
        open={materialOpen}
        confirmLoading={createMaterial.isPending}
        onCancel={() => setMaterialOpen(false)}
        onOk={() => materialForm.submit()}
        okText="Save Material"
        width={640}
      >
        <Form form={materialForm} layout="vertical" onFinish={(v) => createMaterial.mutate(v)} initialValues={{ unit: 'Nos', gstPercent: 12 }}>
          <Row gutter={[12, 0]}>
            <Col xs={24} md={8}><Form.Item name="sku" label="SKU / Code" rules={[{ required: true }]}><Input placeholder="WAAREE-580-DCR" /></Form.Item></Col>
            <Col xs={24} md={8}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select options={['PANEL', 'INVERTER', 'STRUCTURE', 'CABLE', 'BOS', 'BATTERY', 'OTHER'].map((c) => ({ value: c, label: c }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}><Form.Item name="itemName" label="Item Name" rules={[{ required: true }]}><Input placeholder="Waaree 580Wp Mono PERC" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="brand" label="Brand"><Input placeholder="Waaree" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="model" label="Model"><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="wattage" label="Wattage (Wp)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}>
              <Form.Item name="dcrType" label="DCR / Non-DCR">
                <Select allowClear options={[{ value: 'DCR', label: 'DCR' }, { value: 'NON_DCR', label: 'Non-DCR' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}><Form.Item name="unit" label="Unit"><Select options={['Nos', 'Set', 'Meter', 'Kg', 'Pallet'].map((u) => ({ value: u, label: u }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="basePrice" label="Base Price (Rs.)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="gstPercent" label="GST %"><InputNumber min={0} max={28} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={approval?.action === 'approve' ? 'Approve PI' : 'Reject PI'}
        open={!!approval}
        confirmLoading={approvalMutation.isPending}
        onCancel={() => {
          setApproval(null);
          setApprovalRemark('');
        }}
        onOk={() => approvalMutation.mutate()}
        okText={approval?.action === 'approve' ? 'Approve' : 'Reject'}
        okButtonProps={{ danger: approval?.action === 'reject' }}
      >
        <Form layout="vertical">
          <Form.Item label="Mandatory remark">
            <Input.TextArea rows={4} value={approvalRemark} onChange={(event) => setApprovalRemark(event.target.value)} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default B2bPiPage;
