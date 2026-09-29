import React, { useEffect, useState } from 'react';
import {
  Card, Row, Col, Statistic, Button, Segmented, Input, Typography, Tag, Spin,
  message, Divider, Empty, List,
} from 'antd';
import {
  TrendingUp, IndianRupee, Package, Users, Sparkles, RefreshCw, AlertTriangle, Target,
} from 'lucide-react';
import { api } from '../../lib/api';

const { Title, Text, Paragraph } = Typography;

type Period = 'today' | 'week' | 'month' | 'all';
const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

// Very light markdown-ish renderer for the AI briefing (headings, bullets, bold).
function ReportText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div style={{ lineHeight: 1.7 }}>
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div key={i} style={{ height: 8 }} />;
        const clean = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/^[-*]\s*/, '');
        const isHeading = /^#{1,6}\s/.test(line) || (/^\*\*.*\*\*:?$/.test(line));
        const isBullet = /^[-*]\s/.test(line);
        if (isHeading) return <Title key={i} level={5} style={{ margin: '14px 0 4px' }}>{clean.replace(/:$/, '')}</Title>;
        if (isBullet) return <div key={i} style={{ paddingLeft: 16 }}>• {clean}</div>;
        return <Paragraph key={i} style={{ margin: '2px 0' }}>{clean}</Paragraph>;
      })}
    </div>
  );
}

const BusinessReports: React.FC = () => {
  const [period, setPeriod] = useState<Period>('month');
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiProvider, setAiProvider] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadSnapshot = async (p: Period) => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/snapshot?period=${p}`);
      setSnapshot(res.data.data);
    } catch {
      message.error('Could not load metrics');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get('/reports/history');
      setHistory(res.data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadSnapshot(period); }, [period]);
  useEffect(() => { loadHistory(); }, []);

  const generateAi = async () => {
    setAiBusy(true);
    setAiText('');
    try {
      const res = await api.post('/reports/ai', { period, strategy });
      setAiText(res.data.data.text);
      setAiProvider(res.data.data.provider);
      loadHistory();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || 'AI report failed');
    } finally {
      setAiBusy(false);
    }
  };

  const s = snapshot;
  return (
    <div style={{ maxWidth: 1150 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Business Command Center</Title>
          <Text type="secondary">Poore business ki live report — kya chal raha hai, kya dikkat hai, kya karna hai.</Text>
        </div>
        <Segmented
          value={period}
          onChange={(v) => setPeriod(v as Period)}
          options={[
            { label: 'Aaj', value: 'today' },
            { label: 'Hafta', value: 'week' },
            { label: 'Mahina', value: 'month' },
            { label: 'All', value: 'all' },
          ]}
        />
      </div>

      <Spin spinning={loading}>
        {s && (
          <>
            {/* Sales */}
            <Divider orientation="left" plain><TrendingUp size={15} style={{ verticalAlign: -2 }} /> Sales</Divider>
            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}><Card><Statistic title="Total Leads" value={s.sales.totalLeads} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="Conversion" value={s.sales.conversionRatePct} suffix="%" valueStyle={{ color: s.sales.conversionRatePct < 20 ? '#ef4444' : '#10b981' }} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="Raw Leads Pending" value={s.sales.rawLeadsPending} valueStyle={{ color: s.sales.rawLeadsPending > 20 ? '#f59e0b' : undefined }} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="Pipeline Value" value={inr(s.sales.pipelineValue)} /></Card></Col>
            </Row>

            {/* Revenue / Accounting */}
            <Divider orientation="left" plain><IndianRupee size={15} style={{ verticalAlign: -2 }} /> Paisa (Accounts)</Divider>
            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}><Card><Statistic title="Collected" value={inr(s.revenue.totalCollected)} valueStyle={{ color: '#10b981' }} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="Outstanding (aana baaki)" value={inr(s.revenue.outstandingReceivables)} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="Overdue" value={inr(s.revenue.overdueAmount)} suffix={`(${s.revenue.overdueCount})`} valueStyle={{ color: s.revenue.overdueAmount > 0 ? '#ef4444' : undefined }} /></Card></Col>
              <Col xs={12} md={6}><Card><Statistic title="Avg Deal Value" value={inr(s.revenue.avgDealValue)} /></Card></Col>
            </Row>

            {/* Inventory + Operations */}
            <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
              <Col xs={24} md={12}>
                <Card title={<><Package size={15} style={{ verticalAlign: -2 }} /> Inventory (Warehouse)</>} size="small">
                  <Row gutter={12}>
                    <Col span={8}><Statistic title="Items" value={s.inventory.totalItems} /></Col>
                    <Col span={8}><Statistic title="Low Stock" value={s.inventory.lowStockItems} valueStyle={{ color: s.inventory.lowStockItems > 0 ? '#f59e0b' : undefined }} /></Col>
                    <Col span={8}><Statistic title="Pending Dispatch" value={s.inventory.pendingDispatches} /></Col>
                  </Row>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title={<><Users size={15} style={{ verticalAlign: -2 }} /> Operations</>} size="small">
                  <Row gutter={12}>
                    <Col span={6}><Statistic title="Open Tasks" value={s.operations.openTasks} /></Col>
                    <Col span={6}><Statistic title="Overdue" value={s.operations.overdueTasks} valueStyle={{ color: s.operations.overdueTasks > 0 ? '#ef4444' : undefined }} /></Col>
                    <Col span={6}><Statistic title="Escalations" value={s.operations.openEscalations} valueStyle={{ color: s.operations.openEscalations > 0 ? '#ef4444' : undefined }} /></Col>
                    <Col span={6}><Statistic title="Active Users" value={s.operations.activeUsers} /></Col>
                  </Row>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Spin>

      {/* AI Briefing */}
      <Card style={{ marginTop: 20 }} className="shadow-sm">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Sparkles size={20} color="#7c4dff" />
          <Title level={4} style={{ margin: 0 }}>AI Business Briefing</Title>
          {aiProvider && <Tag color="purple">{aiProvider}</Tag>}
        </div>
        <Paragraph type="secondary" style={{ marginBottom: 8 }}>
          <Target size={14} style={{ verticalAlign: -2 }} /> Apni strategy/goal likho — AI usi hisaab se report dega (kya chal raha, kya dikkat, kya karna hai).
        </Paragraph>
        <Input.TextArea
          rows={2}
          placeholder="e.g. Is mahine 25 residential installs aur receivables 5L tak lana hai..."
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        <Button type="primary" icon={<Sparkles size={15} />} loading={aiBusy} onClick={generateAi}>
          Generate Report
        </Button>

        {aiBusy && <div style={{ marginTop: 16 }}><Spin /> <Text type="secondary">AI poora business analyse kar raha hai...</Text></div>}
        {aiText && (
          <div style={{ marginTop: 16, background: 'rgba(124,77,255,0.04)', padding: 16, borderRadius: 8 }}>
            <ReportText text={aiText} />
          </div>
        )}
      </Card>

      {/* History */}
      <Card style={{ marginTop: 20 }} title={<><RefreshCw size={15} style={{ verticalAlign: -2 }} /> Pichli Reports</>} size="small">
        {history.length === 0 ? (
          <Empty description="Abhi tak koi report nahi" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={history}
            renderItem={(r) => (
              <List.Item
                actions={[<Button key="v" type="link" size="small" onClick={() => { setAiText(r.message); setAiProvider(''); window.scrollTo({ top: 400, behavior: 'smooth' }); }}>Dekho</Button>]}
              >
                <List.Item.Meta
                  title={r.title}
                  description={new Date(r.createdAt).toLocaleString('en-IN')}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};

export default BusinessReports;
