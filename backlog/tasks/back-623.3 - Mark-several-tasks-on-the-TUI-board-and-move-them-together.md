---
id: BACK-623.3
title: Mark several tasks on the TUI board and move them together
status: Done
assignee:
  - '@claude'
created_date: '2026-08-26 04:23'
updated_date: '2026-08-26 05:09'
labels: []
dependencies:
  - BACK-623.2
parent_task_id: BACK-623
type: feature
ordinal: 264000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The TUI board moves one task with the m key. Add a mark set on top of it.

Space toggles the mark on the task under the cursor. Marked tasks show a marker in the column list so the user sees the set without scrolling back. The existing m key then moves every marked task instead of the task under the cursor. When no task is marked, m keeps its current single-task behavior.

Escape clears the mark set, and so does a completed move. The footer shows the marked count while the set is not empty.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Space toggles the mark on the task under the cursor
- [x] #2 Marked tasks show a visible marker in the column list
- [x] #3 The m key moves every marked task to the chosen column
- [x] #4 The m key keeps its current single-task behavior when no task is marked
- [x] #5 Escape and a completed move each clear the mark set
- [x] #6 The footer shows the marked count while the mark set is not empty
- [x] #7 A partial failure keeps the moved tasks in place and shows which tasks failed
- [x] #8 The filter guard that blocks a single move also blocks a batch move
- [x] #9 Tests cover the mark toggle, a batch move, the empty-mark fallback, and a partial failure
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Hold a mark set and a batch target status in the board state next to moveOp.
2. Give formatTaskListItem a marked flag and prefix a marked row with a cyan dot.
3. Bind Space to toggle the mark on the task under the cursor, and block the key for a cross-branch task.
4. Send the m key to a batch move mode when the mark set is not empty, after the existing filter guard.
5. Reuse left and right to pick the target column in batch mode, and Enter or m to confirm through core.moveTasksToStatus.
6. Clear the mark set on Escape and after a completed move, and report the failures in the footer.
7. Show the marked count in the footer and the mark key in the help popup.
8. Drive the real board through the keyboard test harness to cover each behavior.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The batch move reuses the m key rather than adding a second move key. The mark set decides which path m takes, so an unmarked board keeps the exact move mode it had.

Batch move mode skips the ghost projection that single-task move mode draws. A batch appends to the end of the target column, so there is no insert position to preview, and left and right alone pick the column.

The help popup already filled a 24-row terminal, so the mark key shares the move row as Space/M rather than adding a nineteenth row. Two existing help tests were updated for the new key label.

Verified with bun test src/test/board-tui-batch-move.test.ts (7 pass), which drives the real board through the keyboard harness. Disabling the batch branch in the m handler turns 2 of the 7 red. bunx tsc --noEmit and bun run check . pass. Full bun run test: 2221 pass, 2 fail, both in src/test/tui-task-composer.test.ts and both pre-existing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The TUI board now marks several tasks and moves them together. Space toggles the mark on the task under the cursor and a cyan dot marks the row. With a mark set, m opens a batch move mode where left and right pick the target column and Enter or m confirms through core.moveTasksToStatus. An empty mark set leaves m on its single-task move mode. Escape and a completed move clear the marks, the footer carries the marked count and the per-task failures, and the filter guard that blocks a single move blocks the batch too. Verified with 7 tests that drive the real board through the keyboard harness.
<!-- SECTION:FINAL_SUMMARY:END -->
