/**
 * Capa HTTP del recurso `tasks`: definición de rutas OpenAPI + handlers.
 * La validación (esquemas Zod) ocurre antes del handler y los tipos de la respuesta
 * están garantizados por el contrato declarado en cada ruta.
 */
import type { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute } from '@hono/zod-openapi';
import type { TaskService } from './task.service.ts';
import {
  CreateTaskRequestSchema,
  DeleteTaskResponseSchema,
  ErrorResponseSchema,
  ListTasksQuerySchema,
  ReplaceTaskRequestSchema,
  TaskIdParamSchema,
  TaskListResponseSchema,
  TaskSchema,
  UpdateTaskRequestSchema,
} from './task.schemas.ts';

const errorContent = { 'application/json': { schema: ErrorResponseSchema } } as const;

/** Respuestas de error comunes a todas las rutas del recurso. */
const errorResponses = {
  400: { description: 'Error de validación (cuerpo, path params o query).', content: errorContent },
  401: { description: 'Token Bearer ausente o inválido.', content: errorContent },
  404: { description: 'La tarea solicitada no existe.', content: errorContent },
  500: { description: 'Error interno del servidor.', content: errorContent },
} as const;

export const listTasksRoute = createRoute({
  method: 'get',
  path: '/tasks',
  tags: ['Tasks'],
  summary: 'Listar tareas',
  description:
    'Devuelve las tareas ordenadas de más reciente a más antigua. Se puede filtrar por estado con el query param `completed`.',
  operationId: 'listTasks',
  security: [{ bearerAuth: [] }],
  request: { query: ListTasksQuerySchema },
  responses: {
    200: {
      description: 'Lista de tareas (puede estar vacía).',
      content: {
        'application/json': {
          schema: TaskListResponseSchema,
          examples: {
            empty: {
              summary: 'Sin tareas',
              value: { data: [], meta: { total: 0, filtered_by: 'all' } },
            },
            pending: {
              summary: 'Sólo tareas pendientes',
              value: {
                data: [
                  {
                    id: 1,
                    title: 'Implementar la API de tareas',
                    description: 'Crear los endpoints CRUD sobre SQLite',
                    completed: false,
                    created_at: '2026-10-02T15:04:05.000Z',
                    updated_at: '2026-10-02T15:04:05.000Z',
                  },
                ],
                meta: { total: 1, filtered_by: 'pending' },
              },
            },
          },
        },
      },
    },
    ...errorResponses,
  },
});

export const getTaskRoute = createRoute({
  method: 'get',
  path: '/tasks/{id}',
  tags: ['Tasks'],
  summary: 'Obtener una tarea por id',
  description: 'Devuelve el detalle de la tarea o `404` si no existe.',
  operationId: 'getTaskById',
  security: [{ bearerAuth: [] }],
  request: { params: TaskIdParamSchema },
  responses: {
    200: {
      description: 'Detalle de la tarea.',
      content: {
        'application/json': {
          schema: TaskSchema,
          examples: {
            task: {
              summary: 'Tarea pendiente',
              value: {
                id: 1,
                title: 'Implementar la API de tareas',
                description: 'Crear los endpoints CRUD sobre SQLite',
                completed: false,
                created_at: '2026-10-02T15:04:05.000Z',
                updated_at: '2026-10-02T15:04:05.000Z',
              },
            },
          },
        },
      },
    },
    ...errorResponses,
  },
});

export const createTaskRoute = createRoute({
  method: 'post',
  path: '/tasks',
  tags: ['Tasks'],
  summary: 'Crear una tarea',
  description: 'Crea una tarea y devuelve el registro persistido con código `201`.',
  operationId: 'createTask',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: CreateTaskRequestSchema,
          examples: {
            minimal: { summary: 'Sólo el título (mínimo)', value: { title: 'Comprar pan' } },
            full: {
              summary: 'Todos los campos',
              value: {
                title: 'Implementar la API de tareas',
                description: 'Crear los endpoints CRUD sobre SQLite',
                completed: false,
              },
            },
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Tarea creada.',
      content: { 'application/json': { schema: TaskSchema } },
    },
    ...errorResponses,
  },
});

export const updateTaskRoute = createRoute({
  method: 'patch',
  path: '/tasks/{id}',
  tags: ['Tasks'],
  summary: 'Actualizar parcialmente una tarea',
  description:
    'Sólo se modifican los campos enviados. `description: null` elimina la descripción; `completed` cambia el estado de la tarea.',
  operationId: 'updateTask',
  security: [{ bearerAuth: [] }],
  request: {
    params: TaskIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: UpdateTaskRequestSchema,
          examples: {
            complete: { summary: 'Marcar como completada', value: { completed: true } },
            rename: { summary: 'Renombrar', value: { title: 'Nuevo título de la tarea' } },
            clearDescription: { summary: 'Eliminar la descripción', value: { description: null } },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Tarea actualizada.',
      content: { 'application/json': { schema: TaskSchema } },
    },
    ...errorResponses,
  },
});

export const replaceTaskRoute = createRoute({
  method: 'put',
  path: '/tasks/{id}',
  tags: ['Tasks'],
  summary: 'Reemplazar una tarea completa',
  description:
    'Reemplaza el contenido de la tarea. `title` es obligatorio y los campos opcionales ausentes vuelven a su valor por defecto.',
  operationId: 'replaceTask',
  security: [{ bearerAuth: [] }],
  request: {
    params: TaskIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: ReplaceTaskRequestSchema,
          examples: {
            replace: {
              summary: 'Reemplazo total',
              value: { title: 'Reemplazar la tarea', description: 'Nuevo contenido', completed: true },
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Tarea reemplazada.',
      content: { 'application/json': { schema: TaskSchema } },
    },
    ...errorResponses,
  },
});

export const deleteTaskRoute = createRoute({
  method: 'delete',
  path: '/tasks/{id}',
  tags: ['Tasks'],
  summary: 'Eliminar una tarea',
  operationId: 'deleteTask',
  security: [{ bearerAuth: [] }],
  request: { params: TaskIdParamSchema },
  responses: {
    200: {
      description: 'Tarea eliminada.',
      content: { 'application/json': { schema: DeleteTaskResponseSchema } },
    },
    ...errorResponses,
  },
});

export interface TaskRoutesDeps {
  readonly service: TaskService;
}

/** Registra el CRUD completo de tareas en la aplicación OpenAPI. */
export function registerTaskRoutes(app: OpenAPIHono, { service }: TaskRoutesDeps): void {
  app.openapi(listTasksRoute, (c) => {
    const { completed } = c.req.valid('query');
    const result = service.list(completed === undefined ? {} : { completed });
    return c.json(
      { data: result.data, meta: { total: result.total, filtered_by: result.filteredBy } },
      200,
    );
  });

  app.openapi(getTaskRoute, (c) => {
    const { id } = c.req.valid('param');
    return c.json(service.getById(id), 200);
  });

  app.openapi(createTaskRoute, (c) => {
    const input = c.req.valid('json');
    return c.json(service.create(input), 201);
  });

  app.openapi(updateTaskRoute, (c) => {
    const { id } = c.req.valid('param');
    const patch = c.req.valid('json');
    return c.json(service.update(id, patch), 200);
  });

  app.openapi(replaceTaskRoute, (c) => {
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    return c.json(service.replace(id, input), 200);
  });

  app.openapi(deleteTaskRoute, (c) => {
    const { id } = c.req.valid('param');
    return c.json({ data: { id: service.remove(id), deleted: true as const } }, 200);
  });
}