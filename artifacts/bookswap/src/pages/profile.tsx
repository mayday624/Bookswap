import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, BookOpen, LoaderCircle, LogOut, MapPin, Trash2, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Notice } from '@/components/notice';
import { useAuth } from '@/lib/auth-context';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const profileSchema = z.object({
  display_name: z.string().trim().max(60, 'Keep your name under 60 characters.'),
  avatar_url: z.union([z.literal(''), z.string().url('Enter a complete image URL.')]),
  bio: z.string().trim().max(180, 'Keep your bio under 180 characters.'),
  area: z.string().trim().max(80, 'Keep your area under 80 characters.'),
  favorite_genres: z.string().max(120, 'Keep genres under 120 characters.'),
});
type ProfileValues = z.infer<typeof profileSchema>;
const blankProfile: ProfileValues = { display_name: '', avatar_url: '', bio: '', area: '', favorite_genres: '' };

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [profileExists, setProfileExists] = useState(false);
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: blankProfile });
  useEffect(() => {
    let alive = true;
    async function loadProfile() {
      setLoading(true); setNotice(null); setProfileExists(false);
      if (!user || !supabase) { form.reset(blankProfile); setLoading(false); return; }
      const { data, error } = await supabase.from('profiles').select('id, username, display_name, avatar_url, bio, area, town, favorite_genres').eq('id', user.id).maybeSingle();
      if (!alive) return;
      if (error) setNotice({ kind: 'error', text: `Profile could not be loaded: ${error.message}` });
      if (data) {
        setProfileExists(true);
        form.reset({ display_name: data.display_name ?? '', avatar_url: data.avatar_url ?? '', bio: data.bio ?? '', area: data.area ?? data.town ?? '', favorite_genres: Array.isArray(data.favorite_genres) ? data.favorite_genres.join(', ') : data.favorite_genres ?? '' });
      } else if (!error) form.reset({ ...blankProfile, display_name: typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '' });
      setLoading(false);
    }
    void loadProfile();
    return () => { alive = false; };
  }, [user?.id]);
  const saveProfile = async (values: ProfileValues) => {
    if (!user || !supabase) return;
    setSaving(true); setNotice(null);
    const payload = { id: user.id, display_name: values.display_name.trim(), avatar_url: values.avatar_url.trim() || null, bio: values.bio.trim(), area: values.area.trim(), town: values.area.trim(), favorite_genres: values.favorite_genres.split(',').map((genre) => genre.trim()).filter(Boolean) };
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    setSaving(false);
    if (error) setNotice({ kind: 'error', text: `Your profile was not saved: ${error.message}` });
    else { setProfileExists(true); setNotice({ kind: 'success', text: 'Your profile is saved.' }); }
  };
  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    setNotice(error ? { kind: 'error', text: error.message } : { kind: 'success', text: 'You are signed out.' });
  };
  const deleteAccount = async () => {
    if (!user || !supabase || !window.confirm('Request deletion of your BookSwap account? This cannot be undone.')) return;
    setDeleting(true); setNotice(null);
    const { error } = await supabase.functions.invoke('delete-account');
    setDeleting(false);
    if (error) setNotice({ kind: 'error', text: `Account deletion could not be requested: ${error.message}` });
    else {
      const { error: signOutError } = await supabase.auth.signOut();
      setNotice(signOutError ? { kind: 'error', text: `Deletion was requested, but sign out failed: ${signOutError.message}` } : { kind: 'success', text: 'Your account deletion request was submitted.' });
    }
  };
  if (authLoading || loading) return <div className="mx-auto max-w-3xl space-y-4" aria-label="Loading profile" data-testid="status-profile-loading"><div className="h-28 animate-pulse rounded-3xl bg-secondary" /><div className="h-96 animate-pulse rounded-3xl bg-secondary/70" /></div>;
  if (!user) return <div className="page-enter mx-auto max-w-xl rounded-[2rem] border border-border bg-card p-7 text-center sm:p-10">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><UserRound /></div><h1 className="serif mt-5 text-3xl">Your reader profile</h1><p className="mt-2 leading-7 text-muted-foreground">Sign in to add the details that help neighbours recognise a fellow reader.</p>
    <Link href="/auth" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground" data-testid="link-profile-sign-in">Sign in to continue <ArrowRight size={16} /></Link>
  </div>;
  const avatar = form.watch('avatar_url');
  const name = form.watch('display_name');
  return <div className="page-enter mx-auto max-w-3xl space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-accent">Your corner of BookSwap</p><h1 className="serif mt-2 text-4xl tracking-tight">Reader profile</h1><p className="mt-2 text-muted-foreground">A few details make a neighbourly handover feel more personal.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/shelf" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-secondary" data-testid="link-profile-shelf"><BookOpen size={16} /> My Shelf</Link><Button variant="outline" onClick={signOut} className="w-fit rounded-full" data-testid="button-sign-out"><LogOut size={16} className="mr-2" /> Sign out</Button></div></header>
    {!isSupabaseConfigured && <Notice kind="error" testId="status-profile-setup">Supabase is not configured. Your profile cannot be loaded or saved.</Notice>}
    {notice && <Notice kind={notice.kind} testId="status-profile-feedback">{notice.text}</Notice>}
    <section className="rounded-[1.75rem] border border-border bg-card p-5 shadow-sm sm:p-8">
      <div className="mb-7 flex items-center gap-4 border-b border-border pb-6">
        {avatar ? <img src={avatar} alt="" className="h-16 w-16 rounded-2xl border border-border object-cover" data-testid="img-profile-avatar" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} /> : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-primary" data-testid="img-profile-avatar"><span className="serif text-2xl">{name?.trim()?.[0]?.toUpperCase() || <UserRound />}</span></div>}
        <div className="min-w-0"><p className="font-semibold" data-testid="text-profile-name">{name || 'Your name goes here'}</p><p className="truncate text-sm text-muted-foreground" data-testid="text-profile-email">{user.email}</p><p className="mt-1 text-xs text-muted-foreground">{profileExists ? 'Profile saved' : 'Profile not saved yet'}</p></div>
      </div>
      <Form {...form}><form className="space-y-5" onSubmit={form.handleSubmit(saveProfile)}>
        <FormField control={form.control} name="display_name" render={({ field }) => <FormItem><FormLabel>Display name</FormLabel><FormControl><Input placeholder="The name neighbours will see" maxLength={60} data-testid="input-profile-name" {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="avatar_url" render={({ field }) => <FormItem><FormLabel>Avatar image URL <span className="font-normal text-muted-foreground">(optional)</span></FormLabel><FormControl><Input type="url" inputMode="url" placeholder="https://…" data-testid="input-profile-avatar" {...field} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="bio" render={({ field }) => <FormItem><FormLabel>Short bio</FormLabel><FormControl><Textarea rows={3} maxLength={180} placeholder="A line about the books you enjoy or how you like to swap." data-testid="input-profile-bio" {...field} /></FormControl><p className="text-xs text-muted-foreground">Up to 180 characters.</p><FormMessage /></FormItem>} />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField control={form.control} name="area" render={({ field }) => <FormItem><FormLabel><MapPin size={14} className="mr-1 inline" />Town or area</FormLabel><FormControl><Input placeholder="Narok, Nairobi…" data-testid="input-profile-area" {...field} /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="favorite_genres" render={({ field }) => <FormItem><FormLabel><BookOpen size={14} className="mr-1 inline" />Favourite genres</FormLabel><FormControl><Input placeholder="Mystery, history, fiction" data-testid="input-profile-genres" {...field} /></FormControl><p className="text-xs text-muted-foreground">Separate each genre with a comma.</p><FormMessage /></FormItem>} />
        </div>
        <Button type="submit" disabled={saving || !isSupabaseConfigured} className="h-11 w-full rounded-xl sm:w-auto" data-testid="button-save-profile">{saving && <LoaderCircle size={16} className="mr-2 animate-spin" />}Save profile</Button>
      </form></Form>
    </section>
    <section className="flex flex-col justify-between gap-4 rounded-[1.5rem] border border-destructive/25 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:p-6">
      <div><h2 className="font-semibold text-destructive">Account deletion</h2><p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">Request removal of your account and associated data. This action cannot be undone.</p></div>
      <Button variant="outline" disabled={deleting || !isSupabaseConfigured} onClick={deleteAccount} className="shrink-0 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10" data-testid="button-delete-account">{deleting ? <LoaderCircle size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}Request deletion</Button>
    </section>
  </div>;
}
