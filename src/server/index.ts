import path from 'node:path';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65_535)
  throw new Error('PORT must be an integer from 1 to 65535.');
const production = process.env.NODE_ENV === 'production';
const app = createApp({
  apiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
  model: process.env.OPENAI_MODEL?.trim() || undefined,
  accessToken: process.env.PLANNER_ACCESS_TOKEN?.trim() || undefined,
  allowedOrigins: process.env.APP_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  production,
  ...(production ? { staticDir: path.resolve('dist/client') } : {}),
});
const server = app.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.info(
    `Celebrate AI is listening on port ${port}. AI personalization ${process.env.OPENAI_API_KEY ? 'enabled' : 'disabled'}.`,
  );
});
server.requestTimeout = 20_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => {
      server.closeAllConnections();
      process.exit(1);
    }, 10_000).unref();
  });
}
