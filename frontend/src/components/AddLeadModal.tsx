import React, { useState } from "react";
import { Modal, Form, Input, Button, message } from "antd";
import { api as backendApi } from "../lib/api";

interface AddLeadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddLeadModal: React.FC<AddLeadModalProps> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  const handleFinish = async (values: any) => {
    try {
      setLoading(true);
      await backendApi.post('/leads', values);
      message.success("Lead created successfully!");
      form.resetFields();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || "Failed to create lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add New Lead" open={visible} onCancel={onClose} footer={null} destroyOnClose>
      <Form layout="vertical" form={form} onFinish={handleFinish} className="mt-4 max-h-[60vh] overflow-y-auto px-4">
        <Form.Item name="name" label="Name" rules={[{ required: true, message: "Name is required" }]}><Input placeholder="Enter customer name" /></Form.Item>
        <Form.Item name="phone" label="Phone Number" rules={[{ required: true, message: "Phone is required" }]}><Input placeholder="Enter phone number" /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}><Input placeholder="Enter email address" type="email" /></Form.Item>
        <Form.Item name="address" label="Address"><Input.TextArea placeholder="Enter address" rows={2} /></Form.Item>
        <Form.Item name="city" label="City"><Input placeholder="Enter city" /></Form.Item>
        <Form.Item name="pincode" label="Pincode"><Input placeholder="Enter pincode" /></Form.Item>
        <Form.Item name="googleMapsLink" label="Google Maps Link"><Input placeholder="Enter Google Maps link" type="url" /></Form.Item>
        <div className="flex gap-4">
          <Form.Item name="lat" label="Latitude" className="w-1/2"><Input placeholder="e.g. 28.7041" type="number" step="any" /></Form.Item>
          <Form.Item name="lng" label="Longitude" className="w-1/2"><Input placeholder="e.g. 77.1025" type="number" step="any" /></Form.Item>
        </div>
        <Form.Item name="notes" label="Notes"><Input.TextArea placeholder="Enter optional notes" rows={3} /></Form.Item>
        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={loading}>Create Lead</Button>
        </div>
      </Form>
    </Modal>
  );
};
