export default function LoginScreen({ failed }: { failed?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-[#05050a]">
      {/* Logo / wordmark */}
      <div className="flex flex-col items-center gap-2">
        <StarIcon />
        <h1 className="text-2xl font-bold tracking-tight text-white">Lyric Constellations</h1>
        <p className="text-sm text-white/50 max-w-xs">
          Watch your music become a living constellation — every word a star, every line a new pattern.
        </p>
      </div>

      {failed && (
        <p className="text-sm text-red-400 bg-red-900/20 px-4 py-2 rounded-lg">
          Spotify connection failed. Please try again.
        </p>
      )}

      <a
        href="/auth/login"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1DB954] text-black font-semibold text-sm hover:brightness-110 transition"
      >
        <SpotifyLogo />
        Connect with Spotify
      </a>

      <p className="text-xs text-white/30">Requires Spotify Premium for playback controls.</p>
    </div>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
      <path
        d="M24 4 L26.5 21.5 L44 24 L26.5 26.5 L24 44 L21.5 26.5 L4 24 L21.5 21.5 Z"
        fill="hsl(268,90%,70%)"
        opacity="0.9"
      />
    </svg>
  );
}

function SpotifyLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.52 17.317a.75.75 0 01-1.03.244c-2.822-1.724-6.374-2.114-10.555-1.158a.75.75 0 01-.334-1.463c4.578-1.046 8.504-.594 11.676 1.347a.75.75 0 01.243 1.03zm1.472-3.274a.937.937 0 01-1.288.308c-3.228-1.983-8.147-2.558-11.966-1.4a.938.938 0 01-.542-1.793c4.363-1.322 9.782-.681 13.488 1.597a.937.937 0 01.308 1.288zm.127-3.408C15.422 8.47 9.388 8.263 5.9 9.33a1.125 1.125 0 11-.652-2.152C9.564 5.918 16.26 6.16 20.025 8.4a1.125 1.125 0 01-1.006 2.01v.235z" />
    </svg>
  );
}
