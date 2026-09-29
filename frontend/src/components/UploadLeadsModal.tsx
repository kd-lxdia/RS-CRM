import React, { useState } from "react";
import { Modal, Upload, Button, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { api as backendApi } from "../lib/api";

interface UploadLeadsModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const UploadLeadsModal: React.FC<UploadLeadsModalProps> = ({ visible, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      message.error('Please select a file to upload');
      return;
    }
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await backendApi.post('/leads/bulk-upload', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      message.success(`Uploaded ${res.data.data.inserted} leads successfully!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || "Failed to upload leads");
    } finally {
      setLoading(false);
    }
  };

  const beforeUpload = (newFile: File) => {
    setFile(newFile);
    return false;
  };

  return (
    <Modal title="Upload Leads from Excel" open={visible} onCancel={onClose} onOk={handleUpload} okText="Upload" confirmLoading={loading} destroyOnClose>
      <Upload.Dragger maxCount={1} beforeUpload={beforeUpload} accept=".xlsx,.xls,.csv" onRemove={() => setFile(null)}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Click or drag Excel/CSV file to this area to upload</p>
      </Upload.Dragger>
    </Modal>
  );
};
