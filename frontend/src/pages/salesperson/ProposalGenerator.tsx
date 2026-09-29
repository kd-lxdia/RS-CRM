import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card, Form, Input, Button, Row, Col, Typography, Tabs, Table, InputNumber,
  Select, message, Space, Divider, Tag,
} from 'antd';
import { FileDown, Sparkles, Sun, Calculator } from 'lucide-react';
import { api } from '../../lib/api';
import { formFields, emptyBom, BomRow } from '../../lib/proposal/fields';
import { generateProposalPdf, computeSolarEconomics } from '../../lib/proposal/generateProposalPdf';

const { Title, Text, Paragraph } = Typography;

// Group visible (non-hidden, non-bom) fields by template page for the form UI.
const PAGES = [1, 2, 6, 7];
const PAGE_TITLES: Record<number, string> = {
  1: 'Cover Page', 2: 'Client Details', 6: 'Project Value & Impact', 7: 'Savings & 3D Design',
};

const ProposalGenerator: React.FC = () => {
  const [params] = useSearchParams();
  const customerId = params.get('customerId');
  const leadId = params.get('leadId');
  const [form] = Form.useForm();
  const [bom, setBom] = useState<BomRow[]>(emptyBom());
  const [generating, setGenerating] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const fieldsByPage = useMemo(() => {
    const map: Record<number, typeof formFields> = {};
    for (const f of formFields) {
      if (f.hidden || f.type === 'bom_table') continue;
      (map[f.page] = map[f.page] || []).push(f);
    }
    return map;
  }, []);

  // Prefill defaults + today's date.
  useEffect(() => {
    const init: Record<string, any> = { date: new Date().toLocaleDateString('en-IN') };
    for (const f of formFields) if (f.defaultValue) init[f.id] = f.defaultValue;
    form.setFieldsValue(init);
  }, []);

  // Prefill from a CRM customer when navigated with ?customerId=.
  useEffect(() => {
    if (!customerId) return;
    api.get(`/customers/${customerId}`).then((res) => {
      const c = res.data?.data || res.data;
      if (!c) return;
      form.setFieldsValue({
        clientName: c.name,
        contactPerson: c.name,
        phoneNumber: c.phone,
        emailAddress: c.email,
        clientAddress: c.address,
        siteAddress: c.address,
        projectLocation: c.city,
      });
      message.success(`Prefilled from customer ${c.name}`);
    }).catch(() => message.warning('Could not load customer — fill manually'));
  }, [customerId]);

  // Prefill from a CRM lead when navigated with ?leadId= (LeadDetail button).
  useEffect(() => {
    if (!leadId) return;
    api.get(`/leads/${leadId}`).then((res) => {
      const l = res.data?.data?.lead || res.data?.data || res.data;
      if (!l?.name) return;
      form.setFieldsValue({
        clientName: l.name,
        contactPerson: l.name,
        phoneNumber: l.phone,
        emailAddress: l.email,
        clientAddress: l.address,
        siteAddress: l.address,
        projectLocation: l.city,
      });
      message.success(`Prefilled from lead ${l.name}`);
    }).catch(() => { /* designer handoff params below still prefill */ });
  }, [leadId]);

  // Prefill from the Solar Designer handoff (?kw=&panels=&panelLabel=...).
  useEffect(() => {
    const kw = params.get('kw');
    if (!kw) return;
    const panels = params.get('panels');
    const panelLabel = params.get('panelLabel');
    const values: Record<string, string> = {
      systemCapacityP1: kw,
      proposedCapacity: kw,
    };
    if (panelLabel) values.moduleType = panels ? `${panels} × ${panelLabel}` : panelLabel;
    if (params.get('name')) {
      values.clientName = params.get('name')!;
      values.contactPerson = params.get('name')!;
    }
    if (params.get('location')) values.projectLocation = params.get('location')!;
    form.setFieldsValue(values);
    message.success(`Design imported: ${kw} kW${panels ? `, ${panels} panels` : ''}`);
  }, []);

  // Compute economics from capacity + tariff and fill the value/impact fields.
  const calcEconomics = () => {
    const kw = parseFloat(form.getFieldValue('proposedCapacity') || form.getFieldValue('systemCapacityP1'));
    const tariff = parseFloat(form.getFieldValue('_tariff') || '8');
    if (!kw) { message.warning('Enter Proposed Capacity (kW) first'); return; }
    const e = computeSolarEconomics(kw, tariff);
    form.setFieldsValue({
      systemCapacityP1: String(kw),
      proposedCapacity: String(kw),
      annualGeneration: e.annualGeneration.toLocaleString('en-IN'),
      avgAnnualSavingP6: e.annualSaving.toLocaleString('en-IN'),
      avgAnnualSavingP7: e.annualSaving.toLocaleString('en-IN'),
      projectedSavings: (e.annualSaving * 25).toLocaleString('en-IN'),
      effectiveProjectCost: e.projectCost.toLocaleString('en-IN'),
      paybackPeriodP6: String(e.payback),
      paybackPeriodP7: `${e.payback} Years`,
      co2Reduction: String(e.co2),
      treesSaved: String(e.trees),
    });
    message.success('Economics calculated');
  };

  // Ask the AI Brain to recommend module/inverter/site text + a savings blurb.
  const aiAutofill = async () => {
    const kw = form.getFieldValue('proposedCapacity') || form.getFieldValue('systemCapacityP1');
    const loc = form.getFieldValue('projectLocation') || 'India';
    setAiBusy(true);
    try {
      const res = await api.post('/ai-brain/complete', {
        feature: 'proposal-autofill',
        json: true,
        maxTokens: 500,
        messages: [
          { role: 'system', content: 'You are a solar sales engineer for Rocker Solar (India). Return STRICT JSON only.' },
          { role: 'user', content: `For a ${kw || 5} kW on-grid rooftop solar plant in ${loc}, return JSON with keys: moduleType (e.g. "540Wp Mono PERC"), inverterType (e.g. "5kW String Inverter"), siteCondition (short, e.g. "RCC Rooftop"), plantType ("On-grid"). Recommend realistic makes.` },
        ],
      });
      let txt = res.data.data.text.trim().replace(/^```json|```$/g, '');
      const j = JSON.parse(txt);
      form.setFieldsValue({
        moduleType: j.moduleType, inverterType: j.inverterType,
        siteCondition: j.siteCondition, plantType: j.plantType || 'On-grid',
      });
      message.success(`AI filled specs (via ${res.data.data.provider})`);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || 'AI autofill failed');
    } finally {
      setAiBusy(false);
    }
  };

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const values = form.getFieldsValue(true);
      await generateProposalPdf(values, bom);
      message.success('Proposal PDF generated');

      // Also record the proposal in the CRM when we know which lead it's for,
      // so it shows up on the lead timeline / proposal analytics.
      if (leadId) {
        const kw = parseFloat(values.proposedCapacity || values.systemCapacityP1) || 0;
        const cost = parseFloat(String(values.effectiveProjectCost || '0').replace(/[^\d.]/g, '')) || 0;
        try {
          await api.post('/proposals', {
            leadId,
            customerId: customerId || undefined,
            systemSizeKw: kw,
            panelBrand: values.moduleType || '',
            panelModel: values.moduleType || '',
            panelCount: parseInt(params.get('panels') || '0') || 0,
            panelWattage: parseInt(params.get('panelWattage') || '0') || 0,
            inverterBrand: values.inverterType || '',
            inverterModel: values.inverterType || '',
            inverterCapacity: kw,
            structureType: values.siteCondition || 'Rooftop',
            roofType: values.siteCondition || 'RCC',
            annualGeneration: parseFloat(String(values.annualGeneration || '0').replace(/[^\d.]/g, '')) || undefined,
            netCost: cost,
          });
          message.success('Proposal saved to CRM (lead timeline)');
        } catch {
          message.warning('PDF bana, par CRM mein save nahi hua — dobara try karein');
        }
      }
    } catch (e: any) {
      message.error(e?.message || 'PDF generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const bomItems = formFields.find((f) => f.type === 'bom_table')!.items!;
  const bomColumns = [
    { title: 'Component', dataIndex: 'component', width: 160, render: (_: any, __: any, i: number) => <Text strong>{bomItems[i]}</Text> },
    { title: 'Make', dataIndex: 'make', render: (_: any, __: any, i: number) => (
      <Input size="small" value={bom[i].make} onChange={(e) => updateBom(i, 'make', e.target.value)} />) },
    { title: 'Spec', dataIndex: 'spec', render: (_: any, __: any, i: number) => (
      <Input size="small" value={bom[i].spec} onChange={(e) => updateBom(i, 'spec', e.target.value)} />) },
    { title: 'Unit', dataIndex: 'unit', width: 90, render: (_: any, __: any, i: number) => (
      <Input size="small" value={bom[i].unit} onChange={(e) => updateBom(i, 'unit', e.target.value)} />) },
    { title: 'Qty', dataIndex: 'qty', width: 80, render: (_: any, __: any, i: number) => (
      <Input size="small" value={bom[i].qty} onChange={(e) => updateBom(i, 'qty', e.target.value)} />) },
  ];
  const updateBom = (i: number, key: keyof BomRow, val: string) => {
    setBom((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <Space align="center" style={{ marginBottom: 4 }}>
        <Sun color="#ef901b" />
        <Title level={3} style={{ margin: 0 }}>Proposal Generator</Title>
        <Tag color="orange">RS Branded PDF</Tag>
      </Space>
      <Paragraph type="secondary">
        Fill the details, auto-calculate savings, let AI recommend specs, then export a 12-page Rocker Solar quotation PDF.
      </Paragraph>

      <Form form={form} layout="vertical">
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col><Form.Item name="_tariff" label="Electricity Tariff (₹/unit)" initialValue="8"><InputNumber min={1} /></Form.Item></Col>
          <Col style={{ display: 'flex', alignItems: 'end', gap: 8, paddingBottom: 24 }}>
            <Button icon={<Calculator size={15} />} onClick={calcEconomics}>Calculate Economics</Button>
            <Button icon={<Sparkles size={15} />} loading={aiBusy} onClick={aiAutofill}>AI Auto-fill Specs</Button>
          </Col>
        </Row>

        <Tabs
          items={[
            ...PAGES.map((p) => ({
              key: String(p),
              label: PAGE_TITLES[p],
              children: (
                <Card size="small">
                  <Row gutter={12}>
                    {(fieldsByPage[p] || []).map((f) => (
                      <Col xs={24} sm={12} md={8} key={`${f.page}-${f.id}`}>
                        <Form.Item name={f.id} label={f.label}>
                          {f.type === 'select'
                            ? <Select options={(f.options || []).map((o) => ({ value: o, label: o }))} />
                            : <Input />}
                        </Form.Item>
                      </Col>
                    ))}
                  </Row>
                </Card>
              ),
            })),
            {
              key: 'bom',
              label: 'Bill of Materials',
              children: (
                <Table size="small" rowKey={(_, i) => String(i)} pagination={false}
                  dataSource={bomItems.map((it) => ({ component: it }))} columns={bomColumns as any} />
              ),
            },
          ]}
        />

        <Divider />
        <Button type="primary" size="large" icon={<FileDown size={18} />} loading={generating} onClick={onGenerate}>
          Generate Proposal PDF
        </Button>
      </Form>
    </div>
  );
};

export default ProposalGenerator;
