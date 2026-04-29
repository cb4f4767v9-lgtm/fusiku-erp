import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
  /** Default padded card; false = edge-to-edge (e.g. table inside) */
  padded?: boolean;
};

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <div
      className={['ds-card', padded ? '' : 'ds-card--flush', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}
