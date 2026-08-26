---
id: BACK-623.2
title: Select several cards on the web board and move them together
status: Done
assignee:
  - '@claude'
created_date: '2026-08-26 04:23'
updated_date: '2026-08-26 04:48'
labels: []
dependencies: []
parent_task_id: BACK-623
type: feature
ordinal: 263000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The web board moves one card per drag. Add a selection layer on top of the existing drag and drop.

A user holds Ctrl or Cmd and clicks cards to add them to the selection, or holds Shift and clicks to select a range inside one column. The selected cards show a visible selected state. A plain click on a card still opens the task editor, so selection must not steal that gesture.

When the user drags any selected card, the whole selection moves to the target column. A toolbar above the board shows the selection count and offers a status menu as the keyboard-reachable path, because drag and drop alone is not accessible.

Clicking empty board space, pressing Escape, or a completed move clears the selection.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ctrl-click or Cmd-click adds a card to the selection and removes it when the card is already selected
- [x] #2 Shift-click selects the range between the last selected card and the clicked card inside one column
- [x] #3 A plain click with no selection still opens the task editor
- [x] #4 Dragging any selected card moves every selected card to the target column
- [x] #5 A toolbar shows the selection count and moves the selection to a chosen status without a drag
- [x] #6 Escape, a click on empty board space, and a completed move each clear the selection
- [x] #7 A partial failure keeps the moved tasks in place and shows which tasks failed and why
- [x] #8 Selected cards show a visible selected state in light theme and dark theme
- [x] #9 Tests cover ctrl-click, shift-click range, a batch drag, the toolbar move, and a partial failure
- [x] #10 Core exposes one ordinal-aware batch move method that returns the moved tasks and the failures
- [x] #11 The server exposes one endpoint for the batch move so the board makes one request
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Core.moveTasksToStatus: resolve each ID, skip and report the ones that fail, append the rest to the end of the target column with fresh ordinals, and write them in one bulk update.
2. Add POST /api/tasks/move and apiClient.moveTasks so the board makes one request per batch.
3. Give TaskCard an isSelected flag and an onSelect callback, and route ctrl, cmd, and shift clicks to selection instead of the editor.
4. Give TaskColumn the selection props, compute the shift range from its own task order, and send a batch drop to onBatchMove.
5. Hold the selection in Board, clear it on Escape, on a background click, and after a move, and add the count toolbar with the status menu.
6. Cover the Core method, the endpoint, and the board interactions with tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Core.moveTasksToStatus appends the batch to the end of the target column rather than reusing reorderTask per task. One bulk write, one commit, and the tasks already in the column keep their ordinals.

The plain click still opens the editor even while a selection exists, so the selection never steals the primary gesture. Cross-branch tasks stay out of the selection, matching the existing drag block.

Verified with bun test src/test/core-move-tasks-to-status.test.ts (6 pass), src/test/server-move-tasks-endpoint.test.ts (3 pass), and src/test/web-board-batch-move.test.tsx (9 pass). Disabling the ctrl-click branch in TaskCard turns 6 of the 9 board tests red, which confirms the suite binds to the new behavior. bunx tsc --noEmit and bun run check . pass. The existing web board tests (drag with hidden columns, column sort, task types) and reorder-utils still pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The web board now selects several cards and moves them together. Ctrl-click or Cmd-click toggles a card, Shift-click extends the range inside a column, and a plain click still opens the editor. Dragging any selected card moves the whole selection, and a toolbar with the selection count offers the same move without a drag for keyboard users. Escape, a background click, and a completed move clear the selection. Behind it, Core.moveTasksToStatus appends the batch to the target column in one bulk write and reports per-task failures, which POST /api/tasks/move returns to the board. Verified with 18 new tests across the Core method, the endpoint, and the board interactions.
<!-- SECTION:FINAL_SUMMARY:END -->
