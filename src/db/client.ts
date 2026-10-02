/**
 * Capa de acceso a datos: conexión a SQLite.
 *
 * Se usa el driver nativo de Bun (`bun:sqlite`) por ser síncrono, rápido y sin dependencias
 * externas. Todas las consultas de la aplicación se ejecutan como *prepared statements*
 * para evitar inyecciones SQL.
 */
import { Database } from 'bun:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

export type DatabaseHandle = Database;

/**
 * Abre una conexión a la base de datos, creando el fichero (y su directorio) si hace falta.
 * Acepta `:memory:` para bases de datos efímeras (tests).
 */
export function createDatabase(databasePath: string): DatabaseHandle {
  const isInMemory = databasePath === ':memory:' || databasePath.startsWith('file::memory:');
  const isFileUrl = databasePath.startsWith('file:');

  if (!isInMemory && !isFileUrl) {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const db = new Database(databasePath, { create: true, readwrite: !isInMemory });

  // PRAGMAs recomendados para un servidor de un solo proceso con lecturas concurrentes.
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  return db;
}