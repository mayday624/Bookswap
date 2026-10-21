import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';
export default function NotFound() {
  return <section className="page-enter mx-auto flex min-h-[58vh] max-w-xl flex-col items-center justify-center rounded-[2rem] border border-border bg-card px-6 py-12 text-center">
    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-primary"><Compass size={28} /></div>
    <p className="mt-6 text-xs font-bold uppercase tracking-[.17em] text-accent">Wrong shelf</p>
    <h1 className="serif mt-2 text-4xl tracking-tight">We can’t find that page.</h1>
    <p className="mt-3 max-w-sm leading-7 text-muted-foreground">The address may have changed, or this page has not been added to BookSwap yet.</p>
    <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground" data-testid="link-not-found-home"><ArrowLeft size={16} /> Return to Discover</Link>
  </section>;
}
