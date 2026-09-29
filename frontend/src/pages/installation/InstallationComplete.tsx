import React, { useState } from 'react';
import { Card, Checkbox, Button, Upload, Input, message, Alert } from 'antd';
import { CheckCircle2, Upload as UploadIcon, CheckSquare, Hammer, Zap, PlayCircle, ShieldCheck } from 'lucide-react';

const { TextArea } = Input;

const InstallationComplete: React.FC = () => {
  const [checklist, setChecklist] = useState({
    structures: false,
    panels: false,
    wiring: false,
    inverter: false,
    testing: false,
    demo: false
  });

  const [notes, setNotes] = useState('');

  const handleCheck = (key: keyof typeof checklist) => {
    setChecklist({ ...checklist, [key]: !checklist[key] });
  };

  const isAllChecked = Object.values(checklist).every(Boolean);

  const handleSubmit = () => {
    if (!isAllChecked) return;
    message.success("Installation marked successfully!");
    // POST /api/installation/:customerId/complete
  };

  return (
    <div className="p-6 bg-transparent min-h-screen flex items-center justify-center">
      <div className="max-w-xl w-full">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark mb-6 text-center">Complete Installation</h1>
        
        <Card className="shadow-sm border border-transparent rounded-xl">
          <Alert
            message="Required Milestones"
            description="All checklist items and proofs must be completed to mark the installation as finished."
            type="info"
            showIcon
            className="mb-6"
          />

          <div className="space-y-4 mb-8">
            <Checkbox checked={checklist.structures} onChange={() => handleCheck('structures')} className="flex items-center text-base p-3 bg-transparent border border-transparent rounded-lg w-full m-0 hover:bg-slate-100 transition-colors">
               <span className="flex items-center ml-2"><Hammer size={18} className="mr-3 text-apple-textMuted"/> Mounting structures fixed securely</span>
            </Checkbox>
            
            <Checkbox checked={checklist.panels} onChange={() => handleCheck('panels')} className="flex items-center text-base p-3 bg-transparent border border-transparent rounded-lg w-full m-0 hover:bg-slate-100 transition-colors">
               <span className="flex items-center ml-2"><CheckSquare size={18} className="mr-3 text-apple-textMuted"/> Solar panels mounted & aligned correctly</span>
            </Checkbox>
            
            <Checkbox checked={checklist.wiring} onChange={() => handleCheck('wiring')} className="flex items-center text-base p-3 bg-transparent border border-transparent rounded-lg w-full m-0 hover:bg-slate-100 transition-colors">
               <span className="flex items-center ml-2"><Zap size={18} className="mr-3 text-apple-textMuted"/> DC / AC Wiring & Earthing completed safely</span>
            </Checkbox>
            
            <Checkbox checked={checklist.inverter} onChange={() => handleCheck('inverter')} className="flex items-center text-base p-3 bg-transparent border border-transparent rounded-lg w-full m-0 hover:bg-slate-100 transition-colors">
               <span className="flex items-center ml-2"><PlayCircle size={18} className="mr-3 text-apple-textMuted"/> Inverter configured & powered on</span>
            </Checkbox>

            <Checkbox checked={checklist.testing} onChange={() => handleCheck('testing')} className="flex items-center text-base p-3 bg-transparent border border-transparent rounded-lg w-full m-0 hover:bg-slate-100 transition-colors">
               <span className="flex items-center ml-2"><ShieldCheck size={18} className="mr-3 text-apple-textMuted"/> Array testing / Commissioning report generated</span>
            </Checkbox>

            <Checkbox checked={checklist.demo} onChange={() => handleCheck('demo')} className="flex items-center text-base p-3 bg-transparent border border-transparent rounded-lg w-full m-0 hover:bg-slate-100 transition-colors">
               <span className="flex items-center ml-2"><CheckCircle2 size={18} className="mr-3 text-apple-textMuted"/> Customer handover & app demonstration given</span>
            </Checkbox>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-apple-textLight dark:text-apple-textDark mb-2">Upload Final Photos / JCR</h3>
            <Upload action="/api/documents/upload" listType="picture" multiple>
              <Button icon={<UploadIcon size={16} />}>Select Files</Button>
            </Upload>
          </div>

          <div className="mb-8">
            <h3 className="font-semibold text-apple-textLight dark:text-apple-textDark mb-2">Closing Notes</h3>
             <TextArea 
               rows={3} 
               placeholder="Any final remarks regarding the installation process..."
               value={notes}
               onChange={e => setNotes(e.target.value)}
             />
          </div>

          <Button 
            type="primary" 
            size="large" 
            className="w-full bg-green-600 hover:bg-green-700 font-bold tracking-wide h-12"
            disabled={!isAllChecked}
            onClick={handleSubmit}
          >
            Mark Installation Complete
          </Button>

        </Card>
      </div>
    </div>
  );
};

export default InstallationComplete;
