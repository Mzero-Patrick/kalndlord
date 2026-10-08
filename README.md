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
5. **Beta launch** (ready to deploy): forgotten-password reset by SMS or email code,
   hosting setup (website on Vercel; server, database and photos on Railway), and
   Android test builds of the app. See [Launch checklist](#launch-checklist).

## Launch checklist

The website runs on Vercel (already connected). The server, its PostgreSQL database and
uploaded photos run on Railway. Keys and passwords go into the Railway and Vercel
dashboards, never into the code or a chat.

> Railway gives new accounts trial credit; after that the Hobby plan is about $5 a month,
> which covers a beta of this size.

1. **SMS (Africa's Talking).** Create an account, top up airtime credit, and request a
   sender ID (e.g. "Kalndlord"). You need the username, API key and sender ID.
2. **Email.** Any SMTP provider (e.g. Brevo, which has a free plan, or a Google Workspace
   mailbox). You need an `SMTP_URL` like `smtps://user:password@smtp.example.com:465`.
3. **Railway project.** Sign in to Railway with GitHub, choose New Project → Deploy from
   GitHub repo, and pick this repository. Railway reads `railway.json`: it builds the
   server, brings the database up to date and creates the administrator account before
   each deploy, and checks `/health`.
4. **Database.** In the project, choose Create → Database → PostgreSQL. In the server's
   Variables, add `DATABASE_URL` with the value `${{Postgres.DATABASE_URL}}`.
5. **Photos.** Right-click the server → Attach volume, mount path `/data`. Photos saved
   there survive redeploys.
6. **Public address.** Server → Settings → Networking → Generate Domain. This is the
   server's address, e.g. `https://kalndlord-api.up.railway.app`.
7. **Server settings.** In the server's Variables, add:

   | Name | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | a long random string (40+ characters) |
   | `PUBLIC_API_URL` | the server's address from step 6 |
   | `UPLOAD_DIR` | `/data/uploads` |
   | `CORS_ORIGINS` | the website's address, e.g. `https://kalndlord.vercel.app` |
   | `PAYMENT_REDIRECTS` | `https://kalndlord.vercel.app/,kalndlord://` |
   | `PAYMENT_PROVIDER` | `off` (until Flutterwave is ready) |
   | `SMS_PROVIDER` | `africastalking`, plus `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` |
   | `EMAIL_PROVIDER` | `smtp`, plus `SMTP_URL` and `EMAIL_FROM` |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | your administrator account |

   Railway redeploys when variables change. The administrator account is created on the
   first deploy that has these set; an existing account keeps its password. Rent bills
   and reminders run inside the server every hour (`RENT_JOB_MINUTES`).
8. **Website.** In the Vercel website project's settings, set `API_URL` to the server's
   address and `WEB_URL` to the website's address, then redeploy.
9. **Payments (Flutterwave).** When your Flutterwave account is verified, follow "Taking
   real payments" above and change `PAYMENT_PROVIDER` to `flutterwave`.
10. **Android test app.** Install the Expo tools (`npm i -g eas-cli`), sign in with a free
    Expo account, set the server's address in `apps/mobile/eas.json`, then run
    `cd apps/mobile && eas build --profile preview --platform android`. It gives an APK
    link to share with beta testers. For the Play Store use `--profile production`.
11. **Try it end to end** with a few real landlords and tenants: sign up, list, apply,
    accept, record a payment, report a problem, and reset a password.

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
this mode. Until Flutterwave is ready, use `PAYMENT_PROVIDER="off"`: tenants are told to
pay their landlord, and landlords record cash as before.

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
report) are resized to at most 1600px in the browser and the app before upload, which
keeps uploads quick on mobile data. They are saved in `UPLOAD_DIR` (`apps/api/uploads`
locally, the Railway volume in production) and served from `PUBLIC_API_URL/uploads`.
They can go to an S3-compatible bucket instead (`STORAGE=s3`, see `.env.example`). Photo addresses use random names that
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
