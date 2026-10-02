/**
 * Utilidades compartidas por los tests: crea una aplicación aislada
 * con base de datos en memoria y token opcional.
 */
import type { Database } from 'bun:sqlite';
import { createApp } from '../src/app.ts';
import { createDatabase } from '../src/db/client.ts';
import { loadConfig } from '../src/config/env.ts';

export const TEST_TOKEN = 'test-token-123';

export interface TestContext {
  readonly request: (path: string, init?: RequestInit) => Promise<Response>;
  readonly json: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  readonly db: Database;
  readonly close: () => void;
}

export function buildTestApp(env: Record<string, string | undefined> = {}): TestContext {
  const config = loadConfig({
    DATABASE_PATH: ':memory:',
    API_TOKEN: TEST_TOKEN,
    ...env,
  });

  const db = createDatabase(':memory:');
  const { app } = createApp({ config, db, logErrors: false });

  const request = async (path: string, init: RequestInit = {}): Promise<Response> =>
    app.request(`http://localhost${path}`, init);

  return {
    request,
    json: async <T = unknown>(path: string, init: RequestInit = {}): Promise<T> => {
      const response = await request(path, init);
      return (await response.json()) as T;
    },
    db,
    close: () => db.close(),
  };
}

/** Cabeceras de autorización con el token de los tests. */
export function authHeaders(token: string = TEST_TOKEN): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/** Cabeceras JSON + autorización para peticiones con cuerpo. */
export function jsonHeaders(token: string = TEST_TOKEN): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...authHeaders(token),
  };
}