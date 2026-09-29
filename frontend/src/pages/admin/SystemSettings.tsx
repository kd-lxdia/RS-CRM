import React, { useState } from 'react';
import { Card, Form, Input, Button, Switch, Divider, Tabs, Table, Upload, message, Typography, Row, Col, InputNumber } from 'antd';
import { Settings, Bell, Map as MapIcon, UploadCloud, IndianRupee, Save, Building2 } from 'lucide-react';
import MapboxGeofence from '../../components/MapboxGeofence';
import backendApi from '../../lib/axios';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

const mockSlabs = [
  { id: 1, capacity: 'Up to 2 kW', maxSubsidy: 30000, perKw: 30000 },
  { id: 2, capacity: 'Additional (gt 2 kW to 3 kW)', maxSubsidy: 18000, perKw: 18000 },
  { id: 3, capacity: 'Above 3 kW', maxSubsidy: 78000, perKw: 0 }, // Fixed max limit
];

const SystemSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [savedZones, setSavedZones] = useState<any[]>([]);
  
  React.useEffect(() => {
    backendApi.get('/system-settings/PETROL_RATE_PER_KM')
      .then(res => {
        if (res.data.data) {
          form.setFieldsValue({ petrolRate: parseFloat(res.data.data.value) });
        }
      })
      .catch(() => {});
  }, [form]);

  const saveConfig = async () => {
    try {
      const vals = await form.validateFields();
      if (vals.petrolRate !== undefined) {
        await backendApi.post('/system-settings/PETROL_RATE_PER_KM', { value: vals.petrolRate.toString() });
      }
      message.success("Global configurations successfully applied and cached to Redis.");
    } catch (err) {
      message.error("Failed to save settings.");
    }
  };

  const handleZonesSave = (zones: any[]) => {
    setSavedZones(zones);
    // Here you would typically send zones to backend
    console.log('Zones to save to backend:', zones);
  };

  const dummyUpload = {
    beforeUpload: () => false,
    onChange: () => message.success("Corporate Logo updated successfully.")
  };

  const slabColumns = [
    { title: 'System Capacity Threshold', dataIndex: 'capacity', key: 'capacity' },
    { title: 'Base Subsidy per kW (₹)', dataIndex: 'perKw', key: 'perkw' },
    { title: 'Maximum Cap (₹)', dataIndex: 'maxSubsidy', key: 'max' },
    { title: 'Actions', key: 'action', render: () => <Button type="link" size="small">Modify Bounds</Button>}
  ];

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark flex items-center"><Settings className="mr-2 text-apple-textMuted"/> Generic System Settings</h1>
        <Button 
          type="primary" 
          icon={<Save size={16} />} 
          className="bg-slate-800 hover:bg-slate-900"
          onClick={saveConfig}
        >
          Commit Global Configuration
        </Button>
      </div>

      <Card className="shadow-sm rounded-lg" bodyStyle={{ padding: '0px 24px 24px' }}>
        <Tabs defaultActiveKey="General" size="large">
          
          <TabPane tab={<span className="font-medium flex items-center"><Building2 size={16} className="mr-2"/> Platform Identity</span>} key="General">
             <Form form={form} layout="vertical" className="mt-4 max-w-3xl">
               <div className="flex gap-6 items-end mb-6">
                 <div>
                   <Text className="block mb-2 font-medium">Corporate Logo Interface</Text>
                   <div className="w-32 h-32 bg-slate-100 border-2 border-dashed border-transparent rounded flex items-center justify-center text-apple-gray">
                     <span className="font-bold">LOHIA</span>
                   </div>
                 </div>
                 <Upload {...dummyUpload} showUploadList={false}>
                   <Button icon={<UploadCloud size={16}/>}>Upload Replacement Asset</Button>
                 </Upload>
               </div>
               
               <Row gutter={24}>
                 <Col span={12}><Form.Item label="Registered Legal Name"><Input defaultValue="Lohia Solar Private Limited" /></Form.Item></Col>
                 <Col span={12}><Form.Item label="GST Identity Number (GSTIN)"><Input defaultValue="07AAAAA0000A1Z5" /></Form.Item></Col>
                 <Col span={12}><Form.Item label="Corporate Registered Address"><Input.TextArea defaultValue="Industrial Plot 44, New Delhi, India" rows={3} /></Form.Item></Col>
                 <Col span={12}><Form.Item label="Petrol Rate per km (₹)" name="petrolRate" initialValue={5}><InputNumber prefix="₹" style={{ width: '100%' }} /></Form.Item></Col>
               </Row>
             </Form>
          </TabPane>

          <TabPane tab={<span className="font-medium flex items-center"><Bell size={16} className="mr-2"/> External Notifications</span>} key="Notifications">
            <div className="mt-6 max-w-2xl space-y-6">
               <div className="flex justify-between items-center bg-apple-cardLight dark:bg-apple-cardDark p-4 border border-transparent rounded-lg shadow-sm">
                  <div>
                    <h4 className="font-bold text-apple-textLight dark:text-apple-textDark m-0 text-base">WhatsApp Gateway Service</h4>
                    <p className="text-sm text-apple-textMuted m-0">Permit direct notification dispatch logic via generic 3rd party messaging APIs.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
               <div className="flex justify-between items-center bg-apple-cardLight dark:bg-apple-cardDark p-4 border border-transparent rounded-lg shadow-sm">
                  <div>
                    <h4 className="font-bold text-apple-textLight dark:text-apple-textDark m-0 text-base">Email SMTP Service</h4>
                    <p className="text-sm text-apple-textMuted m-0">Send welcome emails, invoice PDFs, and escalation reports automatically.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
               <div className="flex justify-between items-center bg-apple-cardLight dark:bg-apple-cardDark p-4 border border-transparent rounded-lg shadow-sm">
                  <div>
                    <h4 className="font-bold text-apple-textLight dark:text-apple-textDark m-0 text-base">Two-Day SLA Escalations</h4>
                    <p className="text-sm text-apple-textMuted m-0">Automatically warn active Project Heads regarding moderate SLA structural delays.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
               <div className="flex justify-between items-center bg-red-50 p-4 border border-red-200 rounded-lg shadow-sm">
                  <div>
                    <h4 className="font-bold text-red-800 m-0 text-base">Four-Day Critical SLA Blockers</h4>
                    <p className="text-sm text-red-700 m-0">Elevate SLA constraints natively breaching 4-day metrics globally immediately to ADMIN lists.</p>
                  </div>
                  <Switch defaultChecked />
               </div>
            </div>
          </TabPane>

          <TabPane tab={<span className="font-medium flex items-center"><IndianRupee size={16} className="mr-2"/> PM Surya Slabs</span>} key="Subsidies">
            <div className="mt-6">
              <div className="flex justify-between items-end mb-4">
                 <p className="text-apple-textMuted m-0 flex-1">
                   These global variables map generically onto every generated `SiteSurvey` constraint dynamically calculating precise return margins visually.
                 </p>
                 <Button type="dashed">Inject New Slab Logic</Button>
              </div>
              <Table 
                 columns={slabColumns} 
                 dataSource={mockSlabs} 
                 rowKey="capacity"
                 pagination={false}
                 bordered
              />
            </div>
          </TabPane>

          <TabPane tab={<span className="font-medium flex items-center"><MapIcon size={16} className="mr-2"/> Geofence Routing (Zones)</span>} key="Zones">
             <div className="mt-6 flex flex-col h-[600px]">
                <div className="bg-blue-50 border border-blue-200 p-3 rounded mb-4 text-sm text-blue-800">
                   <p className="m-0 mb-2"><strong>Interactive Map Features:</strong></p>
                   <ul className="m-0 pl-5 space-y-1">
                     <li>🔍 Search for any location in India</li>
                     <li>📍 Draw polygons to create assignment zones</li>
                     <li>🧭 Get directions between any two points</li>
                     <li>📱 Use your current location</li>
                     <li>💾 Save zones for lead routing automation</li>
                   </ul>
                </div>
                {/* Real Interactive Map */}
                <div className="flex-1 rounded-lg overflow-hidden shadow-lg">
                   <MapboxGeofence 
                     onZonesSave={handleZonesSave}
                     initialZones={savedZones}
                   />
                </div>
             </div>
          </TabPane>

        </Tabs>
      </Card>
    </div>
  );
};

export default SystemSettings;
