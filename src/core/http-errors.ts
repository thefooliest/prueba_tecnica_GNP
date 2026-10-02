/**
 * Traducción de errores a respuestas HTTP.
 * Cualquier error lanzado en la aplicación (validación, 404, 401, etc.) se convierte
 * en el mismo contrato JSON: `{ "error": { "code", "message", "details"? } }`.
 */
import type { Context, ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { AppError, type ErrorCode, type ErrorDetail } from './errors.ts';

type MappableStatus = 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 500;

export interface ErrorBody {
  readonly error: {
    readonly code: ErrorCode | string;
    readonly message: string;
    readonly details?: readonly ErrorDetail[];
  };
}

/** Convierte los issues de Zod en el formato estándar de detalle de error. */
export function zodIssuesToDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length === 0 ? '(root)' : issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/** Construye el cuerpo de error estándar de la API. */
export function buildErrorBody(
  code: ErrorCode | string,
  message: string,
  details?: readonly ErrorDetail[],
): ErrorBody {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}

/** Serializa un cuerpo de error con un status literal (TypeScript sólo acepta literales conocidos). */
export function jsonWithError(c: Context, status: MappableStatus, body: ErrorBody): Response {
  switch (status) {
    case 400:
      return c.json(body, 400);
    case 401:
      return c.json(body, 401);
    case 403:
      return c.json(body, 403);
    case 404:
      return c.json(body, 404);
    case 409:
      return c.json(body, 409);
    case 413:
      return c.json(body, 413);
    case 415:
      return c.json(body, 415);
    case 422:
      return c.json(body, 422);
    case 500:
      return c.json(body, 500);
  }
}

/** Traduce un status arbitrario al subconjunto de códigos que la API puede emitir. */
function toMappableStatus(status: number): MappableStatus {
  switch (status) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 409:
    case 413:
    case 415:
    case 422:
      return status;
    default:
      return 500;
  }
}

/** Elige el código de error de negocio a partir del status HTTP. */
function codeForStatus(status: MappableStatus): ErrorCode {
  switch (status) {
    case 400:
    case 413:
    case 415:
    case 422:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    default:
      return 'INTERNAL_ERROR';
  }
}

export function createErrorHandler(logErrors: boolean): ErrorHandler {
  return (error, c) => {
    if (error instanceof AppError) {
      return jsonWithError(
        c,
        toMappableStatus(error.status),
        buildErrorBody(error.code, error.message, error.details),
      );
    }

    if (error instanceof ZodError) {
      return jsonWithError(
        c,
        400,
        buildErrorBody('VALIDATION_ERROR', 'La petición no es válida.', zodIssuesToDetails(error)),
      );
    }

    // Errores generados por el propio Hono (JSON mal formado, content-type no soportado, etc.).
    if (error instanceof HTTPException) {
      const status = toMappableStatus(error.status);
      return jsonWithError(c, status, buildErrorBody(codeForStatus(status), error.message));
    }

    if (logErrors) {
      console.error('[error]', error);
    }

    return jsonWithError(c, 500, buildErrorBody('INTERNAL_ERROR', 'Error interno del servidor.'));
  };
}