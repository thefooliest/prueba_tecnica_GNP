/**
 * Configuración de la documentación interactiva (OpenAPI 3.1 + Swagger UI).
 */
import { swaggerUI } from '@hono/swagger-ui';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppConfig } from '../config/env.ts';

export const OPENAPI_JSON_PATH = '/openapi.json';
export const OPENAPI_YAML_PATH = '/openapi.yaml';
export const SWAGGER_UI_PATH = '/docs';

export interface DocsOptions {
  readonly config: AppConfig;
  /** Descripción mostrada en la UI. */
  readonly description?: string;
}

/**
 * Registra el esquema de seguridad `bearerAuth` y monta:
 *  - `GET /openapi.json` y `GET /openapi.yaml`: especificación.
 *  - `GET /docs`: interfaz Swagger UI con botón "Authorize" para el token.
 */
export function registerDocs(app: OpenAPIHono, { config, description }: DocsOptions): void {
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'Bearer',
    description:
      'Token de acceso. Envíalo en la cabecera `Authorization: Bearer <API_TOKEN>` o pulsa "Authorize" en Swagger UI.',
  });

  const document = {
    openapi: '3.1.0',
    info: {
      title: 'GNP Tasks API',
      version: config.version,
      description:
        description ??
        [
          'API REST para la gestión de tareas (To-Do list).',
          '',
          '- Persistencia en SQLite (archivo local) con migraciones automáticas.',
          '- Contratos tipados: los esquemas Zod validan la entrada y generan este documento OpenAPI.',
          '- Autenticación por token Bearer en las rutas `/tasks`.',
        ].join('\n'),
      license: { name: 'MIT' },
    },
    servers: [{ url: '/', description: 'Servidor local' }],
    tags: [
      { name: 'Tasks', description: 'Operaciones CRUD sobre tareas' },
      { name: 'System', description: 'Utilidades del servicio' },
    ],
    ...(config.apiToken === undefined ? {} : { security: [{ bearerAuth: [] }] }),
  };

  app.doc31(OPENAPI_JSON_PATH, document);

  // La misma especificación en YAML. Se genera en cada petición para incluir
  // todas las rutas registradas (las de /tasks se añaden después de esta llamada).
  app.get(OPENAPI_YAML_PATH, (c) =>
    c.text(Bun.YAML.stringify(app.getOpenAPI31Document(document)), 200, {
      'Content-Type': 'application/yaml; charset=utf-8',
    }),
  );

  if (config.docsEnabled) {
    app.get(
      SWAGGER_UI_PATH,
      swaggerUI({
        url: OPENAPI_JSON_PATH,
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        docExpansion: 'list',
      }),
    );
  }
}