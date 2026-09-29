import React, { useState } from 'react';
import { Tabs, Card, Table, Tag, Button, Modal, Form, Select, InputNumber, Input, DatePicker, message, Space, Row, Col } from 'antd';
import { IndianRupee, MessageCircle, Mail, FileText, CheckCircle } from 'lucide-react';
import CustomerLink from '../../components/CustomerLink';
const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

const mockReceivables = [
  { id: '1', customer: 'Vikram Singh', cid: 'CUST-8820', inv: 'INV-26001', amount: 150000, due: '2026-02-15', daysOverdue: 35, status: 'OVERDUE' },
  { id: '2', customer: 'Neha Patel', cid: 'CUST-8815', inv: 'INV-26012', amount: 85000, due: '2026-03-20', daysOverdue: 2, status: 'OVERDUE' },
  { id: '3', customer: 'Anjali Desai', cid: 'CUST-8810', inv: 'INV-26022', amount: 110000, due: '2026-03-25', daysOverdue: 0, status: 'DUE_THIS_WEEK' },
  { id: '4', customer: 'Rajesh Kumar', cid: 'CUST-8891', inv: 'INV-26045', amount: 45000, due: '2026-04-10', daysOverdue: 0, status: 'DUE_THIS_MONTH' },
];

const Receivables: React.FC = () => {
  const [activeTab, setActiveTab] = useState('OVERDUE');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRecordPayment = (record: any) => {
    setSelectedRecord(record);
    form.setFieldsValue({
      amount: record.amount,
      milestone: 'FIRST_INSTALLMENT',
      mode: 'NEFT',
    });
    setPaymentModalVisible(true);
  };

  const submitPayment = () => {
    setIsProcessing(true);
    form.validateFields().then(values => {
      setTimeout(() => {
        setIsProcessing(false);
        setPaymentModalVisible(false);
        message.success("Payment recorded! Receipt generated and emailed to customer.");
        form.resetFields();
      }, 1000);
    }).catch(() => setIsProcessing(false));
  };

  const sendReminder = (record: any) => {
    message.success(`Reminder sent to ${record.customer} via WhatsApp & Email`);
  };

  const bulkSendReminders = () => {
    if (selectedRowKeys.length === 0) return message.warning("Select customers first");
    message.success(`Reminders dispatched to ${selectedRowKeys.length} customers.`);
    setSelectedRowKeys([]);
  };

  const columns = [
    { title: 'Customer', dataIndex: 'customer', key: 'customer', render: (t: string, r: any) => <CustomerLink name={t} customerCode={r.cid} customerId={r.id} /> },
    { title: 'Invoice No', dataIndex: 'inv', key: 'inv', render: (t: string) => <span className="text-blue-600 font-medium cursor-pointer flex items-center"><FileText size={14} className="mr-1"/>{t}</span> },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (val: number) => <span className="font-bold text-apple-textLight dark:text-apple-textDark">₹{val.toLocaleString()}</span> },
    { title: 'Due Date', dataIndex: 'due', key: 'due' },
    { title: 'Status', key: 'status', render: (_: unknown, r: any) => (
      r.status === 'OVERDUE' ? <Tag color="error">Overdue by {r.daysOverdue} days</Tag> :
      r.status === 'DUE_THIS_WEEK' ? <Tag color="warning">Due this week</Tag> :
      <Tag color="processing">Due later</Tag>
    )},
    { title: 'Actions', key: 'actions', render: (_: unknown, r: any) => (
      <Space>
        <Button size="small" type="primary" className="bg-emerald-600" onClick={() => handleRecordPayment(r)}>Record Payment</Button>
        <Button size="small" icon={<MessageCircle size={14}/>} onClick={() => sendReminder(r)} />
      </Space>
    )}
  ];

  const filteredData = activeTab === 'ALL' ? mockReceivables : mockReceivables.filter(m => m.status === activeTab);

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark">Accounts Receivable</h1>
        <Button type="primary" onClick={bulkSendReminders} disabled={selectedRowKeys.length === 0} icon={<Mail size={16}/>}>Bulk Send Reminders</Button>
      </div>

      <Card className="shadow-sm rounded-lg" bodyStyle={{ padding: '4px 24px 24px' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
          <TabPane tab={<span className="text-red-500 font-medium">Overdue</span>} key="OVERDUE" />
          <TabPane tab={<span className="text-amber-500 font-medium">Due This Week</span>} key="DUE_THIS_WEEK" />
          <TabPane tab={<span className="text-blue-500 font-medium">Due This Month</span>} key="DUE_THIS_MONTH" />
          <TabPane tab="All Receivables" key="ALL" />
        </Tabs>

        <Table 
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          columns={columns} 
          dataSource={filteredData} 
          rowKey="id"
          pagination={{ pageSize: 15 }}
        />
      </Card>

      {/* RECORD PAYMENT MODAL */}
      <Modal
        title={
          <div className="flex items-center">
            <div className="bg-emerald-100 p-2 rounded-full mr-3"><IndianRupee size={20} className="text-emerald-600"/></div>
            <div>
              <div className="text-lg">Record Payment</div>
              <div className="text-sm font-normal text-apple-textMuted">{selectedRecord?.customer} ({selectedRecord?.inv})</div>
            </div>
          </div>
        }
        open={paymentModalVisible}
        onOk={submitPayment}
        onCancel={() => setPaymentModalVisible(false)}
        okText="Record & Generate Receipt"
        okButtonProps={{ className: 'bg-emerald-600 border-emerald-600 hover:bg-emerald-700' }}
        confirmLoading={isProcessing}
        width={600}
      >
        <Form form={form} layout="vertical" className="mt-6">
          <Row gutter={16}>
             <Col span={12}>
                <Form.Item name="amount" label="Payment Amount (₹)" rules={[{ required: true }]}>
                   <InputNumber className="w-full text-lg font-bold" min={1} />
                </Form.Item>
                <div className="text-xs text-apple-textMuted -mt-4 mb-4">Outstanding: ₹{selectedRecord?.amount.toLocaleString()}</div>
             </Col>
             <Col span={12}>
                <Form.Item name="paymentDate" label="Payment Date" rules={[{ required: true }]}>
                   <DatePicker className="w-full" />
                </Form.Item>
             </Col>
          </Row>

          <Row gutter={16}>
             <Col span={12}>
                <Form.Item name="milestone" label="Payment Milestone" rules={[{ required: true }]}>
                   <Select>
                     <Option value="BOOKING">Booking Amount</Option>
                     <Option value="FIRST_INSTALLMENT">First Installment</Option>
                     <Option value="SECOND_INSTALLMENT">Second Installment</Option>
                     <Option value="FINAL">Final Payment</Option>
                     <Option value="CUSTOM">Custom</Option>
                   </Select>
                </Form.Item>
             </Col>
             <Col span={12}>
                <Form.Item name="mode" label="Payment Mode" rules={[{ required: true }]}>
                   <Select>
                     <Option value="NEFT">NEFT / RTGS</Option>
                     <Option value="UPI">UPI</Option>
                     <Option value="CHEQUE">Cheque</Option>
                     <Option value="CASH">Cash</Option>
                   </Select>
                </Form.Item>
             </Col>
          </Row>

          <Form.Item name="transactionRef" label="Transaction Reference No. (Optional)">
             <Input placeholder="UTR, Cheque Number, or Task ID..." />
          </Form.Item>

          <Form.Item name="notes" label="Accountant Notes">
             <TextArea rows={2} placeholder="Any specific remarks on this payment collection..." />
          </Form.Item>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex text-blue-700 text-sm mt-4">
             <CheckCircle size={16} className="mr-2 mt-0.5 shrink-0"/>
             A PDF Receipt will be automatically generated and emailed to the customer upon saving.
          </div>
        </Form>
      </Modal>

    </div>
  );
};

export default Receivables;
