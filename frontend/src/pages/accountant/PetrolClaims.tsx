import React, { useState, useMemo } from 'react';
import { Card, Table, Tag, Button, Select, DatePicker, message, Modal, Typography, Space, Collapse } from 'antd';
import { IndianRupee, MapPin, CheckCircle, XCircle, Trash2, User as UserIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backendApi from '../../lib/axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const PetrolClaims: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs | null>(dayjs());
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [userFilter, setUserFilter] = useState<string>('ALL');

  const { data: claimsData, isLoading } = useQuery({
    queryKey: ['travel-logs', selectedMonth?.format('M'), selectedMonth?.format('YYYY'), statusFilter],
    queryFn: async () => {
      const params: any = {};
      if (selectedMonth) {
        params.month = selectedMonth.month() + 1;
        params.year = selectedMonth.year();
      }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await backendApi.get('/travel-logs', { params });
      return res.data.data;
    }
  });

  const { data: globalPetrolRateData } = useQuery({
    queryKey: ['system-setting', 'PETROL_RATE_PER_KM'],
    queryFn: async () => {
      try {
        const res = await backendApi.get('/system-settings/PETROL_RATE_PER_KM');
        return parseFloat(res.data.data?.value || '5');
      } catch (err) {
        return 5;
      }
    }
  });

  const globalPetrolRate = globalPetrolRateData ?? 5;

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      return await backendApi.patch(`/travel-logs/${id}`, { status });
    },
    onSuccess: () => {
      message.success('Status updated successfully');
      queryClient.invalidateQueries(['travel-logs'] as any);
    }
  });

  const updateSegmentMutation = useMutation({
    mutationFn: async ({ id, index, status }: { id: string, index: number, status: string }) => {
      return await backendApi.patch(`/travel-logs/${id}/segment/${index}`, { status });
    },
    onSuccess: () => {
      message.success('Segment status updated');
      queryClient.invalidateQueries(['travel-logs'] as any);
    }
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (logIds: string[]) => {
      return await backendApi.post(`/travel-logs/bulk-approve`, { logIds, status: 'APPROVED' });
    },
    onSuccess: () => {
      message.success('Bulk approval successful');
      queryClient.invalidateQueries(['travel-logs'] as any);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await backendApi.delete(`/travel-logs/${id}`);
    },
    onSuccess: () => {
      message.success('Travel log deleted');
      queryClient.invalidateQueries(['travel-logs'] as any);
    }
  });

  // Unique users for the filter dropdown
  const uniqueUsers = useMemo(() => {
    if (!claimsData) return [];
    const usersMap = new Map();
    claimsData.forEach((claim: any) => {
      if (claim.user && !usersMap.has(claim.user.id)) {
        usersMap.set(claim.user.id, claim.user);
      }
    });
    return Array.from(usersMap.values());
  }, [claimsData]);

  // Group claims by User
  const groupedClaims = useMemo(() => {
    if (!claimsData) return {};
    
    let filteredData = claimsData;
    if (userFilter !== 'ALL') {
      filteredData = claimsData.filter((c: any) => c.userId === userFilter);
    }

    const groups: Record<string, { user: any, totalPendingAmount: number, claims: any[] }> = {};
    
    filteredData.forEach((claim: any) => {
      if (!claim.user) return;
      const uid = claim.user.id;
      if (!groups[uid]) {
        groups[uid] = {
          user: claim.user,
          totalPendingAmount: 0,
          claims: []
        };
      }
      groups[uid].claims.push(claim);
      
      let pendingAmountForLog = 0;
      let hasPending = false;
      
      claim.routeDetails?.forEach((stop: any, idx: number) => {
        if (idx === 0) return;
        const segmentStatus = stop.status || 'PENDING';
        if (segmentStatus === 'PENDING') {
          hasPending = true;
          pendingAmountForLog += (stop.distanceFromPrev || 0) * globalPetrolRate;
        }
      });

      if (hasPending && claim.status === 'PENDING') {
        groups[uid].totalPendingAmount += pendingAmountForLog;
      }
    });

    return groups;
  }, [claimsData, userFilter, globalPetrolRate]);

  const handleGlobalBulkApprove = () => {
    if (!claimsData || claimsData.length === 0) return;
    
    let pendingClaims = claimsData.filter((c: any) => c.status === 'PENDING');
    if (userFilter !== 'ALL') {
      pendingClaims = pendingClaims.filter((c: any) => c.userId === userFilter);
    }

    if (pendingClaims.length === 0) {
      message.info('No pending claims to approve for current filters.');
      return;
    }

    // Get unique names of users being approved
    const affectedUserNames = Array.from(new Set(pendingClaims.map((c: any) => c.user?.name))).filter(Boolean);
    const pendingIds = pendingClaims.map((c: any) => c.id);

    Modal.confirm({
      title: 'Approve All Pending Claims?',
      content: (
        <div>
          <p>Are you sure you want to approve <strong>{pendingIds.length}</strong> claims?</p>
          <p className="mt-2 text-sm text-gray-500">This will approve payments for:</p>
          <ul className="list-disc pl-5 mt-1 text-sm font-medium">
            {affectedUserNames.map((name: any, idx) => (
              <li key={idx}>{name}</li>
            ))}
          </ul>
        </div>
      ),
      okText: 'Yes, Approve All',
      onOk: () => bulkApproveMutation.mutate(pendingIds)
    });
  };

  const handleUserBulkApprove = (e: React.MouseEvent, userId: string, userName: string, pendingAmount: number, pendingIds: string[]) => {
    e.stopPropagation(); // Prevent collapse toggle
    if (pendingIds.length === 0) return;

    Modal.confirm({
      title: `Approve Claims for ${userName}?`,
      content: (
        <div>
          <p>Are you sure you want to approve <strong>{pendingIds.length}</strong> pending claims for <strong>{userName}</strong>?</p>
          <p className="mt-2">Total Amount to Approve: <strong className="text-green-600">₹{pendingAmount.toFixed(2)}</strong></p>
        </div>
      ),
      okText: 'Yes, Approve',
      onOk: () => bulkApproveMutation.mutate(pendingIds)
    });
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('DD MMM YYYY')
    },
    {
      title: 'Distance',
      dataIndex: 'totalDistanceKm',
      key: 'distance',
      render: (km: number) => `${km.toFixed(2)} km`
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'petrolAmount',
      key: 'amount',
      render: (amount: number, record: any) => {
        const calculatedAmount = record.status === 'PENDING' ? (record.totalDistanceKm * globalPetrolRate) : amount;
        return <Text strong>₹{calculatedAmount.toFixed(2)}</Text>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: any = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'PENDING' && (
            <>
              <Button size="small" type="primary" className="bg-green-600" onClick={() => updateStatusMutation.mutate({ id: record.id, status: 'APPROVED' })} icon={<CheckCircle size={14} />} />
              <Button size="small" danger onClick={() => updateStatusMutation.mutate({ id: record.id, status: 'REJECTED' })} icon={<XCircle size={14} />} />
            </>
          )}
          <Button size="small" type="text" danger onClick={() => {
            Modal.confirm({ title: 'Delete log?', onOk: () => deleteMutation.mutate(record.id) });
          }} icon={<Trash2 size={14} />} />
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark flex items-center">
            <IndianRupee className="mr-2 text-apple-textMuted" /> 
            Petrol & Travel Claims
          </h1>
          <p className="text-apple-textMuted mt-1">Review and approve daily travel expenses grouped by team member.</p>
        </div>
        <Button 
          type="primary" 
          className="bg-apple-blue hover:bg-blue-600" 
          onClick={handleGlobalBulkApprove}
          disabled={(statusFilter !== 'PENDING' && statusFilter !== 'ALL') || isLoading}
        >
          Approve All Displayed Pending
        </Button>
      </div>

      <Card className="shadow-sm rounded-lg mb-6 glass-panel" bodyStyle={{ padding: '24px' }}>
        <div className="flex flex-wrap gap-4">
          <div>
            <Text className="block mb-1 text-xs text-gray-500">Month</Text>
            <DatePicker 
              picker="month" 
              value={selectedMonth} 
              onChange={setSelectedMonth} 
              allowClear={false}
              className="w-40"
            />
          </div>
          <div>
            <Text className="block mb-1 text-xs text-gray-500">Status</Text>
            <Select value={statusFilter} onChange={setStatusFilter} className="w-40">
              <Option value="ALL">All Statuses</Option>
              <Option value="PENDING">Pending Only</Option>
              <Option value="APPROVED">Approved Only</Option>
              <Option value="REJECTED">Rejected Only</Option>
            </Select>
          </div>
          <div>
            <Text className="block mb-1 text-xs text-gray-500">Team Member</Text>
            <Select 
              showSearch
              value={userFilter} 
              onChange={setUserFilter} 
              className="w-64"
              optionFilterProp="children"
            >
              <Option value="ALL">All Team Members</Option>
              {uniqueUsers.map((u: any) => (
                <Option key={u.id} value={u.id}>{u.name}</Option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : Object.keys(groupedClaims).length === 0 ? (
        <Card className="text-center py-12 text-gray-500 glass-panel">
          No travel logs found for the selected filters.
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(groupedClaims).map(([userId, group]) => {
            const pendingIds = group.claims.filter(c => c.status === 'PENDING').map(c => c.id);
            
            const header = (
              <div className="flex justify-between items-center w-full pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <UserIcon size={16} />
                  </div>
                  <div>
                    <Text strong className="text-base block leading-tight">{group.user.name}</Text>
                    <Text type="secondary" className="text-xs uppercase">{group.user?.role?.replace('_', ' ') || 'EMPLOYEE'}</Text>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <Text className="text-xs text-gray-500 block leading-tight">Total Pending Amount</Text>
                    <Text strong className={group.totalPendingAmount > 0 ? "text-orange-500" : "text-gray-400"}>
                      ₹{group.totalPendingAmount.toFixed(2)}
                    </Text>
                  </div>
                  {group.totalPendingAmount > 0 && (
                    <Button 
                      type="primary" 
                      className="bg-green-600 hover:bg-green-700" 
                      size="small"
                      onClick={(e) => handleUserBulkApprove(e, userId, group.user.name, group.totalPendingAmount, pendingIds)}
                    >
                      Approve All for {group.user.name.split(' ')[0]}
                    </Button>
                  )}
                </div>
              </div>
            );

            return (
              <Collapse key={userId} className="bg-white dark:bg-black/20 shadow-sm border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <Panel header={header} key="1" className="border-b-0">
                  <Table
                    columns={columns}
                    dataSource={group.claims}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    expandable={{
                      expandedRowRender: (record: any) => (
                        <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-lg border border-gray-100 dark:border-gray-800 ml-8">
                          <Text strong className="block mb-2">Route Segments:</Text>
                          <div className="flex flex-col gap-2 mt-2">
                            {record.routeDetails?.map((stop: any, idx: number) => {
                              if (idx === 0) return null;
                              const prevStop = record.routeDetails[idx - 1];
                              return (
                                <div key={idx} className={`flex items-center gap-3 p-3 bg-white dark:bg-black/20 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm ${stop.status === 'REJECTED' ? 'opacity-60' : ''}`}>
                                  <div className="flex flex-col items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <div className="w-0.5 h-6 bg-gray-300 dark:bg-gray-700 my-1"></div>
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                  </div>
                                  <div className={`flex-1 text-sm ${stop.status === 'REJECTED' ? 'line-through' : ''}`}>
                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                      From: <Text strong className="text-gray-700 dark:text-gray-200">{prevStop.name || `Lat: ${prevStop.lat.toFixed(4)}`}</Text>
                                    </div>
                                    <div className="text-gray-500 dark:text-gray-400">
                                      To: <Text strong className="text-gray-700 dark:text-gray-200">{stop.name || `Lat: ${stop.lat.toFixed(4)}`}</Text>
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-3">
                                    {stop.status === 'APPROVED' && <Tag color="success">APPROVED</Tag>}
                                    {stop.status === 'REJECTED' && <Tag color="error">REJECTED</Tag>}
                                    {(!stop.status || stop.status === 'PENDING') && record.status === 'PENDING' && (
                                      <Space>
                                        <Button size="small" type="primary" className="bg-green-600" onClick={() => updateSegmentMutation.mutate({ id: record.id, index: idx, status: 'APPROVED' })} icon={<CheckCircle size={14} />} />
                                        <Button size="small" danger onClick={() => updateSegmentMutation.mutate({ id: record.id, index: idx, status: 'REJECTED' })} icon={<XCircle size={14} />} />
                                      </Space>
                                    )}
                                    <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-semibold inline-block">
                                      {stop.distanceFromPrev?.toFixed(2)} km
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {record.notes && (
                            <div className="mt-3 bg-white dark:bg-black p-2 rounded border border-gray-100 dark:border-gray-800 inline-block">
                              <Text type="secondary" className="text-xs block mb-1">Notes:</Text>
                              <p className="m-0 text-sm font-medium text-gray-700 dark:text-gray-200">{record.notes}</p>
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                </Panel>
              </Collapse>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PetrolClaims;
