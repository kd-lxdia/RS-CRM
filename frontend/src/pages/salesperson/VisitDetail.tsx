import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api as backendApi } from '../../lib/api';
import { Card, Button, Form, Input, Select, InputNumber, Upload, message, Tabs, Typography, Spin, Popconfirm } from 'antd';
import { EnvironmentOutlined, CheckCircleOutlined, UploadOutlined, ClearOutlined, SaveOutlined, CarOutlined } from '@ant-design/icons';
import SignatureCanvas from 'react-signature-canvas';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sigPad = useRef<any>(null);

  const [currentLoc, setCurrentLoc] = useState<[number, number] | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<any>(null);
  
  const [form] = Form.useForm();
  
  // Queries
  const { data: visit, isLoading } = useQuery({
    queryKey: ['visit', id],
    queryFn: async () => (await backendApi.get(`/visits/${id}`)).data.data
  });

  const { data: surveyForm } = useQuery({
    queryKey: ['visit-form', id],
    queryFn: async () => (await backendApi.get(`/visits/${id}/form`)).data.data,
    enabled: !!visit && (visit.status === 'CHECKED_IN' || visit.status === 'COMPLETED')
  });

  useEffect(() => {
    if (surveyForm) {
      form.setFieldsValue({
        systemSizeKw: surveyForm.roofDimensions?.size,
        roofType: surveyForm.roofType,
        panelCount: surveyForm.panelCount,
        inverterBrand: surveyForm.inverterModel,
        notes: surveyForm.specialNotes
      });
    }
  }, [surveyForm, form]);

  useEffect(() => {
    if (navigator.geolocation && visit && visit.status === 'SCHEDULED') {
      const getDist = () => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            setCurrentLoc([pos.coords.latitude, pos.coords.longitude]);
            try {
              const res = await backendApi.get(`/visits/${id}/checkin-status`, {
                params: { lat: pos.coords.latitude, lng: pos.coords.longitude }
              });
              setCheckInStatus(res.data.data);
              setDistance(res.data.data.distance);
            } catch(e) {}
          },
          () => {}, { enableHighAccuracy: true }
        );
      };
      getDist();
      const interval = setInterval(getDist, 10000);
      return () => clearInterval(interval);
    }
  }, [visit, id]);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!currentLoc) throw new Error('Location unavailable');
      const res = await backendApi.post(`/visits/${id}/checkin`, { lat: currentLoc[0], lng: currentLoc[1] });
      return res.data;
    },
    onSuccess: (res) => {
      if (res.data.canCheckIn === false) {
        message.warning(`Too far to check in. You are ${res.data.distance}m away (max 200m).`);
      } else {
        message.success('Checked in successfully!');
        queryClient.invalidateQueries({ queryKey: ['visit', id] });
      }
    },
    onError: () => message.error('Check-in failed. Please verify your location settings.')
  });

  const saveFormMutation = useMutation({
    mutationFn: async (values: any) => backendApi.put(`/visits/${id}/form`, values),
    onSuccess: () => message.success('Survey saved.')
  });

  const uploadDocsMutation = useMutation({
    mutationFn: async (formData: FormData) => backendApi.post(`/visits/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    onSuccess: () => message.success('Documents & Signature uploaded successfully.')
  });

  const completeMutation = useMutation({
    mutationFn: async () => backendApi.post(`/visits/${id}/complete`),
    onSuccess: () => {
      message.success('Visit marked as completed!');
      navigate('/salesperson/route');
    }
  });

  const renderCheckInLocker = () => {
    if (visit.status === 'COMPLETED') return <div className="text-center p-6"><CheckCircleOutlined className="text-4xl text-emerald-500 mb-2" /><br/><b>Completed</b></div>;
    if (visit.status === 'CHECKED_IN') return null;
    
    return (
      <Card className="text-center shadow-sm border-blue-200 bg-blue-50/50">
        <CarOutlined className="text-4xl text-apple-gray mb-2" />
        <div className="mb-4">
          <div className="text-2xl font-bold">{distance !== null ? `${distance}m` : 'Measuring...'}</div>
          <Text type="secondary">from customer location</Text>
        </div>
        <Button 
          type="primary" 
          size="large" 
          className="w-full md:w-auto"
          disabled={!checkInStatus?.canCheckIn}
          loading={checkInMutation.isPending}
          onClick={() => checkInMutation.mutate()}
        >
          Check In Now
        </Button>
      </Card>
    );
  };

  const clearSig = () => sigPad.current?.clear();
  const submitDocForm = async () => {
    if (sigPad.current?.isEmpty()) return message.error('Signature is required to complete documentation.');
    
    // Simulate dummy files if none selected, or capture from state (simplified here)
    const formData = new FormData();
    formData.append('signature', sigPad.current?.getTrimmedCanvas().toDataURL('image/png'));
    // we would append File blocks here for the actual images.
    uploadDocsMutation.mutate(formData);
  };

  if (isLoading || !visit) return <div className="p-10 flex justify-center"><Spin size="large" /></div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex justify-between items-start">
        <div>
          <Title level={4} className="!mb-1">{visit.customer?.name || visit.lead?.name}</Title>
          <Text type="secondary" className="flex items-center gap-1"><EnvironmentOutlined /> {visit.address}</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="primary"
            onClick={() => {
              const q = new URLSearchParams();
              if (visit.leadId) q.set('leadId', visit.leadId);
              if (visit.customerId) q.set('customerId', visit.customerId);
              const kw = form.getFieldValue('systemSizeKw');
              if (kw) q.set('kw', String(kw));
              const name = visit.customer?.name || visit.lead?.name;
              if (name) q.set('name', name);
              if (visit.address) q.set('location', visit.address);
              navigate(`/proposal-generator?${q.toString()}`);
            }}
          >
            Generate Quotation
          </Button>
          <span className={['px-3 py-1 rounded-full text-xs font-semibold', visit.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : visit.status === 'CHECKED_IN' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-apple-textLight dark:text-apple-textDark'].join(' ')}>
          {visit.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {renderCheckInLocker()}

      {(visit.status === 'CHECKED_IN' || visit.status === 'COMPLETED') && (
        <Card className="shadow-sm">
          <Tabs defaultActiveKey="1" items={[
            {
              key: '1',
              label: 'Site Survey',
              children: (
                <Form layout="vertical" form={form} onFinish={(v) => saveFormMutation.mutate(v)}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                    <Form.Item label="System Size (kW)" name="systemSizeKw"><InputNumber className="w-full" /></Form.Item>
                    <Form.Item label="Roof Type" name="roofType">
                      <Select>
                        <Option value="RCC">RCC (Concrete)</Option>
                        <Option value="TinShed">Tin Shed</Option>
                        <Option value="Tiles">Tiles</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item label="Panel Brand/Tech" name="panelBrand"><Input /></Form.Item>
                    <Form.Item label="Inverter Brand" name="inverterBrand"><Input /></Form.Item>
                    <Form.Item label="Est. Panel Count" name="panelCount"><InputNumber className="w-full" /></Form.Item>
                    <Form.Item className="md:col-span-2" label="Survey Notes" name="notes"><TextArea rows={3} /></Form.Item>
                  </div>
                  <Button type="primary" htmlType="submit" loading={saveFormMutation.isPending} icon={<SaveOutlined />}>Save Survey</Button>
                </Form>
              )
            },
            {
              key: '2',
              label: 'Documents & Sign',
              children: (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card size="small" title="Aadhaar Front">
                      <Upload maxCount={1} beforeUpload={() => false} listType="picture" capture="environment">
                        <Button icon={<UploadOutlined />}>Camera/Upload</Button>
                      </Upload>
                    </Card>
                    <Card size="small" title="Electricity Bill">
                      <Upload maxCount={1} beforeUpload={() => false} listType="picture" capture="environment">
                        <Button icon={<UploadOutlined />}>Camera/Upload</Button>
                      </Upload>
                    </Card>
                  </div>
                  
                  <div>
                    <Text strong>Customer Signature</Text>
                    <div className="border border-transparent rounded-lg mt-2 overflow-hidden bg-transparent touch-none">
                      <SignatureCanvas 
                        ref={sigPad}
                        penColor="black"
                        canvasProps={{className: 'w-full h-48'}} 
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button onClick={clearSig} icon={<ClearOutlined />}>Clear</Button>
                    </div>
                  </div>
                  
                  <Button type="primary" onClick={submitDocForm} loading={uploadDocsMutation.isPending} className="w-full">
                    Upload Documents & Signature
                  </Button>
                </div>
              )
            }
          ]} />
        </Card>
      )}

      {visit.status === 'CHECKED_IN' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-apple-cardLight dark:bg-apple-cardDark border-t lg:static lg:bg-transparent lg:p-0 lg:border-0 lg:mt-6 z-50">
          <Popconfirm title="Complete this visit? You cannot edit basic details after completion." onConfirm={() => completeMutation.mutate()}>
            <Button type="primary" size="large" className="w-full h-12 bg-emerald-600 hover:bg-emerald-500" icon={<CheckCircleOutlined />}>
              Complete Visit & Return
            </Button>
          </Popconfirm>
        </div>
      )}
    </div>
  );
}
