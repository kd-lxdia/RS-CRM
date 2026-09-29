import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Steps, Avatar, Button, Table, Tag, Spin, Tooltip, message, Popover, Modal, Select, notification, Input, Image
} from 'antd';
import { 
  Phone, Mail, MapPin, Copy, Clock, CheckCircle, FileText, 
  ArrowLeft, Printer, Share2, Download, PhoneCall, PhoneMissed, PhoneForwarded,
  FileCheck, Truck, CreditCard, ShieldCheck, Zap, LineChart, MessageSquare, Edit3, UserPlus, MoreVertical, Plus, Image as ImageIcon, Camera, Video
} from 'lucide-react';
import { api } from '../../lib/api';

// Helper functions
const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const CustomerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Re-assign Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState({ id: '', title: '' });
  const [selectedCurrentUser, setSelectedCurrentUser] = useState<any>(null);
  const [newAssignee, setNewAssignee] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Financials State
  const [paymentLedger, setPaymentLedger] = useState([
    { id: 'PAY-881', date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), amount: 50000, milestone: 'Booking Amount', mode: 'UPI' },
    { id: 'PAY-890', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), amount: 150000, milestone: 'Material Dispatch', mode: 'NEFT' },
  ]);
  const [isInvoiceModalVisible, setIsInvoiceModalVisible] = useState(false);
  const [newInvoiceForm, setNewInvoiceForm] = useState({ amount: '', mode: 'UPI', milestone: 'Installation Pending Balance' });

  // Fetch customer data
  const { data: customerData, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const response = await api.get(`/customers/${id}`);
      return response.data;
    },
    enabled: !!id,
    retry: false
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard!');
  };

  const handlePrint = () => window.print();

  let customer = customerData?.data;

  // Development mock fallback
  if (error || !customer) {
    customer = {
      id: id || 'mock-id',
      customerCode: id && id.includes('-') ? id : `CUST-${id || '8815'}`,
      name: 'Rohan Sharma',
      phone: '+91 9876543210',
      email: 'rohan.sharma@example.com',
      address: 'Plot 42, Silicon Valley Layout',
      city: 'Mumbai, Maharashtra',
      pincode: '400051',
      status: 'INSTALLATION_DONE',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      salesperson: { name: 'Aditya Raj' },
      documentationUser: { name: 'Priya Singh' },
      installationUser: { name: 'Vikram Ops' },
      accountantUser: { name: 'Neha Fin' },
    };
  }

  // --- Actions & Processing ---

  // Downloads simulation
  const handleDownloadVaultDoc = (docName: string) => {
    const content = `Simulation Data for: ${docName}\nBelonging to: ${customer.name}\nTimestamp: ${new Date().toISOString()}`;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const formattedName = customer.name.replace(/\s+/g, '_');
    const formattedDoc = docName.replace(/\s+/g, '_');
    const filename = `${customer.customerCode}_${formattedName}_${formattedDoc}.pdf`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success(`Downloading: ${filename}`);
  };

  // Finance Handlers
  const totalSystemValue = 280000;
  const totalAmountPaid = paymentLedger.reduce((sum, item) => sum + item.amount, 0);
  const balanceDue = totalSystemValue - totalAmountPaid;

  const handleCreateInvoice = () => {
    if (!newInvoiceForm.amount || isNaN(Number(newInvoiceForm.amount))) {
      return message.error("Please enter a valid amount.");
    }
    const finalAmount = Number(newInvoiceForm.amount);
    if (finalAmount > balanceDue) {
      return message.error(`Payment cannot exceed the pending balance of ${formatCurrency(balanceDue)}`);
    }

    const newEntry = {
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString(),
      amount: finalAmount,
      milestone: newInvoiceForm.milestone,
      mode: newInvoiceForm.mode
    };
    
    setPaymentLedger([newEntry, ...paymentLedger]);
    setIsInvoiceModalVisible(false);
    setNewInvoiceForm({ amount: '', mode: 'UPI', milestone: 'Installation Pending Balance' });
    notification.success({
      message: 'Receipt Logged Successfully',
      description: `Payment for ${formatCurrency(newEntry.amount)} has been added to ledger.`
    });
  };

  const handleReassignClick = (roleId: string, roleTitle: string, currentUser: any) => {
    setSelectedRole({ id: roleId, title: roleTitle });
    setSelectedCurrentUser(currentUser);
    setNewAssignee(null);
    setIsModalVisible(true);
  };

  const confirmReassign = () => {
    if (!newAssignee) return message.warning("Please select a new team member.");
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsModalVisible(false);
      notification.success({
        message: 'Assignment Updated',
        description: `Transferred ${selectedRole.title} ownership to ${newAssignee}.`,
        placement: 'bottomRight'
      });
    }, 1500);
  };

  const getStatusStep = (status: string) => {
    const statusMap: Record<string, number> = {
      'NEW': 0, 'CRM_CALLBACK': 1, 'SITE_SURVEY': 2, 'PROCUREMENT': 3, 'ACTIVE': 3, 'INSTALLATION': 4, 'INSTALLATION_DONE': 5, 'COMPLETED': 6
    };
    return statusMap[status] || 0;
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Spin size="large" /></div>;

  // --- Page Data ---
  const commActivities = [
    { type: 'call_ans', title: 'Call Connected', desc: 'Discussed loan status with client.', time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), author: 'Aditya Raj' },
    { type: 'call_rej', title: 'Call Rejected', desc: 'Client was busy, rejected call.', time: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(), author: 'Priya Singh' },
    { type: 'wa', title: 'WhatsApp Sent', desc: 'Sent automated site survey reminder.', time: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), author: 'System' },
    { type: 'email', title: 'Quotation Emailed', desc: 'Proposal with 5kW Solar setup sent.', time: new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString(), author: 'Aditya Raj' },
  ];

  const bomItems = [
    { sku: 'TS-540-MONO', name: 'Trina Solar 540W Mono', qty: 10, status: 'RECEIVED' },
    { sku: 'INV-GW-5K', name: 'Growatt MIN 5000TL-X', qty: 1, status: 'RECEIVED' },
    { sku: 'MNT-ALUM', name: 'Aluminum Mounting Structure', qty: 2, status: 'PENDING' },
    { sku: 'CBL-DC-4MM', name: 'DC Cable 4mm', qty: 50, status: 'DISPATCHED' },
  ];

  const docsVault = [
    { type: 'PROPOSAL', name: 'Approved System Proposal', status: 'VERIFIED' },
    { type: 'AGREEMENT', name: 'Signed Customer Agreement', status: 'VERIFIED' },
    { type: 'AADHAR', name: 'Aadhar Card', status: 'VERIFIED' },
    { type: 'PAN', name: 'PAN Card', status: 'VERIFIED' },
    { type: 'ELEC', name: 'Recent Electricity Bill', status: 'PENDING' },
    { type: 'PM', name: 'PM Surya Ghar App Form', status: 'VERIFIED' },
  ];

  const siteImages = [
    { title: "Roof Layout", url: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=800&q=80" },
    { title: "Inverter Site", url: "https://images.unsplash.com/photo-1613665813446-82a78c468a1d?w=800&q=80" },
    { title: "Grid Map", url: "https://images.unsplash.com/photo-1548611716-1f7c70f3fde5?w=800&q=80" }
  ];

  const teamRoster = [
    { roleId: 'sales', title: 'Sales & Advisory', name: customer.salesperson?.name },
    { roleId: 'docs', title: 'Documentation', name: customer.documentationUser?.name },
    { roleId: 'install', title: 'Installation', name: customer.installationUser?.name },
    { roleId: 'finance', title: 'Finance', name: customer.accountantUser?.name },
  ].filter(t => t.name);

  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-[#121212] font-sans pb-24 overflow-x-hidden">
      
      {/* Top Header Navigation */}
      <div className="w-full bg-white dark:bg-[#1c1c1e] border-b border-black/5 dark:border-white/5 sticky top-0 z-50 shadow-sm">
         <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
            <Button type="text" icon={<ArrowLeft size={18} />} onClick={() => navigate(-1)} className="hover:bg-slate-100" />
            <span className="font-bold text-lg tracking-tight text-slate-800 dark:text-white">Customer Hub</span>
         </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 space-y-6 mt-6 print:m-0 print:p-0">
        
        {/* BLOCK 1: Top Profile Card (Thematic Blue) */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-black/5 p-6 flex flex-col md:flex-row justify-between items-start md:items-center">
            
            <div className="flex items-center gap-6 mb-4 md:mb-0">
              <div className="relative">
                <Avatar size={90} className="bg-gradient-to-br from-blue-500 to-indigo-600 font-bold shadow-md text-3xl">
                  {getInitials(customer.name)}
                </Avatar>
                <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  NEW LEAD
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-1 flex items-center">
                  {customer.name}
                </h1>
                <div className="text-sm font-medium text-slate-500 mb-2">
                  <span>Code: {customer.customerCode}</span>
                </div>
                <div className="font-bold text-lg text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
                  {customer.phone} 
                  <Tooltip title="Copy Phone Number"><Copy size={14} className="text-slate-400 cursor-pointer hover:text-blue-500" onClick={()=>copyToClipboard(customer.phone)}/></Tooltip>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
               <Button icon={<Share2 size={16}/>} onClick={() => copyToClipboard(window.location.href)} className="font-semibold text-slate-700 h-10 w-full md:w-auto">Share</Button>
               <Button icon={<Printer size={16}/>} onClick={handlePrint} className="font-semibold text-slate-700 h-10 w-full md:w-auto hidden md:flex">Print</Button>
               <Button icon={<Download size={16}/>} onClick={() => handleDownloadVaultDoc('Customer_Profile_Snapshot')} className="font-semibold text-slate-700 h-10 w-full md:w-auto">Download</Button>
               {/* Call Back - Native CRM Blue Color */}
               <Button type="primary" icon={<PhoneCall size={16}/>} onClick={() => window.open(`tel:${customer.phone}`)} className="bg-blue-600 hover:bg-blue-700 h-10 font-bold tracking-wide w-full md:w-auto border-0">
                  Call back
               </Button>
            </div>
        </div>

        {/* BLOCK 2: Address Profile */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-black/5 p-6">
           <div className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider">Site Address</div>
           <p className="text-slate-800 dark:text-slate-200 font-medium text-[15px] leading-relaxed max-w-4xl mb-6">
             {customer.address}, {customer.city}. Pincode - {customer.pincode}.
           </p>
           
           <div className="flex gap-4">
             <Button icon={<LineChart size={18} className="text-slate-600"/>} className="h-11 w-14 flex items-center justify-center rounded-lg border border-black/10 shadow-sm hover:border-blue-500 hover:text-blue-600 transistion-colors" />
             <Button icon={<MessageSquare size={18} className="text-slate-600"/>} className="h-11 w-14 flex items-center justify-center rounded-lg border border-black/10 shadow-sm hover:border-blue-500 hover:text-blue-600 transistion-colors" />
             <Button icon={<Phone size={18} className="text-slate-600"/>} className="h-11 w-14 flex items-center justify-center rounded-lg border border-black/10 shadow-sm hover:border-blue-500 hover:text-blue-600 transistion-colors" onClick={() => window.open(`tel:${customer.phone}`)} />
           </div>
        </div>

        {/* BLOCK 3: Lead Journey Stepper Horizontal */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-black/5 p-8 overflow-x-auto no-scrollbar">
           <div className="text-lg font-bold text-slate-800 dark:text-white mb-8 tracking-tight flex items-center bg">
             Lead Journey
           </div>
           <div className="min-w-[800px]">
             <Steps
                current={getStatusStep(customer.status)}
                labelPlacement="vertical"
                size="small"
                className="font-medium"
                items={[
                  { title: <span className="font-bold text-sm mt-2 inline-block">Registered</span> },
                  { title: <span className="font-bold text-sm mt-2 inline-block">CRM callback</span> },
                  { title: <span className="font-bold text-sm mt-2 inline-block">Site Survey</span> },
                  { title: <span className="font-bold text-sm mt-2 inline-block">Documentation</span> },
                  { title: <span className="font-bold text-sm mt-2 inline-block">Installation</span> },
                  { title: <span className="font-bold text-sm mt-2 inline-block">Complete</span> }
                ]}
              />
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
           
           {/* LEFT COLUMN: Main data blocks */}
           <div className="xl:col-span-2 space-y-6">
              
              {/* Snapshot Metrics (Dynamic) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#1c1c1e] p-5 rounded-xl shadow-sm border border-black/5 text-center">
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1 tracking-wider">System Size</div>
                  <div className="text-xl font-bold text-blue-600">5 kW</div>
                </div>
                <div className="bg-white dark:bg-[#1c1c1e] p-5 rounded-xl shadow-sm border border-black/5 text-center">
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Total Value</div>
                  <div className="text-xl font-black text-slate-800 dark:text-white">{formatCurrency(totalSystemValue)}</div>
                </div>
                <div className="bg-white dark:bg-[#1c1c1e] p-5 rounded-xl shadow-sm border border-black/5 text-center">
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Amount Paid</div>
                  <div className="text-xl font-black text-emerald-600">{formatCurrency(totalAmountPaid)}</div>
                </div>
                <div className="bg-white dark:bg-[#1c1c1e] p-5 rounded-xl shadow-sm border border-black/5 text-center">
                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Target Date</div>
                  <div className="text-xl font-bold text-amber-600">May 15</div>
                </div>
              </div>

              {/* Dedicated Team Block */}
              <div className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-black/5 p-6">
                 <h3 className="text-lg font-bold tracking-tight mb-5 text-slate-800 dark:text-white">Dedicated Team</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {teamRoster.map((member, i) => (
                      <Popover 
                        key={i} 
                        trigger="click" 
                        placement="bottom"
                        content={
                          <div className="w-56 font-sans">
                            <div className="px-3 py-2 border-b border-black/10 bg-slate-50 rounded-t-lg">
                               <div className="font-bold text-sm text-slate-800">{member.name}</div>
                               <div className="text-xs text-slate-500">{member.title}</div>
                            </div>
                            <div className="p-2 space-y-1 mt-1">
                               <Button type="text" className="w-full text-left justify-start font-medium h-9 text-slate-600" icon={<Edit3 size={14}/>}>Send a Note</Button>
                               <Button type="text" className="w-full text-left justify-start font-medium text-blue-600 h-9" icon={<UserPlus size={14}/>} onClick={() => handleReassignClick(member.roleId, member.title, member)}>Re-assign Role</Button>
                            </div>
                          </div>
                        }
                      >
                        <div className="group flex items-center justify-between bg-slate-50 dark:bg-black/20 p-3 rounded-lg border border-black/5 hover:border-blue-500/50 hover:shadow-sm transition-all cursor-pointer">
                          <div className="flex items-center gap-3">
                            <Avatar className="bg-blue-100 text-blue-700 font-bold">{getInitials(member.name)}</Avatar>
                            <div>
                              <div className="font-bold text-[14px] text-slate-800 dark:text-white leading-none">{member.name}</div>
                              <div className="text-[11px] text-slate-500 font-semibold mt-1 uppercase tracking-wider">{member.title}</div>
                            </div>
                          </div>
                          <MoreVertical size={16} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"/>
                        </div>
                      </Popover>
                    ))}
                 </div>
              </div>

               {/* BILL OF MATERIALS */}
               <div className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-black/5 p-6">
                 <h3 className="text-lg font-bold tracking-tight flex items-center text-slate-800 dark:text-white mb-5">
                   <Truck className="mr-2 text-blue-500" size={20}/> Bill of Materials & Inventory
                 </h3>
                 <div className="max-h-[350px] overflow-y-auto no-scrollbar">
                   <Table 
                      dataSource={bomItems}
                      pagination={false}
                      rowKey="sku"
                      size="small"
                      columns={[
                        { title: <span className="text-xs uppercase tracking-widest text-slate-500">SKU</span>, dataIndex: 'sku', render: t=><span className="font-mono text-xs font-bold text-slate-600">{t}</span> },
                        { title: <span className="text-xs uppercase tracking-widest text-slate-500">Component</span>, dataIndex: 'name', render: t=><span className="font-bold text-slate-800 dark:text-white">{t}</span> },
                        { title: <span className="text-xs uppercase tracking-widest text-slate-500">Qty</span>, dataIndex: 'qty', render: t=><span className="font-black text-blue-600 text-[15px]">{t}</span> },
                        { title: <span className="text-xs uppercase tracking-widest text-slate-500">Status</span>, dataIndex: 'status', render: t=>(
                          <Tag color={t==='RECEIVED'?'blue':t==='DISPATCHED'?'processing':'warning'} className="font-bold tracking-wide rounded border-0 px-2">{t}</Tag>
                        )}
                      ]}
                    />
                 </div>
              </div>

              {/* SITE IMAGES GALLERY - Moved below BOM, enhanced aspect ratio */}
              <div className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-black/5 p-6">
                 <h3 className="text-lg font-bold tracking-tight flex items-center text-slate-800 dark:text-white mb-5">
                   <ImageIcon className="mr-2 text-indigo-500" size={20}/> Site Visuals
                 </h3>
                 <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar px-1">
                    
                    {/* Capture Layout - HTML5 Native Device Camera Access */}
                    <label className="min-w-[140px] h-48 aspect-video flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 cursor-pointer hover:bg-blue-100 transition-colors flex-shrink-0">
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={() => message.success("Image uploaded to project logs!")}/>
                      <Camera size={26} className="text-blue-600 mb-2" />
                      <span className="text-xs font-bold text-blue-800">Take Photo</span>
                    </label>

                    {/* Record Video Layout */}
                    <label className="min-w-[140px] h-48 aspect-video flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 cursor-pointer hover:bg-indigo-100 transition-colors flex-shrink-0">
                      <input type="file" accept="video/*" capture="environment" className="hidden" onChange={() => message.success("Video log saved!")}/>
                      <Video size={26} className="text-indigo-600 mb-2" />
                      <span className="text-xs font-bold text-indigo-800">Record Video</span>
                    </label>

                    {/* Visual Records Output */}
                    {siteImages.map((img, i) => (
                       <div key={i} className="group relative h-48 aspect-video flex-shrink-0 rounded-xl overflow-hidden shadow-sm border border-black/10 hover:shadow-md transition-shadow">
                          {/* Image preview capability baked into Ant Design Image wrapping component */}
                          <Image src={img.url} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12 pointer-events-none">
                             <div className="text-white text-sm font-bold">{img.title}</div>
                          </div>
                          
                          {/* Top Right Download Direct Image logic */}
                          <Button 
                             icon={<Download size={14} className="text-slate-600"/>} 
                             className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white/90 border-0 shadow-sm"
                             size="small"
                             onClick={(e) => {
                               e.stopPropagation(); // Stop Ant Design Preview trigger
                               handleDownloadVaultDoc(img.title);
                             }}
                          />
                       </div>
                    ))}
                 </div>
              </div>

           </div>

           {/* RIGHT COLUMN: Comms, Docs, Finance */}
           <div className="space-y-6">
              
              {/* COMMS LOGS (Fixed absolute positional clipping via robust inner wrapping width) */}
              <div className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-black/5 p-6">
                 <h3 className="text-lg font-bold tracking-tight flex items-center text-slate-800 dark:text-white mb-6">
                   <PhoneCall className="mr-2 text-blue-500" size={20}/> Communication Log
                 </h3>
                 <div className="max-h-[400px] overflow-y-auto pr-2 no-scrollbar w-full pl-3">
                    <div className="relative border-l-2 border-slate-100 ml-2 space-y-6 py-2">
                      {commActivities.map((log, idx) => (
                        <div key={idx} className="relative pl-6">
                          {/* Clipping safely avoided due to the padding layer injected in the scroll container */}
                          <div className={`absolute -left-[14px] top-0 w-7 h-7 rounded-full border-4 border-white dark:border-[#1c1c1e] flex items-center justify-center
                            ${log.type === 'call_ans' ? 'bg-blue-100 text-blue-600' : 
                              log.type === 'call_rej' ? 'bg-red-100 text-red-600' :
                              log.type === 'wa' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                            {log.type === 'call_ans' && <PhoneForwarded size={12}/>}
                            {log.type === 'call_rej' && <PhoneMissed size={12}/>}
                            {log.type === 'wa' && <CheckCircle size={12}/>}
                            {log.type === 'email' && <Mail size={12}/>}
                          </div>
                          <div>
                             <div className="flex justify-between items-start mb-0.5">
                                <span className="font-bold text-sm text-slate-800 dark:text-white">{log.title}</span>
                                <span className="text-[10px] text-slate-500 font-medium">{formatDate(log.time)}</span>
                             </div>
                             <p className="text-slate-600 dark:text-slate-400 text-sm leading-snug mb-1">{log.desc}</p>
                             <div className="text-[10px] text-slate-500 font-semibold">User: {log.author}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
              </div>

              {/* DOCS VAULT WITH DOWNLOAD HOOKS */}
              <div className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-black/5 p-6">
                 <h3 className="text-lg font-bold tracking-tight flex items-center text-slate-800 dark:text-white mb-4">
                   <ShieldCheck className="mr-2 text-indigo-500" size={20}/> Document Vault
                 </h3>
                 <div className="space-y-3">
                   {docsVault.map((doc, i) => (
                     <div 
                        key={i} 
                        onClick={() => doc.status === 'VERIFIED' ? handleDownloadVaultDoc(doc.name) : null}
                        className={`flex items-center p-3 rounded-lg border border-black/5 bg-slate-50 transition-colors
                          ${doc.status === 'VERIFIED' ? 'cursor-pointer hover:border-blue-500/50 hover:bg-white group' : 'opacity-70'}`}
                     >
                        <div className={`mr-3 ${doc.status==='VERIFIED'?'text-blue-500':'text-amber-500'}`}>
                          <FileCheck size={18} />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-[13px] leading-none mb-1 text-slate-800">{doc.name}</div>
                          <div className="text-[11px] font-semibold text-slate-500">{doc.status === 'VERIFIED' ? 'Verified (Click to Download)' : 'Pending Upload'}</div>
                        </div>
                        {doc.status === 'VERIFIED' && <Download size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                     </div>
                   ))}
                 </div>
               </div>

              {/* INTERACTIVE FINANCE ENGINE */}
              <div className="bg-white dark:bg-[#1c1c1e] rounded-xl shadow-sm border border-black/5 p-6">
                 <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
                   <h3 className="text-lg font-bold tracking-tight flex items-center text-slate-800 dark:text-white">
                     <CreditCard className="mr-2 text-blue-500" size={20}/> Payments
                   </h3>
                   <Button type="primary" size="small" icon={<Plus size={14}/>} onClick={() => setIsInvoiceModalVisible(true)} className="bg-blue-600 rounded-lg text-xs font-bold pointer-events-auto">
                     New Invoice
                   </Button>
                 </div>
                 
                 <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-2 no-scrollbar">
                   {paymentLedger.map((pay, i) => (
                      <div key={i} className="flex justify-between items-center pb-3 border-b border-black/5 last:border-0 last:pb-0">
                         <div>
                            <div className="font-bold text-[13px] text-slate-800 dark:text-white">{pay.milestone}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{pay.id} • {pay.mode} • {formatDate(pay.date)}</div>
                         </div>
                         <div className="font-black text-[15px]">{formatCurrency(pay.amount)}</div>
                      </div>
                   ))}
                 </div>
                 
                 <div className={`p-4 bg-slate-50 dark:bg-black/20 rounded-lg text-center border border-black/10 transition-all ${balanceDue <= 0 ? 'bg-emerald-50 border-emerald-100' : ''}`}>
                   <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${balanceDue <= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>Balance Due</div>
                   <div className={`text-xl font-black ${balanceDue <= 0 ? 'text-emerald-600' : 'text-blue-600'}`}>{balanceDue <= 0 ? 'PAID IN FULL' : formatCurrency(balanceDue)}</div>
                 </div>
              </div>

           </div>
        </div>
      </div>

      {/* --- INVOICE GENERATION MODAL --- */}
      <Modal
         title={<div className="font-bold text-xl pt-2 pb-1 text-slate-800">Create Invoice / Payment</div>}
         open={isInvoiceModalVisible}
         onCancel={() => setIsInvoiceModalVisible(false)}
         footer={null}
         className="font-sans"
      >
         <div className="pt-4 space-y-4">
            <div>
               <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 block">Payment Amount (INR)</label>
               <Input 
                 size="large" 
                 type="number"
                 placeholder="e.g. 50000" 
                 value={newInvoiceForm.amount} 
                 onChange={e => setNewInvoiceForm({...newInvoiceForm, amount: e.target.value})} 
                 className="font-bold text-lg rounded-lg"
                 prefix="₹"
               />
            </div>
            <div>
               <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 flex justify-between">
                  <span>Milestone Reference</span>
                  <span className="text-blue-500 font-medium normal-case">Pending: {formatCurrency(balanceDue)}</span>
               </label>
               <Input 
                 size="large" 
                 placeholder="e.g. Clearance Balance" 
                 value={newInvoiceForm.milestone} 
                 onChange={e => setNewInvoiceForm({...newInvoiceForm, milestone: e.target.value})}
                 className="rounded-lg font-medium"
               />
            </div>
            <div>
               <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 block">Payment Mode</label>
               <Select
                  size="large"
                  className="w-full font-medium"
                  value={newInvoiceForm.mode}
                  onChange={val => setNewInvoiceForm({...newInvoiceForm, mode: val})}
                  options={[
                    { label: 'UPI / NetBanking', value: 'UPI' },
                    { label: 'NEFT / RTGS', value: 'NEFT' },
                    { label: 'Cash Receipt', value: 'CASH' },
                    { label: 'Cheque Clearance', value: 'CHEQUE' },
                  ]}
               />
            </div>
            <div className="pt-4 flex gap-3">
               <Button size="large" onClick={() => setIsInvoiceModalVisible(false)} className="w-full font-bold rounded-lg border-black/10 text-slate-600">Discard</Button>
               <Button size="large" type="primary" onClick={handleCreateInvoice} className="w-full font-bold rounded-lg bg-blue-600 shadow-sm border-0">Record Payment</Button>
            </div>
         </div>
      </Modal>

      {/* --- REASSIGN MODAL --- */}
      <Modal
        title={null}
        closable={false}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        className="font-sans"
        bodyStyle={{ padding: 0 }}
      >
         <div className="p-6 text-slate-800">
            <h2 className="text-xl font-bold mb-1 tracking-tight">Re-assign {selectedRole.title}</h2>
            <p className="text-slate-500 text-sm mb-6">Transfer ownership of this role on the project to an active team member.</p>
            
            <div className="mb-6 space-y-4">
               <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Current Assignee</div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <Avatar className="bg-slate-200 text-slate-600 font-bold">{getInitials(selectedCurrentUser?.name || 'NA')}</Avatar>
                    <span className="font-bold text-[15px]">{selectedCurrentUser?.name}</span>
                  </div>
               </div>
               
               <div>
                 <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Select New Assignee</div>
                 <Select
                   showSearch
                   placeholder="Search employee directory..."
                   className="w-full h-12 font-medium"
                   onChange={(val) => setNewAssignee(val)}
                   value={newAssignee}
                   options={[
                     'Surya Devi Reddy', 'Arjun Prasad', 'Pooja Mehta', 'Siddharth Roy', 'Tech Vendor A'
                   ].filter(n => n !== selectedCurrentUser?.name).map(name => ({ label: name, value: name }))}
                 />
               </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-black/5 mt-4">
               <Button onClick={() => setIsModalVisible(false)} className="rounded-lg font-semibold h-10 px-6 text-slate-600 border-black/10">Cancel</Button>
               <Button type="primary" loading={isSubmitting} onClick={confirmReassign} className="rounded-lg font-semibold h-10 px-6 bg-blue-600 border-0">
                  Confirm Transfer
               </Button>
            </div>
         </div>
      </Modal>

    </div>
  );
};

export default CustomerPage;
