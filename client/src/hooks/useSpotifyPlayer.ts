import { useEffect, useRef, useState } from "react";

export interface SdkTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  image: string | null;
}

export interface PlayerState {
  paused: boolean;
  position: number; // ms
  duration: number; // ms
  trackId: string | null;
  track: SdkTrack | null;
}

export interface SpotifyPlayer {
  deviceId: string | null;
  playerState: PlayerState | null;
  ready: boolean;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (positionMs: number) => void;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (opts: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayerInstance;
    };
  }
}

interface SpotifyPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  addListener(event: string, cb: (data: unknown) => void): void;
  removeListener(event: string, cb?: (data: unknown) => void): void;
}

async function fetchAccessToken(): Promise<string> {
  const res = await fetch("/api/spotify/token", { credentials: "include" });
  if (!res.ok) throw new Error("Not authenticated");
  const { accessToken } = await res.json() as { accessToken: string };
  return accessToken;
}

function loadSDK(): Promise<void> {
  if (document.getElementById("spotify-sdk")) return Promise.resolve();
  return new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const script = document.createElement("script");
    script.id = "spotify-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.head.appendChild(script);
  });
}

export function useSpotifyPlayer(): SpotifyPlayer {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);
  const [ready, setReady] = useState(false);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);

  useEffect(() => {
    let player: SpotifyPlayerInstance | null = null;

    const init = async () => {
      // Check if Premium is available before loading the SDK.
      const tokenRes = await fetch("/api/spotify/token", { credentials: "include" });
      if (!tokenRes.ok) return;

      await loadSDK();

      player = new window.Spotify.Player({
        name: "Lyric Constellations",
        getOAuthToken: async (cb) => {
          try { cb(await fetchAccessToken()); } catch { /* signed out */ }
        },
        volume: 0.8,
      });

      player.addListener("ready", (data) => {
        const { device_id } = data as { device_id: string };
        setDeviceId(device_id);
        setReady(true);
        // Only transfer if the user explicitly wants to — don't auto-steal playback.
      });

      player.addListener("not_ready", () => {
        setDeviceId(null);
        setReady(false);
      });

      player.addListener("player_state_changed", (data) => {
        if (!data) return;
        const s = data as {
          paused: boolean;
          position: number;
          duration: number;
          track_window: {
            current_track: {
              id: string;
              name: string;
              duration_ms: number;
              artists: Array<{ name: string }>;
              album: { name: string; images: Array<{ url: string }> };
            };
          };
        };
        const ct = s.track_window?.current_track;
        setPlayerState({
          paused: s.paused,
          position: s.position,
          duration: s.duration,
          trackId: ct?.id ?? null,
          track: ct ? {
            id: ct.id,
            title: ct.name,
            artist: (ct.artists ?? []).map((a) => a.name).join(", "),
            album: ct.album?.name ?? "",
            durationMs: ct.duration_ms,
            image: ct.album?.images?.[1]?.url ?? ct.album?.images?.[0]?.url ?? null,
          } : null,
        });
      });

      const connected = await player.connect();
      if (connected) playerRef.current = player;
    };

    init().catch(() => { /* non-Premium account: SDK unavailable */ });

    return () => {
      player?.disconnect();
    };
  }, []);

  const togglePlay = () => playerRef.current?.togglePlay();
  const nextTrack = () => playerRef.current?.nextTrack();
  const prevTrack = () => playerRef.current?.previousTrack();
  const seek = (ms: number) => playerRef.current?.seek(ms);

  return { deviceId, playerState, ready, togglePlay, nextTrack, prevTrack, seek };
}
