import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

let loaded = false;

export async function loadSecrets() {
  if (loaded) return;
  loaded = true;
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.AZURE_KEY_VAULT_URL)
    throw new Error('AZURE_KEY_VAULT_URL is required in production.');
  const client = new SecretClient(
    process.env.AZURE_KEY_VAULT_URL,
    new DefaultAzureCredential()
  );
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const optional = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_CALENDAR_ID'
  ];
  for (const name of [...required, ...optional]) {
    // Azure secret names use hyphens; process configuration uses underscores.
    try {
      const secret = await client.getSecret(name.replaceAll('_', '-'));
      if (!secret.value) throw new Error(`Empty secret ${name}`);
      process.env[name] = secret.value;
    } catch (error) {
      if (required.includes(name) || error.statusCode !== 404) throw error;
      delete process.env[name];
    }
  }
}
