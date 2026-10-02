/**
 * Punto de entrada del servidor.
 * Carga la configuración, inicializa la base de datos (migraciones) y arranca Bun.
 */
import { loadConfig } from './config/env.ts';
import { createApp } from './app.ts';
import { OPENAPI_JSON_PATH, SWAGGER_UI_PATH } from './docs/openapi.ts';

function bootstrap(): void {
  const config = loadConfig();
  const { app, db } = createApp({ config });

  const server = Bun.serve({
    port: config.port,
    hostname: config.hostname,
    fetch: app.fetch,
  });

  const baseUrl = `http://localhost:${server.port}`;
  console.info(`[server] escuchando en ${baseUrl}`);
  console.info(`[server] base de datos: ${config.databasePath}`);
  console.info(
    `[server] autenticación: ${
      config.apiToken === undefined ? 'deshabilitada (API_TOKEN no definido)' : 'token Bearer requerido'
    }`,
  );
  if (config.docsEnabled) {
    console.info(
      `[server] documentación: ${baseUrl}${SWAGGER_UI_PATH} (OpenAPI en ${baseUrl}${OPENAPI_JSON_PATH})`,
    );
  }

  const shutdown = (signal: string): void => {
    console.info(`[server] ${signal} recibido, cerrando...`);
    server.stop(true);
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (import.meta.main) {
  bootstrap();
}

export { bootstrap };