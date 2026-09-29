import { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, Button, message } from 'antd';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import backendApi from '../lib/axios';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { Icon } from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = new Icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41] });

interface VisitSchedulingModalProps {
  visible: boolean;
  onCancel: () => void;
  leadId?: string;
  customerId?: string;
  defaultData?: any; // To prefill location/address details if standalone
}

export default function VisitSchedulingModal({ visible, onCancel, leadId, customerId, defaultData }: VisitSchedulingModalProps) {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (visible && defaultData) {
      if (defaultData.lat && defaultData.lng) {
        setMapCenter([defaultData.lat, defaultData.lng]);
      }
    }
  }, [visible, defaultData]);

  const { data: staff } = useQuery({
    queryKey: ['sales-staff'],
    queryFn: async () => (await backendApi.get('/users', { params: { role: 'SALESPERSON' } })).data.data
  });

  const scheduleMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = {
        ...values,
        scheduledAt: values.scheduledAt?.toISOString?.() || values.scheduledAt,
        leadId,
        customerId
      };
      return backendApi.post('/visits', payload);
    },
    onSuccess: () => {
      message.success('Visit scheduled successfully. User notified.');
      queryClient.invalidateQueries({ queryKey: ['my-route'] });
      queryClient.invalidateQueries({ queryKey: ['sales-leads'] });
      form.resetFields();
      onCancel();
    },
    onError: (e: any) => message.error(e.response?.data?.error?.message || 'Failed to schedule visit')
  });

  return (
    <Modal
      title="Schedule Visit"
      open={visible}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      <Form layout="vertical" form={form} onFinish={(v) => scheduleMutation.mutate(v)}>
        <Form.Item label="Visit Type" name="visitType" rules={[{ required: true }]}>
          <Select>
            <Select.Option value="SITE_SURVEY">Site Survey</Select.Option>
            <Select.Option value="ROUTINE">Routine Follow-up</Select.Option>
            <Select.Option value="INSTALLATION">Installation Checks</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="Scheduled Date & Time" name="scheduledAt" rules={[{ required: true }]}>
          <DatePicker showTime className="w-full" format="YYYY-MM-DD HH:mm" />
        </Form.Item>

        <Form.Item label="Assign To" name="assignedTo" rules={[{ required: true }]}>
          <Select placeholder="Select Salesperson or Installer" showSearch filterOption={(inpt, opt) => (opt?.children as any).toLowerCase().includes(inpt.toLowerCase())}>
            {(staff || []).map((s: any) => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
          </Select>
        </Form.Item>

        <Form.Item label="Notes" name="notes">
          <Input.TextArea rows={2} />
        </Form.Item>

        {defaultData?.address && (
          <div className="mb-4">
            <p className="font-semibold text-sm mb-1 text-apple-textLight dark:text-apple-textDark">Target Location:</p>
            <p className="text-xs text-apple-textMuted mb-2">{defaultData.address}</p>
            {mapCenter && (
              <div className="h-40 rounded-lg overflow-hidden border">
                <MapContainer center={mapCenter} zoom={14} zoomControl={false} dragging={false} scrollWheelZoom={false} className="h-full w-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={mapCenter} icon={DefaultIcon} />
                </MapContainer>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={scheduleMutation.isPending}>
            Schedule Route
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
