import type { HTMLAttributes, PropsWithChildren } from 'react';

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </section>
  );
}
