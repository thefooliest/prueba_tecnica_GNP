/**
 * Capa de negocio (servicio de tareas).
 *
 * No conoce HTTP ni SQL: normaliza la entrada, aplica las reglas de negocio
 * y lanza errores de dominio (`TaskNotFoundError`, `ValidationError`) que la capa HTTP
 * traduce a respuestas JSON.
 */
import { TaskNotFoundError, ValidationError } from '../../core/errors.ts';
import { TaskRepository } from './task.repository.ts';
import type { Task, TaskFilter, UpdateTaskData } from './task.types.ts';

export interface CreateTaskInput {
  readonly title: string;
  readonly description?: string | null | undefined;
  readonly completed?: boolean | undefined;
}

export interface TaskListResult {
  readonly data: Task[];
  readonly total: number;
  readonly filteredBy: 'all' | 'completed' | 'pending';
}

/** Normaliza una descripción: cadena vacía o sólo espacios equivalen a `null`. */
function normalizeDescription(description: string | null | undefined): string | null {
  if (description === undefined || description === null) return null;
  const trimmed = description.trim();
  return trimmed === '' ? null : trimmed;
}

/** Normaliza y valida el título con las mismas reglas que el esquema HTTP. */
function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length < 3) {
    throw new ValidationError('El título debe tener al menos 3 caracteres.', [
      { path: 'title', message: 'Too small: expected string to have >=3 characters' },
    ]);
  }
  return trimmed;
}

export class TaskService {
  readonly #repository: TaskRepository;

  constructor(repository: TaskRepository) {
    this.#repository = repository;
  }

  /** Lista tareas con filtro opcional por estado. */
  list(filter: TaskFilter = {}): TaskListResult {
    const data = this.#repository.findAll(filter);
    return {
      data,
      total: data.length,
      filteredBy:
        filter.completed === undefined ? 'all' : filter.completed ? 'completed' : 'pending',
    };
  }

  /** Obtiene una tarea por id. Lanza `TaskNotFoundError` (404) si no existe. */
  getById(id: number): Task {
    const task = this.#repository.findById(id);
    if (task === null) throw new TaskNotFoundError(id);
    return task;
  }

  /** Crea una tarea nueva. */
  create(input: CreateTaskInput): Task {
    return this.#repository.create({
      title: normalizeTitle(input.title),
      description: normalizeDescription(input.description),
      completed: input.completed ?? false,
    });
  }

  /**
   * Actualización parcial (`PATCH`): sólo se modifican los campos presentes.
   * Un `description` ausente no se toca; `null` la elimina.
   */
  update(id: number, patch: UpdateTaskData): Task {
    const data: {
      title?: string;
      description?: string | null;
      completed?: boolean;
    } = {};

    if (patch.title !== undefined) data.title = normalizeTitle(patch.title);
    if (patch.description !== undefined) data.description = normalizeDescription(patch.description);
    if (patch.completed !== undefined) data.completed = patch.completed;

    if (Object.keys(data).length === 0) {
      throw new ValidationError('Debe enviarse al menos un campo para actualizar la tarea.');
    }

    const updated = this.#repository.update(id, data);
    if (updated === null) throw new TaskNotFoundError(id);
    return updated;
  }

  /** Reemplazo total (`PUT`): título obligatorio, el resto se sobrescribe. */
  replace(id: number, input: CreateTaskInput): Task {
    const updated = this.#repository.update(id, {
      title: normalizeTitle(input.title),
      description: normalizeDescription(input.description),
      completed: input.completed ?? false,
    });
    if (updated === null) throw new TaskNotFoundError(id);
    return updated;
  }

  /** Elimina una tarea. Lanza `TaskNotFoundError` (404) si no existe. */
  remove(id: number): number {
    const deleted = this.#repository.delete(id);
    if (!deleted) throw new TaskNotFoundError(id);
    return id;
  }
}