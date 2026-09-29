import React, { useState } from 'react';
import { Modal, Form, Input, DatePicker, Radio, message } from 'antd';
import {
  CalendarOutlined, StopOutlined, PhoneOutlined, WarningOutlined,
  SmileOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAddCallLog, useConvertLead } from '../api/queries';

interface CallLogModalProps {
  visible: boolean;
  onClose: () => void;
  rawLead: any;
}

const { TextArea } = Input;

export const CallLogModal: React.FC<CallLogModalProps> = ({ visible, onClose, rawLead }) => {
  const [form] = Form.useForm();
  const [disposition, setDisposition] = useState('');
  
  const addCallLog = useAddCallLog();
  const convertLead = useConvertLead();

  const handleFinish = async () => {
    try {
      const values = await form.validateFields();
      
      if (values.disposition === 'CONVERT') {
        await convertLead.mutateAsync({
          id: rawLead.id,
          data: {}
        });
        message.success('Lead successfully converted!');
      } else {
        await addCallLog.mutateAsync({
          id: rawLead.id,
          data: {
            callType: 'OUTBOUND',
            disposition: values.disposition,
            notes: values.notes,
            followUpAt: values.followUpAt?.toISOString(),
            duration: 60, // Dummy
          }
        });
        message.success('Call log exported to DB!');
      }
      onClose();
      form.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || 'Error saving call log');
    }
  };

  return (
    <Modal
      title={`Log Call: ${rawLead?.name}`}
      open={visible}
      onCancel={onClose}
      onOk={handleFinish}
      confirmLoading={addCallLog.isPending || convertLead.isPending}
      width={600}
    >
      <Form form={form} layout="vertical" className="mt-4" onValuesChange={(v) => { if(v.disposition) setDisposition(v.disposition); }}>
        <Form.Item name="disposition" label="Outcome" rules={[{ required: true }]}>
          <Radio.Group className="flex flex-col gap-2">
            <Radio value="FOLLOW_UP"><CalendarOutlined className="mr-2 text-blue-500"/>Follow Up Later</Radio>
            <Radio value="INTERESTED"><SmileOutlined className="mr-2 text-green-500"/>Interested</Radio>
            <Radio value="CONVERT"><CheckCircleOutlined className="mr-2 text-purple-500"/>Convert to Lead</Radio>
            <Radio value="NOT_INTERESTED"><StopOutlined className="mr-2 text-red-500"/>Not Interested</Radio>
            <Radio value="CALL_NOT_RECEIVED"><PhoneOutlined className="mr-2 text-orange-500"/>Call Not Received / Busy</Radio>
            <Radio value="WRONG_NUMBER"><WarningOutlined className="mr-2 text-gray-500"/>Invalid/Wrong Number</Radio>
          </Radio.Group>
        </Form.Item>

        {disposition === 'FOLLOW_UP' && (
          <Form.Item name="followUpAt" label="Schedule Follow Up" rules={[{ required: true }]}>
            <DatePicker showTime className="w-full" disabledDate={d => d && d < dayjs().startOf('day')} />
          </Form.Item>
        )}

        {disposition === 'CONVERT' && (
          <div className="bg-purple-50 p-3 rounded mb-4 text-purple-800 text-sm">
            This action will convert the raw lead into a qualified Sales Lead and map it to a Salesperson.
          </div>
        )}

        <Form.Item name="notes" label="Call Notes" rules={[{ required: true }]}>
          <TextArea rows={4} placeholder="Enter details of the conversation..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};
