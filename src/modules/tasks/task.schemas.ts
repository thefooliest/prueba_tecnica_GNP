/**
 * Esquemas Zod: son a la vez el contrato de validación en runtime y la fuente de verdad
 * para generar la especificación OpenAPI (y por tanto Swagger UI).
 *
 * Reglas de negocio validadas aquí:
 *  - `title`: obligatorio, 3..120 caracteres tras normalizar espacios.
 *  - `description`: opcional, hasta 1000 caracteres, `null` significa "sin descripción".
 *  - `completed`: booleano estricto (sólo `true`/`false`).
 *  - `id`: entero positivo.
 *  - marcas de tiempo: `date-time` ISO-8601 en UTC.
 */
import { z } from '@hono/zod-openapi';

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 1000;

/* -------------------------------------------------------------------------- */
/*                              Esquemas de error                             */
/* -------------------------------------------------------------------------- */

/** Detalle individual de un fallo de validación. */
export const ErrorDetailSchema = z
  .object({
    path: z.string().meta({ example: 'title', description: 'Ruta del campo con error' }),
    message: z.string().meta({ example: 'Too small: expected string to have >=3 characters' }),
    code: z.string().optional().meta({ example: 'too_small' }),
  })
  .meta({ id: 'ErrorDetail' });

/** Respuesta de error estándar de la API. */
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string().meta({
        example: 'VALIDATION_ERROR',
        description: 'Código de error estable para consumo programático',
      }),
      message: z.string().meta({ example: 'La petición no es válida.' }),
      details: z.array(ErrorDetailSchema).optional().meta({
        description: 'Detalle de los errores de validación (presente en errores de esquema)',
      }),
    }),
  })
  .meta({ id: 'ErrorResponse' });

/* -------------------------------------------------------------------------- */
/*                                Esquemas Task                               */
/* -------------------------------------------------------------------------- */

/** Tarea completa tal como se devuelve en las respuestas. */
export const TaskSchema = z
  .object({
    id: z
      .number()
      .int()
      .positive()
      .meta({ example: 1, description: 'Identificador único autoincremental' }),
    title: z.string().min(TITLE_MIN_LENGTH).max(TITLE_MAX_LENGTH).meta({
      example: 'Implementar la API de tareas',
      description: 'Título de la tarea (obligatorio)',
    }),
    description: z
      .string()
      .max(DESCRIPTION_MAX_LENGTH)
      .nullable()
      .meta({ example: 'Crear los endpoints CRUD sobre SQLite', description: 'Descripción opcional' }),
    completed: z.boolean().meta({ example: false, description: 'Estado de la tarea' }),
    created_at: z.iso.datetime({ offset: true }).meta({
      example: '2026-10-02T15:04:05.000Z',
      description: 'Marca de tiempo de creación (ISO-8601, UTC)',
    }),
    updated_at: z.iso.datetime({ offset: true }).meta({
      example: '2026-10-02T15:04:05.000Z',
      description: 'Marca de tiempo de última actualización (ISO-8601, UTC)',
    }),
  })
  .meta({ id: 'Task' });

/** Cuerpo de `POST /tasks`. */
export const CreateTaskRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(TITLE_MIN_LENGTH, 'El título debe tener al menos 3 caracteres.')
      .max(TITLE_MAX_LENGTH, 'El título no puede superar los 120 caracteres.')
      .meta({ example: 'Implementar la API de tareas' }),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX_LENGTH, 'La descripción no puede superar los 1000 caracteres.')
      .nullable()
      .optional()
      .meta({ example: 'Crear los endpoints CRUD sobre SQLite' }),
    completed: z
      .boolean()
      .optional()
      .default(false)
      .meta({ example: false, description: 'Opcional; por defecto false' }),
  })
  .meta({ id: 'CreateTaskRequest' });

/** Cuerpo de `PATCH /tasks/{id}`: actualización parcial (al menos un campo). */
export const UpdateTaskRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(TITLE_MIN_LENGTH, 'El título debe tener al menos 3 caracteres.')
      .max(TITLE_MAX_LENGTH, 'El título no puede superar los 120 caracteres.')
      .optional()
      .meta({ example: 'API de tareas documentada con OpenAPI' }),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX_LENGTH, 'La descripción no puede superar los 1000 caracteres.')
      .nullable()
      .optional()
      .meta({
        example: 'Enviar null para eliminar la descripción',
        description: 'Ausente = no modificar; null = eliminar la descripción',
      }),
    completed: z.boolean().optional().meta({ example: true }),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviarse al menos un campo para actualizar la tarea.',
  })
  .meta({ id: 'UpdateTaskRequest' });

/** Cuerpo de `PUT /tasks/{id}`: reemplazo total (título obligatorio). */
export const ReplaceTaskRequestSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(TITLE_MIN_LENGTH, 'El título debe tener al menos 3 caracteres.')
      .max(TITLE_MAX_LENGTH, 'El título no puede superar los 120 caracteres.')
      .meta({ example: 'Reemplazar la tarea' }),
    description: z
      .string()
      .trim()
      .max(DESCRIPTION_MAX_LENGTH, 'La descripción no puede superar los 1000 caracteres.')
      .nullable()
      .optional()
      .meta({ example: null }),
    completed: z.boolean().optional().default(false).meta({ example: false }),
  })
  .meta({ id: 'ReplaceTaskRequest' });

/** Parámetros de ruta `/tasks/{id}`. */
export const TaskIdParamSchema = z
  .object({
    id: z.coerce
      .number()
      .int('El id debe ser un número entero.')
      .positive('El id debe ser un número positivo.')
      .meta({ example: 1, param: { name: 'id', in: 'path' }, description: 'Identificador de la tarea' }),
  })
  .meta({ id: 'TaskIdParams' });

/** Parámetros de query de `GET /tasks`. */
export const ListTasksQuerySchema = z
  .object({
    completed: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional()
      .meta({
        example: 'false',
        description: 'Filtra por estado. Si se omite devuelve todas las tareas.',
        param: { name: 'completed', in: 'query' },
      }),
  })
  .meta({ id: 'ListTasksQuery' });

/* -------------------------------------------------------------------------- */
/*                            Esquemas de respuesta                          */
/* -------------------------------------------------------------------------- */

/** Respuesta de `GET /tasks`. */
export const TaskListResponseSchema = z
  .object({
    data: z.array(TaskSchema).meta({
      example: [
        {
          id: 1,
          title: 'Implementar la API de tareas',
          description: 'Crear los endpoints CRUD sobre SQLite',
          completed: false,
          created_at: '2026-10-02T15:04:05.000Z',
          updated_at: '2026-10-02T15:04:05.000Z',
        },
      ],
    }),
    meta: z.object({
      total: z.number().int().nonnegative().meta({ example: 1, description: 'Número de tareas devueltas' }),
      filtered_by: z
        .enum(['all', 'completed', 'pending'])
        .meta({ example: 'all', description: 'Filtro aplicado a la consulta' }),
    }),
  })
  .meta({ id: 'TaskListResponse' });

/** Respuesta de `DELETE /tasks/{id}`. */
export const DeleteTaskResponseSchema = z
  .object({
    data: z.object({
      id: z.number().int().positive().meta({ example: 1 }),
      deleted: z.literal(true).meta({ example: true }),
    }),
  })
  .meta({ id: 'DeleteTaskResponse' });

/** Respuesta de los endpoints auxiliares (`GET /health`). */
export const HealthResponseSchema = z
  .object({
    status: z.enum(['ok', 'error']).meta({ example: 'ok' }),
    uptime_seconds: z.number().nonnegative().meta({ example: 12.34 }),
    database: z.enum(['connected', 'disconnected']).meta({ example: 'connected' }),
    version: z.string().meta({ example: '1.0.0' }),
  })
  .meta({ id: 'HealthResponse' });

/* -------------------------------------------------------------------------- */
/*                              Esquemas de auth                              */
/* -------------------------------------------------------------------------- */

export const BearerAuthSchema = z
  .object({
    type: z.literal('http').meta({ example: 'http' }),
    scheme: z.literal('bearer').meta({ example: 'bearer' }),
    bearerFormat: z.string().optional().meta({ example: 'Bearer' }),
  })
  .meta({ id: 'BearerAuth' });