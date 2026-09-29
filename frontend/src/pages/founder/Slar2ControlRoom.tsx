import React, { useState } from 'react';
import { Alert, Button, Card, Col, Drawer, Empty, Row, Statistic, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Factory, IndianRupee, ShieldCheck, SunMedium } from 'lucide-react';
import backendApi from '../../lib/axios';

const { Title, Text } = Typography;

type ControlRoomData = {
  dailyLeads: number;
  missedFollowUps: number;
  siteVisitsPlanned: number;
  siteVisitsDone: number;
  quotationsSent: number;
  lowMarginQuotations: number;
  advanceReceivedAmount: number;
  dispatchCount: number;
  materialReturnCount: number;
  criticalPaymentPendingCount: number;
  materialStuckCount: number;
  installationStuckCount: number;
  netMeteringStuckCount: number;
  qcPendingCount: number;
  lateAttendanceCount: number;
  designPendingCount?: number;
  openPunchPointCount?: number;
  departmentAccountability: Record<string, Record<string, number>>;
  autoSummary: string;
};

type DrilldownType =
  | 'daily-leads'
  | 'missed-followups'
  | 'site-visits'
  | 'quotations-sent'
  | 'low-margin-quotations'
  | 'advance-received'
  | 'dispatches-today'
  | 'material-returns-today'
  | 'payment-pending'
  | 'material-stuck'
  | 'installation-stuck'
  | 'net-metering-stuck'
  | 'qc-pending'
  | 'late-attendance'
  | 'design-pending'
  | 'punch-points';

type DrilldownData = {
  type: DrilldownType;
  title: string;
  count: number;
  generatedAt: string;
  rows: Record<string, unknown>[];
};

const currency = (value?: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const labelize = (value: string) =>
  value
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') return value > 999 ? value.toLocaleString('en-IN') : value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('en-IN');
    return value;
  }
  return JSON.stringify(value);
};

const visibleColumnKeys = (rows: Record<string, unknown>[]) => {
  const hidden = new Set(['projectId', 'leadId']);
  const priority = [
    'projectCode',
    'customerName',
    'customerPhone',
    'leadCode',
    'customerCode',
    'ownerName',
    'projectStage',
    'status',
    'milestone',
    'pendingAmount',
    'dueAt',
    'daysOverdue',
    'currentStage',
    'qcStatus',
    'remarks',
  ];
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).filter((key) => !hidden.has(key));
  return [...priority.filter((key) => keys.includes(key)), ...keys.filter((key) => !priority.includes(key))].slice(0, 12);
};

const Slar2ControlRoom: React.FC = () => {
  const [activeDrilldown, setActiveDrilldown] = useState<{ type: DrilldownType; title: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['slar-2-control-room'],
    queryFn: async () => {
      const response = await backendApi.get('/epc-v2/founder/control-room');
      return response.data.data as ControlRoomData;
    },
    refetchInterval: 60000,
  });

  const drilldownQuery = useQuery({
    queryKey: ['slar-2-control-room-drilldown', activeDrilldown?.type],
    enabled: Boolean(activeDrilldown?.type),
    queryFn: async () => {
      const response = await backendApi.get(`/epc-v2/founder/control-room/drilldown/${activeDrilldown!.type}`);
      return response.data.data as DrilldownData;
    },
  });

  const accountability = Object.entries(data?.departmentAccountability || {}).map(([department, metrics]) => ({
    department,
    ...metrics,
  }));

  const openDrilldown = (type: DrilldownType, title: string) => setActiveDrilldown({ type, title });
  const detailRows = drilldownQuery.data?.rows || [];
  const detailColumns = visibleColumnKeys(detailRows).map((key) => ({
    title: labelize(key),
    dataIndex: key,
    key,
    ellipsis: true,
    render: (value: unknown) => formatValue(value),
  }));

  const ActionCard = ({
    title,
    value,
    type,
    danger,
    prefix,
  }: {
    title: string;
    value: React.ReactNode;
    type: DrilldownType;
    danger?: boolean;
    prefix?: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={() => openDrilldown(type, title)}
      className={`w-full text-left rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        danger ? 'border-red-200 hover:border-red-400' : 'border-slate-100 hover:border-amber-300'
      }`}
    >
      <Statistic
        title={<span className="text-slate-600">{title}</span>}
        value={value as any}
        valueStyle={danger ? { color: '#dc2626' } : undefined}
        prefix={prefix}
      />
      <Text className="text-xs text-slate-500">Click to see project/customer details</Text>
    </button>
  );

  const AlertTile = ({ color, label, count, type }: { color: string; label: string; count: number; type: DrilldownType }) => (
    <button
      type="button"
      onClick={() => openDrilldown(type, label)}
      className="rounded-xl border border-slate-100 bg-white p-0 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md"
    >
      <Tag color={color} className="m-0 block rounded-xl px-3 py-3 text-center">
        <span className="font-semibold">{label}: {count}</span>
        <span className="mt-1 block text-xs opacity-80">View list</span>
      </Tag>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-amber-100 via-orange-50 to-sky-100 p-8 shadow-sm border border-white/60">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            <SunMedium size={26} />
          </div>
          <div>
            <Title level={2} className="!mb-0">SLAR 2.0 Founder Control Room</Title>
            <Text className="text-slate-600">Live EPC red-alert cockpit built from the stricter Rocker Solar audit controls.</Text>
          </div>
        </div>
        {data?.autoSummary ? (
          <Alert
            type="warning"
            showIcon
            icon={<AlertTriangle size={18} />}
            message={data.autoSummary}
            className="rounded-2xl border-amber-200 bg-white/70"
          />
        ) : null}
        {error ? <Alert type="error" showIcon message="Unable to load SLAR 2.0 control room API." className="mt-4" /> : null}
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          {isLoading ? <Card loading className="rounded-2xl" /> : <ActionCard title="Daily Leads" value={data?.dailyLeads || 0} type="daily-leads" prefix={<Factory size={18} />} />}
        </Col>
        <Col xs={24} md={6}>
          {isLoading ? <Card loading className="rounded-2xl" /> : <ActionCard title="Missed Follow-ups" value={data?.missedFollowUps || 0} type="missed-followups" danger />}
        </Col>
        <Col xs={24} md={6}>
          {isLoading ? <Card loading className="rounded-2xl" /> : <ActionCard title="Advance Received" value={currency(data?.advanceReceivedAmount)} type="advance-received" prefix={<IndianRupee size={18} />} />}
        </Col>
        <Col xs={24} md={6}>
          {isLoading ? <Card loading className="rounded-2xl" /> : <ActionCard title="Visits Done / Planned" value={`${data?.siteVisitsDone || 0}/${data?.siteVisitsPlanned || 0}`} type="site-visits" />}
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Critical Red Alerts" loading={isLoading} className="rounded-2xl h-full">
            <div className="grid grid-cols-2 gap-3">
              <AlertTile color="red" label="Payment Pending" count={data?.criticalPaymentPendingCount || 0} type="payment-pending" />
              <AlertTile color="volcano" label="Material Stuck" count={data?.materialStuckCount || 0} type="material-stuck" />
              <AlertTile color="orange" label="Installation Stuck" count={data?.installationStuckCount || 0} type="installation-stuck" />
              <AlertTile color="gold" label="Net Metering Stuck" count={data?.netMeteringStuckCount || 0} type="net-metering-stuck" />
              <AlertTile color="purple" label="QC Pending" count={data?.qcPendingCount || 0} type="qc-pending" />
              <AlertTile color="blue" label="Late Attendance" count={data?.lateAttendanceCount || 0} type="late-attendance" />
              <AlertTile color="cyan" label="Design Pending" count={data?.designPendingCount || 0} type="design-pending" />
              <AlertTile color="magenta" label="Open Punch Points" count={data?.openPunchPointCount || 0} type="punch-points" />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Today Movement" loading={isLoading} className="rounded-2xl h-full">
            <Row gutter={[12, 12]}>
              <Col span={12}><Button type="link" onClick={() => openDrilldown('quotations-sent', 'Quotations Sent')}><Statistic title="Quotations Sent" value={data?.quotationsSent || 0} /></Button></Col>
              <Col span={12}><Button type="link" onClick={() => openDrilldown('low-margin-quotations', 'Low Margin Quotes')}><Statistic title="Low Margin Quotes" value={data?.lowMarginQuotations || 0} /></Button></Col>
              <Col span={12}><Button type="link" onClick={() => openDrilldown('dispatches-today', 'Dispatches')}><Statistic title="Dispatches" value={data?.dispatchCount || 0} /></Button></Col>
              <Col span={12}><Button type="link" onClick={() => openDrilldown('material-returns-today', 'Material Returns')}><Statistic title="Material Returns" value={data?.materialReturnCount || 0} /></Button></Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card
        title={<span className="flex items-center gap-2"><ShieldCheck size={18} /> Department-wise Accountability</span>}
        loading={isLoading}
        className="rounded-2xl"
      >
        <Table
          rowKey="department"
          pagination={false}
          dataSource={accountability}
          columns={[
            { title: 'Department', dataIndex: 'department', render: (text) => <strong>{text}</strong> },
            { title: 'Missed Follow-ups', dataIndex: 'missedFollowUps', render: (v) => v || 0 },
            { title: 'Low Margin Quotes', dataIndex: 'lowMarginQuotations', render: (v) => v || 0 },
            { title: 'Material Stuck', dataIndex: 'materialStuck', render: (v) => v || 0 },
            { title: 'Dispatch Count', dataIndex: 'dispatchCount', render: (v) => v || 0 },
            { title: 'Payment Pending', dataIndex: 'paymentPending', render: (v) => v || 0 },
            { title: 'Installation/QC', render: (_, row: any) => (row.installationStuck || 0) + (row.qcPending || 0) },
            { title: 'Net Metering Stuck', dataIndex: 'netMeteringStuck', render: (v) => v || 0 },
          ]}
        />
      </Card>

      <Drawer
        title={drilldownQuery.data?.title || activeDrilldown?.title || 'Founder Alert Details'}
        width="86vw"
        open={Boolean(activeDrilldown)}
        onClose={() => setActiveDrilldown(null)}
        extra={<Button onClick={() => drilldownQuery.refetch()}>Refresh</Button>}
      >
        <Text className="mb-4 block text-slate-500">
          These rows use the same filter as the dashboard number, so the count and detail list stay aligned.
        </Text>
        {drilldownQuery.isError ? (
          <Alert type="error" showIcon message="Unable to load this founder drill-down." />
        ) : detailRows.length ? (
          <Table
            rowKey={(_, index) => `${activeDrilldown?.type}-${index}`}
            loading={drilldownQuery.isLoading}
            dataSource={detailRows}
            columns={detailColumns}
            scroll={{ x: 1400 }}
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        ) : (
          <div className="py-12">
            {drilldownQuery.isLoading ? <Card loading /> : <Empty description="No records found for this alert." />}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default Slar2ControlRoom;
