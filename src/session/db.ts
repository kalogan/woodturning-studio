import { openDB, type IDBPDatabase } from 'idb';
import { SCHEMA_VERSION, SessionRecordSchema, type SessionRecord } from './schema.js';

const DB_NAME = 'woodturning-studio';
const STORE = 'session';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, SCHEMA_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
}

export async function loadSession(): Promise<SessionRecord | null> {
  const db = await getDB();
  const raw: unknown = await db.get(STORE, 'current');
  if (raw == null) return null;
  const parsed = SessionRecordSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function saveSession(record: SessionRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, record, 'current');
}

export function emptySession(): SessionRecord {
  return {
    schemaVersion: SCHEMA_VERSION,
    lastOpenedAt: Date.now(),
    lessons: [],
  };
}
