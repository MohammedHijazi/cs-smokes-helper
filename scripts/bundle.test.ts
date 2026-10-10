// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findEditCode } from "./bundle";

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("findEditCode", () => {
  it("lists the files that contain the edit endpoint, with forward slashes", () => {
    dir = mkdtempSync(join(tmpdir(), "cs-smokes-dist-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<script src=assets/index.js></script>");
    writeFileSync(join(dir, "assets", "index.js"), 'console.log("site")');
    writeFileSync(join(dir, "assets", "edit.js"), 'fetch("/__edit/maps/mirage")');
    expect(findEditCode(dir)).toEqual(["assets/edit.js"]);
  });

  it("returns nothing for a clean build", () => {
    dir = mkdtempSync(join(tmpdir(), "cs-smokes-dist-"));
    writeFileSync(join(dir, "index.html"), "<p>site</p>");
    expect(findEditCode(dir)).toEqual([]);
  });
});
