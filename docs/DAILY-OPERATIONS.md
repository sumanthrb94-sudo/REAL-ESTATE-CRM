# The working day: who gets which lead, and what they see

Two roles carry the day-to-day sales desk:

| Seat | Role in the app | What they can do |
|---|---|---|
| Sales manager | `SALES_MANAGER` | Everything an executive can, plus assign leads, edit distribution rules, run the sweep by hand, and see the whole team's numbers. |
| Customer-care executive | `SALES_AGENT` | Work their own leads: call, log, qualify, book site visits, raise bookings. They cannot see distribution, user administration, marketing or the leaderboard. |

`SALES_HEAD` sits above the manager and `ADMIN` above everyone; both also receive
leads if you want them in the rotation. Deactivating a user removes them from
the rotation immediately without deleting their history.

## Leads reach people three ways

1. **As they arrive.** A lead created in the app, captured from a form or
   brought in by an import is matched against the active rules straight away.
2. **The morning sweep.** Anything still ownerless — no rule matched it, nobody
   was available at 2am, or it predates the rule set — is picked up by a
   scheduled run. Set `CRON_SECRET` and point a scheduler at
   `POST /api/cron/distribute` with `Authorization: Bearer <CRON_SECRET>`. On
   Vercel this is already declared in `vercel.json` for 09:00 IST. Without the
   secret the endpoint refuses to run, so a half-configured deployment fails
   closed rather than exposing a write endpoint.
3. **By hand.** A manager can press **Distribute** on the Lead Distribution
   page after fixing a rule or finishing an import. The button says how many
   are waiting, and the result names who received how many.

The sweep is safe to run as often as you like: a lead that already has an owner
is never touched, and each lead it places gets a note on its timeline saying so,
which is why an executive can always see how a lead reached them.

If leads keep going unplaced, the reason is one of two things: no active rule
matches them, or nobody is available to receive them. The sweep reports both
rather than failing silently.

## What an executive sees at 9am

Signing in lands a manager or an executive on **My Day** rather than on the
dashboard — six months of trend charts is not what you need before your first
call. Everything on it is derived live, so an item disappears the moment the
work behind it is done. Nothing is a queue you have to clear by hand.

- **Call these first.** Leads assigned to them that have never been contacted,
  longest wait at the top. A logged call, email, WhatsApp, SMS or meeting takes
  a lead off this list; an automatic assignment note does not, because nobody
  has actually spoken to them yet.
- **Site visits.** Today's appointments with their times, plus any visit from an
  earlier day that was never closed out.
- **Follow-ups.** Tasks due today, with overdue ones first.
- **Going cold.** Leads still in play that nobody has touched for a week.

Empty sections are hidden rather than shown as zeros, and when there is nothing
at all the page says so plainly instead of presenting an empty grid.

A manager sees the same page across their whole team, plus a banner counting
leads that belong to nobody, with a link to distribute them.

## Scoping

Every section is scoped by ownership: an executive sees only their own work, a
manager sees their team's, an admin or sales head sees everyone's. This is the
same ownership scoping the leads list and the pipeline use, so there is one rule
to reason about rather than a per-page exception.
