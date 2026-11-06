import { useEffect, useMemo, useState } from "react";
import Constellation from "./components/Constellation";
import LoginScreen from "./components/LoginScreen";
import Player from "./components/Player";
import { useNowPlaying } from "./hooks/useNowPlaying";
import { useSpotifyPlayer } from "./hooks/useSpotifyPlayer";
import { parseLRC } from "./lib/lrc";

type LyricsState = "idle" | "loading" | "found" | "missing";

export default function App() {
  const { status, data, getPositionMs } = useNowPlaying();
  const spotify = useSpotifyPlayer();

  const [synced, setSynced] = useState<string | null>(null);
  const [lyricsState, setLyricsState] = useState<LyricsState>("idle");

  const authFailed = new URLSearchParams(window.location.search).get("auth") === "failed";
  const track = data?.track ?? null;

  // Fetch synced lyrics whenever the track changes.
  useEffect(() => {
    if (!track) { setSynced(null); setLyricsState("idle"); return; }
    const ctrl = new AbortController();
    setLyricsState("loading");
    setSynced(null);
    const q = new URLSearchParams({
      title: track.title,
      artist: track.artist.split(", ")[0],
      album: track.album,
      duration: String(track.durationMs / 1000),
    });
    fetch(`/api/lyrics?${q}`, { signal: ctrl.signal, credentials: "include" })
      .then((r) => r.json())
      .then((j: { synced: string | null }) => {
        setSynced(j.synced);
        setLyricsState(j.synced ? "found" : "missing");
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [track?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = useMemo(() => (synced ? parseLRC(synced) : []), [synced]);

  // Prefer the SDK's position (fires on state change events) over polling when available.
  const getPos = useMemo<() => number>(() => {
    if (spotify.playerState && !spotify.playerState.paused) {
      const { position, paused } = spotify.playerState;
      const capturedAt = performance.now();
      return () => {
        const elapsed = paused ? 0 : performance.now() - capturedAt;
        return position + elapsed;
      };
    }
    return getPositionMs;
  }, [spotify.playerState, getPositionMs]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/40 text-sm">
        Connecting…
      </div>
    );
  }

  if (status === "signed-out") {
    return <LoginScreen failed={authFailed} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#05050a]">
      {/* Constellation stage */}
      <div
        className="relative w-full max-w-5xl"
        style={{
          aspectRatio: "16 / 9",
          borderRadius: "14px",
          background: "#000",
          overflow: "hidden",
          boxShadow: `
            inset 0 0 0 1px hsla(268,90%,62%,0.55),
            inset 0 0 38px -4px hsl(268,90%,62%),
            0 0 60px -20px hsl(268,90%,62%)
          `,
        }}
      >
        <Constellation lines={lines} getPositionMs={getPos} hue={268} />

        {/* Status overlay */}
        {!track && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm text-center px-6">
            Play something on Spotify on any device.
          </div>
        )}
        {track && lyricsState === "loading" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/30 text-xs">
            Finding lyrics…
          </div>
        )}
        {track && lyricsState === "missing" && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/30 text-xs">
            No synced lyrics found for this track.
          </div>
        )}

        {/* Player controls */}
        {track && (
          <Player
            track={track}
            playerState={spotify.playerState}
            getPositionMs={getPositionMs}
            onTogglePlay={spotify.togglePlay}
            onNext={spotify.nextTrack}
            onPrev={spotify.prevTrack}
            onSeek={spotify.seek}
          />
        )}

        {/* HUD — track name + disconnect */}
        {track && (
          <div className="absolute top-3 left-4 right-4 flex justify-between items-center text-[11px] uppercase tracking-widest text-white/30">
            <span>{track.title} · {track.artist}</span>
            <button
              className="hover:text-white/60 transition"
              onClick={async () => {
                await fetch("/auth/logout", { method: "POST", credentials: "include" });
                window.location.href = "/";
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
