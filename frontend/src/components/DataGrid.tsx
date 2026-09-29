import { Table, TableProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface DataGridProps<T> extends TableProps<T> {
  columns: ColumnsType<T>;
  dataSource: T[];
  loading?: boolean;
  rowKey?: string | ((record: T) => string);
}

export function DataGrid<T extends object>({
  columns,
  dataSource,
  loading = false,
  rowKey = 'id',
  ...rest
}: DataGridProps<T>) {
  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      rowKey={rowKey}
      pagination={{
        showSizeChanger: true,
        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
        defaultPageSize: 50,
        pageSizeOptions: ['10', '25', '50', '100']
      }}
      scroll={{ x: 'max-content' }}
      bordered
      size="middle"
      {...rest}
    />
  );
}
