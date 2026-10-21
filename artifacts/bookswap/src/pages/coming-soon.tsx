import { BookOpen, HeartHandshake, MessageCircle, Plus, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import type { LucideIcon } from 'lucide-react';
const pageDetails: Record<string, { title: string; label: string; description: string; icon: LucideIcon }> = {
  '/matches': { title: 'Your next read is out there.', label: 'Matches', description: 'Book matches will appear here once real neighbours start sharing their shelves.', icon: HeartHandshake },
  '/add': { title: 'Give a good book another chapter.', label: 'Add a book', description: 'Book listings are coming in a future milestone. We’ll make it easy to tell your neighbours what you’ve finished.', icon: Plus },
  '/chats': { title: 'Make the handover easy.', label: 'Chats', description: 'Neighbour-to-neighbour messages are planned for a future milestone. No conversations are available yet.', icon: MessageCircle },
};
export default function ComingSoonPage({ path }: { path: string }) {
  const page = pageDetails[path] ?? pageDetails['/matches'];
  const Icon = page.icon;
  return <section className="page-enter mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center">
    <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-7 shadow-sm sm:p-11">
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-secondary/70" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold uppercase tracking-[.14em] text-primary"><Sparkles size={13} /> Future milestone</div>
        <div className="mt-8 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Icon size={26} /></div>
        <p className="mt-7 text-sm font-semibold text-accent">{page.label}</p>
        <h1 className="serif mt-2 max-w-lg text-4xl leading-[1.08] tracking-tight sm:text-5xl">{page.title}</h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">{page.description}</p>
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground"><BookOpen size={16} /> This space is not active yet. No sample listings or messages are shown.</p>
        <Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground" data-testid="link-return-discover">Back to Discover</Link>
      </div>
    </div>
  </section>;
}
