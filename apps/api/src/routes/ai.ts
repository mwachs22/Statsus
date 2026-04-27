import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../lib/db';
import { ai_configs } from '../db/schema';
import { encrypt, decrypt } from '../lib/crypto';
import { validateEndpointUrl } from '../lib/ssrf-guard';

const ConfigBody = z.object({
  provider:     z.enum(['openai', 'openrouter', 'ollama']).default('openrouter'),
  api_key:      z.string().optional(),
  model:        z.string().min(1).default('qwen2.5:7b'),
  endpoint_url: z.string().url().optional().or(z.literal('')),
  features: z.object({
    compose: z.boolean().default(true),
    reply:   z.boolean().default(true),
    summary: z.boolean().default(true),
  }).default({}),
  max_tokens:  z.number().int().min(256).max(8192).default(2048),
  temperature: z.number().min(0).max(2).default(0.7),
});

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }

async function callAI(
  config: typeof ai_configs.$inferSelect,
  messages: ChatMessage[]
): Promise<string> {
  // Defense-in-depth: re-validate endpoint at call time in case the DB row
  // pre-dates the SSRF guard or was written directly.
  if (config.endpoint_url) {
    await validateEndpointUrl(config.endpoint_url);
  }

  const baseUrl = config.endpoint_url ||
    (config.provider === 'ollama' ? 'http://localhost:11434' : 'https://openrouter.ai');
  const url = `${baseUrl}/v1/chat/completions`;

  const apiKey = config.encrypted_api_key ? decrypt(config.encrypted_api_key) : '';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model:       config.model,
      messages,
      max_tokens:  config.max_tokens,
      temperature: parseFloat(String(config.temperature)),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`AI provider error: ${err}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content?.trim() ?? '';
}

async function getConfig(userId: string) {
  const [cfg] = await db.select().from(ai_configs).where(eq(ai_configs.user_id, userId));
  return cfg;
}

export async function aiRoutes(fastify: FastifyInstance) {
  // Get AI config (API key omitted)
  fastify.get(
    '/api/ai/config',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const cfg = await getConfig(request.user.id);
      if (!cfg) return { config: null };
      const { encrypted_api_key: _, ...safe } = cfg;
      return { config: { ...safe, has_api_key: !!cfg.encrypted_api_key } };
    }
  );

  // Upsert AI config
  fastify.put(
    '/api/ai/config',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const parsed = ConfigBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      const { api_key, endpoint_url, ...rest } = parsed.data;

      // SSRF guard: validate user-supplied endpoint before persisting
      if (endpoint_url) {
        await validateEndpointUrl(endpoint_url);
      }

      const update: Record<string, unknown> = {
        ...rest,
        endpoint_url:  endpoint_url || null,
        temperature:   String(rest.temperature),
        updated_at:    new Date(),
      };
      if (api_key) {
        update.encrypted_api_key = encrypt(api_key);
      }

      const [cfg] = await db
        .insert(ai_configs)
        .values({ user_id: request.user.id, ...update } as typeof ai_configs.$inferInsert)
        .onConflictDoUpdate({ target: ai_configs.user_id, set: update })
        .returning();

      const { encrypted_api_key: _, ...safe } = cfg;
      return { config: { ...safe, has_api_key: !!cfg.encrypted_api_key } };
    }
  );

  // Compose a new email from a prompt
  fastify.post(
    '/api/ai/compose',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { prompt } = request.body as { prompt?: string };
      if (!prompt?.trim()) return reply.code(400).send({ error: 'prompt is required' });

      const cfg = await getConfig(request.user.id);
      if (!cfg) return reply.code(400).send({ error: 'AI not configured' });

      const text = await callAI(cfg, [
        { role: 'system', content: 'You are a professional email assistant. Write clear, concise emails. Return only the email body without subject or greeting unless specifically asked.' },
        { role: 'user',   content: `Write an email: ${prompt}` },
      ]);

      return { text };
    }
  );

  // Improve / rewrite email text
  fastify.post(
    '/api/ai/improve',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { text, instruction } = request.body as { text?: string; instruction?: string };
      if (!text?.trim()) return reply.code(400).send({ error: 'text is required' });

      const cfg = await getConfig(request.user.id);
      if (!cfg) return reply.code(400).send({ error: 'AI not configured' });

      const directive = instruction ?? 'Improve this email: make it clearer, more professional, and concise.';

      const result = await callAI(cfg, [
        { role: 'system', content: 'You are a professional email assistant. Return only the improved email text — no commentary, no subject line, no meta-text.' },
        { role: 'user',   content: `${directive}\n\n${text}` },
      ]);

      return { text: result };
    }
  );

  // Summarize an email thread
  fastify.post(
    '/api/ai/summarize',
    { preHandler: [fastify.authenticate], config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { messages } = request.body as { messages?: Array<{ from: string; text: string }> };
      if (!messages?.length) return reply.code(400).send({ error: 'messages is required' });

      const cfg = await getConfig(request.user.id);
      if (!cfg) return reply.code(400).send({ error: 'AI not configured' });

      const thread = messages
        .map((m) => `From: ${m.from}\n${m.text}`)
        .join('\n\n---\n\n');

      const summary = await callAI(cfg, [
        { role: 'system', content: 'You are an email assistant. Summarize the email thread in 2–4 bullet points. Focus on decisions, action items, and key context.' },
        { role: 'user',   content: thread },
      ]);

      return { summary };
    }
  );
}
