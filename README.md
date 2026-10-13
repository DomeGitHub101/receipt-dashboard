# SlipSnap — Thai Bank Slip Reader & Expense Tracker

Upload a Thai bank-transfer or e-wallet slip, and SlipSnap reads the date, amount, sending bank and
transaction reference, then logs it as an expense. A dashboard summarizes income, spending and
monthly budgets.

Built as a personal-use tool and portfolio project. Everything runs locally: OCR happens on your own
machine and no cloud OCR API is contacted.

## Features

- **Multi-bank slip reading** — reads slips from 17 Thai banks (SCB, KBank, Krungthai, Bangkok Bank,
  Krungsri, ttb, GSB, KKP, UOB, CIMB Thai and others) plus TrueMoney, ShopeePay, MAKE by KBank and Dime.
- **OCR + QR, combined** — Tesseract OCR (Thai/English) extracts the date and amount; the Bank of
  Thailand slip-verification QR code supplies the sending bank and transaction reference.
- **Thai date handling** — Thai month names and Buddhist-era years are converted to ISO dates, with a
  focused second OCR pass when the date is unclear.
- **Review before saving** — every extracted field can be corrected; fields stay blank when the parser
  is not confident.
- **Duplicate protection** — a per-user unique constraint on the transaction reference rejects the same
  slip being saved twice.
- **Dashboard and budgets** — monthly income/expense charts, category breakdowns, and monthly budgets
  with optional per-category limits.
- **Search, filter and export** — filter by date, merchant, category, type and amount; export to CSV or
  Excel with spreadsheet formula-injection protection.
- **Account security** — JWT access tokens with rotating HttpOnly refresh cookies, Google sign-in,
  authenticator-app 2FA with recovery codes, email verification, password reset, and rate limiting.
- **Personal backups** — download all data as a ZIP, restore it, or permanently delete the account.

> SlipSnap reads what is printed on a slip. It does **not** verify a payment with the bank.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | FastAPI (Python), Pydantic |
| Database | SQLAlchemy 2 (async) + Alembic; SQLite by default, PostgreSQL 16 supported |
| OCR | Tesseract (`eng+tha`) via `pytesseract`, with a WebAssembly fallback; `zxing-cpp` for QR codes |
| Auth | PyJWT, bcrypt, `pyotp` (2FA), Google ID tokens |
| Testing | pytest (backend), Playwright (end-to-end, desktop and mobile) |
| Containers | Docker Compose (PostgreSQL, API, frontend) |

## How a slip is read

```
image / PDF ──► preprocessing ──► Tesseract OCR ──► date + amount
      │
      └───────► QR decode (zxing-cpp) ──► Bank of Thailand slip QR
                                            ├─ sending bank code (e.g. 014 = SCB)
                                            └─ transaction reference
                         │
                         ▼
          detect bank (QR first, then text cues) ──► review form ──► save
```

When a slip has no readable QR code, the bank is detected from text cues printed on the slip, and the
reference can be entered manually.

## Project Structure

```
my-app/
├── src/                  # React frontend (Dashboard, Upload, Transactions, Budgets, Settings)
├── backend/
│   ├── app/
│   │   ├── main.py       # API routes: auth, categories, budgets, transactions, receipts, export
│   │   ├── parser.py     # bank detection, QR parsing, Thai date and amount extraction
│   │   ├── ocr.py        # image preprocessing and Tesseract calls
│   │   ├── models.py     # SQLAlchemy models
│   │   └── account*.py   # security, 2FA, Google sign-in, backup and restore
│   ├── alembic/          # database migrations
│   └── tests/            # pytest suite
├── tests/                # Playwright end-to-end tests and sample slips
├── scripts/              # OCR fallback, test-slip generator, start scripts
└── docker-compose.yml
```

## Getting Started

Prerequisites: Node.js 22.12+ and Python 3.11+. Run from `my-app`
(on Windows, use `backend/.venv/Scripts/python.exe` and `npm.cmd`):

```bash
npm ci
python -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m alembic -c backend/alembic.ini upgrade head
```

Start the API and the frontend in two terminals:

```bash
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
npm run dev
```

- App: http://localhost:5173
- API docs (Swagger): http://localhost:8000/docs

Create an account to start; there are no default credentials. To try it quickly, upload
`tests/fixtures/receipt.png`, a synthetic slip.

### With Docker Compose (PostgreSQL)

```bash
cp .env.example .env      # then set SECRET_KEY to a random value
docker compose up --build
```

Compose runs the migrations, then starts PostgreSQL, the API and the frontend.

## Tests

```bash
cd my-app/backend
python -m pytest tests -q        # 74 tests: parser, auth, access control, exports, security
cd .. && npm run test:e2e        # Playwright, with the app running
```

Backend tests use temporary SQLite databases. The slip tests cover bank detection, QR parsing,
Thai dates and amount extraction.

## More detail

Configuration, Google sign-in setup, SMTP, 2FA, backups and deployment notes are in
[`my-app/README.md`](my-app/README.md).

## Notes

OCR accuracy depends on photo quality and slip layout, so always review extracted data before saving.
This project is for learning and personal use.