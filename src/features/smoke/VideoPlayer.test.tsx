import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoPlayer } from "./VideoPlayer";
import type { YTNamespace, YTPlayerOptions } from "./youtubeApi";

const api = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./youtubeApi", () => ({ loadYouTubeApi: api.load }));

function fakePlayer() {
  return {
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    setPlaybackRate: vi.fn(),
    mute: vi.fn(),
    destroy: vi.fn(),
  };
}

type FakePlayer = ReturnType<typeof fakePlayer>;
let created: { options: YTPlayerOptions; player: FakePlayer }[] = [];
const ENDED = 0;
const VIDEO = { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", start: 95, end: 112 };

beforeEach(() => {
  created = [];
  const Player = vi.fn(function (_element: HTMLElement, options: YTPlayerOptions) {
    const player = fakePlayer();
    created.push({ options, player });
    return player;
  });
  api.load.mockResolvedValue({ Player, PlayerState: { ENDED } } as unknown as YTNamespace);
});

afterEach(() => {
  vi.useRealTimers();
});

async function renderReady() {
  render(<VideoPlayer video={VIDEO} title="Window from T Spawn" />);
  await waitFor(() => expect(created).toHaveLength(1));
  const { options, player } = created[0];
  act(() => options.events.onReady?.({ target: player }));
  return { options, player };
}

describe("VideoPlayer", () => {
  it("links out for videos that are not on YouTube", () => {
    render(
      <VideoPlayer video={{ url: "https://csnades.gg/mirage/smokes/top-mid" }} title="Top Mid" />,
    );
    expect(screen.getByRole("link", { name: "Open video ↗" })).toHaveAttribute(
      "href",
      "https://csnades.gg/mirage/smokes/top-mid",
    );
    expect(api.load).not.toHaveBeenCalled();
  });

  it("creates a muted, inline, privacy-enhanced player at the clip start", async () => {
    const { options } = await renderReady();
    expect(options.host).toBe("https://www.youtube-nocookie.com");
    expect(options.videoId).toBe("dQw4w9WgXcQ");
    expect(options.playerVars).toMatchObject({
      start: 95,
      playsinline: 1,
      rel: 0,
      mute: 1,
      autoplay: 1,
    });
  });

  it("starts playing, muted, when ready", async () => {
    const { player } = await renderReady();
    expect(player.mute).toHaveBeenCalled();
    expect(player.playVideo).toHaveBeenCalledTimes(1);
  });

  it("replays from the clip start", async () => {
    const { player } = await renderReady();
    await userEvent.click(screen.getByRole("button", { name: "↻ Replay" }));
    expect(player.seekTo).toHaveBeenCalledWith(95, true);
  });

  it("switches between 0.5× and 1×", async () => {
    const { player } = await renderReady();
    await userEvent.click(screen.getByRole("button", { name: "0.5×" }));
    expect(player.setPlaybackRate).toHaveBeenCalledWith(0.5);
    expect(screen.getByRole("button", { name: "0.5×" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute("aria-pressed", "false");
  });

  it("jumps back to the start when the clip end is reached", async () => {
    render(<VideoPlayer video={VIDEO} title="Window" />);
    await waitFor(() => expect(created).toHaveLength(1));
    vi.useFakeTimers();
    const { options, player } = created[0];
    act(() => options.events.onReady?.({ target: player }));
    player.getCurrentTime.mockReturnValue(112);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(player.seekTo).toHaveBeenCalledWith(95, true);
  });

  it("loops when the video ends before the clip end", async () => {
    const { options, player } = await renderReady();
    act(() => options.events.onStateChange?.({ data: ENDED, target: player }));
    expect(player.seekTo).toHaveBeenCalledWith(95, true);
    expect(player.playVideo).toHaveBeenCalledTimes(2);
  });

  it("shows a fallback when the player reports an error", async () => {
    const { options } = await renderReady();
    act(() => options.events.onError?.({ data: 150 }));
    expect(screen.getByText(/Video unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the link ↗" })).toHaveAttribute(
      "href",
      VIDEO.url,
    );
  });

  it("shows the fallback when the API cannot load", async () => {
    api.load.mockRejectedValue(new Error("blocked"));
    render(<VideoPlayer video={VIDEO} title="Window" />);
    expect(await screen.findByText(/Video unavailable/)).toBeInTheDocument();
  });

  it("destroys the player when unmounted", async () => {
    const view = render(<VideoPlayer video={VIDEO} title="Window" />);
    await waitFor(() => expect(created).toHaveLength(1));
    view.unmount();
    expect(created[0].player.destroy).toHaveBeenCalled();
  });
});
