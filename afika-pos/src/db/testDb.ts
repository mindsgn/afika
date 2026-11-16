/**
 * Jest-only SQLite driver.
 *
 * The app runs on expo-sqlite; Jest runs in plain Node. Node 24 ships
 * `node:sqlite`, which has the same prepare/all/get/run shape better-sqlite3
 * exposes. This thin adapter lets the *same* Drizzle schema, bootstrap SQL and
 * services run in tests without a native module or an Expo runtime.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { SCHEMA_SQL } from './bootstrap';
import * as schema from './schema';
import type { PosDb } from './types';

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      run(...args: unknown[]): { changes: number; lastInsertRowid: number | bigint };
      all(...args: unknown[]): Record<string, unknown>[] | unknown[][];
      get(...args: unknown[]): Record<string, unknown> | undefined;
      setReturnArrays(enabled: boolean): void;
    };
    close(): void;
  };
};

class NodeSqliteClient {
  readonly native: InstanceType<typeof DatabaseSync>;

  constructor() {
    this.native = new DatabaseSync(':memory:');
    this.native.exec('PRAGMA foreign_keys = ON;');
    this.native.exec(SCHEMA_SQL);
  }

  prepare(sql: string) {
    const statement = this.native.prepare(sql);
    // Drizzle's field-mapped reads use stmt.raw().all(), which must return
    // positional arrays. node:sqlite collapses duplicate column names (a
    // joined products.name/categories.name, for example) into one object key,
    // so use a second statement configured to return arrays instead.
    const arrayStatement = this.native.prepare(sql);
    arrayStatement.setReturnArrays(true);
    const asRows = (...args: unknown[]) => arrayStatement.all(...args) as unknown[][];
    return {
      run: (...args: unknown[]) => statement.run(...args),
      all: (...args: unknown[]) => statement.all(...args),
      get: (...args: unknown[]) => statement.get(...args),
      raw: () => ({
        all: asRows,
        get: (...args: unknown[]) => asRows(...args)[0],
      }),
    };
  }

  /** better-sqlite3 exposes transaction(fn).deferred/immediate/exclusive. */
  transaction<T>(fn: (tx: unknown) => T) {
    const run = (tx: unknown): T => {
      this.native.exec('BEGIN');
      try {
        const result = fn(tx);
        this.native.exec('COMMIT');
        return result;
      } catch (error) {
        this.native.exec('ROLLBACK');
        throw error;
      }
    };
    return { deferred: run, immediate: run, exclusive: run };
  }

  exec(sql: string) {
    this.native.exec(sql);
  }
}

/** Builds an empty, migrated POS database for a unit test. */
export function makeTestDb(): PosDb {
  const client = new NodeSqliteClient();
  return drizzle(client as never, { schema }) as unknown as PosDb;
}
