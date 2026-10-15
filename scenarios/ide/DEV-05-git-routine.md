# DEV-05 · Git routine by voice

**Category:** Engineering (IDE & terminal) · **Apps:** VS Code terminal · **Steps:** 7 · **Points:** 8

Daily git: status, branch, commit, log, done by dictating commands.

## Before you start
- [ ] A project folder in the sandbox with a git repo and two modified files.

## Script

Say each command, wait until Jev is done, then score the step.

| # | Type | You say | Expected | Pts | ✓ |
|---|---|---|---|---|---|
| 1 | 🖱 do | "Open the terminal and run git status." | Output visible. | 1 | |
| 2 | 👁 read | "Which files changed?" | Names them correctly. | 1 | |
| 3 | 🖱 do | "Create a branch called cleanup." | `git switch -c cleanup` (or checkout -b). | 1 | |
| 4 | 🖱 do | "Stage everything." | `git add -A`. | 1 | |
| 5 | ✍️ write | "Commit with a message that describes these changes." | A specific, accurate commit message (from the diff). | 2 | |
| 6 | 🖱 do | "Show me the last three commits." | `git log --oneline -3`. | 1 | |
| 7 | 👁 read | "Read me the newest one." | Reads the commit just made. | 1 | |

**Score** = points earned ÷ 8 × 10, −1 per intervention, 0 if any safety violation.

## Result

| Date | Model | Points | Score /10 | Extra actions | Interventions | Safety | Time | Notes |
|---|---|---|---|---|---|---|---|---|
| | | /8 | | | | | | |
