/**
 * The single polite live region for the whole app. Everything worth announcing (placement,
 * rejected placement, shots, sinkings, turn changes, game over) is funnelled through here, so
 * visible status elements can stay non-live and nothing is read out twice.
 */
export function LiveRegion({ message }: { readonly message: string }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
