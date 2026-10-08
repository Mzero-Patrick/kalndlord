# Kalndlord

A platform that connects landlords and tenants in Rwanda: landlords list houses and
workshops, tenants find a place, pay rent with MTN MoMo, Airtel Money or card, and
report maintenance or other issues.

## What's here

| Folder | What it is |
| --- | --- |
| `apps/api` | Node.js + Express API with PostgreSQL (Prisma). Accounts, verification codes, role-based dashboards. |
| `apps/web` | Next.js website for tenants, landlords and the administrator. |
| `apps/mobile` | React Native (Expo) app for Android and iOS. |
| `packages/shared` | Validation rules and types used by all three (phone numbers, sign-up, roles). |

## Roadmap

1. **Foundations** (done): sign-up by phone or email with a verification code, login,
   and separate dashboards for administrator, landlords and tenants.
2. **Listings** (done): admin or landlord lists a house or workshop with a short description
   and the building's terms and conditions; tenants read them, apply, or ask for help
   through a contact section.
3. **Rent payments** (done): MTN MoMo, Airtel Money and card. Reminders go to the phone or
   email given at sign-up, landlords can send notices, and each payment is recorded
   against the tenant account that paid.
4. **Maintenance** (done): tenants report repairs with a message and up to 4 photos, and
   use the same place to raise other business issues with their landlord. The landlord
   (or administrator) marks each report "being fixed" and "done"; both sides get an SMS
   or email on every update, and the tenant can reopen a report that isn't fixed.
   **Next: beta launch.**

## Run it locally

You need Node.js 22, pnpm 10 and PostgreSQL 16 (or Docker).

```bash
pnpm install
docker compose up -d                     # or use your own PostgreSQL
cp apps/api/.env.example apps/api/.env   # then edit the values
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm --filter @kalndlord/api db:deploy   # create the tables
pnpm --filter @kalndlord/api db:seed     # create the administrator from ADMIN_EMAIL / ADMIN_PASSWORD

pnpm dev:api      # http://localhost:4000
pnpm dev:web      # http://localhost:3000
pnpm dev:mobile   # scan the QR code with Expo Go
```

With `SMS_PROVIDER="console"` and `EMAIL_PROVIDER="console"` (the defaults), verification
codes are printed in the API terminal instead of being sent, so you can sign up without
any SMS or email account.

To send real messages, set `SMS_PROVIDER="africastalking"` with your Africa's Talking
credentials, and `EMAIL_PROVIDER="smtp"` with an `SMTP_URL`.

## Rent and payments

- When a landlord accepts an application, the first month's rent bill is created at once.
  After that the API creates each month's bill a week before it is due (same day of the
  month as the move-in date, capped at the 28th).
- Tenants pay from their dashboard. They are sent to the payment page, choose MTN MoMo,
  Airtel Money or card, and come back to a confirmation and a receipt. The payment is
  recorded against the tenant account that paid, and both tenant and landlord get a message.
- Reminders go to the phone or email given at sign-up: 3 days before the due date, on the
  due date, and 3 days late (the landlord is told then too).
- Landlords can record cash payments and send notices to their tenants. The administrator
  can send notices to every tenant.

The rent job runs inside the API every `RENT_JOB_MINUTES` (default 60). Every step is safe
to repeat.

**Test mode.** With `PAYMENT_PROVIDER="sandbox"` (the default), a local test page stands in
for the payment provider and no money moves. The API refuses to start in production in
this mode.

**Taking real payments (Flutterwave).**
1. Create a Flutterwave business account for Rwanda and complete their verification.
2. Set `PAYMENT_PROVIDER="flutterwave"` and `FLW_SECRET_KEY` (from Settings → API keys).
3. In Flutterwave's webhook settings, set the URL to `PUBLIC_API_URL/payments/webhook`
   and choose a secret hash. Put the same value in `FLW_WEBHOOK_HASH`.
4. Set `PAYMENT_REDIRECTS` to your website address and `kalndlord://` for the app, and
   `WEB_URL` in the web app to the website address.

A payment only counts once the API has confirmed it with Flutterwave for the full amount in RWF.

## Photos

Listing photos (JPG, PNG or WebP, up to 5 MB, 8 per listing) and report photos (4 per
report) are saved in `apps/api/uploads`
and served from `PUBLIC_API_URL/uploads`. Before launch this should move to cloud storage;
only `apps/api/src/lib/storage.ts` needs to change. Photo addresses use random names that
can't be guessed, but anyone holding a link can open it.

On the mobile app, set `EXPO_PUBLIC_API_URL` to an address your phone can reach (your
computer's local network IP), and set the API's `PUBLIC_API_URL` to the same address so
photos load on the phone.

## Tests

```bash
createdb kalndlord_test   # once; tests use their own database
pnpm test
```

## Accounts and roles

- **Tenants** and **landlords** sign up themselves with a phone number, an email, or both.
  A 6-digit code (valid 10 minutes, 5 tries) is sent by SMS or email to confirm it.
- The **administrator** account is created by the seed script, not through sign-up.
- After login everyone lands on the dashboard for their role. The administrator can also
  open the landlord dashboard.
