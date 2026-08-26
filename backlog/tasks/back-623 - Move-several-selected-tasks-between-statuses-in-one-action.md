---
id: BACK-623
title: Move several selected tasks between statuses in one action
status: Done
assignee: []
created_date: '2026-08-26 04:23'
updated_date: '2026-08-26 05:10'
labels: []
dependencies: []
type: feature
ordinal: 261000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Today a user moves one task at a time. Every surface changes the status of a single task per action: the CLI takes one task ID in `backlog task edit`, the web board drags one card, and the TUI board moves one task with the m key. A user who reorganizes a board after a planning session repeats the same action for every task.

This parent task covers the shared behavior across all three surfaces. Each surface lands as a subtask.

Failure handling is partial, not transactional. When one task in a batch fails (unknown ID, invalid status, write conflict), the remaining tasks still move. The surface reports which tasks moved and which failed. A rollback layer over per-task atomic writes is out of scope.

Ordering inside the target column follows the existing single-task rules. The batch appends the moved tasks to the target column in the order the user selected them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A user moves several tasks to one status in a single action on the CLI, the web board, and the TUI board
- [x] #2 A failed task in a batch does not stop the remaining tasks from moving
- [x] #3 Every surface reports the count of moved tasks and names each failed task with its reason
- [x] #4 Batch move validates the target status the same way a single-task move does
- [x] #5 Moving one task keeps its current behavior on all three surfaces
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All three surfaces now move several tasks at once. The CLI takes several task IDs in backlog task edit and rejects the flags that cannot mean the same thing across a batch. The web board selects cards with Ctrl-click, Cmd-click, and Shift-click, then moves them by drag or through a toolbar. The TUI board marks tasks with Space and moves the marked set with m. Core.moveTasksToStatus carries the shared behavior for both boards: it appends the batch to the target column in one bulk write and returns a failure entry per task that could not move, so a failure never stops the rest. Verified with 31 new tests across the Core method, the HTTP endpoint, the CLI, the web board, and the TUI board.
<!-- SECTION:FINAL_SUMMARY:END -->
