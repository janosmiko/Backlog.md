---
id: BACK-623.1
title: Accept several task IDs in a CLI status move
status: Done
assignee:
  - '@claude'
created_date: '2026-08-26 04:23'
updated_date: '2026-08-26 04:43'
labels: []
dependencies: []
parent_task_id: BACK-623
type: feature
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the batch move to the canonical surface first, and give the other surfaces one shared implementation to call.

`backlog task edit` takes a single `[taskId]`. Extend it to accept several task IDs for the flags that carry the same value for every task: `--status`, `--assignee`, `--priority`, `--type`, `--milestone`, and the label flags. Reject the per-task flags when the user passes more than one ID, because a title, a description, a plan, a note, or an acceptance-criterion index cannot mean the same thing across a batch.

Put the move itself in one Core method so the web board and the TUI board reuse it instead of writing their own loop. The method takes the task IDs and the target status, moves each task, and returns the moved tasks with the failures.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 backlog task edit BACK-1 BACK-2 BACK-3 -s "In Progress" moves all three tasks
- [x] #2 The command exits non-zero and names each task that failed, and still applies the change to the tasks that succeed
- [x] #3 The command rejects per-task flags when the user passes more than one task ID: --title, --description, --plan, --notes, --final-summary, --comment, --ordinal, --modified-file, and every acceptance-criteria and Definition-of-Done index flag
- [x] #4 The error message for a rejected flag names the flag and explains that it applies to one task only
- [x] #5 Shared flags stay allowed for a batch: --status, --assignee, --priority, --type, --milestone, and the label flags
- [x] #6 A single task ID keeps the current output and the current exit code
- [x] #7 --plain prints one line per task with its outcome
- [x] #8 Tests cover a mixed batch of successes and failures, a rejected per-task flag, and the single-ID path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Change the task edit argument to a variadic [taskIds...] and keep the wizard path on the first ID.
2. Reject the per-task flags when the user passes more than one ID: --title, --description, --plan, --append-plan, --notes, --append-notes, --final-summary, --append-final-summary, --comment, --comment-author, --ordinal, --modified-file, and the six acceptance-criteria and Definition-of-Done index flags.
3. Build the shared TaskUpdateInput once, then apply it to each resolved task in a loop.
4. Collect a failure entry for every unknown ID and every rejected write, and keep the remaining tasks moving.
5. Print one outcome line per task for a batch, and keep the current single-ID output and exit code.
6. Exit non-zero when the batch has at least one failure.
7. Add src/test/cli-task-batch-edit.test.ts covering a mixed batch, a rejected per-task flag, an unknown ID, and the single-ID path.
8. Run bunx tsc --noEmit, bun run check ., and the new test file.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Reused the existing single-task edit path per ID instead of adding a Core batch method. The CLI status change carries no ordinal, so a batch is just the same edit repeated. The ordinal-aware Core method belongs with the board work in BACK-623.2.

Rejected per-task flags: --title, --description, --desc, --plan, --append-plan, --notes, --append-notes, --final-summary, --append-final-summary, --comment, --comment-author, --ordinal, --modified-file, and the six index flags. The acceptance-criteria and Definition-of-Done content flags (--ac, --dod, --acceptance-criteria, --clear-ac) stay allowed, because the same criterion text applies to several tasks.

Verified with bun test src/test/cli-task-batch-edit.test.ts (6 pass), bunx tsc --noEmit, and bun run check . (370 files, clean). Full bun run test: 2196 pass, 2 fail. Both failures are in src/test/tui-task-composer.test.ts and reproduce on a tree with src/cli.ts stashed, so they pre-date this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
backlog task edit now takes several task IDs and applies the shared-field change to each one. A failure on one task does not stop the rest: the command prints an outcome line per task, names each failure, and exits non-zero when any task fails. Flags that cannot mean the same thing across a batch are rejected up front with a message that names the flag. A single ID keeps its previous output and exit code. Verified with a new integration test file covering the mixed batch, the rejected flag, the shared flags, --plain, and the single-ID path.
<!-- SECTION:FINAL_SUMMARY:END -->
