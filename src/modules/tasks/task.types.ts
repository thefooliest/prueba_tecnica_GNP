/**
 * Entidad de dominio `Task` y tipos de persistencia.
 * Los tipos de dominio usan nombres `snake_case` para reflejar exactamente el contrato HTTP.
 */

/** Tarea tal como se expone en la API. */
export interface Task {
  readonly id: number;
  readonly title: string;
  readonly description: string | null;
  readonly completed: boolean;
  /** Marca de tiempo ISO-8601 en UTC. */
  readonly created_at: string;
  /** Marca de tiempo ISO-8601 en UTC. */
  readonly updated_at: string;
}

/** Fila persistida en la tabla `tasks` (SQLite no tiene tipo booleano). */
export interface TaskRow {
  readonly id: number;
  readonly title: string;
  readonly description: string | null;
  readonly completed: 0 | 1;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Filtros disponibles al listar tareas. */
export interface TaskFilter {
  readonly completed?: boolean | undefined;
}

/** Datos necesarios para insertar una tarea. */
export interface CreateTaskData {
  readonly title: string;
  readonly description: string | null;
  readonly completed: boolean;
}

/** Actualización parcial de una tarea (`PATCH`). Los campos ausentes no se modifican. */
export interface UpdateTaskData {
  readonly title?: string | undefined;
  readonly description?: string | null | undefined;
  readonly completed?: boolean | undefined;
}