// Tiny JSON-file database. Data lives in ./data/db.json so it survives
// server restarts. All access is serialised through a promise queue so
// concurrent requests can't clobber each other's writes.
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

let queue = Promise.resolve();

async function load() {
  try {
    const db = JSON.parse(await fs.readFile(DB_PATH, 'utf8'));
    db.users ??= {};
    db.sessions ??= {};
    return db;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // First run: create data/db.json straight away so it's visible on disk.
      const empty = { users: {}, sessions: {} };
      await save(empty);
      return empty;
    }
    throw err;
  }
}

async function save(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  const json = JSON.stringify(db, null, 2);
  await fs.writeFile(tmp, json, 'utf8');
  try {
    await fs.rename(tmp, DB_PATH); // atomic replace
  } catch (err) {
    // Windows can refuse the rename if another process (e.g. antivirus)
    // briefly holds the file; fall back to a direct write.
    if (err.code === 'EPERM' || err.code === 'EBUSY') {
      await fs.writeFile(DB_PATH, json, 'utf8');
      await fs.rm(tmp, { force: true });
    } else {
      throw err;
    }
  }
}

function enqueue(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

/** Read-only snapshot of the database. */
export function readDb() {
  return enqueue(load);
}

/** Run `fn(db)` against the database and persist any changes it makes. */
export function updateDb(fn) {
  return enqueue(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
}
