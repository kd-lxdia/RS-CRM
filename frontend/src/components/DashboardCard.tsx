import React from 'react';
import { Card, Skeleton, Empty } from 'antd';

interface DashboardCardProps {
  title?: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  children: React.ReactNode;
  className?: string;
  bodyStyle?: React.CSSProperties;
  extra?: React.ReactNode;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  loading = false,
  empty = false,
  emptyMessage = 'No data available',
  emptyDescription,
  children,
  className = '',
  bodyStyle,
  extra
}) => {
  return (
    <Card 
      title={title} 
      className={`apple-card ${className}`}
      bodyStyle={bodyStyle}
      extra={extra}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : empty ? (
        <Empty 
          description={emptyDescription || emptyMessage} 
          className="my-8"
        />
      ) : (
        children
      )}
    </Card>
  );
};
