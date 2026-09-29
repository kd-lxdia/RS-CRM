import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Modal, Form, Input, Select, DatePicker, message, Tag, Space, Statistic, Row, Col, Checkbox } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { DataGrid } from '../../components/DataGrid';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  createdBy: string;
  assignedTo?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const priorityColors = {
  LOW: 'default',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red'
};

const statusColors = {
  TODO: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CANCELLED: 'error'
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form] = Form.useForm();
  const user = useAuthStore((s) => s.user);

  const [filters, setFilters] = useState({
    status: undefined as string | undefined,
    priority: undefined as string | undefined,
    search: undefined as string | undefined,
    dateRange: undefined as [dayjs.Dayjs, dayjs.Dayjs] | undefined
  });

  useEffect(() => {
    fetchTasks();
    fetchStats();
    fetchUsers();
  }, [filters]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.search) params.append('search', filters.search);
      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        params.append('startDate', filters.dateRange[0].startOf('day').toISOString());
        params.append('endDate', filters.dateRange[1].endOf('day').toISOString());
      }

      const response = await api.get(`/tasks?${params.toString()}`);
      setTasks(response.data.tasks);
    } catch (error) {
      message.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/tasks/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      // Handle both response formats
      const userData = response.data.success ? response.data.data : response.data;
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (error) {
      console.error('Failed to fetch users');
      setUsers([]); // Set empty array on error
    }
  };

  const handleCreate = () => {
    setEditingTask(null);
    form.resetFields();
    form.setFieldsValue({ priority: 'MEDIUM', status: 'TODO' });
    setIsModalOpen(true);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    form.setFieldsValue({
      ...task,
      dueDate: task.dueDate ? dayjs(task.dueDate) : null
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null
      };

      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, payload);
        message.success('Task updated successfully');
      } else {
        await api.post('/tasks', payload);
        message.success('Task created successfully');
      }

      setIsModalOpen(false);
      form.resetFields();
      fetchTasks();
      fetchStats();
    } catch (error) {
      message.error('Failed to save task');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Delete Task',
      content: 'Are you sure you want to delete this task?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await api.delete(`/tasks/${id}`);
          message.success('Task deleted successfully');
          fetchTasks();
          fetchStats();
        } catch (error) {
          message.error('Failed to delete task');
        }
      }
    });
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      message.success('Status updated');
      fetchTasks();
      fetchStats();
    } catch (error) {
      message.error('Failed to update status');
    }
  };

  const handleCheckboxToggle = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    await handleStatusChange(taskId, newStatus);
  };

  // Sort tasks: incomplete first, then completed
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      // Completed tasks go to bottom
      if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
      if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
      // Within same completion status, sort by created date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks]);

  const columns = [
    {
      title: '',
      key: 'checkbox',
      width: 50,
      fixed: 'left' as const,
      render: (_: any, record: Task) => (
        <Checkbox
          checked={record.status === 'COMPLETED'}
          onChange={() => handleCheckboxToggle(record.id, record.status)}
          disabled={loading}
        />
      )
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      fixed: 'left' as const,
      render: (text: string, record: Task) => (
        <div className={record.status === 'COMPLETED' ? 'opacity-60' : ''}>
          <div className={`font-semibold text-sm ${record.status === 'COMPLETED' ? 'line-through' : ''}`}>
            {text}
          </div>
          {record.description && (
            <div className="text-xs text-gray-500 truncate max-w-[180px]">
              {record.description}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      filters: [
        { text: 'Low', value: 'LOW' },
        { text: 'Medium', value: 'MEDIUM' },
        { text: 'High', value: 'HIGH' },
        { text: 'Urgent', value: 'URGENT' }
      ],
      render: (priority: string) => (
        <Tag color={priorityColors[priority as keyof typeof priorityColors]} className="text-xs">
          {priority}
        </Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      filters: [
        { text: 'To Do', value: 'TODO' },
        { text: 'In Progress', value: 'IN_PROGRESS' },
        { text: 'Completed', value: 'COMPLETED' },
        { text: 'Cancelled', value: 'CANCELLED' }
      ],
      render: (status: string, record: Task) => (
        <Select
          value={status}
          onChange={(value) => handleStatusChange(record.id, value)}
          style={{ width: 120 }}
          size="small"
        >
          <Select.Option value="TODO">To Do</Select.Option>
          <Select.Option value="IN_PROGRESS">In Progress</Select.Option>
          <Select.Option value="COMPLETED">Completed</Select.Option>
          <Select.Option value="CANCELLED">Cancelled</Select.Option>
        </Select>
      )
    },
    {
      title: 'Assigned To',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 130,
      render: (assignee: Task['assignee'], record: Task) => {
        if (!assignee) {
          return record.createdBy === user?.id ? (
            <Tag color="purple" className="text-xs">My Task</Tag>
          ) : (
            <Tag className="text-xs">Unassigned</Tag>
          );
        }
        return (
          <div>
            <div className="font-medium text-sm">{assignee.name}</div>
            <div className="text-xs text-gray-500">{assignee.role}</div>
          </div>
        );
      }
    },
    {
      title: 'Created By',
      dataIndex: 'creator',
      key: 'creator',
      width: 130,
      render: (creator: Task['creator']) => (
        <div>
          <div className="font-medium text-sm">{creator.name}</div>
          <div className="text-xs text-gray-500">{creator.role}</div>
        </div>
      )
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 110,
      sorter: true,
      render: (date: string) => {
        if (!date) return <span className="text-gray-400 text-xs">No due date</span>;
        const dueDate = dayjs(date);
        const isOverdue = dueDate.isBefore(dayjs()) && dueDate.isValid();
        return (
          <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
            {dueDate.format('MMM DD, YYYY')}
          </span>
        );
      }
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      sorter: true,
      render: (date: string) => <span className="text-xs">{dayjs(date).format('MMM DD, YYYY')}</span>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: Task) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)} className="p-0 h-auto">
            Edit
          </Button>
          {record.createdBy === user?.id && (
            <Button type="link" danger size="small" onClick={() => handleDelete(record.id)} className="p-0 h-auto">
              Delete
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold m-0">My Tasks</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Manage your tasks and assignments</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          New Task
        </Button>
      </div>

      {stats && (
        <Row gutter={12}>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card size="small" className="text-center">
              <Statistic
                title={<span className="text-xs">Total Tasks</span>}
                value={stats.total}
                prefix={<SyncOutlined />}
                valueStyle={{ fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card size="small" className="text-center">
              <Statistic
                title={<span className="text-xs">To Do</span>}
                value={stats.todo}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#1890ff', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card size="small" className="text-center">
              <Statistic
                title={<span className="text-xs">In Progress</span>}
                value={stats.inProgress}
                prefix={<SyncOutlined spin />}
                valueStyle={{ color: '#faad14', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card size="small" className="text-center">
              <Statistic
                title={<span className="text-xs">Completed</span>}
                value={stats.completed}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a', fontSize: '20px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Card size="small" className="text-center">
              <Statistic
                title={<span className="text-xs">Overdue</span>}
                value={stats.overdue}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#ff4d4f', fontSize: '20px' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card size="small">
        <div className="mb-3 flex gap-3 flex-wrap">
          <Select
            placeholder="Filter by Status"
            allowClear
            style={{ width: 180 }}
            size="small"
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Select.Option value="TODO">To Do</Select.Option>
            <Select.Option value="IN_PROGRESS">In Progress</Select.Option>
            <Select.Option value="COMPLETED">Completed</Select.Option>
            <Select.Option value="CANCELLED">Cancelled</Select.Option>
          </Select>

          <Select
            placeholder="Filter by Priority"
            allowClear
            style={{ width: 180 }}
            size="small"
            onChange={(value) => setFilters({ ...filters, priority: value })}
          >
            <Select.Option value="LOW">Low</Select.Option>
            <Select.Option value="MEDIUM">Medium</Select.Option>
            <Select.Option value="HIGH">High</Select.Option>
            <Select.Option value="URGENT">Urgent</Select.Option>
          </Select>

          <RangePicker
            placeholder={['Start Date', 'End Date']}
            size="small"
            style={{ width: 250 }}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates as [dayjs.Dayjs, dayjs.Dayjs] | undefined })}
            format="MMM DD, YYYY"
          />

          <Input.Search
            placeholder="Search tasks..."
            allowClear
            style={{ width: 250 }}
            size="small"
            onSearch={(value) => setFilters({ ...filters, search: value })}
          />
        </div>

        <DataGrid
          columns={columns}
          dataSource={sortedTasks}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          size="small"
          rowClassName={(record) => record.status === 'COMPLETED' ? 'opacity-60 bg-gray-50' : ''}
        />
      </Card>

      <Modal
        title={<span className="text-base">{editingTask ? 'Edit Task' : 'Create New Task'}</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={550}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} size="small">
          <Form.Item
            name="title"
            label={<span className="text-sm font-medium">Task Title</span>}
            rules={[{ required: true, message: 'Please enter task title' }]}
          >
            <Input placeholder="Enter task title" />
          </Form.Item>

          <Form.Item name="description" label={<span className="text-sm font-medium">Description</span>}>
            <TextArea rows={3} placeholder="Enter task description" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="priority" label={<span className="text-sm font-medium">Priority</span>} rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="LOW">Low</Select.Option>
                  <Select.Option value="MEDIUM">Medium</Select.Option>
                  <Select.Option value="HIGH">High</Select.Option>
                  <Select.Option value="URGENT">Urgent</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label={<span className="text-sm font-medium">Status</span>} rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="TODO">To Do</Select.Option>
                  <Select.Option value="IN_PROGRESS">In Progress</Select.Option>
                  <Select.Option value="COMPLETED">Completed</Select.Option>
                  <Select.Option value="CANCELLED">Cancelled</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="dueDate" label={<span className="text-sm font-medium">Due Date</span>}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignedTo" label={<span className="text-sm font-medium">Assign To</span>}>
                <Select
                  placeholder="Select user (optional)"
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (String(option?.children || '')).toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {users.map((u) => (
                    <Select.Option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className="mb-0 mt-4">
            <Space className="w-full justify-end">
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">
                {editingTask ? 'Update Task' : 'Create Task'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
