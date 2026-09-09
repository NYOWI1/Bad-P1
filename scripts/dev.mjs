import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
config({ path: resolve(root, 'server/.env'), quiet: true });
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET ||= randomBytes(48).toString('hex');
const children = [];
let embedded, socket, closing = false;
const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env: process.env, stdio: 'inherit' });
  children.push(child);
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
});
async function stop(code = 0) {
  if (closing) return; closing = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 2500).unref();
  if (socket) await socket.stop(); if (embedded) await embedded.close(); process.exit(code);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
try {
  if (!process.env.DATABASE_URL) {
    await mkdir(resolve(root, '.data'), { recursive: true });
    embedded = await PGlite.create(resolve(root, '.data/postgres'));
    socket = new PGLiteSocketServer({ db: embedded, host: '127.0.0.1', port: 54329 });
    await socket.start();
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54329/postgres?connection_limit=1&pgbouncer=true';
    process.env.DEMO_AUTH ??= 'false';
    console.log('Local PostgreSQL development database ready. Microsoft sign-in is the only login path.');
  }
  await run('npm', ['run', 'db:generate']);
  await run('npm', ['run', 'db:migrate']);
  await run('npm', ['run', 'db:seed']);
  // Spawn node directly so teardown reaches the actual server processes.
  const backend = spawn(process.execPath, ['--watch', 'server/src/index.js'], { cwd: root, env: process.env, stdio: 'inherit' });
  const frontend = spawn(process.execPath, ['../node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { cwd: resolve(root, 'client'), env: process.env, stdio: 'inherit' });
  children.push(backend, frontend);
  for (const child of [backend, frontend]) { child.on('error', err => { console.error(err.message); stop(1); }); child.on('exit', code => { if (!closing) stop(code || 0); }); }
} catch (error) { console.error(error.message); await stop(1); }
