import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Steps, Card, Button, InputNumber, Select, Slider, Form, Divider,
  Typography, Tag, Switch, Table, Modal, Input,
  Row, Col, message, Alert, Spin,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowRightOutlined, ThunderboltOutlined, DownloadOutlined,
  SendOutlined, SaveOutlined, CheckCircleOutlined, ReloadOutlined,
  BulbOutlined, HomeOutlined, CalculatorOutlined, FileTextOutlined, LinkOutlined, AimOutlined,
} from '@ant-design/icons';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RtTooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import RoofMapper from '../../components/solar-designer/RoofMapper';
const Solar3DViewer = lazy(() => import('../../components/solar-designer/Solar3DViewer'));
import {
  generatePanelLayout, latlngToMeters,
  PanelLayoutResult,
} from '../../components/solar-designer/PanelLayoutEngine';
import type { RoofSection } from '../../components/solar-designer/RoofMapper';
import { api } from '../../lib/api';

const { Title, Text } = Typography;
const { Option } = Select;

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    // Instant setView guarded against invalid coords / unsized container.
    // Leaflet's animated flyTo unprojects per frame and yields NaN LatLng
    // (crash) when the map mounts inside an animating/zero-size container.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const id = requestAnimationFrame(() => {
      try {
        map.invalidateSize();
        map.setView([lat, lng], 19, { animate: false });
      } catch { /* map unmounted */ }
    });
    return () => cancelAnimationFrame(id);
  }, [lat, lng, map]);
  return null;
}

function MapEvents({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      const center = map.getCenter();
      onMove(center.lat, center.lng);
    };
    map.on('moveend', handler);
    return () => { map.off('moveend', handler); };
  }, [map, onMove]);
  return null;
}

const EMPTY_LAYOUT: PanelLayoutResult = { panels: [], count: 0, coveredAreaSqM: 0, coveredAreaSqFt: 0, layoutEfficiency: 0, roofAreaSqM: 0 };

// ─── Inline panel & inverter data (mirrors backend DB to avoid network call on step 2) ─
interface LocalPanel {
  brand: string; model: string; wattage: number;
  voc: number; efficiency: number; length_mm: number; width_mm: number;
  isDCR: boolean; warranty_years: number; tempCoeffVoc: number;
  vmpp: number; isc: number; impp: number; weight_kg: number;
}
interface LocalInverter {
  brand: string; model: string; capacityKw: number;
  maxInputVoltage: number; mpptCount: number; efficiency: number;
  phase: string; warranty_years: number;
}

// Simplified subset of panel database for frontend bundle
const PANELS: LocalPanel[] = [
  { brand:'Waaree', model:'WS-440M', wattage:440, voc:49.5, efficiency:0.215, length_mm:2108, width_mm:1048, isDCR:true, warranty_years:25, tempCoeffVoc:-0.0028, vmpp:41.5, isc:10.8, impp:10.3, weight_kg:22.5 },
  { brand:'Waaree', model:'WS-540M', wattage:540, voc:49.9, efficiency:0.209, length_mm:2272, width_mm:1134, isDCR:true, warranty_years:25, tempCoeffVoc:-0.0028, vmpp:42.0, isc:13.7, impp:12.9, weight_kg:27.5 },
  { brand:'Waaree', model:'WS-580M', wattage:580, voc:51.5, efficiency:0.221, length_mm:2382, width_mm:1134, isDCR:true, warranty_years:25, tempCoeffVoc:-0.0028, vmpp:43.2, isc:14.2, impp:13.4, weight_kg:29.0 },
  { brand:'Adani Solar', model:'ADT440MH4', wattage:440, voc:49.2, efficiency:0.213, length_mm:2094, width_mm:1038, isDCR:true, warranty_years:25, tempCoeffVoc:-0.0029, vmpp:41.2, isc:10.9, impp:10.4, weight_kg:22.0 },
  { brand:'Adani Solar', model:'ADT545MH4', wattage:545, voc:50.1, efficiency:0.211, length_mm:2278, width_mm:1134, isDCR:true, warranty_years:25, tempCoeffVoc:-0.0028, vmpp:42.5, isc:13.8, impp:13.0, weight_kg:27.8 },
  { brand:'Tata Power Solar', model:'TP435M72/5BB', wattage:435, voc:48.8, efficiency:0.211, length_mm:2094, width_mm:1038, isDCR:true, warranty_years:25, tempCoeffVoc:-0.0029, vmpp:40.9, isc:10.8, impp:10.2, weight_kg:22.0 },
  { brand:'Tata Power Solar', model:'TP540M144', wattage:540, voc:50.2, efficiency:0.209, length_mm:2274, width_mm:1134, isDCR:true, warranty_years:25, tempCoeffVoc:-0.0027, vmpp:42.3, isc:13.65, impp:12.88, weight_kg:27.4 },
  { brand:'JinkoSolar', model:'Tiger Neo 580N', wattage:580, voc:52.2, efficiency:0.224, length_mm:2465, width_mm:1134, isDCR:false, warranty_years:25, tempCoeffVoc:-0.0024, vmpp:44.4, isc:13.99, impp:13.07, weight_kg:31.0 },
  { brand:'LONGi', model:'Hi-MO 6 430M', wattage:430, voc:41.9, efficiency:0.220, length_mm:1722, width_mm:1134, isDCR:false, warranty_years:25, tempCoeffVoc:-0.0026, vmpp:35.2, isc:13.18, impp:12.23, weight_kg:21.3 },
  { brand:'LONGi', model:'Hi-MO 7 580M', wattage:580, voc:45.7, efficiency:0.225, length_mm:2278, width_mm:1134, isDCR:false, warranty_years:25, tempCoeffVoc:-0.0025, vmpp:38.8, isc:16.43, impp:14.95, weight_kg:28.0 },
];

const INVERTERS: LocalInverter[] = [
  { brand:'Havells', model:'Solero 3kW', capacityKw:3, maxInputVoltage:600, mpptCount:2, efficiency:0.975, phase:'Single', warranty_years:5 },
  { brand:'Havells', model:'Solero 5kW', capacityKw:5, maxInputVoltage:800, mpptCount:2, efficiency:0.974, phase:'Single', warranty_years:5 },
  { brand:'Solis', model:'S5-GR3P10K', capacityKw:10, maxInputVoltage:1000, mpptCount:3, efficiency:0.980, phase:'Three', warranty_years:5 },
  { brand:'Growatt', model:'MID 10KTL3-X', capacityKw:10, maxInputVoltage:1000, mpptCount:4, efficiency:0.984, phase:'Three', warranty_years:5 },
  { brand:'Huawei', model:'SUN2000-10KTL', capacityKw:10, maxInputVoltage:1100, mpptCount:4, efficiency:0.985, phase:'Three', warranty_years:5 },
  { brand:'GoodWe', model:'GW5048-EM', capacityKw:5, maxInputVoltage:600, mpptCount:2, efficiency:0.977, phase:'Single', warranty_years:5 },
  { brand:'Fronius', model:'Symo 10.0-3', capacityKw:10, maxInputVoltage:1000, mpptCount:3, efficiency:0.980, phase:'Three', warranty_years:5 },
  { brand:'Delta', model:'M10A 3PH10K', capacityKw:10, maxInputVoltage:1000, mpptCount:4, efficiency:0.980, phase:'Three', warranty_years:5 },
];

const panelBrands = [...new Set(PANELS.map(p => p.brand))];
const inverterBrands = [...new Set(INVERTERS.map(i => i.brand))];

function fmt(n: number) { return `₹${n.toLocaleString('en-IN')}`; }
function fmtKw(n: number) { return `${n.toFixed(1)} kW`; }

// ─── Proposal State ───────────────────────────────────────────────────────────

interface CostLine {
  key: string; label: string; qty: number;
  rate: number; unit: string; gst: number; amount: number; editable?: boolean;
}

interface ProposalState {
  // Step 1
  roofSections: RoofSection[];
  address: string;
  lat: number;
  lng: number;
  // Step 2
  monthlyBill: number;
  tariff: number;
  systemKw: number;
  panelBrand: string;
  panelModel: string;
  inverterBrand: string;
  inverterModel: string;
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  layout: PanelLayoutResult;
  showShading: boolean;
  shadingRunning: boolean;
  // Step 3
  costLines: CostLine[];
  subsidyScheme: 'PM_SURYA_GHAR' | 'BOTH' | 'CM_SCHEME' | 'NONE';
  loanEnabled: boolean;
  loanAmount: number;
  loanRate: number;
  loanTenure: number;
  tariffEscalation: number;
  // Computed
  panelCount: number;
  systemCost: number;
  totalSubsidy: number;
  netCost: number;
  annualKwh: number;
  annualSavings: number;
  paybackYears: number;
  irr: number;
  lifetimeSavings: number;
  co2Tonnes: number;
  treesEquivalent: number;
  emi: number | null;
  hardwareCost: number;
  structureCost: number;
  labourCost: number;
  transportationCost: number;
  netMeteringCost: number;
  totalCost: number;
  grossProfit: number;
  marginPercentage: number;
  manualCostsEdited: boolean;
}

// ─── Financial Helpers (inline to avoid circular imports) ─────────────────────

function calcEMI(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  if (annualRatePct === 0) return Math.round(principal / months);
  const r = annualRatePct / 100 / 12;
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.round(emi);
}

function calcIRR(cashflows: number[]): number {
  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let npv = 0, dNpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      npv += cashflows[t] / Math.pow(1 + rate, t);
      dNpv -= t * cashflows[t] / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(dNpv) < 1e-10) break;
    const next = rate - npv / dNpv;
    if (Math.abs(next - rate) < 1e-6) { rate = next; break; }
    rate = next;
  }
  return Math.round(rate * 1000) / 10;
}

function buildYearlyProjection(netCost: number, annualSavingsYr1: number, escalation: number, years = 25) {
  const rows: { year: number; savings: number; cumulative: number }[] = [];
  let cumulative = -netCost;
  for (let yr = 1; yr <= years; yr++) {
    const savings = Math.round(annualSavingsYr1 * Math.pow(1 + escalation / 100, yr - 1) * Math.pow(0.995, yr - 1));
    cumulative += savings;
    rows.push({ year: yr, savings, cumulative });
  }
  return rows;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SolarDesigner() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const leadId = searchParams.get('leadId');
  const customerId = searchParams.get('customerId');
  const [step, setStep] = useState(0);
  const [sendModalOpen, setSendModalOpen] = useState(false);

  const { data: leadData } = useQuery({
    queryKey: ['lead-for-proposal', leadId],
    queryFn: () => api.get(`/leads/${leadId}`).then(r => r.data.data),
    enabled: !!leadId,
  });

  const address = leadData?.address || leadData?.city || '';

  const [state, setState] = useState<ProposalState>({
    roofSections: [], address, lat: 28.6139, lng: 77.2090,
    monthlyBill: 8000, tariff: 8, systemKw: 5,
    panelBrand: 'Waaree', panelModel: 'WS-540M',
    inverterBrand: 'Growatt', inverterModel: 'MID 10KTL3-X',
    orientation: 'PORTRAIT', layout: EMPTY_LAYOUT,
    showShading: false, shadingRunning: false,
    costLines: [], subsidyScheme: 'BOTH',
    loanEnabled: false, loanAmount: 0, loanRate: 9, loanTenure: 60,
    tariffEscalation: 3,
    panelCount: 0, systemCost: 0, totalSubsidy: 0, netCost: 0,
    annualKwh: 0, annualSavings: 0, paybackYears: 0, irr: 0,
    lifetimeSavings: 0, co2Tonnes: 0, treesEquivalent: 0, emi: null,
    hardwareCost: 0, structureCost: 0, labourCost: 0, transportationCost: 0, netMeteringCost: 0,
    totalCost: 0, grossProfit: 0, marginPercentage: 0, manualCostsEdited: false,
  });

  const [searchAddress, setSearchAddress] = useState(address);
  const [isSearching, setIsSearching] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  useEffect(() => {
    if (leadData) {
      set({ lat: leadData.lat || 28.6139, lng: leadData.lng || 77.2090 });
      setSearchAddress(leadData.address || leadData.city || '');
    }
  }, [leadData]);

  const handleGeocode = async () => {
    if (!searchAddress) return;
    setIsSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchAddress)}&format=json&limit=1`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.length > 0) {
        set({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const set = (partial: Partial<ProposalState>) => setState(s => ({ ...s, ...partial }));

  const selectedPanel = PANELS.find(p => p.brand === state.panelBrand && p.model === state.panelModel) || PANELS[1];
  const selectedInverter = INVERTERS.find(i => i.brand === state.inverterBrand && i.model === state.inverterModel) || INVERTERS[2];
  const filteredPanels = PANELS.filter(p => p.brand === state.panelBrand);
  const filteredInverters = INVERTERS.filter(i => i.brand === state.inverterBrand);

  // ─── Auto-calculations ────────────────────────────────────────────────────

  useEffect(() => {
    const { systemKw, tariff, monthlyBill } = state;
    // Panel count
    const panelCount = Math.ceil(systemKw * 1000 / selectedPanel.wattage);
    // Annual generation: Delhi default 5.5 PSH, 80% PR
    const annualKwh = Math.round(systemKw * 5.5 * 0.80 * 365);
    const annualSavings = Math.round(annualKwh * tariff);

    // Cost lines
    const panelRatePerW = 28; // ₹28/W approximate
    const panelCost = Math.round(panelCount * selectedPanel.wattage * panelRatePerW);
    const inverterCost = Math.round(selectedInverter.capacityKw * 9000);
    const mountingCost = Math.round(systemKw * 7000);
    const cablesCost = Math.round(systemKw * 3500);
    const installCost = Math.round(systemKw * 4000);
    const gstPanels = Math.round(panelCost * 0.12 + mountingCost * 0.12);
    const gstInverterInstall = Math.round(inverterCost * 0.18 + installCost * 0.18);
    const systemCost = panelCost + inverterCost + mountingCost + cablesCost + installCost + gstPanels + gstInverterInstall;

    // Subsidy
    let pmSubsidy = 0;
    if (state.subsidyScheme !== 'NONE') {
      if (systemKw <= 2) pmSubsidy = Math.round(systemKw * 30000);
      else if (systemKw <= 3) pmSubsidy = 60000 + Math.round((systemKw - 2) * 18000);
      else pmSubsidy = 78000;
    }
    let cmSubsidy = 0;
    if (state.subsidyScheme === 'BOTH' || state.subsidyScheme === 'CM_SCHEME') {
      cmSubsidy = systemKw <= 3 ? Math.round(systemKw * 2000) : 6000;
    }
    const totalSubsidy = (state.subsidyScheme === 'CM_SCHEME' ? 0 : pmSubsidy) +
                         (state.subsidyScheme === 'PM_SURYA_GHAR' ? 0 : cmSubsidy);

    // Dynamic cost overrides based on manual edits
    const defaultHardwareCost = panelCost + inverterCost + gstPanels + gstInverterInstall;
    const defaultStructureCost = mountingCost + cablesCost;
    const defaultLabourCost = installCost;
    const defaultTransportationCost = 10000;
    const defaultNetMeteringCost = 5000;

    const hardwareCost = state.manualCostsEdited ? state.hardwareCost : defaultHardwareCost;
    const structureCost = state.manualCostsEdited ? state.structureCost : defaultStructureCost;
    const labourCost = state.manualCostsEdited ? state.labourCost : defaultLabourCost;
    const transportationCost = state.manualCostsEdited ? state.transportationCost : defaultTransportationCost;
    const netMeteringCost = state.manualCostsEdited ? state.netMeteringCost : defaultNetMeteringCost;

    const totalCost = hardwareCost + structureCost + labourCost + transportationCost + netMeteringCost;
    
    // Selling price
    const defaultNetCost = Math.max(0, systemCost - totalSubsidy);
    const netCost = state.manualCostsEdited ? state.netCost : defaultNetCost;

    const grossProfit = netCost - totalCost;
    const marginPercentage = netCost > 0 ? (grossProfit / netCost) * 100 : 0;

    // Payback
    const paybackYears = annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 25;

    // IRR & lifetime savings
    const cashflows = [-netCost, ...Array.from({ length: 25 }, (_, i) =>
      Math.round(annualSavings * Math.pow(1 + state.tariffEscalation / 100, i) * Math.pow(0.995, i))
    )];
    const irrVal = calcIRR(cashflows);
    const lifetimeSavings = cashflows.slice(1).reduce((a, b) => a + b, 0);

    // CO2
    const co2Tonnes = Math.round(annualKwh * 0.716 * 25 / 1000 * 10) / 10;
    const treesEquivalent = Math.round(co2Tonnes * 1000 / 22);

    // EMI
    const emi = state.loanEnabled ? calcEMI(state.loanAmount || netCost, state.loanRate, state.loanTenure) : null;

    const costLines: CostLine[] = [
      { key:'panels', label:'Solar Panels', qty:panelCount, rate:panelRatePerW * selectedPanel.wattage, unit:'per panel', gst:12, amount:panelCost, editable:true },
      { key:'inverter', label:'Inverter', qty:1, rate:inverterCost, unit:'lump sum', gst:18, amount:inverterCost, editable:true },
      { key:'mounting', label:'Mounting Structure', qty:systemKw, rate:7000, unit:'/kW', gst:12, amount:mountingCost, editable:true },
      { key:'cables', label:'Cables & Accessories', qty:systemKw, rate:3500, unit:'/kW', gst:0, amount:cablesCost, editable:true },
      { key:'install', label:'Installation & Comm.', qty:systemKw, rate:4000, unit:'/kW', gst:18, amount:installCost, editable:true },
    ];

    set({ panelCount, annualKwh, annualSavings, systemCost, totalSubsidy, netCost,
          paybackYears, irr: irrVal, lifetimeSavings, co2Tonnes, treesEquivalent, emi, costLines,
          hardwareCost, structureCost, labourCost, transportationCost, netMeteringCost,
          totalCost, grossProfit, marginPercentage });
  }, [state.systemKw, state.panelBrand, state.panelModel, state.inverterBrand, state.inverterModel,
      state.tariff, state.subsidyScheme, state.loanEnabled, state.loanAmount, state.loanRate,
      state.loanTenure, state.tariffEscalation, state.manualCostsEdited, state.hardwareCost,
      state.structureCost, state.labourCost, state.transportationCost, state.netMeteringCost, state.netCost]);

  const runLayout = useCallback(() => {
    if (state.roofSections.length === 0) return;
    const section = state.roofSections[0];
    const centerLat = section.polygon.reduce((s, p) => s + p.lat, 0) / section.polygon.length;
    const centerLng = section.polygon.reduce((s, p) => s + p.lng, 0) / section.polygon.length;
    const center = { lat: centerLat, lng: centerLng };
    const metersPoly = latlngToMeters(section.polygon, center);
    const obsMeters = section.obstructions.map(obs => latlngToMeters(obs, center));
    const pw = selectedPanel.width_mm / 1000;
    const ph = selectedPanel.length_mm / 1000;
    const layout = generatePanelLayout({
      roofPolygon: metersPoly, obstructions: obsMeters,
      panelWidthM: state.orientation === 'PORTRAIT' ? pw : ph,
      panelHeightM: state.orientation === 'PORTRAIT' ? ph : pw,
      tiltDeg: state.roofSections[0].tiltDeg,
      azimuthDeg: state.roofSections[0].azimuthDeg,
    });
    const inferredKw = Math.round((layout.count * selectedPanel.wattage) / 100) * 0.1;
    set({ layout, systemKw: inferredKw > 0 ? inferredKw : state.systemKw });
  }, [state.roofSections, state.orientation, selectedPanel]);

  const [isSaving, setIsSaving] = useState(false);
  const [proposalId, setProposalId] = useState<string | null>(null);

  const handleSaveProposal = async (status: string = 'DRAFT') => {
    if (!leadId) {
      message.error('No lead linked to this proposal');
      return null;
    }
    setIsSaving(true);
    try {
      const payload = {
        leadId,
        customerId: customerId || undefined,
        systemSizeKw: state.systemKw,
        panelBrand: state.panelBrand,
        panelModel: state.panelModel,
        panelCount: state.panelCount,
        panelWattage: selectedPanel.wattage,
        inverterBrand: state.inverterBrand,
        inverterModel: state.inverterModel,
        inverterCapacity: selectedInverter.capacityKw,
        structureType: 'GI',
        roofType: 'RCC',
        isDCR: selectedPanel.isDCR,
        hardwareCost: state.hardwareCost,
        structureCost: state.structureCost,
        labourCost: state.labourCost,
        transportationCost: state.transportationCost,
        netMeteringCost: state.netMeteringCost,
        netCost: state.netCost,
        totalSubsidy: state.totalSubsidy,
        subsidyScheme: state.subsidyScheme,
        annualKwh: state.annualKwh,
        co2Tonnes: state.co2Tonnes,
        loanEnabled: state.loanEnabled,
        loanAmount: state.loanAmount,
        loanTenure: state.loanTenure,
        emi: state.emi,
      };

      const res = await api.post('/proposals', payload);
      if (res.data.success) {
        message.success(`Proposal successfully saved as ${status}!`);
        setProposalId(res.data.data.id);
        
        if (status === 'ACCEPTED') {
          await api.post(`/proposals/${res.data.data.id}/accept`);
          message.success('Lead marked as WON successfully!');
          navigate(`/salesperson/leads/${leadId}`);
        }
        return res.data.data.id;
      }
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.error?.message || 'Failed to save proposal');
    } finally {
      setIsSaving(false);
    }
    return null;
  };

  const yearlyData = useMemo(() =>
    buildYearlyProjection(state.netCost, state.annualSavings, state.tariffEscalation),
    [state.netCost, state.annualSavings, state.tariffEscalation]);

  const paybackYear = yearlyData.find(d => d.cumulative >= 0)?.year;

  const recommendedKw = useMemo(() => {
    const monthly = state.monthlyBill / state.tariff;
    const daily = monthly / 30;
    const raw = daily / (5.5 * 0.8);
    return Math.ceil(raw * 2) / 2;
  }, [state.monthlyBill, state.tariff]);

  // ─── Step Renderers ───────────────────────────────────────────────────────

  const Step1 = (
    <Card bordered={false} className="shadow-sm">
      <div className="mb-4">
        <Alert message='📡 Draw the roof outline on the satellite map below. Click "Draw Roof" then trace corners — double-click to close the polygon. Add obstructions (water tanks, AC units) using the Obstruction button.' type="info" showIcon className="mb-4" />
        <Text type="secondary" className="text-xs">Auto-detect using satellite imagery coming soon — for now, trace manually for highest accuracy.</Text>
      </div>
      <RoofMapper
        lat={state.lat}
        lng={state.lng}
        address={state.address}
        onChange={(sections) => set({ roofSections: sections })}
      />
      <div className="flex justify-end mt-4">
        <Button type="primary" size="large" disabled={state.roofSections.length === 0} icon={<ArrowRightOutlined />} onClick={() => { runLayout(); setStep(1); }}>
          Next: Configure System
        </Button>
      </div>
    </Card>
  );

  const Step2 = (
    <Row gutter={[16, 16]}>
      {/* LEFT: Configuration */}
      <Col xs={24} lg={10}>
        <Card bordered={false} className="shadow-sm h-full" title={<><ThunderboltOutlined className="mr-2 text-yellow-500" />System Configuration</>}>
          <div className="space-y-4">
            {/* Bill + auto-recommendation */}
            <div className="grid grid-cols-2 gap-3">
              <Form.Item label="Monthly Bill (₹)" className="!mb-0">
                <InputNumber min={500} max={500000} step={500} className="w-full"
                  value={state.monthlyBill} onChange={v => set({ monthlyBill: v || 5000 })} formatter={v => `₹${v}`} />
              </Form.Item>
              <Form.Item label="Tariff (₹/unit)" className="!mb-0">
                <InputNumber min={4} max={20} step={0.5} className="w-full"
                  value={state.tariff} onChange={v => set({ tariff: v || 8 })} />
              </Form.Item>
            </div>

            <div className="flex items-center gap-2">
              <Tag color="blue" className="text-sm">Recommended: {fmtKw(recommendedKw)}</Tag>
              <Text type="secondary" className="text-xs">based on your bill</Text>
            </div>

            <Divider className="!my-2" />

            {/* System size slider */}
            <Form.Item label={<span>System Size <strong>{fmtKw(state.systemKw)}</strong></span>} className="!mb-1">
              <div className="flex gap-3 items-center">
                <Slider min={1} max={25} step={0.5} value={state.systemKw} className="flex-1"
                  onChange={v => set({ systemKw: v })} />
                <InputNumber min={1} max={25} step={0.5} value={state.systemKw} className="w-24"
                  onChange={v => set({ systemKw: v || 1 })} />
              </div>
            </Form.Item>

            <Divider className="!my-2" />

            {/* Panel selection */}
            <div className="grid grid-cols-2 gap-3">
              <Form.Item label="Panel Brand" className="!mb-0">
                <Select className="w-full" value={state.panelBrand}
                  onChange={v => set({ panelBrand: v, panelModel: PANELS.find(p => p.brand === v)?.model || '' })}>
                  {panelBrands.map(b => <Option key={b} value={b}>{b}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="Model" className="!mb-0">
                <Select className="w-full" value={state.panelModel} onChange={v => set({ panelModel: v })}>
                  {filteredPanels.map(p => <Option key={p.model} value={p.model}>{p.model}</Option>)}
                </Select>
              </Form.Item>
            </div>

            <div className="bg-transparent rounded-lg p-3 text-xs grid grid-cols-3 gap-2">
              <div><Text type="secondary">Wattage</Text><br /><strong>{selectedPanel.wattage}W</strong></div>
              <div><Text type="secondary">Efficiency</Text><br /><strong>{(selectedPanel.efficiency * 100).toFixed(1)}%</strong></div>
              <div><Text type="secondary">Size</Text><br /><strong>{selectedPanel.length_mm}×{selectedPanel.width_mm}mm</strong></div>
              <div><Text type="secondary">Voc</Text><br /><strong>{selectedPanel.voc}V</strong></div>
              <div><Text type="secondary">Warranty</Text><br /><strong>{selectedPanel.warranty_years}yr</strong></div>
              <div>{selectedPanel.isDCR && <Tag color="green" className="text-xs">DCR</Tag>}</div>
            </div>

            {/* Inverter selection */}
            <Divider className="!my-2" />
            <div className="grid grid-cols-2 gap-3">
              <Form.Item label="Inverter Brand" className="!mb-0">
                <Select className="w-full" value={state.inverterBrand}
                  onChange={v => set({ inverterBrand: v, inverterModel: INVERTERS.find(i => i.brand === v)?.model || '' })}>
                  {inverterBrands.map(b => <Option key={b} value={b}>{b}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="Model" className="!mb-0">
                <Select className="w-full" value={state.inverterModel} onChange={v => set({ inverterModel: v })}>
                  {filteredInverters.map(i => <Option key={i.model} value={i.model}>{i.model}</Option>)}
                </Select>
              </Form.Item>
            </div>

            <div className="bg-transparent rounded-lg p-3 text-xs grid grid-cols-3 gap-2">
              <div><Text type="secondary">Capacity</Text><br /><strong>{selectedInverter.capacityKw} kW</strong></div>
              <div><Text type="secondary">MPPT</Text><br /><strong>{selectedInverter.mpptCount} trackers</strong></div>
              <div><Text type="secondary">Max Voltage</Text><br /><strong>{selectedInverter.maxInputVoltage}V</strong></div>
            </div>

            {/* Orientation */}
            <div>
              <Text className="text-sm font-medium block mb-2">Orientation</Text>
              <div className="flex gap-2">
                {(['PORTRAIT', 'LANDSCAPE'] as const).map(o => (
                  <Button key={o} type={state.orientation === o ? 'primary' : 'default'} className="flex-1"
                    onClick={() => set({ orientation: o })}>
                    {o === 'PORTRAIT' ? '▯ Portrait' : '▭ Landscape'}
                  </Button>
                ))}
              </div>
            </div>

            <Button type="primary" block size="large" icon={<ReloadOutlined />} onClick={runLayout}>
              Auto-Layout {state.panelCount} Panels on Roof
            </Button>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-xs text-apple-gray">Panels</div>
                <div className="text-lg font-bold text-blue-600">{state.panelCount}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-xs text-apple-gray">Generation</div>
                <div className="text-sm font-bold text-green-600">{state.annualKwh.toLocaleString()} kWh/yr</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-2 text-center">
                <div className="text-xs text-apple-gray">Layout</div>
                <div className="text-sm font-bold text-yellow-600">{Math.round(state.layout.layoutEfficiency * 100)}%</div>
              </div>
            </div>
          </div>
        </Card>
      </Col>

      {/* RIGHT: 3D viewer */}
      <Col xs={24} lg={14}>
        <Card bordered={false} className="shadow-sm"
          title={
            <div className="flex justify-between items-center">
              <span>🏠 3D Roof Preview</span>
              <div className="flex gap-2 items-center">
                <Text className="text-xs text-apple-gray">Shading Analysis</Text>
                <Switch size="small" checked={state.showShading} onChange={v => set({ showShading: v })} />
              </div>
            </div>
          }>
          <Suspense fallback={<div className="h-96 flex items-center justify-center"><Spin /></div>}>
            <Solar3DViewer
              roofSections={state.roofSections}
              panelLayout={state.layout}
              panelWidthM={selectedPanel.width_mm / 1000}
              panelHeightM={selectedPanel.length_mm / 1000}
              showShading={state.showShading}
            />
          </Suspense>
        </Card>
      </Col>

      <Col span={24}>
        <div className="flex justify-between">
          <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(0)}>Back</Button>
          <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => setStep(2)}>
            Next: Financial Calculator
          </Button>
        </div>
      </Col>
    </Row>
  );

  // ─── Step 3: Financial Calculator ─────────────────────────────────────────

  const subsidySlabRows = useMemo(() => {
    const { systemKw, subsidyScheme } = state;
    if (subsidyScheme === 'NONE') return [];
    const rows = [];
    if (systemKw > 0 && subsidyScheme !== 'CM_SCHEME') {
      rows.push({ slab: '0–2 kW (PM Surya Ghar)', kw: Math.min(systemKw, 2), rate: '₹30,000/kW', amount: Math.round(Math.min(systemKw, 2) * 30000) });
      if (systemKw > 2) rows.push({ slab: '2–3 kW (PM Surya Ghar)', kw: Math.min(1, systemKw - 2), rate: '₹18,000/kW', amount: Math.round(Math.min(1, systemKw - 2) * 18000) });
    }
    if (subsidyScheme !== 'PM_SURYA_GHAR') {
      rows.push({ slab: 'Delhi CM Scheme', kw: systemKw <= 3 ? systemKw : 3, rate: systemKw <= 3 ? '₹2,000/kW' : 'Flat ₹6,000', amount: systemKw <= 3 ? Math.round(systemKw * 2000) : 6000 });
    }
    return rows;
  }, [state.systemKw, state.subsidyScheme]);

  const Step3 = (
    <div className="space-y-4">
      <Row gutter={[16, 16]}>
        {/* Cost Table */}
        <Col xs={24} xl={13}>
          <Card bordered={false} className="shadow-sm" title={<><CalculatorOutlined className="mr-2" />Cost Breakdown</>}>
            <Table
              size="small"
              pagination={false}
              dataSource={state.costLines}
              rowKey="key"
              columns={[
                { title: 'Item', dataIndex: 'label', key: 'label', ellipsis: true },
                { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 60, render: (v) => typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : v },
                { title: 'Rate', dataIndex: 'rate', key: 'rate', width: 100, render: v => fmt(Math.round(v)) },
                { title: 'GST', dataIndex: 'gst', key: 'gst', width: 55, render: v => v > 0 ? `${v}%` : '—' },
                { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 110, render: v => <strong>{fmt(Math.round(v))}</strong>, align: 'right' },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={4}><strong>Total System Cost</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right"><strong className="text-blue-600 text-base">{fmt(state.systemCost)}</strong></Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />

            <Divider />

            {/* Subsidy */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <Text strong>Subsidy Scheme</Text>
                <Select value={state.subsidyScheme} onChange={v => set({ subsidyScheme: v })} className="w-40">
                  <Option value="BOTH">PM + Delhi CM</Option>
                  <Option value="PM_SURYA_GHAR">PM Surya Ghar Only</Option>
                  <Option value="CM_SCHEME">Delhi CM Only</Option>
                  <Option value="NONE">No Subsidy</Option>
                </Select>
              </div>
              {subsidySlabRows.length > 0 && (
                <Table size="small" pagination={false} dataSource={subsidySlabRows} rowKey="slab"
                  columns={[
                    { title: 'Slab', dataIndex: 'slab', key: 'slab' },
                    { title: 'kW', dataIndex: 'kw', key: 'kw', width: 60, render: v => v.toFixed(1) },
                    { title: 'Rate', dataIndex: 'rate', key: 'rate', width: 110 },
                    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 100, render: v => <strong className="text-green-600">{fmt(v)}</strong>, align: 'right' },
                  ]}
                  summary={() => (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3}><strong>Total Subsidy</strong></Table.Summary.Cell>
                      <Table.Summary.Cell index={3} align="right"><strong className="text-green-600 text-base">{fmt(state.totalSubsidy)}</strong></Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                />
              )}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
                <Text strong className="text-lg">Net Cost After Subsidy</Text>
                <Text strong className="text-2xl text-blue-700">{fmt(state.netCost)}</Text>
              </div>
            </div>

            <Divider />

            {/* Cost & Margin Calculator */}
            <div className="bg-slate-50 dark:bg-slate-905 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  <span className="text-base font-bold text-slate-850 dark:text-slate-150">Proposal Cost & Margin Engine</span>
                </div>
                {state.manualCostsEdited && (
                  <Button size="small" type="dashed" danger onClick={() => set({ manualCostsEdited: false })}>
                    Reset to Defaults
                  </Button>
                )}
              </div>

              <Row gutter={[20, 20]}>
                {/* Cost Inputs */}
                <Col xs={24} md={12} className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Detailed Expenses (Internal)</div>
                  
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Hardware Cost (Panels & Inverter)</label>
                    <InputNumber
                      className="w-full"
                      value={Math.round(state.hardwareCost)}
                      formatter={v => `₹ ${v}`}
                      parser={v => Number(v?.replace(/[₹\s,]/g, '') || 0)}
                      onChange={v => set({ hardwareCost: Number(v || 0), manualCostsEdited: true })}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Structure Cost (Mounting & Elevated)</label>
                    <InputNumber
                      className="w-full"
                      value={Math.round(state.structureCost)}
                      formatter={v => `₹ ${v}`}
                      parser={v => Number(v?.replace(/[₹\s,]/g, '') || 0)}
                      onChange={v => set({ structureCost: Number(v || 0), manualCostsEdited: true })}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Labour Cost (Execution & Fitting)</label>
                    <InputNumber
                      className="w-full"
                      value={Math.round(state.labourCost)}
                      formatter={v => `₹ ${v}`}
                      parser={v => Number(v?.replace(/[₹\s,]/g, '') || 0)}
                      onChange={v => set({ labourCost: Number(v || 0), manualCostsEdited: true })}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Transportation & Freight Cost</label>
                    <InputNumber
                      className="w-full"
                      value={Math.round(state.transportationCost)}
                      formatter={v => `₹ ${v}`}
                      parser={v => Number(v?.replace(/[₹\s,]/g, '') || 0)}
                      onChange={v => set({ transportationCost: Number(v || 0), manualCostsEdited: true })}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Net-Metering & Liaison Cost</label>
                    <InputNumber
                      className="w-full"
                      value={Math.round(state.netMeteringCost)}
                      formatter={v => `₹ ${v}`}
                      parser={v => Number(v?.replace(/[₹\s,]/g, '') || 0)}
                      onChange={v => set({ netMeteringCost: Number(v || 0), manualCostsEdited: true })}
                    />
                  </div>
                </Col>

                {/* Profitability Summary */}
                <Col xs={24} md={12} className="flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Deal Profitability</div>

                    <div>
                      <label className="text-xs text-slate-500 block mb-1 font-medium">Customer Selling Price (Net Price)</label>
                      <InputNumber
                        className="w-full !text-lg !font-bold text-blue-700"
                        value={Math.round(state.netCost)}
                        formatter={v => `₹ ${v}`}
                        parser={v => Number(v?.replace(/[₹\s,]/g, '') || 0)}
                        onChange={v => set({ netCost: Number(v || 0), manualCostsEdited: true })}
                      />
                      <span className="text-[10px] text-slate-400">Includes system cost minus subsidy</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Total Project Cost:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{fmt(state.totalCost)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Gross Profit:</span>
                        <span className={`font-bold ${state.grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {state.grossProfit >= 0 ? '+' : ''}{fmt(state.grossProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2 text-sm">
                        <span className="text-slate-800 dark:text-slate-200 font-semibold">Profit Margin %:</span>
                        <span className={`font-extrabold ${state.marginPercentage >= 15 ? 'text-green-600' : state.marginPercentage >= 0 ? 'text-orange-500' : 'text-red-500'}`}>
                          {state.marginPercentage.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    {state.marginPercentage >= 15 ? (
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 p-3 rounded-xl flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        <div className="text-[11px] text-green-700 dark:text-green-400 leading-tight">
                          <strong>Profitable Deal</strong> (15%+ margin). Good to go! Approved for deployment.
                        </div>
                      </div>
                    ) : state.marginPercentage >= 0 ? (
                      <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 p-3 rounded-xl flex items-center gap-2">
                        <span className="text-lg">⚠️</span>
                        <div className="text-[11px] text-orange-700 dark:text-orange-400 leading-tight">
                          <strong>Low Margin warning</strong>. Margin is below 15%. This deal requires Manager approval.
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3 rounded-xl flex items-center gap-2">
                        <span className="text-lg">🛑</span>
                        <div className="text-[11px] text-red-700 dark:text-red-400 leading-tight">
                          <strong>Loss-Making Deal</strong>. Deal is unprofitable. Sales creation blocked.
                        </div>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </div>

            <Divider />

            {/* Loan */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <Text strong>Loan Financing</Text>
                <Switch checked={state.loanEnabled} onChange={v => set({ loanEnabled: v, loanAmount: state.netCost })} />
              </div>
              {state.loanEnabled && (
                <div className="space-y-3 bg-transparent p-3 rounded-xl">
                  <div className="grid grid-cols-2 gap-3">
                    <Form.Item label="Loan Amount" className="!mb-0">
                      <InputNumber className="w-full" min={0} max={5000000} step={10000} value={state.loanAmount}
                        onChange={v => set({ loanAmount: v || state.netCost })} formatter={v => `₹${v}`} />
                    </Form.Item>
                    <Form.Item label="Interest Rate %" className="!mb-0">
                      <InputNumber className="w-full" min={0} max={24} step={0.5} value={state.loanRate}
                        onChange={v => set({ loanRate: v || 9 })} />
                    </Form.Item>
                  </div>
                  <div>
                    <Text className="text-xs">Tenure: <strong>{state.loanTenure} months ({Math.round(state.loanTenure / 12)} years)</strong></Text>
                    <Slider min={12} max={240} step={12} value={state.loanTenure} onChange={v => set({ loanTenure: v })} />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-apple-cardLight dark:bg-apple-cardDark rounded-lg p-3 text-center shadow-sm">
                      <Text type="secondary" className="text-xs">Monthly EMI</Text>
                      <div className="text-xl font-bold text-blue-600">{fmt(state.emi || 0)}</div>
                    </div>
                    <div className="flex-1 bg-apple-cardLight dark:bg-apple-cardDark rounded-lg p-3 text-center shadow-sm">
                      <Text type="secondary" className="text-xs">Total Interest</Text>
                      <div className="text-xl font-bold text-orange-500">{fmt(Math.max(0, (state.emi || 0) * state.loanTenure - state.loanAmount))}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* Savings Projection */}
        <Col xs={24} xl={11}>
          <Card bordered={false} className="shadow-sm" title="📈 25-Year Savings Projection">
            <div className="flex justify-between items-center mb-2">
              <Text className="text-xs">Tariff escalation</Text>
              <div className="flex items-center gap-2">
                <InputNumber min={0} max={10} step={0.5} value={state.tariffEscalation} size="small"
                  onChange={v => set({ tariffEscalation: v || 3 })} suffix="% / yr" className="w-28" />
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={yearlyData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <RtTooltip formatter={(v: number) => fmt(Math.round(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="savings" name="Annual Savings" fill="#3b82f6" opacity={0.8} />
                <Line dataKey="cumulative" name="Cumulative" stroke="#10b981" strokeWidth={2} dot={false} />
                {paybackYear && (
                  <ReferenceLine x={paybackYear} stroke="#f59e0b" strokeDasharray="4 4"
                    label={{ value: `Payback Yr ${paybackYear}`, position: 'top', fontSize: 10, fill: '#f59e0b' }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            <Row gutter={[12, 12]} className="mt-4">
              {[
                { label: 'Payback', value: `${state.paybackYears} yrs`, color: '#f59e0b' },
                { label: '25yr Savings', value: `₹${Math.round(state.lifetimeSavings / 100000)} L`, color: '#10b981' },
                { label: 'IRR', value: `${state.irr}%`, color: '#3b82f6' },
                { label: 'CO₂ Saved', value: `${state.co2Tonnes}t`, color: '#8b5cf6' },
              ].map(kpi => (
                <Col key={kpi.label} span={12}>
                  <div className="bg-transparent rounded-xl p-3 text-center">
                    <div className="text-xs text-apple-gray">{kpi.label}</div>
                    <div className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                  </div>
                </Col>
              ))}
            </Row>

            <div className="mt-3 text-xs text-apple-gray text-center">
              🌳 {state.treesEquivalent.toLocaleString()} trees equivalent over 25 years
            </div>
          </Card>
        </Col>
      </Row>

      <div className="flex justify-between">
        <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(1)}>Back</Button>
        <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => setStep(3)}>
          Next: Preview & Send
        </Button>
      </div>
    </div>
  );

  // ─── Step 4: Preview & Send ────────────────────────────────────────────────

  const Step4 = (
    <div className="space-y-4">
      <Alert
        message="Proposal Ready"
        description={`${state.panelCount}-panel ${fmtKw(state.systemKw)} system for ${leadData?.name || 'Customer'} — generating preview...`}
        type="success"
        showIcon
      />

      {/* Summary preview card */}
      <Card bordered={false} className="shadow-sm bg-gradient-to-br from-slate-900 to-blue-950 text-white">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-apple-gray text-sm">Solar Installation Proposal</div>
            <div className="text-2xl font-bold mt-1">{fmtKw(state.systemKw)} Rooftop Solar System</div>
            <div className="text-slate-300 mt-1">{leadData?.name || 'Customer'} · {address || 'Site Address'}</div>
          </div>
          <div className="text-right">
            <div className="text-apple-gray text-xs">Prepared</div>
            <div className="text-sm font-medium">{new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</div>
          </div>
        </div>
        <Divider className="!border-slate-700 !my-4" />
        <Row gutter={24}>
          {[
            { label: 'System', value: fmtKw(state.systemKw) },
            { label: 'Panels', value: `${state.panelCount} × ${selectedPanel.wattage}W` },
            { label: 'Net Cost', value: fmt(state.netCost) },
            { label: 'Payback', value: `${state.paybackYears} yrs` },
          ].map(item => (
            <Col key={item.label} span={6}>
              <div className="text-apple-gray text-xs">{item.label}</div>
              <div className="text-white font-bold">{item.value}</div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Action buttons */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={6}>
          <Button block size="large" icon={<SaveOutlined />} loading={isSaving} onClick={() => handleSaveProposal('DRAFT')}>
            Save Draft
          </Button>
        </Col>
        <Col xs={24} sm={6}>
          <Button block size="large" icon={<DownloadOutlined />} type="default"
            onClick={() => message.info('PDF download requires react-pdf renderer to be fully initialized')}>
            Download PDF
          </Button>
        </Col>
        <Col xs={24} sm={6}>
          <Button block size="large" icon={<LinkOutlined />} type="default" loading={isSaving}
            onClick={async () => {
              const pid = proposalId || await handleSaveProposal('DRAFT');
              if (!pid) return;
              try {
                const response = await api.post(`/proposals/${pid}/generate-link`);
                const link = response.data.data.publicUrl;
                
                navigator.clipboard.writeText(link);
                message.success('Link copied to clipboard!');
                
                Modal.info({
                  title: 'Shareable Proposal Link',
                  content: (
                    <div>
                      <p>Share this link with your customer:</p>
                      <Input value={link} readOnly />
                      <p className="text-xs text-gray-500 mt-2">
                        Link expires in 30 days. Customer can view proposal and chat with AI assistant.
                      </p>
                    </div>
                  ),
                });
              } catch (error) {
                message.error('Failed to generate link.');
              }
            }}>
            Generate Link
          </Button>
        </Col>
        <Col xs={24} sm={6}>
          <Button block size="large" icon={<SendOutlined />} type="primary" loading={isSaving}
            onClick={async () => {
              const pid = proposalId || await handleSaveProposal('DRAFT');
              if (pid) {
                setSendModalOpen(true);
              }
            }}>
            Send to Customer
          </Button>
        </Col>
      </Row>

      <Button icon={<CheckCircleOutlined />} type="primary" className="!bg-emerald-600 !border-emerald-600 !w-full" size="large" loading={isSaving}
        onClick={() => handleSaveProposal('ACCEPTED')}>
        Mark as Accepted
      </Button>

      <div className="flex justify-between mt-2">
        <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(2)}>Back</Button>
      </div>
    </div>
  );

  // ─── Main Render ──────────────────────────────────────────────────────────



  const steps = [
    { title: 'Site Mapping', icon: <HomeOutlined />, content: Step1 },
    { title: 'System Config', icon: <ThunderboltOutlined />, content: Step2 },
    { title: 'Financials', icon: <CalculatorOutlined />, content: Step3 },
    { title: 'Preview & Send', icon: <FileTextOutlined />, content: Step4 },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <Title level={3} className="!mb-1">
            <BulbOutlined className="mr-2 text-yellow-500" />
            Solar Proposal Designer
          </Title>
          <Text type="secondary">
            {leadData?.name ? `For: ${leadData.name} · ${address}` : 'Loading lead details...'}
          </Text>
        </div>
        <div className="flex gap-2">
          {state.panelCount > 0 && <Tag color="blue" className="text-sm px-3 py-1">{state.panelCount} Panels</Tag>}
          {state.systemKw > 0 && <Tag color="green" className="text-sm px-3 py-1">{fmtKw(state.systemKw)}</Tag>}
          {state.netCost > 0 && <Tag color="purple" className="text-sm px-3 py-1">{fmt(state.netCost)}</Tag>}
        </div>
      </div>

      <Steps current={step} onChange={setStep} items={steps.map((s, i) => ({ title: s.title, icon: s.icon, disabled: i > 1 && state.roofSections.length === 0 }))} className="mb-2" />

      {steps[step].content}

      {/* Send Modal */}
      <Modal title="Send Proposal" open={sendModalOpen} onCancel={() => setSendModalOpen(false)} onOk={async () => {
        const pid = proposalId || await handleSaveProposal('SENT');
        if (!pid) return;
        try {
          await api.post(`/proposals/${pid}/send`);
          message.success('Proposal successfully marked as sent!');
          setSendModalOpen(false);
          navigate(`/salesperson/leads/${leadId}`);
        } catch (error) {
          message.error('Failed to send proposal.');
        }
      }}>
        <p>This will mark the proposal as sent and notify the customer at <strong>{leadData?.email || 'the customer'}</strong>.</p>
        <p>Do you want to proceed?</p>
      </Modal>

      {/* Location Modal Popup */}
      <Modal
        title="Where are we installing?"
        open={!locationConfirmed}
        onCancel={() => {}}
        closable={false}
        maskClosable={false}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Text type="secondary" className="block mb-4">
          Search for the address and drag the map to align the crosshair exactly on the roof.
        </Text>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Enter address..."
            value={searchAddress}
            onChange={e => setSearchAddress(e.target.value)}
            onPressEnter={handleGeocode}
            size="large"
          />
          <Button type="primary" size="large" onClick={handleGeocode} loading={isSearching}>Search</Button>
        </div>
        <div className="relative w-full h-[400px] rounded-xl overflow-hidden shadow-sm border border-slate-200 mb-6">
          <MapContainer center={[state.lat, state.lng]} zoom={19} scrollWheelZoom className="w-full h-full">
            <TileLayer
              url="https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              subdomains={['0','1','2','3']}
              attribution="Google Maps"
              maxZoom={21}
            />
            <FlyTo lat={state.lat} lng={state.lng} />
            <MapEvents onMove={(lat, lng) => set({ lat, lng })} />
          </MapContainer>
          {/* Crosshair Overlay */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none flex items-center justify-center drop-shadow-md">
            <AimOutlined className="text-4xl text-blue-500" />
          </div>
        </div>
        <Button type="primary" size="large" block icon={<ArrowRightOutlined />} onClick={() => setLocationConfirmed(true)}>
          Confirm Location & Start Mapping
        </Button>
      </Modal>
    </div>
  );
}

