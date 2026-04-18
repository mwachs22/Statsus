#!/bin/sh
set -e

echo "⏳ Running database migrations..."
node -e "
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
migrate(db, { migrationsFolder: '/app/drizzle' })
  .then(() => { console.log('✅ Migrations complete'); return pool.end(); })
  .catch(err => { console.error('❌ Migration failed:', err); process.exit(1); });
"

echo "🚀 Starting Statsus..."
exec node dist/index.js
