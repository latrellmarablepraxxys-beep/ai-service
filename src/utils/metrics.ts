import {
  Counter, Gauge, Histogram, Registry, collectDefaultMetrics 
} from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: [
    'method',
    'route',
    'status'
  ],
  buckets: [
    0.1,
    0.5,
    1,
    2,
    5,
    10
  ],
  registers: [register],
});

const graphRunDuration = new Histogram({
  name: 'graph_run_duration_seconds',
  help: 'Duration of LangGraph runs in seconds',
  labelNames: [
    'graph',
    'mode'
  ],
  buckets: [
    0.5,
    1,
    2,
    5,
    10,
    30
  ],
  registers: [register],
});

const llmTokensTotal = new Counter({
  name: 'llm_tokens_total',
  help: 'Total number of LLM tokens used',
  labelNames: [
    'model',
    'type'
  ],
  registers: [register],
});

const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache'],
  registers: [register],
});

const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache'],
  registers: [register],
});

const activeSessions = new Gauge({
  name: 'active_sessions',
  help: 'Number of active SSE sessions',
  registers: [register],
});

export const metrics = Object.freeze({
  register,
  httpRequestDuration,
  graphRunDuration,
  llmTokensTotal,
  cacheHits,
  cacheMisses,
  activeSessions,
});

export const getMetrics = (): Promise<string> => register.metrics();
