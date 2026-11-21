# CertiFlow roles and demo credentials

These are seeded local demonstration accounts, not production credentials. Sign in at http://localhost:8080/login using the normal email/password form. Account details and one-click demo switching are intentionally not displayed on the public login screen.

The default password for every account below is **`CertiFlowDemo123!`**. If `DEMO_PASSWORD` was changed before the first backend seed, use that password instead. Rerunning the seed does not reset existing passwords.

| Name | Email | Role | Responsibilities |
| --- | --- | --- | --- |
| Anika | `anika@certiflow.demo` | Training centre | Create batches, import candidates, submit, correct returned batches, download certificates and track delivery. |
| Dev | `dev@certiflow.demo` | District officer | Review district batches; approve, return for correction, or reject. |
| Meera | `meera@certiflow.demo` | District officer | Independently review district batches and provide the second approval. |
| Kabir | `kabir@certiflow.demo` | District officer | Another eligible district reviewer; any two distinct officers can approve. |
| Neha | `neha@certiflow.demo` | Quality reviewer | Review batches with more than 50 candidates after district approval. |
| Farah | `farah@certiflow.demo` | State officer | Final approval, overdue-stage monitoring, failed-job recovery and certificate revocation. |

## How to explore the workflow

1. Sign in as Anika, create a batch, add candidates, and submit it.
2. Sign out and sign in as Dev to approve through Review Inbox.
3. Sign out and sign in as Meera (or Kabir) for the second district approval.
4. For batches with more than 50 candidates, sign in as Neha and approve.
5. Sign in as Farah and give final approval. The background worker issues certificates and processes mock WhatsApp delivery.
6. Open the batch's Certificates and Delivery tabs to follow progress.
7. Use Public Verify to check a certificate without logging in.

Returning a batch requires a reason. Anika can correct and resubmit it; resubmission resets approvals and retains the earlier history. Rejection is terminal. Farah can revoke an issued certificate; public verification then reports it as revoked.

Candidates do not have staff accounts: they download PDFs through signed links. Employers/public use `/verify` without credentials. WhatsApp delivery is simulated; no real messages are sent.

## Local setup

Run `npm run seed` in `backend/` if these accounts have not been created (requires backend demo mode). Keep the API, Redis and background worker running. The frontend uses a fixed white theme; there is no theme switcher.

The backend demo endpoints remain available when its demo mode is enabled, including for the existing Postman collection. Removing the frontend switcher does not disable those endpoints. For production, disable demo mode and provision real accounts with separate passwords.
