import React, { useState } from 'react';
import { Card, Row, Col, Badge, Avatar, Button, Input, Modal, Form, Select, Typography, message } from 'antd';
import { Store, UserPlus, Users, Phone, MapPin, IndianRupee, Mail } from 'lucide-react';

const { Paragraph } = Typography;
const { Option } = Select;

const mockDealers = [
  { id: 'DLR-901', name: 'SunTech Solutions Pvt Ltd', admin: 'Amit Desai', staff: 12, customers: 145, revenue: 5800000, status: 'ACTIVE' },
  { id: 'DLR-902', name: 'GreenEnergy Regional', admin: 'Priya Joshi', staff: 5, customers: 35, revenue: 1200000, status: 'ACTIVE' },
  { id: 'DLR-903', name: 'SolarEdge Enterprise', admin: 'N/A', staff: 0, customers: 0, revenue: 0, status: 'INACTIVE' },
];

const DealerManagement: React.FC = () => {
  const [createModal, setCreateModal] = useState(false);
  const [form] = Form.useForm();

  const handleCreateDealer = () => {
    message.success("Dealer provisioned natively. Admin sub-user dispatched invitation securely.");
    setCreateModal(false);
    form.resetFields();
  };

  const toggleStatus = (name: string, current: string) => {
    message.info(`Dealer ${name} marked ${current === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}`);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-apple-textLight dark:text-apple-textDark m-0 flex items-center"><Store className="mr-2 text-apple-blue"/> Network Dealer Hub</h1>
        <Button 
          type="primary" 
          icon={<Store size={16} />} 
          onClick={() => setCreateModal(true)}
          className="bg-apple-blue hover:bg-apple-darkBlue border-0 shadow-md shadow-apple-blue/20"
        >
          Provision New Dealer
        </Button>
      </div>

      <Row gutter={[24, 24]}>
        {mockDealers.map((d, i) => (
          <Col xs={24} lg={12} key={i}>
            <Card 
              className={`apple-card border-t-[3px] ${d.status === 'ACTIVE' ? 'border-t-apple-blue' : 'border-t-apple-textMuted/40 opacity-70'} overflow-hidden transition-all`}
              actions={[
                <span className="flex items-center justify-center text-apple-blue font-medium tracking-tight cursor-pointer hover:text-apple-darkBlue"><Users size={16} className="mr-1.5"/> Manage Staff ({d.staff})</span>,
                <span 
                  className="flex items-center justify-center font-medium tracking-tight cursor-pointer text-apple-textMuted hover:text-apple-textLight dark:hover:text-white transition-colors"
                  onClick={() => toggleStatus(d.name, d.status)}
                >
                  {d.status === 'ACTIVE' ? 'Deactivate Branch' : 'Reactivate Branch'}
                </span>
              ]}
            >
              <div className="flex justify-between items-start mb-5">
                 <div>
                   <h3 className="text-[17px] font-bold text-apple-textLight dark:text-white m-0 tracking-tight">{d.name}</h3>
                   <span className="font-mono text-[11px] font-semibold text-apple-textMuted bg-black/5 dark:bg-apple-cardLight dark:bg-apple-cardDark/10 px-2 py-0.5 rounded-full">{d.id}</span>
                 </div>
                 <Badge status={d.status === 'ACTIVE' ? 'processing' : 'default'} text={<span className="text-[11px] font-bold tracking-wider uppercase text-apple-textMuted">{d.status}</span>} />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/[0.02] dark:bg-apple-cardLight dark:bg-apple-cardDark/[0.04] p-3 rounded-[12px] border border-black/[0.04] dark:border-white/[0.04]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-apple-textMuted flex items-center mb-1"><Store size={12} className="mr-1.5"/> Master Admin</div>
                  <div className="font-semibold text-[13px] text-apple-textLight dark:text-apple-textDark">{d.admin}</div>
                </div>
                <div className="bg-black/[0.02] dark:bg-apple-cardLight dark:bg-apple-cardDark/[0.04] p-3 rounded-[12px] border border-black/[0.04] dark:border-white/[0.04]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-apple-textMuted flex items-center mb-1"><Users size={12} className="mr-1.5"/> Acquired Load</div>
                  <div className="font-semibold text-[13px] text-apple-textLight dark:text-apple-textDark">{d.customers} <span className="font-medium text-apple-textMuted">Customers</span></div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10 flex justify-between items-center">
                 <span className="text-[13px] text-apple-textMuted font-semibold tracking-tight">Pushed Revenue Cap</span>
                 <span className="text-emerald-600 dark:text-emerald-400 font-bold tracking-tight bg-emerald-500/10 px-2.5 py-0.5 rounded-[8px]">₹{d.revenue.toLocaleString()}</span>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className="bg-apple-blue/10 dark:bg-apple-blue/20 p-2 rounded-[12px]">
              <Store size={20} className="text-apple-blue"/>
            </div>
            <div>
              <div className="text-[17px] font-bold tracking-tight mb-0 text-apple-textLight dark:text-apple-textDark">Provision Authorized Dealer</div>
              <div className="text-[11px] font-semibold text-apple-textMuted tracking-tight uppercase mt-0.5">Creates an independent sub-entity</div>
            </div>
          </div>
        }
        open={createModal}
        onOk={handleCreateDealer}
        onCancel={() => setCreateModal(false)}
        width={700}
        okText="Establish Network Entity"
        okButtonProps={{ className: 'bg-apple-blue border-0 shadow-md rounded-[12px] font-semibold tracking-tight h-10 px-6' }}
        cancelButtonProps={{ className: 'rounded-[12px] border-black/10 dark:border-white/10 font-semibold tracking-tight h-10 px-6' }}
      >
        <Form form={form} layout="vertical" className="mt-8" requiredMark={false}>
           <h4 className="text-[11px] font-bold tracking-wider uppercase text-apple-textMuted mb-4 border-b border-black/5 dark:border-white/10 pb-2">Phase 1: Company Profile</h4>
           <Row gutter={16}>
              <Col span={12}><Form.Item label={<span className="font-semibold text-apple-textMuted tracking-tight text-[13px]">INCORPORATION NAME</span>}><Input className="rounded-[10px] h-10 bg-black/5 dark:bg-apple-cardLight dark:bg-apple-cardDark/5 border-transparent focus:bg-transparent" placeholder="Legal firm name..."/></Form.Item></Col>
              <Col span={12}><Form.Item label={<span className="font-semibold text-apple-textMuted tracking-tight text-[13px]">REGISTERED ZONE</span>}><Select className="h-10" popupClassName="rounded-[12px]" placeholder="Map primary footprint..."><Option value="NCR">Delhi / NCR</Option></Select></Form.Item></Col>
           </Row>
           
           <h4 className="text-[11px] font-bold tracking-wider uppercase text-apple-textMuted mb-4 border-b border-black/5 dark:border-white/10 pb-2 mt-6">Phase 2: Master Administrator</h4>
           <div className="text-[13px] text-apple-textMuted mb-6 bg-apple-blue/5 dark:bg-apple-blue/10 border border-apple-blue/10 dark:border-apple-blue/20 p-4 rounded-[14px]">
             <strong className="text-apple-blue tracking-tight">Root Profile:</strong> This profile is the supreme controller for the newly provisioned dealer and oversees internal mapping without crossing global boundaries.
           </div>
           <Row gutter={16}>
              <Col span={12}><Form.Item label={<span className="font-semibold text-apple-textMuted tracking-tight text-[13px]">ADMIN FULL NAME</span>}><Input className="rounded-[10px] h-10 bg-black/5 dark:bg-apple-cardLight dark:bg-apple-cardDark/5 border-transparent focus:bg-transparent" placeholder="Primary point of contact..."/></Form.Item></Col>
              <Col span={12}><Form.Item label={<span className="font-semibold text-apple-textMuted tracking-tight text-[13px]">ADMIN EMAIL GATEWAY</span>}><Input type="email" className="rounded-[10px] h-10 bg-black/5 dark:bg-apple-cardLight dark:bg-apple-cardDark/5 border-transparent focus:bg-transparent" placeholder="Required for welcome portal authentication..."/></Form.Item></Col>
           </Row>
           <Row gutter={16}>
              <Col span={12}><Form.Item label={<span className="font-semibold text-apple-textMuted tracking-tight text-[13px]">EMERGENCY PHONE</span>}><Input className="rounded-[10px] h-10 bg-black/5 dark:bg-apple-cardLight dark:bg-apple-cardDark/5 border-transparent focus:bg-transparent"/></Form.Item></Col>
           </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default DealerManagement;
