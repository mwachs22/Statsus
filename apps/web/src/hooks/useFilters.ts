import { useState, useEffect, useCallback } from 'react';
import { api, type Filter } from '../lib/api';

export function useFilters() {
  const [filters, setFilters] = useState<Filter[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { filters: rows } = await api.filters.list();
      setFilters(rows);
    } catch (err) {
      console.error('Filters fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createFilter = async (data: Omit<Filter, 'id' | 'match_count'>) => {
    const { filter } = await api.filters.create(data);
    setFilters((prev) => [...prev, filter]);
    return filter;
  };

  const updateFilter = async (id: string, data: Partial<Filter>) => {
    const { filter } = await api.filters.update(id, data);
    setFilters((prev) => prev.map((f) => (f.id === id ? filter : f)));
    return filter;
  };

  const toggleFilter = async (id: string) => {
    const { filter } = await api.filters.toggle(id);
    setFilters((prev) => prev.map((f) => (f.id === id ? filter : f)));
  };

  const removeFilter = async (id: string) => {
    await api.filters.remove(id);
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  return { filters, loading, createFilter, updateFilter, toggleFilter, removeFilter, reload: load };
}
