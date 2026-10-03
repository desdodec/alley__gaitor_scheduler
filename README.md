# Alley Gaitor Scheduler

A booking and recording workflow for the Alley Gaitor art project.

## Current stage

**Stage 2 — DTMF decoding and automatic audio segmentation.**

Stage 1 proved the browser can generate deterministic DTMF start/end markers. The first real Android recording test then successfully recovered both markers from AAC/M4A audio, including the recording code and checksum.

Each participant always has their own bicycle recording. A booking may contain several participants, and those recordings can later be visualised individually or combined.

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

The protocol is intentionally easy to change after further physical testing.

## Run the operator prototype on your Mac

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

## Decode an Android recording

The Stage 2 decoder is deliberately lightweight. It uses Python's standard library for DTMF detection and `ffmpeg` only for reading phone formats such as `.m4a` and extracting session WAV files.

On macOS, install ffmpeg if needed:

```bash
brew install ffmpeg
```

Then decode a recording:

```bash
python3 scripts/decode_dtmf.py "/path/to/recording.m4a"
```

To also extract every successfully paired START/END session as a WAV file:

```bash
python3 scripts/decode_dtmf.py "/path/to/recording.m4a" --extract output_sessions
```

The decoder prints JSON containing detected markers, checksum status and paired recording sessions.

## First real-world result

The first Android test file was a 14.26-second mono AAC/M4A recording at 44.1 kHz. The decoder recovered:

```text
START recording 48231, checksum 9: valid
END   recording 48231, checksum 0: valid
```

The usable content between those markers was approximately 3.2 seconds. This confirms that the current DTMF frequencies and conservative tone timing survive the tested Android recording/compression path.

Important: this is a successful first test, not yet proof of reliability in noisy exhibition conditions. The next physical tests should include bicycle clicks, speech, greater phone distance and lower playback volume.

## Physical test procedure

1. Start a fresh recording on the Android phone attached to the bicycle.
2. Open the operator page on the iPhone.
3. Put the phones in the positions expected during the real project.
4. Tap **SPOT / START** for a participant.
5. Walk the bicycle with the cable tie clicking against the spokes.
6. Tap **END SESSION**.
7. Repeat for other participants.
8. Stop the Android recording and keep the original audio unchanged.
9. Run `scripts/decode_dtmf.py` against the original recording.

## Planned stages

1. DTMF generator + protocol tests — **complete**
2. DTMF decoder + automatic audio segmentation — **in progress**
3. Booking, participant and recording data model
4. Public scheduler + cancellation/rescheduling
5. Operator dashboard for iPhone
6. Artwork/visualisation choices
7. Payment and T-shirt order model
8. Email confirmations/reminders
9. Print-on-demand fulfilment integration

## Privacy

The repository is public. Never commit participant names, addresses, email addresses, phone numbers, payment data or real booking exports. Production secrets and personal data must live outside Git.
