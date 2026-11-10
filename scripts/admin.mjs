#!/usr/bin/env node
// Command-line admin tool for the machine that hosts RoastRoute.
// Useful if you're locked out of the web Admin Console.
//
//   npm run admin -- list
//   npm run admin -- promote <username>
//   npm run admin -- demote  <username>
//   npm run admin -- enable  <username>

import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const [cmd, name] = process.argv.slice(2);

function load() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`No database found at ${DB_PATH}. Start the app once (npm run dev) to create it.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(db) {
  const tmp = `${DB_PATH}.cli.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

const db = load();
db.users ??= {};

if (!cmd || cmd === 'list') {
  const rows = Object.values(db.users).map((u) => ({
    username: u.username,
    role: u.role === 'admin' ? 'admin' : 'user',
    disabled: Boolean(u.disabled),
    favourites: (u.favorites ?? []).length,
    created: (u.createdAt ?? '').slice(0, 10),
  }));
  if (rows.length) console.table(rows);
  else console.log('No accounts yet. The first account created in the app becomes the admin.');
  process.exit(0);
}

const key = String(name || '').toLowerCase();
const user = db.users[key];
if (!['promote', 'demote', 'enable'].includes(cmd)) {
  console.error(`Unknown command "${cmd}". Use: list | promote <user> | demote <user> | enable <user>`);
  process.exit(1);
}
if (!user) {
  console.error(`No user named "${name}". Run "npm run admin -- list" to see accounts.`);
  process.exit(1);
}

if (cmd === 'promote') user.role = 'admin';
if (cmd === 'enable') delete user.disabled;
if (cmd === 'demote') {
  const admins = Object.values(db.users).filter((u) => u.role === 'admin' && !u.disabled);
  if (user.role === 'admin' && admins.length <= 1) {
    console.error('Refusing: that is the only active administrator.');
    process.exit(1);
  }
  user.role = 'user';
}
save(db);
console.log(`Done: ${user.username} is now ${user.role === 'admin' ? 'an admin' : 'a regular user'}${user.disabled ? ' (disabled)' : ''}.`);
