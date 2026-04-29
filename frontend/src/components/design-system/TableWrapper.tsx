import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function TableWrapper({ children, className, ...rest }: Props) {
  return (
    <div className={className} style={{ width: '100%', overflowX: 'auto' }} {...rest}>
      {children}
    </div>
  );
}
