import React, { useState } from 'react';
import { Tabs, Card, Table, Tag, Input, Button, Modal, Select, InputNumber, Drawer, Form, Space } from 'antd';
import { Search, Download, ArrowDownToLine, ArrowUpToLine, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

// Mock Inventory Data
const mockInventory = [
  { id: '1', sku: 'TS-540', name: 'Trina Solar 540W Mono', category: 'PANEL', qty: 120, unit: 'pcs', threshold: 50 },
  { id: '2', sku: 'GW-5K', name: 'Growatt MIN 5000', category: 'INVERTER', qty: 5, unit: 'pcs', threshold: 10 },
  { id: '3', sku: 'AL-STR-1', name: 'Aluminum Mounting Structure', category: 'STRUCTURE', qty: 0, unit: 'sets', threshold: 20 },
  { id: '4', sku: 'DC-4MM', name: '4mm DC Cable Red', category: 'CABLE', qty: 2500, unit: 'meters', threshold: 1000 },
];

const StockInventory: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchText, setSearchText] = useState('');
  
  // Modal State
  const [txModalVisible, setTxModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [form] = Form.useForm();

  const handleTransaction = (item: any, type: string) => {
    setSelectedItem(item);
    form.setFieldsValue({ type, quantity: 1 });
    setTxModalVisible(true);
  };

  const submitTransaction = () => {
    form.validateFields().then(values => {
      // POST /api/warehouse/stock/:id/transaction
      setTxModalVisible(false);
      form.resetFields();
    });
  };

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120, render: (text: string) => <span className="font-mono text-apple-textMuted">{text}</span> },
    { title: 'Item Name', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (text: string) => <Tag color="blue">{text}</Tag> },
    { 
      title: 'Quantity', 
      key: 'qty', 
      render: (_: unknown, record: any) => (
        <span className="font-bold">
          {record.qty} <span className="text-xs text-apple-gray font-normal">{record.unit}</span>
        </span>
      ) 
    },
    { 
      title: 'Status', 
      key: 'status',
      render: (_: unknown, record: any) => {
        if (record.qty <= 0) return <Tag color="error">Out of Stock</Tag>;
        if (record.qty <= record.threshold) return <Tag color="warning">Low Stock ({record.qty})</Tag>;
        return <Tag color="success">In Stock</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: any) => (
        <Space size="middle">
          <Button size="small" className="text-green-600 border-green-200" icon={<ArrowDownToLine size={14}/>} onClick={() => handleTransaction(record, 'IN')}>In</Button>
          <Button size="small" className="text-red-500 border-red-200" icon={<ArrowUpToLine size={14}/>} onClick={() => handleTransaction(record, 'OUT')} disabled={record.qty <= 0}>Out</Button>
          <Button size="small" type="text" icon={<History size={14}/>} onClick={() => navigate('/warehouse/history')}></Button>
        </Space>
      )
    }
  ];

  const filteredData = mockInventory.filter(item => {
    const matchTab = activeTab === 'ALL' || item.category === activeTab;
    const matchSearch = item.name.toLowerCase().includes(searchText.toLowerCase()) || item.sku.toLowerCase().includes(searchText.toLowerCase());
    return matchTab && matchSearch;
  });

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark">Stock Inventory</h1>
        <Button type="primary" icon={<Download size={16} />} className="bg-emerald-600 hover:bg-emerald-700">Export to Excel</Button>
      </div>

      <Card className="shadow-sm rounded-lg" bodyStyle={{ padding: '16px 24px' }}>
        <div className="flex justify-between items-center mb-4">
          <Tabs activeKey={activeTab} onChange={setActiveTab} className="mb-0" style={{ marginBottom: 0 }}>
            <TabPane tab="All Items" key="ALL" />
            <TabPane tab="Panels" key="PANEL" />
            <TabPane tab="Inverters" key="INVERTER" />
            <TabPane tab="Structure" key="STRUCTURE" />
            <TabPane tab="Cables" key="CABLE" />
          </Tabs>
          <Input 
            placeholder="Search SKU or Name..." 
            prefix={<Search size={16} className="text-apple-gray"/>} 
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
        </div>

        <Table 
          columns={columns} 
          dataSource={filteredData} 
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* TRANSACTION MODAL */}
      <Modal
        title={`Stock Transaction - ${selectedItem?.name} (${selectedItem?.sku})`}
        open={txModalVisible}
        onOk={submitTransaction}
        onCancel={() => setTxModalVisible(false)}
        okText="Confirm Transaction"
        okButtonProps={{ className: form.getFieldValue('type') === 'OUT' ? 'bg-red-500 border-red-500 hover:bg-red-600' : 'bg-green-600 border-green-600 hover:bg-green-700' }}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="flex gap-4 mb-4">
            <Form.Item name="type" label="Transaction Type" className="flex-1" rules={[{ required: true }]}>
              <Select>
                <Option value="IN"><span className="text-green-600 font-medium">Stock IN (+)</span></Option>
                <Option value="OUT"><span className="text-red-500 font-medium">Stock OUT (-)</span></Option>
                <Option value="ADJUSTMENT">Adjustment</Option>
              </Select>
            </Form.Item>
            <Form.Item name="quantity" label="Quantity" className="flex-1" rules={[{ required: true }]}>
              <InputNumber min={1} className="w-full" />
            </Form.Item>
          </div>
          
          <Form.Item name="reference" label="Reference ID (Invoice / Customer ID)" rules={[{ required: true }]}>
            <Input placeholder="e.g. INV-10023 or CUST-8815" />
          </Form.Item>

          <Form.Item name="notes" label="Notes">
            <TextArea rows={2} placeholder="Optional transaction notes..." />
          </Form.Item>

          {/* PREVIEW BOX */}
          <div className="bg-transparent p-3 rounded border border-transparent flex justify-between items-center text-sm mt-4">
            <span className="text-apple-textMuted">Current Stock: <strong className="text-apple-textLight dark:text-apple-textDark">{selectedItem?.qty}</strong></span>
            <span className="text-blue-500">→</span>
            <span className="text-apple-textMuted">New Stock: <strong className="text-apple-textLight dark:text-apple-textDark font-bold">
              <Form.Item noStyle dependencies={['type', 'quantity']}>
                {({ getFieldValue }) => {
                  const t = getFieldValue('type');
                  const q = getFieldValue('quantity') || 0;
                  const current = selectedItem?.qty || 0;
                  if (t === 'IN') return current + q;
                  if (t === 'OUT') return current - q;
                  return current + q; // For adj
                }}
              </Form.Item>
            </strong></span>
          </div>
        </Form>
      </Modal>

    </div>
  );
};

export default StockInventory;
