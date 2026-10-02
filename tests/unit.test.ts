/**
 * Tests de la capa de negocio (servicio) y del repositorio, sin pasar por HTTP.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { runMigrations } from '../src/db/migrations.ts';
import { TaskRepository } from '../src/modules/tasks/task.repository.ts';
import { TaskService } from '../src/modules/tasks/task.service.ts';
import { TaskNotFoundError, ValidationError } from '../src/core/errors.ts';
import { extractBearerToken } from '../src/middlewares/auth.ts';

let db: Database;
let repository: TaskRepository;
let service: TaskService;

beforeEach(() => {
  db = new Database(':memory:');
  runMigrations(db, { silent: true });
  repository = new TaskRepository(db);
  service = new TaskService(repository);
});

afterEach(() => {
  db.close();
});

describe('TaskRepository', () => {
  test('create devuelve el id autogenerado y las marcas de tiempo', () => {
    const task = repository.create({ title: 'Tarea', description: null, completed: false });

    expect(task.id).toBe(1);
    expect(task.completed).toBe(false);
    expect(task.created_at).toBe(task.updated_at);
  });

  test('los ids son autoincrementales', () => {
    const first = repository.create({ title: 'Primera', description: null, completed: false });
    const second = repository.create({ title: 'Segunda', description: null, completed: false });

    expect(second.id).toBe(first.id + 1);
  });

  test('findById devuelve null cuando no existe', () => {
    expect(repository.findById(42)).toBeNull();
  });

  test('update construye el SET sólo con las columnas presentes', () => {
    const created = repository.create({ title: 'Original', description: 'Desc', completed: false });

    const updated = repository.update(created.id, { completed: true });

    expect(updated?.title).toBe('Original');
    expect(updated?.completed).toBe(true);
  });

  test('update sin campos no modifica la fila', () => {
    const created = repository.create({ title: 'Sin cambios', description: null, completed: false });

    expect(repository.update(created.id, {})).toEqual(created);
  });

  test('update devuelve null si la tarea no existe', () => {
    expect(repository.update(999, { completed: true })).toBeNull();
  });

  test('delete informa si la fila fue eliminada', () => {
    const created = repository.create({ title: 'A eliminar', description: null, completed: false });

    expect(repository.delete(created.id)).toBe(true);
    expect(repository.delete(created.id)).toBe(false);
  });

  test('la columna completed sólo admite 0/1', () => {
    expect(() =>
      db.run('INSERT INTO tasks (title, completed, created_at, updated_at) VALUES (?, ?, ?, ?);', [
        'Inválida',
        2,
        new Date().toISOString(),
        new Date().toISOString(),
      ]),
    ).toThrow();
  });
});

describe('TaskService', () => {
  test('create normaliza el título', () => {
    const task = service.create({ title: '   Espacios alrededor   ' });
    expect(task.title).toBe('Espacios alrededor');
  });

  test('create valida la longitud mínima del título', () => {
    expect(() => service.create({ title: '  a  ' })).toThrow(ValidationError);
  });

  test('list informa del filtro aplicado', () => {
    service.create({ title: 'Pendiente', completed: false });
    service.create({ title: 'Completada', completed: true });

    expect(service.list({ completed: false }).filteredBy).toBe('pending');
    expect(service.list({ completed: true }).filteredBy).toBe('completed');
    expect(service.list().filteredBy).toBe('all');
  });

  test('getById lanza TaskNotFoundError', () => {
    expect(() => service.getById(999)).toThrow(TaskNotFoundError);
  });

  test('update exige al menos un campo', () => {
    const created = service.create({ title: 'Tarea existente' });
    expect(() => service.update(created.id, {})).toThrow(ValidationError);
  });

  test('update conserva los campos no enviados', () => {
    const created = service.create({ title: 'Tarea', description: 'Mantener', completed: false });

    const updated = service.update(created.id, { completed: true });

    expect(updated.title).toBe('Tarea');
    expect(updated.description).toBe('Mantener');
    expect(updated.completed).toBe(true);
  });

  test('replace reinicia los campos opcionales a sus valores por defecto', () => {
    const created = service.create({ title: 'Tarea', description: 'Se reemplaza', completed: true });

    const replaced = service.replace(created.id, { title: 'Nuevo título' });

    expect(replaced.description).toBeNull();
    expect(replaced.completed).toBe(false);
  });

  test('remove lanza TaskNotFoundError si no existe', () => {
    expect(() => service.remove(999)).toThrow(TaskNotFoundError);
  });

  test('remove devuelve el id eliminado', () => {
    const created = service.create({ title: 'Tarea' });
    expect(service.remove(created.id)).toBe(created.id);
  });
});

describe('migraciones', () => {
  test('son idempotentes', () => {
    expect(() => runMigrations(db)).not.toThrow();
    const version = db.query<{ user_version: number }, []>('PRAGMA user_version;').get();
    expect(version?.user_version).toBe(1);
  });

  test('crean los índices esperados', () => {
    const indexes = db
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks';")
      .all()
      .map((row) => row.name);

    expect(indexes).toContain('idx_tasks_completed');
    expect(indexes).toContain('idx_tasks_created_at');
  });
});

describe('extractBearerToken', () => {
  test('extrae el token de una cabecera válida', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
    expect(extractBearerToken('bearer abc123')).toBe('abc123');
  });

  test('devuelve null para cabeceras inválidas', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('Basic abc123')).toBeNull();
    expect(extractBearerToken('Bearer')).toBeNull();
    expect(extractBearerToken('Bearer   ')).toBeNull();
  });
});