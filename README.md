# 🧾 SlipSnap — Receipt OCR Expense Tracker

> Upload a receipt, let the system read it, and automatically log your income and expenses.
> Built as a personal-use tool and a portfolio project.

This is a web app for tracking personal expenses. Users can upload a photo of a receipt/slip,
and the system will run OCR to extract details such as merchant name, date, and total amount,
then automatically log it as an income/expense entry — complete with a dashboard summarizing
overall finances.

The design is inspired by Starbucks — deep green (`#00704A`), cream, and coffee-brown tones,
with bold, rounded, warm typography. The goal is a friendly, human feel rather than a cold,
generic fintech dashboard (and to avoid looking too "AI-generated").

---

## ✨ Features

- 🔐 **Authentication** — Sign up / log in with JWT, secure session handling
- 📸 **Receipt Upload** — Drag-and-drop or snap a photo from mobile (supports JPG/PNG/PDF)
- 🔍 **Automatic OCR** — Extracts merchant name, date, total amount, and line items (if available) from the receipt image
- ✏️ **Editable Entries** — In case OCR misreads something, users can correct the data before saving
- 📊 **Summary Dashboard** — Monthly income/expense charts, broken down by category
- 🏷️ **Expense Categories** — Food, transport, shopping, bills, etc. (fully customizable)
- 🔎 **Search & Filter** — By date, merchant, category, or price range
- 🌙 **Responsive UI** — Works well on both mobile and desktop

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript, TailwindCSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL + SQLAlchemy (async) + Alembic (migrations) |
| OCR | Tesseract OCR (`pytesseract`) or Google Cloud Vision API (higher accuracy option) |
| Auth | JWT (access + refresh tokens), bcrypt for password hashing |
| File Storage | Local disk (dev) / S3-compatible storage (prod), e.g. MinIO |
| Containerization | Docker + Docker Compose |

> 💡 Start with Tesseract (free, runs locally), then switch to Cloud Vision later
> if you need higher accuracy for Thai receipts with unusual fonts/handwriting.

---

## 📁 Project Structure

```
slipsnap/
├── backend/
│   ├── app/
│   │   ├── api/              # route handlers (auth, receipts, transactions, dashboard)
│   │   ├── core/              # config, security, dependencies
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/
│   │   │   ├── ocr_service.py    # image processing + OCR call
│   │   │   └── parser.py          # parses OCR text into structured data (merchant/date/amount)
│   │   ├── db/                  # session, base
│   │   └── main.py
│   ├── alembic/                 # migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/           # UI components (Starbucks-inspired theme)
│   │   ├── pages/                 # Login, Dashboard, Upload, Transactions
│   │   ├── hooks/
│   │   ├── api/                    # axios client
│   │   └── App.tsx
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone & set up environment variables

```bash
git clone <repo-url> slipsnap
cd slipsnap
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Example `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://slipsnap:slipsnap@db:5432/slipsnap
SECRET_KEY=change-me-to-a-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=60
OCR_PROVIDER=tesseract   # or "google_vision"
```

### 2. Run with Docker Compose (recommended)

```bash
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend (Swagger docs) → http://localhost:8000/docs
- PostgreSQL → localhost:5432

### 3. Run manually (services separately, for dev)

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## 🔗 API Overview (example)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Log in, returns JWT |
| POST | `/receipts/upload` | Upload a receipt image → runs OCR → returns extracted data |
| POST | `/transactions` | Save a transaction (after user confirms/edits the OCR data) |
| GET | `/transactions` | List transactions, with filters (date/category/merchant) |
| GET | `/dashboard/summary` | Monthly income/expense summary, broken down by category |

Full details available via Swagger UI at `/docs`.

---

## 🗺️ Roadmap

- [ ] Set up auth (register/login/JWT) + protected routes
- [ ] File upload + store original images
- [ ] Integrate Tesseract OCR + write a parser for Thai receipts
- [ ] Build an edit screen to confirm data before saving
- [ ] Dashboard + summary charts (recharts)
- [ ] Customizable category system
- [ ] Export data to CSV/Excel
- [ ] Deployment (e.g. Frontend → Vercel, Backend → Render/Railway, DB → Supabase/Neon)

---

## 📌 Notes

This project was built for learning and personal use. OCR accuracy depends on the
quality of the receipt photo and each merchant's receipt format. Users should always
review and correct extracted data before saving.
