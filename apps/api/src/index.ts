import dotenv from 'dotenv';
import path from 'path';
// In dev, process.cwd() is apps/api — walk up to the monorepo root .env
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJWT from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './lib/db';
import { authRoutes } from './routes/auth';
import { accountRoutes } from './routes/accounts';
import { messageRoutes } from './routes/messages';
import { calendarRoutes } from './routes/calendar';
import { contactRoutes } from './routes/contacts';
import { searchRoutes } from './routes/search';
import { filterRoutes } from './routes/filters';
import { snippetRoutes } from './routes/snippets';
import { shortcutRoutes } from './routes/shortcuts';
import { scheduledRoutes } from './routes/scheduled';
import { aiRoutes } from './routes/ai';
import { todoRoutes } from './routes/todos';
import rateLimit from '@fastify/rate-limit';
import { startScheduler, stopScheduler } from './workers/scheduler';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  trustProxy: true,
  bodyLimit: 1_048_576, // 1MB body limit
});

async function start() {
  // Run DB migrations before accepting traffic
  const migrationsFolder = path.resolve(__dirname, '../drizzle');
  await migrate(db, { migrationsFolder });
  fastify.log.info('Database migrations applied');

  // Plugins
  await fastify.register(fastifyCookie);

  await fastify.register(fastifyJWT, {
    secret: process.env.JWT_SECRET!,
    cookie: { cookieName: 'token', signed: false },
  });

  await fastify.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Rate-limit by user ID if authenticated, otherwise by IP
      return request.user?.id ?? request.ip;
    },
  });

  // Security headers (CSP, etc.)
  fastify.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (process.env.NODE_ENV === 'production') {
      reply.header('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'"
      );
    }
  });

  // Serve the compiled React app in production
  if (process.env.NODE_ENV === 'production') {
    const staticRoot = path.resolve(__dirname, '../public');
    await fastify.register(fastifyStatic, { root: staticRoot, prefix: '/' });
    // SPA fallback: non-API routes serve index.html
    fastify.setNotFoundHandler(async (_req, reply) => {
      return reply.sendFile('index.html');
    });
  }

  // Auth decorator used as preHandler on protected routes
  fastify.decorate(
    'authenticate',
    async function authenticate(request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      // JWT invalidation check: if the user logged out after this token was issued,
      // the token is no longer valid.
      const payload = request.user as Record<string, unknown>;
      if (payload.last_logout_at && payload.iat) {
        const tokenIat = payload.iat as number;
        const logoutTime = new Date(payload.last_logout_at as string).getTime() / 1000;
        if (logoutTime > tokenIat) {
          return reply.code(401).send({ error: 'Session expired. Please log in again.' });
        }
      }
    }
  );

  // Routes
  fastify.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));
  await fastify.register(authRoutes);
  await fastify.register(accountRoutes);
  await fastify.register(messageRoutes);
  await fastify.register(calendarRoutes);
  await fastify.register(contactRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(filterRoutes);
  await fastify.register(snippetRoutes);
  await fastify.register(shortcutRoutes);
  await fastify.register(scheduledRoutes);
  await fastify.register(aiRoutes);
  await fastify.register(todoRoutes);

  const port = parseInt(process.env.PORT || '3000', 10);
  await fastify.listen({ port, host: '0.0.0.0' });

  // Start periodic IMAP sync after server is listening
  startScheduler();
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  stopScheduler();
  await fastify.close();
  await pool.end();
  process.exit(0);
});

start().catch((err) => {
  fastify.log.error(err);
  pool.end();
  process.exit(1);
});
