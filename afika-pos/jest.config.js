module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // drizzle-orm/better-sqlite3 imports the native module even when a client
    // is supplied; testDb.ts uses node:sqlite instead (see the stub comment).
    "^better-sqlite3$": "<rootDir>/src/db/betterSqlite3Stub.js",
  },
  transformIgnorePatterns: ['node_modules/(?!expo/virtual/)'],
  transform: {
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
};
