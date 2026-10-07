# Alley Gaitor Scheduler

A booking, recording and artwork workflow for the Alley Gaitor art project.

## Current stage

The project now has a live Netlify deployment with a connected PostgreSQL database, public booking flow, helper/session tooling, helper-access management, and booking confirmation email delivery.

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
legacy SPA routes and shared public UI → src/main.js
```

This separation is intentional and should be preserved unless there is a strong architectural reason to change it.

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
build command:      npm run build
publish directory:  dist
functions directory: netlify/functions
branch:             main
```

Runtime secrets and production credentials belong in Netlify environment variables, never in GitHub.

The health endpoint should report these key states as `true` on a healthy production deployment:

```json
{
  "databaseConfigured": true,
  "databaseReachable": true,
  "resendApiKeyConfigured": true,
  "bookingEmailFromConfigured": true,
  "emailConfigured": true
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
- `/api/health` responds
- all required database/email health flags are `true`

The script intentionally does not create bookings, alter production data, or send email.

Manual checks still required when validating booking behaviour:

- homepage `RUN SESSIONS` control is visible and works
- booking calendar/date selection works
- a test booking can be created
- booking confirmation email is received

If GitHub and the live site appear out of sync:

1. check Netlify deploy status
2. confirm the latest `main` commit was deployed
3. hard-refresh or reopen the browser before assuming the code is broken

## GitHub Pages

The repository also contains a GitHub Actions workflow that builds and deploys the Vite frontend to GitHub Pages. This is useful for static/offline experiments, but Netlify remains the production deployment because the production application depends on Netlify Functions, PostgreSQL, and server-side email configuration.

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
10. Cancellation/rescheduling — **future work / verify before relying on it**
11. Artwork/visualisation choices — **future work**
12. Payment and T-shirt order model — **future work**
13. Reminder email workflow — **future work**
14. Print-on-demand fulfilment integration — **future work**

## Privacy reminder

The repository is public. Never commit participant data, secrets, credentials, private recordings, or production exports.
