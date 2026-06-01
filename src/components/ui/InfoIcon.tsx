/** Shared “info” glyph for hints (not the letter “i” in body copy). */
export function InfoIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 100-2 1 1 0 000 2zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10v6a1 1 0 11-2 0V9z"
        clipRule="evenodd"
      />
    </svg>
  );
}
