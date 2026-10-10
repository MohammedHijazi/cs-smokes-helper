import { useEffect, useRef, useState } from "react";
import { useYouTubePlayer } from "../smoke/useYouTubePlayer";
import styles from "./Edit.module.css";

const CHECK_MS = 250;

export interface ClipTimerProps {
  videoId: string;
  /** Where the player opens. Read once; render with key={videoId}. */
  initialStart: number;
  start: number | undefined;
  end: number | undefined;
  onSetStart: (seconds: number) => void;
  onSetEnd: (seconds: number) => void;
}

/** Spec §5 item 2: scrub with YouTube's controls, then Set start / Set end; no loop while editing. */
export function ClipTimer({
  videoId,
  initialStart,
  start,
  end,
  onSetStart,
  onSetEnd,
}: ClipTimerProps) {
  const host = useRef<HTMLDivElement>(null);
  const [playingClip, setPlayingClip] = useState(false);
  const { status, player } = useYouTubePlayer(host, {
    videoId,
    playerVars: { start: initialStart, playsinline: 1, rel: 0, autoplay: 0 },
  });

  // ▶ Play clip: pause once playback reaches the end.
  useEffect(() => {
    if (!playingClip || end === undefined) return;
    const timer = window.setInterval(() => {
      const target = player.current;
      if (target && target.getCurrentTime() >= end) {
        target.pauseVideo();
        setPlayingClip(false);
      }
    }, CHECK_MS);
    return () => window.clearInterval(timer);
  }, [playingClip, end, player]);

  if (status === "error") {
    return (
      <p className={styles.hint} role="status">
        Video unavailable — check the link.
      </p>
    );
  }

  const now = () => player.current?.getCurrentTime() ?? 0;
  const ready = status === "ready";
  return (
    <div className={styles.clip}>
      <div className={styles.frame} ref={host} title="Video" data-testid="clip-frame" />
      <div className={styles.buttonRow}>
        <button type="button" disabled={!ready} onClick={() => onSetStart(Math.floor(now()))}>
          Set start
        </button>
        <button type="button" disabled={!ready} onClick={() => onSetEnd(Math.ceil(now()))}>
          Set end
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            player.current?.seekTo(start ?? 0, true);
            player.current?.playVideo();
            setPlayingClip(true);
          }}
        >
          ▶ Play clip
        </button>
      </div>
    </div>
  );
}
