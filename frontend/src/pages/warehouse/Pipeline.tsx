import React, { useState } from 'react';
import { Card, Button, Modal, Tag, Alert, Spin, message, BackTop } from 'antd';
import { Truck, AlertCircle, XCircle, CheckCircle, PackageSearch } from 'lucide-react';
import CustomerLink from '../../components/CustomerLink';
const mockPipeline = [
  {
    customer: { id: 'CUST-8815', name: 'Neha Patel' },
    pipelineStatus: 'READY_TO_DISPATCH',
    items: [
      { sku: 'TS-540', itemName: 'Trina Solar 540W Mono', quantity: 15, availableQty: 120, status: 'GREEN' },
      { sku: 'GW-5K', itemName: 'Growatt MIN 5000', quantity: 1, availableQty: 5, status: 'GREEN' },
    ],
    blockedBy: []
  },
  {
    customer: { id: 'CUST-8816', name: 'Alia Bhatt' },
    pipelineStatus: 'PARTIAL',
    items: [
      { sku: 'TS-540', itemName: 'Trina Solar 540W Mono', quantity: 10, availableQty: 120, status: 'GREEN' },
      { sku: 'AL-STR-1', itemName: 'Aluminum Mounting Structure', quantity: 2, availableQty: 0, status: 'RED' },
    ],
    blockedBy: [
      { itemName: 'Aluminum Mounting Structure', required: 2, available: 0 }
    ]
  },
  {
    customer: { id: 'CUST-8817', name: 'Vikram Singh' },
    pipelineStatus: 'BLOCKED',
    items: [
      { sku: 'AL-STR-2', itemName: 'Roof Tin Mount', quantity: 4, availableQty: 0, status: 'RED' },
      { sku: 'DC-4MM', itemName: '4mm DC Cable Red', quantity: 50, availableQty: 2, status: 'RED' },
    ],
    blockedBy: [
      { itemName: 'Roof Tin Mount', required: 4, available: 0 },
      { itemName: '4mm DC Cable Red', required: 50, available: 2 }
    ]
  }
];

const Pipeline: React.FC = () => {
  const [dispatchModalObj, setDispatchModalObj] = useState<any>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  const confirmDispatch = () => {
    setIsDispatching(true);
    // Mock POST /api/warehouse/dispatch/:customerId
    setTimeout(() => {
       setIsDispatching(false);
       message.success(`Material Dispatched for ${dispatchModalObj.customer.name}`);
       setDispatchModalObj(null);
    }, 1500);
  };

  const renderCard = (data: any, type: 'READY' | 'PARTIAL' | 'BLOCKED') => {
    const totalItems = data.items.length;
    const readyItems = data.items.filter((i: any) => i.status === 'GREEN').length;

    return (
      <Card key={data.customer.id} className={`mb-4 shadow-sm rounded-lg border-l-4 ${type === 'READY' ? 'border-l-green-500' : type === 'PARTIAL' ? 'border-l-amber-500' : 'border-l-red-500'}`}>
         <div className="flex justify-between items-start mb-2">
           <div>
             <CustomerLink name={data.customer.name} customerId={data.customer.id} customerCode={data.customer.id} />
           </div>
           {type === 'READY' ? <Tag color="success">Ready</Tag> : type === 'PARTIAL' ? <Tag color="warning">Partial</Tag> : <Tag color="error">Blocked</Tag>}
         </div>

         <div className="text-sm text-apple-textMuted mb-3 flex items-center">
            <PackageSearch size={14} className="mr-1 text-apple-gray"/>
            Total BOM: {totalItems} | Ready: {readyItems} 
         </div>

         {type !== 'READY' && data.blockedBy.length > 0 && (
           <div className="bg-red-50 rounded p-2 mb-3 border border-red-100">
             <div className="text-xs font-semibold text-red-600 mb-1 flex items-center"><AlertCircle size={12} className="mr-1"/> Missing</div>
             {data.blockedBy.map((block: any, idx: number) => (
               <div key={idx} className="text-xs text-red-700 flex justify-between">
                 <span className="truncate w-3/4" title={block.itemName}>• {block.itemName}</span>
                 <span>(Need {block.required})</span>
               </div>
             ))}
           </div>
         )}

         {type === 'READY' && (
           <Button 
             type="primary" 
             className="w-full bg-green-600 hover:bg-green-700 mt-2 font-bold tracking-wide" 
             icon={<Truck size={16}/>}
             onClick={() => setDispatchModalObj(data)}
           >
             Dispatch Order
           </Button>
         )}
      </Card>
    );
  };

  const readyList = mockPipeline.filter(p => p.pipelineStatus === 'READY_TO_DISPATCH');
  const partialList = mockPipeline.filter(p => p.pipelineStatus === 'PARTIAL');
  const blockedList = mockPipeline.filter(p => p.pipelineStatus === 'BLOCKED');

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark mb-6">Dispatch Pipeline</h1>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {/* COL 1: READY */}
        <div className="flex-1 min-w-[320px] bg-slate-100/50 p-4 rounded-xl border border-transparent">
           <h2 className="text-lg font-bold text-apple-textLight dark:text-apple-textDark flex items-center mb-4">
             <CheckCircle className="mr-2 text-green-500"/> Ready to Dispatch <span className="ml-auto bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">{readyList.length}</span>
           </h2>
           {readyList.map(item => renderCard(item, 'READY'))}
        </div>

        {/* COL 2: PARTIAL */}
        <div className="flex-1 min-w-[320px] bg-slate-100/50 p-4 rounded-xl border border-transparent">
           <h2 className="text-lg font-bold text-apple-textLight dark:text-apple-textDark flex items-center mb-4">
             <AlertCircle className="mr-2 text-amber-500"/> Partial Stock <span className="ml-auto bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">{partialList.length}</span>
           </h2>
           {partialList.map(item => renderCard(item, 'PARTIAL'))}
        </div>

        {/* COL 3: BLOCKED */}
        <div className="flex-1 min-w-[320px] bg-slate-100/50 p-4 rounded-xl border border-transparent">
           <h2 className="text-lg font-bold text-apple-textLight dark:text-apple-textDark flex items-center mb-4">
             <XCircle className="mr-2 text-red-500"/> Blocked <span className="ml-auto bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">{blockedList.length}</span>
           </h2>
           {blockedList.map(item => renderCard(item, 'BLOCKED'))}
        </div>
      </div>

      {/* DISPATCH CONFIRMATION MODAL */}
      <Modal
        title={`Confirm Dispatch: ${dispatchModalObj?.customer.name}`}
        visible={!!dispatchModalObj}
        onCancel={() => !isDispatching && setDispatchModalObj(null)}
        footer={[
          <Button key="back" onClick={() => setDispatchModalObj(null)} disabled={isDispatching}>Cancel</Button>,
          <Button key="submit" type="primary" loading={isDispatching} onClick={confirmDispatch} className="bg-green-600 border-green-600 hover:bg-green-700 px-8 font-bold">
            {isDispatching ? 'Dispatching...' : 'Confirm Dispatch'}
          </Button>,
        ]}
      >
        <Alert 
          message="Atomic Deduction Warning"
          description="Proceeding will deduct the following quantities globally from Warehouse tracking. This action triggers Timeline events and alerts the Installation team."
          type="warning"
          showIcon
          className="mb-4"
        />
        <div className="bg-transparent border border-transparent rounded p-3 text-sm">
          <div className="font-bold text-apple-textLight dark:text-apple-textDark mb-2 border-b pb-1">BOM Items Exiting Warehouse</div>
          {dispatchModalObj?.items.map((i: any, idx: number) => (
            <div key={idx} className="flex justify-between py-1 border-b border-transparent last:border-0">
              <span className="text-apple-textMuted"><span className="font-mono text-xs mr-2">{i.sku}</span> {i.itemName}</span>
              <span className="font-bold text-red-600">-{i.quantity}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default Pipeline;
