/**
 * Live LLM smoke test: proves chat + embeddings reach the configured provider
 * end-to-end using the real keys/base URLs from `.env`. Never prints secrets.
 *
 * LLM only — no server, no Mongo, no Redis. `console` is used deliberately
 * (this is `scripts/`, not `src/`) to keep the output compact and copy-pasteable.
 *
 * Usage:
 *   npm run llm:smoke                 # chat + embeddings
 *   npm run llm:smoke -- --chat-only  # chat only
 *   npm run llm:smoke -- --embed-only # embeddings only
 *
 * Exit codes: 0 = ok, 1 = check failed, 2 = preflight (missing key / bad args).
 */
import { aiProvider } from '../src/config/aiProviders.js';
import type { AiProvider } from '../src/interfaces/aiProvider.js';
import { createLlmProvider } from '../src/services/llm/LlmProvider.js';
import { AppError, isAppError } from '../src/utils/errors.js';

const PROVIDER_KEY_ENV: Record<AiProvider, string> = {
  openai: 'OPENAI_API_KEY',
  ollama: 'OLLAMA_API_KEY',
  novita: 'NOVITA_API_KEY',
};

const REQUEST_TIMEOUT_MS = 20_000;

/** Blank-safe: whitespace-only counts as unset. */
const isBlank = (value: string): boolean => value.trim().length === 0;

/**
 * Preset placeholder keys that are not secrets. The `ollama` preset ships
 * `apiKey: 'ollama'`; redacting it would mangle any line mentioning the provider.
 */
const SECRET_PLACEHOLDERS: ReadonlySet<string> = new Set(['ollama']);

/** Below this length a value is too short to be a real key (and too risky to blanket-redact). */
const MIN_SECRET_LENGTH = 8;

/**
 * Belt-and-braces redaction: every line printed goes through this, so a key can
 * never leak even if an upstream error happens to echo it back.
 *
 * Longest-first: if one key is a prefix/substring of another, the longer match
 * is replaced first so the shorter one cannot leave the longer key's suffix behind.
 */
const SECRETS: readonly string[] = [
  aiProvider.apiKey,
  aiProvider.embeddings.apiKey
]
  .filter(
    (secret) =>
      !isBlank(secret) &&
      secret.trim().length >= MIN_SECRET_LENGTH &&
      !SECRET_PLACEHOLDERS.has(secret.trim()),
  )
  .sort((a, b) => b.length - a.length);

const redact = (value: string): string =>
  SECRETS.reduce((out, secret) => out.split(secret).join('[redacted]'), value);

const print = (message: string): void => {
  console.log(redact(message));
};

/** Every failed check is recorded here; a non-empty list forces exit code 1. */
const failures: string[] = [];

const joinUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Hard ceiling on a single check. The LLM port has no timeout knob for `embed`
 * and the OpenAI SDK default is measured in minutes, so a hung endpoint (e.g. an
 * unreachable embeddings proxy) would otherwise stall the script forever.
 *
 * When this fires the SDK is likely still retrying underneath — the raw probe
 * printed by `reportFailure` is the authoritative diagnosis, not the wrapped error.
 */
const withTimeout = async <T>(label: string, run: Promise<T>): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new AppError(
          'LLM_TIMEOUT',
          504,
          `${label} request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        ),
      );
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      run,
      timeout
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/** First 4xx/5xx token in free text (upstream SDK error messages embed it). */
const statusFromText = (text: string): number | undefined => {
  const match = /\b([45]\d{2})\b/.exec(text);
  return match === null ? undefined : Number(match[1]);
};

/** Best-effort HTTP status from a thrown LLM/HTTP error (never the key). */
const extractStatus = (error: unknown): number | undefined => {
  const cause = isAppError(error) ? error.details?.cause : undefined;
  if (typeof cause === 'string') {
    const upstream = statusFromText(cause);
    if (upstream !== undefined) return upstream;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    for (const key of [
      'status',
      'statusCode',
      'httpStatus'
    ]) {
      const value = record[key];
      if (typeof value === 'number') return value;
    }
    const response = record.response;
    if (typeof response === 'object' && response !== null) {
      const status = (response as Record<string, unknown>).status;
      if (typeof status === 'number') return status;
    }
  }

  // AppError maps unknown failures to a generic 5xx, so only trust the wrapped
  // message when it carries an explicit upstream status.
  const message = error instanceof Error ? error.message : String(error);
  return statusFromText(message);
};

const looksLikeAuthFailure = (error: unknown): boolean => {
  const cause =
    isAppError(error) && typeof error.details?.cause === 'string' ? error.details.cause : '';
  const message = error instanceof Error ? error.message : '';
  return /unauthorized|forbidden|invalid\s+token|invalid\s+api[\s_-]?key/i.test(
    `${cause} ${message}`,
  );
};

const explainStatus = (
  code: string,
  status: number | undefined,
  authLike: boolean,
): string | undefined => {
  if (authLike || code === 'LLM_AUTHENTICATION_ERROR' || status === 401 || status === 403) {
    return 'auth failure (401/403) — the API key is missing, wrong, or for another provider';
  }
  if (code === 'LLM_TIMEOUT') {
    return `timed out after ${REQUEST_TIMEOUT_MS}ms — the endpoint hung or is retrying; see the raw probe below`;
  }
  if (code === 'LLM_NOT_FOUND' || status === 404) {
    return '404 — most likely the wrong base URL (check the OpenAI-compatible path)';
  }
  if (status === 429) {
    return '429 — rate limited or out of quota';
  }
  if (status === 400) {
    return '400 — the endpoint rejected the request (model or dimensions not supported by this endpoint)';
  }
  if (status !== undefined && status >= 500) {
    return `${status} — provider-side or proxy error`;
  }
  return undefined;
};

/** Raw probe (no SDK wrapping) so a 404/401 is reported with its exact status. */
const probe = async (
  label: string,
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<void> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    print(`[${label}] probe POST ${url} -> HTTP ${response.status}`);
    // Redact BEFORE slicing: a truncated secret is unrecoverable to redact later.
    print(`[${label}] probe body: ${redact(text).slice(0, 300)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    print(`[${label}] probe POST ${url} -> network error: ${message}`);
  }
};

const reportFailure = (
  label: string,
  error: unknown,
  probeTarget: { url: string; apiKey: string; body: Record<string, unknown> } | undefined,
): Promise<void> | void => {
  if (isAppError(error)) {
    print(`[${label}] FAILED code=${error.code} status=${error.status} message=${error.message}`);
    const cause = error.details?.cause;
    if (typeof cause === 'string' && cause.length > 0) {
      print(`[${label}] cause: ${cause}`);
    }
  } else {
    const name = error instanceof Error ? error.name : 'UnknownError';
    const message = error instanceof Error ? error.message : String(error);
    print(`[${label}] FAILED name=${name} message=${message}`);
  }

  const status = extractStatus(error);
  const code = isAppError(error) ? error.code : 'UNKNOWN';
  if (status !== undefined) print(`[${label}] httpStatus=${status}`);
  const hint = explainStatus(code, status, looksLikeAuthFailure(error));
  if (hint !== undefined) print(`[${label}] hint: ${hint}`);

  if (probeTarget !== undefined) {
    return probe(label, probeTarget.url, probeTarget.apiKey, probeTarget.body);
  }
  return undefined;
};

const runChat = async (): Promise<void> => {
  const provider = createLlmProvider(aiProvider);
  print(`[chat] provider=${aiProvider.provider} driver=${aiProvider.driver}`);
  print(`[chat] baseUrl=${aiProvider.baseUrl}`);
  print(`[chat] model=${aiProvider.models.chat}`);

  const request = {
    messages: [
      {
        role: 'user' as const,
        content: 'Reply with exactly: pong' 
      }
    ],
    // High enough that a small reasoning model is not truncated into a false
    // `finish_reason=length` failure (which the positive assertion below rejects).
    maxTokens: 32,
  };

  try {
    const response = await withTimeout('chat', provider.chat(request));
    const content = response.content.trim();
    print(`[chat] finishReason=${response.finishReason}`);
    if (response.usage !== undefined) {
      const {
        promptTokens, completionTokens, totalTokens 
      } = response.usage;
      print(
        `[chat] usage: prompt=${promptTokens} completion=${completionTokens} total=${totalTokens}`,
      );
    } else {
      print('[chat] usage: (none)');
    }
    print(`[chat] contentLength=${content.length}`);
    print(`[chat] content=${JSON.stringify(content)}`);

    // Positive assertion, mirroring the embed dimensions check.
    if (content.length === 0 || response.finishReason !== 'stop') {
      print(
        `[chat] FAIL: expected non-empty content with finishReason=stop (got length=${content.length}, finishReason=${response.finishReason})`,
      );
      failures.push('chat');
      return;
    }

    print('[chat] OK');
  } catch (error) {
    await reportFailure('chat', error, {
      url: joinUrl(aiProvider.baseUrl, '/chat/completions'),
      apiKey: aiProvider.apiKey,
      body: {
        model: aiProvider.models.chat,
        ...request
      },
    });
    failures.push('chat');
  }
};

const runEmbed = async (): Promise<void> => {
  const provider = createLlmProvider(aiProvider);
  print(`[embed] baseUrl=${aiProvider.embeddings.baseUrl}`);
  print(`[embed] model=${aiProvider.models.embedding}`);
  print(`[embed] expectedDimensions=${aiProvider.embeddings.dimensions}`);

  try {
    const vectors = await withTimeout('embed', provider.embed(['health check']));
    const first = vectors[0];
    const vectorLength = first === undefined ? 0 : first.length;
    const matches = vectorLength === aiProvider.embeddings.dimensions;
    print(`[embed] vectors=${vectors.length}`);
    print(`[embed] vectorLength=${vectorLength}`);
    print(`[embed] dimensionsMatch=${matches ? 'PASS' : 'FAIL'}`);
    if (!matches) {
      print(
        `[embed] expected ${aiProvider.embeddings.dimensions} but got ${vectorLength} — check EMBEDDING_MODEL/EMBEDDING_DIMENSIONS`,
      );
      failures.push('embed');
      return;
    }
    print('[embed] OK');
  } catch (error) {
    await reportFailure('embed', error, {
      url: joinUrl(aiProvider.embeddings.baseUrl, '/embeddings'),
      apiKey: aiProvider.embeddings.apiKey,
      body: {
        model: aiProvider.models.embedding,
        input: ['health check']
      },
    });
    failures.push('embed');
  }
};

const main = async (): Promise<void> => {
  const args = new Set(process.argv.slice(2));
  const chatOnly = args.has('--chat-only');
  const embedOnly = args.has('--embed-only');

  if (chatOnly && embedOnly) {
    print('llm-smoke: --chat-only and --embed-only are mutually exclusive');
    process.exitCode = 2;
    return;
  }

  // Preflight: fail fast, before any network call.
  if (!embedOnly && isBlank(aiProvider.apiKey)) {
    print(`${PROVIDER_KEY_ENV[aiProvider.provider]} (or the active provider key) is not set`);
    process.exitCode = 2;
    return;
  }
  if (!chatOnly && isBlank(aiProvider.embeddings.apiKey)) {
    print('EMBEDDING_API_KEY (nor the active provider key) is not set');
    process.exitCode = 2;
    return;
  }

  if (!embedOnly) await runChat();
  if (!chatOnly) await runEmbed();

  if (failures.length > 0) {
    print(`LLM smoke: FAILED (${failures.join(', ')})`);
    process.exitCode = 1;
    return;
  }

  print('LLM smoke: OK');
  process.exitCode = 0;
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  print(`llm-smoke: unexpected failure: ${message}`);
  process.exitCode = 1;
});
