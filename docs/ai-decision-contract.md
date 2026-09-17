# AI Decision Contract

The canonical reference for the structured decision the LLM returns each turn and how the
service validates, renders, and persists it. Code: `src/services/decision/` (wire schema,
post-checks, fallback), `src/services/turn/ValidateAndApply.ts` (render + apply + persist),
`src/prompts/ResponseAgent.ts` (the prompt that teaches the model this shape).

## (a) Decision JSON shape

The model is called with `responseFormat: 'json_object'` and must return a single JSON object —
no prose, no markdown fences — in this exact **snake_case** wire shape:

```jsonc
{
  "schema_version": 1,
  "intent": "PRODUCT_PRICE_INQUIRY",
  "action": 1,                        // 1 = Respond, 2 = AskClarification, 3 = Escalate, 4 = Noop
  "confidence": 0.9,
  "language": "Tagalog",              // English | Tagalog | Taglish
  "response": {
    "message": "Eto po ang installment:\n\n{{template}}",
    "template_key": "price.installment",   // optional; must come from the catalog in (g)
    "attachments": []                      // always empty from the model — images attach server-side
  },
  "escalation": null,                 // null unless action is 3 (see field table)
  "state_transition": { "stage": 5, "set": { "product_query": "click" } },  // optional
  "memory_updates": [                 // optional
    { "op": "upsert", "key": "budget", "value": "50000", "source": "customer_stated", "confidence": 0.9 }
  ],
  "knowledge_used": [{ "key": "catalog:variant:101", "version": 1 }]        // optional
}
```

`parseAiDecisionWire` (`DecisionSchema.ts`) accepts an object or a JSON string, validates it
against the Zod wire schema (unknown keys `.strip()`ed), and maps it to the camelCase
`AiDecision` (`src/interfaces/decision.ts`). Anything off-shape is a `DECISION_PARSE_ERROR`
(502 internally — never surfaced; see (d)).

| Wire field | Internal | Required | Notes |
|---|---|---|---|
| `schema_version` | `schemaVersion` | yes, literal `1` | Version gate for future contract changes |
| `intent` | `intent` | yes | One of the 16 `AiIntent` values (`GREETING`, `PRODUCT_PRICE_INQUIRY`, `INSTALLMENT_PRICE_INQUIRY`, `CASH_PRICE_INQUIRY`, `FREEBIES_INQUIRY`, `APPLICATION_INQUIRY`, `REQUIREMENTS_INQUIRY`, `BRANCH_INQUIRY`, `FOLLOW_UP`, `RECOMMENDATION`, `SECOND_HAND_INQUIRY`, `PARTS_SERVICE_INQUIRY`, `POST_PURCHASE`, `RESTRICTED_TOPIC`, `GENERAL_INQUIRY`, `OTHER`) |
| `action` | `action` | yes | Numeric `DecisionAction` (`z.nativeEnum`): `1` Respond, `2` AskClarification, `3` Escalate, `4` Noop |
| `confidence` | `confidence` | yes | `0–1` |
| `language` | `language` | yes | `English` \| `Tagalog` \| `Taglish` |
| `response.message` | `response.message` | yes, min 1 char | The reply draft; carries `{{template}}` exactly where the server-rendered block goes for templated keys |
| `response.template_key` | `response.templateKey` | no | Must come from the catalog in (g); anything else fails at render time → fallback |
| `response.attachments` | `response.attachments` | yes (default `[]`) | Each `{ type, url, name?, purpose, reference? }`; **replaced** by pipeline-built attachments for template renders — never passed through |
| `escalation` | `escalation` | yes (`null` allowed) | Non-null only when `action` is 3: `{ topic_key, reason, department, priority: LOW\|MEDIUM\|HIGH\|URGENT, summary }` |
| `state_transition` | `stateTransition` | no | `{ stage, set? }` — `set` values limited to `string \| number \| boolean \| null`; only whitelisted keys persist (see (b)) |
| `memory_updates` | `memoryUpdates` | no | `{ op: upsert\|invalidate, key, value?, source: customer_stated\|ai_inferred, confidence }[]` — validated but NOT applied in Phase 1 (see (f)) |
| `knowledge_used` | `knowledgeUsed` | no | `{ key, version: positive int }[]` — model-declared provenance, merged with pipeline refs (see (e)) |
| `metadata` | `metadata` | no | `{ model?, prompt_key?, prompt_version?, usage { prompt_tokens, completion_tokens, total_tokens }?, latency_ms? }` — informational only |

## (b) Lifecycle

One turn through `TurnPipeline.execute` → `applyDecision`:

```text
propose (LLM json_object, or guard-built raw decision on a guard hit)
  -> parse (parseAiDecisionWire: string-or-object -> camelCase AiDecision)
  -> pre-resolve (price.* quotes resolve the catalog from merged slots; no match -> fallback)
  -> post-checks A–F (validateDecision — see (c))
  -> render (renderByTemplate: live knowledge spliced at {{template}}; unrenderable -> fallback)
  -> apply (greeting prepend on first assistant turn, except on Escalate; state merge via whitelist)
  -> persist (decision + conversation_state + assistant message [+ escalation record] + run Completed)
  -> respond (route flips to 'agent', transfer_to_agent: true exactly on Escalate)
```

- **Parse** rejects before anything else: an unparseable decision never reaches the post-checks —
  it goes straight to fallback with the parse error recorded in `validation.errors`.
- **Pre-resolve** runs between parse and post-checks so the variant/payment gates see the real
  `variantCount`: a `price.*` quote with no matching product falls back
  (`No matching product found for the price inquiry`) instead of asking clarifying questions
  about a product that does not exist.
- **State merge** uses the *post-check* decision, not the raw parse: the validator may coerce
  stage/set (guard escalation, clarification), and the persisted `data` comes from the coerced
  decision filtered through `STATE_SET_WHITELIST` (`product_id`, `product_name`, `product_query`,
  `selected_variant_id`, `variant_name`, `payment_preference`, `pending_question`,
  `escalation_topic`). Any other key the model sends is dropped.
- **Persist order** is `decisions.create` → `conversationStates.upsert` → `messages.create`
  (assistant, metadata `{ aiRunId, attachments }`) → `escalations.create` when escalated →
  `runs.update(Completed, { model, promptKey: 'response_agent', promptVersion, usage, latencyMs,
  knowledgeUsed })`. A mid-turn throw marks the run `Failed` (best-effort) and rethrows — a run
  is never `Completed` with a partial turn.

## (c) Post-check rules

`validateDecision(raw, context)` applies these in order. The `context`
(`DecisionPostCheckContext`) carries live facts the model cannot be trusted to report: `guardHit`,
`paymentPreference`, `variantCount`, `selectedVariantId`, `isFirstAssistantTurn`.

| Check | Rule |
|---|---|
| A — guard-wins | A deterministic `guardHit` with a non-matching decision **coerces** it to `Escalate`: action forced, response replaced with the topic's `fallbackTemplateKey` (message emptied — the handoff renders server-side), escalation payload rebuilt deterministically, `stateTransition` forced to `{ stage: Escalated, set: { escalation_topic } }`. A decision that already matches the guard passes through untouched. **Guard wins over the model, always.** |
| B — unknown-topic escalation | `Escalate` with **no** guard hit → fallback (`LLM escalation references an unknown topic`). The model may only escalate to a topic the guard independently matched. |
| C — payment gating | Price intent + `Respond` + `templateKey` starting with `price.` + no `paymentPreference` → `AskClarification` with `pricing.ask_payment_type` / stage `AwaitingPaymentType` (the LLM's `set` is carried over). |
| D — variant gating | Price intent + `Respond` + `variantCount > 1` + no `selectedVariantId` → `AskClarification` with `pricing.ask_variant` / stage `AwaitingVariant`. |
| E — greeting flag | Returns `greeting: true` only when `isFirstAssistantTurn === true` (the pipeline then prepends the greeting template, except on `Escalate`). |
| F — memory pruning | Drops `ai_inferred` updates below `0.7` confidence; `customer_stated` updates are always kept. The survivors stay on the decision — then are ignored per (f). |

**Ordering:** D runs before C — the pipeline resolves *which unit* the customer means before *how
they pay for it*, so the variant question wins when both answers are missing. C and D apply to
price intents with `action: Respond` only; other intents and actions pass through.

## (d) Fallback behavior

Any parse failure, unknown-topic escalation, missing product, or unrenderable template degrades
to the fallback path — a data or model outage never becomes a 500:

1. The pipeline tries the live `fallback.general` knowledge template first. When that template
   is itself unavailable, the served text is the decision's own `response.message` — which for
   parse/validator fallbacks *is* the hardcoded line below (`buildFallbackDecision`), and for
   render/catalog failures is the model's message.
2. The fallback decision is persisted with `fallback: true` and
   `validation: { valid: false, errors: [<reason>] }`; the stage stays at the incoming stage (a
   general fallback never advances the conversation).

The hardcoded message (`FALLBACK_TEMPLATE_KEY = 'fallback.general'`, confidence 0,
`GENERAL_INQUIRY`, `escalation: null`):

```text
Pasensya na po — pakiulit po ang inyong tanong, o ikokonekta ko po kayo sa aming team member na makakatulong.
```

Exception: a guard-mandated escalation survives a template outage — when the decision action is
`Escalate` and `fallback.escalation` cannot render, the wire placeholder (the Tagalog handoff
line built by the guard) is served instead of dropping the escalation.

## (e) `knowledgeUsed` Phase-1 convention

`knowledgeUsed` on the run is provenance, assembled by the pipeline — not a measurement:

- Every turn seeds `[{ key: 'escalation_topics', version: 1 }]` (live topics were consulted).
- Each rendered knowledge template appends its real `{ key, version }` from the admin row.
- Each quoted variant appends `{ key: 'catalog:variant:<id>', version: 1 }`.
- Topic refs, catalog refs, and the degraded-seed topics pin version `1` — **synthetic until
  Phase 3**. The degraded seed exposes `DEGRADED_SEED_VERSION` (currently `1`) for this purpose.
- The model's own `knowledge_used` entries ride along on the persisted decision snapshot but do
  not drive rendering; the run's list is pipeline-built.

**Phase-3 evolution:** replace the pinned `1`s with real row versions (admin `version` columns
for entries/topics, catalog revision markers for variants), so `knowledgeUsed` becomes an exact
replay pointer instead of a convention.

## (f) `memory_updates` Phase-1 status

`memory_updates` are **validated but NOT applied** (`TODO(P2)` in `ValidateAndApply.ts`): post-check
F prunes low-confidence `ai_inferred` entries, the survivors are stored on the decision snapshot
for audit, and no memory write happens. Phase 2 owns memory writes (apply surviving updates to
the per-thread memory and record a metric).

## (g) Template-key catalog

Emit `template_key` only from this list (taught by the `ResponseAgent` prompt, enforced at render
time — an unknown key fails the turn to fallback):

| `template_key` | Stage | Data source |
|---|---|---|
| `greeting.initial` | `Greeted` | Knowledge template, variable `branch_page` (code-constant default `Motorcentral Muntinlupa Page` until Phase-3 per-branch pages) |
| `greeting.initial_en` | `Greeted` | Knowledge template (English; chosen when detected language is English) |
| `pricing.ask_variant` | `AwaitingVariant` | Catalog product + knowledge template (`product_name`, server-built `variant_list`; the model names no variant itself) |
| `pricing.ask_payment_type` | `AwaitingPaymentType` | Knowledge template (no variables) |
| `price.installment` | `Quoted` | Catalog variant (`min_downpayment`, `terms`, `updated_payment_less`) rendered by `renderInstallmentBlock` and spliced at the LLM's `{{template}}` marker; attachments replaced with the variant image (`reference: { kind: 'product_variant', id }`) |
| `price.cash` | `Quoted` | Catalog variant (`cash_price`) rendered by `renderCashBlock` and spliced at `{{template}}`; same attachment replacement |
| `freebies.installment` | `FreebiesSent` | Current `installment` promotion items (`renderFreebiesList`) spliced at `{{template}}`, then the `freebies.kaibigan_merchants` template appended |
| `freebies.cash` | `FreebiesSent` | Current `cash` promotion items + merchants, same splice/append |
| `freebies.bajaj` | `FreebiesSent` | Current `bajaj` promotion items + merchants, same splice/append (brand resolved from the catalog; `BAJAJ` wins over `payment_preference`) |
| `application.jotform_link` | `ApplicationOffered` | Knowledge template (link rendered server-side; the model never types a URL) |
| `fallback.general` | — (no advance) | Knowledge template, else the hardcoded line in (d) |
| `fallback.escalation` | `Escalated` | Knowledge template (the guard's `fallbackTemplateKey`); on template outage the wire placeholder survives per (d) |

Stage assignment is deterministic (`TEMPLATE_STAGES` in `ValidateAndApply.ts`): the pipeline owns
the stage, not the LLM — the model's `state_transition.stage` is advisory. A decision with no
`template_key` keeps the incoming stage.

## (h) Intentionally NOT in the contract

- **Document-validation `analysis` (Phase 5).** There is no `analysis`, document-verdict, or
  ID/requirements-assessment field anywhere in the wire schema — requirements and accepted-ID
  answers are template/seed-driven (`ids.accepted`, `scenario.requirements_*` are
  placeholder/inactive seeds), and document validation arrives as a separate Phase-5 concern with
  its own contract. Do not add ad-hoc document fields to this schema.
- **Amounts and freebie items.** The model never types prices, terms, or freebie lists — those
  render server-side from live data. The `{{template}}` marker is the model's only formatting
  power over quoted content.
- **Attachment URLs.** The model leaves `attachments` empty; every served attachment is built by
  the pipeline from trusted catalog data.
- **Stage authority.** The model proposes; `TEMPLATE_STAGES` and the post-checks dispose.
