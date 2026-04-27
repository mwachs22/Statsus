import '@fastify/jwt';
import { FastifyRequest, FastifyReply } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; account_ids: string[]; last_logout_at?: string | null };
    user: { id: string; email: string; account_ids: string[]; last_logout_at?: string | null };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
