let token = sessionStorage.getItem('campus-token');
export function setToken(value) {
  token = value;
  value
    ? sessionStorage.setItem('campus-token', value)
    : sessionStorage.removeItem('campus-token');
}
export const hasToken = () => !!token;
export async function api(path, options = {}) {
  const response = await fetch(`/project/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error?.message || 'The request could not be completed.'),
      { status: response.status }
    );
  return data;
}
