// Runs once when the Next.js server starts: make sure data/db.json exists
// so the database file is visible on disk from the very first launch.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { readDb } = await import('./lib/db');
  await readDb();
}
