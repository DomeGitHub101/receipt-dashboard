# SlipSnap — Receipt OCR Expense Tracker

The application implements the receipt tracker requirements in the repository's parent `README.md`. The existing `my-app` directory is the frontend root; the FastAPI service lives in `my-app/backend` so all application code stays together.

## What works

- Register, sign in, sign out, and restore a session after a page refresh.
- bcrypt password hashing; short-lived JWT access tokens held in memory; rotating JWT refresh tokens in an HttpOnly, SameSite cookie; server-side session revocation.
- User-isolated categories, transactions, original receipts, summary charts, and exports.
- Monthly spending budgets with an overall limit, optional per-category limits, live progress, remaining amounts, and over-budget states.
- Drag-and-drop JPG/PNG bank slips or a single-page PDF, or use a mobile camera. Files are limited to 10 MB.
- Local Thai/English OCR automatically fills the transfer date and outgoing amount. Thai months and Buddhist years are converted to an ISO date for the form, with a Thai date displayed underneath. A focused second pass retries unclear dates.
- Reference codes are optional; supported slip QR codes can fill them locally. Review fields before saving. Reading a slip or QR does not verify payment with a bank. New scans are expenses; existing manual and receipt entries remain available.
- Create, edit, and delete income/expense entries; rename, recolor, add, and remove unused categories.
- Monthly income/expense charts and category breakdown; merchant, category, date, type, and amount filters.
- CSV and Excel export of the matching transactions, with spreadsheet formula-injection protection.
- Responsive green/cream interface, loading/error/empty states, accessible form labels, keyboard-operable native dialogs.

## Run on Windows (no Docker required)

Prerequisites: Node.js 22.12+ and Python 3.11+. Run these commands from `my-app`:

```powershell
npm.cmd ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python.exe -m alembic -c backend/alembic.ini upgrade head
```

In one terminal:

```powershell
backend/.venv/Scripts/python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
npm.cmd run dev
```

- Website: http://localhost:5173
- API documentation: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

Create an account on the website to start. New accounts are empty; illustrative receipt artwork is not financial data. There are no default credentials.

The default local database is `backend/slipsnap.db`. A development signing key is generated in `backend/.dev-secret` and receipt files are saved in `backend/uploads`. These files and `.env` files are excluded from Git. Keep them to retain your account and data between restarts.

On macOS/Linux, use `backend/.venv/bin/python` instead of `backend/.venv/Scripts/python.exe`, and `npm` instead of `npm.cmd`.

## OCR

If system Tesseract is available, the backend calls it through `pytesseract` using `eng+tha`. Set `TESSERACT_CMD` in `backend/.env` if the executable is not on PATH.

Without a system install, the local backend invokes `scripts/ocr.mjs`: the same Tesseract engine runs with WebAssembly and npm-bundled English/Thai language data. Receipt contents stay on your machine; no cloud OCR API is contacted. The first scan caches language data in `backend/.ocr-data`.

For a quick trial, upload `tests/fixtures/receipt.png` or `tests/fixtures/receipt.pdf`. These are synthetic bank slips dated 17 September 2026 with an amount of THB 210.00. Run `backend/.venv/Scripts/python.exe scripts/make-test-receipt.py` to regenerate them. Unclear photos, handwriting and other bank layouts may need manual corrections. Fields stay blank when the parser cannot identify a date or transfer amount confidently. Always review before saving.

After pulling schema changes, run `backend/.venv/Scripts/python.exe -m alembic -c backend/alembic.ini upgrade head` and restart the API. Migration 0002 preserves existing transactions while adding the source and optional reference. Duplicate nonempty references are rejected within an account; slips without references can be saved.

## PostgreSQL + Docker Compose

Docker Compose uses PostgreSQL 16, async SQLAlchemy, Alembic migrations, and native Tesseract with English/Thai language packs.

```powershell
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
```

Set `SECRET_KEY` in `.env` to the generated value, then run:

```powershell
docker compose up --build
```

The frontend and backend use ports 5173 and 8000. Stop manually running services first if these ports are in use. Compose runs migrations before starting the API. Database and receipt data persist in named volumes. The database is only accessible inside the Compose network.

For an existing PostgreSQL server without Docker, set `DATABASE_URL=postgresql+asyncpg://user:password@host:5432/database` in `backend/.env`, then run the same Alembic command before starting the API.

Docker/PostgreSQL execution must be verified on a machine with Docker installed; this development machine did not have Docker.

## Configuration and deployment boundaries

See `backend/.env.example` and `.env.example`. Environment variables override local `.env` files. `API_PROXY_TARGET` configures the Vite development proxy. The frontend uses same-origin `/api` requests.

Compose is a local development configuration. For production, serve the built `dist/` with a web server, route `/api` to FastAPI under the same origin, set a persistent random `SECRET_KEY`, set `COOKIE_SECURE=true` behind HTTPS, and set `ALLOWED_ORIGIN` to the actual frontend origin. Bind all services privately behind the web server. Back up both database and receipt files.

Current storage is local disk or a Docker volume. S3/MinIO, optional Google Cloud Vision, and hosting on Vercel/Render/Railway are not configured. No deployment or external accounts were created.

## Account security and personal backups

Open **Settings** to change your password, verify your email, configure authenticator-based 2FA, download a backup, restore financial data, or permanently delete your account. Apply migration `0004` and restart the API after updating. Install the updated `backend/requirements.txt` first.

- Password changes and resets revoke all existing sessions. A password change keeps only the new current session. Reset links expire after 30 minutes, are stored as hashes and can only be used once. Forgot-password and verification requests give the same response for unknown and known addresses.
- Verification links expire after 24 hours. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `PUBLIC_URL` in `backend/.env` to deliver email. Port 587 uses `SMTP_STARTTLS=true`; for implicit TLS on port 465 set `SMTP_SSL=true`. No reset or verification tokens are returned to the browser or printed to logs. Without SMTP, the UI explains that email delivery is unavailable. Mail is sent by an in-process background task; a server interruption may require requesting a new link.
- Set `REQUIRE_VERIFIED_EMAIL=true` after configuring SMTP when opening registration to the public. Existing unverified accounts must then verify too. Use HTTPS, `COOKIE_SECURE=true`, a persistent random `SECRET_KEY`, and the correct HTTPS `PUBLIC_URL` and allowed origin. This development setup is not a completed public deployment.
- 2FA supports time-based authenticator apps using a manual setup key. Confirm a code to enable it. Ten one-use recovery codes are shown once; save them outside the app. Password reset does **not** bypass 2FA. Enabling or disabling 2FA revokes old sessions. Authenticator secrets are encrypted with a key derived from `SECRET_KEY`; preserve that key with server backups. Changing or losing it makes existing authenticator secrets unreadable. Personal ZIP exports deliberately exclude credentials and 2FA secrets.
- Authentication and sensitive actions have persistent database rate limits, shared by app workers. Apply appropriate reverse-proxy limits as well for a public deployment; the API uses the connecting client address, so only trusted proxies should supply forwarded addresses.
- **Download all data** produces a ZIP containing profile metadata, financial records, categories, budgets, OCR text, and original receipt files. The archive is not encrypted; keep it private. Personal backups are limited to 50 MB uncompressed and 5,000 receipts. Larger accounts need an administrator-operated database and upload-directory backup. This is an on-demand personal backup, not an automated server backup schedule.
- **Restore backup** validates the entire archive before replacing financial records in the signed-in account. It requires your password, 2FA if enabled, and typing `RESTORE`. IDs are regenerated; credentials and security settings are retained. Always download a current backup first. Restoring another person's archive imports its financial data into your own account, not their identity.
- **Delete account** requires your password, 2FA if enabled, and typing `DELETE`. It removes account data and stored receipt originals. If filesystem cleanup fails, the UI explicitly reports that administrator cleanup is still needed. Previously downloaded files and administrator backups cannot be removed remotely by this action.
- Slip previews are hidden by default, including the filename. **Show original preview** reveals the original image, and **Hide preview** conceals it again. This is screen privacy, not permanent redaction: original files and OCR text remain available to the account owner and are included in backups.

The implementation follows the [OWASP password-reset guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) and [MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) for single-use recovery tokens, session invalidation and recovery codes.

Security API tests run with `backend/.venv/Scripts/python.exe -m pytest backend/tests -q` when `PYTHONPATH=backend`, or run `.venv/Scripts/python.exe -m pytest tests -q` from `backend`. `tests/security.spec.ts` covers Settings on desktop and mobile. Run browser tests against an isolated database and upload directory using `E2E_BASE_URL`; these tests create and delete their own test accounts.

## Checks

```powershell
npm.cmd run build
npm.cmd run lint
Push-Location backend
.venv/Scripts/python.exe -m pytest tests -q
Pop-Location
```

Backend tests use temporary isolated SQLite databases and cover token rotation/revocation, cross-account access, validation, category constraints, filtering, Decimal totals, safe exports, upload validation and the Thai/English parser. Integration tests stub OCR only for access-control checks; browser tests run real OCR.

With frontend and API running, and Microsoft Edge installed:

```powershell
npm.cmd run test:e2e
```

Playwright tests cover desktop/mobile registration, entries, editing, search, category creation, real receipt OCR, export, refresh, logout, and layout overflow. Test accounts use unique `e2e-...@example.com` addresses. Tests currently target the running local development database; use a separate `DATABASE_URL` when testing against important data. Screenshots and traces are written under ignored `test-results/`.

Regenerate synthetic receipts with:

```powershell
backend/.venv/Scripts/python.exe scripts/make-test-receipt.py
```

## Technical references

- [FastAPI JWT authentication](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
- [SQLAlchemy asyncio sessions](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite)
