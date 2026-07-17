---
id: BACK-430
title: Create tasks with an intent-first TUI composer
status: In Progress
assignee:
  - '@claude'
created_date: '2026-04-25 12:14'
updated_date: '2026-07-16 15:29'
labels:
  - tui
  - enhancement
milestone: m-8
dependencies: []
references:
  - 'https://github.com/MrLesk/Backlog.md/issues/579'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Deliver the production first slice of an intent-first Blessed task composer. The TUI should support deliberate capture and review using the canonical task and draft paths, without changing default semantics in the CLI, MCP adapter, or shared core.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The board exposes a discoverable task-creation command and the TUI help identifies its shortcut and purpose.
- [ ] #2 The first slice presents Title, multiline Description, Status, Type, and Priority, using configured choices and supporting the existing unset behavior where the corresponding public task field permits it.
- [ ] #3 The resting Status value is the first configured workflow status; it never defaults to the focused column or to Draft.
- [ ] #4 Draft appears as an extra first option only after the user actively opens or changes Status; merely opening the selector does not select Draft, and leaving the field unchanged preserves the first configured workflow status.
- [ ] #5 Explicit Create is the only persistence point: a normal status uses the canonical task-creation path, while explicitly selecting Draft uses the canonical draft-creation path.
- [ ] #6 Cancel exits without creating or modifying any task or draft.
- [ ] #7 Validation and persistence errors are shown without partial writes and preserve all entered values for correction or retry.
- [ ] #8 After success, the board refreshes once and focuses the created task when visible; draft or filtered-out results receive honest confirmation that explains why no task is focused.
- [ ] #9 Rendered keyboard QA covers discovery, entry, selection, review, creation, cancellation, errors, focus, and scrolling at normal and narrow terminal sizes.
- [ ] #10 Automated tests cover configured field choices, exact default/Draft semantics, canonical task-versus-draft payloads, cancellation, failures, board refresh/focus, filtered results, and watcher behavior.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ARCHITECTURE (decision): build a bespoke Blessed modal form in a new src/ui/components/task-composer.ts, NOT a Blessed TaskWizardPromptRunner reusing runTaskCreateWizard. Rationale: the wizard's question model is text|select only and its Description is explicitly single-line (SINGLE_LINE_PROMPT_GUIDANCE, task-wizard.ts:72), conflicting with AC #2's multiline Description; its sequential one-prompt-at-a-time control flow inverts against a form that must hold all values for correction/retry (AC #7); it has no Draft concept (AC #4/#5); and BACK-543's progressive disclosure + review state needs a form foundation, not a prompt chain. Reuse the pure seams instead (see step 3).
2. PERSISTENCE: the composer owns the Create action and calls core.createTaskFromInput(input) itself while the modal is still open, returning Promise<Task|null>. Core.createTaskFromInput (src/core/backlog.ts:1275) is the single canonical path for BOTH task and draft - draft is selected purely by the status==="Draft" sentinel (backlog.ts:1282), which is exactly how the CLI (cli.ts:1799) and MCP (mcp/tools/tasks/handlers.ts:121) already call it. The composer becomes a third caller; do not modify the core method or its existing callers. On failure keep the modal open, render the error, preserve all entered values (AC #7). Catch validation Error and isCreateLockError distinctly, mirroring the MCP handler.
3. REUSE the pure seams rather than duplicating: extract the TaskWizardValues->TaskCreateInput mapping (task-wizard.ts:630-661) into a shared exported pure function so the CLI wizard and the composer map identically; reuse createPopupChrome (filter-popup.ts:49) for modal chrome, openSingleSelectFilterPopup (filter-popup.ts:119) for Status/Type/Priority pickers, and the board's showTransientFooter idiom (board.ts:879) for feedback.
4. PURE HELPERS to extract and unit-test in isolation (modelled on src/test/board-hide-empty-columns.test.ts): (a) resolveRestingStatus(...) for AC #3; (b) buildComposerStatusOptions(statuses, statusWasOpened) prepending Draft ONLY once the user actively opened/changed Status, per AC #4; (c) the payload mapper from step 3.
5. BOARD WIRING: bind n/N on the board (verified free - taken keys are p,t,f,i,h,l,k,j,e,m,y,c,a,H,q plus arrows/enter/tab/?; the 6038cd5 prototype also chose N). Guard with runWithModalGuard (board.ts:309) + popupOpen like every other modal. After success: upsert into currentTasks, renderView(), then restoreSelection(newTaskId) - restoreSelection already accepts a taskId and focuses it (board.ts:614), so AC #8's focus requirement reuses it rather than adding a new mechanism. When the created item is a draft or is filtered out of the current view, do not fake focus: emit an honest transient footer explaining why (AC #8).
6. DISCOVERABILITY (AC #1): add N to DEFAULT_FOOTER_CONTENT (board.ts:174) and BOARD_SHORTCUTS (help-popup.ts), matching how BACK-548 documented H.
7. WATCHER (AC #10): creating the file also fires watchTasks (src/utils/task-watcher.ts:79) after its ~50-90ms settle window, so one creation can legitimately render twice (composer's own render + watcher-driven render via unified-view emitBoardUpdate). Test that the watcher-driven second render is idempotent (no duplicate in currentTasks) and does not clobber focus on the new task.
8. MULTILINE DESCRIPTION (AC #2): neo-neo-bblessed ships a textarea widget but it is used NOWHERE in src/ today (only external $EDITOR handoff via Core.openEditor). This is the main unproven surface - prototype it early and fall back to a deliberate alternative if it misbehaves under the AC #9 narrow-terminal QA.
9. TESTS (AC #10): src/test/tui-task-composer.test.ts for pure helpers + rendered behaviour via the withTtyScreen harness (src/test/generic-list-selection.test.ts:12, drives widgets with .emit("key ...")); persistence/draft-payload tests against a real temp project + Core (src/test/core.test.ts:14 beforeEach idiom with createUniqueTestDir/initializeTestProject/safeCleanup); AC #9 narrow-terminal keyboard QA modelled on src/test/tui-interactive-editor-handoff.test.ts (real PTY via 'expect', COLUMNS/LINES env, gated by RUN_INTERACTIVE_TUI_TESTS=1, also run against the compiled binary in CI).
10. GATE: bunx tsc --noEmit, bun run check ., bun test.

OPEN QUESTION blocking step 4a - see notes: AC #3's 'first configured workflow status' conflicts with two existing definitions of default status.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Activated for planning. Triage: Large (new TUI composer surface, 10 ACs, canonical task+draft persistence paths). Project statuses are limited to To Do/In Progress/Done, so pipeline stages (planning, implementation, review, automated test) run within In Progress; user owns the move to Done. Per the task's own notes, the 6038cd5 prototype is research-only and its focused-column status default is superseded by the ACs; researching current code before planning.

Research complete (3 parallel agents + direct verification). Key findings: (1) Core.createTaskFromInput (src/core/backlog.ts:1275) is the SINGLE canonical path for both tasks and drafts - draft is chosen by the status==='Draft' sentinel (backlog.ts:1282), not a separate method; CLI (cli.ts:1799) and MCP (mcp/tools/tasks/handlers.ts:121) both call it, so the composer is simply a third caller. ID allocation + write are guarded by a cross-process lock, FileSystem.withCreateLock (file-system/operations.ts:334). (2) The 6038cd5 prototype is NOT reachable from main (orphaned remote commit, never merged) and none of its code exists in the tree; it had no Type field, no Draft concept, and its own default was already statuses[0], so it is reference-only as the task notes state. (3) An existing CLI wizard, runTaskCreateWizard (src/commands/task-wizard.ts:612), already collects these fields behind an injectable TaskWizardPromptRunner and returns TaskCreateInput WITHOUT persisting - evaluated for reuse and rejected for the reasons in plan step 1, but its value->TaskCreateInput mapping should be extracted and shared rather than duplicated. (4) No generic multi-field form exists in src/ui - this composer would be the first; no textarea widget is used anywhere in src/ today. (5) restoreSelection(taskId) (board.ts:614) already focuses an arbitrary task by id, so AC #8 reuses it. (6) The fs watcher will fire on the composer's own write, so one creation can render twice (AC #10 must cover this).

OPEN QUESTION for Alex - AC #3 default-status ambiguity. AC #3 requires the resting Status to be 'the first configured workflow status'. Three definitions of default status already exist and disagree in general: (a) config.defaultStatus, which Core.createTaskFromInput applies when status is omitted (backlog.ts:1339); (b) getDefaultCreateStatus(statuses) in the CLI wizard (task-wizard.ts:121), which prefers a canonical 'To Do' if configured and otherwise falls back to statuses[0]; (c) AC #3 read literally, i.e. statuses[0]. In this project all three resolve to 'To Do' so the divergence is invisible here, but for a project whose statuses[0] is not 'To Do', or whose defaultStatus differs from statuses[0], the composer would visibly disagree with the CLI wizard and with plain 'task create'. Implementing AC #3 literally means the TUI deliberately diverges from both existing surfaces. Needs a product decision before the resolveRestingStatus helper is written.

DECISION (Alex, 2026-07-16) on the AC #3 open question: match the CLI wizard. The composer's resting Status resolves via the existing getDefaultCreateStatus(statuses) helper (src/commands/task-wizard.ts:121) - canonical 'To Do' when configured, otherwise the first non-empty configured status - reusing that function rather than reimplementing, so the TUI and the CLI wizard cannot drift. Consequence: the composer deliberately does NOT implement AC #3's literal 'first configured workflow status' reading for projects whose statuses[0] is not 'To Do'; surface consistency with the CLI wizard was chosen over the literal AC wording. In this repo statuses[0] === defaultStatus === 'To Do', so AC #3 is satisfied literally here regardless and the divergence is not observable; the ACs were left unedited rather than rewording upstream spec text (task references issue #579). The AC #3 invariants that DO bind: never default to the focused board column, and never default to Draft.

Plan refinement before implementation (simplicity pass): step 3's 'extract the wizard's value->TaskCreateInput mapper into a shared function' is DEFERRED, not done now. The wizard's mapper (task-wizard.ts:630-661) handles 14 fields with list/checklist parsing; this first slice has 5 fields (title, description, status, type, priority) and needs none of that parsing, so sharing it would force the composer to synthesise a full TaskWizardValues with ~9 empty strings and couple it to the wizard's value shape - an extra layer with no proven need (CLAUDE.md: 'Avoid extra layers unless there is an immediate, proven need'). The composer's payload build is ~6 lines inline. Revisit under BACK-543, where labels/dependencies/acceptance-criteria/DoD make parseListInput and parseChecklistInput genuinely shared and worth extracting. The reuse that IS happening now per the Alex decision: export getDefaultCreateStatus from task-wizard.ts (currently module-private at line 121) and call it from the composer so the resting-status rule has exactly one implementation.

Branching: BACK-430 work sits on tasks/back-430-tui-task-composer, branched off tasks/back-548-hide-empty-columns (commit 9aa9868) rather than main, because BACK-548's H-hotkey wiring in board.ts (DEFAULT_FOOTER_CONTENT at board.ts:174 and the key-handler block) is the exact region the N hotkey touches; branching off main would guarantee a conflict there. Rebase onto main once BACK-548 merges.

Risk spike done before implementation (plan step 8): the neo-neo-bblessed textarea widget - unused anywhere in src/ today - was driven against a real in-process createScreen() harness. Result: constructs fine, setValue/getValue round-trips embedded newlines ('line one\nline two' preserved), exposes readInput() and focus(), and renders without error. Multiline Description per AC #2 is therefore viable with the library widget; no external-editor fallback needed. Spike was throwaway and has been deleted.

Implementation of the first slice done (2 code-writer agents, TDD) + live rendered QA. Composer lives in src/ui/components/task-composer.ts (openTaskComposerPopup, buildComposerStatusOptions, computeComposerLayout); board wiring + N hotkey + footer/help in board.ts and help-popup.ts; getDefaultCreateStatus exported from task-wizard.ts for the shared resting-status rule; textarea added to the neo-neo-bblessed ambient type shim (it was absent, since nothing in src/ used the widget before).

LIVE QA FOUND TWO REAL BUGS THAT THE AUTOMATED TESTS MISSED - both reproduced in a real tmux TUI against a scratch project, both since fixed and re-verified:
(1) Capital N did nothing. The handler was registered as screen.key(['n','N']) and only lowercase n opened the composer, while the footer and help both advertise [N] - i.e. the feature was broken exactly as documented. Root cause: blessed reports shift+n as 'S-n'; the working idiom in this file is the three-variant form used by edit and move (board.ts:1319 ['e','E','S-e'], board.ts:1395 ['m','M','S-m']) and by BACK-548 (['S-h','H']). Fixed to ['n','N','S-n'] and re-verified live: capital N now opens the composer. NOTE a pre-existing inconsistency found while diagnosing: the older ['p','P'], ['t','T'], ['f','F'], ['i','I'], ['y','Y'], ['c','C'], ['a','A'] handlers have the same defect - capital P provably does nothing in a live board. Left untouched as out of scope for BACK-430; worth a separate task.
(2) The composer overflowed its own modal at 50x18. The popup was sized height:'80%' while inner fields sat at fixed absolute rows (status/type/priority at top 13/14/15 plus the Create button), needing ~20 rows; at 18 rows the Status/Type/Priority rows and Create button rendered BELOW the popup border, overlapping the board footer - the form was unusable at narrow sizes. Fixed with an exported pure computeComposerLayout(screenHeight) that treats the Description textarea as the only flexible element (preferred 7 rows, min 2) and clamps everything inside popupHeight; help text shortened to fit 50 columns. Re-verified live at 50x18: all fields, Create and the help line now render inside the border, and a task was created successfully at that size.

Rendered QA evidence (real tmux, real CLI, scratch project): 80x24 - footer advertises [N]; N opens the composer; resting Status displays 'To Do' (never Draft, never the focused column, AC #3); typed a title, tabbed to Create, pressed Enter; TASK-2 was created and appeared focused in To Do, and on disk carried id TASK-2, status 'To Do', an allocated ordinal and created_date, with the drafts dir left empty (canonical path, AC #5). 50x18 - composer fits after the fix and TASK-3 created successfully.

Gate re-run fresh after the fixes: tsc exit 0, Biome clean (336 files), bun test 1731 pass / 4 skip / 0 fail (baseline was 1713 before this task; +18 new tests).

User QA (Alex, hands-on) found two more real defects; investigation root-caused THREE, all in the neo-neo-bblessed library, all fixed in our code (node_modules not patched) and re-verified live in tmux.

(1) Backspace did nothing in Title. Cause: textbox._listener (textbox.ts:117-123) deletes from value then returns EARLY, never reaching textarea._listener's trailing 'if (this.value !== value) this.screen.render()' (textarea.ts:624). The value changed but the screen never repainted, so the text looked frozen. The board's search box only appears to work because live-search calls renderView() on every keypress, masking the same library defect. Fix: added backspace/delete to the Title textbox's ignoreKeys (the ignoreKeys check sits above the backspace branch at textbox.ts:85-89, so the library reliably skips it) and took ownership of deletion + render in the composer.

(2) Backspace did nothing in Description. Separate cause: textarea._listener's backspace branch (textarea.ts:447-451) is 'if (this.screen.fullUnicode) { } else { ...real logic... }' - an EMPTY block - and src/ui/tui.ts:90 createScreen always sets fullUnicode: true, making backspace a total no-op there. Fix: same shared handler owns deletion; a comment records that a future library upgrade filling that branch would double-delete.

(3) DRAFT WAS PRESELECTED - an AC #4 violation, found while chasing the j/k report. Opening the Status picker and pressing Enter without navigating selected Draft, which AC #4 explicitly forbids ('merely opening the selector does not select Draft'). Cause: filter-popup.ts passed 'selected: selectedIndex' to blessed's raw list, but list.ts:47 hardcodes this.selected = 0 and never reads options.selected, so the option was silently ignored and the list always opened on index 0 - which for the composer is Draft. Fix: call picker.select(selectedIndex) explicitly after construction. This was masked on the board's own filter popups because their choices[0] is 'All', which coincidentally equals the hardcoded 0.

(4) j/k did not navigate any select popup. Cause: list.ts:119/124 bind k/j only when options.vi is true; filter-popup never set it. Fix: vi: true on the list plus help text now reads [↑↓/jk]. This also enables j/k on the board's existing filter popups, matching the board's own j/k navigation convention.

TESTING LESSON RECORDED: two composer tests were passing for the WRONG reason. The 'creates a draft when Draft is explicitly selected' test emitted 'key up', but list.ts binds navigation to the raw 'keypress' event, so the emit did nothing - the test only passed because defect (3) left the selection stuck on Draft. And an earlier textarea spike asserted only on getValue(), which is why defect (1) slipped through: the value DID change and only the repaint was missing. Value-only assertions cannot catch render bugs; the Title backspace test now also asserts screen.render() is invoked.

Live re-verification after fixes (real tmux, real CLI): Title ABCDEF + 2x Backspace -> ABCD; Description HELLO + 2x Backspace -> HEL; open Status picker + Enter with no navigation -> stays 'To Do' (AC #4 honoured); j -> In Progress; k -> Draft (still deliberately selectable); board's own priority filter popup with j+Enter -> high (no regression, j/k now works there too). Gate: tsc exit 0, Biome clean (336 files), bun test 1735 pass / 4 skip / 0 fail.
<!-- SECTION:NOTES:END -->
