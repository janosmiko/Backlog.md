import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import type { BoxInterface, ScreenInterface, TextareaInterface, TextboxInterface } from "neo-neo-bblessed";
import { getDefaultCreateStatus } from "../commands/task-wizard.ts";
import { Core } from "../core/backlog.ts";
import {
	buildComposerStatusOptions,
	computeComposerLayout,
	openTaskComposerPopup,
} from "../ui/components/task-composer.ts";
import { createScreen } from "../ui/tui.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

type Emittable = { emit: (event: string, ch?: string, key?: { name: string }) => boolean };
type EmittableBox = BoxInterface & Emittable;
type EmittableTextbox = TextboxInterface & Emittable;
type EmittableTextarea = TextareaInterface & Emittable;

function withTtyScreen<T>(run: (screen: ScreenInterface) => Promise<T>): Promise<T> {
	const originalIsTTY = process.stdout.isTTY;
	if (process.stdout.isTTY === false) {
		Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
	}
	const screen = createScreen({ smartCSR: false });
	return run(screen).finally(() => {
		if (process.stdout.isTTY !== originalIsTTY) {
			Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, configurable: true });
		}
		screen.destroy();
	});
}

function findElement<T>(screen: ScreenInterface, predicate: (child: unknown) => boolean): T {
	const stack = [...(screen as unknown as { children: unknown[] }).children];
	while (stack.length > 0) {
		const node = stack.shift();
		if (!node) continue;
		if (predicate(node)) {
			return node as T;
		}
		const nodeChildren = (node as { children?: unknown[] }).children;
		if (nodeChildren) {
			stack.push(...nodeChildren);
		}
	}
	throw new Error("element not found");
}

const findTitleInput = (screen: ScreenInterface): EmittableTextbox =>
	findElement<EmittableTextbox>(screen, (node) => (node as { type?: string }).type === "textbox");

const findDescriptionInput = (screen: ScreenInterface): EmittableTextarea =>
	findElement<EmittableTextarea>(screen, (node) => (node as { type?: string }).type === "textarea");

const findList = (screen: ScreenInterface): EmittableBox =>
	findElement<EmittableBox>(screen, (node) => (node as { type?: string }).type === "list");

function findBoxByContentPrefix(screen: ScreenInterface, prefix: string): EmittableBox {
	return findElement<EmittableBox>(screen, (node) => {
		const content = (node as { content?: string }).content;
		return typeof content === "string" && content.startsWith(prefix);
	});
}

function findErrorBox(screen: ScreenInterface): EmittableBox {
	return findElement<EmittableBox>(screen, (node) => {
		const style = (node as { style?: { fg?: string } }).style;
		return style?.fg === "red";
	});
}

describe("buildComposerStatusOptions", () => {
	it("returns only configured statuses when the status field was not opened", () => {
		const options = buildComposerStatusOptions(["To Do", "In Progress", "Done"], false);
		expect(options).toEqual([
			{ label: "To Do", value: "To Do" },
			{ label: "In Progress", value: "In Progress" },
			{ label: "Done", value: "Done" },
		]);
	});

	it("prepends Draft as the first option once the status field has been opened", () => {
		const options = buildComposerStatusOptions(["To Do", "In Progress", "Done"], true);
		expect(options[0]).toEqual({ label: "Draft", value: "Draft" });
		expect(options.map((option) => option.value)).toEqual(["Draft", "To Do", "In Progress", "Done"]);
	});

	it("does not duplicate Draft when statuses is empty", () => {
		const options = buildComposerStatusOptions([], true);
		expect(options).toEqual([{ label: "Draft", value: "Draft" }]);
	});
});

describe("composer resting status", () => {
	it("matches getDefaultCreateStatus and is never Draft, even with unusual status ordering", () => {
		expect(getDefaultCreateStatus(["To Do", "In Progress", "Done"])).toBe("To Do");
		expect(getDefaultCreateStatus(["Backlog", "Doing", "Shipped"])).toBe("Backlog");
		expect(getDefaultCreateStatus(["Draft", "To Do", "Done"])).toBe("To Do");
	});
});

describe("computeComposerLayout", () => {
	it("fits every field inside the popup on an 18-row terminal", () => {
		const layout = computeComposerLayout(18);

		expect(layout.descriptionHeight).toBeGreaterThanOrEqual(2);
		expect(layout.descriptionTop + layout.descriptionHeight).toBeLessThan(layout.popupHeight);
		expect(layout.statusTop + 1).toBeLessThan(layout.popupHeight);
		expect(layout.typeTop + 1).toBeLessThan(layout.popupHeight);
		expect(layout.priorityTop + 1).toBeLessThan(layout.popupHeight);
		expect(layout.createTop + 1).toBeLessThan(layout.popupHeight);
		expect(layout.errorTop + 3).toBeLessThan(layout.popupHeight);
	});

	it("uses the preferred description height when there is plenty of room", () => {
		expect(computeComposerLayout(24).descriptionHeight).toBe(7);
		expect(computeComposerLayout(40).descriptionHeight).toBe(7);
	});

	it("keeps fields ordered top to bottom without overlap", () => {
		const layout = computeComposerLayout(18);

		expect(layout.descriptionTop).toBeGreaterThan(0);
		expect(layout.statusTop).toBeGreaterThan(layout.descriptionTop + layout.descriptionHeight - 1);
		expect(layout.typeTop).toBeGreaterThan(layout.statusTop);
		expect(layout.priorityTop).toBeGreaterThan(layout.typeTop);
		expect(layout.createTop).toBeGreaterThan(layout.priorityTop);
		expect(layout.errorTop).toBeGreaterThan(layout.createTop);
	});

	it("clamps degenerate input to non-negative, non-overflowing values", () => {
		for (const screenHeight of [8, 0]) {
			const layout = computeComposerLayout(screenHeight);

			expect(layout.popupHeight).toBeGreaterThan(0);
			expect(layout.descriptionHeight).toBeGreaterThanOrEqual(2);
			expect(layout.descriptionTop).toBeGreaterThanOrEqual(0);
			expect(layout.statusTop).toBeGreaterThanOrEqual(0);
			expect(layout.errorTop + 3).toBeLessThanOrEqual(layout.popupHeight);
		}
	});
});

describe("openTaskComposerPopup rendered behavior", () => {
	let TEST_DIR: string;
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-tui-task-composer");
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await initializeTestProject(core, "Test Project", true);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("resolves null and creates nothing on cancel", async () => {
		await withTtyScreen(async (screen) => {
			const resultPromise = openTaskComposerPopup({
				screen,
				core,
				statuses: ["To Do", "In Progress", "Done"],
			});

			const titleInput = findTitleInput(screen);
			titleInput.setValue("draft title");
			titleInput.emit("key escape", "\x1B", { name: "escape" });

			const result = await resultPromise;
			expect(result).toBeNull();

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);
		});
	});

	it("creates a normal-status task with the title, description, type, and priority entered", async () => {
		await withTtyScreen(async (screen) => {
			const resultPromise = openTaskComposerPopup({
				screen,
				core,
				statuses: ["To Do", "In Progress", "Done"],
				types: ["Feature", "Bug"],
				priorities: ["High", "Medium", "Low"],
			});

			const titleInput = findTitleInput(screen);
			titleInput.setValue("My new task");

			const descriptionInput = findDescriptionInput(screen);
			descriptionInput.setValue("line one\nline two");

			const createButton = findBoxByContentPrefix(screen, "{bold}[ Create ]");
			createButton.emit("key enter", "\r", { name: "enter" });

			const result = await resultPromise;
			expect(result).not.toBeNull();
			expect(result?.title).toBe("My new task");
			expect(result?.status).toBe("To Do");
			expect(result?.description).toBe("line one\nline two");

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(1);
			expect(tasks[0]?.status).toBe("To Do");
		});
	});

	it("keeps the resting status unchanged when the Status picker is opened and left unselected", async () => {
		await withTtyScreen(async (screen) => {
			const resultPromise = openTaskComposerPopup({
				screen,
				core,
				statuses: ["To Do", "In Progress", "Done"],
			});

			const titleInput = findTitleInput(screen);
			titleInput.setValue("Untouched status");

			const statusButton = findBoxByContentPrefix(screen, "Status:");
			statusButton.emit("key enter", "\r", { name: "enter" });

			await Bun.sleep(5);
			const picker = findList(screen);
			picker.emit("key escape", "\x1B", { name: "escape" });

			await Bun.sleep(5);
			const createButton = findBoxByContentPrefix(screen, "{bold}[ Create ]");
			createButton.emit("key enter", "\r", { name: "enter" });

			const result = await resultPromise;
			expect(result?.status).toBe("To Do");
		});
	});

	it("creates a draft in the drafts directory when Draft is explicitly selected", async () => {
		await withTtyScreen(async (screen) => {
			const resultPromise = openTaskComposerPopup({
				screen,
				core,
				statuses: ["To Do", "In Progress", "Done"],
			});

			const titleInput = findTitleInput(screen);
			titleInput.setValue("A draft task");

			const statusButton = findBoxByContentPrefix(screen, "Status:");
			statusButton.emit("key enter", "\r", { name: "enter" });

			await Bun.sleep(5);
			const picker = findList(screen);
			// The list widget's up/down navigation is bound to the raw 'keypress' event
			// (not the 'key <name>' events used elsewhere in this file), so real
			// navigation must be driven through that event to exercise it faithfully.
			picker.emit("keypress", "", { name: "up" });
			picker.emit("key enter", "\r", { name: "enter" });

			await Bun.sleep(5);
			const createButton = findBoxByContentPrefix(screen, "{bold}[ Create ]");
			createButton.emit("key enter", "\r", { name: "enter" });

			const result = await resultPromise;
			expect(result?.status).toBe("Draft");

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);
			const drafts = await core.filesystem.listDrafts();
			expect(drafts).toHaveLength(1);
			expect(drafts[0]?.title).toBe("A draft task");
		});
	});

	it("keeps the modal open, shows the error, and preserves entered values on an empty title", async () => {
		await withTtyScreen(async (screen) => {
			const resultPromise = openTaskComposerPopup({
				screen,
				core,
				statuses: ["To Do", "In Progress", "Done"],
			});

			const descriptionInput = findDescriptionInput(screen);
			descriptionInput.setValue("kept description");

			const createButton = findBoxByContentPrefix(screen, "{bold}[ Create ]");
			createButton.emit("key enter", "\r", { name: "enter" });

			await Bun.sleep(5);

			const errorBox = findErrorBox(screen);
			expect(String((errorBox as unknown as { content: string }).content)).toContain("Title is required");
			expect(findDescriptionInput(screen).getValue()).toBe("kept description");

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);

			const titleInput = findTitleInput(screen);
			titleInput.emit("key escape", "\x1B", { name: "escape" });
			await resultPromise;
		});
	});

	it("regression AC #4: confirming the Status picker without navigating preserves the resting status, not Draft", async () => {
		await withTtyScreen(async (screen) => {
			const resultPromise = openTaskComposerPopup({
				screen,
				core,
				statuses: ["To Do", "In Progress", "Done"],
			});

			const titleInput = findTitleInput(screen);
			titleInput.setValue("Untouched status via Enter");

			const statusButton = findBoxByContentPrefix(screen, "Status:");
			statusButton.emit("key enter", "\r", { name: "enter" });

			await Bun.sleep(5);
			// Merely opening the picker and confirming with no navigation must not
			// select choices[0] (Draft, once the picker is open) - it must keep the
			// list positioned on the current resting status.
			const picker = findList(screen);
			picker.emit("key enter", "\r", { name: "enter" });

			await Bun.sleep(5);
			const createButton = findBoxByContentPrefix(screen, "{bold}[ Create ]");
			createButton.emit("key enter", "\r", { name: "enter" });

			const result = await resultPromise;
			expect(result?.status).toBe("To Do");
			expect(result?.status).not.toBe("Draft");
		});
	});

	it("navigates the Status picker with vim keys (j/k)", async () => {
		await withTtyScreen(async (screen) => {
			const resultPromise = openTaskComposerPopup({
				screen,
				core,
				statuses: ["To Do", "In Progress", "Done"],
			});

			const titleInput = findTitleInput(screen);
			titleInput.setValue("Vim nav title");

			const statusButton = findBoxByContentPrefix(screen, "Status:");
			statusButton.emit("key enter", "\r", { name: "enter" });

			await Bun.sleep(5);
			const picker = findList(screen);
			// Choices open as [Draft, To Do, In Progress, Done], resting on To Do; one
			// vi 'j' (down) should move to In Progress.
			picker.emit("keypress", "j", { name: "j" });
			picker.emit("key enter", "\r", { name: "enter" });

			await Bun.sleep(5);
			const createButton = findBoxByContentPrefix(screen, "{bold}[ Create ]");
			createButton.emit("key enter", "\r", { name: "enter" });

			const result = await resultPromise;
			expect(result?.status).toBe("In Progress");
		});
	});

	it("repaints the screen when backspace shrinks the Title value", async () => {
		await withTtyScreen(async (screen) => {
			const resultPromise = openTaskComposerPopup({
				screen,
				core,
				statuses: ["To Do", "In Progress", "Done"],
			});

			const titleInput = findTitleInput(screen);
			titleInput.setValue("abc");

			let renderCalls = 0;
			const originalRender = screen.render.bind(screen);
			screen.render = () => {
				renderCalls++;
				originalRender();
			};

			// A value-only assertion previously gave a false green here: the library's
			// textbox backspace handling updated the value but returned before the
			// trailing render call, so the screen never repainted.
			titleInput.emit("key backspace", "\x7f", { name: "backspace" });

			expect(titleInput.getValue()).toBe("ab");
			expect(renderCalls).toBeGreaterThan(0);

			titleInput.emit("key escape", "\x1B", { name: "escape" });
			await resultPromise;
		});
	});

	it("shrinks the Description value on backspace", async () => {
		await withTtyScreen(async (screen) => {
			const resultPromise = openTaskComposerPopup({
				screen,
				core,
				statuses: ["To Do", "In Progress", "Done"],
			});

			const descriptionInput = findDescriptionInput(screen);
			descriptionInput.setValue("abc");
			descriptionInput.emit("key backspace", "\x7f", { name: "backspace" });

			expect(descriptionInput.getValue()).toBe("ab");

			const titleInput = findTitleInput(screen);
			titleInput.emit("key escape", "\x1B", { name: "escape" });
			await resultPromise;
		});
	});
});
