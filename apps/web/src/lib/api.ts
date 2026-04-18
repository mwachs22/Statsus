const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}

export interface Account {
  id: string;
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  status: string;
  is_default: boolean;
  created_at: string;
}

export interface ThreadSummary {
  thread_id: string;
  subject: string;
  from_addr: string;
  body_preview: string;
  date: string;
  flags: string[];
  account_id: string;
  message_count: number;
  unread_count: number;
}

export interface Message {
  id: string;
  thread_id: string;
  folder: string;
  from_addr: string;
  to_addr: string;
  cc_addr?: string;
  subject: string;
  body_preview?: string;
  text_body?: string;
  html_body?: string;
  flags: string[];
  date: string;
  message_id?: string;
  in_reply_to?: string;
  account_id: string;
}

export interface CalendarEvent {
  id: string;
  account_id: string;
  calendar_uid: string;
  summary?: string;
  description?: string;
  location?: string;
  organizer?: string;
  attendees: Array<{ email: string; name?: string; partstat?: string }>;
  start_time: string;
  end_time?: string;
  all_day: boolean;
  recurrence_rule?: string;
  status?: string;
}

export interface Contact {
  id: string;
  account_id: string;
  uid: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  emails: Array<{ type: string; value: string }>;
  phones: Array<{ type: string; value: string }>;
  organization?: string;
  title?: string;
  photo_url?: string;
  notes?: string;
}

export type FilterAction =
  | { type: 'label'; value: string }
  | { type: 'archive' }
  | { type: 'delete' }
  | { type: 'mark_read' }
  | { type: 'forward'; value: string }
  | { type: 'stop_processing' };

export interface FilterRule {
  field: 'from' | 'to' | 'subject' | 'body';
  op: 'contains' | 'not_contains' | 'equals' | 'regex' | 'is_empty';
  value: string;
}

export interface FilterConditionGroup {
  logic: 'AND' | 'OR';
  rules: (FilterRule | FilterConditionGroup)[];
}

export interface Filter {
  id: string;
  user_id?: string;
  account_id?: string;
  name: string;
  conditions: FilterConditionGroup;
  actions: FilterAction[];
  enabled: boolean;
  run_order: number;
  match_count: number;
}

export interface Snippet {
  id: string;
  user_id?: string;
  title: string;
  content: string;
  format: 'html' | 'plain';
  folder?: string;
  tags: string[];
  variables: Record<string, string>;
  usage_count: number;
  is_global: boolean;
}

export interface ShortcutOverride {
  id: string;
  user_id?: string;
  action: string;
  key_combination: string;
  scope: 'global' | 'compose' | 'list';
}

export interface ScheduledEmail {
  id: string;
  user_id: string;
  account_id: string;
  raw_message: {
    to: string;
    cc?: string;
    subject: string;
    text?: string;
    html?: string;
    in_reply_to?: string;
    references?: string;
  };
  scheduled_at: string;
  timezone: string;
  status: 'queued' | 'sent' | 'failed';
  retry_count: number;
  created_at: string;
}

export interface AIConfig {
  user_id: string;
  provider: 'openai' | 'openrouter' | 'ollama';
  model: string;
  endpoint_url?: string | null;
  features: { compose: boolean; reply: boolean; summary: boolean };
  max_tokens: number;
  temperature: string;
  has_api_key?: boolean;
}

export interface Todo {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  priority: 'high' | 'normal' | 'low';
  due_date?: string | null;
  linked_message_id?: string | null;
  created_at: string;
}

export interface SearchResults {
  query: string;
  results: {
    messages: Array<{ id: string; thread_id: string; subject: string; from_addr: string; body_preview: string; date: string }>;
    contacts: Array<{ id: string; full_name: string; emails: unknown; organization: string }>;
    events: Array<{ id: string; summary: string; start_time: string; location: string }>;
  };
  total: number;
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ user: { id: string; email: string } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ user: { id: string; email: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: { id: string; email: string } }>('/auth/me'),
    refresh: () => request<{ ok: boolean }>('/auth/refresh', { method: 'POST' }),
  },

  accounts: {
    list: () => request<{ accounts: Account[] }>('/accounts'),
    add: (data: {
      email: string;
      imap_host: string;
      imap_port: number;
      smtp_host: string;
      smtp_port: number;
      username: string;
      password: string;
    }) =>
      request<{ account: Account }>('/accounts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),
    sync: (id: string) =>
      request<{ ok: boolean }>(`/accounts/${id}/sync`, { method: 'POST' }),
  },

  messages: {
    threads: (params: { account_id?: string; folder?: string; page?: number }) => {
      const qs = new URLSearchParams();
      if (params.account_id) qs.set('account_id', params.account_id);
      if (params.folder) qs.set('folder', params.folder);
      if (params.page) qs.set('page', String(params.page));
      return request<{ threads: ThreadSummary[] }>(`/messages/threads?${qs}`);
    },
    thread: (threadId: string) =>
      request<{ messages: Message[] }>(`/messages/thread/${threadId}`),
    send: (data: {
      account_id: string;
      to: string;
      cc?: string;
      subject: string;
      text?: string;
      html?: string;
      in_reply_to?: string;
      references?: string;
      thread_id?: string;
    }) =>
      request<{ ok: boolean; message_id: string }>('/messages/send', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    setFlags: (id: string, add: string[], remove: string[]) =>
      request<{ flags: string[] }>(`/messages/${id}/flags`, {
        method: 'PATCH',
        body: JSON.stringify({ add, remove }),
      }),
  },

  calendar: {
    events: (params: { account_id?: string; start?: string; end?: string }) => {
      const qs = new URLSearchParams();
      if (params.account_id) qs.set('account_id', params.account_id);
      if (params.start) qs.set('start', params.start);
      if (params.end)   qs.set('end', params.end);
      return request<{ events: CalendarEvent[] }>(`/calendar/events?${qs}`);
    },
    create: (data: Partial<CalendarEvent> & { account_id: string; summary: string; start_time: string }) =>
      request<{ event: CalendarEvent }>('/calendar/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<CalendarEvent>) =>
      request<{ event: CalendarEvent }>(`/calendar/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/calendar/events/${id}`, { method: 'DELETE' }),
  },

  contacts: {
    list: (params: { account_id?: string; search?: string; page?: number }) => {
      const qs = new URLSearchParams();
      if (params.account_id) qs.set('account_id', params.account_id);
      if (params.search) qs.set('search', params.search);
      if (params.page)   qs.set('page', String(params.page));
      return request<{ contacts: Contact[] }>(`/contacts?${qs}`);
    },
    get: (id: string) => request<{ contact: Contact }>(`/contacts/${id}`),
    create: (data: Partial<Contact> & { account_id: string; full_name: string }) =>
      request<{ contact: Contact }>('/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Contact>) =>
      request<{ contact: Contact }>(`/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/contacts/${id}`, { method: 'DELETE' }),
  },

  search: (q: string) => request<SearchResults>(`/search?q=${encodeURIComponent(q)}`),

  filters: {
    list: () => request<{ filters: Filter[] }>('/filters'),
    create: (data: Omit<Filter, 'id' | 'match_count'>) =>
      request<{ filter: Filter }>('/filters', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Filter>) =>
      request<{ filter: Filter }>(`/filters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggle: (id: string) =>
      request<{ filter: Filter }>(`/filters/${id}/toggle`, { method: 'PATCH' }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/filters/${id}`, { method: 'DELETE' }),
  },

  snippets: {
    list: (params?: { search?: string; folder?: string }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set('search', params.search);
      if (params?.folder) qs.set('folder', params.folder);
      return request<{ snippets: Snippet[] }>(`/snippets${qs.toString() ? '?' + qs : ''}`);
    },
    create: (data: Omit<Snippet, 'id' | 'usage_count'>) =>
      request<{ snippet: Snippet }>('/snippets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Snippet>) =>
      request<{ snippet: Snippet }>(`/snippets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    use: (id: string) =>
      request<{ usage_count: number }>(`/snippets/${id}/use`, { method: 'POST' }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/snippets/${id}`, { method: 'DELETE' }),
  },

  shortcuts: {
    list: () => request<{ shortcuts: ShortcutOverride[] }>('/shortcuts'),
    set: (action: string, key_combination: string, scope: string) =>
      request<{ shortcut: ShortcutOverride }>(`/shortcuts/${action}`, {
        method: 'PUT',
        body: JSON.stringify({ key_combination, scope }),
      }),
    remove: (action: string) =>
      request<{ ok: boolean }>(`/shortcuts/${action}`, { method: 'DELETE' }),
  },

  scheduled: {
    list: () => request<{ scheduled: ScheduledEmail[] }>('/scheduled'),
    create: (data: {
      account_id: string;
      scheduled_at: string;
      timezone?: string;
      to: string;
      cc?: string;
      subject: string;
      text?: string;
      html?: string;
      in_reply_to?: string;
      references?: string;
    }) =>
      request<{ scheduled: ScheduledEmail }>('/scheduled', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    cancel: (id: string) =>
      request<{ ok: boolean }>(`/scheduled/${id}`, { method: 'DELETE' }),
  },

  ai: {
    getConfig: () => request<{ config: AIConfig | null }>('/ai/config'),
    saveConfig: (data: Partial<AIConfig> & { api_key?: string }) =>
      request<{ config: AIConfig }>('/ai/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    compose: (prompt: string) =>
      request<{ text: string }>('/ai/compose', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      }),
    improve: (text: string, instruction?: string) =>
      request<{ text: string }>('/ai/improve', {
        method: 'POST',
        body: JSON.stringify({ text, instruction }),
      }),
    summarize: (messages: Array<{ from: string; text: string }>) =>
      request<{ summary: string }>('/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      }),
  },

  todos: {
    list: () => request<{ todos: Todo[] }>('/todos'),
    create: (data: { text: string; priority?: string; due_date?: string; linked_message_id?: string }) =>
      request<{ todo: Todo }>('/todos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Todo>) =>
      request<{ todo: Todo }>(`/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/todos/${id}`, { method: 'DELETE' }),
  },
};
