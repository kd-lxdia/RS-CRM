import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card, Table, Tag, Button, Empty, Spin, Select, Tooltip, Typography,
  Row, Col, message, Alert, Modal,
} from 'antd';
import {
  SendOutlined, TrophyOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';

const { Title, Text } = Typography;
const { Option } = Select;

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

interface CompareRow {
  key: string;
  label: string;
  unit: string;
  values: { raw: any; formatted: string; isBest: boolean }[];
}

interface CompareData {
  proposals: { id: string; versionNumber: number; status: string; label: string }[];
  rows: CompareRow[];
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'blue', SENT: 'gold', ACCEPTED: 'green', REJECTED: 'red', SUPERSEDED: 'default',
};

interface Props {
  leadId: string;
  onAccepted?: () => void;
}

export default function ProposalComparison({ leadId, onAccepted }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [comparing, setComparing] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const { data: proposalsData, isLoading } = useQuery({
    queryKey: ['proposals', leadId],
    queryFn: () => api.get(`/proposals/lead/${leadId}`).then(r => r.data.data),
    enabled: !!leadId,
  });

  const proposals: any[] = proposalsData || [];

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/proposals/${id}/accept`),
    onSuccess: () => {
      message.success('Proposal accepted! Lead marked as WON.');
      onAccepted?.();
    },
    onError: () => message.error('Failed to accept proposal'),
  });

  const runCompare = async (ids: string[]) => {
    if (ids.length < 2) { message.warning('Select at least 2 proposals to compare'); return; }
    setComparing(true);
    try {
      const res = await api.post('/proposals/compare', { proposalIds: ids });
      setCompareData(res.data.data);
    } catch {
      message.error('Comparison failed');
    } finally {
      setComparing(false);
    }
  };

  const columns = [
    {
      title: 'Version',
      key: 'version',
      width: 80,
      render: (_: any, r: any) => (
        <div className="flex flex-col items-center">
          <div className="text-lg font-bold text-blue-600">v{r.versionNumber}</div>
          <Tag color={STATUS_COLOR[r.status]}>{r.status}</Tag>
        </div>
      ),
    },
    { title: 'System', dataIndex: 'systemSizeKw', render: (v: number) => <strong>{v} kW</strong> },
    { title: 'Panels', dataIndex: 'panelCount', render: (v: number, r: any) => `${v} × ${r.panelBrand} ${r.panelWattage}W` },
    { title: 'Inverter', dataIndex: 'inverterModel', render: (v: string, r: any) => `${r.inverterBrand} ${v}` },
    { title: 'Net Cost', dataIndex: 'netCost', render: (v: number) => <strong className="text-blue-700">{fmt(v)}</strong> },
    { title: 'Subsidy', dataIndex: 'subsidyAmount', render: (v: number) => <span className="text-green-600">{fmt(v)}</span> },
    { title: 'Created', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString('en-IN') },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: any) => (
        <div className="flex flex-col gap-1">
          {r.status !== 'ACCEPTED' && r.status !== 'SUPERSEDED' && (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />}
              className="!bg-emerald-600 !border-emerald-600"
              loading={acceptMutation.isPending}
              onClick={() => Modal.confirm({
                title: `Accept Proposal v${r.versionNumber}?`,
                content: 'This will mark the lead as WON and supersede all other versions. This action cannot be undone.',
                okText: 'Accept & Close Deal',
                okButtonProps: { danger: true },
                onOk: () => acceptMutation.mutate(r.id),
              })}>
              Accept
            </Button>
          )}
          {r.status === 'ACCEPTED' && <Tag color="green" icon={<CheckCircleOutlined />}>ACCEPTED</Tag>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Title level={4} className="!mb-0">
          📋 Proposal Versions
          <Tag className="ml-3" color="blue">{proposals.length} versions</Tag>
        </Title>
        <div className="flex gap-2 items-center">
          <Select
            mode="multiple"
            className="w-72"
            placeholder="Select 2–3 versions to compare"
            value={selectedIds}
            onChange={setSelectedIds}
            maxTagCount={3}
          >
            {proposals.map((p: any) => (
              <Option key={p.id} value={p.id}>v{p.versionNumber} — {p.systemSizeKw} kW — {p.status}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<TrophyOutlined />} loading={comparing}
            disabled={selectedIds.length < 2}
            onClick={() => runCompare(selectedIds)}>
            Compare
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><Spin /></div>
      ) : proposals.length === 0 ? (
        <Empty description="No proposals yet for this lead" />
      ) : (
        <Table
          dataSource={proposals}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          rowClassName={(r: any) => r.status === 'ACCEPTED' ? 'bg-green-50' : r.status === 'SUPERSEDED' ? 'opacity-50' : ''}
        />
      )}

      {/* Side-by-side comparison table */}
      {compareData && (
        <Card bordered={false} className="shadow-md mt-4"
          title={
            <div className="flex justify-between items-center">
              <div>
                <TrophyOutlined className="mr-2 text-yellow-500" />
                Comparison: {compareData.proposals.map(p => p.label).join(' vs ')}
              </div>
              <Button icon={<SendOutlined />} type="primary" onClick={() => setSendModalOpen(true)}>
                Send Comparison to Customer
              </Button>
            </div>
          }>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-3 text-left font-semibold w-40">Parameter</th>
                  {compareData.proposals.map((p, i) => (
                    <th key={p.id} className="p-3 text-center font-semibold">
                      <div>Option {String.fromCharCode(65 + i)}</div>
                      <div className="text-xs font-normal text-slate-300">v{p.versionNumber} · <Tag color={STATUS_COLOR[p.status]} className="text-xs !pt-0 !pb-0">{p.status}</Tag></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareData.rows.map((row, ri) => (
                  <tr key={row.key} className={ri % 2 === 0 ? 'bg-apple-cardLight dark:bg-apple-cardDark' : 'bg-transparent'}>
                    <td className="p-3 font-medium text-apple-textLight dark:text-apple-textDark border-b border-transparent">{row.label}</td>
                    {row.values.map((cell, ci) => (
                      <td key={ci} className={`p-3 text-center border-b border-transparent ${cell.isBest ? 'bg-green-50 font-bold text-green-700' : ''}`}>
                        {cell.isBest && <span className="text-xs mr-1">✅</span>}
                        {typeof cell.raw === 'number' && (row.label.includes('₹') || row.unit === '₹' || row.unit === '₹/mo')
                          ? fmt(cell.raw)
                          : cell.formatted}
                        {row.unit && !['₹', '₹/mo'].includes(row.unit) && <span className="text-apple-gray text-xs ml-1">{row.unit}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-apple-gray">
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">✅ Best value</span>
            highlighted for each metric
          </div>
        </Card>
      )}

      {/* Send comparison modal */}
      <Modal open={sendModalOpen} onCancel={() => setSendModalOpen(false)} title="Send Comparison to Customer" footer={null} width={480}>
        <div className="space-y-4 py-2">
          <Alert message="A comparison table will be sent showing all selected options side-by-side." type="info" showIcon />
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="font-semibold text-green-800 mb-2">📱 WhatsApp Message Preview</div>
            <div className="text-sm text-green-700">
              Hi, here are {compareData?.proposals.length || 0} solar options tailored for you.<br />
              {compareData?.proposals.map((p, i) => (
                `Option ${String.fromCharCode(65 + i)}: ${p.label}`
              )).join(' | ')}<br />
              Detailed comparison PDF attached. Reply "Option A" or "Option B" to confirm.
            </div>
          </div>
          <Button type="primary" block size="large" icon={<SendOutlined />}
            onClick={() => { message.success('Comparison sent to customer!'); setSendModalOpen(false); }}>
            Send Comparison (WhatsApp + Email)
          </Button>
        </div>
      </Modal>
    </div>
  );
}


