export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  setPlaybackRate(rate: number): void;
  mute(): void;
  destroy(): void;
}

export interface YTPlayerOptions {
  host: string;
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars: Record<string, string | number>;
  events: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";
let pending: Promise<YTNamespace> | null = null;

/** Loads the YouTube IFrame Player API once. A failed load can be retried. */
export function loadYouTubeApi(timeoutMs = 10_000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;

  pending = new Promise<YTNamespace>((resolve, reject) => {
    const fail = (message: string) => {
      window.clearTimeout(timer);
      pending = null;
      reject(new Error(message));
    };
    const timer = window.setTimeout(() => fail("YouTube API timed out"), timeoutMs);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      if (window.YT) resolve(window.YT);
      else fail("YouTube API loaded without YT");
    };
    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => fail("YouTube API failed to load");
    document.head.appendChild(script);
  });
  return pending;
}
