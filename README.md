# Alley Gaitor Scheduler

A booking, recording and artwork workflow for the Alley Gaitor art project.

## Current stage

The project has a live Netlify deployment with a connected PostgreSQL database, public booking flow, accountless participant booking management, helper/session tooling, helper-access management, and transactional booking email delivery.

Current live architecture:

```text
browser on Netlify
      ↓
Netlify Functions (/api/*)
      ↓
PostgreSQL database
      ↓
Resend transactional email
```

GitHub remains the public source-code repository. Real participant data and secrets must never be committed.

## Live site

Primary deployment:

```text
https://alleygaitor.netlify.app/
```

Important live routes:

```text
/                   public homepage
/book               public booking flow
/manage.html         participant booking management (secure email link required)
/sessions.html      helper/session operator page
/access.html        helper-access management page
/api/health         deployment/database/email health check
```

## Frontend structure

Do not assume all frontend functionality lives in `src/main.js`.

Sensitive or newer functionality is intentionally isolated into standalone pages so a change to one area is less likely to regress the rest of the application:

```text
sessions.html  → src/sessions.js
access.html    → src/access.js
manage.html    → src/manage-booking.js
legacy SPA routes and shared public UI → src/main.js
```

This separation is intentional and should be preserved unless there is a strong architectural reason to change it.

## Participant booking management

New bookings receive a **Manage booking** link in the confirmation email. No participant account is required.

The link uses a signed booking-management credential. The credential is placed in the URL fragment (`#token=...`) rather than the query string, so it is not sent as part of the initial page request. The browser then sends it to `/api/manage-booking` as a bearer token.

Participants can:

- open their own booking from the secure email link
- see the booking reference, session time and participant names
- reschedule to another currently available slot
- cancel the booking
- receive a confirmation email after either action

The booking reference remains visible and is retained as a manual fallback.

Rescheduling is revalidated server-side. The API checks that the new start time is in the supported booking window and does not overlap another active booking before updating the record.

Existing bookings created before this feature was deployed do not automatically gain a manage link unless a new management link is issued to them later.

## DTMF protocol

A recording marker is:

```text
HEADER + TYPE + 5-DIGIT RECORDING CODE + CHECK DIGIT + FOOTER
```

Current symbols:

```text
HEADER: ##*#
TYPE:   1 = start, 2 = end
CODE:   5 decimal digits
CHECK:  (type + all five code digits) mod 10
FOOTER: #*##
```

Example for recording code `48231`:

```text
START: ##*#1482319#*##
END:   ##*#2482310#*##
```

The protocol has survived both a basic Android recording test and a genuine bicycle-walk recording with spoke clicks. Continue stress-testing it in realistic outdoor conditions.

## Run locally on your Mac

Requirements:

- Node.js 20 or newer
- npm
- Python 3 for the decoder
- ffmpeg for phone audio formats

```bash
git clone https://github.com/desdodec/alley__gaitor_scheduler.git
cd alley__gaitor_scheduler
npm install
npm test
npm run dev
```

Install ffmpeg on macOS if needed:

```bash
brew install ffmpeg
```

## Decode an Android recording

```bash
python3 scripts/decode_dtmf.py "/path/to/recording.m4a"
```

Extract successfully paired sessions as WAV files:

```bash
python3 scripts/decode_dtmf.py "/path/to/recording.m4a" --extract output_sessions
```

## Deployment

The Netlify deployment uses:

```text
build command:       npm run build
publish directory:   dist
functions directory: netlify/functions
branch:              main
```

Runtime secrets and production credentials belong in Netlify environment variables, never in GitHub.

Important server environment variables include:

```text
DATABASE_URL
RESEND_API_KEY
BOOKING_EMAIL_FROM
SESSION_COOKIE_SECRET
BOOKING_MANAGE_SECRET
```

`BOOKING_MANAGE_SECRET` should be a random secret of at least 32 characters. If it is absent, booking management falls back to `SESSION_COOKIE_SECRET`; a separate value is preferred so the two credential systems can be rotated independently.

The health endpoint should report these key states as `true` on a healthy production deployment:

```json
{
  "databaseConfigured": true,
  "databaseReachable": true,
  "resendApiKeyConfigured": true,
  "bookingEmailFromConfigured": true,
  "emailConfigured": true,
  "bookingManageConfigured": true
}
```

The configured booking email sender is:

```text
Alley Gaitor <bookings@tessellation.co.uk>
```

The Resend domain `tessellation.co.uk` has been verified and successful booking confirmation email delivery has already been demonstrated.

## Live smoke testing

Before making application changes, verify the current production baseline.

Run the non-destructive live checks with:

```bash
npm run smoke:live
```

This checks:

- homepage responds
- `/book` responds
- `sessions.html` responds and contains Home navigation
- `access.html` responds
- `manage.html` responds
- `/api/health` responds
- required database/email/booking-management health flags are `true`

The script intentionally does not create bookings, alter production data, or send email.

Manual checks still required when validating booking behaviour:

- homepage `RUN SESSIONS` control is visible and works
- booking calendar/date selection works
- a test booking can be created
- booking confirmation email contains the secure Manage booking link
- manage link opens the correct booking without an account
- reschedule changes the slot and sends a confirmation email
- cancel changes the status and sends a confirmation email

If GitHub and the live site appear out of sync:

1. check Netlify deploy status
2. confirm the latest `main` commit was deployed
3. hard-refresh or reopen the browser before assuming the code is broken

## GitHub Pages

The repository also contains a GitHub Actions workflow that builds and deploys the Vite frontend to GitHub Pages. This is useful for static/offline experiments, but Netlify remains the production deployment because the production application depends on Netlify Functions, PostgreSQL, server-side authentication and email configuration.

## Privacy and security

See [`docs/security-and-privacy.md`](docs/security-and-privacy.md).

The PostgreSQL schema is in [`db/schema.sql`](db/schema.sql). It deliberately separates booking/contact/delivery data from participant recording identifiers so identifying data can later be deleted without destroying the non-identifying artistic dataset.

Do not commit:

- participant names
- addresses
- email addresses
- phone numbers
- payment data
- production credentials
- real booking exports
- private recordings

## Current capability status

1. DTMF generator + protocol tests — **complete**
2. DTMF decoder + real bicycle recording validation — **working; continue stress testing**
3. Booking, participant and recording model + operator UI — **implemented**
4. Netlify/server API/security baseline — **implemented**
5. Persistent PostgreSQL database — **implemented and reachable in production**
6. Public scheduler — **implemented**
7. Helper/session operator page — **implemented**
8. Helper-access management — **implemented**
9. Booking confirmation email — **implemented and successfully delivered**
10. Participant reschedule/cancel — **implemented; production end-to-end verification required after deploy**
11. Admin availability management — **next planned stage**
12. Reminder emails — **planned**
13. Payment and T-shirt handling — **planned**
14. Artwork/visualisation choices — **planned**
15. Print-on-demand fulfilment integration — **future work**

## Privacy reminder

The repository is public. Never commit participant data, secrets, credentials, private recordings, or production exports.
