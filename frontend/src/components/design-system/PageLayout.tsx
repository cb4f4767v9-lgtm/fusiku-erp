import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function PageLayout({ children, className, ...rest }: Props) {
  // Subtle fade/slide on each page mount so route changes feel less jerky.
  // The class is gated by `prefers-reduced-motion` in CSS — accessible by default.
  const merged = ['page-transition', className].filter(Boolean).join(' ');
  return (
    <div className={merged} style={{ width: '100%', minWidth: 0 }} {...rest}>
      {children}
    </div>
  );
}
