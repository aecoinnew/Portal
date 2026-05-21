import Database from "better-sqlite3";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

const databasePath = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "server/data/emcoin.sqlite");
const statementsDir = path.resolve(process.cwd(), process.env.STATEMENTS_DIR ?? "server/uploads/statements");

fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.mkdirSync(statementsDir, { recursive: true });

export const db = new Database(databasePath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function resolveStatementPath(filePath: string) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(statementsDir)) {
    throw new Error("Invalid statement storage path");
  }
  return resolved;
}

export { databasePath, statementsDir };
