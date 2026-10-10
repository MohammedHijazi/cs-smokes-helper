import { useEffect, useRef, useState } from "react";
import type { Video } from "../../data/schema";
import { effectiveStart, parseYouTubeUrl } from "../../lib/youtube";
import { loadYouTubeApi, type YTPlayer } from "./youtubeApi";
import styles from "./VideoPlayer.module.css";

const SPEEDS = [0.5, 1] as const;
const LOOP_CHECK_MS = 250;

export interface VideoPlayerProps {
  video: Video;
  /** Used in the player's label, e.g. "Window from T Spawn". */
  title: string;
  autoplay?: boolean;
}

export function VideoPlayer({ video, title, autoplay = true }: VideoPlayerProps) {
  const ref = parseYouTubeUrl(video.url);
  if (!ref) {
    return (
      <a className={styles.external} href={video.url} target="_blank" rel="noreferrer">
        Open video ↗
      </a>
    );
  }
  const start = effectiveStart(video);
  return (
    <YouTubeClip
      key={`${ref.id}:${start}:${video.end ?? ""}`}
      videoId={ref.id}
      start={start}
      end={video.end}
      url={video.url}
      title={title}
      autoplay={autoplay}
    />
  );
}

interface ClipProps {
  videoId: string;
  start: number;
  end?: number;
  url: string;
  title: string;
  autoplay: boolean;
}

function YouTubeClip({ videoId, start, end, url, title, autoplay }: ClipProps) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [speed, setSpeed] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    let instance: YTPlayer | null = null;
    let timer: number | undefined;

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
          playerVars: { start, playsinline: 1, rel: 0, mute: 1, autoplay: autoplay ? 1 : 0 },
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              player.current = target;
              target.mute();
              if (autoplay) target.playVideo();
              setStatus("ready");
              if (end !== undefined) {
                timer = window.setInterval(() => {
                  if (target.getCurrentTime() >= end) target.seekTo(start, true);
                }, LOOP_CHECK_MS);
              }
            },
            onStateChange: ({ data, target }) => {
              if (data === YT.PlayerState.ENDED) {
                target.seekTo(start, true);
                target.playVideo();
              }
            },
            onError: () => {
              if (!cancelled) setStatus("error");
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      instance?.destroy();
      player.current = null;
    };
  }, [videoId, start, end, autoplay]);

  if (status === "error") {
    return (
      <div className={styles.unavailable} role="status">
        Video unavailable.{" "}
        <a href={url} target="_blank" rel="noreferrer">
          Open the link ↗
        </a>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div
        className={styles.frame}
        ref={host}
        title={`Video: ${title}`}
        data-testid="video-frame"
      />
      <div className={styles.controls}>
        <button
          type="button"
          disabled={status !== "ready"}
          onClick={() => {
            player.current?.seekTo(start, true);
            player.current?.playVideo();
          }}
        >
          ↻ Replay
        </button>
        {SPEEDS.map((rate) => (
          <button
            key={rate}
            type="button"
            aria-pressed={speed === rate}
            disabled={status !== "ready"}
            onClick={() => {
              player.current?.setPlaybackRate(rate);
              setSpeed(rate);
            }}
          >
            {rate}×
          </button>
        ))}
      </div>
    </div>
  );
}
