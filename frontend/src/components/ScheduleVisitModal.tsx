import React, { useState } from "react";
import { Modal, Form, Input, DatePicker, message } from "antd";

interface ScheduleVisitModalProps {
  visible: boolean;
  lead: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ScheduleVisitModal: React.FC<ScheduleVisitModalProps> = ({ visible, lead, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: any) => {
    try {
      setLoading(true);
      // Simulate API saving a visit interaction
      message.success(`Sales Visit scheduled for ${lead?.name}!`);
      form.resetFields();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || "Failed to schedule sales visit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Schedule Sales Visit - ${lead?.name || ''}`}
      open={visible}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Schedule Visit"
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} preserve={false} 
            initialValues={{ location: lead?.address || lead?.city || '' }}>
        
        <Form.Item name="visitDate" label="Date and Time" rules={[{ required: true, message: 'Please select a date and time' }]}>
          <DatePicker showTime format="YYYY-MM-DD HH:mm" className="w-full" />
        </Form.Item>

        <Form.Item name="location" label="Location" rules={[{ required: true, message: 'Location is required' }]}>
          <Input placeholder="Enter meeting location or address" />
        </Form.Item>

        <Form.Item name="agenda" label="Agenda / Notes">
          <Input.TextArea rows={4} placeholder="Purpose of the visit, any specific required materials..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};
