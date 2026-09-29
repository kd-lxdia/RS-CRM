import React from 'react';
import { Tabs, Typography } from 'antd';
import { Package } from 'lucide-react';
import StockInventory from '../warehouse/StockInventory';
import Pipeline from '../warehouse/Pipeline';
import StockHistory from '../warehouse/StockHistory';

const { Title, Text } = Typography;

// Founder-facing warehouse cockpit. Merges the warehouse tools (stock,
// dispatch pipeline, movement history) into the admin area.
const AdminInventory: React.FC = () => (
  <div>
    <div style={{ marginBottom: 12 }}>
      <Title level={3} style={{ margin: 0 }}>
        <Package size={22} style={{ verticalAlign: -3 }} /> Inventory & Warehouse
      </Title>
      <Text type="secondary">Stock, dispatch pipeline aur movement history — poora warehouse control.</Text>
    </div>
    <Tabs
      items={[
        { key: 'stock', label: 'Stock Inventory', children: <StockInventory /> },
        { key: 'pipeline', label: 'Dispatch Pipeline', children: <Pipeline /> },
        { key: 'history', label: 'Stock History', children: <StockHistory /> },
      ]}
    />
  </div>
);

export default AdminInventory;
