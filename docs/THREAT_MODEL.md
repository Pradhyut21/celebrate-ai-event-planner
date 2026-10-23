# Threat model

Money validation requires an exact integer-cent round trip, so tiny positive fractions cannot bypass the positive-budget rule and produce a zero-cent plan. Vendor checklist progress is validated as a unique subset of that vendor's checklist. These contracts also apply to imported backups. Failed provider responses cancel their streamed body; the provider controller is aborted and its timer cleared on every settled path.

## Scope and assets

Celebrate AI is a personal event-planning assistant. It plans weddings, birthdays and community events; it does not process payments, book suppliers, send invitations or maintain a shared account system. Vendor names and quotes are organizer-entered planning notes. Generated category allocations are targets rather than live market quotes.

The assets are the organizer’s event details, budget, guest-support notes, supplier notes, exported backups, optional API access token and server-side model API key. Accessibility and dietary notes may be sensitive; the application does not require guest names or contact lists.

## Trust boundaries

```text
Organizer / untrusted JSON backup
             |
       React browser UI ---- browser localStorage / downloaded backup
             |
       same-origin JSON API
             |
       fixed OpenAI endpoint (only when explicitly configured)
```

The browser, its storage and uploaded backups are untrusted inputs. The optional model provider is also an untrusted content source. A model response is not authority to change budgets, deadlines, supplier status or application settings.

## Input and planning integrity

- The shared Zod schemas validate explicit field types, lengths, supported event types/currencies, real calendar dates, finite amounts, cent precision and bounded arrays. Unknown properties in event and plan objects are rejected.
- Persisted events additionally require exact cent allocation totals, unique IDs within plan collections and task dates no later than the event.
- JSON backups are limited to 2 MB and 20 events; duplicate event IDs are rejected. The whole import is validated before changing existing events. Browser edits and API results must also satisfy the stored-event schema. Allocation changes rebalance other categories atomically in cents.
- The pure planning engine allocates integer cents, reserves contingency and derives timelines from event context. Its results remain usable without a model key.
- The interface renders user and generated text as React text. Event names, notes and model content are not interpreted as HTML, scripts or executable instructions.
- CSV export quotes fields and prefixes spreadsheet formula markers, including whitespace-prefixed ones, so organizer/imported text is exported as text.

## Browser privacy

Event plans are stored in this browser’s localStorage. They are not encrypted and are available to people or software with access to the browser profile. A JSON export contains the saved event details, including the organizer’s notes and vendor entries. The organizer controls where that file is stored and shared.

Clearing browser site data removes local plans. Browser storage is not a backup service or a synchronization mechanism. The application has no account recovery, cross-device synchronization or access-control boundary between people using the same browser profile.

Unreadable saved data produces a recovery message and remains available for a raw recovery download in Settings. It is preserved until the organizer imports or makes new changes. Storage failures show an explicit instruction to keep the tab open and export a backup.

## Optional generative AI

The provider credential belongs in the server environment, never in browser code or a committed environment file. The browser sends event context to the application API; when AI is enabled, the server sends the planning context to the fixed provider endpoint. Organizers who require entirely local planning should leave the provider key unset.

AI may enrich summaries and personalized ideas. Deterministic budgets, timeline tasks and vendor checklists remain under application control. Provider errors and invalid provider output preserve a usable rules-based plan and an honest explanation of the fallback.

The server calls a fixed HTTPS provider endpoint, rejects redirects, limits a response to 64 KiB and aborts a request after 12 seconds by default. Its structured response is validated again locally. Provider output has no tool execution, network navigation, file access or booking capability. Prompt instructions help guide prose; schema validation and the absence of tools enforce the application boundary.

## Server controls

| Threat                               | Implemented boundary                                                                                                                       | Evidence                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Malformed or oversized requests      | Strict JSON, 16 KiB body cap, no compressed bodies, shared schema validation                                                               | `src/server/app.ts`, server request tests         |
| Cross-origin browser use             | Explicit Origin allowlist; no permissive CORS middleware; JSON media type required                                                         | `src/server/app.ts`                               |
| Unauthorized paid API use            | Optional bearer token; at least 16 characters; required at startup for production with a provider key; hash-based constant-time comparison | `src/server/app.ts`                               |
| Resource exhaustion                  | Per-address 20 requests/minute by default; expiring map capped at 1,000 entries; at most four concurrent planning jobs                     | `src/server/app.ts`                               |
| Static page and asset flooding       | Separate 300 requests/minute per address using express-rate-limit; expiring process-local memory store; health/API routes remain separate  | `src/server/app.ts`, static-route regression test |
| Secret or error disclosure           | Provider key remains server-side; client errors omit stack traces/provider response bodies; requests and event bodies are not logged       | `src/server/app.ts`, `src/server/provider.ts`     |
| Injected active content or embedding | Same-origin CSP with no inline scripts or objects, frame denial, no-sniff content types, restricted browser capabilities                   | `src/server/app.ts`, browser text-rendering test  |

The Origin allowlist is a browser request boundary, not authentication. Requests without an Origin header are possible outside a browser, so the bearer-token and deployment boundaries remain necessary for a network-accessible AI endpoint. Forwarded client-IP headers are not trusted.

`src/server/config.ts` rejects wildcard/malformed origins, credentials or paths in origin strings, non-HTTPS production origins outside loopback, and invalid numeric resource settings. This prevents accidental configuration from silently disabling protections. Browser API requests reject redirects and use safe, typed error messages instead of displaying response bodies. `src/client/services/planning.ts` handles deadlines and cancellation, and reducer actions preserve the latest workspace when edits/imports are queued.

## Deployment boundary and remaining limits

The default deployment is local and personal. The repository is not a multi-tenant service: there is no user database, per-account authorization, audit trail or role-based access control. A public deployment requires an appropriate authentication boundary and HTTPS. A shared server access token identifies possession of that token rather than an individual organizer.

In-memory request limits are per process. They do not coordinate across replicas, survive process restarts or replace network-level abuse controls. A reverse proxy must be configured deliberately; client-supplied forwarding headers must not be treated as trusted identity.

## Verification

The test suite exercises schema rejection and planning invariants, server request boundaries and provider failure behavior. Browser tests cover saved edits across reloads, a valid backup round trip, invalid imports, literal hostile-looking text and automated WCAG checks on desktop and mobile. Automated accessibility scans cover a subset of accessibility requirements; keyboard focus and small-screen behavior are checked separately.

See [the README](../README.md) for the exact commands and the current validation results. No production provider key or real booking is required by the test suite.
