import React, { useMemo, useState } from 'react';
import { Tabs, Card, Badge, Button, Avatar, Tag, Spin } from 'antd';
import { MapPin, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomerLink from '../../components/CustomerLink';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';

const { TabPane } = Tabs;

const MyCustomers: React.FC = () => {
  const [activeTab, setActiveTab] = useState('surveys');
  const navigate = useNavigate();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['installation-my-customers'],
    queryFn: async () => {
      const res = await backendApi.get('/installation/my-customers');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const { surveyCustomers, installCustomers } = useMemo(() => {
    const surveys = customers.filter((customer: any) => !customer.siteSurveys?.length);
    const installs = customers.filter((customer: any) => customer.siteSurveys?.length || customer.status === 'INSTALLATION_DONE' || customer.status === 'COMPLETED');
    return { surveyCustomers: surveys, installCustomers: installs };
  }, [customers]);

  const renderCustomerCard = (customer: any, type: 'survey' | 'install') => (
    <Card key={customer.id} className="mb-4 shadow-sm hover:border-blue-300 transition-colors rounded-lg">
      <div className="flex justify-between items-start">
         <div className="flex gap-4">
            <Avatar size={50} className="bg-blue-100 text-blue-600 font-bold">{customer.name.substring(0,2).toUpperCase()}</Avatar>
            <div>
               <div className="text-lg"><CustomerLink name={customer.name} customerId={customer.id} /></div>
               <span className="text-xs text-apple-textMuted">{customer.customerCode}</span>
               
               <div className="mt-2 text-sm text-apple-textMuted flex items-start">
                  <MapPin size={14} className="mt-1 mr-1 text-apple-gray shrink-0"/>
                  <span>{customer.address}, {customer.city}</span>
               </div>
               
               <div className="mt-1 text-sm text-apple-textMuted flex items-center">
                  <Clock size={14} className="mr-1 text-apple-gray"/>
                  <span>Assigned to {customer.salesperson?.name || 'team member'}</span>
               </div>

               {type === 'install' && (
                 <div className="mt-2">
                   {customer.status === 'COMPLETED' ? (
                     <Tag color="success">Completed</Tag>
                   ) : customer.status === 'INSTALLATION_DONE' ? (
                     <Tag color="processing">Installation Done</Tag>
                   ) : (
                     <Tag color="success">Material Dispatched</Tag>
                   )}
                 </div>
               )}
            </div>
         </div>
         <div className="flex flex-col gap-2">
            <Button onClick={() => navigate(`/customer/${customer.id}`)}>View Customer</Button>
            {type === 'survey' ? (
              <Button type="primary" onClick={() => navigate(`/installation/survey/${customer.id}`)}>
                Start Site Survey <ArrowRight size={14} className="ml-1"/>
              </Button>
            ) : (
               <Button type="primary" disabled={customer.status === 'COMPLETED'} onClick={() => navigate(`/installation/complete/${customer.id}`)}>
                 Mark Completed <CheckCircle size={14} className="ml-1"/>
               </Button>
            )}
         </div>
      </div>
    </Card>
  );

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark">My Installation Customers</h1>
      </div>

      {isLoading && customers.length === 0 ? (
        <div className="p-10 flex justify-center"><Spin size="large" /></div>
      ) : null}

      <div className="apple-card">
        <Tabs activeKey={activeTab} onChange={setActiveTab} size="large" centered>
          <TabPane tab={<Badge count={surveyCustomers.length} offset={[15, 0]}><span>Site Survey Pending</span></Badge>} key="surveys">
            <div className="p-4 max-w-4xl mx-auto">
               {surveyCustomers.map((c: any) => renderCustomerCard(c, 'survey'))}
            </div>
          </TabPane>
          <TabPane tab={<Badge count={installCustomers.length} style={{ backgroundColor: '#10b981' }} offset={[15, 0]}><span>Installation Pending</span></Badge>} key="installs">
             <div className="p-4 max-w-4xl mx-auto">
               {installCustomers.map((c: any) => renderCustomerCard(c, 'install'))}
            </div>
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default MyCustomers;
