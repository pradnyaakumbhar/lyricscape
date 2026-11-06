import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "../hooks/useNowPlaying";
import type { PlayerState } from "../hooks/useSpotifyPlayer";

interface Props {
  track: Track;
  playerState: PlayerState | null;
  getPositionMs: () => number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (ms: number) => void;
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function Player({ track, playerState, getPositionMs, onTogglePlay, onNext, onPrev, onSeek }: Props) {
  const [displayMs, setDisplayMs] = useState(0);
  const rafRef = useRef(0);
  const seeking = useRef(false);

  // Tick the seek bar in sync with the extrapolated position.
  useEffect(() => {
    const tick = () => {
      if (!seeking.current) setDisplayMs(getPositionMs());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getPositionMs]);

  const paused = playerState?.paused ?? true;
  const duration = track.durationMs;
  const progress = duration ? displayMs / duration : 0;

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seeking.current = true;
    setDisplayMs(Number(e.target.value));
  }, []);

  const handleSeekCommit = useCallback((e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const val = Number((e.target as HTMLInputElement).value);
    onSeek(val);
    seeking.current = false;
  }, [onSeek]);

  return (
    <div className="absolute bottom-0 left-0 right-0 px-5 py-3 flex flex-col gap-2 bg-gradient-to-t from-black/80 to-transparent">
      {/* Seek bar */}
      <div className="flex items-center gap-3 text-xs text-white/50 font-mono">
        <span className="w-9 text-right">{fmt(displayMs)}</span>
        <input
          type="range"
          min={0}
          max={duration}
          value={displayMs}
          onChange={handleSeekChange}
          onMouseUp={handleSeekCommit}
          onTouchEnd={handleSeekCommit}
          className="flex-1 h-1 accent-white/80 cursor-pointer"
        />
        <span className="w-9">{fmt(duration)}</span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-4">
        {/* Album art */}
        {track.image && (
          <img src={track.image} alt={track.album} className="w-10 h-10 rounded object-cover shrink-0" />
        )}

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{track.title}</p>
          <p className="text-xs text-white/50 truncate">{track.artist}</p>
        </div>

        {/* Playback buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={onPrev} className="text-white/70 hover:text-white transition" aria-label="Previous">
            <PrevIcon />
          </button>
          <button
            onClick={onTogglePlay}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
            aria-label={paused ? "Play" : "Pause"}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <button onClick={onNext} className="text-white/70 hover:text-white transition" aria-label="Next">
            <NextIcon />
          </button>
        </div>
      </div>

      {/* Progress bar (visual only — mirrors the range input) */}
      <div className="h-px w-full bg-white/10 rounded overflow-hidden -mt-1">
        <div className="h-full bg-white/40 transition-none" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <rect x="3" y="2" width="4" height="12" rx="1" />
      <rect x="9" y="2" width="4" height="12" rx="1" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
      <path d="M3 2h2v12H3zM13 13.5L5.5 8 13 2.5v11z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
      <path d="M13 2h-2v12h2zM3 2.5L10.5 8 3 13.5V2.5z" />
    </svg>
  );
}
