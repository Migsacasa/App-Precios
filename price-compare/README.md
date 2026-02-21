# Retail Evaluator — Price Compare

A Next.js 16 + Prisma + OpenAI application for field retail evaluation, pricing intelligence, and store scoring.

## Getting Started

```bash
npm install
npx prisma migrate deploy   # apply database migrations
npx prisma db seed           # seed default settings
npm run dev                  # start at http://localhost:3000
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite connection string (default: `file:./dev.db`) |
| `NEXTAUTH_SECRET` | JWT secret for next-auth |
| `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `OPENAI_API_KEY` | OpenAI API key for AI photo evaluation |

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (React 19, TypeScript 5) |
| Database | SQLite via Prisma 7 (`better-sqlite3`) |
| Auth | next-auth 4 (JWT, `CredentialsProvider`) — roles: `FIELD`, `MANAGER`, `ADMIN` |
| AI | OpenAI Vision (`gpt-4.1-mini`) with rubric-based scoring |
| Offline | IndexedDB (`idb`) with per-item sync states + exponential backoff |
| Maps | Leaflet / react-leaflet with drilldown drawer |
| Charts | Recharts (trend, category bar) |
| PDF | pdfkit |
| PWA | Service worker with Workbox |

---

## Key Features

### AI Scoring Rubric

Each store photo evaluation produces a **0–100 score** with four sub-scores (each 0–25):

| Sub-score | What it measures |
|---|---|
| `visibility` | Brand prominence, signage, eye-level placement |
| `shelfShare` | Proportion of shelf space vs competitors |
| `placementQuality` | Planogram compliance, facing neatness |
| `availability` | Stock levels, out-of-stock detection |

**Rating thresholds** (configurable via Admin → Settings):

| Rating | Default Range |
|---|---|
| `GOOD` | ≥ 75 |
| `REGULAR` | 45–74 |
| `BAD` | < 45 |
| `NEEDS_REVIEW` | confidence < 0.35 |

The AI also returns structured `evidence` (type, detail, severity) and `recommendations` (action, priority, rationale).

### AI JSON Schema & Validation

All AI output is validated with a strict **zod schema** (`src/lib/schemas/evaluation.ts`). If validation fails, the evaluation falls back to `NEEDS_REVIEW` with a zero score, ensuring no invalid data enters the database.

### Multi-Photo Capture

Field users can upload up to **3 photos** per evaluation:
- Wide shot (store overview)
- Shelf close-up (product detail)
- Other (additional evidence)

Each photo undergoes client-side **quality checks** (resolution ≥ 640×480, brightness 40–235) and automatic **compression** before upload.

### Manager Override

Managers can override any AI rating with a required **reason**, creating a full audit trail. Overridden evaluations display the effective (override) rating throughout the app.

### Offline Sync

- Evaluations are queued in IndexedDB when offline
- Each item tracks its own `SyncState`: `pending` → `uploading` → `synced` / `failed`
- Deduplication via `clientEvaluationId` prevents duplicates on retry
- Exponential backoff with max 5 attempts

### Auto-Calculated Price Index

`priceIndex = competitorPrice / ourPrice` is auto-calculated in the capture form. Users can toggle manual override for special cases.

---

## API Routes

### Evaluations
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/observations` | List evaluations (paginated, with filters) |
| `POST` | `/api/observations` | Create evaluation (multi-photo, AI scoring) |
| `POST` | `/api/evaluations/[id]/override` | Manager override (MANAGER role) |

### Reports
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/reports/export?type=history` | CSV export — all evaluation rows |
| `GET` | `/api/reports/export?type=snapshot` | CSV export — latest per store |
| `GET` | `/api/reports/export/pdf` | PDF export with evidence & recommendations |

### Admin (ADMIN role required)
| Method | Path | Description |
|---|---|---|
| `GET/POST` | `/api/admin/settings` | Read/update app settings |
| `GET` | `/api/admin/audit-logs` | Paginated audit log viewer |
| `POST` | `/api/admin/products/import` | CSV product import with price versioning |
| `POST` | `/api/admin/retention` | Data retention cleanup |

### Other
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/map/heat` | Heatmap data with recency window |
| `GET` | `/api/stores` | Store listing |
| `POST` | `/api/ocr` | OCR processing for price capture |
| `GET` | `/api/insights` | AI-generated insights |

---

## Admin Pages

- **Admin → Products**: Inline product editor + CSV import with upsert & price history
- **Admin → Stores**: Store editor with map picker + CSV import
- **Admin → Settings**: Configurable scoring thresholds, confidence, sub-score weights, map recency, data retention — with one-click retention cleanup
- **Admin → Audit Logs**: Filterable, paginated log of all system events (creation, overrides, imports, settings changes)

---

## Dashboard Analytics

The Manager Dashboard provides:
- **6-card KPI grid**: Total evaluations, avg score, %GOOD, %BAD, needs review count, coverage (7d & 30d)
- **BAD rating drivers**: Evidence type frequency analysis with progress bars
- **Top 10 action items**: Prioritized recommendations from AI across all evaluations
- **Store table**: Rating badges, scores, evaluator info

---

## Heatmap & Drilldown

- Configurable **recency window** (default 30 days) — stale markers shown with dashed borders
- `NEEDS_REVIEW` shown in orange alongside green/yellow/red/black
- Click any marker to open a **drilldown drawer** with: photos, why bullets, evidence, recommendations, segment price indexes, and a link to full store detail

---

## Security & Governance

- **Role-based access**: `FIELD` (capture only), `MANAGER` (dashboard, override, exports), `ADMIN` (full access)
- **Audit logging**: All mutations (create, update, override, import, settings change) are recorded with timestamp, user, and metadata
- **Data retention**: Configurable auto-cleanup for old photos and evaluations
- **PII warnings**: Capture form warns if photo metadata could contain sensitive information

---

## Local API Integration

When running the local API project (`App-Precios`), its default URL is `http://localhost:3001`. Update environment config if port differs.

---

## Deploy on Vercel

The easiest way to deploy is via [Vercel](https://vercel.com/new). See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.
