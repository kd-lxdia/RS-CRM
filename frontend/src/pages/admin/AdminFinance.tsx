import React from 'react';
import { Tabs, Typography } from 'antd';
import { IndianRupee } from 'lucide-react';
import Receivables from '../accountant/Receivables';
import InvoiceCenter from '../accountant/InvoiceCenter';
import PaymentHistory from '../accountant/PaymentHistory';

const { Title, Text } = Typography;

// Founder-facing accounting cockpit. Merges the accountant's day-to-day tools
// (receivables, invoices, payments) into one admin area so the owner can run
// finances without a dedicated accountant.
const AdminFinance: React.FC = () => (
  <div>
    <div style={{ marginBottom: 12 }}>
      <Title level={3} style={{ margin: 0 }}>
        <IndianRupee size={22} style={{ verticalAlign: -3 }} /> Finance & Accounts
      </Title>
      <Text type="secondary">Receivables, invoices aur payments — sab ek jagah. Alag accountant ki zaroorat nahi.</Text>
    </div>
    <Tabs
      items={[
        { key: 'receivables', label: 'Receivables', children: <Receivables /> },
        { key: 'invoices', label: 'Invoices', children: <InvoiceCenter /> },
        { key: 'payments', label: 'Payment History', children: <PaymentHistory /> },
      ]}
    />
  </div>
);

export default AdminFinance;
