import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, BookOpen, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/notice';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const schema = z.object({
  displayName: z.string().trim().max(60, 'Keep your name under 60 characters.').optional(),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});
type AuthValues = z.infer<typeof schema>;

export default function AuthPage() {
  const [, navigate] = useLocation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const form = useForm<AuthValues>({ resolver: zodResolver(schema), defaultValues: { displayName: '', email: '', password: '' } });
  const busy = form.formState.isSubmitting;
  const submit = async (values: AuthValues) => {
    setError(''); setMessage('');
    if (!supabase) { setError('Add your Supabase URL and anonymous key to enable sign-in.'); return; }
    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: values.email, password: values.password, options: { data: { display_name: values.displayName?.trim() || '' }, emailRedirectTo: window.location.origin } });
        if (signUpError) throw signUpError;
        if (data.session) navigate('/');
        else setMessage('Check your inbox for a confirmation link. Once confirmed, come back and sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
        if (signInError) throw signInError;
        navigate('/');
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'We could not complete that request. Please try again.'); }
  };
  const google = async () => {
    setError(''); setMessage('');
    if (!supabase) { setError('Add your Supabase URL and anonymous key to enable sign-in.'); return; }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
    if (oauthError) setError(oauthError.message);
  };
  return <div className="page-enter mx-auto grid max-w-4xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm md:grid-cols-[.9fr_1.1fr]">
    <aside className="relative flex min-h-[230px] flex-col justify-between overflow-hidden bg-primary p-6 text-primary-foreground sm:p-8 md:min-h-[610px]">
      <div className="absolute -right-16 top-20 h-64 w-64 rounded-full border border-white/10" />
      <div className="absolute -right-3 top-32 h-40 w-40 rounded-full border border-white/10" />
      <Link href="/" className="relative inline-flex w-fit items-center gap-2 text-sm text-primary-foreground/75 hover:text-primary-foreground" data-testid="link-auth-back"><ArrowLeft size={16} /> Back to Discover</Link>
      <div className="relative my-7 md:my-auto">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><BookOpen size={24} /></span>
        <h1 className="serif mt-6 max-w-sm text-4xl leading-[1.08] tracking-tight sm:text-5xl">Stories are better when they travel.</h1>
        <p className="mt-4 max-w-sm leading-7 text-primary-foreground/75">Meet readers around your corner of Kenya. Share a book, find the next one.</p>
      </div>
      <p className="relative text-xs text-primary-foreground/60">A neighbourly exchange, one handover at a time.</p>
    </aside>
    <section className="p-6 sm:p-9 md:px-10 md:py-12">
      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-accent">Reader community</p>
        <h2 className="serif mt-2 text-3xl tracking-tight">{isSignUp ? 'Make yourself at home.' : 'Welcome back.'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{isSignUp ? 'Create your account to get started.' : 'Sign in to your BookSwap account.'}</p>
      </div>
      {!isSupabaseConfigured && <Notice kind="error" testId="status-auth-setup">Supabase is not configured yet. Account actions are disabled until the project URL and public anon key are set.</Notice>}
      {error && <div className="mt-4"><Notice kind="error" testId="status-auth-error">{error}</Notice></div>}
      {message && <div className="mt-4"><Notice kind="success" testId="status-auth-message">{message}</Notice></div>}
      <Form {...form}>
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(submit)} noValidate>
          {isSignUp && <FormField control={form.control} name="displayName" render={({ field }) => <FormItem><FormLabel>Display name <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input autoComplete="name" placeholder="What should neighbours call you?" data-testid="input-display-name" {...field} /></FormControl><FormMessage /></FormItem>} />}
          <FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email address</FormLabel><FormControl><Input type="email" autoComplete="email" placeholder="you@example.com" data-testid="input-email" {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Password</FormLabel><FormControl><div className="relative"><Input type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} placeholder="At least 8 characters" className="pr-12" data-testid="input-password" {...field} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="button-toggle-password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></FormControl><FormMessage /></FormItem>} />
          <Button type="submit" disabled={busy || !isSupabaseConfigured} className="h-11 w-full rounded-xl font-semibold" data-testid="button-auth-submit">{busy && <LoaderCircle className="mr-2 animate-spin" size={17} />}{isSignUp ? 'Create account' : 'Sign in'}</Button>
        </form>
      </Form>
      <div className="relative my-5 text-center text-xs text-muted-foreground before:absolute before:left-0 before:top-1/2 before:h-px before:w-[42%] before:bg-border after:absolute after:right-0 after:top-1/2 after:h-px after:w-[42%] after:bg-border">or continue with</div>
      <Button variant="outline" type="button" onClick={google} disabled={!isSupabaseConfigured} className="h-11 w-full rounded-xl" data-testid="button-google-sign-in"><GoogleMark /> Continue with Google</Button>
      <p className="mt-6 text-center text-sm text-muted-foreground">{isSignUp ? 'Already have an account?' : 'New to BookSwap?'}{' '}
        <button type="button" onClick={() => { setIsSignUp((value) => !value); setError(''); setMessage(''); form.clearErrors(); }} className="font-semibold text-primary hover:underline" data-testid="button-switch-auth">{isSignUp ? 'Sign in' : 'Create an account'}</button>
      </p>
    </section>
  </div>;
}
function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 48 48" className="mr-2 h-[18px] w-[18px]"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.5 9.5 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.8 6-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6v-5.3H5.9a20 20 0 0 0 0 18.2l6.9-5.3Z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20 20 0 0 0 5.9 14.9l6.9 5.3c1.6-4.7 6-8.2 11.2-8.2Z"/></svg>;
}
