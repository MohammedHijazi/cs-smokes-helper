import { useEffect, useRef, useState, type RefObject } from "react";
import { loadYouTubeApi, type YTPlayer } from "./youtubeApi";

export type PlayerStatus = "loading" | "ready" | "error";

export interface YouTubePlayerOptions {
  videoId: string;
  /** Read when the player is created; later changes don't recreate it. */
  playerVars: Record<string, string | number>;
  onReady?: (player: YTPlayer) => void;
  onEnded?: (player: YTPlayer) => void;
}

/**
 * Creates a YouTube player inside `host` (privacy-enhanced host) and destroys it on unmount or
 * error. A different `videoId` creates a new player.
 */
export function useYouTubePlayer(
  host: RefObject<HTMLDivElement | null>,
  { videoId, playerVars, onReady, onEnded }: YouTubePlayerOptions,
): { status: PlayerStatus; player: RefObject<YTPlayer | null> } {
  const player = useRef<YTPlayer | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  // The latest callbacks, read by the player's events without recreating the player.
  const callbacks = useRef({ onReady, onEnded });
  callbacks.current = { onReady, onEnded };
  const varsRef = useRef(playerVars);
  varsRef.current = playerVars;

  useEffect(() => {
    let cancelled = false;
    let instance: YTPlayer | null = null;

    // Safe to call more than once: it clears what it releases, so the unmount
    // cleanup does not destroy the player again after an error did.
    const teardown = () => {
      instance?.destroy();
      instance = null;
      player.current = null;
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host.current) return;
        // The API replaces this element with its iframe, so React never owns it.
        const mount = document.createElement("div");
        host.current.appendChild(mount);
        instance = new YT.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          videoId,
          width: "100%",
          height: "100%",
          playerVars: varsRef.current,
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              player.current = target;
              callbacks.current.onReady?.(target);
              setStatus("ready");
            },
            onStateChange: ({ data, target }) => {
              if (data === YT.PlayerState.ENDED) callbacks.current.onEnded?.(target);
            },
            onError: () => {
              if (cancelled) return;
              teardown();
              setStatus("error");
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      teardown();
    };
  }, [host, videoId]);

  return { status, player };
}
