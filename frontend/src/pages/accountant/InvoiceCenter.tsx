import React, { useMemo, useState } from 'react';
import { Card, Table, Tag, Button, Input, Modal, message, Spin } from 'antd';
import { Search, Send, AlertCircle, CheckCircle, Eye, FileDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backendApi from '../../lib/axios';
import CustomerLink from '../../components/CustomerLink';

const InvoiceCenter: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [preview, setPreview] = useState<{ id: string; number: string; url: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => (await backendApi.get('/invoices')).data.data || [],
  });

  // Fetch the PDF with the auth header, return an object URL for iframe/download.
  const fetchPdfUrl = async (id: string) => {
    const res = await backendApi.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    return URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  };

  const handlePreview = async (row: any) => {
    setPdfLoading(row.id);
    try {
      const url = await fetchPdfUrl(row.id);
      setPreview({ id: row.id, number: row.invoiceNumber, url });
    } catch {
      message.error('PDF load nahi hua — invoice items check karein');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleDownload = async (row: any) => {
    setPdfLoading(row.id);
    try {
      const url = await fetchPdfUrl(row.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${row.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('PDF download failed');
    } finally {
      setPdfLoading(null);
    }
  };

  const sendMutation = useMutation({
    mutationFn: async (id: string) => (await backendApi.post(`/invoices/${id}/send`)).data,
    onSuccess: () => {
      message.success('Invoice marked SENT (customer timeline pe log hua)');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: () => message.error('Send failed'),
  });

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv: any) =>
      inv.invoiceNumber?.toLowerCase().includes(q) || inv.customer?.name?.toLowerCase().includes(q));
  }, [invoices, searchText]);

  const columns = [
    { title: 'Invoice No.', dataIndex: 'invoiceNumber', key: 'invoiceNumber', render: (t: string) => <span className="font-bold text-apple-textLight dark:text-apple-textDark">{t}</span> },
    { title: 'Issue Date', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => v ? new Date(v).toLocaleDateString('en-IN') : '-' },
    { title: 'Customer', key: 'customer', render: (_: unknown, r: any) => <CustomerLink name={r.customer?.name || '-'} customerId={r.customerId} /> },
    { title: 'Total', dataIndex: 'totalAmount', key: 'totalAmount', render: (v: number) => <span className="font-semibold">₹{Number(v || 0).toLocaleString('en-IN')}</span> },
    { title: 'Due', dataIndex: 'dueAmount', key: 'dueAmount', render: (v: number) => <span className={Number(v) > 0 ? 'text-red-500' : 'text-green-600'}>₹{Number(v || 0).toLocaleString('en-IN')}</span> },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (t: string) => {
        if (t === 'DRAFT') return <Tag color="default">Draft</Tag>;
        if (t === 'SENT' || t === 'PENDING') return <Tag color="processing">{t === 'SENT' ? 'Sent' : 'Pending'}</Tag>;
        if (t === 'PARTIAL') return <Tag color="warning">Partial Paid</Tag>;
        if (t === 'OVERDUE') return <Tag color="error" icon={<AlertCircle size={12} className="mr-1 inline" />}>Overdue</Tag>;
        if (t === 'PAID') return <Tag color="success" icon={<CheckCircle size={12} className="mr-1 inline" />}>Paid</Tag>;
        return <Tag>{t}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, r: any) => (
        <div className="flex gap-1">
          <Button size="small" type="link" icon={<Eye size={14} />} loading={pdfLoading === r.id} onClick={() => handlePreview(r)}>Preview</Button>
          <Button size="small" type="link" icon={<FileDown size={14} />} onClick={() => handleDownload(r)}>PDF</Button>
          {r.status !== 'PAID' && (
            <Button size="small" type="link" className="text-amber-600" icon={<Send size={14} />}
              loading={sendMutation.isPending && sendMutation.variables === r.id}
              onClick={() => sendMutation.mutate(r.id)}>
              Send
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 bg-transparent min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-apple-textLight dark:text-apple-textDark">Invoice Center</h1>
      </div>

      <Card className="shadow-sm rounded-lg" bodyStyle={{ padding: '16px 24px' }}>
        <div className="mb-4">
          <Input
            placeholder="Search Invoice No. or Customer Name..."
            prefix={<Search size={16} className="text-apple-gray" />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
        </div>

        {isLoading ? <div className="p-10 text-center"><Spin /></div> : (
          <Table columns={columns} dataSource={filtered} rowKey="id" pagination={{ pageSize: 15 }} />
        )}
      </Card>

      {/* PDF PREVIEW */}
      <Modal
        title={`Invoice Preview — ${preview?.number || ''}`}
        open={!!preview}
        onCancel={() => { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); }}
        footer={[
          <Button key="dl" type="primary" icon={<FileDown size={14} />} onClick={() => {
            if (!preview) return;
            const a = document.createElement('a');
            a.href = preview.url;
            a.download = `${preview.number}.pdf`;
            a.click();
          }}>Download PDF</Button>,
        ]}
        width={860}
      >
        {preview && <iframe title="invoice-pdf" src={preview.url} style={{ width: '100%', height: '70vh', border: 'none' }} />}
      </Modal>
    </div>
  );
};

export default InvoiceCenter;
