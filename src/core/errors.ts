/**
 * Errores de dominio y de aplicación.
 * Cada error conoce el código HTTP y el código de negocio con el que se expone en la API.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'TASK_NOT_FOUND'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export interface ErrorDetail {
  readonly path: string;
  readonly message: string;
  readonly code?: string;
}

/** Error base de la aplicación: cualquier error conocido se traduce a una respuesta JSON estándar. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: readonly ErrorDetail[] | undefined;

  constructor(
    message: string,
    options: { status: number; code: ErrorCode; details?: readonly ErrorDetail[] | undefined; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

/** 400: el cuerpo o los parámetros de la petición no supera la validación de esquema. */
export class ValidationError extends AppError {
  constructor(message: string, details?: readonly ErrorDetail[]) {
    super(message, { status: 400, code: 'VALIDATION_ERROR', details });
  }
}

/** 401: falta el token Bearer o no es válido. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Credenciales de autenticación inválidas o ausentes.') {
    super(message, { status: 401, code: 'UNAUTHORIZED' });
  }
}

/** 404: el recurso solicitado no existe. */
export class NotFoundError extends AppError {
  constructor(message: string, code: ErrorCode = 'NOT_FOUND') {
    super(message, { status: 404, code });
  }
}

/** 404: la tarea solicitada no existe. */
export class TaskNotFoundError extends NotFoundError {
  constructor(id: number) {
    super(`La tarea con id ${id} no existe.`, 'TASK_NOT_FOUND');
  }
}