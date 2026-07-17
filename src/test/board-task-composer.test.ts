import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { DEFAULT_FOOTER_CONTENT, resolveComposerFocusOutcome } from "../ui/board.ts";
import { getHelpShortcuts } from "../ui/components/help-popup.ts";

function createTask(id: string, status: string): Task {
	return {
		id,
		title: `Title for ${id}`,
		status,
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		description: "",
	};
}

describe("N shortcut discoverability", () => {
	it("documents the shortcut in the board footer", () => {
		expect(DEFAULT_FOOTER_CONTENT).toContain("[N]");
	});

	it("documents the shortcut in the board help menu", () => {
		const keys = getHelpShortcuts("board").map((shortcut) => shortcut.key);
		expect(keys).toContain("N");
	});
});

describe("resolveComposerFocusOutcome", () => {
	it("focuses the created task when it is visible in the filtered list", () => {
		const created = createTask("task-2", "To Do");
		const filtered = [createTask("task-1", "To Do"), created];

		expect(resolveComposerFocusOutcome(created, filtered)).toBe("focus");
	});

	it("reports draft instead of attempting focus, even if somehow present in the filtered list", () => {
		const created = createTask("draft-1", "Draft");
		const filtered = [created];

		expect(resolveComposerFocusOutcome(created, filtered)).toBe("draft");
	});

	it("reports filtered when the created task is absent from the filtered list", () => {
		const created = createTask("task-2", "In Progress");
		const filtered = [createTask("task-1", "To Do")];

		expect(resolveComposerFocusOutcome(created, filtered)).toBe("filtered");
	});
});
