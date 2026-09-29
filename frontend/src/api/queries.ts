import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// Campaigns
export const useCampaigns = (params?: any) => useQuery({
  queryKey: ['campaigns', params],
  queryFn: async () => (await api.get('/campaigns', { params })).data.data,
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 30,
  refetchOnWindowFocus: false,
});

export const useCampaign = (id: string) => useQuery({
  queryKey: ['campaign', id],
  queryFn: async () => (await api.get(`/campaigns/${id}`)).data.data,
  enabled: !!id,
});

export const useCreateCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => (await api.post('/campaigns', data)).data.data,
    onSuccess: () => qc.invalidateQueries(['campaigns'] as any),
  });
};

export const useUpdateCampaignStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => (await api.patch(`/campaigns/${id}/status`, { status })).data.data,
    onSuccess: (_, variables) => {
      qc.invalidateQueries(['campaigns'] as any);
      qc.invalidateQueries(['campaign', variables.id] as any);
    },
  });
};

// Templates
export const useTemplates = () => useQuery({
  queryKey: ['templates'],
  queryFn: async () => (await api.get('/templates')).data.data,
});

export const useCreateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => (await api.post('/templates', data)).data.data,
    onSuccess: () => qc.invalidateQueries(['templates'] as any),
  });
};

export const useUpdateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => (await api.put(`/templates/${id}`, data)).data.data,
    onSuccess: () => qc.invalidateQueries(['templates'] as any),
  });
};

export const useDeleteTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/templates/${id}`)).data.data,
    onSuccess: () => qc.invalidateQueries(['templates'] as any),
  });
};

// Raw Leads
export const useRawLeads = (params?: any) => useQuery({
  queryKey: ['rawLeads', params],
  queryFn: async () => (await api.get('/raw-leads', { params })).data.data,
  staleTime: 1000 * 60 * 5, // Keep fresh for 5 mins
  gcTime: 1000 * 60 * 30, // Keep in cache memory 30 mins
  refetchOnWindowFocus: false, // Don't refetch on tab switch
});

export const useUpdateRawLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => (await api.patch(`/raw-leads/${id}`, data)).data.data,
    onSuccess: () => qc.invalidateQueries(['rawLeads'] as any),
  });
};

export const useAddCallLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => (await api.post(`/raw-leads/${id}/call-log`, data)).data.data,
    onSuccess: () => qc.invalidateQueries(['rawLeads'] as any),
  });
};

export const useConvertLead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => (await api.post(`/raw-leads/${id}/convert`, data)).data.data,
    onSuccess: () => qc.invalidateQueries(['rawLeads'] as any),
  });
};

export const useBulkUploadLeads = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: any[]) => (await api.post('/raw-leads/bulk', { records })).data.data,
    onSuccess: () => qc.invalidateQueries(['rawLeads'] as any),
  });
};

export const useParseExcel = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return (await api.post('/raw-leads/parse-excel', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data;
    },
  });
};
