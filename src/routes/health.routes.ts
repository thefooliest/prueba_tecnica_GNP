/**
 * Endpoint auxiliar de salud del servicio (no requiere autenticación).
 */
import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import type { Database } from 'bun:sqlite';
import { HealthResponseSchema } from '../modules/tasks/task.schemas.ts';

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Estado del servicio',
  description: 'Comprueba que el proceso y la base de datos están operativos.',
  operationId: 'getHealth',
  responses: {
    200: {
      description: 'Servicio operativo.',
      content: { 'application/json': { schema: HealthResponseSchema } },
    },
    500: {
      description: 'La base de datos no está disponible.',
      content: { 'application/json': { schema: HealthResponseSchema } },
    },
  },
});

export interface HealthDeps {
  readonly db: Database;
  readonly version: string;
  readonly startedAt: number;
}

/** Comprueba la conexión con SQLite ejecutando una consulta trivial. */
function isDatabaseConnected(db: Database): boolean {
  try {
    db.query<{ ok: number }, []>('SELECT 1 AS ok;').get();
    return true;
  } catch {
    return false;
  }
}

export function registerHealthRoutes(app: OpenAPIHono, { db, version, startedAt }: HealthDeps): void {
  app.openapi(healthRoute, (c) => {
    const connected = isDatabaseConnected(db);
    return c.json(
      {
        status: connected ? ('ok' as const) : ('error' as const),
        uptime_seconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
        database: connected ? ('connected' as const) : ('disconnected' as const),
        version,
      },
      connected ? 200 : 500,
    );
  });
}