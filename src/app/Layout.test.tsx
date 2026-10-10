import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "../lib/storage";
import { memoryStorage } from "../test/memoryStorage";
import { renderAt } from "../test/render";

vi.mock("../data", async () => (await import("../test/fixtureData")).mockDataModule());

describe("Layout banners", () => {
  it("warns when progress can't be saved", () => {
    renderAt("/", { storage: null });
    expect(screen.getByText("Progress can't be saved in this browser.")).toBeInTheDocument();
  });

  it("shows no banner when storage works", () => {
    renderAt("/");
    expect(screen.queryByText("Progress can't be saved in this browser.")).toBeNull();
    expect(screen.queryByText(/couldn't be read/)).toBeNull();
  });

  it("explains a reset of unreadable progress, and can be dismissed", async () => {
    renderAt("/", { storage: memoryStorage({ [STORAGE_KEY]: "{not json" }) });
    expect(screen.getByText(/couldn't be read, so it was reset/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/couldn't be read/)).toBeNull();
  });
});
