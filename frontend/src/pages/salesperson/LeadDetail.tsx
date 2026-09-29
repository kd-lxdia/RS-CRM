import { useState } from 'react';
import {
  Card, Spin, Tag, Typography, Button, Avatar, Timeline, Form, Input,
  Select, DatePicker, TimePicker, Modal, message, Drawer, Space, Divider, Descriptions, List
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BulbOutlined, ArrowLeftOutlined, PhoneOutlined, MailOutlined,
  EnvironmentOutlined, UserOutlined, CalendarOutlined, FileTextOutlined,
  CheckCircleOutlined, ClockCircleOutlined, StarOutlined, EditOutlined,
  LinkOutlined, CompassOutlined,
} from '@ant-design/icons';
import backendApi from '../../lib/axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_LEADS: Record<string, any> = {
  'demo-1': { id: 'demo-1', leadCode: 'LD-001', name: 'Rajesh Kumar', phone: '+91 98765 43210', email: 'rajesh.kumar@gmail.com', city: 'New Delhi', address: '12, Lajpat Nagar, New Delhi', pincode: '110024', lat: 28.5665, lng: 77.2431, mapLink: '', notes: '', status: 'NEW', salesperson: { name: 'Demo Sales' }, zone: { name: 'Central Delhi' }, timelineEvents: [{ id: 't1', eventType: 'LEAD_CREATED', description: 'Lead created from campaign', createdAt: '2024-04-15T10:00:00Z' }, { id: 't2', eventType: 'CALL_MADE', description: 'Initial call made, customer interested', createdAt: '2024-04-16T11:30:00Z' }], proposals: [], visits: [] },
  'demo-2': { id: 'demo-2', leadCode: 'LD-002', name: 'Priya Sharma', phone: '+91 87654 32109', email: 'priya.sharma@yahoo.com', city: 'Gurgaon', address: '45, Sector 14, Gurgaon', pincode: '122001', lat: 28.4595, lng: 77.0266, mapLink: '', notes: 'Interested in 3kW system. Call back on weekends.', status: 'FOLLOW_UP', followUpDate: '2024-04-25', salesperson: { name: 'Demo Sales' }, zone: { name: 'Gurgaon Zone' }, timelineEvents: [{ id: 't1', eventType: 'LEAD_CREATED', description: 'Lead created from web form', createdAt: '2024-04-10T09:00:00Z' }, { id: 't2', eventType: 'CALL_MADE', description: 'First call — asked for callback', createdAt: '2024-04-11T14:00:00Z' }, { id: 't3', eventType: 'FOLLOW_UP_SCHEDULED', description: 'Follow-up scheduled for April 25', createdAt: '2024-04-12T10:00:00Z' }], proposals: [], visits: [] },
  'demo-3': { id: 'demo-3', leadCode: 'LD-003', name: 'Amit Verma', phone: '+91 76543 21098', email: 'amit.verma@outlook.com', city: 'Noida', address: '78, Sector 62, Noida', pincode: '201301', lat: 28.6271, lng: 77.3776, mapLink: 'https://maps.google.com/?q=28.6271,77.3776', notes: 'Roof area ~800 sqft. Wants net metering.', status: 'VISIT_SCHEDULED', visitDate: '2024-04-22', visitTime: '10:00', salesperson: { name: 'Demo Sales' }, zone: { name: 'Noida Zone' }, timelineEvents: [{ id: 't1', eventType: 'LEAD_CREATED', description: 'Lead from referral', createdAt: '2024-04-08T08:00:00Z' }, { id: 't2', eventType: 'CALL_MADE', description: 'Discussed solar requirements', createdAt: '2024-04-09T11:00:00Z' }, { id: 't3', eventType: 'VISIT_SCHEDULED', description: 'Site visit scheduled for April 22 at 10:00 AM', createdAt: '2024-04-10T15:00:00Z' }], proposals: [], visits: [{ id: 'v1', scheduledAt: '2024-04-22T10:00:00Z', status: 'PENDING', address: '78, Sector 62, Noida' }] },
  'demo-4': { id: 'demo-4', leadCode: 'LD-004', name: 'Sunita Patel', phone: '+91 65432 10987', email: 'sunita.patel@gmail.com', city: 'Faridabad', address: '23, NIT, Faridabad', pincode: '121001', lat: 28.4089, lng: 77.3178, mapLink: '', notes: '', status: 'PROPOSAL_SENT', salesperson: { name: 'Demo Sales' }, zone: { name: 'Faridabad Zone' }, timelineEvents: [{ id: 't1', eventType: 'LEAD_CREATED', description: 'Lead from campaign', createdAt: '2024-04-01T09:00:00Z' }, { id: 't2', eventType: 'VISIT_COMPLETED', description: 'Site visit done, 3kW system recommended', createdAt: '2024-04-05T11:00:00Z' }, { id: 't3', eventType: 'PROPOSAL_SENT', description: 'Solar proposal sent via email', createdAt: '2024-04-07T14:00:00Z' }], proposals: [{ id: 'p1', systemSize: 3, totalCost: 180000, status: 'SENT' }], visits: [{ id: 'v1', scheduledAt: '2024-04-05T10:00:00Z', status: 'COMPLETED', address: '23, NIT, Faridabad' }] },
  'demo-5': { id: 'demo-5', leadCode: 'LD-005', name: 'Vikram Singh', phone: '+91 54321 09876', email: 'vikram.singh@gmail.com', city: 'New Delhi', address: '56, Dwarka Sector 10, New Delhi', pincode: '110075', lat: 28.5921, lng: 77.0460, mapLink: '', notes: 'Wants subsidy info. Budget ~2.5L.', status: 'NEGOTIATION', salesperson: { name: 'Demo Sales' }, zone: { name: 'West Delhi Zone' }, timelineEvents: [{ id: 't1', eventType: 'LEAD_CREATED', description: 'Lead from referral', createdAt: '2024-03-25T09:00:00Z' }, { id: 't2', eventType: 'VISIT_COMPLETED', description: '5kW system recommended', createdAt: '2024-03-28T11:00:00Z' }, { id: 't3', eventType: 'PROPOSAL_SENT', description: 'Proposal sent', createdAt: '2024-03-30T14:00:00Z' }, { id: 't4', eventType: 'NEGOTIATION', description: 'Customer negotiating on price', createdAt: '2024-04-02T10:00:00Z' }], proposals: [{ id: 'p1', systemSize: 5, totalCost: 290000, status: 'NEGOTIATING' }], visits: [{ id: 'v1', scheduledAt: '2024-03-28T10:00:00Z', status: 'COMPLETED', address: '56, Dwarka Sector 10, New Delhi' }] },
  'demo-6': { id: 'demo-6', leadCode: 'LD-006', name: 'Meena Agarwal', phone: '+91 43210 98765', email: 'meena.agarwal@gmail.com', city: 'Ghaziabad', address: '89, Indirapuram, Ghaziabad', pincode: '201014', lat: 28.6411, lng: 77.3687, mapLink: '', notes: '', status: 'WON', salesperson: { name: 'Demo Sales' }, zone: { name: 'Ghaziabad Zone' }, timelineEvents: [{ id: 't1', eventType: 'LEAD_CREATED', description: 'Lead from campaign', createdAt: '2024-03-10T09:00:00Z' }, { id: 't2', eventType: 'VISIT_COMPLETED', description: '4kW system recommended', createdAt: '2024-03-14T11:00:00Z' }, { id: 't3', eventType: 'PROPOSAL_SENT', description: 'Proposal sent', createdAt: '2024-03-16T14:00:00Z' }, { id: 't4', eventType: 'WON', description: 'Customer confirmed order — ₹2,20,000', createdAt: '2024-03-20T10:00:00Z' }], proposals: [{ id: 'p1', systemSize: 4, totalCost: 220000, status: 'ACCEPTED' }], visits: [{ id: 'v1', scheduledAt: '2024-03-14T10:00:00Z', status: 'COMPLETED', address: '89, Indirapuram, Ghaziabad' }] },
  'demo-7': { id: 'demo-7', leadCode: 'LD-007', name: 'Deepak Joshi', phone: '+91 32109 87654', email: 'deepak.joshi@gmail.com', city: 'New Delhi', address: '34, Rohini Sector 3, New Delhi', pincode: '110085', lat: null, lng: null, mapLink: '', notes: '', status: 'NEW', salesperson: { name: 'Demo Sales' }, zone: { name: 'North Delhi Zone' }, timelineEvents: [{ id: 't1', eventType: 'LEAD_CREATED', description: 'Lead created from web form', createdAt: '2024-04-18T09:00:00Z' }], proposals: [], visits: [] },
  'demo-8': { id: 'demo-8', leadCode: 'LD-008', name: 'Kavita Rao', phone: '+91 21098 76543', email: 'kavita.rao@gmail.com', city: 'Gurgaon', address: '67, DLF Phase 2, Gurgaon', pincode: '122002', lat: null, lng: null, mapLink: '', notes: 'Interested, needs more info on financing.', status: 'FOLLOW_UP', followUpDate: '2024-04-26', salesperson: { name: 'Demo Sales' }, zone: { name: 'Gurgaon Zone' }, timelineEvents: [{ id: 't1', eventType: 'LEAD_CREATED', description: 'Lead from referral', createdAt: '2024-04-14T09:00:00Z' }, { id: 't2', eventType: 'CALL_MADE', description: 'Interested, needs more info', createdAt: '2024-04-15T11:00:00Z' }], proposals: [], visits: [] },
  'demo-9': { id: 'demo-9', leadCode: 'LD-009', name: 'Suresh Nair', phone: '+91 10987 65432', email: 'suresh.nair@gmail.com', city: 'Noida', address: '90, Sector 18, Noida', pincode: '201301', lat: null, lng: null, mapLink: '', notes: '', status: 'LOST', lostReason: 'Customer chose competitor', salesperson: { name: 'Demo Sales' }, zone: { name: 'Noida Zone' }, timelineEvents: [{ id: 't1', eventType: 'LEAD_CREATED', description: 'Lead from campaign', createdAt: '2024-03-20T09:00:00Z' }, { id: 't2', eventType: 'LOST', description: 'Customer chose competitor with lower price', createdAt: '2024-03-28T10:00:00Z' }], proposals: [], visits: [] },
};

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  NEW: 'default', FOLLOW_UP: 'blue', VISIT_SCHEDULED: 'orange',
  PROPOSAL_SENT: 'purple', NEGOTIATION: 'magenta', WON: 'green', LOST: 'red', ON_HOLD: 'gold',
};

const ALL_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'FOLLOW_UP', label: 'Follow Up' },
  { value: 'VISIT_SCHEDULED', label: 'Sales Visit Scheduled' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'WON', label: 'Lead Won' },
  { value: 'LOST', label: 'Lead Lost' },
  { value: 'ON_HOLD', label: 'On Hold' },
];

const EVENT_ICONS: Record<string, React.ReactNode> = {
  LEAD_CREATED: <StarOutlined className="text-blue-500" />,
  CALL_MADE: <PhoneOutlined className="text-green-500" />,
  FOLLOW_UP_SCHEDULED: <ClockCircleOutlined className="text-orange-500" />,
  VISIT_SCHEDULED: <CalendarOutlined className="text-purple-500" />,
  VISIT_COMPLETED: <CheckCircleOutlined className="text-green-600" />,
  PROPOSAL_SENT: <FileTextOutlined className="text-purple-600" />,
  NEGOTIATION: <UserOutlined className="text-pink-500" />,
  WON: <CheckCircleOutlined className="text-green-700" />,
  LOST: <ClockCircleOutlined className="text-red-500" />,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [statusForm] = Form.useForm();
  const [followUpForm] = Form.useForm();
  const [visitForm] = Form.useForm();

  const { data: apiLead, isLoading, refetch } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => (await backendApi.get(`/leads/${id}`)).data.data,
    enabled: !!id && !id.startsWith('demo-'),
    retry: false,
  });

  const updateLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      if (id?.startsWith('demo-')) {
        // Simulate API call for demo
        return new Promise(resolve => setTimeout(() => resolve({ data }), 500));
      }
      return (await backendApi.patch(`/leads/${id}`, data)).data;
    },
    onSuccess: () => {
      message.success('Lead updated successfully');
      queryClient.invalidateQueries(['lead', id] as any);
      queryClient.invalidateQueries(['sales-leads'] as any);
      setEditDrawerOpen(false);
      setStatusModalOpen(false);
      setFollowUpModalOpen(false);
      setVisitModalOpen(false);
    },
    onError: () => {
      message.error('Failed to update lead');
    },
  });

  if (isLoading) {
    return <div className="p-10 flex justify-center"><Spin size="large" /></div>;
  }

  const lead = apiLead || (id ? DEMO_LEADS[id] : null);

  if (!lead) {
    return (
      <Card>
        <div className="text-center py-10">
          <Text type="secondary">Lead not found.</Text>
          <br />
          <Button type="link" onClick={() => navigate('/salesperson/leads')}>Back to Leads</Button>
        </div>
      </Card>
    );
  }

  const handleEditLead = () => {
    form.setFieldsValue({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      address: lead.address,
      city: lead.city,
      pincode: lead.pincode,
      mapLink: lead.mapLink || '',
      lat: lead.lat || '',
      lng: lead.lng || '',
      notes: lead.notes || '',
    });
    setEditDrawerOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      updateLeadMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleChangeStatus = () => {
    statusForm.setFieldsValue({ status: lead.status });
    setStatusModalOpen(true);
  };

  const handleSaveStatus = async () => {
    try {
      const values = await statusForm.validateFields();
      updateLeadMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleScheduleFollowUp = () => {
    followUpForm.setFieldsValue({
      followUpDate: lead.followUpDate ? dayjs(lead.followUpDate) : null,
    });
    setFollowUpModalOpen(true);
  };

  const handleSaveFollowUp = async () => {
    try {
      const values = await followUpForm.validateFields();
      updateLeadMutation.mutate({
        status: 'FOLLOW_UP',
        followUpDate: values.followUpDate.format('YYYY-MM-DD'),
      });
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleScheduleVisit = () => {
    visitForm.setFieldsValue({
      visitDate: lead.visitDate ? dayjs(lead.visitDate) : null,
      visitTime: lead.visitTime ? dayjs(lead.visitTime, 'HH:mm') : null,
      visitAddress: lead.address || '',
    });
    setVisitModalOpen(true);
  };

  const handleSaveVisit = async () => {
    try {
      const values = await visitForm.validateFields();
      updateLeadMutation.mutate({
        status: 'VISIT_SCHEDULED',
        visitDate: values.visitDate.format('YYYY-MM-DD'),
        visitTime: values.visitTime ? values.visitTime.format('HH:mm') : null,
      });
      message.success('Sales visit scheduled and added to your route!');
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl pb-10">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/salesperson/leads')} />
          <Avatar size={48} icon={<UserOutlined />} className="bg-blue-100 text-blue-600 flex-shrink-0" />
          <div>
            <Title level={4} className="!mb-0">{lead.name}</Title>
            <Text type="secondary" className="text-sm">{lead.leadCode}</Text>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Tag color={STATUS_COLORS[lead.status] || 'default'} className="text-sm px-3 py-1 cursor-pointer" onClick={handleChangeStatus}>
            {lead.status.replace(/_/g, ' ')}
          </Tag>
          <Button icon={<EditOutlined />} onClick={handleEditLead}>Edit</Button>
          <Button
            icon={<BulbOutlined />}
            onClick={() => {
              const q = new URLSearchParams({
                leadId: lead.id,
                name: lead.name || '',
                location: lead.city || lead.address || '',
              });
              navigate(`/solar-designer?${q.toString()}`);
            }}
          >
            Design Roof
          </Button>
          <Button
            type="primary"
            icon={<BulbOutlined />}
            onClick={() => navigate(`/proposal-generator?leadId=${lead.id}`)}
          >
            Create Proposal
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card size="small">
        <Space wrap>
          <Button icon={<PhoneOutlined />} href={`tel:${lead.phone}`}>Call</Button>
          <Button icon={<MailOutlined />} href={`mailto:${lead.email}`}>Email</Button>
          <Button icon={<ClockCircleOutlined />} onClick={handleScheduleFollowUp}>Schedule Follow-up</Button>
          <Button icon={<CalendarOutlined />} onClick={handleScheduleVisit}>Schedule Sales Visit</Button>
          {(lead.lat && lead.lng) || lead.mapLink ? (
            <Button
              icon={<EnvironmentOutlined />}
              href={lead.mapLink || `https://maps.google.com/?q=${lead.lat},${lead.lng}`}
              target="_blank"
            >
              Open in Maps
            </Button>
          ) : null}
        </Space>
      </Card>

      {/* Contact & Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Contact Information" size="small">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Phone">
              <PhoneOutlined className="text-blue-500 mr-2" />
              {lead.phone}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              <MailOutlined className="text-green-500 mr-2" />
              {lead.email || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Address">
              <EnvironmentOutlined className="text-red-500 mr-2" />
              {lead.address}{lead.pincode ? `, ${lead.pincode}` : ''}
            </Descriptions.Item>
            {lead.lat && lead.lng && (
              <Descriptions.Item label="Coordinates">
                <CompassOutlined className="text-purple-500 mr-2" />
                {lead.lat}, {lead.lng}
              </Descriptions.Item>
            )}
            {lead.mapLink && (
              <Descriptions.Item label="Map Link">
                <LinkOutlined className="text-blue-500 mr-2" />
                <a href={lead.mapLink} target="_blank" rel="noopener noreferrer">Open Map</a>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <Card title="Lead Details" size="small">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="City">{lead.city || '-'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLORS[lead.status]}>{lead.status.replace(/_/g, ' ')}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Salesperson">{lead.salesperson?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Zone">{lead.zone?.name || '-'}</Descriptions.Item>
            {lead.followUpDate && (
              <Descriptions.Item label="Follow-up Date">
                <CalendarOutlined className="mr-2" />
                {dayjs(lead.followUpDate).format('MMM DD, YYYY')}
              </Descriptions.Item>
            )}
            {lead.visitDate && (
              <Descriptions.Item label="Sales Visit">
                <CalendarOutlined className="mr-2" />
                {dayjs(lead.visitDate).format('MMM DD, YYYY')} {lead.visitTime && `at ${lead.visitTime}`}
              </Descriptions.Item>
            )}
            {lead.lostReason && (
              <Descriptions.Item label="Lost Reason">
                <Text type="danger">{lead.lostReason}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      </div>

      {/* Notes */}
      {lead.notes && (
        <Card title="Notes" size="small">
          <Text>{lead.notes}</Text>
        </Card>
      )}

      {/* Lost / Not-interested reason */}
      {lead.lostReason && (
        <Card title="Lost / Not Interested Reason" size="small">
          <Text type="danger">{lead.lostReason}</Text>
        </Card>
      )}

      {/* Proposals */}
      {lead.proposals && lead.proposals.length > 0 && (
        <Card title="Solar Proposals" size="small">
          <List
            dataSource={lead.proposals}
            renderItem={(p: any) => (
              <List.Item
                actions={[
                  <Tag color={p.status === 'ACCEPTED' ? 'green' : p.status === 'SENT' ? 'blue' : 'orange'} key="s">
                    {p.status}
                  </Tag>
                ]}
              >
                <List.Item.Meta
                  avatar={<BulbOutlined className="text-yellow-500 text-lg mt-1" />}
                  title={`${p.systemSize} kW Solar System`}
                  description={`Total Cost: ₹${p.totalCost?.toLocaleString('en-IN')}`}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Visits */}
      {lead.visits && lead.visits.length > 0 && (
        <Card title="Sales Visits" size="small">
          <List
            dataSource={lead.visits}
            renderItem={(v: any) => (
              <List.Item
                actions={[
                  <Tag color={v.status === 'COMPLETED' ? 'green' : v.status === 'CHECKED_IN' ? 'blue' : 'default'} key="s">
                    {v.status.replace('_', ' ')}
                  </Tag>
                ]}
              >
                <List.Item.Meta
                  avatar={<CalendarOutlined className="text-purple-500 text-lg mt-1" />}
                  title={new Date(v.scheduledAt).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  description={v.address}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Timeline */}
      <Card title="Activity Timeline" size="small">
        {lead.timelineEvents && lead.timelineEvents.length > 0 ? (
          <Timeline
            items={lead.timelineEvents.map((event: any) => ({
              dot: EVENT_ICONS[event.eventType] || <ClockCircleOutlined />,
              children: (
                <div>
                  <div className="font-medium text-sm">{event.eventType.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{event.description}</div>
                  {event.createdAt && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(event.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        ) : (
          <Text type="secondary">No activity yet.</Text>
        )}
      </Card>

      {/* Edit Drawer */}
      <Drawer
        title="Edit Lead"
        placement="right"
        width={500}
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setEditDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSaveEdit} loading={updateLeadMutation.isPending}>
              Save
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Phone" name="phone" rules={[{ required: true, message: 'Please enter phone' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Email" name="email" rules={[{ type: 'email', message: 'Please enter valid email' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Address" name="address">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item label="City" name="city">
            <Input />
          </Form.Item>
          <Form.Item label="Pincode" name="pincode">
            <Input />
          </Form.Item>
          <Divider />
          <Form.Item label="Google Maps Link" name="mapLink">
            <Input prefix={<LinkOutlined />} placeholder="https://maps.google.com/..." />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="Latitude" name="lat">
              <Input type="number" step="any" placeholder="28.6139" />
            </Form.Item>
            <Form.Item label="Longitude" name="lng">
              <Input type="number" step="any" placeholder="77.2090" />
            </Form.Item>
          </div>
          <Divider />
          <Form.Item label="Notes" name="notes">
            <TextArea rows={4} placeholder="Add any notes about this lead..." />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Status Change Modal */}
      <Modal
        title="Change Lead Status"
        open={statusModalOpen}
        onOk={handleSaveStatus}
        onCancel={() => setStatusModalOpen(false)}
        confirmLoading={updateLeadMutation.isPending}
      >
        <Form form={statusForm} layout="vertical">
          <Form.Item label="Status" name="status" rules={[{ required: true }]}>
            <Select>
              {ALL_STATUSES.map(s => (
                <Option key={s.value} value={s.value}>{s.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.status !== cur.status}>
            {() => {
              const st = statusForm.getFieldValue('status');
              const isNegative = ['LOST', 'NOT_INTERESTED', 'REJECTED'].includes(st);
              return (
                <Form.Item
                  label={isNegative ? 'Reason (kyon lost/not interested?)' : 'Comment / Follow-up note (optional)'}
                  name="statusReason"
                  rules={isNegative ? [{ required: true, message: 'Reason zaroori hai' }] : []}
                >
                  <TextArea rows={3} placeholder={isNegative ? 'e.g. Competitor se sasta mila / budget nahi hai / baad mein lagayenge' : 'e.g. Customer ne 2 din baad call karne bola'} />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Follow-up Modal */}
      <Modal
        title="Schedule Follow-up"
        open={followUpModalOpen}
        onOk={handleSaveFollowUp}
        onCancel={() => setFollowUpModalOpen(false)}
        confirmLoading={updateLeadMutation.isPending}
      >
        <Form form={followUpForm} layout="vertical">
          <Form.Item label="Follow-up Date" name="followUpDate" rules={[{ required: true, message: 'Please select date' }]}>
            <DatePicker className="w-full" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Sales Visit Modal */}
      <Modal
        title="Schedule Sales Visit"
        open={visitModalOpen}
        onOk={handleSaveVisit}
        onCancel={() => setVisitModalOpen(false)}
        confirmLoading={updateLeadMutation.isPending}
      >
        <Form form={visitForm} layout="vertical">
          <Form.Item label="Visit Date" name="visitDate" rules={[{ required: true, message: 'Please select date' }]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item label="Preferred Time (optional)" name="visitTime">
            <TimePicker className="w-full" format="HH:mm" minuteStep={15} placeholder="Select time (optional)" />
          </Form.Item>
          <Form.Item label="Visit Address" name="visitAddress">
            <TextArea rows={2} placeholder="Address for sales visit" />
          </Form.Item>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mt-3">
            <Text className="text-xs text-blue-600 dark:text-blue-400">
              <CalendarOutlined className="mr-2" />
              This sales visit will be added to your route and calendar for the selected date.
            </Text>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
