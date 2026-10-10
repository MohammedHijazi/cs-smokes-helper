import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeYouTube, type FakeYouTube } from "../../test/fakeYouTube";
import { ClipTimer, type ClipTimerProps } from "./ClipTimer";

const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../smoke/youtubeApi", () => ({ loadYouTubeApi: api.load }));

let yt: FakeYouTube;
beforeEach(() => {
  yt = fakeYouTube();
  api.load.mockResolvedValue(yt.YT);
});
afterEach(() => vi.useRealTimers());

function renderTimer(props: Partial<ClipTimerProps> = {}) {
  const onSetStart = vi.fn();
  const onSetEnd = vi.fn();
  const view = render(
    <ClipTimer
      videoId="dQw4w9WgXcQ"
      initialStart={95}
      start={95}
      end={112}
      onSetStart={onSetStart}
      onSetEnd={onSetEnd}
      {...props}
    />,
  );
  return { view, onSetStart, onSetEnd };
}

describe("ClipTimer", () => {
  it("opens a paused player at the clip start", async () => {
    renderTimer();
    const player = await yt.ready();
    expect(yt.created[0].options.playerVars).toMatchObject({
      start: 95,
      autoplay: 0,
      playsinline: 1,
      rel: 0,
    });
    expect(player.playVideo).not.toHaveBeenCalled();
  });

  it("disables its buttons until the player is ready", () => {
    renderTimer();
    expect(screen.getByRole("button", { name: "Set start" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "▶ Play clip" })).toBeDisabled();
  });

  it("sets start from the current time rounded down, and end rounded up", async () => {
    const { onSetStart, onSetEnd } = renderTimer();
    const player = await yt.ready();
    player.getCurrentTime.mockReturnValue(97.8);
    await userEvent.click(screen.getByRole("button", { name: "Set start" }));
    expect(onSetStart).toHaveBeenCalledWith(97);
    player.getCurrentTime.mockReturnValue(111.2);
    await userEvent.click(screen.getByRole("button", { name: "Set end" }));
    expect(onSetEnd).toHaveBeenCalledWith(112);
  });

  it("plays the clip once and pauses at the end, without looping", async () => {
    renderTimer();
    const player = await yt.ready();
    vi.useFakeTimers();
    act(() => screen.getByRole("button", { name: "▶ Play clip" }).click());
    expect(player.seekTo).toHaveBeenCalledWith(95, true);
    expect(player.playVideo).toHaveBeenCalledTimes(1);
    player.getCurrentTime.mockReturnValue(112);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
  });

  it("keeps the same player when start, end or the initial start change", async () => {
    const { view } = renderTimer();
    await yt.ready();
    view.rerender(
      <ClipTimer
        videoId="dQw4w9WgXcQ"
        initialStart={100}
        start={100}
        end={120}
        onSetStart={vi.fn()}
        onSetEnd={vi.fn()}
      />,
    );
    expect(yt.created).toHaveLength(1);
  });

  it("says so when the video can't play", async () => {
    renderTimer();
    await yt.ready();
    act(() => yt.created[0].options.events.onError?.({ data: 150 }));
    expect(screen.getByText("Video unavailable — check the link.")).toBeInTheDocument();
  });
});
