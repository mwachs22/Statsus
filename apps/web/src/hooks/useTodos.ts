import { useState, useEffect, useCallback } from 'react';
import { api, type Todo } from '../lib/api';

export function useTodos() {
  const [todos, setTodos]     = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { todos } = await api.todos.list();
      setTodos(todos);
    } catch {
      // silently ignore; overlay stays empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addTodo = useCallback(async (text: string, priority: 'high' | 'normal' | 'low' = 'normal', linkedMessageId?: string) => {
    const { todo } = await api.todos.create({
      text,
      priority,
      linked_message_id: linkedMessageId,
    });
    setTodos((prev) => [todo, ...prev]);
    return todo;
  }, []);

  const toggleTodo = useCallback(async (id: string) => {
    const current = todos.find((t) => t.id === id);
    if (!current) return;
    const { todo } = await api.todos.update(id, { completed: !current.completed });
    setTodos((prev) => prev.map((t) => (t.id === id ? todo : t)));
  }, [todos]);

  const updateTodo = useCallback(async (id: string, data: Partial<Todo>) => {
    const { todo } = await api.todos.update(id, data);
    setTodos((prev) => prev.map((t) => (t.id === id ? todo : t)));
  }, []);

  const removeTodo = useCallback(async (id: string) => {
    await api.todos.remove(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { todos, loading, addTodo, toggleTodo, updateTodo, removeTodo, reload: load };
}
