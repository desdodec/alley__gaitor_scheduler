# Alley Gaitor Scheduler

A booking, recording and artwork workflow for the Alley Gaitor art project.

## Current stage

**Stage 4 — Netlify/security skeleton.**

The DTMF protocol has survived both a basic Android recording test and a genuine bicycle-walk recording with spoke clicks. The application now also has a structured booking/participant model and a phone-first operator view.

The current work moves deployment from a static-only model toward a secure application boundary:

```text
browser on Netlify
      ↓
Netlify Functions (/api/*)
      ↓
PostgreSQL database (not connected yet)
```

GitHub remains the public source-code repository. Real participant data and secrets must never be committed.

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

## Netlify deployment

The repo now contains `netlify.toml` and a server-side health function.

In Netlify:

1. Add a new site by importing this GitHub repository.
2. Use the `main` branch.
3. Netlify should detect:
   - build command: `npm run build`
   - publish directory: `dist`
   - functions directory: `netlify/functions`
4. Deploy the site.
5. Visit `/api/health` on the deployed site.

A healthy Stage 4 deployment returns JSON similar to:

```json
{
  "ok": true,
  "service": "alley-gaitor-scheduler",
  "stage": "4-security-skeleton",
  "databaseConfigured": false
}
```

`databaseConfigured` remains false until a real database is selected and `DATABASE_URL` is added in Netlify's environment-variable settings.

Do **not** put database passwords or other secrets in `netlify.toml`, source code or GitHub. Runtime secrets belong in Netlify environment variables.

## Privacy/security design

See [`docs/security-and-privacy.md`](docs/security-and-privacy.md).

The draft PostgreSQL schema is in [`db/schema.sql`](db/schema.sql). It deliberately separates booking/contact/delivery data from participant recording identifiers so identifying data can later be deleted without destroying the non-identifying artistic dataset.

## Planned stages

1. DTMF generator + protocol tests — **complete**
2. DTMF decoder + real bicycle recording validation — **complete in principle; continue stress testing**
3. Booking, participant and recording model + operator UI — **prototype complete**
4. Netlify/server API/security baseline — **in progress**
5. Persistent database + authenticated operator access
6. Public scheduler + cancellation/rescheduling
7. Artwork/visualisation choices
8. Payment and T-shirt order model
9. Email confirmations/reminders
10. Print-on-demand fulfilment integration

## Privacy reminder

The repository is public. Never commit participant names, addresses, email addresses, phone numbers, payment data, production credentials, real booking exports or private recordings.
