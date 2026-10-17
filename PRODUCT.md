# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable PWA (manifest, home-screen icons, standalone window). Used mainly on mobile phones; desktop is secondary.

## Users

- **Primary audience: portfolio reviewers** (prospective employers and clients). They open the app to judge the builder's craft, so the first impression and how polished it feels matter more than long-term daily use.
- **Secondary: the builder, as a real user.** They upload Thai bank-transfer and e-wallet slips from a phone to log spending, and check the monthly summary and budgets.

## Product Purpose

Moo Tang reads a Thai bank-transfer or e-wallet slip (date, amount, sending bank, transaction reference) and logs it as an expense. A dashboard summarizes income, spending, category breakdowns and monthly budgets. Success: a slip goes from photo to a correct, saved entry with little friction, and the app shows engineering and design quality to a reviewer within the first minute.

## Positioning

- Built specifically for Thai slips: reads 17 Thai banks plus TrueMoney, ShopeePay, MAKE by KBank and Dime. It handles Thai month names and Buddhist-era years, and reads the Bank of Thailand slip-verification QR code.
- Fully local OCR: Tesseract runs on the user's own machine and no cloud OCR API is contacted.
- Review before saving: fields stay blank when the parser is not confident, and every extracted field can be corrected.

## Operating Context

- Main flow on a phone: take or choose a slip image or PDF, let OCR and QR decoding fill the review form, correct any fields, then save.
- Other flows: the monthly Overview dashboard, Transactions (search, filter, CSV/Excel export), Budgets (monthly, with optional per-category limits), Categories and Settings (security, 2FA, backups).
- Hosted for others to view over Tailscale Funnel; also runs locally or with Docker Compose.

## Capabilities and Constraints

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, lucide-react, framer-motion. Backend: FastAPI, SQLAlchemy and Alembic, with SQLite by default and PostgreSQL supported.
- Auth: JWT with rotating HttpOnly refresh cookies, Google sign-in, authenticator-app 2FA with recovery codes, email verification, password reset and rate limiting.
- Duplicate protection through a per-user unique constraint on the transaction reference.
- Data: personal ZIP backup and restore, and permanent account deletion.
- Moo Tang reads what is printed on a slip. It does **not** verify a payment with the bank, and the UI must never imply that it does.
- Language: the UI copy is currently English and the slip data is Thai. **Planned:** Thai and English UI with a language switch. This is not built yet.
- Light UI only. The owner rejected the earlier dark green look ("no dark green"); do not bring back a dark or green-led theme. Visual decisions live in DESIGN.md.

## Brand Commitments

- Name: **หมูตังค์ (Moo Tang)**, renamed from SlipSnap on 2026-10-18 because the old name felt generic. Thai wordmark in the app; "Moo Tang" in English sentences. Logo: a smiling piggy bank with a coin (`my-app/public/mootang.svg`, `icon-*.png`, `BrandMark` in `src/components.tsx`).
- Existing voice: "A little clarity for your everyday spending." / "Make sense of every spend."

## Evidence on Hand

- Synthetic sample slip: `my-app/tests/fixtures/receipt.png`.
- 74 backend tests (pytest) and Playwright end-to-end tests on desktop and mobile.
- No real users, testimonials, metrics or press exist. Do not fabricate any.

## Product Principles

1. **Trust through honesty:** show only what the slip actually says. Leave unsure fields blank instead of guessing, and never claim payment verification.
2. **Phone first:** the slip-to-saved-entry flow must feel effortless one-handed on a phone.
3. **Craft is the pitch:** as a portfolio piece, every screen is evidence of quality. Unpolished corners cost more than missing features.
4. **Private by default:** local OCR and user-owned data, with backups and deletion, are core to the product.
5. **Thai-native:** Thai dates, banks and text are first-class, never an afterthought.
