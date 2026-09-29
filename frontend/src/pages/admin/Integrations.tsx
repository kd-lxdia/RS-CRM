import React, { useEffect, useState } from 'react';
import {
  Card, Row, Col, Switch, Button, Typography, Tabs, Form, Input, InputNumber,
  Select, message, Tag, Tooltip, Divider, Space,
} from 'antd';
import {
  Facebook, Globe, Webhook, Mail, KeyRound, Brain, Copy, RefreshCw, Zap,
} from 'lucide-react';
import { api } from '../../lib/api';

const { Title, Text, Paragraph } = Typography;

// ─── Lead source metadata (mirrors the Quickest-style cards) ────────────────
const SOURCE_META: Record<string, { title: string; desc: string; icon: React.ReactNode; color: string }> = {
  facebook: {
    title: 'Facebook Integration',
    desc: 'Connect your Facebook lead ads and get leads from your Facebook pages.',
    icon: <Facebook size={22} />,
    color: '#1877f2',
  },
  indiamart: {
    title: 'IndiaMART Integration',
    desc: 'Connect your IndiaMART account and get enquiries as leads automatically.',
    icon: <Globe size={22} />,
    color: '#e53935',
  },
  tradeindia: {
    title: 'TradeIndia Integration',
    desc: 'Connect your TradeIndia account and get inquiries as leads automatically.',
    icon: <Globe size={22} />,
    color: '#fb8c00',
  },
  aajjo: {
    title: 'Aajjo Integration',
    desc: 'Connect your Aajjo account and get leads from your Aajjo listings.',
    icon: <Globe size={22} />,
    color: '#8e24aa',
  },
  webhook: {
    title: 'Webhook / API Integration',
    desc: 'Import leads from any other CRM or website using a secure webhook URL.',
    icon: <Webhook size={22} />,
    color: '#3949ab',
  },
};

interface SourceState {
  enabled: boolean;
  leadsReceived: number;
  lastLeadAt: string | null;
  webhookUrl: string;
}

const IntegrationsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<Record<string, SourceState>>({});
  const [emailForm] = Form.useForm();
  const [aiForm] = Form.useForm();
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [intRes, aiRes] = await Promise.all([
        api.get('/integrations/config'),
        api.get('/ai-brain/config'),
      ]);
      setSources(intRes.data.data.sources);
      emailForm.setFieldsValue(intRes.data.data.email);
      const ai = aiRes.data.data;
      setAiConfig(ai);
      aiForm.setFieldsValue({
        primary: ai.primary,
        openaiModel: ai.providers.openai.model,
        claudeModel: ai.providers.claude.model,
        geminiModel: ai.providers.gemini.model,
        openrouterModel: ai.providers.openrouter.model,
      });
    } catch {
      message.error('Could not load integration settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleSource = async (key: string, enabled: boolean) => {
    try {
      const res = await api.put('/integrations/config', { sources: { [key]: { enabled } } });
      setSources(res.data.data.sources);
      message.success(`${SOURCE_META[key].title} ${enabled ? 'connected' : 'disconnected'}`);
    } catch {
      message.error('Update failed');
    }
  };

  const regenToken = async (key: string) => {
    try {
      const res = await api.post(`/integrations/config/${key}/regenerate-token`);
      setSources(res.data.data.sources);
      message.success('New webhook URL generated — update it at the source platform.');
    } catch {
      message.error('Could not regenerate token');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    message.success('Webhook URL copied');
  };

  const saveEmail = async (values: any) => {
    try {
      await api.put('/integrations/config', { email: values });
      message.success('Email settings saved');
    } catch {
      message.error('Could not save email settings');
    }
  };

  const saveAi = async (values: any) => {
    try {
      const providers: any = {
        openai: { apiKey: values.openaiKey || '', model: values.openaiModel },
        claude: { apiKey: values.claudeKey || '', model: values.claudeModel },
        gemini: { apiKey: values.geminiKey || '', model: values.geminiModel },
        openrouter: { apiKey: values.openrouterKey || '', model: values.openrouterModel },
      };
      const res = await api.put('/ai-brain/config', { primary: values.primary, providers });
      setAiConfig(res.data.data);
      aiForm.setFieldsValue({ openaiKey: '', claudeKey: '', geminiKey: '', openrouterKey: '' });
      message.success('AI Brain settings saved');
    } catch {
      message.error('Could not save AI settings');
    }
  };

  const testAi = async () => {
    setTesting(true);
    try {
      const res = await api.post('/ai-brain/complete', {
        feature: 'settings-test',
        prompt: 'Reply in one short Hinglish line confirming SLAR AI Brain is working.',
        maxTokens: 60,
      });
      message.success(`AI (${res.data.data.provider}): ${res.data.data.text}`, 6);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || 'AI test failed', 6);
    } finally {
      setTesting(false);
    }
  };

  const leadSourceCards = (
    <Row gutter={[16, 16]}>
      {Object.entries(SOURCE_META).map(([key, meta]) => {
        const s = sources[key];
        return (
          <Col xs={24} md={12} key={key}>
            <Card loading={loading}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                  <Title level={5} style={{ margin: 0 }}>{meta.title}</Title>
                </Space>
                <Switch checked={!!s?.enabled} onChange={(v) => toggleSource(key, v)} />
              </div>
              <Paragraph type="secondary" style={{ margin: '10px 0 8px' }}>{meta.desc}</Paragraph>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {s?.enabled
                  ? <Tag color="green">Connected</Tag>
                  : <Tag>Not Connected</Tag>}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {s?.leadsReceived ?? 0} leads received
                </Text>
              </div>
              {s?.enabled && (
                <>
                  <Divider style={{ margin: '10px 0' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Webhook URL (paste at {meta.title.split(' ')[0]}):</Text>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Input size="small" readOnly value={s.webhookUrl} />
                    <Tooltip title="Copy URL">
                      <Button size="small" icon={<Copy size={14} />} onClick={() => copyUrl(s.webhookUrl)} />
                    </Tooltip>
                    <Tooltip title="Regenerate secret URL">
                      <Button size="small" icon={<RefreshCw size={14} />} onClick={() => regenToken(key)} />
                    </Tooltip>
                  </div>
                </>
              )}
            </Card>
          </Col>
        );
      })}
      <Col xs={24} md={12}>
        <Card loading={loading}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <span style={{ color: '#43a047' }}><Mail size={22} /></span>
              <Title level={5} style={{ margin: 0 }}>Email Integration</Title>
            </Space>
          </div>
          <Paragraph type="secondary" style={{ margin: '10px 0' }}>
            Connect a mail server (SMTP — Zoho, Gmail, Office 365, others) to send custom emails.
          </Paragraph>
          <Form form={emailForm} layout="vertical" onFinish={saveEmail} size="small">
            <Row gutter={8}>
              <Col span={12}><Form.Item name="host" label="SMTP Host"><Input placeholder="smtp.zoho.in" /></Form.Item></Col>
              <Col span={6}><Form.Item name="port" label="Port"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
              <Col span={6}><Form.Item name="secure" label="SSL" valuePropName="checked"><Switch /></Form.Item></Col>
            </Row>
            <Row gutter={8}>
              <Col span={12}><Form.Item name="user" label="Username"><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="pass" label="Password"><Input.Password /></Form.Item></Col>
            </Row>
            <Row gutter={8} align="bottom">
              <Col span={12}><Form.Item name="fromName" label="From Name"><Input /></Form.Item></Col>
              <Col span={6}><Form.Item name="enabled" label="Enabled" valuePropName="checked"><Switch /></Form.Item></Col>
              <Col span={6}><Button type="primary" htmlType="submit" block>Save</Button></Col>
            </Row>
          </Form>
        </Card>
      </Col>
    </Row>
  );

  const providerRow = (name: string, keyField: string, modelField: string, hasKey: boolean, keyPreview: string) => (
    <Row gutter={12} align="middle">
      <Col span={5}>
        <Space>
          <KeyRound size={14} />
          <Text strong style={{ textTransform: 'capitalize' }}>{name}</Text>
          {hasKey ? <Tag color="green">Key set {keyPreview && `(${keyPreview})`}</Tag> : <Tag>No key</Tag>}
        </Space>
      </Col>
      <Col span={11}>
        <Form.Item name={keyField} style={{ margin: 0 }}>
          <Input.Password placeholder={hasKey ? 'Leave blank to keep existing key' : 'Paste API key'} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name={modelField} style={{ margin: 0 }}>
          <Input placeholder="model id" />
        </Form.Item>
      </Col>
    </Row>
  );

  const aiBrainTab = (
    <Card loading={loading}>
      <Space align="center" style={{ marginBottom: 12 }}>
        <Brain size={22} color="#7c4dff" />
        <Title level={5} style={{ margin: 0 }}>AI Brain — Multi-LLM Settings</Title>
      </Space>
      <Paragraph type="secondary">
        Choose the primary brain. If it fails, the CRM automatically falls back to the other configured providers.
      </Paragraph>
      <Form form={aiForm} layout="vertical" onFinish={saveAi}>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="primary" label="Primary Provider">
              <Select options={[
                { value: 'gemini', label: 'Google Gemini' },
                { value: 'openai', label: 'OpenAI (ChatGPT)' },
                { value: 'claude', label: 'Claude (Anthropic)' },
                { value: 'openrouter', label: 'OpenRouter (100+ models)' },
              ]} />
            </Form.Item>
          </Col>
        </Row>
        <Divider style={{ margin: '8px 0 16px' }} orientation="left" plain>Provider keys & models</Divider>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {aiConfig && providerRow('gemini', 'geminiKey', 'geminiModel', aiConfig.providers.gemini.hasKey, aiConfig.providers.gemini.keyPreview)}
          {aiConfig && providerRow('openai', 'openaiKey', 'openaiModel', aiConfig.providers.openai.hasKey, aiConfig.providers.openai.keyPreview)}
          {aiConfig && providerRow('claude', 'claudeKey', 'claudeModel', aiConfig.providers.claude.hasKey, aiConfig.providers.claude.keyPreview)}
          {aiConfig && providerRow('openrouter', 'openrouterKey', 'openrouterModel', aiConfig.providers.openrouter.hasKey, aiConfig.providers.openrouter.keyPreview)}
        </Space>
        <Divider style={{ margin: '16px 0' }} />
        <Space>
          <Button type="primary" htmlType="submit">Save AI Settings</Button>
          <Button icon={<Zap size={14} />} loading={testing} onClick={testAi}>Test AI Brain</Button>
        </Space>
      </Form>
    </Card>
  );

  return (
    <div style={{ maxWidth: 1100 }}>
      <Title level={3}>Integrations</Title>
      <Tabs
        items={[
          { key: 'sources', label: 'Lead Sources', children: leadSourceCards },
          { key: 'ai', label: 'AI Brain', children: aiBrainTab },
        ]}
      />
    </div>
  );
};

export default IntegrationsPage;
