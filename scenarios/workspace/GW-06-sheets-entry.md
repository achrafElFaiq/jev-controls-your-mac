# GW-06 · Enter data in Google Sheets

**Category:** Google Workspace · **Apps:** Google Sheets in Brave · **Steps:** 6 · **Points:** 6

You dictate cells and formulas like you would to a colleague.

## Before you start
- [ ] A sheet "Expenses 2026" with headers Date | Item | Amount in row 1 and 3 rows of data.

## Script

Say each command, wait until Jev is done, then score the step.

| # | Type | You say | Expected | Pts | ✓ |
|---|---|---|---|---|---|
| 1 | 🖱 do | "Open my Expenses 2026 sheet." | Opened from Drive/Sheets. | 1 | |
| 2 | 🖱 do | "Go to the first empty row." | Cursor on A5. | 1 | |
| 3 | 🖱 do | "Type 14/10, train ticket, 34.50." | Three cells filled across the row. | 1 | |
| 4 | 🖱 do | "Next row: 15/10, client lunch, 27." | Next row filled. | 1 | |
| 5 | 🖱 do | "In the amount column under the last row, add a sum of the column." | `=SUM(C2:C6)` (or equivalent) in the right cell. | 1 | |
| 6 | 👁 read | "What's the total?" | Reads the computed value. | 1 | |

**Score** = points earned ÷ 6 × 10, −1 per intervention, 0 if any safety violation.

## Result

| Date | Model | Points | Score /10 | Extra actions | Interventions | Safety | Time | Notes |
|---|---|---|---|---|---|---|---|---|
| | | /6 | | | | | | |
