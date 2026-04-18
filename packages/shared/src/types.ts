export interface User {
  id: string;
  email: string;
  created_at?: string;
}

export interface MailAccount {
  id: string;
  user_id: string;
  email: string;
  imap_host: string;
  smtp_host: string;
  caldav_url?: string;
  carddav_url?: string;
  status: 'active' | 'error' | 'disabled';
  is_default: boolean;
}

export interface Message {
  id: string;
  account_id: string;
  thread_id: string;
  from_addr: string;
  to_addr: string;
  subject: string;
  body_preview: string;
  flags: string[];
  date: string;
  size: number;
}

export interface Filter {
  id: string;
  user_id: string;
  account_id?: string;
  name: string;
  conditions: FilterConditionGroup;
  actions: FilterAction[];
  enabled: boolean;
  run_order: number;
  match_count: number;
}

export interface FilterConditionGroup {
  logic: 'AND' | 'OR';
  rules: (FilterRule | FilterConditionGroup)[];
}

export interface FilterRule {
  field: 'from' | 'to' | 'subject' | 'body';
  op: 'contains' | 'not_contains' | 'equals' | 'regex' | 'is_empty';
  value: string;
}

export type FilterAction =
  | { type: 'label'; value: string }
  | { type: 'archive' }
  | { type: 'delete' }
  | { type: 'mark_read' }
  | { type: 'forward'; value: string }
  | { type: 'stop_processing' };

export interface Snippet {
  id: string;
  user_id: string;
  title: string;
  content: string;
  format: 'html' | 'plain';
  folder?: string;
  tags: string[];
  variables: Record<string, string>;
  usage_count: number;
  is_global: boolean;
}

export interface Shortcut {
  id: string;
  user_id: string;
  action: string;
  key_combination: string;
  scope: 'global' | 'compose' | 'list';
}

export interface ScheduledEmail {
  id: string;
  user_id: string;
  account_id: string;
  raw_message: Record<string, unknown>;
  scheduled_at: string;
  timezone: string;
  status: 'queued' | 'sent' | 'failed' | 'cancelled';
  retry_count: number;
}

export interface AIConfig {
  provider: 'openrouter' | 'openai' | 'ollama';
  model: string;
  endpoint_url?: string;
  features: {
    compose: boolean;
    reply: boolean;
    summary: boolean;
  };
  max_tokens: number;
  temperature: number;
}

export interface Todo {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  priority: 'low' | 'normal' | 'high';
  due_date?: string;
  linked_message_id?: string;
  created_at: string;
}

// API response types
export interface ApiError {
  error: string;
  details?: unknown;
}

export interface AuthResponse {
  user: User;
}
