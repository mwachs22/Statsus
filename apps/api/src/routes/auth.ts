import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { users, mail_accounts } from '../db/schema';

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ChangePasswordBody = z.object({
  current_password: z.string().min(1),
  new_password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a special character'),
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

    // Include last_logout_at in the JWT so auth decorator can check it
    const token = await reply.jwtSign({
      id: user.id,
      email: user.email,
      account_ids,
      last_logout_at: user.last_logout_at?.toISOString() ?? null,
    }, JWT_OPTS);

    reply.setCookie('token', token, COOKIE_OPTS);
    return { user: { id: user.id, email: user.email } };
  });

  fastify.post('/api/auth/logout', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    // Invalidate all existing tokens by updating last_logout_at
    await db.update(users)
      .set({ last_logout_at: new Date() })
      .where(eq(users.id, request.user.id));

    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });

  fastify.post('/api/auth/change-password', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const parsed = ChangePasswordBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const [user] = await db.select().from(users).where(eq(users.id, request.user.id)).limit(1);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const valid = await bcrypt.compare(parsed.data.current_password, user.password_hash);
    if (!valid) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    const password_hash = await bcrypt.hash(parsed.data.new_password, 12);
    await db.update(users)
      .set({ password_hash, last_logout_at: new Date() })
      .where(eq(users.id, request.user.id));

    // Force re-login
    reply.clearCookie('token', { path: '/' });
    return { ok: true, message: 'Password changed. Please log in again.' };
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

      // Re-fetch user to get current last_logout_at
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1);

      const token = await reply.jwtSign({
        id: request.user.id,
        email: request.user.email,
        account_ids,
        last_logout_at: user?.last_logout_at?.toISOString() ?? null,
      }, JWT_OPTS);
      reply.setCookie('token', token, COOKIE_OPTS);
      return { ok: true };
    }
  );
}
