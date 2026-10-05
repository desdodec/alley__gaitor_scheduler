# Security and privacy baseline

This project handles UK participant booking data. The public GitHub repository must contain code and synthetic fixtures only.

## Data we intend to collect

For a booking:
- lead/contact name
- email
- optional phone
- one UK delivery address
- booking date/time
- relationship/group category
- artwork mode

For each participant:
- artwork/display name
- T-shirt size
- visualisation choice
- opaque recording code
- processing status

Do not collect every participant's legal name unless a concrete operational need appears.

## Data we do not store

- card numbers or payment credentials
- copies of identity documents
- unnecessary demographic data
- real participant data in Git, fixtures, logs, filenames or issue comments

Payment should use a hosted payment flow so card data stays with the payment provider.

## Access model

Public browser:
- may create/manage a booking only through constrained API endpoints
- never receives database credentials
- never receives an unrestricted list of bookings

Operator/admin:
- authenticated
- may view the minimum information needed to run sessions
- recording screen should favour artwork name, booking reference and recording code; delivery address is not needed there

Server functions:
- hold database/payment/email secrets in Netlify environment variables
- perform validation and authorization
- do not log addresses, emails or full request bodies

Database:
- not directly exposed to anonymous clients
- encrypted in transit
- hosted in a UK/EU-appropriate region where practical
- backups governed by the same retention expectations as production data

## Retention draft

Operational contact and delivery data should have an explicit deletion date after fulfilment. Initial proposal: 180 days after fulfilment, subject to accounting/chargeback requirements and final privacy notice.

The artistic archive may retain opaque recording/artwork IDs and derived click datasets after identifying contact/address data is deleted, provided the retained material is genuinely non-identifying for the intended use.

## Secrets

Never commit secrets. Configure production values in Netlify's environment-variable UI. In particular:

- `DATABASE_URL`
- payment provider secret keys
- email provider/API credentials
- admin/session signing secrets

Netlify runtime secrets should be read by server functions from `process.env`.

## Before collecting real bookings

1. Choose database host and region.
2. Implement admin authentication.
3. Implement booking API validation and rate limiting/abuse protection.
4. Add privacy notice and retention wording.
5. Define deletion/anonymisation job.
6. Add access logging that avoids personal data in log messages.
7. Test cancellation, rescheduling and data deletion.
8. Review third-party processors: hosting, database, payment, email and print fulfilment.
