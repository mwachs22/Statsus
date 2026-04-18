import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { users, mail_accounts } from '../db/schema';

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 hours
};

const JWT_OPTS = { expiresIn: '24h' };

async function getAccountIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: mail_accounts.id })
    .from(mail_accounts)
    .where(eq(mail_accounts.user_id, userId));
  return rows.map((r) => r.id);
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/register', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    if (process.env.REGISTRATION_DISABLED === 'true') {
      return reply.code(403).send({ error: 'Registration is disabled' });
    }

    const parsed = RegisterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({ email, password_hash })
      .returning({ id: users.id, email: users.email });

    // New user has no accounts yet
    const token = await reply.jwtSign({ id: user.id, email: user.email, account_ids: [] }, JWT_OPTS);
    reply.setCookie('token', token, COOKIE_OPTS);
    return reply.code(201).send({ user });
  });

  fastify.post('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input' });
    }
    const { email, password } = parsed.data;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const account_ids = await getAccountIds(user.id);
    const token = await reply.jwtSign({ id: user.id, email: user.email, account_ids }, JWT_OPTS);
    reply.setCookie('token', token, COOKIE_OPTS);
    return { user: { id: user.id, email: user.email } };
  });

  fastify.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });

  fastify.get(
    '/api/auth/me',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      return { user: request.user };
    }
  );

  // Re-issue JWT with fresh account_ids — call after adding or removing an account
  fastify.post(
    '/api/auth/refresh',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const account_ids = await getAccountIds(request.user.id);
      const token = await reply.jwtSign(
        { id: request.user.id, email: request.user.email, account_ids },
        JWT_OPTS
      );
      reply.setCookie('token', token, COOKIE_OPTS);
      return { ok: true };
    }
  );
}
