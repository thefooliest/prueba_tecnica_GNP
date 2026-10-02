# GNP Tasks API

API REST para la gestión de tareas (To-Do list) construida con **Bun**, **Hono** y **SQLite**,
con tipado estricto en TypeScript, contratos OpenAPI generados a partir de los propios esquemas
de validación y documentación interactiva (Swagger UI).

> Implementa los requisitos de `prueba-tecnica-backend.md`.

---

## 1. Instalación

Requiere [Bun](https://bun.sh) >= 1.1.

```bash
bun install
cp .env.example .env   # opcional: ajusta el token y el puerto
```

## 2. Ejecución

```bash
bun run start     # arranque normal
bun run dev       # arranque con recarga automática (--watch)
bun test          # 54 tests (bun:test)
bun run typecheck # verificación de tipos (tsc --noEmit)
bun run openapi   # genera ./openapi.json a partir de los contratos
```

Por defecto el servidor escucha en <http://localhost:3000>.

```bash
curl http://localhost:3000/health
# {"status":"ok","uptime_seconds":3.1,"database":"connected","version":"1.0.0"}
```

### Variables de entorno

| Variable         | Por defecto            | Descripción                                        |
| ---------------- | ---------------------- | -------------------------------------------------- |
| `PORT`           | `3000`                 | Puerto HTTP.                                        |
| `HOST`           | `0.0.0.0`              | Interfaz de escucha.                               |
| `DATABASE_PATH`  | `data/tasks.sqlite`    | Fichero SQLite (o `:memory:`).                     |
| `API_TOKEN`      | *(vacío)*              | Token Bearer. Si se define, `/tasks` exige `401`.  |
| `DOCS_ENABLED`   | `true`                 | Monta Swagger UI en `/docs`.                        |
| `API_VERSION`    | `1.0.0`                | Versión publicada en la documentación.              |

Bun carga `.env` automáticamente. Si `API_TOKEN` no está definido la autenticación queda
**deshabilitada** (cómodo en desarrollo, inseguro en producción).

## 3. Documentación interactiva

| Ruta            | Descripción                                    |
| --------------- | ---------------------------------------------- |
| `/docs`         | Swagger UI (botón **Authorize** para el token). |
| `/openapi.json` | Especificación OpenAPI 3.1 en JSON.             |
| `/openapi.yaml` | La misma especificación en YAML.                |

Para probar desde el explorador: pulsa **Authorize**, introduce el valor de `API_TOKEN` y
ejecuta las peticiones con *Try it out*.

> Swagger UI carga sus assets (CSS/JS) desde un CDN, por lo que `/docs` necesita salida a
> internet. La especificación `/openapi.json` y `/openapi.yaml` se sirven siempre desde el
> propio servidor.

## 4. Endpoints

Todos los endpoints de `/tasks` requieren `Authorization: Bearer <API_TOKEN>`.

| Método   | Ruta           | Descripción                                         |
| -------- | -------------- | --------------------------------------------------- |
| `GET`    | `/tasks`       | Lista tareas. Filtro opcional `?completed=true\|false`. |
| `POST`   | `/tasks`       | Crea una tarea. Responde `201`.                      |
| `GET`    | `/tasks/{id}`  | Detalle de una tarea o `404`.                        |
| `PATCH`  | `/tasks/{id}`  | Actualización parcial (sólo los campos enviados).    |
| `PUT`    | `/tasks/{id}`  | Reemplazo total (`title` obligatorio).               |
| `DELETE` | `/tasks/{id}`  | Elimina la tarea y confirma.                         |
| `GET`    | `/health`      | Estado del servicio y de la base de datos (público).|

### Ejemplos

```bash
TOKEN=cambia-este-token
BASE=http://localhost:3000
AUTH="Authorization: Bearer $TOKEN"

# Crear (201)
curl -X POST $BASE/tasks -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"Implementar la API","description":"Endpoints CRUD"}'

# Listar y filtrar
curl "$BASE/tasks" -H "$AUTH"
curl "$BASE/tasks?completed=false" -H "$AUTH"

# Actualizar parcialmente (sólo completed cambia)
curl -X PATCH $BASE/tasks/1 -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"completed":true}'

# Eliminar la descripción con description: null
curl -X PATCH $BASE/tasks/1 -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"description":null}'

# Eliminar
curl -X DELETE $BASE/tasks/1 -H "$AUTH"
# {"data":{"id":1,"deleted":true}}
```

### Formato de error

Todas las respuestas de error comparten el mismo contrato:

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",          // código estable: VALIDATION_ERROR, UNAUTHORIZED,
    "message": "La petición no es válida.",
    "details": [                          // opcional, sólo en errores de validación
      { "path": "title", "message": "El título debe tener al menos 3 caracteres.", "code": "too_small" }
    ]
  }
}
```

| Código                | HTTP | Cuándo ocurre                                   |
| --------------------- | ---- | ----------------------------------------------- |
| `VALIDATION_ERROR`    | 400  | Fallo de esquema (body, path params o query).   |
| `UNAUTHORIZED`        | 401  | Token Bearer ausente o incorrecto.              |
| `TASK_NOT_FOUND`      | 404  | La tarea no existe.                             |
| `NOT_FOUND`           | 404  | El endpoint no existe.                          |
| `INTERNAL_ERROR`      | 500  | Error no controlado.                            |

## 5. Arquitectura

Arquitectura por capas: cada una depende sólo de la anterior (y el `composition root` inyecta
las dependencias, lo que permite testear sin servidor ni ficheros reales).

```
src/
├── index.ts                  Arranque del servidor (Bun.serve, señales, shutdown)
├── app.ts                    Composition root: conecta config + db + rutas + docs
├── config/env.ts             Configuración tipada desde variables de entorno
├── core/
│   ├── errors.ts             Errores de dominio (AppError, NotFound, 401…)
│   └── http-errors.ts        Traducción de errores → respuestas JSON estándar
├── db/
│   ├── client.ts             Conexión SQLite (WAL, foreign_keys, busy_timeout)
│   └── migrations.ts         Migraciones versionadas con PRAGMA user_version
├── docs/openapi.ts           Esquema de seguridad + /openapi.json, /openapi.yaml, /docs
├── middlewares/auth.ts       Autenticación Bearer (comparación en tiempo constante)
├── modules/tasks/
│   ├── task.types.ts         Entidad y tipos de persistencia
│   ├── task.schemas.ts       Esquemas Zod = validación + contrato OpenAPI
│   ├── task.repository.ts    Acceso a datos (prepared statements)
│   ├── task.service.ts       Lógica de negocio y normalización
│   └── task.routes.ts        Rutas HTTP tipadas de extremo a extremo
└── routes/health.routes.ts   Endpoint de salud

tests/
├── helpers.ts                Utilidades (app en memoria + token de pruebas)
├── tasks.test.ts             Tests HTTP end-to-end del CRUD, auth y docs
└── unit.test.ts              Tests del repositorio, servicio, migraciones y auth
```

### Decisiones de diseño

- **Contratos único**: cada esquema Zod (`task.schemas.ts`) valida la petición en runtime *y*
  genera la especificación OpenAPI. No existe documentación que pueda quedar desactualizada:
  el tipo de la respuesta del handler es el mismo que declara el contrato.
- **Sin ORM**: consultas con *prepared statements* (`?1`, `?2`…), por lo que la entrada del
  usuario nunca se concatena en el SQL. `task.repository.ts` es el único fichero que conoce SQL.
- **Migraciones automáticas**: versionadas con `PRAGMA user_version` y aplicadas en una
  transacción al arrancar el servidor; son idempotentes (`CREATE TABLE IF NOT EXISTS`).
- **Errores uniformes**: el servicio lanza errores de dominio (`TaskNotFoundError`) y un único
  `onError` los traduce al contrato JSON. Las rutas nunca construyen errores a mano.
- **Autenticación**: middleware sobre `/tasks` y `/tasks/*` con comparación en tiempo constante
  (SHA-256 + `timingSafeEqual`), para no filtrar el token por tiempos de respuesta.
- **Tipado estricto**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitReturns`, `verbatimModuleSyntax` y `noUnusedLocals` activos.

### Modelo de datos

```sql
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  description TEXT,
  completed   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at  TEXT    NOT NULL,   -- ISO-8601 UTC
  updated_at  TEXT    NOT NULL    -- ISO-8601 UTC
);
```

Reglas de validación: `title` obligatorio de 3 a 120 caracteres (se normaliza con `trim`),
`description` opcional hasta 1000 caracteres (`null` o vacío ⇒ sin descripción),
`completed` booleano estricto y `id` entero positivo.

## 6. Pruebas

```bash
bun test
```

```
54 pass
0 fail
114 expect() calls
```

Los tests HTTP usan `app.request()` con una base de datos **en memoria**, por lo que no tocan
`data/tasks.sqlite`. Cubren: creación (incluidos casos inválidos, JSON mal formado y
content-type incorrecto), listado y filtrado, detalle, `404`, `PATCH`/`PUT`/`DELETE`, persistencia
real en SQLite, resistencia a inyección SQL (`Robert'); DROP TABLE tasks; --`), autenticación (401)
y exposición de la documentación.

## 7. Exponer para prueba (opcional)

```bash
ngrok http 3000
# o
cloudflared tunnel --url http://localhost:3000
```

## 8. Stack

| Pieza                     | Versión / detalle                              |
| ------------------------- | ---------------------------------------------- |
| Runtime                    | Bun 1.4 (`bun:sqlite`, `Bun.serve`)           |
| Framework HTTP             | Hono 4                                         |
| Contratos / validación     | `@hono/zod-openapi` + Zod 4                    |
| Documentación              | OpenAPI 3.1 + `@hono/swagger-ui`               |
| Persistencia               | SQLite (archivo local, sin ORM)                |
| Tipado                     | TypeScript estricto                            |
| Tests                      | `bun:test`                                     |