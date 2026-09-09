import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadSecrets } from '../src/config/keyVault.js';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: serverRoot,
      env: process.env,
      stdio: 'inherit'
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else
        rejectRun(
          new Error(`${command} ${args.join(' ')} exited with code ${code}`)
        );
    });
  });
}

process.env.NODE_ENV = 'production';
process.env.DEMO_AUTH = 'false';

await loadSecrets();
await run('npx', ['prisma', 'migrate', 'deploy']);
await import('../src/index.js');
