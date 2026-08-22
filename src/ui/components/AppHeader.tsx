/**
 * The only permanent chrome in the app: the title, the matchup, and one slot for whatever the
 * current phase needs (the turn indicator, or a single control). Nothing else earns a place here.
 */
export function AppHeader({ children }: { readonly children?: React.ReactNode }) {
  return (
    <header className="glass flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl px-5 py-3.5 sm:px-6">
      <div className="flex flex-col">
        <h1 className="text-sm font-light tracking-[0.34em] text-ink uppercase sm:text-base">
          Battleship
        </h1>
        <p className="text-[0.68rem] tracking-[0.12em] text-ink-faint uppercase">Human vs AI</p>
      </div>
      {children}
    </header>
  );
}
