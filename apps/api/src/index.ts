import { configureSync, getConsoleSink, getLogger } from '@logtape/logtape';
import { Hono } from 'hono';

// LogTape, not Pino: Pino depends on Node streams and is Workers-incompatible.
configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ['api'], sinks: ['console'], lowestLevel: 'info' },
    { category: ['logtape', 'meta'], sinks: ['console'], lowestLevel: 'warning' },
  ],
});

const logger = getLogger(['api']);

const app = new Hono();

app.get('/health', (c) => {
  logger.debug('health check');
  return c.json({ ok: true });
});

// The ORPC routers (`public` and `app`) from @withme/contract are mounted here
// in deliverable steps 5–6.

export default app;
