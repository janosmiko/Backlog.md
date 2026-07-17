import type { BoxInterface, ScreenInterface, TextareaInterface, TextboxInterface } from "neo-neo-bblessed";
import { box, textarea, textbox } from "neo-neo-bblessed";
import { getDefaultCreateStatus } from "../../commands/task-wizard.ts";
import type { Core } from "../../core/backlog.ts";
import { isCreateLockError } from "../../file-system/operations.ts";
import type { Task, TaskCreateInput } from "../../types/index.ts";
import { getPriorityOptions } from "../../utils/priority-config.ts";
import { getTaskTypeValues } from "../../utils/task-type-config.ts";
import { createPopupChrome, type FilterPopupChoice, openSingleSelectFilterPopup } from "./filter-popup.ts";

const DRAFT_STATUS = "Draft";
const UNSET_OPTION: FilterPopupChoice = { label: "None", value: "" };

export interface TaskComposerOptions {
	screen: ScreenInterface;
	core: Core;
	statuses: string[];
	types?: string[];
	priorities?: string[];
}

export interface ComposerLayout {
	popupHeight: number;
	descriptionTop: number;
	descriptionHeight: number;
	statusTop: number;
	typeTop: number;
	priorityTop: number;
	createTop: number;
	errorTop: number;
}

const PREFERRED_DESCRIPTION_HEIGHT = 7;
const MIN_DESCRIPTION_HEIGHT = 2;
const TITLE_LABEL_TOP = 0;
const TITLE_INPUT_TOP = 1;
const DESCRIPTION_LABEL_TOP = 2;
const DESCRIPTION_TOP = 3;
const SECTION_GAP = 1;
const SELECT_ROW_COUNT = 3; // status, type, priority
const CREATE_BUTTON_HEIGHT = 1;
const ERROR_HEIGHT = 3;
const HELP_ROW = 1; // help text pinned to the popup's bottom row
const BORDER_ROWS = 2; // popup top + bottom border

// Rows required below the description block: gap, status/type/priority, create button, error box, help line.
const BELOW_DESCRIPTION_ROWS = SECTION_GAP + SELECT_ROW_COUNT + CREATE_BUTTON_HEIGHT + ERROR_HEIGHT + HELP_ROW;
const FIXED_CHROME_ROWS = DESCRIPTION_TOP + BELOW_DESCRIPTION_ROWS + BORDER_ROWS;
const MIN_POPUP_HEIGHT = FIXED_CHROME_ROWS + MIN_DESCRIPTION_HEIGHT;

/**
 * Computes the composer popup layout for a given terminal height. The description
 * textarea is the only flexible element: it grows toward its preferred height when
 * there's room and shrinks toward its minimum on short terminals, so every field
 * (including the Create button and help line) stays inside the popup border.
 */
export function computeComposerLayout(screenHeight: number): ComposerLayout {
	const safeScreenHeight = Number.isFinite(screenHeight) && screenHeight > 0 ? screenHeight : 24;
	const maxPopupHeight = Math.max(1, safeScreenHeight - 2);

	const availableForDescription = maxPopupHeight - FIXED_CHROME_ROWS;
	const descriptionHeight = Math.max(
		MIN_DESCRIPTION_HEIGHT,
		Math.min(PREFERRED_DESCRIPTION_HEIGHT, availableForDescription),
	);

	// MIN_POPUP_HEIGHT wins over maxPopupHeight only on pathologically small terminals,
	// where honoring the screen-height cap would force content to overlap the border.
	const popupHeight = Math.max(MIN_POPUP_HEIGHT, Math.min(FIXED_CHROME_ROWS + descriptionHeight, maxPopupHeight));

	const statusTop = DESCRIPTION_TOP + descriptionHeight + SECTION_GAP;
	const typeTop = statusTop + 1;
	const priorityTop = typeTop + 1;
	const createTop = priorityTop + 1;
	const errorTop = createTop + CREATE_BUTTON_HEIGHT;

	return {
		popupHeight,
		descriptionTop: DESCRIPTION_TOP,
		descriptionHeight,
		statusTop,
		typeTop,
		priorityTop,
		createTop,
		errorTop,
	};
}

export function buildComposerStatusOptions(statuses: string[], statusWasOpened: boolean): FilterPopupChoice[] {
	const options = statuses.map((status) => ({ label: status, value: status }));
	if (!statusWasOpened) {
		return options;
	}
	return [{ label: DRAFT_STATUS, value: DRAFT_STATUS }, ...options];
}

export function openTaskComposerPopup(options: TaskComposerOptions): Promise<Task | null> {
	return new Promise<Task | null>((resolve) => {
		let settled = false;
		let submitting = false;
		let statusWasOpened = false;

		const values = {
			status: getDefaultCreateStatus(options.statuses),
			type: "",
			priority: "",
		};

		const typeChoices: FilterPopupChoice[] = [
			UNSET_OPTION,
			...getTaskTypeValues(options.types).map((type) => ({ label: type, value: type })),
		];
		const priorityChoices: FilterPopupChoice[] = [
			UNSET_OPTION,
			...getPriorityOptions(options.priorities).map((priority) => ({ label: priority.label, value: priority.value })),
		];

		const screenHeight = typeof options.screen.height === "number" ? options.screen.height : 24;
		const layout = computeComposerLayout(screenHeight);

		const { popup, close } = createPopupChrome({
			screen: options.screen,
			title: "Create Task",
			helpText: " {cyan-fg}[Tab]{/} Next  {cyan-fg}[Enter]{/} Open  {cyan-fg}[Esc]{/} Cancel",
			width: "70%",
			height: layout.popupHeight,
		});

		const titleLabel = box({
			parent: popup,
			top: TITLE_LABEL_TOP,
			left: 1,
			width: "100%-4",
			height: 1,
			tags: true,
			content: "Title",
		});
		const titleInput: TextboxInterface = textbox({
			parent: popup,
			top: TITLE_INPUT_TOP,
			left: 1,
			width: "100%-4",
			height: 1,
			inputOnFocus: false,
			mouse: true,
			keys: true,
			// backspace/delete are ignored here and handled by bindBackspace below: the
			// library's own textbox backspace handling updates value but returns before
			// textarea's trailing render call, so the screen never repaints (visual no-op).
			ignoreKeys: ["tab", "backspace", "delete"],
			style: { focus: { inverse: true, bold: true } },
		});

		const descriptionLabel = box({
			parent: popup,
			top: DESCRIPTION_LABEL_TOP,
			left: 1,
			width: "100%-4",
			height: 1,
			tags: true,
			content: "Description",
		});
		const descriptionInput: TextareaInterface = textarea({
			parent: popup,
			top: layout.descriptionTop,
			left: 1,
			width: "100%-4",
			height: layout.descriptionHeight,
			inputOnFocus: false,
			mouse: true,
			keys: true,
			style: { focus: { inverse: true, bold: true } },
		});
		// The library's textarea backspace/delete handling is an empty branch when
		// screen.fullUnicode is set (createScreen always sets it), so it is already a
		// no-op here; bindBackspace below owns deletion. If a future library upgrade
		// fills in that branch, this would start double-deleting a character.

		const statusButton: BoxInterface = box({
			parent: popup,
			top: layout.statusTop,
			left: 1,
			width: "100%-4",
			height: 1,
			tags: true,
			mouse: true,
			keys: true,
			content: `Status: ${values.status}`,
			style: { focus: { inverse: true, bold: true } },
		});

		const typeButton: BoxInterface = box({
			parent: popup,
			top: layout.typeTop,
			left: 1,
			width: "100%-4",
			height: 1,
			tags: true,
			mouse: true,
			keys: true,
			content: "Type: (none)",
			style: { focus: { inverse: true, bold: true } },
		});

		const priorityButton: BoxInterface = box({
			parent: popup,
			top: layout.priorityTop,
			left: 1,
			width: "100%-4",
			height: 1,
			tags: true,
			mouse: true,
			keys: true,
			content: "Priority: (none)",
			style: { focus: { inverse: true, bold: true } },
		});

		const createButton: BoxInterface = box({
			parent: popup,
			top: layout.createTop,
			left: 1,
			width: "100%-4",
			height: 1,
			tags: true,
			mouse: true,
			keys: true,
			content: "{bold}[ Create ]{/bold}",
			style: { focus: { inverse: true, bold: true } },
		});

		const errorBox: BoxInterface = box({
			parent: popup,
			top: layout.errorTop,
			left: 1,
			width: "100%-4",
			height: 3,
			tags: true,
			content: "",
			style: { fg: "red" },
		});

		const elements = [titleInput, descriptionInput, statusButton, typeButton, priorityButton, createButton];

		const setError = (message: string): void => {
			errorBox.setContent(message ? `{red-fg}${message}{/}` : "");
			options.screen.render();
		};

		const finish = (task: Task | null): void => {
			if (settled) return;
			settled = true;
			titleLabel.destroy();
			titleInput.destroy();
			descriptionLabel.destroy();
			descriptionInput.destroy();
			statusButton.destroy();
			typeButton.destroy();
			priorityButton.destroy();
			createButton.destroy();
			errorBox.destroy();
			close();
			options.screen.render();
			resolve(task);
		};

		const focusIndex = (index: number): void => {
			const wrapped = (index + elements.length) % elements.length;
			elements[wrapped]?.focus();
		};

		const bindNav = (element: BoxInterface | TextboxInterface | TextareaInterface, index: number): void => {
			element.key(["tab"], () => {
				focusIndex(index + 1);
				return false;
			});
			element.key(["S-tab"], () => {
				focusIndex(index - 1);
				return false;
			});
		};

		elements.forEach((element, index) => {
			bindNav(element, index);
		});

		// The library's own backspace handling is unreliable for both widgets (see the
		// comments at titleInput's ignoreKeys and above descriptionInput), so deletion
		// is handled here directly: drop the last character and force a repaint.
		const dropLastChar = (element: TextboxInterface | TextareaInterface): void => {
			const value = element.getValue();
			if (value.length > 0) {
				element.setValue(value.slice(0, -1));
				options.screen.render();
			}
		};
		const bindBackspace = (element: TextboxInterface | TextareaInterface, keys: string[]): void => {
			element.key(keys, () => {
				dropLastChar(element);
				return false;
			});
		};
		bindBackspace(titleInput, ["backspace", "delete"]);
		bindBackspace(descriptionInput, ["backspace"]);

		titleInput.key(["escape"], () => {
			titleInput.cancel();
			finish(null);
			return false;
		});
		descriptionInput.key(["escape"], () => {
			descriptionInput.cancel();
			finish(null);
			return false;
		});
		popup.key(["escape"], () => {
			finish(null);
			return false;
		});

		titleInput.on("focus", () => {
			titleInput.readInput();
		});
		descriptionInput.on("focus", () => {
			descriptionInput.readInput();
		});

		const openStatusPicker = async (): Promise<void> => {
			statusWasOpened = true;
			const choices = buildComposerStatusOptions(options.statuses, statusWasOpened);
			const chosen = await openSingleSelectFilterPopup({
				screen: options.screen,
				title: "Status",
				choices,
				selectedValue: values.status,
			});
			if (settled) return;
			if (chosen !== null) {
				values.status = chosen;
			}
			statusButton.setContent(`Status: ${values.status}`);
			options.screen.render();
			statusButton.focus();
		};

		const openTypePicker = async (): Promise<void> => {
			const chosen = await openSingleSelectFilterPopup({
				screen: options.screen,
				title: "Type",
				choices: typeChoices,
				selectedValue: values.type,
			});
			if (settled) return;
			if (chosen !== null) {
				values.type = chosen;
			}
			typeButton.setContent(`Type: ${values.type || "(none)"}`);
			options.screen.render();
			typeButton.focus();
		};

		const openPriorityPicker = async (): Promise<void> => {
			const chosen = await openSingleSelectFilterPopup({
				screen: options.screen,
				title: "Priority",
				choices: priorityChoices,
				selectedValue: values.priority,
			});
			if (settled) return;
			if (chosen !== null) {
				values.priority = chosen;
			}
			priorityButton.setContent(`Priority: ${values.priority || "(none)"}`);
			options.screen.render();
			priorityButton.focus();
		};

		statusButton.key(["enter"], () => {
			void openStatusPicker();
			return false;
		});
		typeButton.key(["enter"], () => {
			void openTypePicker();
			return false;
		});
		priorityButton.key(["enter"], () => {
			void openPriorityPicker();
			return false;
		});

		const submit = async (): Promise<void> => {
			if (submitting) return;
			submitting = true;
			setError("");
			try {
				const title = titleInput.getValue?.() ?? "";
				const description = descriptionInput.getValue?.() ?? "";
				const input: TaskCreateInput = {
					title,
					...(description.trim() && { description }),
					status: values.status,
					...(values.type && { type: values.type }),
					...(values.priority && { priority: values.priority }),
				};
				const { task } = await options.core.createTaskFromInput(input);
				if (settled) return;
				finish(task);
			} catch (error) {
				if (settled) return;
				if (isCreateLockError(error)) {
					setError(error.message);
				} else if (error instanceof Error) {
					setError(error.message);
				} else {
					setError(String(error));
				}
			} finally {
				submitting = false;
			}
		};

		createButton.key(["enter"], () => {
			void submit();
			return false;
		});

		setImmediate(() => {
			if (settled) return;
			titleInput.focus();
			options.screen.render();
		});
	});
}
