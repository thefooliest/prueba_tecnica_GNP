/**
 * Repositorio de tareas: única capa que conoce SQL.
 * Todas las consultas usan *prepared statements* (parámetros ligados, nunca concatenación
 * de cadenas), por lo que no es posible la inyección SQL a través de la entrada del usuario.
 */
import type { DatabaseHandle } from '../../db/client.ts';
import type {
  CreateTaskData,
  Task,
  TaskFilter,
  TaskRow,
  UpdateTaskData,
} from './task.types.ts';

const TRUE = 1;
const FALSE = 0;

function toBoolean(value: 0 | 1): boolean {
  return value === TRUE;
}

/** Convierte una fila de SQLite en la entidad de dominio. */
function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: toBoolean(row.completed),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

type SqlParams = (string | number | null)[];

export class TaskRepository {
  readonly #db: DatabaseHandle;

  constructor(db: DatabaseHandle) {
    this.#db = db;
  }

  /** Lista tareas, opcionalmente filtrando por estado y de más reciente a más antigua. */
  findAll(filter: TaskFilter = {}): Task[] {
    const rows =
      filter.completed === undefined
        ? this.#db
            .query<TaskRow, []>('SELECT * FROM tasks ORDER BY id DESC;')
            .all()
        : this.#db
            .query<TaskRow, [0 | 1]>(
              'SELECT * FROM tasks WHERE completed = ?1 ORDER BY id DESC;',
            )
            .all(filter.completed ? TRUE : FALSE);

    return rows.map(toTask);
  }

  /** Busca una tarea por su identificador. Devuelve `null` si no existe. */
  findById(id: number): Task | null {
    const row = this.#db.query<TaskRow, [number]>('SELECT * FROM tasks WHERE id = ?1;').get(id);
    return row === null ? null : toTask(row);
  }

  /** Inserta una tarea y devuelve el registro completo (incluido `id` y marcas de tiempo). */
  create(data: CreateTaskData): Task {
    const timestamp = new Date().toISOString();

    const inserted = this.#db
      .query<TaskRow, [string, string | null, 0 | 1, string, string]>(
        `INSERT INTO tasks (title, description, completed, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         RETURNING *;`,
      )
      .get(data.title, data.description, data.completed ? TRUE : FALSE, timestamp, timestamp);

    if (inserted === null) {
      throw new Error('La inserción de la tarea no devolvió ninguna fila.');
    }

    return toTask(inserted);
  }

  /**
   * Actualiza parcialmente una tarea.
   * Sólo se escriben las columnas presentes en `patch`; `updated_at` siempre se refresca.
   */
  update(id: number, patch: UpdateTaskData): Task | null {
    const assignments: string[] = [];
    const params: SqlParams = [];
    const timestamp = new Date().toISOString();

    if (patch.title !== undefined) {
      assignments.push(`title = ?${params.push(patch.title)}`);
    }
    if (patch.description !== undefined) {
      assignments.push(`description = ?${params.push(patch.description)}`);
    }
    if (patch.completed !== undefined) {
      assignments.push(`completed = ?${params.push(patch.completed ? TRUE : FALSE)}`);
    }

    if (assignments.length === 0) {
      return this.findById(id);
    }

    assignments.push(`updated_at = ?${params.push(timestamp)}`);
    params.push(id);

const updated = this.#db
      .query<TaskRow, SqlParams>(
        `UPDATE tasks SET ${assignments.join(', ')} WHERE id = ?${params.length} RETURNING *;`,
      )
      .get(...params);

    return updated === null ? null : toTask(updated);
  }

  /** Elimina una tarea. Devuelve `true` si se borró y `false` si no existía. */
  delete(id: number): boolean {
    const result = this.#db
      .query<{ id: number }, [number]>('DELETE FROM tasks WHERE id = ?1;')
      .run(id);
    return result.changes > 0;
  }
}