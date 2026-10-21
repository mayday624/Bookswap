import { Link, useLocation } from 'wouter';
import { BookOpen, Compass, HeartHandshake, MessageCircle, Moon, Plus, Sun, UserRound } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';

const navItems = [
  { href: '/', label: 'Discover', icon: Compass },
  { href: '/matches', label: 'Matches', icon: HeartHandshake },
  { href: '/add', label: 'Add book', icon: Plus },
  { href: '/chats', label: 'Chats', icon: MessageCircle },
  { href: '/profile', label: 'Profile', icon: UserRound },
];
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  return <div className="app-grain min-h-[100dvh] bg-background">
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg" data-testid="link-brand">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BookOpen size={19} strokeWidth={2.2} /></span>
          <span className="serif text-[23px] font-semibold tracking-tight">BookSwap</span>
        </Link>
        <div className="flex items-center gap-2">
          {user ? <span className="hidden text-sm text-muted-foreground sm:block" data-testid="text-header-user">A little more reading, shared.</span> :
            <Link href="/auth" className="rounded-full px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary" data-testid="link-sign-in">Sign in</Link>}
          <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-foreground hover:bg-secondary" data-testid="button-theme-toggle">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>
    </header>
    <main className="mx-auto min-h-[calc(100dvh-142px)] max-w-6xl px-4 pb-28 pt-7 sm:px-6 sm:pt-10 md:pb-12">{children}</main>
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:sticky md:bottom-0 md:mx-auto md:max-w-6xl md:border md:border-b-0 md:rounded-t-2xl">
      <div className="mx-auto grid max-w-3xl grid-cols-5 px-1 py-2 sm:px-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors sm:text-xs ${active ? 'text-primary' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'} ${href === '/add' ? 'relative' : ''}`} data-testid={`link-nav-${href.slice(1) || 'discover'}`}>
            <span className={href === '/add' ? 'grid h-8 w-8 place-items-center rounded-xl bg-accent text-accent-foreground' : ''}><Icon size={19} strokeWidth={active ? 2.4 : 1.8} /></span>
            <span>{label}</span>
          </Link>;
        })}
      </div>
    </nav>
  </div>;
}
