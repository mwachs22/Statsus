import { useState, useCallback } from 'react';
import { api } from '../lib/api';

export function useAI() {
  const [working, setWorking] = useState(false);
  const [error, setError]     = useState('');

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setWorking(true);
    setError('');
    try {
      return await fn();
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setWorking(false);
    }
  }, []);

  const compose = useCallback((prompt: string) =>
    run(() => api.ai.compose(prompt).then((r) => r.text)),
  [run]);

  const improve = useCallback((text: string, instruction?: string) =>
    run(() => api.ai.improve(text, instruction).then((r) => r.text)),
  [run]);

  const summarize = useCallback((messages: Array<{ from: string; text: string }>) =>
    run(() => api.ai.summarize(messages).then((r) => r.summary)),
  [run]);

  return { working, error, compose, improve, summarize };
}
