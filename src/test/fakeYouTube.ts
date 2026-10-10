import { act, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";
import type { YTNamespace, YTPlayer, YTPlayerOptions } from "../features/smoke/youtubeApi";

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

export type FakePlayer = ReturnType<typeof fakePlayer>;

/**
 * A fake YouTube IFrame API that records every player it creates. Use with
 * `vi.mock(".../youtubeApi", () => ({ loadYouTubeApi: api.load }))` and
 * `api.load.mockResolvedValue(fake.YT)`.
 */
export function fakeYouTube() {
  const created: { options: YTPlayerOptions; player: FakePlayer }[] = [];
  const Player = vi.fn(function (_element: HTMLElement, options: YTPlayerOptions) {
    const player = fakePlayer();
    created.push({ options, player });
    return player;
  });
  return {
    created,
    YT: { Player, PlayerState: { ENDED: 0 } } as unknown as YTNamespace,
    /** Waits for the nth player (0-based), then fires its onReady. */
    async ready(n = 0): Promise<FakePlayer> {
      await waitFor(() => expect(created.length).toBeGreaterThan(n));
      const { options, player } = created[n];
      act(() => options.events.onReady?.({ target: player as unknown as YTPlayer }));
      return player;
    },
  };
}

export type FakeYouTube = ReturnType<typeof fakeYouTube>;
