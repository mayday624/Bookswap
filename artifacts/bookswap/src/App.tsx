import { lazy, Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import AppShell from '@/components/app-shell';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const DiscoverPage = lazy(() => import('@/pages/discover'));
const AuthPage = lazy(() => import('@/pages/auth'));
const ProfilePage = lazy(() => import('@/pages/profile'));
const ComingSoonPage = lazy(() => import('@/pages/coming-soon'));
const AddBookPage = lazy(() => import('@/pages/add-book'));
const MyShelfPage = lazy(() => import('@/pages/my-shelf'));
const WishlistPage = lazy(() => import('@/pages/wishlist'));
const BookDetailPage = lazy(() => import('@/pages/book-detail'));
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
function LoadingFallback() {
  return <div role="status" aria-label="Loading page" data-testid="status-page-loading" className="mx-auto max-w-5xl space-y-5"><div className="h-72 animate-pulse rounded-[2rem] bg-secondary" /><div className="grid gap-5 sm:grid-cols-2"><div className="h-52 animate-pulse rounded-3xl bg-secondary/70" /><div className="h-52 animate-pulse rounded-3xl bg-secondary/70" /></div></div>;
}
function Router() {
  return <RoutedErrorBoundary><AppShell><Suspense fallback={<LoadingFallback />}><Switch>
    <Route path="/" component={DiscoverPage} />
    <Route path="/auth" component={AuthPage} />
    <Route path="/profile" component={ProfilePage} />
    <Route path="/matches"><ComingSoonPage path="/matches" /></Route>
    <Route path="/add" component={AddBookPage} />
    <Route path="/shelf" component={MyShelfPage} />
    <Route path="/wishlist" component={WishlistPage} />
    <Route path="/b/:id" component={BookDetailPage} />
    <Route path="/chats"><ComingSoonPage path="/chats" /></Route>
    <Route component={NotFound} />
  </Switch></Suspense></AppShell></RoutedErrorBoundary>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><ThemeProvider><AuthProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></AuthProvider></ThemeProvider></TooltipProvider></QueryClientProvider>;
}
export default App;
