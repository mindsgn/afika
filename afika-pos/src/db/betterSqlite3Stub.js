/**
 * Jest-only shim. drizzle-orm/better-sqlite3 requires the native module at
 * import time even when a client instance is supplied, but native builds are
 * unavailable in CI/Jest. src/db/testDb.ts passes a node:sqlite-backed client
 * instead, so this export is never instantiated.
 */
class BetterSqlite3Stub {}

module.exports = BetterSqlite3Stub;
module.exports.default = BetterSqlite3Stub;
