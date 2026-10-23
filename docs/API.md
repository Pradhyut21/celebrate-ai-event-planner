# Planner API

The production server serves the interface and API from the same origin. Development uses the Vite `/api` proxy. No endpoint stores event records or books suppliers.

## Health

`GET /api/health` returns:

```json
{"status":"ok","aiEnabled":false,"tokenRequired":false}
```

These capability flags contain no credentials. API responses use `Cache-Control: no-store`.

## Generate a plan

`POST /api/plan`, `Content-Type: application/json`, body: an event brief. See [the runnable example](../examples/community-event.json).

```bash
curl http://127.0.0.1:3001/api/plan \
  -H "Content-Type: application/json" \
  --data-binary @examples/community-event.json
```

On Windows PowerShell, use `curl.exe` if `curl` resolves to an alias. If a server access token is configured, include `Authorization: Bearer <planner-access-token>`. The token is the application access token, never the provider key. Avoid saving real tokens in command history.

| Field | Contract |
| --- | --- |
| `name` | Required nonblank string, at most 100 characters |
| `type` | `wedding`, `birthday`, or `community` |
| `date` | Real `YYYY-MM-DD` calendar date, today or later at generation time (UTC server date) |
| `currency` | `INR`, `USD`, `EUR`, or `GBP` |
| `budget` | Greater than zero, at most 100,000,000, at most two decimal places |
| `guests` | Integer from 1 to 10,000 |
| `location` | Required nonblank string, at most 120 characters |
| `vibe` | String, at most 100 characters; default warm and welcoming |
| `priorities` | Optional; defaults to `[]`. At most eight nonblank strings of at most 60 characters |
| `accessibility`, `dietary` | Optional strings, at most 500 characters each |
| `notes` | Optional string, at most 1,000 characters |

Unknown fields and unsafe control characters are rejected. The JSON body cap is 16 KiB; compressed bodies are not accepted. Currency values are major units, e.g. `120.50`, and no currency conversion occurs.

Success is `200 {"plan": ...}`. A plan contains a summary, `budget` allocation/actual rows, dated `tasks`, supplier `vendors` with research checks and status, personalized `ideas`, planning `warnings`, and `generatedBy: "rules" | "openai"`. A provider failure still returns a complete `200` rules plan with an explicit warning; it never claims AI generation succeeded.

| Status | Meaning |
| --- | --- |
| 400 | Invalid brief, past event date or malformed JSON |
| 401 | Missing or incorrect configured bearer token |
| 403 | Browser Origin is outside the exact allowlist |
| 413 | Body exceeds 16 KiB |
| 415 | JSON media type required or compressed body rejected |
| 429 | Per-address rate limit reached; `Retry-After` supplied |
| 503 | Concurrency or rate-state capacity reached |
| 500 | Unexpected failure, with a generic safe message |

By default the server accepts 20 planning requests/minute per direct client address and at most four concurrent jobs. Limits are process-local and must be replaced with shared quotas for multi-instance deployment. `APP_ORIGIN` configures exact browser origins. Origin checking is not authentication; nonbrowser clients can omit this header.

Production HTML and static assets have a separate 300-requests/minute address limit. A 429 page response includes retry guidance and security headers. Browsing cannot consume the planning API quota, and health checks remain available when the page quota is exhausted.

The input/output TypeScript contracts live in `src/shared/schema.ts`; `tests/api.test.ts` verifies the boundary. No live provider call is required to exercise the API.
