import { useState, useEffect, useCallback } from 'react';
import { api, type Snippet } from '../lib/api';

export function useSnippets(search = '') {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { snippets: rows } = await api.snippets.list({ search: search || undefined });
      setSnippets(rows);
    } catch (err) {
      console.error('Snippets fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const createSnippet = async (data: Omit<Snippet, 'id' | 'usage_count'>) => {
    const { snippet } = await api.snippets.create(data);
    setSnippets((prev) => [...prev, snippet].sort((a, b) => a.title.localeCompare(b.title)));
    return snippet;
  };

  const updateSnippet = async (id: string, data: Partial<Snippet>) => {
    const { snippet } = await api.snippets.update(id, data);
    setSnippets((prev) => prev.map((s) => (s.id === id ? snippet : s)));
    return snippet;
  };

  const removeSnippet = async (id: string) => {
    await api.snippets.remove(id);
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  };

  const useSnippet = async (id: string) => {
    api.snippets.use(id).catch(console.error); // fire-and-forget
  };

  return { snippets, loading, createSnippet, updateSnippet, removeSnippet, useSnippet };
}
