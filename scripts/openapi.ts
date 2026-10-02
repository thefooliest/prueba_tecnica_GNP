/**
 * Genera el fichero `openapi.json` a partir de los contratos de la aplicación.
 * Útil para revisión en CI, diffs y clientes generados.
 *
 *   bun run openapi          -> escribe ./openapi.json
 *   bun run openapi -- stdout-> imprime la spec por stdout
 */
import { createApp } from '../src/app.ts';
import { loadConfig } from '../src/config/env.ts';

const config = loadConfig({ DATABASE_PATH: ':memory:', DOCS_ENABLED: 'false' });
const { app } = createApp({ config, logErrors: false });
const document = app.getOpenAPI31Document({
  openapi: '3.1.0',
  info: { title: 'GNP Tasks API', version: config.version },
});

const json = `${JSON.stringify(document, null, 2)}\n`;

if (process.argv[2] === 'stdout') {
  process.stdout.write(json);
} else {
  await Bun.write('openapi.json', json);
  console.log('Especificación escrita en openapi.json');
}