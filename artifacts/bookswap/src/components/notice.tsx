import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
export function Notice({ children, kind = 'info', testId }: { children: ReactNode; kind?: 'info' | 'error' | 'success'; testId?: string }) {
  const Icon = kind === 'error' ? AlertCircle : kind === 'success' ? CheckCircle2 : Info;
  return <div role={kind === 'error' ? 'alert' : 'status'} data-testid={testId} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${kind === 'error' ? 'border-destructive/30 bg-destructive/5 text-destructive' : kind === 'success' ? 'border-primary/25 bg-primary/5 text-primary' : 'border-border bg-secondary/60 text-muted-foreground'}`}>
    <Icon size={18} className="mt-0.5 shrink-0" /><div>{children}</div>
  </div>;
}
