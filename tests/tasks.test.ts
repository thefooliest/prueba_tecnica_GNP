/**
 * Tests del CRUD de tareas sobre una base de datos SQLite en memoria.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { authHeaders, buildTestApp, jsonHeaders, TEST_TOKEN, type TestContext } from './helpers.ts';

interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface ErrorBody {
  error: { code: string; message: string; details?: { path: string; message: string }[] };
}

let ctx: TestContext;

beforeEach(() => {
  ctx = buildTestApp();
});

afterEach(() => {
  ctx.close();
});

describe('POST /tasks', () => {
  test('crea una tarea y devuelve 201 con el registro completo', async () => {
    const response = await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        title: 'Implementar la API de tareas',
        description: 'Crear los endpoints CRUD',
      }),
    });

    expect(response.status).toBe(201);

    const task = (await response.json()) as Task;
    expect(task.id).toBeGreaterThan(0);
    expect(task.title).toBe('Implementar la API de tareas');
    expect(task.description).toBe('Crear los endpoints CRUD');
    expect(task.completed).toBe(false);
    expect(new Date(task.created_at).toString()).not.toBe('Invalid Date');
    expect(new Date(task.updated_at).toString()).not.toBe('Invalid Date');
  });

  test('title es obligatorio', async () => {
    const response = await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ description: 'sin título' }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.some((d) => d.path === 'title')).toBe(true);
  });

  test('rechaza títulos demasiado cortos', async () => {
    const response = await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: 'ab' }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.details?.[0]?.path).toBe('title');
  });

  test('rechaza tipos incorrectos en el cuerpo', async () => {
    const response = await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: 'título válido', completed: 'sí' }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.details?.some((d) => d.path === 'completed')).toBe(true);
  });

  test('normaliza el título y convierte descripciones vacías en null', async () => {
    const response = await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: '   Título normalizado   ', description: '   ' }),
    });

    const task = (await response.json()) as Task;
    expect(task.title).toBe('Título normalizado');
    expect(task.description).toBeNull();
  });

  test('devuelve 400 con JSON mal formado', async () => {
    const response = await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: '{esto no es json',
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('devuelve 415 si el body no es JSON', async () => {
    const response = await ctx.request('/tasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      body: 'title=sin+json',
    });

    expect(response.status).toBe(415);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /tasks', () => {
  test('devuelve una lista vacía cuando no hay tareas', async () => {
    const response = await ctx.request('/tasks', { headers: authHeaders() });

    expect(response.status).toBe(200);
    const body = await response.json() as { data: Task[]; meta: { total: number; filtered_by: string } };
    expect(body.data).toEqual([]);
    expect(body.meta).toEqual({ total: 0, filtered_by: 'all' });
  });

  test('filtra por estado con el query param completed', async () => {
    const create = (title: string, completed = false) =>
      ctx.request('/tasks', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ title, completed }),
      });

    await create('Tarea pendiente', false);
    await create('Tarea completada', true);
    await create('Otra pendiente', false);

    const pending = await ctx.json<{ data: Task[]; meta: { total: number; filtered_by: string } }>(
      '/tasks?completed=false',
      { headers: authHeaders() },
    );
    expect(pending.meta).toEqual({ total: 2, filtered_by: 'pending' });
    expect(pending.data.every((task) => task.completed === false)).toBe(true);

    const completed = await ctx.json<{ data: Task[]; meta: { total: number; filtered_by: string } }>(
      '/tasks?completed=true',
      { headers: authHeaders() },
    );
    expect(completed.meta).toEqual({ total: 1, filtered_by: 'completed' });
    expect(completed.data[0]?.title).toBe('Tarea completada');

    const all = await ctx.json<{ meta: { total: number; filtered_by: string } }>('/tasks', {
      headers: authHeaders(),
    });
    expect(all.meta.total).toBe(3);
  });

  test('rechaza un valor de completed no válido', async () => {
    const response = await ctx.request('/tasks?completed=quizá', { headers: authHeaders() });
    expect(response.status).toBe(400);
  });
});

describe('GET /tasks/{id}', () => {
  test('devuelve el detalle de la tarea', async () => {
    const created = (await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: 'Tarea de prueba' }),
    }).then((r) => r.json())) as Task;

    const response = await ctx.request(`/tasks/${created.id}`, { headers: authHeaders() });

    expect(response.status).toBe(200);
    const task = (await response.json()) as Task;
    expect(task.id).toBe(created.id);
    expect(task.title).toBe('Tarea de prueba');
  });

  test('devuelve 404 si la tarea no existe', async () => {
    const response = await ctx.request('/tasks/999', { headers: authHeaders() });

    expect(response.status).toBe(404);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe('TASK_NOT_FOUND');
  });

  test('devuelve 400 si el id no es un entero positivo', async () => {
    const response = await ctx.request('/tasks/abc', { headers: authHeaders() });
    expect(response.status).toBe(400);
  });
});

describe('PATCH /tasks/{id}', () => {
  async function createTask(): Promise<Task> {
    return (await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: 'Tarea original', description: 'Descripción original' }),
    }).then((r) => r.json())) as Task;
  }

  test('actualiza sólo los campos enviados', async () => {
    const created = await createTask();

    const response = await ctx.request(`/tasks/${created.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ completed: true }),
    });

    expect(response.status).toBe(200);
    const task = (await response.json()) as Task;
    expect(task.completed).toBe(true);
    expect(task.title).toBe('Tarea original');
    expect(task.description).toBe('Descripción original');
    expect(task.updated_at >= created.updated_at).toBe(true);
  });

  test('elimina la descripción con null', async () => {
    const created = await createTask();

    const task = (await ctx.request(`/tasks/${created.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ description: null }),
    }).then((r) => r.json())) as Task;

    expect(task.description).toBeNull();
  });

  test('rechaza un cuerpo vacío', async () => {
    const created = await createTask();

    const response = await ctx.request(`/tasks/${created.id}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  test('devuelve 404 si la tarea no existe', async () => {
    const response = await ctx.request('/tasks/999', {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ completed: true }),
    });

    expect(response.status).toBe(404);
  });
});

describe('PUT /tasks/{id}', () => {
  test('reemplaza el contenido completo de la tarea', async () => {
    const created = (await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: 'Título anterior', description: 'Descripción anterior', completed: true }),
    }).then((r) => r.json())) as Task;

    const task = (await ctx.request(`/tasks/${created.id}`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: 'Título reemplazado' }),
    }).then((r) => r.json())) as Task;

    expect(task.title).toBe('Título reemplazado');
    expect(task.description).toBeNull();
    expect(task.completed).toBe(false);
  });

  test('exige el campo title', async () => {
    const created = (await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: 'Tarea para reemplazar' }),
    }).then((r) => r.json())) as Task;

    const response = await ctx.request(`/tasks/${created.id}`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify({ description: 'sin título' }),
    });

    expect(response.status).toBe(400);
  });
});

describe('DELETE /tasks/{id}', () => {
  test('elimina la tarea y confirma', async () => {
    const created = (await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: 'Tarea a eliminar' }),
    }).then((r) => r.json())) as Task;

    const response = await ctx.request(`/tasks/${created.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { id: number; deleted: boolean } };
    expect(body.data).toEqual({ id: created.id, deleted: true });

    const afterDelete = await ctx.request(`/tasks/${created.id}`, { headers: authHeaders() });
    expect(afterDelete.status).toBe(404);
  });

  test('devuelve 404 si la tarea no existe', async () => {
    const response = await ctx.request('/tasks/999', { method: 'DELETE', headers: authHeaders() });
    expect(response.status).toBe(404);
  });
});

describe('persistencia', () => {
  test('las tareas se guardan realmente en SQLite', async () => {
    const created = (await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: 'Tarea persistida' }),
    }).then((r) => r.json())) as Task;

    const row = ctx.db.query<{ title: string; completed: number }, [number]>(
      'SELECT title, completed FROM tasks WHERE id = ?;',
    ).get(created.id);

    expect(row?.title).toBe('Tarea persistida');
    expect(row?.completed).toBe(0);
  });

  test('las consultas usan parámetros (no concatenación)', async () => {
    const response = await ctx.request('/tasks', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ title: "Robert'); DROP TABLE tasks; --" }),
    });

    expect(response.status).toBe(201);

    const tableExists = ctx.db.query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tasks';",
    ).get();

    expect(tableExists).not.toBeNull();
  });
});

describe('autenticación', () => {
  test('rechaza peticiones sin token con 401', async () => {
    const response = await ctx.request('/tasks');

    expect(response.status).toBe(401);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('rechaza un token incorrecto con 401', async () => {
    const response = await ctx.request('/tasks', {
      headers: { Authorization: `Bearer ${TEST_TOKEN}-incorrecto` },
    });

    expect(response.status).toBe(401);
  });

  test('rechaza un esquema de autorización no soportado', async () => {
    const response = await ctx.request('/tasks', {
      headers: { Authorization: `Basic ${TEST_TOKEN}` },
    });

    expect(response.status).toBe(401);
  });

  test('acepta el token correcto', async () => {
    const response = await ctx.request('/tasks', { headers: authHeaders() });
    expect(response.status).toBe(200);
  });

  test('el endpoint de salud es público', async () => {
    const response = await ctx.request('/health');
    expect(response.status).toBe(200);
  });
});

describe('sin token configurado', () => {
  test('la API funciona en modo abierto', async () => {
    const open = buildTestApp({ API_TOKEN: '' });
    try {
      const response = await open.request('/tasks');
      expect(response.status).toBe(200);
    } finally {
      open.close();
    }
  });
});

describe('documentación', () => {
  test('expone la especificación OpenAPI en JSON', async () => {
    const response = await ctx.request('/openapi.json');

    expect(response.status).toBe(200);
    const doc = (await response.json()) as {
      openapi: string;
      info: { title: string; version: string };
      paths: Record<string, unknown>;
      components: { securitySchemes?: Record<string, unknown> };
    };

    expect(doc.openapi).toStartWith('3.');
    expect(doc.info.title).toBe('GNP Tasks API');
    expect(Object.keys(doc.paths)).toContain('/tasks');
    expect(Object.keys(doc.paths)).toContain('/tasks/{id}');
    expect(doc.components.securitySchemes).toHaveProperty('bearerAuth');
  });

  test('expone la especificación en YAML', async () => {
    const response = await ctx.request('/openapi.yaml');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/yaml');
    const body = await response.text();
    expect(body).toContain('openapi:');
    expect(body).toContain('/tasks');
    expect(body).toContain('bearerAuth');
  });

  test('monta Swagger UI', async () => {
    const response = await ctx.request('/docs');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const body = await response.text();
    expect(body.toLowerCase()).toContain('swagger');
  });
});

describe('rutas inexistentes', () => {
  test('devuelve 404 con el esquema de error estándar', async () => {
    const response = await ctx.request('/no-existe', { headers: authHeaders() });

    expect(response.status).toBe(404);
    const body = (await response.json()) as ErrorBody;
    expect(body.error.code).toBe('NOT_FOUND');
  });
});