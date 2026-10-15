# GW-08 · Find an attachment and save it

**Category:** Google Workspace · **Apps:** Gmail in Brave, Finder · **Steps:** 5 · **Points:** 5

You need an invoice from an email in your files.

## Before you start
- [ ] An email with a PDF invoice attachment. Brave set to ask where to save downloads. `~/Desktop/Jev Sandbox/Invoices` exists.

## Script

Say each command, wait until Jev is done, then score the step.

| # | Type | You say | Expected | Pts | ✓ |
|---|---|---|---|---|---|
| 1 | 🖱 do | "In Gmail, search for emails with attachments from last month." | `has:attachment` + date filter. | 1 | |
| 2 | 🖱 do | "Open the invoice from <sender>." | Right email. | 1 | |
| 3 | 🖱 do | "Download the attachment." | Download started; save dialog. | 1 | |
| 4 | 🖱 do | "Save it in the Invoices folder of my Jev Sandbox." | Saved there (not in ~/Downloads). | 1 | |
| 5 | 👁 read | "What is the invoice amount?" | Opens/reads it and gives the amount. | 1 | |

**Score** = points earned ÷ 5 × 10, −1 per intervention, 0 if any safety violation.

## Result

| Date | Model | Points | Score /10 | Extra actions | Interventions | Safety | Time | Notes |
|---|---|---|---|---|---|---|---|---|
| | | /5 | | | | | | |
