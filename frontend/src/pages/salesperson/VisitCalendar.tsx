import { Card, List, Spin, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import backendApi from '../../lib/axios';

const { Title } = Typography;

export default function VisitCalendar() {
  const { data, isLoading } = useQuery({
    queryKey: ['visit-calendar'],
    queryFn: async () => (await backendApi.get('/visits/calendar')).data.data,
  });

  if (isLoading) {
    return <div className="p-10 flex justify-center"><Spin size="large" /></div>;
  }

  return (
    <div className="space-y-4">
      <Title level={4} className="!mb-0">Visit Calendar</Title>
      <Card>
        <List
          dataSource={data || []}
          locale={{ emptyText: 'No visits scheduled' }}
          renderItem={(item: any) => (
            <List.Item>
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-apple-textMuted">
                    {new Date(item.start).toLocaleString()} to {new Date(item.end).toLocaleString()}
                  </div>
                </div>
                <Tag color={item.backgroundColor === '#10b981' ? 'green' : item.backgroundColor === '#ef4444' ? 'red' : 'blue'}>
                  Scheduled
                </Tag>
              </div>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
