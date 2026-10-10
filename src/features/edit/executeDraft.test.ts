import { describe, expect, it } from "vitest";
import { makeExecute } from "../../test/fixtures";
import {
  draftFromExecute,
  emptyExecuteDraft,
  errorsForExecute,
  executeFromDraft,
  moved,
} from "./executeDraft";

describe("execute drafts", () => {
  it("round-trips an execute through the form", () => {
    const execute = makeExecute({ notes: "Throw together" });
    expect(executeFromDraft(draftFromExecute(execute), execute.id)).toEqual(execute);
  });

  it("builds a new execute with trimmed text, fields in file order, empty notes left out", () => {
    const draft = {
      ...emptyExecuteDraft("T"),
      name: " B split ",
      lineupIds: ["mirage-a", "mirage-b"],
    };
    const execute = executeFromDraft(draft, "mirage-b-split");
    expect(execute).toEqual({
      id: "mirage-b-split",
      name: "B split",
      side: "T",
      lineupIds: ["mirage-a", "mirage-b"],
    });
    expect(Object.keys(execute)).toEqual(["id", "name", "side", "lineupIds"]);
  });

  it("moves an item up or down, staying inside the list", () => {
    expect(moved(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moved(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("puts validation errors on the execute's fields", () => {
    expect(
      errorsForExecute(
        [
          { path: "executes[1].lineupIds", message: "needs at least 2 smokes" },
          { path: "executes[1].name", message: "must be at most 40 characters" },
          { path: "executes[0].id", message: "duplicate id" },
        ],
        1,
      ),
    ).toEqual({
      lineupIds: ["needs at least 2 smokes"],
      name: ["must be at most 40 characters"],
      form: ["executes[0].id: duplicate id"],
    });
  });
});
