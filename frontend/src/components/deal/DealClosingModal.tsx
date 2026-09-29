/**
 * DealClosingModal.tsx
 * 4-step wizard for closing a deal from the salesperson's lead detail view.
 * Step 1: Select proposal
 * Step 2: Review & edit invoice line items
 * Step 3: Preview invoice (react-pdf)
 * Step 4: Confirm & Send — confetti + customer code display
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Modal, Steps, Button, Select, Table, InputNumber, Divider,
  Typography, Tag, Row, Col, Statistic, Alert, Spin, Space,
} from 'antd';
import {
  CheckCircleOutlined, CopyOutlined, ArrowRightOutlined,
  TrophyOutlined, FileTextOutlined, DollarOutlined,
} from '@ant-design/icons';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';

const { Text, Title } = Typography;
const { Option } = Select;

// ─── Confetti Canvas ──────────────────────────────────────────────────────────

type Particle = { x: number; y: number; r: number; vx: number; vy: number; color: string; angle: number; spin: number };

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#1d4ed8', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

    particles.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      r: Math.random() * 8 + 4,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // gravity
        p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r / 2);
        ctx.restore();
      }
      particles.current = particles.current.filter(p => p.y < canvas.height + 20);
      if (particles.current.length > 0) raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  return (
    <canvas ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ width: '100vw', height: '100vh' }} />
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  hsn: string;
  qty: number;
  unit: string;
  rate: number;
  gstPct: number;
  amount: number;
  gstAmount: number;
  total: number;
  isDeduction?: boolean;
}

interface Props {
  open: boolean;
  leadId: string;
  leadName: string;
  onClose: () => void;
  onSuccess?: (customerId: string) => void;
}

const HSN_LABELS: Record<string, string> = {
  '85414011': 'Solar Panels', '85044090': 'Inverter',
  '7308': 'Structure', '85444290': 'Cables', '998521': 'Installation',
};

// ─── Step Components ──────────────────────────────────────────────────────────

function rupees(n: number) { return `₹${Math.round(n).toLocaleString('en-IN')}`; }

function StepConfirmProposal({ leadId, onSelect }: { leadId: string; onSelect: (p: any) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['proposals', leadId],
    queryFn: () => api.get(`/proposals/lead/${leadId}`).then(r => r.data.data),
  });
  const proposals: any[] = (data || []).filter((p: any) => !['REJECTED', 'SUPERSEDED'].includes(p.status));
  const [selected, setSelected] = useState<string>(proposals[0]?.id || '');

  useEffect(() => {
    if (proposals.length === 1) setSelected(proposals[0].id);
  }, [proposals.length]);

  const selectedProposal = proposals.find(p => p.id === selected);

  return (
    <div className="space-y-4">
      <Alert message="Select the proposal the customer has agreed to. All other versions will be superseded." type="info" showIcon />
      {isLoading ? <Spin /> : (
        <>
          <Select className="w-full" placeholder="Select proposal version" value={selected || undefined}
            onChange={setSelected} size="large">
            {proposals.map(p => (
              <Option key={p.id} value={p.id}>
                v{p.versionNumber} — {p.systemSizeKw} kW — {p.panelBrand} — Net ₹{Math.round(p.netCost).toLocaleString('en-IN')}
                <Tag className="ml-2" color={p.status === 'SENT' ? 'gold' : 'blue'}>{p.status}</Tag>
              </Option>
            ))}
          </Select>

          {selectedProposal && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[
                ['System Size', `${selectedProposal.systemSizeKw} kW`],
                ['Panel', `${selectedProposal.panelBrand} ${selectedProposal.panelModel}`],
                ['Inverter', `${selectedProposal.inverterBrand} ${selectedProposal.inverterModel}`],
                ['Panel Count', `${selectedProposal.panelCount} panels`],
                ['Total Cost', rupees(selectedProposal.totalCost)],
                ['Subsidy', rupees(selectedProposal.subsidyAmount || 0)],
                ['Net Cost', <strong className="text-blue-700">{rupees(selectedProposal.netCost)}</strong>],
                ['Status', <Tag color={selectedProposal.status === 'SENT' ? 'gold' : 'blue'}>{selectedProposal.status}</Tag>],
              ].map(([l, v]: any, i) => (
                <div key={i} className="bg-transparent rounded-lg p-3">
                  <div className="text-xs text-apple-gray uppercase tracking-wide">{l}</div>
                  <div className="font-medium text-apple-textLight dark:text-apple-textDark mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="primary" size="large" disabled={!selected}
              icon={<ArrowRightOutlined />} iconPosition="end"
              onClick={() => onSelect(selectedProposal)}>
              Review Invoice
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function StepReviewInvoice({ proposal, lineItems, setLineItems, onNext }: {
  proposal: any;
  lineItems: LineItem[];
  setLineItems: (items: LineItem[]) => void;
  onNext: () => void;
}) {
  const updateItem = (index: number, field: 'qty' | 'rate', value: number) => {
    const updated = lineItems.map((item, i) => {
      if (i !== index || item.isDeduction) return item;
      const qty = field === 'qty' ? value : item.qty;
      const rate = field === 'rate' ? value : item.rate;
      const amount = Math.round(qty * rate);
      const gstAmount = Math.round(amount * item.gstPct / 100);
      return { ...item, qty, rate, amount, gstAmount, total: amount + gstAmount };
    });
    setLineItems(updated);
  };

  const subtotal = lineItems.filter(i => !i.isDeduction).reduce((s, i) => s + i.amount, 0);
  const totalGst = lineItems.filter(i => !i.isDeduction).reduce((s, i) => s + i.gstAmount, 0);
  const subsidyDed = Math.abs(lineItems.find(i => i.isDeduction)?.total || 0);
  const net = subtotal + totalGst - subsidyDed;

  const columns = [
    { title: 'Description', dataIndex: 'description', render: (v: string, r: any) => <div><div className="font-medium">{v}</div><div className="text-xs text-apple-gray">HSN: {r.hsn} | {r.unit}</div></div> },
    { title: 'GST%', dataIndex: 'gstPct', width: 65, render: (v: number, r: any) => r.isDeduction ? '—' : `${v}%` },
    {
      title: 'Qty', dataIndex: 'qty', width: 80, render: (v: number, r: any, idx: number) => r.isDeduction ? '—' : (
        <InputNumber size="small" className="w-16" min={1} value={v} onChange={val => updateItem(idx, 'qty', val || 1)} />
      ),
    },
    {
      title: 'Unit Rate', dataIndex: 'rate', width: 110, render: (v: number, r: any, idx: number) => r.isDeduction ? '—' : (
        <InputNumber size="small" className="w-24" min={0} value={v} onChange={val => updateItem(idx, 'rate', val || 0)} prefix="₹" />
      ),
    },
    { title: 'GST Amt', dataIndex: 'gstAmount', width: 90, render: (v: number, r: any) => r.isDeduction ? '—' : <span className="text-apple-textMuted">{rupees(v)}</span> },
    { title: 'Total', dataIndex: 'total', width: 110, render: (v: number, r: any) => <strong className={r.isDeduction ? 'text-green-600' : 'text-blue-700'}>{r.isDeduction ? `(${rupees(Math.abs(v))})` : rupees(v)}</strong> },
  ];

  return (
    <div className="space-y-4">
      <Alert message="You can edit quantities and unit rates. GST is calculated automatically." type="info" showIcon />
      <Table dataSource={lineItems} columns={columns} rowKey="description" pagination={false} size="small"
        rowClassName={(r: any) => r.isDeduction ? 'bg-green-50' : ''} />
      <div className="flex justify-end">
        <div className="w-64 space-y-1.5 border rounded-xl p-3 bg-transparent">
          {[['Subtotal (excl. GST)', rupees(subtotal)], ['Total GST', rupees(totalGst)], ['Subsidy Deduction', `(${rupees(subsidyDed)})`]].map(([l, v]) => (
            <div key={l} className="flex justify-between text-sm"><span className="text-apple-textMuted">{l}</span><span>{v}</span></div>
          ))}
          <Divider className="!my-1" />
          <div className="flex justify-between"><span className="font-bold text-apple-textLight dark:text-apple-textDark">Net Payable</span><span className="font-bold text-xl text-blue-700">{rupees(net)}</span></div>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="primary" size="large" icon={<FileTextOutlined />} iconPosition="end" onClick={onNext}>
          Preview Invoice
        </Button>
      </div>
    </div>
  );
}

function StepPreviewInvoice({ lineItems, proposal, onNext }: { lineItems: LineItem[]; proposal: any; onNext: () => void }) {
  const subtotal = lineItems.filter(i => !i.isDeduction).reduce((s, i) => s + i.amount, 0);
  const totalGst = lineItems.filter(i => !i.isDeduction).reduce((s, i) => s + i.gstAmount, 0);
  const subsidyDed = Math.abs(lineItems.find(i => i.isDeduction)?.total || 0);
  const net = subtotal + totalGst - subsidyDed;
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Invoice preview card — styled to mimic actual PDF */}
      <div className="border rounded-xl overflow-hidden shadow-md text-sm">
        <div className="bg-slate-900 text-white px-5 py-3 flex justify-between items-center">
          <div><div className="text-lg font-bold">⚡ SLAR SOLAR</div><div className="text-xs text-apple-gray">GST Tax Invoice</div></div>
          <div className="text-right"><div className="text-apple-gray text-xs">Invoice No.</div><div className="font-bold">INV-{new Date().getFullYear()}-XXXX</div><div className="text-xs text-apple-gray">{today}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-0 border-b">
          <div className="p-3 border-r">
            <div className="text-xs text-apple-gray uppercase mb-1">Bill To</div>
            <div className="font-semibold text-apple-textLight dark:text-apple-textDark">Customer Name</div>
            <div className="text-apple-textMuted text-xs">Customer Address</div>
          </div>
          <div className="p-3 bg-transparent">
            <div className="text-xs text-apple-gray uppercase mb-1">From</div>
            <div className="font-semibold text-apple-textLight dark:text-apple-textDark">Slar Solar Private Limited</div>
            <div className="text-apple-textMuted text-xs">GSTIN: 07AAXCS1234P1Z5</div>
          </div>
        </div>
        <div className="px-3 py-2">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-800 text-white"><th className="p-1 text-left">Description</th><th className="p-1 text-right">HSN</th><th className="p-1 text-right">GST%</th><th className="p-1 text-right">Amount</th><th className="p-1 text-right font-bold">Total</th></tr></thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-apple-cardLight dark:bg-apple-cardDark' : 'bg-transparent'}>
                  <td className="p-1">{item.description}</td>
                  <td className="p-1 text-right text-apple-gray">{item.hsn}</td>
                  <td className="p-1 text-right">{item.isDeduction ? '—' : `${item.gstPct}%`}</td>
                  <td className="p-1 text-right">{item.isDeduction ? '—' : rupees(item.amount)}</td>
                  <td className={`p-1 text-right font-bold ${item.isDeduction ? 'text-green-600' : 'text-blue-700'}`}>{item.isDeduction ? `(${rupees(Math.abs(item.total))})` : rupees(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 pb-3 flex justify-end">
          <div className="w-52 space-y-1 text-xs">
            {[['Subtotal', rupees(subtotal)], ['GST', rupees(totalGst)], ['Subsidy', `(${rupees(subsidyDed)})`]].map(([l, v]) => (
              <div key={l} className="flex justify-between text-apple-textMuted"><span>{l}</span><span>{v}</span></div>
            ))}
            <div className="border-t pt-1 flex justify-between font-bold text-base text-blue-700"><span>Net Payable</span><span>{rupees(net)}</span></div>
          </div>
        </div>
        <div className="bg-transparent px-3 py-2 text-xs text-apple-gray text-center border-t">
          UPI: slarsolar@hdfcbank · GSTIN: 07AAXCS1234P1Z5 · Computer-generated invoice, no signature required
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="primary" size="large" danger icon={<TrophyOutlined />} iconPosition="end" onClick={onNext}>
          Confirm & Close Deal
        </Button>
      </div>
    </div>
  );
}

function StepSuccess({ result, onClose }: { result: any; onClose: () => void }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const code = result?.customer?.customerCode || '';

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="text-center py-4 space-y-6">
      <ConfettiCanvas />
      <div className="text-5xl">🎉</div>
      <div>
        <Title level={3} className="!text-green-600 !mb-1">Deal Closed!</Title>
        <Text className="text-apple-textMuted">Invoice & Agreement generated and ready to send.</Text>
      </div>

      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-6 max-w-sm mx-auto shadow-xl">
        <div className="text-blue-200 text-sm uppercase tracking-wider mb-1">Customer ID</div>
        <div className="text-3xl font-bold tracking-wide mb-2">{code}</div>
        <Button icon={<CopyOutlined />} ghost size="small" onClick={copy}>
          {copied ? 'Copied!' : 'Copy ID'}
        </Button>
      </div>

      <Row gutter={16} className="max-w-sm mx-auto">
        <Col span={12}><Statistic title="Net Payable" value={rupees(result?.netPayable || 0)} /></Col>
        <Col span={12}><Statistic title="Line Items" value={result?.lineItems?.length || 0} /></Col>
      </Row>

      <Space direction="vertical" className="w-full max-w-sm mx-auto">
        <Button type="primary" size="large" block onClick={() => navigate(`/customer/${result?.customer?.id}`)}>
          Go to Customer Page →
        </Button>
        <Button
          size="large"
          block
          href={`${api.defaults.baseURL}/invoices/${result?.invoice?.id}/pdf`}
          target="_blank"
          icon={<FileTextOutlined />}
        >
          Download Invoice PDF
        </Button>
        <Button size="large" block onClick={onClose}>
          Close
        </Button>
      </Space>
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────

export default function DealClosingModal({ open, leadId, leadName, onClose, onSuccess }: Props) {
  const [step, setStep] = useState(0);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [result, setResult] = useState<any>(null);

  // Build default line items when proposal is selected
  const buildItems = useCallback((proposal: any): LineItem[] => {
    const panelBase = proposal.panelCount * (proposal.panelWattage * 28);
    const invBase = proposal.inverterCapacity * 9000;
    const structBase = proposal.systemSizeKw * 7000;
    const cabBase = proposal.systemSizeKw * 3500;
    const instBase = proposal.systemSizeKw * 4000;
    const items: LineItem[] = [
      { description: `${proposal.panelBrand} ${proposal.panelModel} ${proposal.panelWattage}Wp Solar Panel`, hsn: '85414011', qty: proposal.panelCount, unit: 'Nos', rate: proposal.panelWattage * 28, gstPct: 12, amount: panelBase, gstAmount: Math.round(panelBase * 0.12), total: Math.round(panelBase * 1.12) },
      { description: `${proposal.inverterBrand} ${proposal.inverterModel} ${proposal.inverterCapacity}kW Inverter`, hsn: '85044090', qty: 1, unit: 'Nos', rate: invBase, gstPct: 18, amount: invBase, gstAmount: Math.round(invBase * 0.18), total: Math.round(invBase * 1.18) },
      { description: 'MS/GI Mounting Structure', hsn: '7308', qty: proposal.systemSizeKw, unit: 'kW', rate: 7000, gstPct: 12, amount: structBase, gstAmount: Math.round(structBase * 0.12), total: Math.round(structBase * 1.12) },
      { description: 'DC/AC Cables, MC4 Connectors', hsn: '85444290', qty: proposal.systemSizeKw, unit: 'kW', rate: 3500, gstPct: 18, amount: cabBase, gstAmount: Math.round(cabBase * 0.18), total: Math.round(cabBase * 1.18) },
      { description: 'Installation & Commissioning', hsn: '998521', qty: 1, unit: 'Job', rate: instBase, gstPct: 18, amount: instBase, gstAmount: Math.round(instBase * 0.18), total: Math.round(instBase * 1.18) },
    ];
    if (proposal.subsidyAmount > 0) {
      items.push({ description: `Govt Subsidy (${proposal.subsidyScheme || 'PM Surya Ghar'})`, hsn: '—', qty: 1, unit: 'Lump', rate: -proposal.subsidyAmount, gstPct: 0, amount: -proposal.subsidyAmount, gstAmount: 0, total: -proposal.subsidyAmount, isDeduction: true });
    }
    return items;
  }, []);

  const closeDealMutation = useMutation({
    mutationFn: () => api.post('/invoices/close-deal', { leadId, proposalId: selectedProposal.id }),
    onSuccess: (res) => {
      setResult(res.data.data);
      setStep(3);
      onSuccess?.(res.data.data.customer.id);
    },
  });

  const handleSelectProposal = (proposal: any) => {
    setSelectedProposal(proposal);
    setLineItems(buildItems(proposal));
    setStep(1);
  };

  const handleClose = () => {
    setStep(0);
    setSelectedProposal(null);
    setLineItems([]);
    setResult(null);
    onClose();
  };

  const STEPS = [
    { title: 'Select Proposal', icon: <TrophyOutlined /> },
    { title: 'Review Invoice', icon: <DollarOutlined /> },
    { title: 'Preview', icon: <FileTextOutlined /> },
    { title: 'Done!', icon: <CheckCircleOutlined /> },
  ];

  return (
    <Modal
      open={open}
      onCancel={step < 3 ? handleClose : undefined}
      closable={step < 3}
      footer={null}
      width={step === 1 ? 800 : 640}
      title={
        step < 3 ? (
          <div className="space-y-4 pb-2">
            <div className="flex items-center gap-2">
              <TrophyOutlined className="text-yellow-500 text-xl" />
              <span className="text-lg font-bold">Close Deal — {leadName}</span>
            </div>
            <Steps current={step} size="small" items={STEPS} />
          </div>
        ) : null
      }
      destroyOnClose
    >
      {step === 0 && <StepConfirmProposal leadId={leadId} onSelect={handleSelectProposal} />}
      {step === 1 && selectedProposal && (
        <StepReviewInvoice
          proposal={selectedProposal}
          lineItems={lineItems}
          setLineItems={setLineItems}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && selectedProposal && (
        <div className="space-y-4">
          <StepPreviewInvoice lineItems={lineItems} proposal={selectedProposal}
            onNext={() => closeDealMutation.mutate()} />
          {closeDealMutation.isPending && (
            <div className="text-center py-4">
              <Spin size="large" />
              <div className="mt-2 text-apple-textMuted">Generating invoice & agreement PDFs...</div>
            </div>
          )}
          {closeDealMutation.isError && (
            <Alert message={(closeDealMutation.error as any)?.response?.data?.error?.message || 'Failed to close deal'} type="error" showIcon />
          )}
        </div>
      )}
      {step === 3 && result && <StepSuccess result={result} onClose={handleClose} />}
    </Modal>
  );
}


