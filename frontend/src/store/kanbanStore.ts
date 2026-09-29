import { create } from 'zustand';

interface KanbanState {
  filters: {
    status?: string;
    source?: string;
    assignedTo?: string;
  };
  setFilter: (key: string, value: string | undefined) => void;
  clearFilters: () => void;
}

export const useKanbanStore = create<KanbanState>((set) => ({
  filters: {},
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  clearFilters: () => set({ filters: {} }),
}));
