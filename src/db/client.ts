import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SCHEMA_SQL } from './schema';

/**
 * Universal Database Adapter interface providing unified async query
 * and execution methods across Cloudflare D1 and local SQLite.
 */
export interface DatabaseAdapter {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number | bigint }>;
  batch(statements: { sql: string; params?: any[] }[]): Promise<void>;
  exec?(sql: string): Promise<void>;
}

/**
 * Universal KV Cache Adapter interface for Cloudflare KV and in-memory TTL caching.
 */
export interface KvCacheAdapter {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Adapter wrapping Cloudflare D1 Database.
 */
export class D1Adapter implements DatabaseAdapter {
  constructor(private d1: any) {}

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.d1.prepare(sql);
    const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
    const res = await bound.all();
    return (res.results || []) as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const stmt = this.d1.prepare(sql);
    const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
    const res = await bound.first();
    return (res ?? null) as T | null;
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    const stmt = this.d1.prepare(sql);
    const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
    const res = await bound.run();
    return {
      changes: res.meta?.changes ?? 0,
      lastInsertRowid: res.meta?.last_row_id,
    };
  }

  async batch(statements: { sql: string; params?: any[] }[]): Promise<void> {
    if (!statements || statements.length === 0) return;
    const prepared = statements.map((s) => {
      const stmt = this.d1.prepare(s.sql);
      return s.params && s.params.length > 0 ? stmt.bind(...s.params) : stmt;
    });
    await this.d1.batch(prepared);
  }

  async exec(sql: string): Promise<void> {
    if (typeof this.d1.exec === 'function') {
      await this.d1.exec(sql);
    } else {
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const statement of statements) {
        await this.d1.prepare(statement).run();
      }
    }
  }
}

/**
 * Adapter wrapping local better-sqlite3 database.
 */
export class SqliteAdapter implements DatabaseAdapter {
  constructor(private db: any) {}

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return (result ?? null) as T | null;
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    const stmt = this.db.prepare(sql);
    const res = stmt.run(...params);
    return {
      changes: res.changes,
      lastInsertRowid: res.lastInsertRowid,
    };
  }

  async batch(statements: { sql: string; params?: any[] }[]): Promise<void> {
    if (!statements || statements.length === 0) return;
    const runBatch = this.db.transaction(() => {
      for (const s of statements) {
        this.db.prepare(s.sql).run(...(s.params || []));
      }
    });
    runBatch();
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  getRawDb(): any {
    return this.db;
  }
}

/**
 * Adapter wrapping Cloudflare KVNamespace.
 */
export class CloudflareKvAdapter implements KvCacheAdapter {
  constructor(private kv: any) {}

  async get(key: string): Promise<string | null> {
    return await this.kv.get(key);
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    await this.kv.put(key, value, options);
  }

  async delete(key: string): Promise<void> {
    await this.kv.delete(key);
  }
}

/**
 * In-memory KV cache fallback with TTL expiration.
 */
export class MemoryKvAdapter implements KvCacheAdapter {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expiresAt = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : null;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Reads and returns the raw schema.sql content.
 */
export function getSchemaSql(): string {
  if (SCHEMA_SQL) {
    return SCHEMA_SQL;
  }

  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const schemaFile = resolve(currentDir, 'schema.sql');
    if (existsSync(schemaFile)) {
      return readFileSync(schemaFile, 'utf8');
    }
  } catch {
    // Continue fallback
  }

  try {
    const rootSchema = resolve(process.cwd(), 'src/db/schema.sql');
    if (existsSync(rootSchema)) {
      return readFileSync(rootSchema, 'utf8');
    }
  } catch {
    // Continue fallback
  }

  throw new Error('Unable to locate schema.sql in src/db/schema.sql');
}

// Global singletons for local dev and testing
let _localDb: DatabaseAdapter | null = null;
let _testDb: DatabaseAdapter | null = null;
const _memoryKv = new MemoryKvAdapter();

/**
 * Sets the active test database instance. Pass null to reset.
 */
export function setTestDb(db: DatabaseAdapter | null): void {
  _testDb = db;
}

/**
 * Gets the active test database instance, if configured.
 */
export function getTestDb(): DatabaseAdapter | null {
  return _testDb;
}

/**
 * Creates an isolated in-memory SQLite database for unit and integration tests.
 */
export async function createTestDb(seed: boolean = true): Promise<DatabaseAdapter> {
  const { default: Database } = await import('better-sqlite3');
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const schema = getSchemaSql();
  sqlite.exec(schema);

  const adapter = new SqliteAdapter(sqlite);
  if (seed) {
    const { seedDefaultTrip } = await import('./seed');
    await seedDefaultTrip(adapter);
  }
  return adapter;
}

/**
 * Returns a DatabaseAdapter wrapping Cloudflare D1 in production/preview,
 * the test database during tests, or a local SQLite database in development.
 */
export async function getDb(localsOrEnv?: any): Promise<DatabaseAdapter> {
  // 1. Detect Cloudflare D1 on Astro locals / runtime / env
  const d1 = localsOrEnv?.runtime?.env?.DB ?? localsOrEnv?.DB;
  if (d1 && typeof d1.prepare === 'function') {
    return new D1Adapter(d1);
  }

  // 2. Direct D1 instance
  if (localsOrEnv && typeof localsOrEnv.prepare === 'function' && typeof localsOrEnv.batch === 'function') {
    return new D1Adapter(localsOrEnv);
  }

  // 3. Isolated test database
  if (_testDb) {
    return _testDb;
  }

  // 4. Local SQLite singleton
  if (!_localDb) {
    const { default: Database } = await import('better-sqlite3');
    const { mkdirSync } = await import('node:fs');
    const { resolve: pathResolve } = await import('node:path');

    const dataDir = pathResolve(process.cwd(), 'data');
    mkdirSync(dataDir, { recursive: true });
    const dbPath = pathResolve(dataDir, 'tripplanner.db');

    const sqlite = new Database(dbPath);
    sqlite.pragma('foreign_keys = ON');

    const schema = getSchemaSql();
    sqlite.exec(schema);

    const adapter = new SqliteAdapter(sqlite);

    // Seed default trip if empty
    const row = sqlite.prepare('SELECT COUNT(*) as count FROM trips').get() as { count: number };
    if (!row || row.count === 0) {
      const { seedDefaultTrip } = await import('./seed');
      await seedDefaultTrip(adapter);
    }

    _localDb = adapter;
  }

  return _localDb;
}

/**
 * Returns a KvCacheAdapter wrapping Cloudflare KV if available,
 * or an in-memory TTL cache fallback.
 */
export function getKvCache(localsOrEnv?: any): KvCacheAdapter {
  const kv = localsOrEnv?.runtime?.env?.CACHE_KV ?? localsOrEnv?.CACHE_KV;
  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
    return new CloudflareKvAdapter(kv);
  }

  if (localsOrEnv && typeof localsOrEnv.get === 'function' && typeof localsOrEnv.put === 'function') {
    return new CloudflareKvAdapter(localsOrEnv);
  }

  return _memoryKv;
}
