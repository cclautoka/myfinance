import type { ReactNode } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

export function ScrollReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ref, className: revealClass } = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`${revealClass} ${className}`.trim()}>
      {children}
    </div>
  );
}
