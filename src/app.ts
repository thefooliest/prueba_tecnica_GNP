/**
 * Composition root: construye la aplicación (rutas + middleware + docs) a partir de
 * configuración y dependencias inyectadas, lo que permite testearla sin levantar el
 * servidor y sin tocar la base de datos real.
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Database } from 'bun:sqlite';
import type { AppConfig } from './config/env.ts';
import { buildErrorBody, createErrorHandler, jsonWithError, zodIssuesToDetails } from './core/http-errors.ts';
import { ValidationError } from './core/errors.ts';
import { createBearerAuth } from './middlewares/auth.ts';
import { createDatabase, type DatabaseHandle } from './db/client.ts';
import { runMigrations } from './db/migrations.ts';
import { TaskRepository } from './modules/tasks/task.repository.ts';
import { TaskService } from './modules/tasks/task.service.ts';
import { registerTaskRoutes } from './modules/tasks/task.routes.ts';
import { registerHealthRoutes } from './routes/health.routes.ts';
import { registerDocs } from './docs/openapi.ts';

export interface CreateAppOptions {
  readonly config: AppConfig;
  /** Permite inyectar una base de datos concreta (tests en memoria). */
  readonly db?: DatabaseHandle;
  /** Silencia el log de errores inesperados y de migraciones (tests). */
  readonly logErrors?: boolean;
}

export interface AppInstance {
  readonly app: OpenAPIHono;
  readonly db: DatabaseHandle;
  readonly taskService: TaskService;
}

export function createApp({ config, db, logErrors = true }: CreateAppOptions): AppInstance {
  const database: Database = db ?? createDatabase(config.databasePath);
  runMigrations(database, { silent: !logErrors });

  const repository = new TaskRepository(database);
  const taskService = new TaskService(repository);

  const app = new OpenAPIHono({
    // Los fallos de validación de esquema se lanzan como errores de dominio,
    // de modo que la respuesta de error es siempre la misma.
    defaultHook: (result) => {
      if (result.success) return undefined;
      throw new ValidationError('La petición no es válida.', zodIssuesToDetails(result.error));
    },
  });

  registerDocs(app, { config });

  const auth = createBearerAuth({ token: config.apiToken });

  app.use('/tasks', auth);
  app.use('/tasks/*', auth);

  app.onError(createErrorHandler(logErrors));

  app.notFound((c) => {
    const { pathname } = new URL(c.req.url);
    return jsonWithError(
      c,
      404,
      buildErrorBody('NOT_FOUND', `No existe el endpoint ${c.req.method} ${pathname}.`),
    );
  });

  registerHealthRoutes(app, { db: database, version: config.version, startedAt: Date.now() });
  registerTaskRoutes(app, { service: taskService });

  return { app, db: database, taskService };
}