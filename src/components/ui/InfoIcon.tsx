/** Crisp outlined info glyph (reads clearly at 16–20px). */
export function InfoIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="7.75" r="1.1" fill="currentColor" stroke="none" />
      <path d="M12 10.5v5.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
