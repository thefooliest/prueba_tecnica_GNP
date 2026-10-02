/**
 * Middleware de autenticación por token Bearer.
 *
 * - Lee la cabecera `Authorization: Bearer <token>`.
 * - Compara el token en tiempo constante (SHA-256 + `timingSafeEqual`) para no filtrar
 *   información por tiempos de respuesta.
 * - Responde `401` con el esquema de error estándar cuando falta o no coincide.
 * - Si la aplicación se configura sin `API_TOKEN`, la autenticación queda deshabilitada
 *   y el middleware deja pasar todas las peticiones (útil en desarrollo).
 */
import { createMiddleware } from 'hono/factory';
import { timingSafeEqual, createHash } from 'node:crypto';
import { UnauthorizedError } from '../core/errors.ts';

export interface BearerAuthOptions {
  /** Token esperado. Si es `undefined` el middleware es un no-op. */
  readonly token: string | undefined;
}

/** Comparación en tiempo constante de dos cadenas arbitrarias. */
function safeCompare(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(digestA, digestB);
}

/** Extrae el token de una cabecera `Authorization` con esquema Bearer. */
export function extractBearerToken(headerValue: string | undefined): string | null {
  if (headerValue === undefined) return null;
  const [scheme, ...rest] = headerValue.trim().split(/\s+/);
  if (scheme === undefined || scheme.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token === '' ? null : token;
}

export function createBearerAuth({ token }: BearerAuthOptions) {
  return createMiddleware(async (c, next) => {
    if (token === undefined) {
      await next();
      return;
    }

    const provided = extractBearerToken(c.req.header('Authorization'));
    if (provided === null || !safeCompare(provided, token)) {
      throw new UnauthorizedError();
    }

    await next();
  });
}