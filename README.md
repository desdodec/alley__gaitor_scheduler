# Alley Gaitor Scheduler

A booking and recording workflow for the Alley Gaitor art project.

## Current stage

**Stage 1 — acoustic session-marker prototype.**

The first milestone deliberately does not contain booking, payment, email or print-fulfilment code. It tests the riskiest part of the system first: whether an iPhone can play a short, deterministic DTMF marker that survives being recorded by the Android phone alongside the bicycle/spoke audio.

Each participant always has their own bicycle recording. A booking may contain several participants, and those recordings can later be visualised individually or combined.

## Stage 1 protocol

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

The protocol is intentionally easy to change after real-world testing.

## Run on your Mac

Requirements:

- Node.js 20 or newer
- npm
- VS Code is optional but recommended

```bash
git clone https://github.com/desdodec/alley__gaitor_scheduler.git
cd alley__gaitor_scheduler
npm install
npm test
npm run dev
```

Vite will print a local URL, normally `http://localhost:5173`.

To test on an iPhone on the same Wi-Fi network, run:

```bash
npm run dev -- --host
```

Then open the LAN URL that Vite prints on the iPhone.

## Physical test

1. Start a fresh recording on the Android phone attached to the bicycle.
2. Open the Stage 1 operator page on the iPhone.
3. Put the phones in the positions you expect to use during the project.
4. Tap **SPOT / START** for a participant.
5. Walk the bicycle for about two minutes with the cable tie clicking against the spokes.
6. Tap **END SESSION**.
7. Repeat for the other fake participants.
8. Stop the Android recording and keep the original audio file unchanged.

The next stage will add a decoder/segmenter and use this captured file as the first real fixture.

## Planned stages

1. DTMF generator + protocol tests — **in progress**
2. DTMF decoder + automatic audio segmentation
3. Booking, participant and recording data model
4. Public scheduler + cancellation/rescheduling
5. Operator dashboard for iPhone
6. Artwork/visualisation choices
7. Payment and T-shirt order model
8. Email confirmations/reminders
9. Print-on-demand fulfilment integration

## Privacy

The repository is public. Never commit participant names, addresses, email addresses, phone numbers, payment data or real booking exports. Production secrets and personal data must live outside Git.
