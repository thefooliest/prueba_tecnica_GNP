/**
 * Migraciones de esquema.
 *
 * Cada migración tiene un número de versión que se registra en `PRAGMA user_version`,
 * de modo que el esquema se inicializa/actualiza automáticamente al arrancar el servidor
 * y cada migración sólo se aplica una única vez.
 */
import type { DatabaseHandle } from './client.ts';

export interface MigrationOptions {
  /** Silencia el log de migraciones aplicadas (útil en tests). */
  readonly silent?: boolean;
}

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: (db: DatabaseHandle) => void;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'create_tasks_table',
    up: (db: DatabaseHandle): void => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          title       TEXT    NOT NULL,
          description TEXT,
          completed   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
          created_at  TEXT    NOT NULL,
          updated_at  TEXT    NOT NULL
        );
      `);

      db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks (completed);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);');
    },
  },
];

interface UserVersionRow {
  readonly user_version: number;
}

/** Aplica de forma idempotente todas las migraciones pendientes y devuelve la versión final. */
export function runMigrations(db: DatabaseHandle, options: MigrationOptions = {}): number {
  const row = db.query<UserVersionRow, []>('PRAGMA user_version;').get();
  let version = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;

    const apply = db.transaction(() => {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${migration.version};`);
    });
    apply();

    version = migration.version;
    if (options.silent !== true) {
      console.info(`[db] migración aplicada -> ${migration.version}_${migration.name}`);
    }
  }

  return version;
}