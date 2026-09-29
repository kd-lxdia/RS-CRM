import React, { useState } from 'react';
import { Steps, Card, Button, Input, Select, InputNumber, Divider, Table, Upload, message, Switch, Row, Col } from 'antd';
import { Home, Zap, PackageOpen, Camera, Upload as UploadIcon, Plus, Trash2 } from 'lucide-react';

const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

// Mock initial BOM from proposal
const initialBOM = [
  { id: Date.now(), category: 'PANEL', itemName: 'Trina Solar 540W Mono', sku: 'TS-540', quantity: 10, unit: 'pcs' },
  { id: Date.now()+1, category: 'INVERTER', itemName: 'Growatt MIN 5000', sku: 'GW-5K', quantity: 1, unit: 'pcs' },
];

const SiteSurveyForm: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  
  // State for Roof
  const [roofType, setRoofType] = useState('FLAT_RCC');
  const [length, setLength] = useState<number | null>(40);
  const [width, setWidth] = useState<number | null>(30);
  const [shadowArea, setShadowArea] = useState<number | null>(0);

  // State for System Sizing
  const [panelCount, setPanelCount] = useState<number | null>(10);
  const [inverterModel, setInverterModel] = useState('Growatt MIN 5000');
  const [stringConfig, setStringConfig] = useState('2 Strings x 5 Panels');

  // State for BOM Builder
  const [bomItems, setBomItems] = useState(initialBOM);

  // State for Notes + Photos
  const [specialNotes, setSpecialNotes] = useState('');

  const handleBOMAdd = () => {
    setBomItems([
      ...bomItems, 
      { id: Date.now(), category: 'OTHER', itemName: '', sku: '', quantity: 1, unit: 'pcs' }
    ]);
  };

  const updateBOM = (id: number, key: string, value: any) => {
    setBomItems(bomItems.map(item => item.id === id ? { ...item, [key]: value } : item));
  };

  const removeBOM = (id: number) => {
    setBomItems(bomItems.filter(item => item.id !== id));
  };

  const submitSurvey = () => {
    // POST /api/site-surveys
    message.success("Site survey submitted successfully. BOM sent to Warehouse.");
    // Navigate away...
  };

  const steps = [
    { title: 'Roof Details', icon: <Home size={18} /> },
    { title: 'System Sizing', icon: <Zap size={18} /> },
    { title: 'BOM Builder', icon: <PackageOpen size={18} /> },
    { title: 'Notes & Photos', icon: <Camera size={18} /> },
  ];

  const totalArea = (length || 0) * (width || 0);
  const usableArea = totalArea - (shadowArea || 0);

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark mb-6">Site Survey - CUST-8891</h1>
        
        <Card className="shadow-sm mb-6 rounded-lg">
          <Steps current={currentStep} className="px-4 py-2">
            {steps.map(s => <Step key={s.title} title={s.title} icon={s.icon} />)}
          </Steps>
        </Card>

        <Card className="shadow-sm rounded-lg min-h-[400px]">
          
          {/* STEP 1: ROOF DETAILS */}
          {currentStep === 0 && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-lg font-bold flex items-center mb-4"><Home className="mr-2 text-blue-500"/> Roof Information</h2>
              
              <Row gutter={[24, 24]}>
                <Col span={12}>
                  <label className="block text-apple-textMuted font-medium mb-1">Roof Type</label>
                  <Select className="w-full" value={roofType} onChange={setRoofType}>
                    <Option value="FLAT_RCC">Flat RCC</Option>
                    <Option value="SLOPING_TIN">Sloping Tin Shed</Option>
                    <Option value="TILED">Tiled Roof</Option>
                  </Select>
                </Col>
                <Col span={12}>
                   <label className="block text-apple-textMuted font-medium mb-1">Roof Age / Condition</label>
                   <Select className="w-full" defaultValue="GOOD">
                     <Option value="NEW">New (&lt; 2 yrs)</Option>
                     <Option value="GOOD">Good (2-10 yrs)</Option>
                     <Option value="NEEDS_REPAIR">Needs Repair</Option>
                   </Select>
                </Col>
              </Row>

              <Divider />
              <h3 className="font-semibold text-apple-textLight dark:text-apple-textDark">Dimensions (Section 1)</h3>
              
              <Row gutter={[24, 24]}>
                <Col span={8}>
                  <label className="block text-apple-textMuted text-xs mb-1">Length (ft)</label>
                  <InputNumber className="w-full" value={length} onChange={setLength} />
                </Col>
                <Col span={8}>
                  <label className="block text-apple-textMuted text-xs mb-1">Width (ft)</label>
                  <InputNumber className="w-full" value={width} onChange={setWidth} />
                </Col>
                <Col span={8}>
                  <label className="block text-apple-textMuted text-xs mb-1">Total Area (sq.ft)</label>
                  <Input value={totalArea} disabled className="bg-slate-100 font-bold" />
                </Col>
              </Row>

              <Row gutter={[24, 24]} className="mt-2">
                <Col span={8}>
                   <label className="block text-apple-textMuted text-xs mb-1">Shadow Area (sq.ft)</label>
                   <InputNumber className="w-full" value={shadowArea} onChange={setShadowArea} />
                </Col>
                <Col span={8} offset={8}>
                   <label className="block text-apple-textMuted text-xs mb-1">Net Usable Area (sq.ft)</label>
                   <Input value={usableArea} disabled className="bg-green-50 text-green-700 font-bold border-green-200" />
                </Col>
              </Row>
            </div>
          )}

          {/* STEP 2: SYSTEM SIZING */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
               <h2 className="text-lg font-bold flex items-center mb-4"><Zap className="mr-2 text-amber-500"/> Sizing & Placement</h2>
               
               <Row gutter={[24, 24]}>
                 <Col span={12}>
                   <label className="block text-apple-textMuted font-medium mb-1">Panel Count (Suggested: 10)</label>
                   <InputNumber className="w-full" value={panelCount} onChange={setPanelCount} />
                 </Col>
                 <Col span={12}>
                   <label className="block text-apple-textMuted font-medium mb-1">String Configuration</label>
                   <Input value={stringConfig} onChange={e => setStringConfig(e.target.value)} placeholder="e.g. 2 x 5" />
                 </Col>
               </Row>

               <Row gutter={[24, 24]}>
                 <Col span={12}>
                   <label className="block text-apple-textMuted font-medium mb-1">Inverter Model</label>
                   <Input value={inverterModel} onChange={e => setInverterModel(e.target.value)} />
                 </Col>
                 <Col span={12}>
                   <div className="flex items-center justify-between h-full pt-6">
                      <span className="text-apple-textMuted font-medium">Require Earthing Kit?</span>
                      <Switch defaultChecked />
                   </div>
                 </Col>
               </Row>

               <Divider />
               <h3 className="font-semibold text-apple-textLight dark:text-apple-textDark mb-2">Panel Placement Diagram Mock</h3>
               <div className="bg-slate-100 border border-transparent w-full h-48 rounded flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-x-0 inset-y-0 grid grid-cols-10 grid-rows-5 gap-1 p-2 opacity-30">
                     {Array.from({length: 50}).map((_, i) => <div key={i} className="bg-blue-400 rounded-sm"></div>)}
                  </div>
                  <span className="bg-apple-cardLight dark:bg-apple-cardDark/90 px-4 py-2 rounded shadow text-sm font-medium z-10 text-apple-textMuted border border-transparent cursor-pointer hover:bg-apple-cardLight dark:bg-apple-cardDark">
                    Tap to mark panel locations
                  </span>
               </div>
            </div>
          )}

          {/* STEP 3: BOM BUILDER */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
               <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-bold flex items-center m-0"><PackageOpen className="mr-2 text-emerald-500"/> Bill of Materials</h2>
                 <Button type="dashed" icon={<Plus size={16} />} onClick={handleBOMAdd}>Add Item</Button>
               </div>
               
               <Table 
                 dataSource={bomItems}
                 pagination={false}
                 rowKey="id"
                 size="small"
                 columns={[
                   {
                     title: 'Category',
                     dataIndex: 'category',
                     width: 150,
                     render: (val, record) => (
                       <Select value={val} className="w-full" onChange={(v) => updateBOM(record.id, 'category', v)}>
                         <Option value="PANEL">Panel</Option>
                         <Option value="INVERTER">Inverter</Option>
                         <Option value="STRUCTURE">Structure</Option>
                         <Option value="CABLE">Cable</Option>
                         <Option value="ACCESSORY">Accessory</Option>
                         <Option value="OTHER">Other</Option>
                       </Select>
                     )
                   },
                   {
                     title: 'Item Name / Spec',
                     dataIndex: 'itemName',
                     render: (val, record) => (
                       <Input value={val} onChange={(e) => updateBOM(record.id, 'itemName', e.target.value)} placeholder="Item desc" />
                     )
                   },
                   {
                     title: 'SKU',
                     dataIndex: 'sku',
                     width: 120,
                     render: (val, record) => (
                       <Input value={val} onChange={(e) => updateBOM(record.id, 'sku', e.target.value)} placeholder="SKU" />
                     )
                   },
                   {
                     title: 'Qty',
                     dataIndex: 'quantity',
                     width: 80,
                     render: (val, record) => (
                       <InputNumber value={val} className="w-full" onChange={(v) => updateBOM(record.id, 'quantity', v)} />
                     )
                   },
                   {
                     title: '',
                     key: 'action',
                     width: 50,
                     render: (_, record) => (
                       <Button type="text" danger icon={<Trash2 size={16}/>} onClick={() => removeBOM(record.id)} />
                     )
                   }
                 ]}
               />
               <div className="text-xs text-apple-textMuted mt-2 italic flex items-center">
                 *This BOM will be cross-referenced with Warehouse Stock automatically upon submission.
               </div>
            </div>
          )}

          {/* STEP 4: NOTES & PHOTOS */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
               <h2 className="text-lg font-bold flex items-center mb-4"><Camera className="mr-2 text-purple-500"/> Photos & Notes</h2>
               
               <div>
                 <label className="block text-apple-textMuted font-medium mb-2">Site Photos (Required: Roof, Meter, DB Box)</label>
                 <Upload action="/api/documents/upload" listType="picture-card" multiple maxCount={20}>
                    <div>
                      <UploadIcon size={24} className="mx-auto text-apple-gray mb-2"/>
                      <div className="text-sm text-apple-textMuted">Upload</div>
                    </div>
                 </Upload>
               </div>

               <Divider />

               <div>
                 <label className="block text-apple-textMuted font-medium mb-1">Special Instructions for Installation Team / Warehouse</label>
                 <TextArea 
                   rows={4} 
                   placeholder="E.g., Require long ladder, narrow staircase..."
                   value={specialNotes}
                   onChange={e => setSpecialNotes(e.target.value)}
                 />
               </div>
            </div>
          )}

        </Card>

        {/* STEP CONTROLS */}
        <div className="flex justify-between mt-6">
          <Button 
            disabled={currentStep === 0} 
            onClick={() => setCurrentStep(prev => prev - 1)}
          >
            Previous
          </Button>
          
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={() => setCurrentStep(prev => prev + 1)}>
              Next Step
            </Button>
          ) : (
            <Button type="primary" className="bg-green-600 hover:bg-green-700" onClick={submitSurvey}>
              Submit Site Survey
            </Button>
          )}
        </div>

      </div>
    </div>
  );
};

export default SiteSurveyForm;
