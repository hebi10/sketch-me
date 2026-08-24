import type { PropsWithChildren } from 'react';

type StatusNoticeProps = PropsWithChildren<{
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
}>;

export function StatusNotice({ children, tone, title }: StatusNoticeProps) {
  return (
    <section className={`status-notice status-notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </section>
  );
}
