import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  last_logout_at: timestamp('last_logout_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const mail_accounts = pgTable('mail_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  imap_host: varchar('imap_host', { length: 255 }),
  imap_port: integer('imap_port').default(993),
  smtp_host: varchar('smtp_host', { length: 255 }),
  smtp_port: integer('smtp_port').default(587),
  caldav_url: varchar('caldav_url', { length: 500 }),
  carddav_url: varchar('carddav_url', { length: 500 }),
  encrypted_credential: text('encrypted_credential').notNull(),
  status: varchar('status', { length: 20 }).default('active'),
  is_default: boolean('is_default').default(false),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    account_id: uuid('account_id').references(() => mail_accounts.id, { onDelete: 'cascade' }),
    thread_id: uuid('thread_id'),
    folder: varchar('folder', { length: 100 }).notNull().default('INBOX'),
    from_addr: varchar('from_addr', { length: 500 }),
    to_addr: varchar('to_addr', { length: 1000 }),
    cc_addr: varchar('cc_addr', { length: 1000 }),
    subject: varchar('subject', { length: 500 }),
    body_preview: text('body_preview'),
    text_body: text('text_body'),
    html_body: text('html_body'),
    flags: text('flags').array(),
    date: timestamp('date', { withTimezone: true }),
    size: integer('size'),
    uid: integer('uid'),
    message_id: varchar('message_id', { length: 998 }),
    in_reply_to: varchar('in_reply_to', { length: 998 }),
    references_ids: text('references_ids').array(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    accountFolderIdx: index('idx_messages_account_folder').on(t.account_id, t.folder),
    threadIdx: index('idx_messages_thread').on(t.thread_id),
    messageIdIdx: index('idx_messages_message_id').on(t.message_id),
  })
);

export const filters = pgTable(
  'filters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    account_id: uuid('account_id'),
    name: varchar('name', { length: 100 }).notNull(),
    conditions: jsonb('conditions').notNull(),
    actions: jsonb('actions').notNull(),
    enabled: boolean('enabled').default(true),
    run_order: integer('run_order').notNull(),
    match_count: integer('match_count').default(0),
    last_matched_at: timestamp('last_matched_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userEnabledIdx: index('idx_filters_user').on(t.user_id, t.enabled),
  })
);

export const snippets = pgTable('snippets', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 100 }).notNull(),
  content: text('content').notNull(),
  format: varchar('format', { length: 10 }).default('html'),
  folder: varchar('folder', { length: 50 }),
  tags: text('tags').array(),
  variables: jsonb('variables'),
  usage_count: integer('usage_count').default(0),
  is_global: boolean('is_global').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const user_shortcuts = pgTable(
  'user_shortcuts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 50 }).notNull(),
    key_combination: varchar('key_combination', { length: 20 }).notNull(),
    scope: varchar('scope', { length: 20 }).default('global'),
  },
  (t) => ({
    userActionScopeUnq: unique('uq_user_shortcuts').on(t.user_id, t.action, t.scope),
  })
);

export const scheduled_emails = pgTable(
  'scheduled_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    account_id: uuid('account_id').references(() => mail_accounts.id),
    raw_message: jsonb('raw_message').notNull(),
    scheduled_at: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    timezone: varchar('timezone', { length: 50 }).default('UTC'),
    status: varchar('status', { length: 20 }).default('queued'),
    retry_count: integer('retry_count').default(0),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    queueIdx: index('idx_scheduled_queue').on(t.status, t.scheduled_at),
  })
);

export const ai_configs = pgTable('ai_configs', {
  user_id: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 20 }).default('openrouter'),
  encrypted_api_key: text('encrypted_api_key'),
  model: varchar('model', { length: 50 }).default('qwen2.5:7b'),
  endpoint_url: varchar('endpoint_url', { length: 255 }),
  features: jsonb('features').default({ compose: true, reply: true, summary: true }),
  max_tokens: integer('max_tokens').default(2048),
  temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.7'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const sync_state = pgTable(
  'sync_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    account_id: uuid('account_id').references(() => mail_accounts.id, { onDelete: 'cascade' }),
    folder: varchar('folder', { length: 100 }).notNull().default('INBOX'),
    last_uid: integer('last_uid').default(0),
    uid_validity: integer('uid_validity'),
    last_modseq: varchar('last_modseq', { length: 50 }),
    last_synced_at: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => ({
    accountFolderUnq: unique('uq_sync_state').on(t.account_id, t.folder),
  })
);

export const calendar_events = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    account_id: uuid('account_id').references(() => mail_accounts.id, { onDelete: 'cascade' }),
    calendar_uid: varchar('calendar_uid', { length: 998 }).notNull(),
    href: varchar('href', { length: 1000 }),
    etag: varchar('etag', { length: 255 }),
    summary: varchar('summary', { length: 500 }),
    description: text('description'),
    location: varchar('location', { length: 500 }),
    organizer: varchar('organizer', { length: 255 }),
    attendees: jsonb('attendees').default([]),
    start_time: timestamp('start_time', { withTimezone: true }),
    end_time: timestamp('end_time', { withTimezone: true }),
    all_day: boolean('all_day').default(false),
    recurrence_rule: varchar('recurrence_rule', { length: 500 }),
    status: varchar('status', { length: 20 }).default('CONFIRMED'),
    raw_ical: text('raw_ical'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    accountUidUnq: unique('uq_calendar_event').on(t.account_id, t.calendar_uid),
    startIdx: index('idx_calendar_events_start').on(t.account_id, t.start_time),
  })
);

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    account_id: uuid('account_id').references(() => mail_accounts.id, { onDelete: 'cascade' }),
    uid: varchar('uid', { length: 500 }).notNull(),
    href: varchar('href', { length: 1000 }),
    etag: varchar('etag', { length: 255 }),
    full_name: varchar('full_name', { length: 255 }),
    first_name: varchar('first_name', { length: 100 }),
    last_name: varchar('last_name', { length: 100 }),
    emails: jsonb('emails').default([]),       // [{type, value}]
    phones: jsonb('phones').default([]),       // [{type, value}]
    organization: varchar('organization', { length: 255 }),
    title: varchar('title', { length: 255 }),
    photo_url: text('photo_url'),
    notes: text('notes'),
    raw_vcard: text('raw_vcard'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    accountUidUnq: unique('uq_contact').on(t.account_id, t.uid),
    nameIdx: index('idx_contacts_name').on(t.account_id, t.full_name),
  })
);

export const dav_sync_state = pgTable(
  'dav_sync_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    account_id: uuid('account_id').references(() => mail_accounts.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 20 }).notNull(), // 'caldav' | 'carddav'
    url: varchar('url', { length: 1000 }).notNull(),
    ctag: varchar('ctag', { length: 255 }),
    sync_token: varchar('sync_token', { length: 500 }),
    last_synced_at: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => ({
    accountTypeUrlUnq: unique('uq_dav_sync').on(t.account_id, t.type, t.url),
  })
);

export const todos = pgTable(
  'todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    text: varchar('text', { length: 500 }).notNull(),
    completed: boolean('completed').default(false),
    priority: varchar('priority', { length: 10 }).default('normal'),
    due_date: timestamp('due_date', { withTimezone: true }),
    linked_message_id: uuid('linked_message_id'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    activeIdx: index('idx_todos_active').on(t.user_id, t.completed),
  })
);
