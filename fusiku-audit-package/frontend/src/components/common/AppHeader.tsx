const logoIconUrl = '/logo-icon.svg';

/** Global top-left mark: small logo only (same glass style as auth pages). */
export function AppHeader() {
  return (
    <div className="fixed top-6 left-8 z-50">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/20 backdrop-blur-2xl shadow-lg ring-1 ring-white/10"
        aria-hidden
      >
        <img src={logoIconUrl} alt="" className="h-5 w-5" />
      </div>
    </div>
  );
}
