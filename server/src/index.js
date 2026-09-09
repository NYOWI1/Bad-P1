import 'dotenv/config';
import { loadSecrets } from './config/keyVault.js';
await loadSecrets();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error('JWT_SECRET must contain at least 32 characters.');
if (process.env.NODE_ENV === 'production' && process.env.DEMO_AUTH === 'true')
  throw new Error('Demo authentication must be disabled in production.');
const { db } = await import('./config/db.js');
await db.$connect();
const { app } = await import('./app.js');
const server = app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || '127.0.0.1',
  () =>
    console.log(
      `Campus API ready at http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}/project/api`
    )
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(async () => {
      await db.$disconnect();
      process.exit(0);
    })
  );
