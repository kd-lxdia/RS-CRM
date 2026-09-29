import React, { useState, useEffect } from 'react';
import { Drawer, Card, Input, Select, Button, Switch, Divider, Progress, Upload, message } from 'antd';
import { Download, Upload as UploadIcon, CheckCircle2, FileText, FileSignature, Zap } from 'lucide-react';

const { Option } = Select;

interface ChecklistDrawerProps {
  visible: boolean;
  onClose: () => void;
  customer: any;
  onUpdate: (updatedData: any) => void;
}

const ChecklistDrawer: React.FC<ChecklistDrawerProps> = ({ visible, onClose, customer, onUpdate }) => {
  const [formData, setFormData] = useState<any>({
    pmSuryaAppNo: '',
    pmSuryaStatus: 'PENDING',
    cmSchemeApplicable: false,
    cmSchemeAppNo: '',
    cmSchemeStatus: 'PENDING',
    loanApplicable: false,
    loanAppNo: '',
    loanStatus: 'NA',
    netMeteringAppNo: '',
    netMeteringStatus: 'PENDING',
  });

  const [downloadingUrl, setDownloadingUrl] = useState('');

  useEffect(() => {
    if (customer) {
      // Setup mock initial state based on customer completion
      // In a real app, GET /api/documentation/checklist/:customerId
      const isComplete = customer.completionPercentage === 100;
      setFormData({
        pmSuryaAppNo: isComplete ? 'PM-12345' : 'PM-123',
        pmSuryaStatus: isComplete ? 'APPROVED' : 'SUBMITTED',
        cmSchemeApplicable: customer.schemes?.includes('CM Scheme'),
        cmSchemeAppNo: isComplete ? 'CM-987' : '',
        cmSchemeStatus: isComplete ? 'APPROVED' : 'PENDING',
        loanApplicable: customer.schemes?.includes('Loan'),
        loanAppNo: isComplete ? 'LN-555' : '',
        loanStatus: isComplete ? 'DISBURSED' : 'PENDING',
        netMeteringAppNo: isComplete ? 'NM-444' : '',
        netMeteringStatus: isComplete ? 'APPROVED' : 'PENDING',
      });
    }
  }, [customer]);

  const calculateCompletion = () => {
    let total = 2; // PM Surya + Net Metering
    let completed = 0;
    
    if (formData.pmSuryaStatus === 'APPROVED') completed++;
    if (formData.netMeteringStatus === 'APPROVED') completed++;
    
    if (formData.cmSchemeApplicable) {
      total++;
      if (formData.cmSchemeStatus === 'APPROVED') completed++;
    }
    
    if (formData.loanApplicable) {
      total++;
      if (formData.loanStatus === 'DISBURSED') completed++;
    }
    
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const handleSave = () => {
    // PATCH /api/documentation/checklist/:customerId
    const completionPercentage = calculateCompletion();
    message.success('Checklist updated successfully');
    onUpdate({ ...customer, completionPercentage });
  };

  const handleDownloadAll = async () => {
    // GET /api/documents/customer/:customerId/download-all
    message.loading({ content: 'Generating ZIP archive...', key: 'dl' });
    setTimeout(() => {
      message.success({ content: 'Download started!', key: 'dl' });
      // In real scenario navigate to URL or trigger anchor click
    }, 1500);
  };

  const currentCompletion = calculateCompletion();

  return (
    <Drawer
      title={<span className="font-bold text-lg dark:text-white">Documentation Checklist - {customer?.name}</span>}
      width={600}
      onClose={onClose}
      visible={visible}
      className="dark:bg-[#111]"
      bodyStyle={{ paddingBottom: 80 }}
      footer={
        <div className="flex justify-between items-center px-4 py-2 dark:bg-apple-cardDark">
           <div className="flex items-center space-x-3">
             <div className="text-sm font-medium text-apple-textMuted dark:text-apple-gray">Completion</div>
             <Progress percent={currentCompletion} size="small" className="w-32" />
           </div>
           <div className="space-x-3">
             <Button onClick={onClose}>Cancel</Button>
             <Button type="primary" onClick={handleSave}>Save Updates</Button>
           </div>
        </div>
      }
    >
      {/* QUICK DOWNLOADS */}
      <div className="apple-card">
        <div className="flex items-center justify-between mb-3">
           <h3 className="font-semibold text-sm text-apple-textLight dark:text-apple-textDark dark:text-slate-300 flex items-center">
             <FileText size={16} className="mr-2 text-blue-500" /> Customer Documents
           </h3>
           <Button size="small" type="primary" ghost icon={<Download size={14} />} onClick={handleDownloadAll}>
             Download ZIP
           </Button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Button size="small" icon={<FileText size={14} />}>Aadhaar</Button>
          <Button size="small" icon={<Zap size={14} />}>Elec. Bill</Button>
          <Button size="small" icon={<FileSignature size={14} />}>Agreement</Button>
        </div>
      </div>

      <div className="space-y-4">
        
        {/* PM SURYA GHAR */}
        <Card size="small" title={<span className="flex items-center font-semibold dark:text-gray-200"><CheckCircle2 size={16} className={`mr-2 ${formData.pmSuryaStatus === 'APPROVED' ? 'text-green-500' : 'text-apple-gray'}`} /> PM Surya Ghar Scheme</span>} className="shadow-sm dark:bg-apple-cardDark border-transparent">
           <div className="grid grid-cols-2 gap-4">
             <div>
                <span className="block text-xs text-apple-textMuted dark:text-apple-gray mb-1">Application No.</span>
                <Input value={formData.pmSuryaAppNo} onChange={e => setFormData({...formData, pmSuryaAppNo: e.target.value})} placeholder="Enter Ref No." />
             </div>
             <div>
                <span className="block text-xs text-apple-textMuted dark:text-apple-gray mb-1">Status</span>
                <Select className="w-full" value={formData.pmSuryaStatus} onChange={v => setFormData({...formData, pmSuryaStatus: v})}>
                  <Option value="PENDING">Pending</Option>
                  <Option value="SUBMITTED">Submitted</Option>
                  <Option value="APPROVED">Approved <span className="text-green-500">✓</span></Option>
                  <Option value="REJECTED">Rejected</Option>
                </Select>
             </div>
             <div className="col-span-2">
                <Upload action="/api/documents/upload" showUploadList={false}>
                   <Button icon={<UploadIcon size={14} />} size="small">Upload Proof</Button>
                </Upload>
             </div>
           </div>
        </Card>

        {/* CM SCHEME */}
        <Card size="small" title={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center font-semibold dark:text-gray-200"><CheckCircle2 size={16} className={`mr-2 ${(formData.cmSchemeApplicable && formData.cmSchemeStatus === 'APPROVED') ? 'text-green-500' : 'text-apple-gray'}`} /> CM Scheme (State Level)</span>
            <Switch size="small" checked={formData.cmSchemeApplicable} onChange={v => setFormData({...formData, cmSchemeApplicable: v})} />
          </div>
        } className="shadow-sm dark:bg-apple-cardDark border-transparent">
           {formData.cmSchemeApplicable ? (
             <div className="grid grid-cols-2 gap-4 mt-2">
               <div>
                  <span className="block text-xs text-apple-textMuted dark:text-apple-gray mb-1">Application No.</span>
                  <Input value={formData.cmSchemeAppNo} onChange={e => setFormData({...formData, cmSchemeAppNo: e.target.value})} placeholder="Enter Ref No." />
               </div>
               <div>
                  <span className="block text-xs text-apple-textMuted dark:text-apple-gray mb-1">Status</span>
                  <Select className="w-full" value={formData.cmSchemeStatus} onChange={v => setFormData({...formData, cmSchemeStatus: v})}>
                    <Option value="PENDING">Pending</Option>
                    <Option value="SUBMITTED">Submitted</Option>
                    <Option value="APPROVED">Approved <span className="text-green-500">✓</span></Option>
                  </Select>
               </div>
             </div>
           ) : (
             <div className="text-sm text-apple-gray italic">Not applicable for this customer</div>
           )}
        </Card>

        {/* LOAN PROCESS */}
        <Card size="small" title={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center font-semibold dark:text-gray-200"><CheckCircle2 size={16} className={`mr-2 ${(formData.loanApplicable && formData.loanStatus === 'DISBURSED') ? 'text-green-500' : 'text-apple-gray'}`} /> Loan Application</span>
            <Switch size="small" checked={formData.loanApplicable} onChange={v => setFormData({...formData, loanApplicable: v})} />
          </div>
        } className="shadow-sm dark:bg-apple-cardDark border-transparent">
           {formData.loanApplicable ? (
             <div className="grid grid-cols-2 gap-4 mt-2">
               <div>
                  <span className="block text-xs text-apple-textMuted dark:text-apple-gray mb-1">Loan Ref No.</span>
                  <Input value={formData.loanAppNo} onChange={e => setFormData({...formData, loanAppNo: e.target.value})} placeholder="Bank Ref No." />
               </div>
               <div>
                  <span className="block text-xs text-apple-textMuted dark:text-apple-gray mb-1">Status</span>
                  <Select className="w-full" value={formData.loanStatus} onChange={v => setFormData({...formData, loanStatus: v})}>
                    <Option value="PENDING">Pending</Option>
                    <Option value="SUBMITTED">Submitted</Option>
                    <Option value="SANCTIONED">Sanctioned</Option>
                    <Option value="DISBURSED">Disbursed <span className="text-green-500">✓</span></Option>
                  </Select>
               </div>
             </div>
           ) : (
             <div className="text-sm text-apple-gray italic">No loan opted</div>
           )}
        </Card>

        {/* NET METERING */}
        <Card size="small" title={<span className="flex items-center font-semibold dark:text-gray-200"><CheckCircle2 size={16} className={`mr-2 ${formData.netMeteringStatus === 'APPROVED' ? 'text-green-500' : 'text-apple-gray'}`} /> Net Metering Process</span>} className="shadow-sm dark:bg-apple-cardDark border-transparent">
           <div className="grid grid-cols-2 gap-4">
             <div>
                <span className="block text-xs text-apple-textMuted dark:text-apple-gray mb-1">DISCOM App No.</span>
                <Input value={formData.netMeteringAppNo} onChange={e => setFormData({...formData, netMeteringAppNo: e.target.value})} placeholder="Enter DISCOM Ref." />
             </div>
             <div>
                <span className="block text-xs text-apple-textMuted dark:text-apple-gray mb-1">Status</span>
                <Select className="w-full" value={formData.netMeteringStatus} onChange={v => setFormData({...formData, netMeteringStatus: v})}>
                  <Option value="PENDING">Pending</Option>
                  <Option value="SUBMITTED">Submitted</Option>
                  <Option value="APPROVED">Approved <span className="text-green-500">✓</span></Option>
                </Select>
             </div>
           </div>
        </Card>

      </div>
    </Drawer>
  );
};

export default ChecklistDrawer;
