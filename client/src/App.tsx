import { useEffect, useMemo, useState } from "react";
import BorderGlow from "./components/BorderGlow";
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const authFailed = new URLSearchParams(window.location.search).get("auth") === "failed";
  // SDK track takes priority (accurate when our browser is the playback device)
  const track = spotify.playerState?.track ?? data?.track ?? null;

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
    <div className="h-screen w-screen bg-[#05050a] overflow-hidden">
      {/* Constellation stage — full screen */}
      <div
        id="stage"
        className="relative w-full h-full"
        style={{ background: "#000" }}
      >
        {/* All content */}
        <div className="absolute inset-0" style={{ zIndex: 30 }}>
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
              getPositionMs={getPos}
              onTogglePlay={spotify.togglePlay}
              onNext={spotify.nextTrack}
              onPrev={spotify.prevTrack}
              onSeek={spotify.seek}
            />
          )}

          {/* Border glow — rendered last so it sits above the constellation canvas */}
          <BorderGlow hue={268} />

          {/* HUD — track name + controls (always visible when signed in) */}
          <div className="absolute top-3 left-4 right-4 flex justify-between items-center text-[11px] uppercase tracking-widest text-white/30">
            <span>{track ? `${track.title} · ${track.artist}` : ""}</span>
            <div className="flex items-center gap-4">
              <button
                className="hover:text-white/60 transition"
                title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                    <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  </svg>
                )}
              </button>
              <button
                className="hover:text-white/60 transition"
                onClick={async () => {
                  await fetch(`${import.meta.env.VITE_SERVER_URL}/auth/logout`, { method: "POST", credentials: "include" });
                  window.location.href = "/";
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
