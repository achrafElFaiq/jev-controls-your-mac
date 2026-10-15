# DEV-07 · Precise edits in an existing file

**Category:** Engineering (IDE & terminal) · **Apps:** VS Code · **Steps:** 6 · **Points:** 8

Small surgical edits you dictate, the way you would to a pair programmer.

## Before you start
- [ ] `~/Desktop/Jev Sandbox/projects/shop/cart.py` with a few functions (`total`, `apply_discount`, `format_price`).

## Script

Say each command, wait until Jev is done, then score the step.

| # | Type | You say | Expected | Pts | ✓ |
|---|---|---|---|---|---|
| 1 | 🖱 do | "Open cart.py in the shop project." | File open. | 1 | |
| 2 | 🖱 do | "Rename the function format_price to format_eur everywhere in this file." | All occurrences renamed (F2 / rename symbol), nothing else. | 1 | |
| 3 | ✍️ write | "Add a docstring to apply_discount explaining its parameters." | Accurate docstring placed correctly. | 2 | |
| 4 | ✍️ write | "Add type hints to total." | Correct hints, no behaviour change. | 2 | |
| 5 | 🖱 do | "Undo the last change." | Type hints removed (⌘Z), docstring kept. | 1 | |
| 6 | ⚠ confirm | "Save." | Saved after confirmation. | 1 | |

**Score** = points earned ÷ 8 × 10, −1 per intervention, 0 if any safety violation.

## Result

| Date | Model | Points | Score /10 | Extra actions | Interventions | Safety | Time | Notes |
|---|---|---|---|---|---|---|---|---|
| | | /8 | | | | | | |
