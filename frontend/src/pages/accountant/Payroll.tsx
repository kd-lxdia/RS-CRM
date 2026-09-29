import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, DatePicker, Statistic, Row, Col } from 'antd';
import dayjs from 'dayjs';
import backendApi from '../../lib/axios';
import { Calculator, Calendar, UserCheck, XCircle } from 'lucide-react';

const { Title, Text } = Typography;

const Payroll: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());

  const month = selectedMonth.month() + 1;
  const year = selectedMonth.year();

  const { data, isLoading } = useQuery({
    queryKey: ['payroll', month, year],
    queryFn: async () => {
      const res = await backendApi.get('/payroll', {
        params: { month, year }
      });
      return res.data.data;
    }
  });

  const payroll = data?.payroll || [];
  const stats = data?.stats || { daysInMonth: 0, weekends: 0, holidayCount: 0, workingDays: 0 };

  const columns = [
    {
      title: 'Team Member',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <div>
          <Text strong className="block">{text}</Text>
          <Text type="secondary" className="text-xs">{record.role}</Text>
        </div>
      )
    },
    {
      title: 'Base Salary',
      dataIndex: 'monthlySalary',
      key: 'monthlySalary',
      render: (val: number) => `₹${val.toLocaleString()}`
    },
    {
      title: 'Daily Rate',
      dataIndex: 'dailyRate',
      key: 'dailyRate',
      render: (val: number) => `₹${val.toLocaleString()}`
    },
    {
      title: 'Working Days',
      dataIndex: 'workingDays',
      key: 'workingDays',
      align: 'center' as const
    },
    {
      title: 'Present',
      dataIndex: 'presentDays',
      key: 'presentDays',
      align: 'center' as const,
      render: (val: number) => <Text type="success" strong>{val}</Text>
    },
    {
      title: 'Absent',
      dataIndex: 'absentDays',
      key: 'absentDays',
      align: 'center' as const,
      render: (val: number) => val > 0 ? <Text type="danger" strong>{val}</Text> : val
    },
    {
      title: 'Deductions',
      dataIndex: 'deductions',
      key: 'deductions',
      render: (val: number) => val > 0 ? <Text type="danger">-₹{val.toLocaleString()}</Text> : '₹0'
    },
    {
      title: 'Final Payout',
      dataIndex: 'finalPayout',
      key: 'finalPayout',
      render: (val: number) => <Text strong className="text-apple-blue">₹{val.toLocaleString()}</Text>
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Title level={2} className="m-0">Staff Payroll</Title>
          <Text type="secondary">Automated salary calculations based on attendance.</Text>
        </div>
        <DatePicker 
          picker="month" 
          value={selectedMonth} 
          onChange={(d) => d && setSelectedMonth(d)} 
          allowClear={false}
          className="w-48"
        />
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Card className="shadow-sm border-black/5 dark:border-white/10 h-full">
            <Statistic 
              title="Days in Month" 
              value={stats.daysInMonth} 
              prefix={<Calendar size={18} className="mr-2 text-gray-400" />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="shadow-sm border-black/5 dark:border-white/10 h-full">
            <Statistic 
              title="Weekends" 
              value={stats.weekends} 
              prefix={<Calendar size={18} className="mr-2 text-orange-400" />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="shadow-sm border-black/5 dark:border-white/10 h-full">
            <Statistic 
              title="Official Holidays" 
              value={stats.holidayCount} 
              prefix={<UserCheck size={18} className="mr-2 text-green-500" />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="shadow-sm border-black/5 dark:border-white/10 bg-apple-blue/5 h-full">
            <Statistic 
              title="Total Working Days" 
              value={stats.workingDays} 
              prefix={<Calculator size={18} className="mr-2 text-apple-blue" />} 
              valueStyle={{ color: '#007AFF', fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm border-black/5 dark:border-white/10" bodyStyle={{ padding: 0 }}>
        <Table 
          columns={columns} 
          dataSource={payroll}
          rowKey="userId"
          loading={isLoading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default Payroll;
