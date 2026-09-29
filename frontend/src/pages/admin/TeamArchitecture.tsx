import React, { useState, useMemo } from 'react';
import { Card, Tree, Row, Col, Avatar, Typography, Divider, Button, message, Tag, Spin, Alert, Empty, Badge } from 'antd';
import { Network, User, AlertCircle, BarChart3, Clock, CheckCircle } from 'lucide-react';
import type { DataNode, TreeProps } from 'antd/es/tree';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const { Title, Text } = Typography;

interface TeamNode {
  id: string;
  userId: string;
  name: string;
  role: string;
  level: number;
  supervisorId: string | null;
  path: string;
  directReports: number;
  isActive: boolean;
}

interface UserModel {
  id: string;
  name: string;
  email: string;
  role: string;
}

const UNASSIGNED_ROOT_KEY = 'UNASSIGNED_MEMBERS_POOL';

const TeamArchitecture: React.FC = () => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // 1. Fetch Users
  const { data: usersResponse, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users?isActive=true');
      return res.data.data as UserModel[];
    }
  });

  // 2. Fetch Team Hierarchy
  const { data: hierarchyResponse, isLoading: isLoadingHierarchy } = useQuery({
    queryKey: ['team-hierarchy'],
    queryFn: async () => {
      const res = await api.get('/team/hierarchy/tree');
      return res.data.data as TeamNode[];
    }
  });

  // 3. Update Hierarchy Mutation
  const updateHierarchyMutation = useMutation({
    mutationFn: async (payload: { userId: string, newSupervisorId: string | null, action: 'MOVE'|'ASSIGN'|'REMOVE' }) => {
      const res = await api.post('/team/hierarchy/update', payload);
      return res.data;
    },
    onSuccess: () => {
      message.success('Team hierarchy updated successfully');
      queryClient.invalidateQueries({ queryKey: ['team-hierarchy'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.error || 'Failed to update hierarchy');
    }
  });

  // 4. Fetch Performance if user is selected
  const { data: performanceResponse, isLoading: isLoadingPerformance } = useQuery({
    queryKey: ['performance', selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return null;
      try {
        const res = await api.get(`/performance/users/${selectedUserId}`);
        return res.data.data;
      } catch (err: any) {
         if (err.response?.status === 404) return { error: 'No data' };
         throw err;
      }
    },
    enabled: !!selectedUserId && selectedUserId !== UNASSIGNED_ROOT_KEY
  });

  // Convert flat hierarchy to TreeData AND append unassigned users
  const treeData = useMemo(() => {
    if (!usersResponse || !hierarchyResponse) return [];

    const nodes: Record<string, DataNode> = {};
    const assignedUserIds = new Set<string>();

    // Pass 1: Create all tree nodes for assigned users
    hierarchyResponse.forEach(node => {
      assignedUserIds.add(node.userId);
      nodes[node.userId] = {
        title: (
          <div className="flex items-center gap-2">
            <span className="font-semibold">{node.name}</span>
            <Tag color="blue" className="text-[10px] m-0 border-0">{node.role}</Tag>
          </div>
        ),
        key: node.userId,
        children: [],
        icon: <User size={16} className="text-apple-blue" />
      };
    });

    // Pass 2: Build the tree structure
    const roots: DataNode[] = [];
    hierarchyResponse.forEach(node => {
      if (node.supervisorId && nodes[node.supervisorId]) {
        (nodes[node.supervisorId].children as DataNode[]).push(nodes[node.userId]);
      } else {
        roots.push(nodes[node.userId]);
      }
    });

    // Identify unassigned users
    const unassignedUsers = usersResponse.filter(u => !assignedUserIds.has(u.id));
    
    const unassignedNode: DataNode = {
      title: <span className="font-bold text-apple-textMuted uppercase text-[11px] tracking-wider">Unassigned Pool ({unassignedUsers.length})</span>,
      key: UNASSIGNED_ROOT_KEY,
      icon: <Network size={16} className="text-apple-textMuted" />,
      children: unassignedUsers.map(u => ({
        title: (
          <div className="flex items-center gap-2 opacity-80">
            <span>{u.name}</span>
            <span className="text-[10px] text-apple-gray bg-black/5 dark:bg-white/10 px-1.5 rounded">{u.role}</span>
          </div>
        ),
        key: u.id,
        isLeaf: true,
        icon: <User size={16} className="text-apple-gray" />
      }))
    };

    return [
      {
        title: 'Organization Chart',
        key: 'ORG_ROOT',
        selectable: false,
        icon: <Network size={16} className="text-emerald-500" />,
        children: roots
      },
      unassignedNode
    ];
  }, [usersResponse, hierarchyResponse]);

  const onSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string;
      if (key !== UNASSIGNED_ROOT_KEY && key !== 'ORG_ROOT') {
         setSelectedUserId(key);
      } else {
         setSelectedUserId(null);
      }
    } else {
      setSelectedUserId(null);
    }
  };

  const onDrop: TreeProps['onDrop'] = (info) => {
    const dragKey = info.dragNode.key as string;
    let dropKey = info.node.key as string;
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);

    if (dragKey === UNASSIGNED_ROOT_KEY || dragKey === 'ORG_ROOT') {
      message.warning("You cannot drag structural root elements!");
      return;
    }

    // Attempting to drop onto Unassigned Root -> Remove from hierarchy
    if (dropKey === UNASSIGNED_ROOT_KEY || (info.node.key as string).startsWith(UNASSIGNED_ROOT_KEY + '-')) {
        updateHierarchyMutation.mutate({
          userId: dragKey,
          newSupervisorId: null,
          action: 'REMOVE'
        });
        return;
    }

    // If dropped beside a node instead of inside
    if (!info.dropToGap) {
        // Dropped inside a node
        updateHierarchyMutation.mutate({
          userId: dragKey,
          newSupervisorId: dropKey === 'ORG_ROOT' ? null : dropKey, // if root, supervisor is null
          action: 'ASSIGN'
        });
    } else {
        // Find the parent of the drop target
        const dropNodeData = hierarchyResponse?.find(h => h.userId === dropKey);
        const supervisorId = dropNodeData?.supervisorId || null;
        updateHierarchyMutation.mutate({
            userId: dragKey,
            newSupervisorId: supervisorId,
            action: 'MOVE'
        });
    }
  };

  const selectedUserDetails = usersResponse?.find(u => u.id === selectedUserId);
  const selectedHierarchyNode = hierarchyResponse?.find(h => h.userId === selectedUserId);

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-2xl font-bold tracking-tight text-apple-textLight dark:text-apple-textDark mb-6 flex items-center">
        <Network className="mr-2 text-apple-blue"/> Team Architecture Management
      </h1>

      <Row gutter={[24, 24]}>
        {/* Left Column - Hierarchy Chart */}
        <Col xs={24} md={14} lg={16}>
          <Card className="apple-card min-h-[600px] h-full shadow-sm">
            <div className="bg-blue-50/50 dark:bg-apple-blue/10 p-4 rounded-[12px] mb-5 text-[13px] font-medium text-apple-textMuted border border-blue-100 dark:border-white/5 tracking-tight flex items-start gap-2">
               <AlertCircle size={16} className="text-apple-blue mt-0.5 shrink-0" />
               <span>Drag and drop members from the "Unassigned Pool" onto superior nodes to map reporting paths. Drag structural nodes to "Unassigned Pool" to sever hierarchy lines.</span>
            </div>
            
            {isLoadingUsers || isLoadingHierarchy ? (
              <div className="flex justify-center p-12"><Spin size="large" /></div>
            ) : (
              <Tree
                showIcon
                defaultExpandAll
                draggable={{ icon: false }}
                treeData={treeData}
                onSelect={onSelect}
                onDrop={onDrop}
                blockNode
                className="text-[14px] font-medium tracking-tight bg-transparent text-apple-textLight dark:text-apple-textDark org-tree"
              />
            )}
          </Card>
        </Col>

        {/* Right Column - User Detail and Performance Metrics */}
        <Col xs={24} md={10} lg={8}>
          {selectedUserId && selectedUserDetails ? (
            <Card className="apple-card shadow-sm h-full" title={<span className="font-semibold tracking-tight text-apple-textLight dark:text-apple-textDark">Junior Staff Overview</span>}>
              <div className="text-center mb-6 mt-2 relative">
                 <div className="absolute top-0 right-0">
                    <Badge dot color={selectedHierarchyNode?.isActive ? 'green' : 'red'} />
                 </div>
                 <Avatar size={64} className="bg-apple-blue/10 dark:bg-apple-blue/20 text-apple-blue font-bold mb-3" icon={<User size={32}/>} />
                 <h2 className="text-[18px] font-bold tracking-tight text-apple-textLight dark:text-apple-textDark m-0">{selectedUserDetails.name}</h2>
                 <span className="text-[12px] font-semibold text-apple-blue bg-blue-50 dark:bg-apple-blue/10 px-2 py-0.5 rounded-full mt-2 inline-block">{selectedUserDetails.role}</span>
              </div>

              <Divider className="border-black/5 dark:border-white/10 my-4" />
              
              <div className="mb-2 uppercase text-[11px] font-bold tracking-widest text-apple-textMuted text-center">Performance Realtime Pipeline</div>

              {isLoadingPerformance ? (
                <div className="flex justify-center py-6"><Spin /></div>
              ) : performanceResponse && !performanceResponse.error ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-apple-gray dark:bg-black/20 rounded-[12px]">
                     <div className="flex items-center gap-2 text-[13px] text-apple-textMuted font-semibold">
                       <CheckCircle size={14} className="text-emerald-500" /> Completion Rate
                     </div>
                     <span className="text-apple-textLight dark:text-apple-textDark font-bold text-[15px]">{performanceResponse.taskCompletionRate}%</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-apple-gray dark:bg-black/20 rounded-[12px]">
                     <div className="flex items-center gap-2 text-[13px] text-apple-textMuted font-semibold">
                       <Clock size={14} className="text-blue-500" /> Avg Response
                     </div>
                     <span className="text-apple-textLight dark:text-apple-textDark font-bold text-[15px]">{performanceResponse.averageResponseTime} hrs</span>
                  </div>

                  <div className={`flex justify-between items-center p-3 rounded-[12px] ${performanceResponse.overdueTaskCount > 0 ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30' : 'bg-apple-gray dark:bg-black/20'}`}>
                     <div className="flex items-center gap-2 text-[13px] text-apple-textMuted font-semibold">
                       <AlertCircle size={14} className={performanceResponse.overdueTaskCount > 0 ? "text-red-500" : "text-apple-gray"} /> Overdue Faults
                     </div>
                     <span className={`font-bold text-[15px] ${performanceResponse.overdueTaskCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-apple-textLight dark:text-apple-textDark'}`}>
                       {performanceResponse.overdueTaskCount} Tasks
                     </span>
                  </div>

                  {performanceResponse.overdueTaskCount > 0 && (
                     <Alert 
                       type="error" 
                       showIcon 
                       className="rounded-[12px] border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20 text-[13px] font-medium"
                       message="Escalation active"
                       description="This subordinate has delayed tasks beyond the 2-day threshold. Notifications sent to superiors."
                     />
                  )}
                </div>
              ) : (
                <Empty description="No performance history snapshot found." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}

              <Divider className="border-black/5 dark:border-white/10 my-4" />
              
              <Button type="primary" block className="h-10 bg-apple-blue border-0 shadow-sm font-semibold rounded-[12px]">
                 Request Formal Audit
              </Button>
            </Card>
          ) : (
            <Card className="apple-card bg-black/[0.02] dark:bg-apple-cardLight dark:bg-apple-cardDark/[0.02] border-dashed border-2 border-black/10 dark:border-white/10 flex items-center justify-center min-h-[300px] shadow-none">
               <Text className="flex flex-col items-center text-apple-textMuted font-medium tracking-tight text-center">
                 <Network size={32} className="text-apple-textMuted/40 mb-3"/>
                 Select an organizational junior explicitly to map or evaluate reporting performance and escalations.
               </Text>
            </Card>
          )}
        </Col>
      </Row>

      <style>{`
        .org-tree .ant-tree-node-content-wrapper {
          border-radius: 8px !important;
          padding: 2px 8px !important;
        }
        .org-tree .ant-tree-treenode-selected .ant-tree-node-content-wrapper {
          background-color: var(--ant-color-primary-bg) !important;
        }
        /* Custom drag line indicator styling for clearer hierarchy dropping */
        .org-tree .ant-tree-drop-indicator {
          background-color: #0071e3 !important;
          height: 3px !important;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default TeamArchitecture;
