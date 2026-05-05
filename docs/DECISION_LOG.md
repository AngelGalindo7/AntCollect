# PetrCollect — Decision Log

> Records non-obvious decisions, deferred work, and known trade-offs made during implementation.
> Format: date · area · decision · reason · follow-up needed?

---

## 2026-05-04 — JS Masonry for PostGridLayout

### Replaced CSS multi-column with shortest-column JS packer

**Decision:** `PostGridLayout` now positions items absolutely via a new `useMasonryLayout` hook (`shared/hooks/useMasonryLayout.ts`) instead of CSS `columns-N` + `break-inside-avoid`. The hook reads container width with `ResizeObserver` + a `useLayoutEffect` synchronous bootstrap, picks a column count from a breakpoints table (2 / 3 / 4 cols at 0 / 768 / 1100 px), and for each item places it in the column whose cumulative height is currently shortest.

**Why CSS multi-column was wrong for an infinite feed:** With `column-fill: auto` (the only behavior available when the container has no fixed height — which is true for an infinite-scroll feed) the engine fills column 1 top-to-bottom, then column 2, then column 3. When scroll continues and new posts append, they continue the bottom of the rightmost column rather than rebalancing. The result on a feed with mostly-uniform aspect ratios is that nearly identical posts cluster into the leftmost columns and "weird" outliers (a wide horizontal post, a tall portrait) end up isolated on the right — exactly the failure mode the user reported. Pinterest avoids this by computing placement in JS using each item's known dimensions.

**Why a custom packer over `react-masonry-css` / `masonic`:** `react-masonry-css` is a thin wrapper around the same CSS columns approach and inherits the same fill-order problem. `masonic` is a real packer but bundles virtualization and absolute-positioning conventions that don't match the existing card components without refactor. Our packer is ~30 lines, has no dependencies, and runs in O(n × cols) — fine for hundreds of items, and infinite scroll bounds total `n` per session.

**Why dimensions live in the data, not on the DOM:** `process_and_save_image` already stores `original_width` / `original_height` in `MediaAsset.json_metadata`, and the API surfaces them on `post.images[]`. Computing item heights from this data lets the layout settle on first paint without a measure → reflow cycle. `FolderCard` is `aspect-square` + a one-line label, so its height is modeled as `columnWidth + 32px`.

**Why `useLayoutEffect` for the initial measurement:** `ResizeObserver` fires asynchronously after the first paint, which would produce a one-frame flash of empty container. Reading `getBoundingClientRect()` synchronously in `useLayoutEffect` populates the width before paint, then the observer takes over for resize events.

**Why a global `ResizeObserver` + `getBoundingClientRect` mock in `test/setup.ts`:** JSDOM ships neither — `ResizeObserver` is undefined, and `getBoundingClientRect()` returns all zeros, which would make the hook produce no positions and any layout-dependent component untestable. The mock is the standard solution and lives in the shared setup file so future layout-dependent components inherit it.

**Trade-offs accepted:**
- Items reflow on container resize (responsive breakpoint crossings, sidebar toggles). Acceptable — Pinterest does the same.
- A wide horizontal image still occupies a single column; it just renders short and stubby because the column is narrow. This matches Pinterest's behavior exactly. Spanning a single item across multiple columns would require a different algorithm (interval scheduling rather than greedy column placement) and isn't implemented.
- The `MASONRY_CONFIG` breakpoints (0 / 768 / 1100) are duplicated from the previous Tailwind class set rather than read from a shared theme constant. Not worth the indirection until a second consumer needs them.

**Follow-ups:**
- If feed length grows past a few hundred per session, virtualize the absolute children (e.g., render only items whose `y` falls within `scrollTop ± viewportHeight × buffer`).
- Re-evaluate `extraHeight` for `FolderCard` if the label gains a second line or actions row.

---

## 2026-05-04 — Folder Uploads & Feed Visibility

### One folder upload = one multi-image post (max 5); folder visibility now affects the home feed

**Decision:** Folder uploads no longer split each image into its own `Post`. A single upload action via `POST /folders/{id}/upload` now creates **one** `Post` containing all uploaded images (capped at 5), linked to the folder by a single `FolderPost` row. The standalone `POST /posts/upload-post` endpoint enforces the same 5-image cap. The home feed (`/posts/top`) now consults `Folder.is_public` for the first time: a post is hidden from the feed only when **both** `Post.public IS FALSE` **and** the post is a member of at least one private folder.

**Why one-upload-one-post over per-image posts:** The previous loop in `upload_stickers_to_folder` produced N `Post` rows per upload, which (a) flooded the home feed for any user uploading a haul, and (b) made folder grids hard to scan because correlated images (e.g. a single sticker book pull) were scattered across N tiles. The data model already supported N images per post via the `PostImage` join table — the fix was a wiring change, not a schema change. Multiple posts per folder are still possible: the user simply triggers multiple uploads.

**Why a hard 5-image cap:** Posts with very large image counts degrade the feed and detail-modal experience (carousel performance, visual load, ranking dilution). Five comfortably covers the realistic "stickers I picked up today" haul without giving any single post outsized weight in `/posts/top`. Enforced at both upload paths so the rule cannot be bypassed.

**Why the feed-visibility rule is `post.public IS FALSE AND in_private_folder` (AND, not OR):** This was the user's deliberate choice over the stricter "hide if any parent folder is private" alternative. The reasoning: visibility decisions should require an **explicit** opt-in on both axes — a private folder alone shouldn't silently demote a post the user marked as public, and a non-public post in a public folder is also assumed-intentional. The author of an explicitly-public post wins. The cost is that a post left at `public=false` (the rare case today, since there is no UI to toggle it) shows on the feed if every parent folder is public; the user accepted this trade-off.

**Why the rule lives in the ranking subquery, not the outer query:** The feed query computes `engagement_count` as a `GROUP BY` aggregate inside `ranking_subquery`. The visibility predicate must apply *before* the `LIMIT + 1` slice or we'd page over rows the user can't see. Placing the `EXISTS (folder_posts JOIN folders ON …)` clause in the same `WHERE` as `Post.is_published == True` keeps the cursor pagination correct and avoids a second post-filter pass.

**Why no `Post.feed_eligible` flag:** Considered. Rejected because it duplicates state: the join table + folder visibility already encode everything the feed needs. Adding a denormalised flag means writing migration logic to keep it in sync on folder visibility toggles — strictly more failure modes for no new capability.

**Why no migration of existing data:** Pre-existing posts that were created one-image-per-post under the old model remain valid `Post` rows; they simply look like "1-image posts" going forward. Merging historical individual posts into multi-image posts would require destroying engagement history (likes, comments, engagement logs are keyed on `post_id`), which the user explicitly does not want.

**Trade-offs accepted:**
- The new feed visibility rule is **looser** than the old one: previously, `Post.public=false` alone hid a post; now it must also be in a private folder. Confirmed with the user; the practical impact is negligible until a UI to toggle `Post.public` exists.
- The frontend modal `AddStickersModal` now POSTs all images in one multipart request instead of one per file. A single transient network failure aborts the whole upload (vs. the old per-file partial-success). Acceptable because the UX is now strictly "create a post" — partial success would be confusing (a post with some-but-not-all images).
- The folder upload endpoint return shape changed from `{ post_ids: number[], count: number }` to `{ post_id: number, image_count: number }`. The only caller (the modal) was updated in the same change; no other client consumed the old shape.

**Follow-ups:**
- Add a UI control for `Folder.is_public` if not already present (the flag is currently set only via direct DB or `PATCH /folders/{id}`).
- Consider a UI control for `Post.public` so the new feed-visibility rule has practical surface area for users to use.
- Add backend tests covering the 5-image cap boundary, the single-post-per-upload behavior, and the folder-aware feed exclusion.

---

## 2026-05-04 — Home Feed Pagination

### Cursor-paginated `/posts/top` + `useInfiniteQuery` on `HomePage`

**Decision:** `GET /posts/top` now accepts `limit` (default 20, max 50) and an optional opaque `cursor`, and returns `next_cursor: str | None`. The home page renders the feed with TanStack `useInfiniteQuery` and an `IntersectionObserver` sentinel below the grid that triggers `fetchNextPage` 400px before it enters the viewport.

**Why cursor pagination over offset:** The feed is ranked by engagement, which changes continuously as new likes/comments arrive. Offset-based paging drifts under those mutations — page 2 can repeat page 1 rows or skip rows entirely. Cursors are stable against insertions and avoid the O(N) cost of deep `OFFSET` scans.

**Why a composite `(engagement_count, post_id)` cursor:** Engagement counts are not unique — most posts cluster at low values. A single-column cursor on `engagement_count` either skips or duplicates rows at tie boundaries. Pairing engagement with `post_id DESC` as a deterministic tiebreaker (PostgreSQL row-constructor `(eng, id) < (cursor_eng, cursor_id)`) gives a strict total order. The cursor is base64-encoded to keep the wire format opaque so future cursor-format changes do not break clients.

**Why the cursor filter lives in the ranking subquery's `HAVING`, not the outer query:** `engagement_count` is an aggregate, computed in the inner `GROUP BY`. The `LIMIT` must apply *after* the cursor filter, otherwise we'd cap before paging starts. `HAVING` is the correct stage for filtering on aggregate values within the same `SELECT`.

**Why `limit + 1` over a separate count query:** Fetching one extra row and slicing reveals "has next page" without a `COUNT(*)` round-trip. Standard pattern for cursor APIs.

**Why `useInfiniteQuery` over manual `useState`:** The hook already delivers page-array state, dedup, automatic refetch on focus, and `staleTime` from the global `QueryClient`. Like-toggle and post-delete now mutate the cache via `queryClient.setQueryData<InfiniteData<TopPostsResponse>>(...)` so an update on a post in page 1 stays consistent when page 2 is loaded later.

**Trade-offs accepted:**
- Re-ranking under load: if engagement shifts dramatically between page 1 and page N, a post may appear on two pages or be skipped. Acceptable for a top-engagement feed; the alternative (stable snapshot per session) would require server-side cursors keyed on a session id and add infrastructure for marginal UX gain.
- `total_returned` and `k_value` fields are retained in the response for backward compatibility but no longer carry pagination meaning. Clients should rely on `next_cursor` alone.
- The 400px `rootMargin` on the `IntersectionObserver` is a UX tuning value — too aggressive will fetch pages the user never reaches; too small produces a visible "stall" at the bottom. 400px feels right for the current grid density and is cheap to revisit.

**Follow-ups:**
- Add an explicit `(public, is_published, id)` partial index supporting the new ordering if the feed query plan regresses under load.
- Consider extending the same pattern to other listings (folder contents, profile feeds) — they currently fetch unbounded result sets.

---

## 2026-04-26 — Canvas Showcase Builder

### Full-stack sticker canvas on user profiles

**Decision:** Added a per-user canvas showcase feature — a 1200×400 freeform canvas on every profile where users arrange stickers and post images. Architecture:
- **DB:** `user_canvases` table with `UNIQUE(user_id)` (one canvas per user), `canvas_json` JSONB (full node state), `preview_path` VARCHAR(1024) (CloudFront URL of PNG snapshot).
- **Backend:** 5 new endpoints under `/canvas` prefix. `PUT /canvas/me` upserts via PostgreSQL `ON CONFLICT DO UPDATE` (10/min). `POST /canvas/me/preview` accepts a raw PNG blob from the client (no PIL — the PNG is already rendered), uploads to `canvas_previews/{user_id}/` (5/hr). `POST /canvas/me/assets` handles direct-upload images for the canvas editor (20/hr). `GET /canvas/{username}/preview` is public — exposes only `preview_path`, never `canvas_json`.
- **Frontend:** `features/canvas/` module — `CanvasEditor` portal modal (matching PostDetailModal pattern), `CanvasStage` + `CanvasNode` (react-konva), `CanvasPicker` three-tab sidebar (Library / Posts / Upload), `CanvasToolbar` with 10 background presets, `CanvasPreview` profile strip. All five components exist and are complete. `UserProfile.tsx` was wired to fetch canvas preview in its `Promise.all` and render the strip between the header and the tab bar — **this wiring was temporarily removed on 2026-04-27 pending CloudFront CORS configuration**; see the removal/re-enable notes below.

**Why full-screen portal modal over a new route:** Matches the existing `PostDetailModal` pattern already in the codebase. Zero routing changes. Canvas always has a fixed, predictable pixel dimension for Konva — a responsive flex child cannot guarantee this.

**Why react-konva over Fabric.js:** react-konva is declarative and integrates naturally with React state. Fabric.js has an imperative API requiring ref-based synchronisation with React, which is harder to maintain.

**Why canvas JSON is not exposed publicly:** `canvas_json` contains CloudFront image URLs the user may have uploaded privately (direct-upload path). The public endpoint returns only the pre-rendered PNG preview.

**Why the preview PNG is generated client-side:** `stage.toDataURL()` is a Konva/browser API — it cannot run server-side. The client renders the PNG and POSTs the blob; the backend uploads it raw to S3 without any PIL reprocessing.

**CORS requirement (deployment prerequisite):** `useImage(url, 'anonymous')` in `CanvasNode.tsx` sends every image request with `Origin: https://www.petrcollect.com`. CloudFront must return `Access-Control-Allow-Origin: https://www.petrcollect.com` in the response or the browser taints the canvas and `stage.toDataURL()` throws a SecurityError. Do **not** use `*` — it is less precise and unnecessary since there is only one production origin. See fix procedure below.

**Image source picker — three tabs:**
1. Library stickers (reuses existing `GET /library/` TanStack Query)
2. Post images (flattened from `profile.posts` already in scope — no extra fetch)
3. Direct upload (new `POST /canvas/me/assets`, uploaded to `canvas_assets/{user_id}/`)

**Background canvas presets:** 6 solid colors (UCI palette) + 4 gradients. Stored in `canvas_json.background` as `{ type, value, gradientEnd, angle }` — structured data, not a CSS string, to avoid parsing issues with Konva's `fillLinearGradientColorStops` format.

**Trade-offs accepted:**
- Canvas editing on mobile is not optimized — drag-and-drop Konva interactions on touch screens are functional but not polished. Acceptable for v1; the showcase is a desktop-first feature.
- `updated_at` on `user_canvases` uses `server_default` only (no `onupdate` trigger). SQLAlchemy `onupdate` on mapped columns requires function references and is unreliable across upserts. The `PUT` upsert always writes the current timestamp explicitly.
- Stale preview: if a user updates their canvas JSON without also uploading a new preview PNG, the profile strip shows the old image until they re-save with preview.

**New packages:** `react-konva` 19.2.3 (published 2026-02-28), `konva` 10.2.5 (published 2026-04-10), `use-image` 1.1.4 (published 2025-05-25). All verified >10 days old before install.

**Canvas re-enabled on profile (2026-04-28):** CloudFront CORS is now active. The canvas was re-wired into `UserProfile.tsx` as part of a larger profile redesign — see "Showcase tab + inline canvas editor" entry below. The `CanvasEditor` portal modal and `CanvasPreview` strip are superseded by the new inline approach; they remain in `features/canvas/components/` but are no longer used from `UserProfile.tsx`.

**Follow-up:**
- Consider adding holographic/rainbow CSS hover effects to sticker nodes as a v2 visual differentiator.
- Journey tracker (sticker travel history + world map) is the next planned feature for retention — canvas is the foundation that makes profiles feel populated.

---

## 2026-04-28 — Showcase Tab + Inline Canvas Editor

**Decision:** Replaced the full-screen portal modal canvas editor with an inline editing experience embedded directly in a new "Showcase" tab on the profile page. New components: `CanvasBottomTray` (horizontal image picker) and `InlineCanvasEditor` (collapsed header + canvas stage + tray). `CanvasEditor` and `CanvasPicker` (portal/sidebar variants) are retained but no longer used from `UserProfile.tsx`.

**Why Showcase as a tab rather than a separate section above the grid:** Avoids vertical space competition between the canvas and the profile header. The canvas is the hero impression on first load (Showcase is the default tab), but users can tab directly to Collection / Looking For / Trading Away without scrolling past the canvas every time.

**Why inline editor over the portal modal:** The portal modal (`CanvasEditor`) worked but felt detached — opening it navigated away from the profile context visually. Editing inline (the page transforms in place) reinforces the "decorating your profile" mental model. The body-scroll lock + escape-key guard from the portal version are preserved in `InlineCanvasEditor`.

**Why a bottom tray instead of a left sidebar:** The sidebar consumed 256px of canvas width on every screen size. The bottom tray (`CanvasBottomTray`) gives the full content width to the canvas stage. Horizontal scroll for image thumbnails is natural and mirrors mobile sticker-picker UX (Instagram, TikTok).

**Canvas scaling in inline mode:** `InlineCanvasEditor` uses a `ResizeObserver` on the canvas container div to compute `scale = Math.min(1, (containerW - 32) / 1200, (containerH - 32) / 400)`. Initial scale is estimated from `window.innerWidth/Height` to avoid a visible flash on first render. Body scroll is locked while editing.

**Profile tab order:** Showcase → Collection → Looking For → Trading Away. Showcase is first and the default (`useState("showcase")`). Navigating to a different username resets to Showcase via a `useEffect` on `username`.

**Canvas preview fetch:** `getPublicCanvasPreview(username)` is called in `fetchAll` alongside the profile and folders fetches. On save, `canvasPreviewPath` state is updated directly (no re-fetch of the entire profile) and the editor closes.

**Trade-offs accepted:**
- The `CanvasEditor` portal and `CanvasPicker` sidebar components are now dead code. They are not deleted in case a standalone canvas route is added later; a cleanup PR should remove them if that route is not planned.
- `InlineCanvasEditor` loads canvas state on mount (`getMyCanvas()`) independently of the profile load. This is a second network round-trip when entering edit mode but keeps the component self-contained and the profile load fast.

---

## 2026-04-28 — Canvas Background Removal

**Decision:** Added server-side background removal via `rembg` (`POST /canvas/me/remove-bg`). When a user selects an image node in the canvas editor, a node toolbar appears with a "Remove BG" toggle. Toggling calls the endpoint, which runs ML inference and returns a transparent PNG uploaded to `canvas_assets/{user_id}/`.

**Why server-side (rembg) over browser-side (@imgly/background-removal):** Browser-side WASM removal requires the user to download a ~50MB WASM + model bundle on first use, blocks the UI thread during inference, and produces inconsistent results across browsers. `rembg` on the server runs once per image, is version-locked, and the result is cached — the user never downloads the model.

**Why `u2net_lite` over the default `u2net`:** `u2net` is ~170 MB and takes 8-15s per image on a t3.micro CPU. `u2net_lite` is ~4.7 MB and runs in ~2-4s at acceptable quality for a sticker/banner use case. The quality difference is negligible for the use case (small images on a decorative canvas).

**Session caching:** `rembg` creates an ONNX runtime session when first called. Creating a new session per request reloads the model from disk each time, which is the dominant cost. A module-level `_rembg_session` singleton is initialized on first request and reused for all subsequent calls.

**Toggle UX and client-side caching:** The node type carries three optional fields — `bgRemoved` (toggle state), `originalUrl` (pre-removal URL), `removedBgUrl` (processed URL). The processed URL is cached on the node so toggling off and back on reuses the S3 result without re-calling the endpoint. Rate limit: 10/hour per user.

**Trade-offs accepted:**
- First request after a server restart pays the ONNX session initialization cost (~1-2s). Subsequent requests pay inference only.
- Background removal is synchronous — it blocks the FastAPI worker thread for ~2-4s. Acceptable at current scale; a task queue (Celery/ARQ) would be the right fix if concurrency becomes an issue.
- `bgRemoved`, `originalUrl`, and `removedBgUrl` are stored in `canvas_json` alongside the rest of the node state. Loading an old canvas with these fields on new nodes is backward compatible (all three are optional).

---

## 2026-04-28 — Canvas Free Transform, Z-Order Controls

**Decision:** Added two interaction features to the canvas node toolbar without any schema or API changes.

**Free transform (Proportional / Free toggle):**
- `CanvasNode.tsx` now accepts a `keepRatio: boolean` prop. In **Proportional** mode (default, preserves existing behavior): 4-corner Transformer, aspect ratio locked. In **Free** mode: all 8 Konva Transformer anchors enabled (corners + edge midpoints), allowing non-uniform scaling. Dragging a single edge midpoint anchor is the "expand in one direction" gesture.
- `keepRatio` is session-wide state in `InlineCanvasEditor` (not per-node) — switching mode affects the active selection immediately. This is intentional: making it per-node would require adding a field to `CanvasNode` and migrating saved canvases.
- Why not a custom `boundBoxFunc` for hard directional locking: Konva's `boundBoxFunc` receives the bounding box in stage coordinates. When the node is rotated, clamping a single edge (e.g. "left edge must not move") requires transforming the constraint into the node's local coordinate frame — non-trivial matrix math that would need its own tested utility. The 8-anchor approach covers 95% of the "expand in one direction" use case for zero constraint complexity. A rotation-aware directional lock is deferred.

**Z-order (Bring Forward / Send Backward):**
- `useCanvasState` exposes `moveNodeUp(id)` / `moveNodeDown(id)` — these swap the node one position in the `nodes[]` array. Konva renders nodes in array order, so last = topmost, matching standard layer semantics.
- The toolbar buttons are disabled at array boundaries (first node can't go further back, last can't go further forward) to prevent confusion.
- Why not a full layers panel: Adding named layers requires restructuring `CanvasState.nodes[]` to `CanvasState.layers[]{name, nodes[]}`, a breaking schema change needing a version migration. Bring Forward / Send Backward delivers all practical z-order value with no schema impact.

**Trade-offs accepted:**
- `keepRatio` mode is not persisted — reloading the editor always starts in Proportional mode. Persisting it would require either a URL param or a user preference record; neither is warranted for this feature.
- No full layers panel. If added later, `CanvasState.version` (currently `1`) should be bumped to `2` and a migration guard added in `useCanvasState.ts` to convert the flat `nodes[]` to `layers[]` on load.

**Follow-up:**
- Rotation-aware single-edge locking (directional expand with a pinned opposite edge) is the next natural step if users request finer control.
- Generative outpainting (AI-driven expand) would follow the same server-side pattern as `POST /canvas/me/remove-bg` — upload image + mask, call outpainting API, return new S3 URL. Not planned.

---

## 2026-04-15 — Logging Env Vars: Hardcoded in Compose Files, Not in GitHub Secrets

**Decision:** `LOG_LEVEL`, `SLOW_REQUEST_MS`, and `SLOW_QUERY_MS` are set directly in `docker-compose.prod.yml` and `docker-compose.example.yml` as literal values, not sourced from GitHub Actions secrets or the `.env` file written by the CD pipeline.

**Reasoning:** GitHub secrets exist for credentials — values that grant access to systems and would cause a security incident if exposed (passwords, API keys, JWT signing secrets). Logging thresholds are operational configuration with no security sensitivity. Putting `INFO`, `500`, and `100` into secrets would: (1) bloat the secrets list with non-sensitive values, making it harder to audit for actual credentials; (2) hide non-sensitive configuration from the repo where it is more readable and reviewable; (3) require secret management overhead for values any developer can safely see.

**Per-environment values:**
- Local dev (`docker-compose.example.yml`): `LOG_LEVEL=DEBUG` — verbose output for active development.
- Production (`docker-compose.prod.yml`): `LOG_LEVEL=INFO`, `SLOW_REQUEST_MS=500`, `SLOW_QUERY_MS=100` — signal without noise.
- CI (unit + E2E): no explicit setting, defaults apply (`INFO`, `500`, `100`).

**Trade-offs:**
- Changing a threshold in production requires a git commit + CD redeploy. With secrets you could hot-swap the value in the GitHub UI. For logging thresholds this is acceptable — they are not incident-response levers. Emergency workaround: SSH into EC2, edit `docker-compose.prod.yml` directly, run `docker compose -f docker-compose.prod.yml up -d`.
- Values are visible in the git history. This is a feature, not a bug — reviewers can see exactly what is running in each environment.

**Follow-up:** None.

---

## 2026-04-15 — Backend Logging: Structured JSON to stdout, `python-json-logger`, `ContextVar` request ID

**Decision:** Adopted `python-json-logger` (v2.x) over `structlog` for structured JSON logging. Logging is configured once in `backend/utils/logging_config.py` and called at startup in `main.py`. Request timing is captured in `RequestTimingMiddleware` (outermost middleware). Slow DB queries are caught via SQLAlchemy `before/after_cursor_execute` event listeners in `database.py`. JWT decode failures are logged in `utils/auth.py`. A `ContextVar` (`request_id_var`) propagates the per-request ID into all log calls within the request without explicit parameter passing.

**Why `python-json-logger` over `structlog`:** The app has zero existing logging. `structlog` requires a different logger API (`structlog.get_logger()`) from stdlib `logging.getLogger()`, creating a migration cost with no current debt. `python-json-logger` is stdlib-compatible, adds one dependency, and produces identical JSON output. Upgradeable later.

**Why `BaseHTTPMiddleware` over pure ASGI:** `SecurityHeadersMiddleware` already uses `BaseHTTPMiddleware`. Consistency is more valuable than the ~5–10µs per-request overhead difference. The app has no streaming responses so the buffering caveat is irrelevant.

**Why SQL templates and not parameters are logged:** ORM-generated SQL uses `%s` placeholders — the template identifies the query without leaking user-supplied values (search terms, emails, etc.). Parameter logging is permanently excluded.

**Cons accepted:**
- `structlog` context binding (log.bind) not available — `ContextVar` compensates for request-scoped context, but background tasks (e.g. `_notify_trade_request`) that run after the response won't carry `request_id`. Logs from those tasks are correlated by timestamp only.
- `BaseHTTPMiddleware` re-wraps exceptions as generic 500s if they reach the middleware boundary. The `except Exception: raise` block logs the event before re-raising.

**Follow-up:** Done — `awslogs` driver wired in `docker-compose.prod.yml` (2026-04-20). Both services ship logs to CloudWatch under `/petrcollect/backend` and `/petrcollect/messaging`.

---

## 2026-04-15 — Messaging DB Schema: Separate MESSAGING_DB_SCHEMA from MESSAGING_DB_USER

**Decision:** Introduced a dedicated `MESSAGING_DB_SCHEMA` secret for the PostgreSQL schema name, decoupled from `MESSAGING_DB_USER` (the login role name). All three places that reference the schema — `application.yml` (Flyway + Hibernate), `docker-compose.prod.yml` (env pass-through), and `cd.yml` (schema init SQL) — now use `${MESSAGING_DB_SCHEMA}`.

**Reason:** The CD previously created the schema as `CREATE SCHEMA IF NOT EXISTS ${MESSAGING_DB_USER}`, naming the schema after the login role. `application.yml` hardcoded the schema as `petrcollect_messaging`. When the `MESSAGING_DB_USER` secret was set to a value other than `petrcollect_messaging`, the CD created a schema with the wrong name, `petrcollect_messaging` never existed, and Flyway tried to create it on startup — failing with `permission denied for database antcollect` because a non-superuser login role cannot create schemas without an explicit `CREATE` grant on the database. Spring Boot then crash-looped. The CD job showed green because `psql` with multiple `-c` flags does not abort on individual command errors.

**Trade-off:** One additional GitHub secret to manage. Acceptable — the schema and role names are genuinely different concepts and should be independently configurable.

**Follow-up:** Set `MESSAGING_DB_SCHEMA=petrcollect_messaging` in GitHub Secrets before next deploy. The CD will create the schema with the correct name and Spring Boot will start cleanly.

---

## 2026-04-14 — CI/CD Security Hardening: SHA Pinning, Deploy Directory, .env Permissions

### Pin action SHAs, move deploy directory to home, restrict .env permissions

**Decision:**
- All `uses:` references in `ci.yml` and `cd.yml` pinned to immutable commit SHAs (version tag kept as inline comment for readability).
- Deploy directory moved from `/opt/petrcollect` to `~/petrcollect`.
- `chmod 600 ~/petrcollect/.env` added to the deploy step immediately before `docker-compose up`.

**Reason:**
- Floating version tags (`@v4`, `@v1.0.3`) can be silently repointed to malicious commits. Every action runs with full access to CI secrets; a hijacked tag is a full credential leak. SHAs are immutable and cannot be moved.
- `/opt/` requires root to create subdirectories. The previous workaround (`sudo mkdir + sudo chown`) preserved passwordless-sudo on the SSH user — a leaked `EC2_SSH_KEY` would give an attacker full root. Moving to `~/petrcollect` eliminates the need for `sudo` entirely; the SSH user already owns their home directory.
- The `.env` file contains DB passwords, JWT secret, and `INTERNAL_SERVICE_SECRET`. Without an explicit `chmod`, the file inherits the instance umask (typically `022`, world-readable). `chmod 600` restricts it to the owning user only.

**Deferred security work — not yet addressed:**

| Risk | Severity | What it would take |
|---|---|---|
| `GRANT ALL PRIVILEGES ON SCHEMA` gives app users DDL rights (DROP, CREATE, TRUNCATE) | High | Split into usage grant at init + table-level DML grants after Alembic runs |
| `EC2_SSH_KEY` is a long-lived stored credential; passwordless sudo still active on EC2 | Medium | Replace `appleboy/ssh-action` with SSM Run Command (free, uses existing OIDC role); close port 22 |
| `.env` file on EC2 disk contains all runtime secrets in plaintext | Medium | AWS SSM Parameter Store standard tier (free); EC2 reads secrets at startup via instance IAM role |
| `docker login` credentials persist in `~/.docker/config.json` between deployments | Low | Add `docker logout "$ECR_REGISTRY"` step after pull |

**Follow-up:**
- Narrow `GRANT ALL PRIVILEGES` to DML-only for `APP_DB_USER` and `MESSAGING_DB_USER` — this is the highest-priority remaining item.
- Evaluate SSM Run Command + SSM Parameter Store once initial deployment is stable.

---

## 2026-04-13 — CI Architecture: Hybrid Native/Docker, Deferred .dockerignore

### Adopt hybrid CI strategy; log missing .dockerignore as known gap

**Decision:**
- Unit and integration test jobs (`backend`, `messaging`, `frontend`) stay on native GitHub Actions runners. Native runners with service containers are the correct pattern for this layer — they test application logic, not container plumbing, and benefit from first-class caching via `actions/setup-python`, `setup-java`, and `setup-node`.
- The `e2e` job will be refactored to build Docker images fresh (Option 1) and run Playwright against a docker-compose stack rather than natively started dev-mode processes (`uvicorn`, `mvn spring-boot:run`, `npm run dev`). This is the only layer where production parity is load-bearing.
- A `.dockerignore` was identified as missing but is explicitly deferred — see below.

**Reason:**
- The current E2E job starts all three services in dev mode. These are not the artifacts that get deployed; the CD pipeline builds Docker images separately. E2E passing against dev-mode processes does not validate the production containers.
- Option 1 (build images fresh in E2E) was chosen over Option 2 (CD pushes to ECR first, E2E pulls by tag) because: PRs are first-class CI citizens and must run E2E without depending on CD; the "test the exact artifact you deploy" benefit of Option 2 is largely theoretical given deterministic Docker builds; and Option 2 entangles validation with deployment, meaning a bad image lands in ECR before E2E has a chance to catch it.
- `backend/requirements.txt` containing only prod dependencies (test libraries removed) makes the Docker pip-install layer more cache-stable — a secondary benefit of the trimmed requirements file.

**Findings during analysis:**
- `messaging-service/Dockerfile` is already correct: multi-stage build, stage 2 is JRE + fat JAR only, no source or test files in the final image.
- `backend/Dockerfile` is single-stage. `COPY backend/ ./backend/` copies the entire backend directory — including test folders and fixtures — into the production image. These files are inert at runtime but should not be there.
- No `.dockerignore` exists at the repo root. Both Dockerfiles use `context: .` (full repo root), so every `docker build` transfers the entire working tree — `frontend/node_modules/`, `.git/`, messaging source, docs, etc. — to the Docker daemon before layering begins. This inflates build-context transfer time on every build.

**Deferred — .dockerignore:**
A `.dockerignore` at the repo root would exclude test directories, `frontend/`, `messaging-service/`, `.git/`, `node_modules/`, `__pycache__/`, and `*.md` from the build context. This would: reduce build-context transfer size significantly, prevent test files from landing in the prod backend image, and improve layer cache hit rates. Deferred to prioritize getting the site deployed and the CI/CD pipeline functional. Should be revisited as a CI optimization pass after initial deployment is stable.

**Follow-up:**
- Add `.dockerignore` at repo root before any significant scaling of the build pipeline.
- Refactor the `e2e` job in `ci.yml` to build Docker images and start the stack via `docker-compose.ci.yml`.

---

## 2026-04-11 — Transition to Containerized Deployment & RDS Isolation

### Dockerize Backend services and isolate RDS schemas

**Decision:**
- Containerized the Backend (FastAPI, Python 3.12) and Messaging (Spring Boot 17) services.
- Switched from Docker Hub to Amazon ECR for container storage.
- Implemented OIDC for secure GitHub-to-AWS authentication (replacing static keys).
- Established an RDS initialization strategy using infra/db/init-roles.sql to create restricted users (petrcollect_app, petrcollect_messaging) and isolated schemas (public for app, petrcollect_messaging for messaging).

**Reason:**
- Containerization ensures environment parity across local, CI, and EC2.
- ECR provides better AWS integration and unlimited private repositories.
- OIDC improves security by removing long-lived secrets.
- RDS user isolation follows the principle of least privilege.

**Follow-up:**
- Ensure the IAM Role petrcollect-github-deploy-role is created in AWS with the correct OIDC trust policy.
- Create private ECR repositories petrcollect-backend and petrcollect-messaging.
- Update GitHub Secrets with the new OIDC role ARN and RDS user passwords.
- Verify docker-compose.yml on EC2 uses the ECR image paths.

---


## 2026-04-08 — Python version: 3.11 → 3.12

### Standardise on Python 3.12 across CI and EC2

**Decision:** Bumped `python-version` in both the `backend` and `e2e` jobs in `.github/workflows/ci.yml` from `"3.11"` to `"3.12"`.

**Reason:** Production server runs Ubuntu 24.04 (Noble), which ships Python 3.12 as the system default. Python 3.11 is not in the standard Noble repositories, so installing it requires the third-party `deadsnakes` PPA. Using the system-default version eliminates that dependency and keeps CI and EC2 on an identical runtime.

**Follow-up:** None — 3.12 is stable and `backend/requirements.txt` has no known 3.12 incompatibilities.

---

## 2026-04-08 — Frontend API Base URL

### Centralize backend URL via VITE_BACKEND_URL env var

**Decision:** Export `API_BASE` from `shared/api/api.ts` using `import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8000"`. All source files import from this single export instead of declaring their own local constant.

**Reason:** 14 files had `const API_BASE = "http://localhost:8000"` — a production build would hit localhost rather than the real API host. `tradeRequestApi.ts` had its own bare `import.meta.env.VITE_BACKEND_URL` read with no fallback, causing silent failures in dev/test when the var is unset.

**Follow-up:** Set `VITE_BACKEND_URL=https://api.yourdomain.com` in the production build environment (GitHub Actions `VITE_BACKEND_URL` secret or `.env.production` on the build machine). `VITE_WS_URL` for the messaging WebSocket was already env-var-driven.

---

## 2026-04-07 — S3 Image Storage

### Replace local disk upload with AWS S3
- **Decision:** All image writes now go through `backend/utils/s3.py` via `upload_image_bytes()`. The `process_and_save_image()` function buffers each variant with `io.BytesIO`, uploads to S3, and returns full `https://` public URLs. The `/Uploads` `StaticFiles` mount is removed.
- **Reason:** Local disk storage does not survive container restarts or horizontal scaling. Images uploaded to one dyno would be invisible on all others.
- **Key design choice:** Lazy S3 client init (`_get_client()`) so unit tests can `patch("backend.utils.s3.upload_image_bytes")` before the real boto3 client is constructed.
- **Key structure:** `posts/{user_id}/{size}/{filename}` for post variants, `avatars/{user_id}/{filename}` for avatar thumbnails.
- **`delete_file()` dual-dispatch:** Accepts both full S3 URLs (`https://`) and legacy local paths (bare string). Keeps any existing DB rows with local paths working after migration.
- **Follow-up — deployment prerequisite:** S3 bucket must have a public-read bucket policy on the `posts/*` and `avatars/*` prefixes. IAM user needs only `s3:PutObject` and `s3:DeleteObject`. Policy example:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      { "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::YOUR_BUCKET/posts/*" },
      { "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::YOUR_BUCKET/avatars/*" }
    ]
  }
  ```
- **Follow-up — messaging avatars:** The messaging service reads `avatar_path` from `public.users` and returns it raw. Messaging frontend components (`ConversationCell`, `ConversationSearch`, `ChatPage`, `MessageList`) prefix `${BACKEND_URL}/`. Now that `avatar_path` is an S3 URL those four sites will double-prefix. Fix: strip the prefix at those call sites (same pattern as the refactor applied to `SideBar`, `ProfileTab`, `UserProfile`).

---

## 2026-04-08 — CloudFront CDN + Private S3

### Serve media through CloudFront; block direct S3 public access

**Decision:** All image URLs stored in the DB and returned by the API are now CloudFront URLs (`https://{CLOUDFRONT_DOMAIN}/{key}`), not direct S3 URLs. The S3 bucket's public-read policy is removed; access is granted exclusively to the CloudFront distribution via an Origin Access Control (OAC) policy.

**Reason:** Public S3 buckets expose the bucket name, allow direct enumeration of keys, and bypass any CDN-level caching or access control. CloudFront free tier (1 TB/month egress, 10M requests/month) covers current scale at zero marginal cost.

**What changed:**
- `backend/utils/s3.py` — `upload_image_bytes()` returns `https://{CLOUDFRONT_DOMAIN}/{key}` when `CLOUDFRONT_DOMAIN` env var is set; LocalStack path (`AWS_ENDPOINT_URL` set) is unaffected. `s3_key_from_url()` gained a third branch to parse CF URLs so `delete_file()` still resolves the correct S3 key for deletions.
- `infra/nginx/petrcollect.conf` — CSP `img-src` and `connect-src` narrowed from `https://*.amazonaws.com` to `https://CLOUDFRONT_DOMAIN`. The conf is a template — deploy with `envsubst '${DOMAIN} ${CLOUDFRONT_DOMAIN}'` to avoid hardcoding the domain.
- `alembic/versions/e1f2a3b4c5d6` — one-time data migration rewrites existing S3 URLs in `users.avatar_path`, `media_assets.file_url`, and `media_assets.json_metadata.paths.*` to CloudFront URLs. Requires `CLOUDFRONT_DOMAIN` env var at run time; no-op downgrade (reversing requires the original bucket/region values, which are not stored in the migration).

**Local development:** No change. `AWS_ENDPOINT_URL` being set causes the early-return to LocalStack path-style URL; `CLOUDFRONT_DOMAIN` is never reached in local dev.

**Deployment prerequisites:**
1. Create CloudFront distribution — origin: S3 bucket, OAC attached.
2. Update S3 bucket policy to deny public `s3:GetObject` and allow only the CloudFront OAC principal.
3. Set `CLOUDFRONT_DOMAIN=xxxx.cloudfront.net` (or custom alias) in server env and CI secrets.
4. Run `CLOUDFRONT_DOMAIN=xxxx.cloudfront.net alembic upgrade head` to rewrite existing rows.
5. Deploy nginx conf using `envsubst` to substitute `DOMAIN` and `CLOUDFRONT_DOMAIN`.

**Follow-up:** IAM policy for the deploy user can now drop `s3:PutObjectAcl` — no object ACLs are set since the bucket is fully private.

---

## 2026-04-08 — Tech Stack Snapshot

### Full stack as of this date

**Frontend**
| Technology | Role |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety across all frontend code |
| Vite | Build tool and dev server |
| React Router | Client-side routing (all routes in `App.tsx`) |
| TanStack Query | Server-state fetching and caching |
| Zustand | Client-state (auth, trade request badge) |
| Tailwind CSS | Utility-first styling |

**Backend**
| Technology | Role |
|---|---|
| FastAPI | REST API, runs on :8000 |
| SQLAlchemy | ORM — canonical models in `backend/models/` |
| Alembic | DB migrations (`public` schema) |
| PostgreSQL | Primary database (server named `antcollect`) |
| bcrypt | Password hashing |
| PyJWT | Access + refresh token generation/validation |
| boto3 | S3 uploads and deletes |
| Pillow | Image resizing (thumbnail 150×150, medium 800×800, original unchanged) |
| slowapi | Rate limiting per-IP or per-user |

**Messaging service**
| Technology | Role |
|---|---|
| Spring Boot 3.3.5 | WebSocket/STOMP messaging service, runs on :8080 |
| Flyway | DB migrations (`petrcollect_messaging` schema) |
| PostgreSQL | Shares the same DB server, separate schema |

**Infrastructure**
| Technology | Role |
|---|---|
| AWS S3 | Object storage for post images and avatars |
| AWS CloudFront | CDN in front of S3; only public access point for media |
| nginx | Reverse proxy — HTTP→HTTPS redirect, TLS, rate-limit zones, proxy to :8000 and :8080, CSP headers |
| Cloudflare | DNS + DDoS/edge; real IP restored in nginx via `cloudflare_ips.conf` |
| Let's Encrypt (Certbot) | TLS certificates |
| LocalStack | Local S3 emulation for development |

---

## 2026-04-02 — Settings Page (v1)

### `backend/models/` is canonical, not `models.py`
- **Decision:** `backend/models/__init__.py` (re-exporting from `user.py`, `post.py`, `auth.py`, `media_assets.py`) is the source of truth. The flat `backend/models.py` file is stale and unused.
- **Reason:** All routers import from `backend.models`, which resolves to `backend/models/__init__.py`. `alembic/env.py` also imports directly from `backend/models/`. The flat file is never imported.
- **Action taken:** Corrected `PROJECT_MAP.md` and `docs/BACKEND.md`.
- **Follow-up:** The flat `backend/models.py` should be deleted to avoid future confusion.

---

### No migration needed for `avatar_path` and `bio`
- **Decision:** Did not generate a new Alembic migration for these columns.
- **Reason:** Both columns were already present in `alembic/versions/bcf7ddb6972c_initial_schema.py` and exist in the live DB. They were defined in `backend/models/user.py` but the planning doc (SETTINGS_FEATURE.md) incorrectly assumed they were missing.

---

### `UserMeResponse` had stale fields — removed
- **Decision:** Removed `is_private`, `default_post_public`, and `display_name` from `UserMeResponse` in `schemas.py`.
- **Reason:** `is_private` and `default_post_public` were non-optional `bool` fields with no corresponding column on the `User` model — `GET /users/me` would have raised `AttributeError` at runtime. `display_name` was dropped because username serves that role.

---

### Privacy tab deferred entirely
- **Decision:** Did not add `is_private` or `default_post_public` columns, no Privacy tab in UI.
- **Reason:** These settings would be inert — nothing in the feed, profile view, or search respects `is_private`. Showing a "Private Account" toggle that doesn't actually restrict access is misleading.
- **Follow-up:** When adding the privacy tab, must also update the feed query, `get_user_` profile endpoint, and search to gate content on `is_private`. That is a cross-cutting change across multiple endpoints.

---

### Blocked users deferred entirely
- **Decision:** No `blocked_users` table, no block/unblock endpoints, no Blocked tab in UI.
- **Reason:** Same issue as privacy — blocking a user currently has no enforcement in feed, messaging, or profile. Inert infrastructure with no behavioral effect.
- **Follow-up:** When implementing, the `blocked_users` table references `users.id` with `CASCADE DELETE`. Also need to filter blocked users from search results, feed, and potentially messaging.

---

### `display_name` dropped — username is the display identity
- **Decision:** No `display_name` column added to `User`. Username is shown everywhere as the display name.
- **Reason:** Explicit product decision to keep identity simple in v1.
- **Follow-up:** If `display_name` is added later it needs a migration, a schema update, and updates to `UserProfileResponse`, the profile page, post cards, and search results.

---

### Avatar stores thumbnail path only — old variants are orphaned on replace
- **Decision:** `User.avatar_path` stores only the thumbnail variant path (`Uploads/{user_id}/thumbnail/{uuid}.jpg`). When replacing an avatar, `_cleanup_files([old_thumbnail_path])` deletes only the old thumbnail.
- **Reason:** `_cleanup_files` is functional and safe to use. Only passing the thumbnail path means the old original and medium variants are left on disk.
- **Trade-off:** Minor storage leak on avatar replacement. Acceptable for v1.
- **Follow-up:** Pass all three variant paths (`original`, `medium`, `thumbnail`) to `_cleanup_files` when the old `avatar_path` is replaced. Requires storing all three paths or reconstructing them from the thumbnail path.

---

### Delete Account is a dummy button
- **Decision:** The Danger tab renders a checkbox-gated "Delete Account" button that shows `alert("not yet implemented")`. No backend endpoint.
- **Reason:** Account deletion requires cascade-deleting posts, likes, comments, refresh tokens, and potentially handling the `petrcollect_messaging` schema's references to `users.id`. Out of scope for v1.
- **Follow-up:** Implement `DELETE /users/me` — verify cascade behaviour across both schemas before shipping. The messaging schema may need its own cleanup logic.

---

### `POST /auth/logout` may not exist yet
- **Decision:** `AccountTab` calls `POST /auth/logout` on logout but wraps it in a try/catch. If the endpoint doesn't exist, localStorage is still cleared and the user is redirected to `/Login`.
- **Reason:** Graceful degradation — logout should always succeed from the user's perspective even if the server-side token revocation fails.
- **Follow-up:** Verify `POST /auth/logout` exists in `routers/auth.py`. If not, implement it to revoke the active refresh token (set `is_revoked = True` in `RefreshToken` table) and clear cookies.

---

### Spring Boot messaging auth uses httpOnly cookie — not Bearer header
- **Decision:** Both `JwtAuthFilter` (REST) and `JwtHandshakeInterceptor` (WebSocket) read the `access_token` httpOnly cookie.
- **Impact on tests:** REST tests must inject `new Cookie("access_token", token)` via `MockMvc`. WebSocket tests must set `Cookie: access_token=<token>` on `WebSocketHttpHeaders` at connect time — without it, the WS upgrade is rejected before any frame is sent.
- **Follow-up:** Any new REST endpoint or WS handler in the messaging service follows the same cookie contract — do not introduce Bearer header auth unless `JwtAuthFilter` is updated to support it.

---

### Settings tabs use query params, not nested routes
- **Decision:** `SettingsPage` reads `?tab=profile|account|danger` via `useSearchParams()` to switch tabs. Tab links use `?tab=X`, not `/settings/profile`, `/settings/account`, etc.
- **Reason:** Settings is a single page with shared layout state (the sidebar, the tab bar). Nested routes would require a parent layout route and child route components wired through React Router's `<Outlet>` — added complexity for no navigational benefit. Query params keep the component self-contained, preserve browser back/forward, and allow deep-linking to a specific tab without restructuring the route tree.
- **Follow-up:** If a tab ever needs its own nested sub-routes (e.g., `/settings/account/change-password`), migrate that tab to a proper nested route at that point — don't pre-emptively restructure.

---

### Sidebar avatar reuses the `['me']` TanStack Query cache key
- **Decision:** `SideBar` fetches `/users/me` under the same `['me']` query key used by `ProfileTab` in Settings, rather than a separate key.
- **Reason:** TanStack Query deduplicates in-flight requests and shares cached data across all components using the same key. When the user uploads a new avatar in Settings, `ProfileTab` calls `queryClient.invalidateQueries({ queryKey: ['me'] })`, which automatically refetches and updates the sidebar avatar too — no extra invalidation wiring needed.
- **Trade-off:** The sidebar is always mounted (it's inside the layout), so `/users/me` is always fetched on app load. This is intentional — it's needed to show the avatar. Any component that mutates the current user must invalidate `['me']` to keep the sidebar in sync.

---

---

## 2026-04-03 — Profile Page Redesign

### Profile page imports types from `@/shared/types/Types`, not a local `./Types`
- **Decision:** Updated `UserProfile.tsx` import from `"./Types"` to `"@/shared/types/Types"`.
- **Reason:** There is no `Types.tsx` in `frontend/src/features/profile/pages/`. The original import was broken — all shared types live in `src/shared/types/Types.tsx`.

---

### `sticker_count` inline edit uses optimistic update with revert on error
- **Decision:** On blur/Enter, profile state is updated immediately with the new value before the PATCH resolves. If the request fails, the previous value is restored from a local variable captured before the update.
- **Reason:** Avoids a visible loading state on what should feel like an instantaneous edit.
- **Trade-off:** A race condition exists if the user edits again before the first PATCH resolves. Acceptable for v1 — single-user operation on their own profile.

---

### Post type tabs filter already-transformed posts at render time — no re-fetch
- **Decision:** The `image_paths` transform (API `images` array → URL strings) runs once in `fetchProfile` and is stored in state. Tab switching filters `profile.posts` in the component — it does not trigger a new request.
- **Reason:** Avoids redundant API calls on tab switch and keeps the transform logic in one place.
- **Follow-up:** If tabs ever need server-side pagination, this will need to move to per-tab queries.

---

---

## 2026-04-03 — Testing Architecture

### Test database isolation — `antcollect_test`
- **Decision:** All tests run against a separate `antcollect_test` database. The dev database (`antcollect`) is never touched by any test.
- **Reason:** Tests create and delete rows. A failed teardown leaves garbage in real tables. Tests and live requests racing on the same data produce flaky results.
- **Setup:** See `docs/DB_SETUP.md` — same users, same schemas, same permissions. Only the database name differs.

---

### Unit tests do not need a database
- **Decision:** Unit tests mock or bypass the DB layer entirely.
- **Reason:** Unit tests validate isolated logic (a function, a class). Bringing in a real DB adds setup cost, makes tests slow, and couples unrelated concerns. If a test needs a real DB to work, it is an integration test, not a unit test.

---

### Integration tests — how each service swaps to the test DB
- **Decision:** Each service uses a config override mechanism at test time — no application code changes required.
- **FastAPI:** Set `DB_NAME=antcollect_test` as an env var before the app module loads. `alembic/env.py` and `database.py` both read from env, so the swap is transparent.
- **Spring Boot:** `src/test/resources/application-test.yml` overrides only `spring.datasource.url` to point at `antcollect_test`. Test classes are annotated `@ActiveProfiles("test")`. Spring merges the two config files — test values win.
- **Reason:** Application code must not contain test-specific branching. Config override is the correct separation point.

---

### E2E tests run both services in test-DB mode simultaneously
- **Decision:** E2E / Playwright tests require both FastAPI and Spring Boot to be running and both pointed at `antcollect_test` before the browser tests start.
- **How:** FastAPI started with `DB_NAME=antcollect_test`, Spring Boot started with `--spring.profiles.active=test`. In CI, GitHub Actions spins up a fresh PostgreSQL container — no local DB needed.
- **Reason:** E2E tests must reflect real service behaviour end-to-end. Mocking either service at this layer defeats the purpose.

---

## 2026-04-04 — Test Scaffold (Session 1)

### `auth_client` calls the real login endpoint — no shortcut
- **Decision:** The `auth_client` test fixture calls `POST /users/login` with real credentials and lets the cookie be set naturally, exactly as a browser would.
- **Reason:** Manually injecting a fake cookie in tests would skip the login route entirely. If the login endpoint ever broke, those tests would still pass and you'd have no idea. Hitting the real endpoint means the login flow is always being tested too.
- **Credentials needed:** `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in `.env` locally, and as GitHub secrets in CI. Must be a real user that exists in `antcollect_test`.

---

### Frontend tests fail loudly on unmocked requests
- **Decision:** MSW is configured with `onUnhandledRequest: 'error'` in `src/test/setup.ts`.
- **Reason:** If a component makes a network request that has no handler defined in `src/test/handlers.ts`, the test fails immediately with a clear error. Without this, the request would silently do nothing and the test might pass even though the component is broken.
- **Practical rule:** Every API call a component makes needs a matching handler in `handlers.ts` before you can test that component.

---

### No Maven wrapper (`mvnw`) in the project
- **Decision:** The repo has no `mvnw` or `mvnw.cmd`. All Maven commands use `mvn` directly.
- **Reason:** It was never added. Maven is installed system-wide so the wrapper isn't needed.
- **Impact:** Do not write `./mvnw` in any script or doc — it will fail. Use `mvn`.

---

## 2026-04-04 — Folder System (Option 2 — many-to-many via join table)

### Why a join table instead of a direct FK on Post
- **Decision:** Folders use a `folder_posts` join table rather than adding a `folder_id` FK directly to `posts`.
- **Reason:** A post must be able to belong to multiple folders simultaneously. A FK on `Post` would restrict it to one folder. The join table is the correct relational model for a many-to-many relationship.

---

### `order_index` — gap behaviour on removal
- **Decision:** When a post is removed from a folder its `order_index` slot is **not** compacted. Remaining rows keep their existing indices. New posts append at `max + 1`.
- **Reason:** Reordering all remaining rows on every delete is an O(n) write requiring a transaction. Gaps in the index are harmless — the query orders by `order_index` and the unique constraint still prevents collisions.
- **Follow-up:** If drag-and-drop reordering is added, implement a dedicated reorder endpoint that reassigns indices transactionally. Do not try to compact on every delete — that creates lock contention.

---

### `order_index` computed with `COALESCE(MAX(...), 0) + 1` — not application-side `len()`
- **Decision:** New `order_index` = `SELECT COALESCE(MAX(order_index), 0) + 1 FROM folder_posts WHERE folder_id = ?`, computed inside the insert transaction.
- **Reason:** Using Python `len()` on the relationship is wrong after any removal creates a gap, and requires loading the full relationship into memory. The subquery reads live DB state in the transaction.
- **Edge case:** Under extreme concurrency two requests could read the same `MAX` and hit `uq_folder_post_order`. The `IntegrityError` handler returns 409. For single-user folders this is not a real concern in v1.

---

### `cover_post_id` ownership check on PATCH
- **Decision:** `PATCH /folders/{folder_id}` validates that the cover post's `user_id` matches the requester before setting it.
- **Reason:** Without this, any authenticated user could set another user's private/unpublished post as their cover just by knowing its ID, leaking the post's existence.

---

### Post model untouched — no `back_populates` on `Post`
- **Decision:** `FolderPost.post` is a one-directional relationship with no `back_populates`. The `Post` model has no `folder_posts` attribute.
- **Reason:** Adding a reverse relationship forces SQLAlchemy to consider `folder_posts` whenever `Post` is loaded, potentially causing unexpected queries in existing endpoints. The folder router accesses posts via explicit joins and does not need the reverse side.

---

### Visibility rules — non-owner gets filtered posts, not 403, for public folders
- **Decision:** Non-owners viewing a public folder see only posts where `public=True AND is_published=True`. Private/draft posts are silently excluded — no error.
- **Reason:** A folder being public does not imply all its posts are public. A draft post in a public folder must not leak to visitors.
- **Contrast:** A private folder (`is_public=False`) returns 403 immediately — its existence is not confirmed.

---

### Static route `/folders/user/{username}` must be declared before `/{folder_id}`
- **Decision:** The `GET /folders/user/{username}` handler is registered before `GET /folders/{folder_id}` in `routers/folders.py`.
- **Reason:** FastAPI matches routes in declaration order. If `/{folder_id}` came first, `/folders/user/alice` would match with `folder_id="user"`, fail the integer parse, and 422. This mirrors the `/me/*` before `/{user_id}` pattern in `routers/users.py`.
- **Rule:** Any static path segment at the same level as a dynamic `{param}` must be declared first.

---

### `409 Conflict` on duplicate post — caught via `IntegrityError`, not a pre-check SELECT
- **Decision:** Duplicate post detection relies on catching `sqlalchemy.exc.IntegrityError` from the `uq_folder_post` constraint, not a pre-insert SELECT.
- **Reason:** A pre-insert SELECT is a TOCTOU race — two concurrent requests could both pass the check and both attempt the insert. Catching the DB constraint violation is the correct approach and avoids an extra round-trip.

---

## 2026-04-05 — Folder Frontend (Create flow + profile grid integration)

### `CreateMenu` is a pure callback component — no routing or store knowledge inside it
- **Decision:** `CreateMenu` receives `onSelectPost`, `onSelectFolder`, and `onClose` as props. It does not call `useNavigate` or `useUIStore` directly.
- **Reason:** Keeps the component reusable and independently testable. The routing decision (navigate to `/create-folder`) belongs to `Layout.tsx`, which is the mount point and has access to both the store and the router. This separation also makes it trivial to swap the menu's visual form (bottom sheet, radial menu, popover) without touching any dispatch logic.

---

### `/create-folder` is a route, not a modal
- **Decision:** Folder creation is a full-page route at `/create-folder`, not an overlay modal like the post creation flow.
- **Reason:** Folder creation involves a scrollable post-selection grid — a modal is the wrong container for content that may be taller than the viewport. A dedicated page also gives a natural address for future deep-linking and browser back navigation.
- **Extensibility:** Future folder editing is `/folders/:id/edit` — the same `CreateFolder` component receives the ID param and pre-fills name + selected posts. No structural changes needed.

---

### `GridItem` discriminated union — extensible grid entity type
- **Decision:** `PostGridLayout` now accepts `items: GridItem[]` where `GridItem = { kind: 'folder'; data: Folder } | { kind: 'post'; data: Post }`. Rendering dispatches on `item.kind` via a switch.
- **Reason:** A single flat `Post[]` cannot represent mixed entity types. The discriminated union makes the type contract explicit and exhaustive — TypeScript will error if a new `kind` is added to the union without a matching render case.
- **Extensibility:** Adding a new grid entity (e.g. `kind: 'album'`) requires only: (1) a new `kind` in the union, (2) a new card component, (3) one new case in `PostGridLayout`'s switch. No other files change.

---

### Folders pinned first in the grid — ordering enforced by the caller, not the grid
- **Decision:** `UserProfile` builds the `GridItem[]` array by spreading folders first, then filtered posts. `PostGridLayout` renders in the order it receives.
- **Reason:** Grid ordering is a product decision that belongs to the page using the grid, not to the grid itself. Putting ordering logic inside `PostGridLayout` would make it opinionated and harder to override in other contexts (e.g. a feed that interleaves folders with posts).

---

### Folders appear on all tabs — not filtered per tab
- **Decision:** The `gridItems` array always includes all folders regardless of the active tab. Only the posts portion is filtered by `activeTab`.
- **Reason:** Folders are cross-type containers — they can hold collection, looking-for, and trading posts simultaneously. Hiding folders on a tab where none of their posts match the tab type would be misleading and inconsistent.

---

### Profile fetches folders and profile in parallel with `Promise.all`
- **Decision:** `UserProfile` fetches `POST /users/get_user_` and `GET /folders/user/{username}` simultaneously via `Promise.all`.
- **Reason:** The two requests are independent — there is no reason to serialise them. A failed folder fetch degrades gracefully (folders remain empty array, posts still render) without blocking the profile.

---

### Folder post selection uses sequential `POST /folders/{id}/posts` calls — no bulk endpoint
- **Decision:** `CreateFolder.tsx` loops over `selectedIds` and fires one `POST /folders/{id}/posts` request per post.
- **Reason:** No bulk endpoint exists on the backend. Sequential calls are acceptable for the expected selection size (tens of posts, not thousands) in v1.
- **Follow-up:** If users start adding large numbers of posts at once, add `POST /folders/{id}/posts/bulk` accepting a list of post IDs. The frontend loop can be replaced with a single call without changing any other component.

---

### Folder avatar is `null` in v1 — placeholder UI only
- **Decision:** `FolderCard` renders a purple folder icon as the avatar area. `Folder.cover_post_id` and a future `avatar_path` field are typed as `number | null` and `string | null` in anticipation of upload support.
- **Reason:** Avatar upload for folders is the same flow as user avatar upload — it is deferred until after the core create/display flow is stable.
- **Follow-up:** Wire an upload button in `FolderCard` (owner view only) that calls `PATCH /folders/{id}` with a `cover_post_id`, or a new `POST /folders/{id}/avatar` endpoint if a dedicated image upload is preferred over using a post as the cover.

---

### `features/create/` is a new feature module — not nested under `posts/` or `profile/`
- **Decision:** `CreateMenu`, `FolderCard`, and `CreateFolder` live under `frontend/src/features/create/`.
- **Reason:** These components cut across posts and folders — they are not exclusively post components or profile components. A dedicated `create/` module avoids placing folder UI inside `features/posts/` (wrong domain) and keeps `features/profile/` focused on display rather than creation.
- **Structure:** `create/components/` for reusable pieces (`CreateMenu`, `FolderCard`), `create/pages/` for routed pages (`CreateFolder`).

---

## 2026-04-05 — WebSocket Messaging Bug Fixes

### STOMP fan-out and ack must use `MessageResponse` DTO, not the raw `Message` entity

- **Decision:** `MessageWebSocketHandler.handleSend` converts the persisted `Message` entity to `MessageResponse` via `toWebSocketMessage()` before the sender ack and recipient fan-out.
- **Reason:** Raw entity serialises as nested objects with numeric IDs; frontend expects flat string IDs matching the REST history DTO shape.
- **`conversationId` passed explicitly** to `toWebSocketMessage` — the `conversation` field is `LAZY` and calling `getId()` outside the `@Transactional` boundary throws `LazyInitializationException`.
- **Follow-up:** `EventPayload.edit` still passes the raw entity — convert to DTO when the edit feature is wired on the frontend.

---

## 2026-04-05 — Folder Type

### Folders scoped to Collection tab only on the profile grid
- **Decision:** `gridItems` in `UserProfile` only prepends folder `GridItem`s when `activeTab === 'collection'`. The Looking For and Trading Away tabs show only their respective posts.
- **Reason:** Folders are created with an explicit type now. Showing all folders on every tab — including tabs the folder has no relation to — was confusing and made the tabs feel identical.

---

### `folder_type` stored as a plain `VARCHAR(20)` with a server default — not a DB enum
- **Decision:** `folder_type` is `String(20)` with `server_default='collection'` on both the migration (`op.add_column`) and the ORM column. No PostgreSQL `ENUM` type.
- **Reason:** PostgreSQL enums are painful to extend — `ALTER TYPE` must be run before the migration itself, and Alembic has no native support for it. A constrained string is easier to migrate, easier to extend later, and the application layer (Pydantic + TypeScript) enforces the valid values.
- **Follow-up:** If strict DB-level enforcement is needed later, add a `CHECK (folder_type IN ('collection','looking_for','trading'))` constraint in a new migration.

---

### `folder_type` values mirror post `type` values
- **Decision:** Valid values are `'collection'`, `'looking_for'`, `'trading'` — the same three values used by the `posts.type` column.
- **Reason:** Folder type conveys the same intent as post type: what role does this content play in the user's collection? Reusing the same vocabulary keeps the model consistent and lets the UI reuse the same labels.

---

### TanStack Query cache must be updated on inbound message and ack

- **Decision:** `useSocketFrameHandler` calls `queryClient.setQueryData` in both `handleInboundMessage` (recipient append) and `handleAck` (sender append, with duplicate guard).
- **Reason:** Optimistic messages were written to Zustand only. On back-navigation within `staleTime`, `useMessages` overwrote Zustand with the stale cached page, making the new message disappear.
- **Duplicate guard:** `alreadyPresent` check in the ack path covers re-connect replays where the fan-out already appended the message.
- **Cache target:** Both writes go to `pages[0]` — new messages are always the most recent.

---

## 2026-04-07 — Trade Request System + Post Embeds

### Trade requests live in FastAPI / public schema — not in messaging

- **Decision:** The `trade_requests` table is owned by FastAPI (Alembic migrations, `public` schema). There is no trade-request logic in the Spring Boot messaging service.
- **Reason:** `trade_requests` references `posts`, `folders`, and `users` — all owned by FastAPI. Validating post ownership and folder ownership natively (via a single DB join) is impossible from the messaging service without cross-service HTTP calls. Keeping it in FastAPI avoids that complexity and keeps the messaging schema clean.
- **Follow-up:** `trade_requests` has no `conversation_id` column. The frontend orchestrates the accept flow (accept → create conversation → send `trade_context` message) via three sequential calls. The backend does not create the conversation.

---

### No WebSocket push for trade request badges — frontend polls

- **Decision:** `SideBar` polls `GET /trade-requests/inbox/count` via TanStack Query `refetchInterval: 30_000`. No WebSocket channel for trade request events.
- **Reason:** At ≤500 users the query is a trivial indexed `COUNT(*)` (`idx_trade_requests_recipient_pending` covering index). Adding a real-time notification channel for a pre-conversation handshake would require new STOMP topics, server-side session lookups, and messaging-service plumbing for events that originate in FastAPI — disproportionate complexity for the volume.
- **Trade-off:** 30-second delay between a request being sent and the recipient seeing the badge increment. Acceptable for a low-frequency, non-urgent interaction.
- **Follow-up:** If real-time trade notifications are needed, add a STOMP `/user/queue/trade` channel and have FastAPI push a notification via an HTTP call to the messaging service (or a shared Redis pub/sub).

---

### One pending request per (requester, target_post) enforced at the DB layer

- **Decision:** A partial unique index (`WHERE status = 'PENDING'`) on `(requester_id, target_post_id)` prevents duplicate pending requests. The router catches `IntegrityError` and returns 409.
- **Reason:** A pre-insert SELECT check is a TOCTOU race — two concurrent requests could both pass and both attempt the insert. The DB constraint is the correct enforcement point.
- **Note:** The index is partial — once a request is ACCEPTED, DECLINED, or EXPIRED, a new PENDING request for the same (requester, post) pair is allowed.

---

### Three-strike block enforced in the router — not a DB constraint

- **Decision:** The router counts `status = 'DECLINED'` rows for `(requester_id, recipient_id)` before inserting. If `>= 3`, it returns 403. No DB-level enforcement.
- **Reason:** A DB constraint cannot count across rows conditionally. The query is indexed (`idx_trade_requests_decline_count`) and runs as a single `COUNT(*)`. Router-side enforcement is the right layer for multi-row business rules.
- **Trade-off:** A race between two concurrent requests from the same user to the same recipient could both pass the count check. Acceptable — the worst outcome is one extra request going through before the next call catches it.

---

### `content_type VARCHAR(10)` was too narrow — widened to VARCHAR(20) in V3 migration

- **Decision:** Flyway `V3__add_content_types.sql` first `ALTER COLUMN content_type TYPE VARCHAR(20)`, then drops and recreates the CHECK constraint.
- **Reason:** `post_reference` is 14 characters and `trade_context` is 13. The original `VARCHAR(10)` from V1 would silently truncate or reject these values at the DB level even if the application-layer constraint allowed them.
- **Rule:** Always verify column length before adding new values to a CHECK constraint. The check and the column type are independent — both must be wide enough.

---

### Post embed content is a JSON snapshot stored inline — no foreign key to posts

- **Decision:** When a `post_reference` or `trade_context` message is sent, the message `content` field contains a JSON snapshot of the post data (caption, thumbnail path, usernames). No FK to `posts.id` in the messaging schema.
- **Reason:** The messaging service lives in a separate schema (`petrcollect_messaging`) and cannot reference `public.posts`. Storing a snapshot means the message history is self-contained — a post deleted from the main app does not break historical chat renders.
- **Trade-off:** If a post's caption or thumbnail changes after the message is sent, the embed shows the old data. This is intentional — the snapshot records what was true at the time of the trade conversation.

---

### `sendMessage` in WebSocketProvider accepts optional `contentType` — default `'text'`

- **Decision:** The `contentType` parameter is optional with a default of `'text'`. All existing callers that don't pass it are unaffected.
- **Reason:** Backwards-compatible extension — no existing call sites needed updating. The `trade_context` message sent during accept is the only current caller that passes a non-default value.
- **Rule:** Any new message type sent via STOMP must be added to both the TypeScript `ContentType` union and the Flyway CHECK constraint before it can be used end-to-end.

---

## 2026-04-07 — Pre-launch Security Hardening

### Rate limiting — dual-layer: slowapi (app) + nginx (edge)

- **Decision:** Rate limits are applied at two independent layers: slowapi decorators on FastAPI route functions, and `limit_req` / `limit_conn` zones in nginx.
- **Reason:** Defense in depth. nginx blocks bursts before they reach Python, saving thread pool capacity. slowapi catches abuse that bypasses nginx (e.g., direct EC2 access, future load balancers). Neither layer alone is sufficient: nginx has no knowledge of authenticated user identity; slowapi has no access to the kernel-level connection table.
- **BEHIND_PROXY env flag:** When `BEHIND_PROXY=true`, `get_real_ip()` reads the leftmost `X-Forwarded-For` IP (set by nginx). When false (local dev), `X-Forwarded-For` is ignored entirely — a client could otherwise spoof it to bypass IP-based limits.
- **`memory://` storage default:** Suitable for a single EC2 instance. If the service ever runs on multiple instances, swap `RATE_LIMIT_STORAGE_URL` to a Redis URL — no code changes required, only a config change.

---

### Cookie `secure` flag is now env-driven (`COOKIE_SECURE`)

- **Decision:** Both `auth.py` (`_cookie_response`) and `users.py` (`login`) now read `os.getenv("COOKIE_SECURE", "false").lower() == "true"` instead of hardcoding `secure=False`.
- **Reason:** `secure=True` requires HTTPS. In local dev there is no TLS — the browser would silently drop the cookie and all API calls would 401. On production EC2 behind nginx with TLS, `COOKIE_SECURE=true` in `.env` ensures the cookie is only ever sent over HTTPS.
- **Rule:** Set `COOKIE_SECURE=true` in the EC2 `.env`. Never set it in `application-test.yml` or local `.env`.

---

### Security response headers as Starlette middleware

- **Decision:** `SecurityHeadersMiddleware(BaseHTTPMiddleware)` in `main.py` injects `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, and `Permissions-Policy` on every response. HSTS is added only when `HTTPS_ENABLED=true`.
- **Reason:** Headers belong on every response, not route by route. Middleware is the correct injection point. HSTS is conditionally excluded because it must never be served over plain HTTP — a browser that receives HSTS on HTTP will refuse all future HTTP connections to the domain, breaking local dev permanently.
- **No CSP here:** `Content-Security-Policy` is set in nginx (`petrcollect.conf`) because it requires domain-specific values (the `DOMAIN` placeholder and the S3 wildcard). Duplicating it in Python would require env-var templating and go stale independently.

---

### WebSocket connection limiter — in-memory, max 3 per user

- **Decision:** `WebSocketConnectionLimiter` uses a `ConcurrentHashMap<Long, AtomicInteger>` capped at 3 concurrent connections per userId. Enforced in `JwtHandshakeInterceptor.beforeHandshake()` — returns 429 before the session is established.
- **Reason:** Without a limit, a single authenticated user can open arbitrary tab-duplicates or scripted connections, exhausting the STOMP broker thread pool and starving other users. 3 is generous for legitimate browser use (multiple tabs) while blocking scripted floods.
- **Decrement on disconnect:** `MessageWebSocketHandler.onDisconnected()` calls `limiter.disconnect(userId)` so the slot is freed immediately. No TTL-based expiry needed — STOMP sessions are long-lived and disconnect events are reliable.
- **Scale caveat:** In-memory state is not shared across JVM instances. Horizontal scaling (two EC2 nodes) would allow up to 3 × N connections where N = node count. Acceptable for free-tier single instance; replace with Redisson if scaling.

---

### nginx config — `petrcollect.conf` is manually installed, deploy job only reloads

- **Decision:** `infra/nginx/petrcollect.conf` is copied once to `/etc/nginx/sites-available/` during initial EC2 setup. The deploy job runs `sudo systemctl reload nginx` — it does NOT replace the config file.
- **Reason:** Automatically overwriting nginx config on every deploy is risky: a bad config push would take down the proxy layer for all users with no rollback. Manual install makes the operator consciously aware of config changes. `reload` (not `restart`) achieves zero-downtime config application after manual updates.
- **`/Uploads/` explicitly absent:** No nginx proxy for `/Uploads/`. Images are served directly from S3 public URLs — nginx has no involvement and no knowledge of image paths.


## 2026-04-08 — LocalStack for S3 Emulation

### Support for LocalStack via AWS_ENDPOINT_URL
- **Decision:** Added a dynamic S3 client and URL generator in ackend/utils/s3.py. If AWS_ENDPOINT_URL is set, the client uses it as the endpoint and generates path-style URLs (http://localhost:4566/bucket/key). Otherwise, it defaults to standard AWS S3 URLs.
- **Reason:** Development must be self-contained. Real S3 requires an internet connection and real AWS credentials, which slows down local dev and makes it harder for new contributors. LocalStack provides a perfect local-only replacement with one docker-compose up command.
- **Compatibility:** GitHub Actions and Production deployments do not set AWS_ENDPOINT_URL, so they naturally fall back to real S3 without any code branching or extra configuration.
- **Environment Defaults:** Added default "test" values for AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in the S3 client to avoid crashes when they are missing in local development environments.
---

## 2026-04-08 — MessageWebSocketHandler: dual-map session index + connect-time user cache

### Dual-map session index (O(1) getState)
- **Decision:** `MessageWebSocketHandler` now maintains two maps: `sessionStates` (sessionId → SessionState, the authoritative store) and `stateByUserId` (userId → SessionState, a secondary index). `getState(userId)` is a single `ConcurrentHashMap.get` call instead of a stream scan over all sessions.
- **Reason:** The original `getState` did an O(N) linear scan on every inbound STOMP frame. At 100 concurrent users each sending messages, this is 100 comparisons per frame. The dual-map adds one extra `put`/`remove` on connect/disconnect (infrequent) to eliminate the per-frame scan entirely.
- **Reconnect race:** `stateByUserId.remove(userId, state)` uses the two-arg `ConcurrentHashMap.remove` which is atomic — it only evicts if the stored reference equals the disconnecting session's state. If the user reconnected and `put` a new entry before disconnect fires, the new entry is left untouched.
- **Multi-session caveat:** `WebSocketConnectionLimiter` caps at 3 sessions per user. `stateByUserId` holds only the most recently connected session's state. All executors remain alive and drain on disconnect — only the `getState` lookup path is affected.

## 2026-04-08 — OIDC for GitHub Actions AWS Access

### Static IAM access keys replaced with OIDC role assumption in the e2e job

- **Decision:** The `e2e` CI job no longer uses `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` GitHub secrets. It uses `aws-actions/configure-aws-credentials@v4` to exchange the GitHub OIDC JWT for a temporary session on `petrcollect-github-deploy-role`.
- **Reason:** Static keys are long-lived credentials stored in GitHub secrets. If leaked (e.g., via a log line, a compromised dependency, or a public fork), they provide persistent AWS access until manually rotated. OIDC tokens are short-lived (~1 hour), scoped to a single job, and never stored anywhere.
- **IAM setup required:** OIDC identity provider at `https://token.actions.githubusercontent.com` (audience `sts.amazonaws.com`) + a role with a trust condition `repo:ORG/PetrCollect:*`. Without the condition, any GitHub Actions workflow from any repo could assume the role.
- **deploy job unchanged:** The `deploy` job only SSHes to EC2 and does not call AWS APIs directly. The EC2 instance's production boto3 calls should be authenticated via an EC2 IAM Instance Profile (attach a role with S3 access to the instance) so that `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` can also be removed from the production `.env`.
- **backend unit-test job unchanged:** `AWS_ACCESS_KEY_ID: test` and `AWS_SECRET_ACCESS_KEY: test` in the backend job are hardcoded fake values for the S3 mock — not real credentials.

---

### Connect-time UserSummary cache (zero DB hits per outbound message DTO)
- **Decision:** `onConnected` fetches the user row once (`userRepository.findById`) and stores `username` + `avatarPath` in a `UserSummary` record inside `SessionState`. `toWebSocketMessage` uses this cached value instead of querying the DB on every message.
- **Reason:** The previous implementation hit the DB on every `/app/send` frame to populate `senderName` and `senderAvatar` in the outbound DTO. Username and avatar are stable within a session.
- **Staleness trade-off:** If a user updates their username or avatar while connected, the cached values stay stale until reconnect. This is accepted for v1 — recipients will see updated identity on the next message sent after reconnect.

---

## 2026-04-14 — Infra and Compose File Visibility in Public Repo

### Remove operational deployment config from public repo; keep CI/CD compose files

**Decision:**
- `infra/` (nginx config, systemd units, DB init SQL) removed from the repo and added to `.gitignore`. Full git history purged via `git filter-repo`.
- `docker-compose.yml` (local dev) removed from the repo and added to `.gitignore`. A sanitized `docker-compose.example.yml` committed in its place — all hardcoded credentials and resource names replaced with `${ENV_VAR}` references.
- `docker-compose.prod.yml` and `docker-compose.ci.yml` kept in the repo. Both were already fully sanitized (zero hardcoded values); removing them would break the CI E2E job and CD deploy step.
- `infra/db/init-roles.sql` not restored. Its content was inlined directly into the `cd.yml` "Initialize RDS roles and schemas" step as `-c` commands, using `env:` block injection for passwords. File dependency eliminated.

**Reason:**
- `infra/nginx/petrcollect.conf` exposed the complete API surface map (every endpoint path, internal ports, rate-limit thresholds) and tech stack details — enough reconnaissance to target attacks. `infra/systemd/` revealed server user, working directory, and JVM flags. These provide zero value to code reviewers or recruiters.
- `docker-compose.yml` contained hardcoded local credentials (`postgres_admin_pw`), real S3 bucket name, and AWS region, all of which narrow an attacker's targeting window.
- `docker-compose.prod.yml` and `docker-compose.ci.yml` contain no sensitive data and are required by the pipelines; removing them offered no real security benefit at the cost of breaking CI/CD.
- Inlining the SQL eliminates a file that disclosed DB role names and schema structure, while keeping the deploy step fully self-contained.

**Trade-offs:**
- `infra/` is no longer version-controlled in this repo. Changes to nginx config, systemd units, or DB init scripts must be applied manually on the server or tracked in a separate private infra repo.
- The `docker-compose.example.yml` template requires contributors to create their own `.env` before running locally — no hardcoded fallbacks remain.
- If the repo was already publicly indexed before the history purge, the removed data may still be cached by GitHub's search index for a short window.

**Follow-up needed:** No.

---

## 2026-04-16 — Post Detail Modal + Trade Offer Panel

### PostDetailModal — portal-based, compound component pattern

**Decision:** `PostDetailModal` portals into `#modal-root` (sibling of `#root` in `index.html`), escaping the layout's stacking context. It composes `PostImageFrame` (image + overlay slot) and `TradeEntryButton` (absolute-positioned left-edge tab). The trade panel slides in to the LEFT of the image as a flex sibling, not over it.

**Why compound over monolithic:** `PostImageFrame` accepts `children` as absolute overlays — any future action (report, zoom, share) slots in as a child without touching the frame. `TradeEntryButton` knows only its open state and an `onClick`. `PostDetailModal` orchestrates them. Each piece is independently replaceable.

**Scroll lock + Escape:** `useEffect` sets `document.body.overflow = 'hidden'` on mount and cleans up on unmount. A second `useEffect` wires `Escape` to `onClose`. Both are standard patterns — no external library needed.

---

### OfferSlotGrid — state lifted to TradeOfferPanel

**Decision:** Slot state (`(Post | null)[]`) lives in `TradeOfferPanel`, not in `OfferSlotGrid`. `OfferSlotGrid` is a pure display component: receives `slots`, `onSelect(index)`, `onRemove(index)`.

**Why:** The slot picker flow requires `TradeOfferPanel` to fill a slot after `PostPickerModal` returns. If slot state were inside `OfferSlotGrid`, a `useImperativeHandle` ref would be needed to expose `fillSlot` — more complexity than lifting the state. Pure display components are simpler to reason about and test.

**Expansion rule:** When the last slot in the array is filled, `TradeOfferPanel` appends 2 new null slots. No slots are ever removed — only added. Implemented as a pure function inside the `setSlots` updater.

---

### offered_post_ids stored as JSONB — not a join table

**Decision:** `trade_requests.offered_post_ids` is a nullable `JSONB` column holding `list[int]`. Not a separate `trade_request_offered_posts` join table.

**Why:** A join table is appropriate when offered posts need to be queried independently, ordered with extra metadata, or have cascades. Here the offered post list is: read-only after creation, always fetched as a unit with the trade request, and at most 4–6 items. JSONB is the right tool — one column, no joins, one migration.

**Validation on create:** The router validates every post ID in the list exists and belongs to the requester before the row is written. Invalid IDs return 400/404, not a DB constraint violation.

**offered_folder_id co-exists:** Both fields are independently optional. A requester can offer a folder, a list of posts, both, or neither.

---

## 2026-04-18 — Post Grid: CSS Multi-Column Masonry + Hover-Only Metadata

### Replace fixed-ratio grid with variable-height masonry; extract PostCardOverlay

**Decision:** The post grid now uses CSS `column-count` multi-column layout (`columns-2 min-[768px]:columns-3 min-[1100px]:columns-4`) instead of a CSS Grid. Each card renders its image at natural dimensions (`width: 100%; height: auto`). All post metadata (user avatar, like count) is revealed via a hover overlay (`PostCardOverlay`) rather than always-visible header and bottom-bar rows. The overlay is extracted as an independent presentational component.

**Why CSS multi-column over a JS masonry library:**
CSS `column-count` is the only zero-JS path to a variable-height masonry layout with full browser support. The alternative — a JS library (Masonry.js, react-masonry-css) — calculates absolute positions from measured DOM heights on every paint, causing layout thrash and requiring a dependency. CSS `break-inside: avoid` on each card item achieves the same shortest-column fill without any scripting. CSS Grid's `grid-template-rows: masonry` exists but is behind a flag in Firefox only and is not production-ready.

**Why `PostCardOverlay` is a separate component:**
The hover UI (gradient, glassmorphism pill, bookmark icon) is visually complex — 60+ lines of JSX — but has zero internal state of its own. Extracting it makes `PostCard` readable (it composes two clear pieces: image and overlay) and makes the overlay independently testable. `PostCard` retains ownership of like state and the API call; the overlay receives `isLiked`, `likeCount`, `onLikeClick`, and `user` as props.

**Why metadata was moved to hover-only:**
A persistent header (avatar + username + options dropdown) and bottom bar (like count) above and below every image fragment the visual rhythm of a variable-height grid. Showing metadata only on hover lets the images speak for themselves in the browsing state while preserving full interactivity on demand.

**Hover transitions — opacity only, no transforms:**
`transition-opacity duration-200 ease` is applied to the overlay container. No `translate-y`, `scale`, or `shadow` transitions. Layout-shifting hover effects (card lift, image zoom) cause reflow in a multi-column layout — adjacent cards jump as the column height changes. Opacity transitions are compositor-only and produce no reflow.

**Responsive breakpoints:**
`columns-2 min-[768px]:columns-3 min-[1100px]:columns-4` uses Tailwind v3 arbitrary breakpoint syntax, avoiding a custom entry in `tailwind.config.js`. 1100px was chosen (not `xl: 1280px`) to match a visual density target — 4 columns at 1100px leaves cards wide enough for vertical images to read clearly.

**`PostGridLayout` outer wrapper removed:**
The `w-full max-w-6xl mx-auto px-4 py-8` wrapper that previously lived on the grid container was removed. Both callers (`HomePage`, `UserProfile`) already supply their own max-width containers. Duplicating the constraint inside the grid caused double-wrapping.

**Trade-offs:**
- CSS multi-column fills columns top-to-bottom, left-to-right — not strictly shortest-column order. At 4 columns a tall image early in the list creates a visually uneven final row. A JS masonry library can fill the shortest column; CSS cannot without scripting.
- Folder cards (`FolderCard`) use `aspect-square` internally and are visually fixed-height; they participate in the masonry grid unchanged. On narrow screens two adjacent folder cards produce an intentionally uniform two-column band.
- Bookmark icon is a UI stub — no backend write endpoint exists. The button fires `e.stopPropagation()` and does nothing. See **Follow-up**.

**Follow-up:**
- Implement `POST /posts/{id}/bookmarks` (or `POST /folders/{id}/posts` with a designated "Saved" folder) if the bookmark icon is to be functional.
- If strict shortest-column ordering becomes a product requirement, replace `column-count` with a lightweight JS columnar layout (no DOM measurement needed — slot posts into N arrays by index, render N `<div className="flex flex-col">` containers). The `PostCardOverlay` component is unchanged either way.

---

## 2026-04-08 — Trade Request Status Visibility

### Unified Trade Panel with Sent Requests
- **Decision:** Added a "Your Sent Requests" section to the `SideBar` trade panel and updated the `TradeRequestResponse` schema to include recipient data (`recipient_username`, `recipient_avatar`).
- **Reason:** Users need to track the status of trades they've initiated (Pending, Accepted, Rejected) without navigating away from their current page. A unified panel provides a single source of truth for all trading activity.
- **UX Design:** Introduced `SentTradeRequestCard` with high-visibility, color-coded status badges (Amber for Pending, Green for Accepted, Red for Rejected). This ensures immediate cognitive recognition of request status.
- **Engineering:** Leveraged the existing `/trade-requests/sent` backend endpoint. Updated the `TradeRequestStore` (Zustand) to manage both incoming and outgoing requests, fetching both in parallel when the panel opens to minimize latency.
$entry
---

## 2026-04-19 — Post Deletion UI Implementation

**Decision:** Implemented a full-stack post deletion flow. The `PostCard` determines ownership via `localStorage.userId` and provides a delete handler that calls `DELETE /posts/{id}`. This handler is passed up through `PostGridLayout` to parent pages (`HomePage`, `UserProfile`, `SearchResultsPage`, `FolderPage`), which then perform an optimistic local state update to remove the post from the grid.

**Reasoning:** Deletion was previously only accessible via the `PostDetailModal` (and only on the profile page). Moving it to the `PostCard` level (on hover) makes it discoverable and consistent across all views where the user sees their own posts. Optimistic local state updates provide immediate feedback without requiring a full page or data re-fetch.

**Trade-offs:** Deletion logic is duplicated across several page components. This was chosen to keep the pages' data-fetching and state-management patterns (some use `useState`, others use TanStack Query) independent for now.

**Follow-up:** Consolidate page-level state into a shared cache or more consistent TanStack Query usage to reduce duplicate removal logic.

---

## 2026-04-20 — CloudWatch Log Driver Wired

**Decision:** Added `awslogs` Docker log driver to both `backend` and `messaging` services in `docker-compose.prod.yml`. Log groups: `/petrcollect/backend` and `/petrcollect/messaging`, stream `production`. Region sourced from the existing `${AWS_REGION}` env var. `awslogs-create-group: "true"` lets Docker auto-create the groups on first write — no manual CloudWatch setup required.

**Prerequisite:** EC2 instance profile must have `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` on `arn:aws:logs:*:*:log-group:/petrcollect/*` and `arn:aws:logs:*:*:log-group:/petrcollect/*:*` (stream-level ARN required for `PutLogEvents`).

**Effect:** Once deployed, `docker compose logs` on EC2 returns nothing — logs go directly to CloudWatch and are no longer stored locally. Local dev (`docker-compose.yml`) is unaffected.

**Follow-up:** Frontend logging (`src/shared/utils/logger.ts`, `fetchWithAuth` timing wrapper, `ErrorBoundary`, `window.onerror`) still TODO.

---

## 2026-04-19 — Modular PostOptionsMenu Component

**Decision:** Extracted the "three dots" options menu from `PostCardOverlay` into a standalone `PostOptionsMenu` component. This component encapsulates its own open/close state, click-outside handling, and the rendering of specific menu items (Delete Post, Cancel).

**Reasoning:** The `PostCardOverlay` was becoming too complex with inline menu logic. By extracting `PostOptionsMenu`, the overlay remains a clean presentational container, and the menu logic becomes reusable and easier to test. It also follows the directive to build UI "based on components."

**Visuals:** Replaced the bookmark icon (top right) with the `MoreVertical` (three dots) icon. The bookmark feature was a UI placeholder with no backend support, and the user requested its removal in favor of the options menu.

**Follow-up:** Add more options to the menu (e.g., "Edit Caption", "Share") as those features are implemented.

---

## 2026-04-20 — Content Reporting System (v1)

**Decision:** Added a full-stack reporting system for posts (extensible to users). Architecture:
- **DB:** `reports` table with a polymorphic `(target_type, target_id)` pair — no FK on `target_id`, validated in the router. Duplicate pending reports from the same user are blocked by a partial unique index.
- **Backend:** `POST /reports` (auth required, 10/hour rate limit). Router isolates processing in `_process_report()` — a no-op stub that is the designated drop point for a future AI `BackgroundTask`.
- **Frontend:** "Report Post" option added to `PostOptionsMenu` for non-owners. `PostCard` owns `reportModalOpen` state and renders `ReportModal`, which provides a five-reason radio picker and a success/error state.

**Why polymorphic `(target_type, target_id)` instead of separate FK columns per entity type:**
Adding a column like `post_id BIGINT FK → posts` for every reportable entity type would require a schema migration and null columns for every non-matching row each time a new entity is added. The polymorphic pair with a check constraint on `target_type` keeps the schema stable — adding `target_type = 'comment'` in the future requires only a CHECK constraint update, not a new column. Router-level validation compensates for the missing FK.

**Why `ai_score`, `notes`, `reviewed_at` are nullable and present from day one:**
These columns define the contract for the AI pipeline slot. Writing them into the table now means the AI integration later requires zero schema migrations — only a code change to `_process_report()`.

**Why the Report button is hidden from post owners:**
Reporting your own content has no meaningful moderation use case. The button is conditionally rendered only when `!isOwner` in `PostOptionsMenu`.

**Why status `'actioned'` implies temporary suspension, not hard deletion:**
`is_published = False` is reversible by an admin. Hard deletion cannot be undone. Keeping the post in the DB with `is_published = False` allows a reviewer to inspect the content, override the AI decision, or restore it. This also prevents false-positive AI scores from permanently destroying legitimate content.

**Rate limit:** 10/hour per user (per-user key via `get_user_or_ip_key`). Low enough to prevent report-bombing; high enough for legitimate use.

**Trade-offs:**
- Polymorphic target has no DB-enforced referential integrity on `target_id`. A report on a deleted post will have a dangling `target_id`. Acceptable — reports are moderation records, not entity relationships. The router validates existence at report creation time.
- No admin UI in v1. Reports are readable only via direct DB query or a future admin panel.
- No notification to the reported user or the reporter beyond the modal confirmation.

**Follow-up — when adding AI:**
1. Replace the no-op body of `_process_report(report_id)` in `backend/routers/reports.py` with the AI call.
2. Add `background_tasks: BackgroundTasks` parameter to `create_report` and call `background_tasks.add_task(_process_report, report.id)` before `return`.
3. The AI function should write `ai_score`, `notes`, `reviewed_at` back to the row and conditionally set `status = 'actioned'` + `post.is_published = False` when score exceeds a threshold.
4. No schema changes required.


---

## 2026-04-21 � frontend � Reposition Post Info Below Image & Increase Grid Spacing

**Decision:** Increased the bottom margin of posts in the grid (PostCard components) and moved the hover overlay's 'info row' (avatar, username, like button) to appear below the image instead of on top of it.

**Reasoning:** Placing likes and user info directly on the image was visually cluttered and often obscured the content. Moving these elements below the image on hover provides a cleaner viewing experience while still keeping the information easily accessible. The increased grid spacing (mb-6 to mb-12) ensures that the 'popped-out' info doesn't overlap with the post below it.

**Trade-offs:** Increases the total vertical height of the feed, requiring more scrolling.

**Follow-up:** None.

---

## 2026-04-21 � frontend � Styled 'Rectangleish' Info Box for Post Hover

**Decision:** Refined the post hover information row to be a distinct, white, rounded-xl container with a shadow-lg and border, appearing in the 48px (mb-12) gap below the image.

**Reasoning:** The previous 'floating' info row felt disconnected. Wrapping it in a distinct 'rectangleish' container with a shadow makes it feel like a physical UI element that 'pops out' from under the image, providing better contrast against the background and a more polished look. It also clearly occupies the space created by the increased grid margin.

**Trade-offs:** Adds more visual weight to the hover state compared to a simple text/pill overlay.

**Follow-up:** None.

## 2026-04-21 � frontend � Global Top Navigation Bar and Refactored Search

**Decision:** Added a global top-positioned Header containing the search bar and refactored the layout so the SideBar spans the full height of the viewport on the left.

**Reasoning:** Placing search in a global header follows standard UX patterns, ensuring it's always accessible and consistent across all pages. Moving the Header inside the content stack (to the right of the SideBar) ensures that the SideBar can maintain its full-height slide-out functionality without visual conflict.

**Trade-offs:** Removes redundant local search bars from HomePage, UserProfile, and SearchResultsPage, but requires more vertical space (64px) on every page.

**Follow-up:** None.

---

## 2026-04-28 — backend + frontend — Google OAuth 2.0 Sign-In/Sign-Up

**Decision:** Implemented Google OAuth using the Authorization Code Flow (server-side), not PKCE/implicit. New Google users are prompted to pick a username before account creation. Existing email/password accounts are silently linked if the Google email matches.

**Reasoning:**
- **Authorization Code Flow:** The app already uses httpOnly cookies for session management. The server receives the authorization code and exchanges it for tokens — the access/ID tokens never touch the browser. PKCE is for SPAs or mobile apps that can't keep a client secret.
- **No auto-generated usernames:** Usernames are user-facing identities (profile URLs are `/:username`). Auto-generating a random string would create ugly, permanent URLs. Prompting once at signup respects the existing identity model.
- **Pending JWT cookie for username picker:** After the Google callback verifies identity but before a user row exists, a short-lived `google_pending_token` (10 min, type-checked) is set as an httpOnly cookie. `/setup-profile` displays a welcome message and POSTs to `/auth/google/complete` to finalize. This avoids creating zombie user rows with placeholder usernames.
- **Account linking:** If the Google email already exists in the users table, `google_id` is set on the existing row and the user is logged in normally. No merge friction for users who sign up with email first.
- **State CSRF:** `secrets.token_urlsafe(32)` stored in an httpOnly cookie, verified with `secrets.compare_digest` (constant-time). Prevents authorization code injection from a third-party page.
- **AuthComplete page:** For returning/linked users, the backend redirects to `/auth/complete`. This page calls `/users/me`, populates localStorage, dispatches `auth:login`, then navigates to the profile. Avoids duplicating token-handling logic already in `/users/login`.
- **`samesite=lax` (not strict):** OAuth requires the browser to follow a cross-origin redirect from `accounts.google.com` back to our domain. `strict` drops cookies on any cross-site navigation, breaking state verification. `lax` sends cookies on top-level navigations while blocking CSRF from embedded content.
- **Only `.../userinfo.email` and `.../userinfo.profile` scopes:** Email is needed to identify/link accounts. Profile is needed for `name`/`given_name` to pre-fill the welcome message on the username picker.

**Trade-offs:**
- `password_hash` is now nullable, requiring null-guards in `POST /users/login` and `POST /users/me/password`. Any new endpoint that calls `verify_password` must check first.
- The pending-token pattern adds one extra round-trip for new users (callback → /setup-profile → /auth/google/complete), but is necessary to avoid partial account state in the DB.
- Account linking is silent (no confirmation email). Acceptable at this stage; can add explicit confirmation later if needed.

**Follow-up:** None.

 - - - 
 
 # #   2 0 2 6 - 0 4 - 2 2   �   f r o n t e n d   �   U n i f i e d   S e a r c h   E x p e r i e n c e   &   S i m p l i f i e d   H o m e   P a g e 
 
 * * D e c i s i o n : * *   R e m o v e d   t h e   \  
 E x p l o r e  
 t h e  
 H u b \   h e r o   s e c t i o n   a n d   r e d u n d a n t   l o c a l   s e a r c h   b a r s   f r o m   t h e   H o m e   P a g e   a n d   S e a r c h   R e s u l t s   P a g e .   R e p l a c e d   t h e m   w i t h   a   s i n g l e ,   a u t h o r i t a t i v e   s e a r c h   b a r   i n   t h e   g l o b a l   h e a d e r . 
 
 * * R e a s o n i n g : * *   U I   s i m p l i f i c a t i o n .   T h e   \ E x p l o r e  
 t h e  
 H u b \   s e c t i o n   w a s   t a k i n g   u p   s i g n i f i c a n t   v e r t i c a l   s p a c e   w i t h o u t   p r o v i d i n g   c r i t i c a l   f u n c t i o n a l i t y .   H a v i n g   m u l t i p l e   s e a r c h   b a r s   ( h e a d e r   v s .   p a g e   c o n t e n t )   w a s   c o n f u s i n g   a n d   r e d u n d a n t .   C o n s o l i d a t i n g   s e a r c h   i n t o   t h e   g l o b a l   h e a d e r   p r o v i d e s   a   c o n s i s t e n t ,   i n d u s t r y - s t a n d a r d   U X   w h e r e   s e a r c h   i s   a l w a y s   a v a i l a b l e   a t   a   p r e d i c t a b l e   l o c a t i o n ,   a l l o w i n g   t h e   m a i n   c o n t e n t   a r e a   t o   f o c u s   e n t i r e l y   o n   t h e   s t i c k e r   f e e d . 
 
 * * T r a d e - o f f s : * *   T h e   l a n d i n g   p a g e   i s   n o w   m o r e   \ u t i l i t y - f i r s t \   a n d   l e s s   \ h e r o - f i r s t . \   U s e r s   s e e   t h e i r   f e e d   i m m e d i a t e l y   w i t h o u t   a   d e c o r a t i v e   w e l c o m e   m e s s a g e . 
 
 * * F o l l o w - u p : * *   N o n e .  
 
 
 # #   2 0 2 6 - 0 4 - 2 9      H o l o g r a p h i c   S t i c k e r   E f f e c t 
 
 # # #   D O M - b a s e d   C a n v a s V i e w e r   r e p l a c e s   s t a t i c   P N G   o n   p r o f i l e   s h o w c a s e 
 
 * * D e c i s i o n : * *   A d d e d   a   n e w   p u b l i c   G E T   / c a n v a s / { u s e r n a m e } / d a t a   e n d p o i n t   r e t u r n i n g   t h e   f u l l   c a n v a s   J S O N .   T h e   p r o f i l e   s h o w c a s e   n o w   r e n d e r s   s t i c k e r s   a s   D O M   e l e m e n t s   v i a   C a n v a s V i e w e r   i n s t e a d   o f   a   f l a t   P N G   i m a g e .   S t i c k e r s   m a r k e d   h o l o :   t r u e   a r e   w r a p p e d   i n   H o l o S t i c k e r E f f e c t ,   w h i c h   a p p l i e s   C S S   c u s t o m - p r o p e r t y - d r i v e n   3 D   t i l t   +   r a i n b o w   s h i n e   ( c o l o r - d o d g e )   +   g l a r e   ( o v e r l a y )   o n   m o u s e   h o v e r      p o r t e d   f r o m   s i m e y d o t m e / p o k e m o n - c a r d s - c s s . 
 
 * * R e a s o n i n g : * *   C S S   b l e n d   m o d e s   ( c o l o r - d o d g e ,   o v e r l a y )   a n d   p e r s p e c t i v e - b a s e d   t r a n s f o r m s   r e q u i r e   D O M   e l e m e n t s ;   t h e y   c a n n o t   b e   a p p l i e d   t o   i n d i v i d u a l   n o d e s   i n s i d e   a   K o n v a   H T M L 5   c a n v a s .   E x p o s i n g   t h e   c a n v a s   J S O N   p u b l i c l y   i s   s a f e      t h e   s t i c k e r   i m a g e   U R L s   a r e   a l r e a d y   v i s i b l e   i n   t h e   r e n d e r e d   P N G   p r e v i e w ,   a n d   t h e   p o s i t i o n a l   d a t a   c a r r i e s   n o   s e n s i t i v e   i n f o r m a t i o n . 
 
 * * T r a d e - o f f s : * *   T h e   K o n v a   s t a g e   ( e d i t   m o d e )   i s   u n c h a n g e d ;   t h e   h o l o   e f f e c t   i s   v i e w - o n l y .   T h e   s a v e   p i p e l i n e   s t i l l   u s e s   s t a g e . t o D a t a U R L ( )   �!  S 3   P N G ,   s o   t h e   h o l o   e f f e c t   d o e s   n o t   a p p e a r   i n   t h e   s t a t i c   p r e v i e w   t h u m b n a i l .   T h e   p u b l i c   e n d p o i n t   a d d s   a   s e c o n d   n e t w o r k   r e q u e s t   o n   p r o f i l e   l o a d   ( p a r a l l e l   w i t h   t h e   p r e v i e w   f e t c h ) . 
 
 * * F o l l o w - u p : * *   N o n e .  
 

## 2026-05-01 — Google OAuth Security Hardening

### Token reuse detection, rate limiting, and cookie helper consolidation

**Decision:** Three security improvements to the OAuth and token refresh flows.

**1. Reuse detection on POST /auth/refresh-token**
A revoked refresh token presented outside the 60 s grace period is treated as a theft signal. The endpoint now bulk-revokes all active RefreshToken rows for that user before returning 401, and emits a structured WARNING log (event: auth.token_reuse_detected). This implements the OAuth 2.0 Security BCP recommendation: the attacker and the legitimate client both hold the stolen token; the first to use it triggers rotation; the second use of the now-revoked token kills every session.

**Why bulk-revoke all sessions, not just the token family:** A amily_id column would allow surgical per-chain revocation (the true RFC approach), but adds a migration and a second FK. Given the app's current scale, logging out all devices on a theft signal is an acceptable trade-off — the event is rare and the security gain is the same.

**2. Rate limit GET /auth/google**
Matched to POST /users/login: 5/minute per IP. Without this, the OAuth initiation endpoint was the only auth entrypoint with no slowapi guard. The endpoint now takes equest: Request as required by slowapi.

**3. _apply_auth_cookies shared helper**
Extracted from _cookie_response in outers/auth.py. Sets both httpOnly cookies on any response object (JSONResponse or RedirectResponse). _login_and_redirect in oauth.py previously duplicated the cookie settings inline with a "mirror these settings" comment — a maintenance hazard. Both paths now call the same function.

**Follow-up:** Add email verification on POST /users/create-user (requires Gmail API). Without it, the pre-registration attack vector exists — an attacker can register with a victim's email before the victim does, then link a Google account to it via the silent-merge path. Silent merging is safe once email verification is in place.


## 2026-05-02 — Admin Post Moderation

### Inline admin/moderator delete on any post

**Decision:** Allow users with role=admin or role=moderator to delete any post. No separate admin login or admin route — moderation surfaces inline on the existing 3-dot menu (PostCard) and as a parallel red button on PostDetailModal. Hard delete reuses the existing DELETE /posts/{post_id} cascade + S3 cleanup path; no schema change.

**Architecture seams introduced:**
1. `backend/utils/permissions.py` — pure predicates (`can_delete_post`, `is_acting_as_moderator`). Authorization rules live here, not in the route handler. New rules ("moderators can only delete posts under 24h old") become a one-file change.
2. `backend/utils/audit.py` — `log_admin_action` helper emits structured logs under the `admin.*` event prefix. Future swap to a DB audit table changes only this module — no callsite edits.
3. `frontend/src/shared/auth/session.ts` — single owner of all auth-related localStorage I/O. `LogIn`, `AuthComplete`, `AppProviders`, `AccountTab`, `fetchWithAuth`, `RequireAuth`, `PostCard`, `PostDetailModal` all migrated to `getSession`/`setSession`/`clearSession`. Future migration to Zustand or React Context becomes a one-file change.
4. `frontend/src/shared/auth/permissions.ts` — `canModeratePosts(session)` predicate. UI components ask the question, never read the role string directly.

**Why one endpoint with predicate auth, not a parallel /admin/posts route:** Parallel routes drift over time. A single endpoint with a small predicate function is the simpler contract and keeps the cascade/S3 cleanup logic in one place.

**Why role on a regular account, not a separate admin login portal:** Industry standard. Roles already existed on the User model with `user|moderator|admin` enum and the JWT already carries `role`. A second login form would duplicate auth surface for no security gain — the trust boundary is the JWT, not the form.

**Why localStorage role is acceptable for UI gating:** The frontend role flag is a UI hint only. Backend `can_delete_post` is the gate. A user who edits localStorage to set `role=admin` will see the menu entry but the API will return 403 — confirmed in the verification step. Documented this explicitly so future UI gates don't drift toward client-side trust.

**Why a separate `onAdminDeleteClick` callback rather than re-using `onDeleteClick`:** Keeps the menu component pure (no global state reads) and lets the parent show different confirm copy and emit different telemetry without the menu knowing about it.

**Bootstrap:** No UI to assign roles in v1. First admin promoted via SQL: `UPDATE users SET role = 'admin' WHERE email = '<addr>';`. User must log out and back in for the new JWT to carry the elevated role.

**Follow-up:**
- `/admin` page listing pending reports (the `reports` table is built and `_process_report` is a stub — wiring an admin queue UI on top of it is the natural next step).
- Self-serve role-promotion endpoint guarded by `RoleChecker(["admin"])` so admins can promote moderators without DB access.
- Migrate the remaining read-only `localStorage.getItem('userId')` callsites (FolderPage, CreateFolder, PostPickerModal, useSocketFrameHandler, ProfileTab, ChatPage) to `getSession()`. Behavior-equivalent, deferred to keep this PR focused on the moderation feature.
- DB-backed audit log replacing the log-line helper if moderation volume grows.

---

## 2026-05-05 — Quick Search Post Integration

### Added posts to the header search dropdown with inline modal preview

**Decision:** The quick search dropdown (header) now returns up to 4 matching posts alongside users. Clicking a post result opens the `PostDetailModal` immediately rather than navigating to a search results page.

**Why:** Clicking on posts in "search results" was a specific user requirement. The quick search dropdown is the primary search interface; requiring a full page transition to `SearchResultsPage` before a post could be clicked was a high-friction "dead end" for quick navigation. Inline modal support makes the app feel faster and more integrated.

**Backend change:** `_search_posts` is now called even for `search_type == "quick"`, but with a lower limit (4) to keep the dropdown response fast and the UI compact.

**Trade-offs accepted:**
- The dropdown can now get quite tall if both users (limit 10) and posts (limit 4) have many matches. Added a `max-h-[500px] overflow-y-auto` to the dropdown container to prevent it from pushing off-screen.
- Clicking a post in the dropdown closes the dropdown and clears the query, but doesn't change the URL. This is consistent with other modal-based interactions in the app.
