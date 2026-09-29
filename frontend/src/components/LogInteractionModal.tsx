import React, { useState } from "react";
import { Modal, Form, Select, Input, DatePicker, message } from "antd";

interface LogInteractionModalProps {
  visible: boolean;
  lead: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LogInteractionModal: React.FC<LogInteractionModalProps> = ({ visible, lead, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: any) => {
    try {
      setLoading(true);
      // Simulate API call or if timeline tracking is built later
      // await backendApi.post(`/leads/${lead?.id}/timeline`, { ...values, type: 'INTERACTION' });
      message.success("Interaction logged successfully for " + (lead?.name || 'Lead'));
      form.resetFields();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || "Failed to log interaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Log Call/Email Outcome - ${lead?.name || ''}`}
      open={visible}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Log Outcome"
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} preserve={false}>
        <Form.Item name="outcome" label="Outcome" rules={[{ required: true }]}>
          <Select placeholder="Select Outcome">
            <Select.Option value="FOLLOW_UP">Follow up</Select.Option>
            <Select.Option value="NOT_INTERESTED">Not interested</Select.Option>
            <Select.Option value="HOLD">Hold</Select.Option>
            <Select.Option value="NEGOTIATION">Negotiation</Select.Option>
            <Select.Option value="SITE_VISIT_SCHEDULED">Site visit schedule</Select.Option>
          </Select>
        </Form.Item>

        {/* If site visit scheduled, they might be prompted to schedule it right after, but notes for everything */}
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={4} placeholder="Enter any notes from the call/email" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
