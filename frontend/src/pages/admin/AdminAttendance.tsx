import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, DatePicker, Select, Button, Modal, Form, Input, List, Popconfirm, message } from 'antd';
import dayjs from 'dayjs';
import backendApi from '../../lib/axios';
import { CheckCircle, XCircle, Calendar, Trash2, Plus } from 'lucide-react';

const { Title, Text } = Typography;
const { Option } = Select;

const AdminAttendance: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isHolidayModalVisible, setIsHolidayModalVisible] = useState(false);
  const [form] = Form.useForm();

  const month = selectedMonth.month() + 1;
  const year = selectedMonth.year();
  const daysInMonth = selectedMonth.daysInMonth();

  const { data: matrixData, isLoading, refetch } = useQuery({
    queryKey: ['attendance-matrix', month, year],
    queryFn: async () => {
      const res = await backendApi.get('/attendance/matrix', {
        params: { month, year }
      });
      return res.data.data;
    }
  });

  const { data: holidays, refetch: refetchHolidays } = useQuery({
    queryKey: ['holidays', month, year],
    queryFn: async () => {
      const res = await backendApi.get('/holidays', { params: { month, year } });
      return res.data.data;
    }
  });

  const filteredData = React.useMemo(() => {
    if (!matrixData) return [];
    if (roleFilter === 'ALL') return matrixData;
    return matrixData.filter((row: any) => row.user.role === roleFilter);
  }, [matrixData, roleFilter]);

  const handleAddHoliday = async (values: any) => {
    try {
      await backendApi.post('/holidays', {
        date: values.date.format('YYYY-MM-DD'),
        name: values.name
      });
      message.success('Holiday added successfully');
      form.resetFields();
      refetchHolidays();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      await backendApi.delete(`/holidays/${id}`);
      message.success('Holiday removed');
      refetchHolidays();
    } catch (error) {
      message.error('Failed to remove holiday');
    }
  };

  // Generate dynamic columns for the days of the month
  const columns: any[] = [
    {
      title: 'Team Member',
      dataIndex: 'user',
      key: 'user',
      fixed: 'left',
      width: 180,
      render: (user: any) => (
        <div>
          <Text strong className="block">{user.name}</Text>
          <Text type="secondary" className="text-xs">{user.role}</Text>
        </div>
      )
    }
  ];

  for (let i = 1; i <= daysInMonth; i++) {
    // Check if it's weekend
    const date = selectedMonth.date(i);
    const dateStr = date.format('YYYY-MM-DD');
    const isWeekend = date.day() === 0 || date.day() === 6;
    const isHoliday = holidays?.some((h: any) => h.date === dateStr);

    columns.push({
      title: i.toString(),
      dataIndex: ['records', i],
      key: `day_${i}`,
      width: 60,
      align: 'center',
      className: isWeekend || isHoliday ? 'bg-gray-50 dark:bg-gray-900/30' : '',
      render: (record: any) => {
        if (!record) {
          if (isHoliday) {
            return <div className="text-[10px] text-orange-500 font-medium">H</div>;
          }
          // No record for this day
          return <div className="text-gray-300 dark:text-gray-600">-</div>;
        }
        if (record.status === 'PRESENT') {
          return (
            <div className="flex flex-col items-center justify-center">
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-[9px] text-green-600 font-medium mt-0.5" title={record.locationType}>{record.locationType?.charAt(0)}</span>
            </div>
          );
        }
        return <XCircle size={16} className="text-red-500" />;
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Title level={2} className="m-0">Attendance Tracker</Title>
          <Text type="secondary">Monitor daily attendance and geofenced check-ins.</Text>
        </div>
        <div className="flex gap-4">
          <Select 
            value={roleFilter} 
            onChange={setRoleFilter}
            style={{ width: 160 }}
          >
            <Option value="ALL">All Roles</Option>
            <Option value="SALESPERSON">Salespersons</Option>
            <Option value="INSTALLATION">Installation</Option>
            <Option value="DOCUMENTATION">Documentation</Option>
            <Option value="CALLING_STAFF">Calling Staff</Option>
            <Option value="PROJECT_HEAD">Project Heads</Option>
          </Select>
          <DatePicker 
            picker="month" 
            value={selectedMonth} 
            onChange={(d) => d && setSelectedMonth(d)} 
            allowClear={false}
          />
          <Button 
            type="primary" 
            icon={<Calendar size={16} />}
            onClick={() => setIsHolidayModalVisible(true)}
            className="bg-apple-blue"
          >
            Manage Holidays
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-black/5 dark:border-white/10" bodyStyle={{ padding: 0 }}>
        <Table 
          columns={columns} 
          dataSource={filteredData}
          rowKey={(record) => record.user.id}
          loading={isLoading}
          scroll={{ x: 'max-content' }}
          pagination={false}
          size="middle"
        />
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-black/20 flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500" />
            <Text type="secondary">Present</Text>
          </div>
          <div className="flex items-center gap-2">
            <Text type="secondary" className="font-medium text-green-600 text-[10px]">O</Text>
            <Text type="secondary">Office</Text>
          </div>
          <div className="flex items-center gap-2">
            <Text type="secondary" className="font-medium text-green-600 text-[10px]">S</Text>
            <Text type="secondary">Site</Text>
          </div>
          <div className="flex items-center gap-2">
            <Text type="secondary" className="font-medium text-orange-500 text-[10px]">H</Text>
            <Text type="secondary">Holiday</Text>
          </div>
        </div>
      </Card>

      <Modal
        title="Manage Holidays"
        open={isHolidayModalVisible}
        onCancel={() => setIsHolidayModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleAddHoliday} layout="vertical" className="mb-6 flex items-end gap-2">
          <Form.Item name="date" label="Date" rules={[{ required: true }]} className="mb-0 flex-1">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="name" label="Holiday Name" rules={[{ required: true }]} className="mb-0 flex-1">
            <Input placeholder="e.g. Diwali" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<Plus size={16} />} className="bg-apple-blue" />
        </Form>

        <List
          header={<Text strong>Holidays in {selectedMonth.format('MMMM YYYY')}</Text>}
          bordered
          dataSource={holidays || []}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Popconfirm title="Remove this holiday?" onConfirm={() => handleDeleteHoliday(item.id)}>
                  <Button type="text" danger icon={<Trash2 size={16} />} />
                </Popconfirm>
              ]}
            >
              <div className="flex gap-4">
                <Text strong>{dayjs(item.date).format('DD MMM')}</Text>
                <Text>{item.name}</Text>
              </div>
            </List.Item>
          )}
          locale={{ emptyText: 'No holidays added for this month' }}
        />
      </Modal>
    </div>
  );
};

export default AdminAttendance;
