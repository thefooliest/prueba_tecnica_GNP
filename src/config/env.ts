/**
 * Configuración de la aplicación.
 * Toda la configuración se obtiene de variables de entorno con valores por defecto seguros.
 */

export interface AppConfig {
  /** Puerto en el que se levanta el servidor HTTP. */
  readonly port: number;
  /** Interfaz de escucha del servidor HTTP. */
  readonly hostname: string;
  /** Ruta (o URL `file:`) de la base de datos SQLite. */
  readonly databasePath: string;
  /**
   * Token Bearer requerido por los endpoints protegidos.
   * Cuando es `undefined` la autenticación queda deshabilitada (modo desarrollo).
   */
  readonly apiToken: string | undefined;
  /** Si es `true` se monta Swagger UI en `/docs`. */
  readonly docsEnabled: boolean;
  /** Versión de la API expuesta en la documentación. */
  readonly version: string;
}

export type EnvSource = Record<string, string | undefined>;

function readString(env: EnvSource, key: string, fallback: string): string {
  const value = env[key];
  return value !== undefined && value.trim() !== '' ? value.trim() : fallback;
}

function readOptionalString(env: EnvSource, key: string): string | undefined {
  const value = env[key];
  return value !== undefined && value.trim() !== '' ? value.trim() : undefined;
}

function readBoolean(env: EnvSource, key: string, fallback: boolean): boolean {
  const value = readOptionalString(env, key);
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function readNumber(env: EnvSource, key: string, fallback: number): number {
  const value = readOptionalString(env, key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`La variable de entorno ${key} debe ser un entero no negativo. Received: ${value}`);
  }
  return parsed;
}

export function loadConfig(env: EnvSource = process.env): AppConfig {
  return {
    port: readNumber(env, 'PORT', 3000),
    hostname: readString(env, 'HOST', '0.0.0.0'),
    databasePath: readString(env, 'DATABASE_PATH', 'data/tasks.sqlite'),
    apiToken: readOptionalString(env, 'API_TOKEN'),
    docsEnabled: readBoolean(env, 'DOCS_ENABLED', true),
    version: readString(env, 'API_VERSION', '1.0.0'),
  };
}