import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function PageLayout({ children, className, ...rest }: Props) {
  return (
    <div className={className} style={{ width: '100%', minWidth: 0 }} {...rest}>
      {children}
    </div>
  );
}
