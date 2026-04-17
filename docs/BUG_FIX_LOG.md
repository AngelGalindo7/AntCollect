# PetrCollect — Bug Fix Log

Entry heading: `DD/MM/YYYY — fix(scope component): short title`
Body: 3–6 bullets — cause, fix, downstream risk. No code blocks.
Scopes: `frontend` · `backend` · `messaging` · `infra` · `docs`

---

## 16/04/2026 — fix(backend routers): CORS headers missing on 500 responses

- **Cause:** Starlette's `ServerErrorMiddleware` (outermost layer) catches any exception that escapes `ExceptionMiddleware` and generates a bare 500 response *outside* the `CORSMiddleware` layer — so no `Access-Control-Allow-Origin` header is added. The browser reports this as a CORS policy block, masking the real server error.
- **Trigger:** A `ProgrammingError` (unhandled DB exception not caught by `IntegrityError`) or any uncaught exception in a route handler could hit this path.
- **Fix:** Added `_generic_exception_handler` registered via `app.add_exception_handler(Exception, ...)`. Handlers registered this way are called by `ExceptionMiddleware`, which sits *below* `CORSMiddleware` in the stack — the `JSONResponse` it returns flows back up through CORS and gets the header attached.
- **Risk:** The handler logs `exc_info=exc` so the full traceback is preserved in structured JSON logs. Any exception type not previously caught by a more specific handler now returns `{"detail": "Internal server error"}` instead of Starlette's default HTML 500 body.

---

## 14/04/2026 — fix(ci cd): mkdir /opt/petrcollect permission denied in EC2 deploy

- **Cause:** Deploy step targeted `/opt/petrcollect`, which is owned by root. The EC2 SSH user has no write access to `/opt/`, so `mkdir -p /opt/petrcollect` raised `Permission denied` on every run.
- **Interim dead-end:** A `sudo mkdir + sudo chown` workaround was considered but discarded — it solved the permission error while keeping passwordless-sudo on the SSH user, meaning a leaked `EC2_SSH_KEY` still escalates to full root.
- **Fix:** Moved deploy directory to `~/petrcollect`. The SSH user already owns their home directory — no `sudo` required at all, removing the privilege-escalation path entirely.
- **Also changed:** `chmod 600 ~/petrcollect/.env` added to the deploy step; `target` in `appleboy/scp-action` and `cd` in the deploy script updated to `~/petrcollect`.
- **Risk:** First deploy after this change creates `~/petrcollect` automatically. If the EC2 instance is replaced, a full re-deploy recreates the directory with correct permissions.

## 14/04/2026 — fix(ci): aws CLI not found in EC2 SSH migration and deploy steps

- **Cause:** `appleboy/ssh-action` executes remote scripts in a non-login, non-interactive Bash shell. `aws` CLI was either not installed or not on the non-interactive PATH on the EC2 instance, so `aws: command not found` was raised.
- **Cascade:** The broken pipe from the failed `aws` call sent EOF to `docker login`, which then tried to prompt for credentials interactively and failed with `cannot perform an interactive login from a non TTY device`.
- **Fix:** Added a `Get ECR login token` step on the GitHub Actions runner (which has `aws` CLI and OIDC credentials). The token is masked via `::add-mask::` before being written to `$GITHUB_OUTPUT`, then forwarded to both affected SSH steps via `envs`. EC2 scripts now use `echo "$ECR_PASSWORD" | docker login --password-stdin` — no `aws` CLI required on EC2.
- **Removed:** `AWS_REGION` env/envs entry from the migration step (was only needed for `aws ecr get-login-password`).
- **Risk:** ECR tokens are valid for 12 hours, scoped to ECR pull/push only. Token is forwarded over encrypted SSH and redacted in all GitHub Actions logs.

## 14/04/2026 — fix(ci workflows): docker/build-push-action upgraded from v5 to v6

- **Cause:** `docker/build-push-action@v5` runs on Node.js 20, which GitHub Actions is deprecating (forced Node.js 24 default from June 2026, removal September 2026).
- **Fix:** Bumped all four `docker/build-push-action@v5` references across `ci.yml` and `cd.yml` to `@v6`, which is the current supported major release.
- **Risk:** v6 is a drop-in replacement for the `build-push` interface; no input changes required. Other affected actions (`checkout@v4`, `setup-node@v4`, `setup-python@v5`, etc.) use floating major-version tags that will auto-track to Node.js 24-compatible patch releases from their maintainers.

## 14/04/2026 — fix(messaging config): CORS allowed origins not trimmed after split

- **Cause:** `SecurityConfig.java` called `allowedOrigins.split(",")` directly. A comma-space-separated `ALLOWED_ORIGINS` env var (e.g. `https://a.com, https://b.com`) produced a leading-space entry that never matched a browser `Origin` header.
- **Fix:** Replaced `List.of(allowedOrigins.split(","))` with a stream pipeline that maps `String::trim` and filters empty strings before `.toList()`. Added `import java.util.Arrays`.
- **Risk:** None. FastAPI already applied `.strip()` on its side; this brings the messaging service to parity.

## 14/04/2026 — fix(messaging config): INTERNAL_SERVICE_SECRET unresolvable in test profile

- **Cause:** `application.yml` declares `app.internal.secret: ${INTERNAL_SERVICE_SECRET}` with no default. The CI messaging job does not pass `INTERNAL_SERVICE_SECRET`. Every `@SpringBootTest` test failed to load the application context (`BeanCreationException` on `TradeNotificationController`).
- **Fix:** Added `app.internal.secret: test-internal-secret` to `application-test.yml`. The test profile now satisfies the property without touching the production requirement.
- **Risk:** The test secret has no real authority — the internal endpoint validates it against the injected value, so no production traffic is affected.

## 14/04/2026 — fix(frontend sidebar): BACKEND_URL missing nullish-coalescing fallback

- **Cause:** `SideBar.tsx` declared `const BACKEND_URL = import.meta.env.VITE_BACKEND_URL` without a fallback. If `VITE_BACKEND_URL` is absent at Vite build time the template literal produces `"undefined/users/me"`, which throws a network error. `api.ts` already uses `?? "http://localhost:8000"`.
- **Fix:** Added `?? "http://localhost:8000"` to align with the shared `API_BASE` pattern.
- **Risk:** None. The fallback is only reached when the env var is unset, which means no other API call is working anyway.

## 14/04/2026 — fix(frontend messaging): BACKEND_URL missing nullish-coalescing fallback in ConversationSearch

- **Cause:** Same pattern as sidebar — `ConversationSearch.tsx` redeclared `BACKEND_URL` from `import.meta.env` without a fallback, used for the user-search POST call.
- **Fix:** Added `?? "http://localhost:8000"` fallback.
- **Risk:** None. Same as sidebar entry above.

## 14/04/2026 — fix(backend models): CommentLike exported in __all__ but never imported

- **Cause:** `backend/models/__init__.py` listed `"CommentLike"` in `__all__` but never imported the class. Any `from backend.models import CommentLike` or wildcard import raises `AttributeError`.
- **Fix:** Removed `"CommentLike"` from `__all__`.
- **Risk:** None. No code in the codebase imports `CommentLike` from this module.

## 14/04/2026 — fix(backend infra): remove unused python-magic dependency

- **Cause:** `python-magic` was listed in `requirements.txt` but never imported anywhere in the backend. The Dockerfile does not install `libmagic1`, so `import magic` would raise `ImportError` at runtime. All image validation is done via Pillow.
- **Fix:** Removed `python-magic` from `requirements.txt`.
- **Risk:** None. Reduces Docker image build time slightly; no code path used the package.

---

## 05/04/2026 — fix(frontend feed): PostGridLayout `posts` prop renamed to `items` in HomePage

- **Cause:** `PostGridLayout` was refactored to `items: GridItem[]` to support mixed folder/post grids, but `HomePage.tsx` still passed the old `posts` prop — TS2322 error in CI.
- **Fix:** Map `PostWithEngagement[]` to `GridItem[]` inline at the call site: `posts.map(p => ({ kind: 'post', data: p }))`. Added `GridItem` to the import. Type-safe because `PostWithEngagement extends Post`.
- **Risk:** All future callers of `PostGridLayout` must use `items: GridItem[]`, not a raw post array.

## 05/04/2026 — fix(frontend search): PostGridLayout `posts` prop renamed to `items` in SearchResultsPage

- **Cause:** Same as above — `SearchResultsPage.tsx` was also not updated when `PostGridLayout` was refactored.
- **Fix:** Same mapping pattern applied to `SearchPost[]`. `SearchPost extends Post`, so it satisfies the `'post'` data shape.
- **Risk:** See feed entry above.

---

## 05/04/2026 — fix(frontend auth): unauthenticated users see blank page instead of login redirect

- **Cause:** `fetchWithAuth()` in `api.ts` had the session-expiry redirect commented out; when both access and refresh tokens were invalid, the function threw silently and every protected route rendered nothing.
- **Fix:** On failed refresh, clear `username`, `userId`, and `email` from `localStorage`, then hard-redirect to `/Login` before throwing.
- **Risk:** Any in-flight TanStack Query or Zustand state is discarded on redirect — acceptable for an expired session. Ensure `/Login` does not try to read stale localStorage values on mount.

---

## 05/04/2026 — fix(frontend auth): WebSocket never connects after same-tab login

- **Cause:** `AppProviders.tsx` initialises `isAuthenticated` once at mount from `localStorage`, then listens on the browser `storage` event — which only fires in *other* tabs, never the writing tab.
- **Fix:** `LogIn.tsx` dispatches `new Event('auth:login')` after the `localStorage` write; `AppProviders.tsx` listens for `auth:login` alongside `storage`.
- **Risk:** Logout and SignUp have the same gap — if either writes `localStorage` without dispatching the matching event, `isAuthenticated` won't update until page refresh. Address when those flows are built.

---

## 06/04/2026 — fix(ci messaging): Spring Boot ignores CI secrets, times out on port 8080

- **Cause:** `application-test.yml` had hardcoded DB credentials and JWT secret. CI passed `MESSAGING_DB_USER` / `MESSAGING_DB_PASSWORD` / `JWT_SECRET` as env vars, but the YAML never referenced them — Spring Boot used the hardcoded values, failed to connect to Postgres, and crashed silently (backgrounded with `&`).
- **Fix:** Replaced all hardcoded credentials in `application.yml` and `application-test.yml` with `${ENV_VAR}` placeholders (no fallback defaults). Added env vars to root `.env`. Redirected Spring Boot output to `/tmp/messaging.log` in CI and added a "dump log on failure" step. Also removed hardcoded `CIOtherPass123!` in CI seed step — now uses `TEST_OTHER_PASSWORD` secret.
- **Docs:** Updated `DB_SETUP.md` and `postgresqlsetup.txt` to use `<your_password_here>` placeholder. Updated `MESSAGING.md` config section.
- **Action required:** Add `TEST_OTHER_PASSWORD` to GitHub repo secrets.
- **Risk:** Messaging service will fail to start if `MESSAGING_DB_USER` or `MESSAGING_DB_PASSWORD` env vars are missing — this is intentional to prevent silent credential mismatches.

---

## 06/04/2026 — fix(messaging db migration): Hibernate validation fails on public.users in test DB

- **Cause:** `V3__create_users_stub.sql` used `CREATE TABLE IF NOT EXISTS users` without a schema qualifier. Because `flyway.default-schema: petrcollect_messaging` is set in `application.yml`, Flyway created the table as `petrcollect_messaging.users`. The `User` entity maps to `@Table(name = "users", schema = "public")`, so Hibernate validation looked for `public.users` and found nothing, crashing `ConversationControllerTest` before any test ran.
- **Fix:** Added explicit `public.` qualifier — `CREATE TABLE IF NOT EXISTS public.users (...)`.
- **Risk:** If the `antcollect_test` DB is not recreated and Flyway has already recorded V3 in `flyway_schema_history`, the fix won't apply automatically. Drop and recreate the `antcollect_test` DB (or manually delete the V3 entry and the stale table) to let Flyway re-run the corrected script.

---

## 06/04/2026 — fix(frontend): Vitest incorrectly collecting Playwright e2e specs

- **Cause:** Vitest's default `include` pattern matched `e2e/*.spec.ts`, pulling in Playwright test files that use a different `test()` API — Playwright's runner threw "did not expect test() to be called here".
- **Fix:** Added `exclude: ['**/node_modules/**', '**/e2e/**']` to `vitest.config.ts` so Vitest only runs unit tests under `src/`.
- **Risk:** None — Playwright e2e tests are run by a separate `playwright test` command and are unaffected.

---

## 06/04/2026 — fix(backend utils): save_upload_file used wrong directory constant

- **Cause:** `save_upload_file` in `files.py` referenced `UPLOAD_DIR` but the module defines `UPLOAD_BASE_DIR`; `UPLOAD_DIR` was undefined, causing a `NameError` at runtime on any file upload.
- **Fix:** Replaced `UPLOAD_DIR` with `UPLOAD_BASE_DIR` in the `os.path.join` call.
- **Risk:** Verify `UPLOAD_BASE_DIR` points to the correct path in all environments; no fallback exists.

---

## 06/04/2026 — fix(frontend e2e): auth env vars renamed to TEST_USER_EMAIL / TEST_USER_PASSWORD

- **Cause:** `auth.spec.ts` and `helpers/auth.ts` referenced `TEST_EMAIL` and `TEST_PASSWORD`, but the CI secrets and `.env.test` were updated to use `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` — causing e2e auth setup to throw a missing-env error.
- **Fix:** Updated all references in both files to match the new env var names.
- **Risk:** Any other e2e files or CI steps still using the old names will break — audit if additional spec files are added.

---

## 06/04/2026 — fix(frontend e2e): ESM __dirname missing in globalSetup helper

- **Cause:** `helpers/auth.ts` used `__dirname` which does not exist in ES module scope; Playwright spawns globalSetup in a separate process, causing a `ReferenceError` before any test ran.
- **Fix:** Added `fileURLToPath(import.meta.url)` + `path.dirname()` to reconstruct `__dirname` — the standard ESM pattern already applied to `playwright.config.ts`.
- **Risk:** Any future helper files added to the `e2e/` directory must use the same shim if they need `__dirname`.

---

## 06/04/2026 — fix(frontend e2e): three test failures after CI seed produces no folders

- **Cause 1:** `profile.spec.ts` sticker-count test used `div.filter({ has: span('Stickers') }).first()` which matched the outer flex row (parent of both stat boxes), not the individual Stickers box. Once a seed folder existed (Folders count = 1), the numeric-span filter found two elements — strict mode violation.
- **Fix 1:** Narrowed locator to `div.flex-col` which matches only individual stat box divs, not the outer row container.
- **Cause 2:** `settings.spec.ts` used `page.locator('input[type="text"]')` which matched both the username field and the layout's persistent Search input — strict mode violation.
- **Fix 2:** Scoped all username input locators to `.max-w-2xl input[type="text"]`; the Search input lives in the sidebar outside the settings card.
- **Cause 3 (same session):** `profile.spec.ts` folder-click test assumed the freshly-seeded CI user had folders; CI seed only creates users. Added `test.beforeAll`/`afterAll` using the `request` fixture to create and delete a seed folder.
- **Risk:** If `.max-w-2xl` is removed from the settings card wrapper, the scoped selector breaks silently — it will resolve to the Search input and `toHaveValue` will fail with an empty string.

---

## 07/04/2026 — fix(messaging db migration): Flyway V3 version conflict between main migration and test stub

- **Cause:** `V3__add_content_types.sql` was added as a real production migration, colliding with the pre-existing `V3__create_users_stub.sql` in `src/test/resources/db/testdata/`. Flyway scans both locations in the test profile (`classpath:db/migration,classpath:db/testdata`) and refuses to start when two files claim version 3.
- **Fix:** Renamed `V3__create_users_stub.sql` → `R__create_users_stub.sql`. Flyway repeatable migrations (`R__` prefix) have no version number and run after all versioned migrations — version conflicts are structurally impossible.
- **Risk:** The `CREATE TABLE IF NOT EXISTS public.users` in the stub is idempotent, so the e2e job (where Alembic has already created `public.users`) is unaffected. Repeatable migrations re-run when their checksum changes — keep the stub content stable or accept it will re-apply on next startup.

---

## 07/04/2026 — fix(frontend messaging): WebSocket disconnects immediately on every connect

- **Cause:** `WebSocketProvider.tsx` called `sendSyncPayload(client)` inside `onConnect`. That function published to `/app/sync`, but `MessageWebSocketHandler.java` has no `@MessageMapping("/sync")` handler. Spring STOMP returns a STOMP ERROR frame for any unmapped `/app/*` destination.
- **Effect:** `@stomp/stompjs` disconnects on receiving the ERROR frame, then reconnects after 5 s (`reconnectDelay`), hits the same error, and loops forever. Real-time messages from other participants never delivered; read acks never sent.
- **Fix:** Removed the `sendSyncPayload(client)` call from `onConnect` and deleted the `sendSyncPayload` function and its now-unused `useConversationStore` import. Sync is a deferred feature — it requires a server-side handler before the client call can be re-introduced.
- **Risk:** On reconnect after network interruption, messages sent while offline will not be replayed until the server-side `/app/sync` handler is implemented. Workaround: user can manually refresh the conversation.

---

## 07/04/2026 — fix(backend routers): access_token cookie max_age was 60–120s instead of 30 minutes

- **Cause:** `auth.py` had `ACCESS_TOKEN_MAX_AGE = 1 * 60` (60s) and `users.py` had `ACCESS_TOKEN_MAX_AGE = 2 * 60` (120s). Comments in both said "31 minutes" — the constants were clearly intended to be `30 * 60` but were incorrectly written. The JWT itself expires in 30 minutes (set in `create_access_token`). After 1–2 minutes the cookie expired; all requests to the messaging service got 401. `fetchWithAuth` triggered a refresh cycle every minute, causing persistent loading states in the messaging UI.
- **Fix:** Both constants set to `30 * 60 = 1800s` to match the JWT expiry.
- **Risk:** Sessions are now longer-lived. The 30-day `refresh_token` cookie is unchanged. Logout (when implemented) must delete both cookies.

---

## 07/04/2026 — fix(frontend messaging): empty-state flash in ConversationList before Zustand is seeded

- **Cause:** `ConversationList` renders from the Zustand store (`conversations`), but the store is seeded by a `useEffect` that runs AFTER render. On the first render after a successful TanStack fetch, `conversations === []` even though `data` has arrived — the component showed "No conversations yet" as a transient flash before the store was populated.
- **Fix:** Added `displayList = conversations.length > 0 ? conversations : (data ?? [])`. The Zustand store is the primary source (includes real-time WebSocket upserts); raw `data` is the fallback only during the transient render gap.
- **Risk:** None — once `useEffect` seeds the store, `conversations.length > 0` and `data` is no longer consulted.

---

## 07/04/2026 — fix(frontend messaging): user result buttons used wrong field name and had no in-flight guard

- **Cause 1:** `UserResult` TypeScript interface had `profile_image?: string` but FastAPI's `UserResult` schema returns `avatar_path`. Avatars were never displayed (field always `undefined`).
- **Cause 2:** `handleSelectUser` had no in-flight lock — rapid double-clicks would fire multiple `POST /conversations` calls. First call might succeed and navigate; second would get 409 and navigate to the same conversation (benign but wasteful).
- **Cause 3:** 409 body parsing used `data.message.split(': ')[1]` without null checking `data.message`. If the body was unexpected, `existingId` would be `undefined` and `navigate('/messages/undefined')`.
- **Fix:** Renamed field to `avatar_path`. Added `creating` state that disables all user-result buttons while a POST is in-flight and shows "Opening…" feedback. Hardened 409 parsing with `String(body.message).split(': ')[1]` and an explicit null check that throws.
- **Risk:** None.

---

## 07/04/2026 — fix(frontend messaging): stale TanStack cache overwrites store after conversation creation

- **Cause:** `handleSelectUser` calls `upsertConversation(data)` then navigates to `/messages/{id}`. On navigation the inline `ConversationList` mounts and runs the `['conversations']` query against TanStack's cache, which still holds the pre-creation snapshot. The `useEffect` then calls `setConversations(staleData)`, overwriting the just-upserted conversation. The list showed "No conversations yet" immediately after creation.
- **Fix:** Added `queryClient.invalidateQueries({ queryKey: ['conversations'] })` after a successful `POST /conversations`, triggering a fresh fetch so the cache reflects the new conversation.
- **Also fixed:** Catch block in `handleSelectUser` was silently swallowing all errors with only `console.error`. Added a `createError` state that displays "Couldn't open conversation. Try again." inline, so failures are visible to the user.
- **Risk:** `invalidateQueries` fires an async background refetch. There is a brief window (~network round-trip) between navigation and the refetch completing where the list still shows empty. Acceptable for now.

---

## 07/04/2026 — fix(messaging infra): Spring Boot reads quoted .env values as literals, failing DB auth

- **Cause:** `application.yml` had no mechanism to load env vars from the root `.env` for local dev. Adding `spring.config.import: optional:file:../.env[.properties]` fixed the missing-var problem, but the `.env` used `KEY = "value"` syntax (Python dotenv style). Java's Properties parser does not strip quotes — `MESSAGING_DB_USER = "java_messaging_user"` resolved to the literal `"java_messaging_user"` (with double-quotes), causing PostgreSQL auth to fail.
- **Fix 1:** Added `spring.config.import: optional:file:../.env[.properties]` under the `spring:` key in `application.yml`. `optional:` means the file is silently skipped in deployment where the platform injects env vars directly; the `[.properties]` hint selects the Java Properties parser.
- **Fix 2:** Stripped double-quote wrappers from all values in the root `.env`. Python's `python-dotenv` handles both quoted and unquoted values identically; Java Properties requires unquoted.
- **Risk:** Any future `.env` values added with surrounding quotes will fail silently for Spring Boot (value will include the quote chars). Establish team convention: no quotes in `.env` values.

---

## 07/04/2026 — fix(backend routers): trade inbox crashes with AttributeError on PostImage.json_metadata

- **Cause:** `_build_response` in `trade_requests.py` read `first_image.json_metadata`, but `json_metadata` was moved from `PostImage` to `MediaAsset` when `PostImage` was refactored to use the `asset` FK. The attribute no longer exists on `PostImage`, so any request to `/trade-requests/inbox` raised `AttributeError`, the exception escaped the CORS middleware's response path, and the browser received a response without `Access-Control-Allow-Origin`.
- **Fix:** Changed the lookup to `first_image.asset.json_metadata` with a guard for `first_image.asset` being `None`.
- **Risk:** If a `PostImage` row has no linked `MediaAsset` (orphaned FK), `asset` will be `None` and the thumbnail will be `null` — acceptable fallback.

---

## 07/04/2026 — fix(frontend profile): folders always shown in Collection tab regardless of folder_type

- **Cause:** `UserProfile.tsx` built `gridItems` with `activeTab === 'collection' ? folders : []` — all folders were pinned to the Collection tab regardless of their `folder_type` field.
- **Fix:** Replaced the hardcoded tab check with `folders.filter(f => f.folder_type === activeTab)` so each folder appears only in the tab that matches its type.
- **Risk:** Folders whose `folder_type` is not one of the three tab values (`collection`, `looking_for`, `trading`) will silently disappear from the grid — backend validation should reject unknown types at creation time.

---

## 07/04/2026 — fix(frontend messaging): implicit any on ConversationList map parameter

- **Cause:** `queryFn` in `ConversationList.tsx` returned `res.json()` untyped (`any`). `displayList` fell back to `data ?? []`, which became `any[]`. TypeScript inferred `c` in `displayList.map((c) => ...)` as `any` — TS7006 error in CI.
- **Fix:** Added `as Promise<Conversation[]>` cast to `res.json()`. Imported `Conversation` from `../types`. `queryFn` now returns `Promise<Conversation[]>`, giving `data` and `displayList` correct types downstream.
- **Risk:** None — cast matches the shape the API already returns.

---

## 07/04/2026 — fix(messaging tests): ApplicationContext fails to load — INTERNAL_SERVICE_SECRET unresolved

- **Cause:** `application.yml` declares `app.internal.secret: ${INTERNAL_SERVICE_SECRET}` with no fallback, added when `/internal/trade-notify` was introduced. `application-test.yml` never set a test default, so Spring's `PropertySourcesPlaceholderConfigurer` threw on context load — all 6 tests in `ConversationControllerTest` and `JwtHandshakeInterceptorTest` errored before executing.
- **Fix:** Added `app.internal.secret: ${INTERNAL_SERVICE_SECRET:test-internal-secret-for-unit-tests-only}` to `src/test/resources/application-test.yml`, matching the existing pattern used for `JWT_SECRET`.
- **Risk:** Pattern to follow: any new `${ENV_VAR}` added to `application.yml` must have a corresponding test default in `application-test.yml` or the entire test context will refuse to load.

---

## 07/04/2026 — fix(backend): local disk image storage broken in containerised / multi-dyno deployments

- **Cause:** `process_and_save_image` wrote variants to `Uploads/{user_id}/{size}/{filename}` on the local filesystem. Containers restart with ephemeral disks; horizontally scaled deployments have no shared volume — images uploaded to one instance were invisible on all others.
- **Fix:** Replaced all disk writes with boto3 `put_object` calls to S3 via a new `backend/utils/s3.py` module. Each variant is captured in `io.BytesIO`, uploaded at key `posts/{user_id}/{size}/{filename}`. Return value is now a full `https://` public URL. `delete_file()` detects S3 URLs vs. legacy local paths and routes accordingly.
- **Also removed:** `StaticFiles(directory="Uploads")` mount from `main.py`; `mkdir -p Uploads` step from CI e2e job.
- **Also updated:** `MediaAsset.s3_key` column added (nullable) for direct key access; alembic migration `d4e5f6a7b8c9` applies it.
- **Downstream risk:** Messaging service components (`ConversationCell`, `ConversationSearch`, `ChatPage`, `MessageList`) prefix `${BACKEND_URL}/` to `avatar_path` — these will double-prefix now that `avatar_path` is a full S3 URL. Fix those four sites using the same `?? null` pattern applied to `SideBar`, `ProfileTab`, and `UserProfile`.

## 07/04/2026 — fix(frontend messaging): profile pictures not shown in messaging UI

- **Cause:** The messaging service returns `senderAvatar` / `participantAvatar` as raw DB `avatar_path` values (e.g., `Uploads/123/thumbnail/uuid.jpg`). The frontend correctly prefixes `${BACKEND_URL}/` when displaying avatars from FastAPI profile endpoints, but all four messaging render sites (`ConversationCell`, `ConversationSearch`, `ChatHeader` via `ChatPage`, `MessageList`) used the raw path directly as `<img src>` — the browser resolved it relative to the Vite dev server (`localhost:5173`) instead of FastAPI (`localhost:8000`).
- **Fix:** Added `BACKEND_URL` constant and `${BACKEND_URL}/${avatar}` prefix at each of the four render sites: `ConversationCell.tsx`, `ConversationSearch.tsx` (matched-conversation list), `ChatPage.tsx` (building `displayAvatar` before passing to `ChatHeader`), and `MessageList.tsx` (`MessageBubble` component).
- **Risk:** If `avatar_path` in the DB is ever stored as a full URL (e.g., after a future CDN migration), this prefix will double-prefix the URL. Normalise at the source (store relative paths only) or add a guard like `path.startsWith('http') ? path : \`${BACKEND_URL}/${path}\`` at that time.

---

## 07/04/2026 — fix(frontend messaging): messaging avatars double-prefixed after S3 migration

- **Cause:** The previous fix (above) added `${BACKEND_URL}/` prefix to `avatar_path` when the path was a local filesystem path. After the S3 migration, `avatar_path` became a full `https://` URL. The prefix now produced `http://localhost:8000/https://bucket.s3…` — a broken double-prefixed URL. Affected: `ConversationCell`, `ConversationSearch`, `ChatPage`, `MessageList`.
- **Fix:** Removed `BACKEND_URL` prefix entirely at all four sites. `avatar_path` is already a fully-qualified URL — used directly as `<img src>`. Removed the now-unused `BACKEND_URL` const from components where it had no other use.
- **Risk:** If a legacy DB row still holds a local path (pre-S3 migration), the avatar will be a broken relative URL. Acceptable — all live data was migrated.

---

## 07/04/2026 — fix(backend routers): hardcoded `secure=False` on auth cookies

- **Cause:** Both `auth.py` (`_cookie_response`) and `users.py` (`login`) had `secure=False` hardcoded on `set_cookie` calls. In production behind HTTPS, this allows the httpOnly access and refresh token cookies to be sent over plain HTTP — a transport security vulnerability.
- **Fix:** Replaced with `secure=os.getenv("COOKIE_SECURE", "false").lower() == "true"`. Default false preserves local dev behaviour; set `COOKIE_SECURE=true` in the EC2 `.env`.
- **Risk:** If `COOKIE_SECURE=true` is set without HTTPS, browsers will silently drop the cookie and all authenticated requests will 401. Only set in production.

---

## 07/04/2026 — fix(messaging config): stack traces and SQL logged in production

- **Cause:** `application.yml` had `server.error.include-message: always`, `include-stacktrace: always`, and `spring.jpa.show-sql: true`. In production these settings leak internal implementation details (stack traces, SQL) in HTTP error responses and server logs.
- **Fix:** Base `application.yml` now sets both error fields to `never` and `show-sql: false`. `application-test.yml` retains `always` / `true` so test failure output remains readable.
- **Risk:** Tests that parse error response bodies for specific message strings may need adjustment if they relied on the `always` setting in non-test environments.

---

## 07/04/2026 — fix(backend routers): `/test-db/` endpoint exposes DB internals

- **Cause:** `GET /test-db/` ran a raw `SELECT 1` against the database and returned its status (success or the exception message) as a public JSON response. Any anonymous client could probe the DB connection state or read exception details from failed queries.
- **Fix:** Removed `/test-db/` and its unused `Depends`, `Session`, `text`, and `get_db` imports. Replaced with `GET /health` returning `{"status": "ok"}` — no DB dependency, safe for public liveness probes. E2E CI wait-for-FastAPI step updated to use `/health`.
- **Risk:** Any external tooling or monitoring that polled `/test-db/` must be updated to `/health`.

---

## 14/04/2026 — fix(frontend messaging): VITE_API_URL set to FastAPI base — messaging REST calls routed to wrong service

- **Cause:** `VITE_API_URL` was set to `https://api.petrcollect.com/api` on Vercel — the same value as `VITE_BACKEND_URL` (FastAPI base). All four messaging components (`ConversationList`, `ConversationSearch`, `ChatPage`, `useMessages`) call `${VITE_API_URL}/conversations` or `${VITE_API_URL}/conversations/{id}/messages`. With the `/api/` prefix, nginx routes these to FastAPI (:8000), which has no `/conversations` route → 404.
- **Fix:** Set `VITE_API_URL=https://api.petrcollect.com` (no `/api` suffix) in Vercel environment variables. nginx routes `/conversations/` to Spring Boot :8080 — the prefix must match. Trigger a Vercel redeploy after the change; `VITE_*` vars are baked in at Vite build time.
- **Why two different base URLs:** `VITE_BACKEND_URL` includes `/api` because FastAPI endpoints live under that prefix in nginx. `VITE_API_URL` must NOT include `/api` because messaging endpoints (`/conversations`, `/messages`) are top-level routes in nginx, proxied directly to Spring Boot.
- **Risk:** None — the env var change only affects which URL prefix the four messaging components use. No code change required.

---

## 14/04/2026 — fix(messaging config): Flyway crashes on startup — schema name hardcoded, mismatches CD-created schema

- **Cause:** `application.yml` hardcoded `petrcollect_messaging` as the Flyway and Hibernate schema in three places. The CD creates the schema as `CREATE SCHEMA IF NOT EXISTS ${MESSAGING_DB_USER}` — named after the DB user secret. If `MESSAGING_DB_USER` ≠ `petrcollect_messaging`, the schema `petrcollect_messaging` is never created. Flyway tries to create it on startup, but the DB user lacks `CREATE` privilege on the database → permission denied → Spring Boot crashes in a restart loop.
- **Fix:** Introduced a dedicated `MESSAGING_DB_SCHEMA` GitHub secret (set to `petrcollect_messaging`). Updated `application.yml` to use `${MESSAGING_DB_SCHEMA}` in all three schema references (Flyway `schemas`, Flyway `default-schema`, Hibernate `default_schema`). Updated `cd.yml` to pass `MESSAGING_DB_SCHEMA` to the schema init step and use it throughout the SQL (`CREATE SCHEMA IF NOT EXISTS ${MESSAGING_DB_SCHEMA} AUTHORIZATION ${MESSAGING_DB_USER}`; `ALTER ROLE ... SET search_path TO ${MESSAGING_DB_SCHEMA}`; `GRANT ALL PRIVILEGES ON SCHEMA ${MESSAGING_DB_SCHEMA}`). Updated `docker-compose.prod.yml` to inject `MESSAGING_DB_SCHEMA` into the container at runtime.
- **Why CD passed green:** psql executes all `-c` flags sequentially without aborting on failure — a failed `CREATE SCHEMA` command returns a non-zero SQLSTATE but psql exits 0 if any later command succeeds, masking the error from GitHub Actions.
- **Requires CD re-run after secret is added:** The schema is created by the CD init step, not by the container. Adding the secret and pushing the fix is not enough — the CD must run with the secret present to actually execute `CREATE SCHEMA` on RDS. If the container still crashes after the commit lands, trigger the workflow manually via GitHub Actions → Run workflow.
- **Risk:** `MESSAGING_DB_SCHEMA` and `MESSAGING_DB_USER` are now independent secrets — they can differ. The schema is named by `MESSAGING_DB_SCHEMA` and owned by `MESSAGING_DB_USER`.

---

## 14/04/2026 — fix(infra nginx): trailing slash on messaging location blocks causes 301 + CORS failure

- **Cause:** nginx `location /conversations/`, `location /messages/`, and `location /internal/` all had trailing slashes. When the frontend calls `/conversations` (no trailing slash), nginx issues a 301 redirect to `/conversations/`. The 301 response has no `Access-Control-Allow-Origin` header (it comes from nginx, not Spring Boot) → browser blocks it as a CORS error before the request reaches the backend. Same root cause as the `/ws/` → `/ws` fix.
- **Fix:** Removed trailing slashes from all three location blocks and their corresponding `proxy_pass` URIs in `infra/nginx/petrcollect.conf`. Must be applied manually on EC2 (`sudo nano` + `sudo nginx -t && sudo systemctl reload nginx`).
- **Risk:** None — the change makes matching less restrictive, not more.

---

## 14/04/2026 — fix(infra nginx): WebSocket connection fails in production — location /ws/ doesn't match /ws

- **Cause:** `petrcollect.conf` declared `location /ws/` (trailing slash). The STOMP client connects to `wss://api.petrcollect.com/ws` (no trailing slash). nginx prefix matching requires the path to begin with `/ws/` — the bare path `/ws` does not satisfy that, so the request fell through to the `/api/` location block, which proxies to FastAPI. FastAPI cannot handle a WebSocket upgrade; the handshake failed and the browser logged repeated "WebSocket connection failed" errors.
- **Fix:** Changed `location /ws/` → `location /ws` and `proxy_pass http://127.0.0.1:8080/ws/` → `proxy_pass http://127.0.0.1:8080/ws` in `infra/nginx/petrcollect.conf`. Applied to the live EC2 via SSH edit + `sudo nginx -t && sudo systemctl reload nginx`.
- **Important:** The nginx config in `infra/nginx/` is a reference copy — it is NOT deployed by CI/CD. Changes must be manually SCPed to EC2 or edited in-place over SSH and reloaded. See CICD_LEARNINGS.md.
- **Risk:** None. The proxy_pass path change is symmetric — requests to `/ws` and `/ws/*` now both route correctly to Spring Boot :8080.

08/04/2026 — fix(frontend tests): Vitest config missing from vite.config.ts
- `vite.config.ts` had no `test` section — Vitest ran without jsdom, no setup file, no `@` alias, and scanned Playwright e2e specs
- All 7 test suites failed with "Cannot find package '@/test/handlers'" and Playwright API errors
- Fixed by importing `defineConfig` from `vitest/config` and adding `test` block: `environment: jsdom`, `setupFiles`, `exclude: ['e2e/**']`, and explicit alias resolution
- No downstream risk — Vite build is unaffected; `vitest/config` re-exports the full Vite config type with the `test` extension

## 08/04/2026 � fix(backend tests): disable rate limiting in test environment

- **Cause:** slowapi rate limits were being triggered during parallel or rapid test execution, causing 429 Too Many Requests or 400 Bad Request (from create-user) which led to test failures in 	est_users.py.
- **Fix:** Modified ackend/utils/rate_limit.py to check TESTING environment variable and PYTEST_CURRENT_TEST. Added os.environ["TESTING"] = "true" to ackend/tests/conftest.py.
- **Risk:** No production risk; the limiter remains active by default unless explicitly disabled via environment variables.


## 08/04/2026 — fix(backend routers): multiple critical bugs across auth, users, and posts
- **Cause (auth):** `db.query(...).first()` unpacked directly before None-check → `TypeError` crash on invalid refresh token; exception detail f-string leaked raw Python errors to client; logout endpoint was inside a docstring and never registered.
- **Fix (auth):** Assign `.first()` to `result`, guard then unpack; generic error message; proper `POST /auth/logout` with DB token revocation and cookie clearing.
- **Cause (users):** `retrieve_user_likes` named its auth dependency `user_id` (a `UserSearch` object) then used it in `PostLike.user_id ==` filter — wrong type; `create_user` had no `IntegrityError` catch → 500 on duplicate email/username; `POST /users/update-bio` and `POST /users/update-avatar` referenced undefined `current_user` and `save_upload_file`.
- **Fix (users):** Renamed to `current_user: UserSearch`; added `try/except IntegrityError` → 409; removed both broken dead endpoints entirely.
- **Cause (posts):** `upload_post` bare `except Exception` swallowed `HTTPException` from image validation (400/413) as 500; `GET /posts/top?k` had no upper bound.
- **Fix (posts):** `except HTTPException: raise` before generic handler; `k = min(max(k, 1), 100)`.
- **Risk:** Existing callers requesting `k > 100` receive 100 results silently.

## 08/04/2026 — fix(backend utils): delete_file silently skipped LocalStack http:// URLs
- **Cause:** `delete_file` only checked `startswith("https://")` — LocalStack `http://localhost:4566/...` URLs fell through to `os.remove()`, failed silently, and left orphaned S3 objects.
- **Fix:** Extended condition to include `startswith("http://")`.
- **Risk:** None.

## 08/04/2026 — fix(backend schemas): missing input validation on username, password, sticker_count
- **Cause:** `UserCreate` accepted zero-length or 51-char usernames and single-char passwords; `UpdateProfileRequest.sticker_count` accepted any integer including negatives.
- **Fix:** `username`: `min_length=3, max_length=50`; `password`: `min_length=8`; `sticker_count`: `ge=0, le=10_000`; added `max_length` guard to `bio`.
- **Risk:** None for new accounts; no existing-account update path is affected.

## 08/04/2026 — fix(backend routers): INTERNAL_SERVICE_SECRET silently empty in dev/misconfigured deploys
- **Cause:** Default `""` means any caller can set `X-Internal-Secret: ` and push fake STOMP trade events to any user.
- **Fix:** Added startup `logger.warning` when the secret is empty so the misconfiguration is visible immediately in logs.
- **Risk:** Warning-only; full protection requires setting the env var.

## 08/04/2026 — fix(frontend api): console.log leaked request URLs and response objects in production
- **Cause:** Two debug `console.log` lines in `api.ts` exposed full endpoint URLs and response objects in browser dev-tools on every API call.
- **Fix:** Removed both lines.
- **Risk:** None.

## 08/04/2026 — fix(frontend sidebar): accept flow navigated to /messages/undefined on conversation failure
- **Cause:** `handleAccept` called `convRes.json()` without checking `convRes.ok`; failed conversation creation produced `conversation.conversationId === undefined` and navigated to `/messages/undefined`.
- **Fix:** Added `if (!convRes.ok) throw new Error(...)` before parsing.
- **Risk:** None — caught by surrounding try/catch.

## 08/04/2026 — fix(frontend create): folder body border rendered over the tab *(partial — see below)*

- **Cause:** `FolderCard` tab had `z-10` but the body div had no `position` set — without `position`, z-index has no effect between siblings, so the later-DOM body painted its border over the tab regardless.
- **Fix:** Added `relative z-0` to the body div so both elements join the same stacking context and `z-10` on the tab correctly wins.
- **Incomplete:** The outer wrapper div (`relative`, no z-index) still did not create a scoped stacking context. The tab's `z-10` resolved into the page-level stacking context, where it competed with the slide-out panels also at `z-10`. Because `<main>` is rendered after `SideBar` in the DOM, document order gave FolderCard priority — the tab bled visually above the panels.

## 08/04/2026 — fix(frontend create): FolderCard tab bleeds above slide-out panels

- **Cause:** `FolderCard`'s outer shape wrapper was `relative` with no `z-index`. Without an explicit z-index on a positioned element, no new stacking context is formed — the tab's internal `z-10` escaped into the page stacking context. Both the tab and the slide-out panels sit at `z-10`; DOM order gave `<main>` (rendered after `SideBar`) the win, so the tab painted over the panels.
- **Fix:** Added `z-0` to the existing `relative` wrapper div. This forms a stacking context at z-level 0, scoping the tab's `z-10` internally. The entire FolderCard now stacks at z-0, below the panels (z-10) and sidebar (z-20).
- **Internal appearance unchanged:** Within the new stacking context, tab (z-10) still wins over body (z-0) — folder silhouette renders correctly.
- **Risk:** None — the FolderCard contains no portals or tooltips that need to escape its stacking context.

---

## 08/04/2026 — fix(frontend e2e): stale FolderCard locator and settings input timeout

- **Cause 1:** `profile.spec.ts:64` used `[class*="bg-purple-700"]` to target FolderCard. The component was fully reshaped in commits `b84f00f`/`b17053a` — the purple badge no longer exists, replaced by a folder-silhouette design. The locator never matched; test timed out on all 3 retries.
- **Fix 1:** Added `data-testid="folder-card"` to FolderCard's outer div. Updated test locator to `[data-testid="folder-card"]` — decoupled from visual styling.
- **Cause 2:** `settings.spec.ts` assertions on `.max-w-2xl input[type="text"]` used the Playwright default 5 s expect timeout. `ProfileTab` renders the input only after its async `/users/me` query resolves. Under CI load the 5 s window expired before the element appeared, producing "element(s) not found".
- **Fix 2:** Raised `toHaveValue`/`toBeVisible` timeouts to 15 s on every settings-input assertion. Added explicit `await expect(usernameInput).toBeVisible({ timeout: 15_000 })` before interactions in the username-change test.
- **Risk:** If the backend takes > 15 s to respond to `/users/me` in CI, tests will still fail — investigate backend startup time or move to a dedicated `playwright.config.ts`-level `expect.timeout` if the problem recurs.

---

## 08/04/2026 — fix(frontend create): folder page shows no posts after folder creation

- **Cause 1 (stuck loading):** `CreateFolder.tsx` `useEffect` read `username` from `localStorage` and returned early (without calling `setLoadingPosts(false)`) if missing. When `localStorage` is cleared while an auth cookie is still valid, the post-selection grid stayed at "Loading your posts…" forever — the user could not select any posts and created the folder with 0 selected.
- **Cause 2 (broken image URLs):** Both `CreateFolder.tsx` and `FolderPage.tsx` prepended `${API_BASE}/` to `img.paths.original`, which is already a full S3 URL (`https://…` or `http://localhost:4566/…`). Result: broken double-prefixed URLs like `http://localhost:8000/https://bucket.s3.amazonaws.com/…`. `UserProfile.tsx` used the path directly and was correct.
- **Fix 1:** Removed the early return; `fetchPosts` now falls back to `GET /users/me` when `localStorage.username` is absent, ensuring the loading state is always resolved.
- **Fix 2:** Changed both `.map()` calls to use `img.paths.original` directly, matching `UserProfile.tsx`.
- **Risk:** If a legacy DB row still holds a relative `avatar_path` (pre-S3 rows), post thumbnails in folders will be broken relative URLs. All live data is S3 absolute URLs post-migration.

## 08/04/2026 — fix(frontend search): profile pictures missing in search dropdown and results page

- **Cause:** `Search.tsx` (`UserResult` interface) used `profile_image` and `SearchResultsPage.tsx` (`SearchUser` interface) used `profile_picture` / `user_id`. The backend `UserResult` schema returns `avatar_path` and `id` — field mismatches meant the properties were always `undefined`, so no avatar was displayed and React keys were all `undefined`.
- **Fix (`Search.tsx`):** Renamed `profile_image` → `avatar_path` in both the interface and the `<img src>` reference.
- **Fix (`SearchResultsPage.tsx`):** Renamed `profile_picture` → `avatar_path`, `user_id` → `id`; removed the erroneous `${API_BASE}/` prefix on `src` (avatar_path is already an absolute S3 URL). Also removed `${API_BASE}/` prefix from post image paths (same as HomePage pattern).
- **Risk:** If a legacy DB row holds a relative `avatar_path`, the image will be a broken URL — all live data is S3 absolute URLs post-migration.

## 13/04/2026 — fix(infra localstack): LocalStack S3 never reaches healthy state on Windows

- **Cause:** `PERSISTENCE=1` with a stale `localstack_data/state/` directory caused LocalStack to hang on restore at every startup. The `/var/run/docker.sock` volume mount (not a valid Unix socket on Docker Desktop for Windows) caused additional init failures. `test-db-setup.sh` polled `curl | grep` for the health status but the container had no health definition, so the poll looped forever.
- **Fix:** Removed `PERSISTENCE`, `DOCKER_HOST`, and the docker-socket volume from the LocalStack service. Added a Python-based Docker healthcheck (Python is always available in the LocalStack image; `curl` is not guaranteed). Updated `test-db-setup.sh` to use `docker inspect --format Health.Status` and to `rm -rf localstack_data/` before startup. Added `docker-compose down -v --remove-orphans` at script start for idempotent reruns. Fixed `.gitignore` to exclude all of `localstack_data/`, not just its `node_modules/` subdirectory.
- **Risk:** LocalStack state is now ephemeral — the S3 bucket is recreated on every `./test-db-setup.sh` run. No production impact; production uses real AWS S3.

## 13/04/2026 — fix(backend utils): avatar uploads return internal `localstack` hostname to browser

- **Cause:** `upload_image_bytes` in `s3.py` used `AWS_ENDPOINT_URL` (`http://localstack:4566`) for both the boto3 put and the returned public URL. The browser cannot resolve the `localstack` Docker hostname. The `AWS_S3_PUBLIC_ENDPOINT_URL` env var was already set to `http://localhost:4566` in docker-compose but the Python code did not read it. The backend image was built from an older version of `s3.py` that lacked the `public_endpoint` logic — the env var existed in the container but was ignored.
- **Fix:** `upload_image_bytes` now reads `AWS_S3_PUBLIC_ENDPOINT_URL` (falls back to `AWS_ENDPOINT_URL` if unset) and uses it for the returned URL. `test-db-setup.sh` now passes `--build` to `docker-compose up` so the image is always rebuilt from current source. Also hardened `s3_key_from_url`: guard for empty/None input; non-URL strings are returned as-is (already a key) rather than silently returning `None`.
- **Risk:** If `AWS_S3_PUBLIC_ENDPOINT_URL` is not set in production, the function falls back to `AWS_ENDPOINT_URL` which is correct (`https://` S3 URL in prod). No change to production behaviour.

## 11/04/2026 - fix(backend auth): refresh token rotation race condition

- **Cause:** Concurrent API calls in the SPA triggered multiple refresh requests at once. The first request marked the toke
n as revoked, causing all subsequent simultaneous requests to fail with a 401 and log the user out.
- **Fix:** Added 
evoked_at timestamp to RefreshToken model. Implemented a 10-second grace period in /auth/refresh-toke
n logic; tokens revoked within this window are still considered valid for issuance.
- **Risk:** Marginal security trade-off as a revoked token is reusable for 10 seconds, but this is a standard industry cont
rol for SPA token rotation.

## 13/04/2026 — fix(ci): CD pipeline deploying dev compose to EC2, wiring LocalStack into prod

- **Cause:** `cd.yml` copied `docker-compose.yml` (the dev file) to EC2 and ran `docker-compose up -d` against it. The dev compose includes a LocalStack service and hardcodes `AWS_ENDPOINT_URL=http://localstack:4566` for both backend and messaging — in prod, LocalStack is not running, so all S3 calls would fail at the DNS level.
- **Fix:** Created `docker-compose.prod.yml` with backend and messaging services only (no LocalStack, no local postgres), ECR image refs, ports bound to `127.0.0.1` so only nginx on the host can reach them. Updated `cd.yml` to copy and invoke the prod file.
- **Risk:** EC2 must have the `.env` present with all required vars before `docker-compose up -d` runs — handled by the preceding CD step.

## 13/04/2026 — fix(ci): EC2 .env missing required secrets in CD deploy step

- **Cause:** The "Create .env file for EC2" step in `cd.yml` only wrote 6 vars (`ECR_REGISTRY`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `APP_DB_PASSWORD`, `MESSAGING_DB_PASSWORD`). Missing: `APP_DB_USER`, `MESSAGING_DB_USER`, `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, `AWS_REGION`, `AWS_S3_BUCKET`, `CLOUDFRONT_DOMAIN`, `ALLOWED_ORIGINS`. Containers would start with unset secrets, causing auth failures, S3 errors, and CORS blocks on every request.
- **Fix:** Added all 8 missing vars to the CD `.env` write step, each sourced from the corresponding GitHub Secret.
- **Risk:** All 8 new secrets must be added to `Settings > Secrets and variables > Actions` before the next CD run — see `docs/TODO_DEPLOYMENT.md` section 2 for the full list.

## 14/04/2026 — fix(ci cd): CI E2E and CD deploy broken after infra files removed from repo

- **Cause:** Removing `docker-compose.ci.yml`, `docker-compose.prod.yml`, and `infra/db/init-roles.sql` from git tracking also removed them from the runner's checkout. The CI E2E job referenced `docker-compose.ci.yml` in four steps (postgres start, healthcheck, service start, log dump). The CD pipeline referenced `docker-compose.prod.yml` in the SCP and deploy steps, and read `infra/db/init-roles.sql` via `psql -f` to initialize RDS roles.
- **Fix:** `docker-compose.ci.yml` and `docker-compose.prod.yml` restored to the repo — both were already fully sanitized (all `${ENV_VAR}` references, no hardcoded values), so no security trade-off. `infra/db/init-roles.sql` not restored; the SQL inlined directly into `cd.yml` as `-c` commands with passwords injected via the step `env:` block, eliminating the file dependency entirely.
- **Risk:** `infra/` remains unversioned in this repo. Any future changes to DB roles or schemas must be applied manually or tracked elsewhere.

## 14/04/2026 — fix(ci e2e): service log dump step placed before seed step, hiding seed failures

- **Cause:** The `Dump service logs on failure` step was positioned before `Seed test users` in the `e2e` job. GHA only triggers `if: failure()` steps when a *prior* step has failed, so a failure in the seed step produced no Docker logs — making the root cause invisible.
- **Fix:** Moved the dump step to immediately after the seed step so any seeding failure is accompanied by full backend and messaging container logs.
- **Risk:** None. The dump step is diagnostic-only and has no effect on the job outcome.

## 13/04/2026 — fix(frontend messaging): VITE_API_URL and VITE_WS_URL unguarded against missing .env

- **Cause:** `frontend/.env` is gitignored. Six messaging files (`useMessages.ts`, `SideBar.tsx`, `ConversationList.tsx`, `ConversationSearch.tsx`, `ChatPage.tsx`, `WebSocketProvider.tsx`) read `VITE_API_URL` or `VITE_WS_URL` with no nullish fallback. A fresh clone without `.env` resolved these to `undefined`, silently breaking all messaging API calls and the WebSocket connection. `VITE_BACKEND_URL` already had a `?? "http://localhost:8000"` fallback in `api.ts` — the other two vars were inconsistent.
- **Fix:** Added `?? "http://localhost:8080"` to all `VITE_API_URL` reads and `?? "ws://localhost:8080/ws"` to the `VITE_WS_URL` read, matching the existing pattern.
- **Risk:** Fallbacks are localhost-only; in prod these vars must be set in Vercel environment settings — the fallback will never be reached there.

## 14/04/2026 — fix(backend routers): comment_post passed User object as user_id

- **Cause:** `comment_post` declared its auth dependency as `user_id: User = Depends(authenthicate_access_token)`. The variable name implied an integer but held a full `User` ORM object. Both `PostComment` and `EngagementLog` were instantiated with `user_id=user_id` — passing the object where an integer FK is expected.
- **Fix:** Renamed the parameter to `user: User` and replaced both uses with `user.user_id`, matching the pattern used correctly in `like_image`.
- **Risk:** None. The endpoint was effectively broken before — any call would have raised a SQLAlchemy type error at DB insert time.
- **Cleanup:** Removed three stale commented-out lines in `upload_post` (old local-file path) and one commented-out `array_agg` alternative in `get_top_posts` that survived the previous refactor commit.

---

## 13/04/2026 — fix(backend utils): hardcoded "test" fallbacks on S3 credentials

- **Cause:** `_get_client()` in `s3.py` called `os.getenv("AWS_ACCESS_KEY_ID", "test")` and `os.getenv("AWS_SECRET_ACCESS_KEY", "test")`. If either env var was missing in production, boto3 silently used the literal string `"test"` as credentials — the error surfaced at the AWS API call, not at startup.
- **Fix:** Removed both default values. Missing creds now cause boto3 to raise `NoCredentialsError` immediately, making the misconfiguration visible.
- **Risk:** LocalStack local dev requires `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env` (any non-empty string; LocalStack accepts dummy values).

---

## 14/04/2026 — fix(messaging config): CORS allowed origins had whitespace after env var split

- **Cause:** `SecurityConfig.java` split `ALLOWED_ORIGINS` with `List.of(allowedOrigins.split(","))`. A value like `"http://localhost:3000, http://localhost:5173"` (space after comma) produced `" http://localhost:5173"` with a leading space. Spring's CORS config does exact-string matching on the `Origin` header — the space caused all preflight requests from that origin to be rejected.
- **Fix:** Replaced the raw split with `Arrays.stream(...).map(String::trim).filter(s -> !s.isEmpty()).toList()`.
- **Risk:** None — trimming is idempotent on already-clean entries.

---

## 14/04/2026 — fix(ci e2e): curl -sf suppressed seed error response bodies

- **Cause:** E2E seed steps used `curl -sf`, which exits non-zero on HTTP 4xx/5xx but discards the response body. A 422 validation error or 500 from the seed endpoint produced a CI failure with no diagnostic output — only the curl exit code appeared in the log.
- **Fix:** Changed to `curl -s --fail-with-body`. Exit behaviour is identical on success; on HTTP error the response body is printed before exit, surfacing the FastAPI error detail in the CI log.
- **Risk:** None.

---

## 14/04/2026 — fix(ci workflows): docker/build-push-action v5 Node.js compatibility

- **Cause:** `docker/build-push-action@v5` used a Node.js 16 runtime that GitHub Actions deprecated, producing warnings and eventual failures on newer runners.
- **Fix:** Bumped both build-push-action references in `cd.yml` to `@v6`.
- **Risk:** v6 may have minor behavioural changes for non-standard Dockerfile configurations — verify if Dockerfiles are relocated.

---

## 14/04/2026 — fix(backend models): CommentLike in __all__ but never defined

- **Cause:** `"CommentLike"` was listed in `backend/models/__init__.py`'s `__all__` but the class was never defined or imported anywhere. Any code relying on `__all__` for model discovery (e.g., Alembic's metadata scan) would raise `ImportError`.
- **Fix:** Removed `"CommentLike"` from `__all__`.
- **Risk:** None.

---

## 14/04/2026 — fix(frontend messaging+sidebar): VITE_BACKEND_URL resolved to undefined without .env

- **Cause:** `ConversationSearch.tsx` and `SideBar.tsx` read `import.meta.env.VITE_BACKEND_URL` with no nullish fallback. Without `frontend/.env` present, the value is `undefined`, which becomes the literal string `"undefined"` in template literals — breaking avatar image URLs in local dev.
- **Fix:** Added `?? "http://localhost:8000"` fallback to both files, matching the pattern in `api.ts`.
- **Risk:** Fallback is localhost-only; production requires `VITE_BACKEND_URL` set in Vercel environment settings.

---

## 14/04/2026 — fix(messaging tests): application-test.yml in main/resources; JWT secret read from env var

- **Cause 1:** `application-test.yml` was placed in `messaging-service/src/main/resources/` instead of `src/test/resources/`. Spring Boot loads everything in `main/resources/` at runtime — the `test` profile activated outside a test context would point the app at `antcollect_test`.
- **Cause 2:** The test JWT secret used `${JWT_SECRET:test-secret-key-...}` — a property placeholder that reads the real env var first. In CI where `JWT_SECRET` is a short production value, JJWT threw `WeakKeyException` because the key was under HS256's 32-byte minimum.
- **Fix:** Deleted `src/main/resources/application-test.yml` entirely. Changed the test JWT secret to a bare hardcoded string with no `${...}` lookup — tests always use the fixed key, never the production secret.
- **Risk:** The hardcoded test secret must remain ≥ 32 bytes (256 bits) for JJWT 0.12.x HS256. Shorter replacements throw `WeakKeyException`.

---

## 14/04/2026 — fix(frontend auth): hardcoded localhost URL in SignUp.tsx broke production account creation

- **Cause:** `SignUp.tsx` called `fetch("http://127.0.0.1:8000/users/create-user", ...)` directly, bypassing `API_BASE` entirely. The hardcoded address was baked into the Vercel bundle at build time, so every create-account attempt on production hit localhost and failed with a network error.
- **Fix:** Imported `API_BASE` from `@/shared/api/api` and replaced the literal URL with `` `${API_BASE}/users/create-user` ``.
- **Risk:** None — `API_BASE` already resolves `VITE_BACKEND_URL` with a localhost fallback, matching every other API call in the app.

---

## 14/04/2026 — fix(frontend sidebar): MESSAGING_URL routed conversations fetch to FastAPI instead of Spring Boot

- **Cause:** `SideBar.tsx` defined a local `MESSAGING_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080"`. In production `VITE_API_URL` resolved to a URL with an `/api/` prefix, so `${MESSAGING_URL}/conversations` became `/api/conversations`. Nginx routes `/api/` to FastAPI, which has no conversations router — the request failed with no CORS header attached.
- **Fix:** Removed local `BACKEND_URL` and `MESSAGING_URL` constants. Imported `API_BASE` from `@/shared/api/api` and replaced both usages. `${API_BASE}/conversations` hits nginx's `/conversations/` block, which correctly proxies to Spring Boot.
- **Risk:** Local dev: Spring Boot must be accessible at the same host as FastAPI (both default to `:8000` fallback); with the standard dev setup both run separately so this is fine.

## 14/04/2026 — fix(messaging config): WebSocket origin hardcoded to localhost

- **Cause:** `WebSocketConfig.java` called `.setAllowedOrigins("http://localhost:5173")` literally instead of reading the `ALLOWED_ORIGINS` env var. All WebSocket handshakes from the production frontend (`https://www.petrcollect.com`) were rejected — `SecurityConfig` (REST CORS) was already parameterised correctly but `WebSocketConfig` was missed.
- **Fix:** Injected `@Value("${app.cors.allowed-origins:http://localhost:5173}")` into `WebSocketConfig`, split on comma (same pattern as `SecurityConfig`), and passed the resulting array to `.setAllowedOrigins()`.
- **Risk:** If `ALLOWED_ORIGINS` is not set on the server, the default (`http://localhost:5173`) still applies — WebSocket will only work from local dev. Requires `ALLOWED_ORIGINS=https://www.petrcollect.com` in the server `.env`.

## 14/04/2026 — fix(ci cd): RDS schema init silently failing, messaging service crashes with 502

- **Cause:** `psql` in the "Initialize RDS roles and schemas" CD step used multiple `-c` flags with no `--set=ON_ERROR_STOP=1`. Each `-c` runs independently — a SQL error prints to stderr but psql continues and exits 0, making the CI step appear to pass. When a required secret was missing or misconfigured, the expanded shell variable was empty, producing malformed SQL (`CREATE SCHEMA IF NOT EXISTS  AUTHORIZATION ...`) that failed silently. The `petrcollect_messaging` schema was never created on RDS.
- **Symptom:** Messaging container crashed on startup with `ERROR: permission denied for database antcollect` because Flyway (via `spring.flyway.schemas`) tried to `CREATE SCHEMA petrcollect_messaging` as the app user, which has no `CREATE` privilege on the database.
- **Fix 1 (CD):** Added `set -euo pipefail` to the SSH script (catches unset/empty variables) and `--set=ON_ERROR_STOP=1` to psql (any SQL failure now immediately exits psql non-zero, failing the CI step visibly).
- **Fix 2 (app):** Removed `spring.flyway.schemas` from `application.yml`. Schema creation is the CD admin's responsibility; the app user should never need `CREATE` privilege on the database. `flyway.default-schema` alone is sufficient to tell Flyway where to place the `flyway_schema_history` table.
- **Risk:** If the `petrcollect_messaging` schema doesn't yet exist when the CD runs (first deploy, or schema was dropped), the CD step will now fail loudly and block deployment until the issue is resolved — which is the correct behavior. Re-running the CD after confirming all secrets are set will create the schema automatically.

## 15/04/2026 — fix(frontend auth): SignUp crashes with React error #31 on 422 response

- **Cause:** FastAPI + Pydantic v2 returns `detail` as an array of objects (`{type, loc, msg, input, ctx}`) for validation errors (e.g. password < 8 chars, username < 3 chars). `SignUp.tsx` called `setError(data.detail)`, storing the array in state, then rendered `<p>{error}</p>` — React cannot render objects/arrays as children → unhandled "Minified React error #31" crash before the user could see any error message.
- **Fix:** Added an `Array.isArray(detail)` check before setting state; array case extracts and joins `.msg` fields with `" · "` separator; string case (e.g. 409 "Username or email already registered") passes through unchanged.
- **Downstream note:** The 422 itself is correct backend behavior — `UserCreate` enforces `username` min 3 chars, `password` min 8 chars, and `EmailStr` format. The frontend was simply not handling the structured error response.
- **Risk:** None — the fix is purely defensive error handling with no logic change.

## 15/04/2026 — fix(frontend settings): bio/profile save reverts to old value on success

- **Cause:** `onSuccess` called `queryClient.invalidateQueries({ queryKey: ['me'] })` then `setInitialised(false)`. The refetch is async — on the next render `user` still held stale data, so `setBio(user.bio ?? '')` re-ran and overwrote the freshly-typed bio with the old value before the network round-trip completed.
- **Fix:** Replaced `invalidateQueries + setInitialised(false)` with `queryClient.setQueryData(['me'], updated)`. The PATCH response already contains the updated `UserMe` — writing it directly to the cache is atomic and eliminates the race entirely.
- **Removed:** `setInitialised(false)` call (no longer needed; local state already reflects what was saved).
- **Risk:** None. `setQueryData` is synchronous — all subscribers to `['me']` (sidebar avatar, profile header) update on the same render tick.

## 15/04/2026 — fix(frontend messaging): STOMP publish throws on cold refresh, triggers error boundary

- **Cause:** `clientRef.current?.publish()` only guards against `null`. After `client.activate()` the `Client` instance exists immediately in `clientRef`, but the WebSocket handshake hasn't completed yet. Calling `publish()` on a connected-but-not-open client calls `_checkConnection()` which throws `"There is no underlying STOMP connection"`. In React 18+, an error thrown inside `useEffect` propagates through the scheduler and is caught by the nearest error boundary — the `ChatErrorBoundary` introduced in the previous fix showed its error UI on every cold refresh where the read-ack effect fired before the WebSocket connected.
- **Fix:** Added `if (!clientRef.current?.connected) return;` before every `clientRef.current.publish()` call (`sendReadAck`, `sendMessage`, `sendTyping`). The `connected` property is `true` only after `onConnect` fires.
- **Risk:** `sendReadAck` silently drops the ack if not connected; the sender won't see blue double-ticks until the next connection cycle. For `sendMessage`, a send attempt before WebSocket connects is silently discarded — the message stays in `sending` state. Both are acceptable edge-case fallbacks; a queuing mechanism would be a future enhancement.

## 15/04/2026 — fix(frontend messaging): blank white page on browser refresh at /messages/:id

- **Cause 1 (blank page):** No React Error Boundary in the chat subtree. Any component-tree render error — however minor — unmounts the entire React application silently, leaving a blank white page with no recovery path.
- **Cause 2 (empty flash):** `MessageList` reads from the Zustand store. The `useEffect` in `useMessages` that seeds the store runs *after* the render where TanStack marks `isLoading: false`. On the first post-fetch render, the store key is absent and `MessageList` renders "No messages yet" before the effect fires. On refresh, this produces a flash of empty state (or a persistent blank if any downstream render error follows).
- **Fix 1:** Added `ChatErrorBoundary` class component in `App.tsx`, wrapping the `/messages/:conversationId` route. Any crash now shows a "Chat couldn't load" Retry button instead of blank.
- **Fix 2:** Added `storeSeeded` selector in `ChatPage` (`safeId in messagesByConversation`). Extended `isLoading` to remain `true` while the store key is absent, keeping the skeleton visible through the one-cycle gap between TanStack resolving and the Zustand seed effect firing.
- **Risk:** `storeSeeded` subscribes to the Zustand store in `ChatPage`, but the selector only transitions `false→true` once per conversation load and returns the same `true` value on all subsequent message appends — no per-message re-renders.

## 16/04/2026 — fix(frontend infra): WebSocket fails on page load with expired token — connects only after 5s reconnect

- **Cause:** `AppProviders.tsx` initialises `isAuthenticated` from `localStorage.userId`, which is long-lived and does not expire with the `access_token` cookie. On any page load where the cookie is expired, `isAuthenticated` is already `true` at mount time — `WebSocketProvider` activates the STOMP client immediately and the upgrade request carries the expired cookie. `JwtHandshakeInterceptor` rejects it; the client waits `reconnectDelay: 5_000 ms` before retrying. Meanwhile, an unrelated `fetchWithAuth` call encounters a 401 and triggers the HTTP token refresh, so by the time the STOMP retry fires (5 s later) the cookie is valid and the connection succeeds. The 5 s gap was the only thing preventing a permanent failure.
- **Why clicking refresh doesn't fix it:** `localStorage.userId` persists across reloads, so `isAuthenticated` is `true` from frame 1 on every hard refresh — the race is reproduced each time.
- **Fix:** Added `isWsReady` state to `AppProviders`. When `isAuthenticated` becomes `true`, a proactive `refreshAccessToken()` call runs before the WebSocket is allowed to connect. Only after a successful refresh does `isWsReady` flip to `true`, which is what's passed to `WebSocketProvider`. The STOMP handshake now always carries a fresh, valid cookie.
- **Exported:** `refreshAccessToken` in `api.ts` (was private) to make it importable by `AppProviders`.
- **Risk:** On every app load/login the token refresh adds one network round-trip before the WebSocket connects. If the refresh endpoint is temporarily unavailable, `isWsReady` stays `false` and messaging is offline — but the user is also effectively unauthenticated in that state.

## 16/04/2026 — fix(frontend auth): SignUp stuck after account creation — no redirect to login

- **Cause:** `SignUp.tsx` only called `setSuccess(...)` on a successful `POST /users/create-user`. There was no navigation call — the component remained on `/CreateAccount` showing a green success message indefinitely.
- **Fix:** Added `useNavigate` from `react-router-dom`; after setting the success message, `setTimeout(() => navigate('/Login'), 1500)` fires to give the user a moment to read the confirmation before being redirected.
- **Risk:** None. The 1.5 s delay is cosmetic; if the user navigates away before it fires, the timeout is a no-op.

---

## 16/04/2026 — fix(backend routers): post author missing from POST /users/get_user_ posts

- **Cause:** `retrieve_user` built `PostBase` objects via `model_validate(row)` directly from SQL rows. The query never selected `username` or `avatar_path`, so `PostBase.user` was always `None`. `PostCard` skipped `PostHeader` on `None`, leaving the three-dot button alone in the header row and floating to the left.
- **Fix:** After executing the posts query, build `post_user` once from the already-fetched `target_user` ORM object. For each row, call `row._asdict()`, inject `"user": post_user`, then `model_validate` the dict. No extra DB join needed — every post in this response belongs to the same user.
- **Risk:** Same `PostUserInfo` pattern used in `/posts/top`. Any endpoint returning `PostBase` that has not been updated will still produce `user: null` — see `/retrieve_user_likes` as a remaining case.

---

## 16/04/2026 — fix(backend routers): post author missing from GET /posts/top response

- **Cause:** `PostBase` had no `user` field and the `/top` query never joined the `users` table. `post.user` was `undefined` at runtime, crashing `PostHeader` with `TypeError: Cannot read properties of undefined (reading 'username')`.
- **Fix:** Added `PostUserInfo` schema (`user_id`, `username`, `avatar_path`) and `user: Optional[PostUserInfo]` to `PostBase`. Updated the `/top` query to join `User` and select the three fields as `user_user_id/user_username/user_avatar_path`. Post-query, assembled into a nested dict before `model_validate` so Pydantic sees the expected shape.
- **Frontend guard:** Added `{post.user && <PostHeader user={post.user} />}` in `PostCard` so cards from endpoints not yet returning `user` render without crashing.
- **Risk:** Any other endpoint (`/posts/top-k`, search, profile feed) that returns `PostBase`/`PostWithEngagement` will also have `user: null` until their queries are updated with the same join.

---

## 16/04/2026 — fix(frontend e2e): auth.spec button label and error selector stale after login redesign

- **Cause:** `auth.spec.ts` targeted `getByRole('button', { name: 'Create Account' })` — the label from the old design. After the `refactor(frontend auth)` redesign commit, the submit button reads `Login` and the "Create Account" text is a `<Link>`, not a button. Playwright waited 30 s for the button, hit timeout, and failed all 3 retries on both auth tests.
- **Cause 2:** Error locator `p[style*="color: red"]` relied on an inline style removed in the redesign. The current component renders `<p className="text-red-500 text-sm">` — a Tailwind class, not an inline style.
- **Fix:** Changed both button locators to `{ name: 'Login' }`. Changed error locator to `p.text-red-500`.
- **Risk:** None. The 8 other tests in the suite were unaffected.

## 15/04/2026 — fix(ci cd): CREATE SCHEMA AUTHORIZATION fails on AWS RDS

- **Cause:** `CREATE SCHEMA IF NOT EXISTS petrcollect_messaging AUTHORIZATION petrcollect_messaging` requires the executing user to be able to `SET ROLE petrcollect_messaging`. On AWS RDS, `rds_superuser` does not automatically have membership in application roles, so psql returned `ERROR: must be able to SET ROLE "petrcollect_messaging"`. The schema was never created, and the messaging service crashed with 502 on every startup.
- **Fix:** Removed the `AUTHORIZATION` clause from `CREATE SCHEMA`. Admin creates the schema (owned by admin), then `GRANT ALL PRIVILEGES ON SCHEMA ... TO petrcollect_messaging` gives the app user full CREATE + USAGE access. Flyway connects as `petrcollect_messaging` and creates tables inside the schema; it needs privilege on the schema, not ownership of it.
- **Also updated:** `docs/DB_SETUP.md` to document why AUTHORIZATION is omitted and what RDS restriction drives this.
- **Risk:** The schema is admin-owned rather than user-owned. Functionally equivalent for all app and Flyway operations. If you ever need the user to own the schema, you must first `GRANT petrcollect_messaging TO <admin>` and then `ALTER SCHEMA ... OWNER TO petrcollect_messaging`.

---

## 16/04/2026 — fix(backend+frontend): missing user info in post cards and layout misalignment

- **Cause:** Multiple backend endpoints (`_search_posts`, `retrieve_user_likes`, `get_folder`) were not joining the `User` table or providing the `user` field in their `PostBase` responses. The frontend `Post` type was also missing the `user` definition, and `PostCard.tsx` had a fragile flex layout that caused the "three dots" menu to shift left when the user section was empty.
- **Fix (Backend):** Updated `_search_posts`, `retrieve_user_likes`, and `get_folder` in `backend/routers/users.py` and `backend/routers/folders.py` to join the `User` table and populate the `user` field in the response.
- **Fix (Frontend):** Added the `user` field to the `Post` type in `Types.tsx`. Refactored the `PostCard.tsx` header to use a stable flex layout with a placeholder `div` to ensure the options menu always stays on the right.
- **Risk:** None. The backend changes follow the established `PostUserInfo` pattern. The frontend layout fix is defensive and maintains visual consistency across all feed types.

