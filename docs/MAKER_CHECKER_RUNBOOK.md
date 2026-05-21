# Maker-Checker Runbook

## Scope
Sensitive admin actions in Emcoin Portal cannot be applied by a single person.
Every change goes through three steps: submit, approve, execute. The same
person cannot approve or execute their own submission.

## Roles needed

You need **at least two** users with roles eligible to approve. Eligible roles
for approving / rejecting / executing approvals are determined by
`canApproveRequests`:
- `super_admin`
- `admin`
- `operations`
- `compliance`
- `finance`

The submitter (maker) can be any user whose role is allowed to *submit* the
specific action (e.g. price update requires admin/super_admin). The checker
must be a different user from the maker.

If only one admin user exists in the system, no controlled action can ever
execute. Provision a second eligible user before relying on these flows.

## Controlled actions

| Action | Submit endpoint | Verb |
|---|---|---|
| Manual price update | `/api/pricing/:productId` | PATCH |
| Settings update | `/api/settings` | PATCH |
| Investment request status update | `/api/requests/:id/status` | PATCH |
| Portfolio position create | `/api/portfolio/positions` | POST |
| Portfolio position update | `/api/portfolio/positions/:id` | PATCH |
| Portfolio position delete | `/api/portfolio/positions/:id` | DELETE |
| Statement upload | `/api/statements` | POST (multipart) |
| Statement delete | `/api/statements/:id` | DELETE |
| Client create | `/api/clients` | POST |
| Client update | `/api/clients/:id` | PATCH |

All of these return **HTTP 202** with body `{ "pending": true, "approvalId": "apr_..." }`.
**The change has not been applied yet.**

## How the lifecycle works

1. **Submit (maker).** The maker hits one of the endpoints above. The system
   creates an `approval_requests` row with `status='pending'`. For statement
   uploads the file is placed in
   `/opt/emcoin/uploads/statements/.quarantine/`. Clients cannot see it yet.

2. **Approve / Reject (checker).**
   - Approve: `POST /api/approvals/:id/approve` (optional `{ "reason": "..." }`)
     → `status='approved'`. The action still has not run.
   - Reject: `POST /api/approvals/:id/reject` (`{ "reason": "..." }`)
     → `status='rejected'`. For statement uploads the quarantined file is
     deleted automatically.

3. **Execute (checker, can be a different person from the approver).**
   `POST /api/approvals/:id/execute` runs the registered action handler
   inside a database transaction. Status flips
   `approved → executing → executed`. Concurrent calls are race-safe; only
   one wins, the rest receive `{ alreadyExecuted: true }` or
   `{ inProgress: true }`. If the handler fails, status reverts to
   `approved` and the request is retryable.

## Where to do it in the UI

- **Submit** happens from the relevant admin page (Pricing, Settings,
  Portfolios, Clients, Statements, Requests). After clicking Save you should
  see a "Submitted for approval" banner with the approval ID.
- **Approve / Reject / Execute** happens at `/admin/approvals`.

## What happens to statements before approval

- File lands in `/opt/emcoin/uploads/statements/.quarantine/`.
- No row in the `statements` table.
- `GET /api/statements/:id/download` returns 404 even for admins.
- Clients see no statement until execution.
- On reject or cancel, the quarantined file is deleted.
- A weekly sweeper (`/opt/emcoin/scripts/cleanup-quarantine.sh`) removes
  quarantined files older than 14 days whose approval is in a final state
  (rejected / cancelled / executed). Files for pending or approved
  approvals are never touched.

## Negative-path guarantees

- Maker cannot approve, reject, or execute their own request → `403 approval_self_action_forbidden`.
- A rejected approval cannot be executed → `400 approval_invalid_state`.
- An executed approval cannot be executed again → `200 { alreadyExecuted: true }`.
- A handler failure leaves status at `approved`, never falsely `executed`.
- Concurrent execute calls cannot run the handler twice (atomic claim).

## Where temporary admin / checker passwords live

- `/root/admin_initial_password.txt` (mode 600, root-only)
- `/root/checker2_initial_password.txt` (mode 600, root-only)

Both accounts have `must_change_password = 1` set. On first login the client
should call `POST /api/auth/change-password` with `{ currentPassword, newPassword }`
to clear the flag and choose a permanent password. **Passwords are not stored
in this runbook, in chat history, in environment variables, or in any logs.**

## Operational tips

- View pending queue: `sqlite3 /opt/emcoin/data/emcoin.sqlite "SELECT id, action, status, created_at FROM approval_requests WHERE status IN ('pending','approved') ORDER BY created_at DESC;"`
- Audit log filter: `sqlite3 ... "SELECT created_at, action, entity_type, entity_id FROM audit_logs ORDER BY created_at DESC LIMIT 50;"`
- Quarantine status: `ls -la /opt/emcoin/uploads/statements/.quarantine/`
- Approval handler errors are logged as JSON with code `approval_handler_failed` to `/opt/emcoin/logs/api-error.log`.
