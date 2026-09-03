# One way in: importing leads from every channel

Every channel's export lands in the same place — **Leads → Import** — and every
one is handled the same way: columns are matched by their header text, anyone
already in the CRM is combined rather than duplicated, and nothing is written
until you confirm a preview that shows exactly what will happen.

## What you can upload

`.xlsx`, `.csv` or `.tsv`, up to 5 MB and 5,000 rows. An Excel file is read
from its first sheet. Commas, semicolons and tabs are detected automatically,
and Excel's byte-order mark and date serials are handled without asking.

| Channel | Where the file comes from | Notes |
|---|---|---|
| Meta lead ads | Business Suite → Instant Forms → Download | Works as it comes, `.csv` or `.xlsx`. The `platform` column decides Facebook or Instagram per row; campaign, ad set and form names become tags. |
| WhatsApp Business | Contact or broadcast export | Or paste enquiries into the template's Name, Phone and Requirement columns. |
| Website form | Any form plugin's export | Map the message field to Requirement so the enquiry text is kept. |
| Portals | 99acres, MagicBricks, Housing | Column names vary; the auto-mapper knows the common ones and reads the portal per row where the file names it. |
| Offline | Walk-in register, hoarding, print, events | Use the template. Put the campaign in Tags (`Hoarding: ORR Exit 14`) so offline spend can be measured against bookings in Reports. |

## The unified template

Download it from the import screen, or at `/api/leads/template`. Its headers are
exactly what the auto-mapper recognises, so a file saved from it needs no
mapping step at all.

`Name` and `Phone` are the only required columns. Everything else may be blank.

Budgets accept the way people actually write them: `85 L`, `1.2 Cr`, `₹95 L`,
`8500000`. Tags are semicolon-separated. Dates may be anything a spreadsheet
produces; a date in the future is rejected as a mis-parsed day/month.

## How duplicates are handled

A person is the same person when the **last ten digits of their phone** match,
or, failing that, when their **email** matches. `+91 98480 44556`,
`098480 44556` and `9848044556` are one number.

You choose what happens, per import:

- **Combine them** (default). The existing lead keeps its id, its owner, its
  stage and its history. Blank fields are filled, tags are unioned, the new
  requirement is appended as a new line, the budget widens to cover both
  figures, the temperature only ever rises, and the earliest enquiry date wins.
  Source and stage are never changed: the first touch keeps the attribution,
  and an import must not drag a negotiating lead back to New. A note goes on
  the timeline naming the file, the row, the channel and what was combined —
  and, when the match was by email, the second phone number.
- **Leave them alone.** Import only the people who are new.
- **Add anyway.** Create a second lead. Only for files you know hold different
  people sharing a number.

The preview lists every lead that will be combined and what will change, before
anything is written. Re-uploading the same file adds nobody.

## What this protects you from

Two failures this design exists to prevent:

- **The same buyer counted twice.** They fill a website form in August and a
  Meta form in September; two agents call the same person, and the report shows
  two leads for one buyer.
- **A campaign column stealing the name.** A Meta export puts `campaign_name`
  five columns ahead of `full_name`. Naive substring matching maps the campaign
  to Name and leaves the real name unmapped — an import that looks fine and
  files every lead under its ad set. Exact header matches are now resolved
  across the whole row before any fuzzy match is considered.
