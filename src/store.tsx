// Auth session + the signed-in participant's data, loaded from Supabase and refreshed after every write.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import type { Activity, Checkin, Entry, EntryStatus, Expedition, ExpeditionInvite, ExpeditionMember, FriendProfile, FriendRequest, FriendSummary, Goal, GoalStatus, MyMembership, Profile, Resource } from './types';
import type { GoalArea, ResourceCategory } from './data';
import type { Snapshot } from './derive';
import { toISODate } from './lib/dates';

export interface Social {
  friends: FriendSummary[];
  requests: FriendRequest[];
  checkins: Checkin[];
}

export interface Api {
  updateProfile(patch: Partial<Profile>): Promise<void>;
  addActivity(a: Pick<Activity, 'area' | 'name'> & Partial<Activity>): Promise<Activity>;
  updateActivity(id: string, patch: Partial<Activity>): Promise<void>;
  addEntry(e: { activity_id: string; date: string; hours: number; description?: string }): Promise<void>;
  setEntryStatus(ids: string[], status: EntryStatus): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  saveGoal(area: GoalArea, patch: { title: string; text: string }, note?: string): Promise<void>;
  setGoalStatus(id: string, status: GoalStatus): Promise<void>;
  saveExpedition(x: Partial<Expedition> & Pick<Expedition, 'name' | 'start_date' | 'end_date'>): Promise<void>;
  deleteExpedition(id: string): Promise<void>;
  sendFriendRequest(code: string): Promise<string>;
  respondRequest(id: string, accept: boolean): Promise<void>;
  removeFriend(friendshipId: string): Promise<void>;
  sendCheckin(toUser: string, message: string): Promise<void>;
  uploadAvatar(blob: Blob): Promise<void>;
  removeAvatar(): Promise<void>;
  addLink(r: { title: string; url: string; category: ResourceCategory; notes?: string }): Promise<void>;
  uploadDocument(file: File, meta: { title: string; category: ResourceCategory; notes?: string }, onProgress?: (pct: number) => void): Promise<void>;
  updateResource(id: string, patch: Partial<Pick<Resource, 'title' | 'category' | 'notes' | 'url'>>): Promise<void>;
  deleteResource(r: Resource): Promise<void>;
  documentUrl(path: string): Promise<string>;
  friendProfile(friendId: string): Promise<FriendProfile>;
  expeditionMembers(expeditionId: string): Promise<ExpeditionMember[]>;
  inviteToExpedition(expeditionId: string, friendId: string): Promise<void>;
  respondExpeditionInvite(expeditionId: string, accept: boolean): Promise<void>;
  leaveExpedition(expeditionId: string): Promise<void>;
  removeExpeditionMember(expeditionId: string, userId: string): Promise<void>;
  saveReflection(expeditionId: string, reflection: string): Promise<void>;
  signOut(): Promise<void>;
}

interface StoreValue {
  session: Session | null;
  authReady: boolean;
  /** True after the user arrives via a password-reset email link, until they set a new password. */
  recovering: boolean;
  setRecovering(v: boolean): void;
  snapshot: Snapshot | null;
  social: Social;
  loading: boolean;
  error: string | null;
  reload(): Promise<void>;
  api: Api;
}

const StoreContext = createContext<StoreValue | null>(null);

const must = <T,>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [social, setSocial] = useState<Social>({ friends: [], requests: [], checkins: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id ?? null;
  const userRef = useRef(userId);
  userRef.current = userId;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    const uid = userRef.current;
    if (!uid) { setSnapshot(null); return; }
    setLoading(true);
    setError(null);
    // Right after sign-in, Supabase's API can briefly reject the fresh token ("JWT issued at future")
    // because its clock trails the auth service by a second. Wait and retry once before surfacing it.
    const fetchAll = () => Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).single().then(r => must<Profile>(r)),
        supabase.from('activities').select('*').eq('user_id', uid).order('created_at').then(r => must<Activity[]>(r)),
        supabase.from('entries').select('*').eq('user_id', uid).order('date', { ascending: false }).order('created_at', { ascending: false }).then(r => must<Entry[]>(r)),
        supabase.from('goals').select('*').eq('user_id', uid).then(r => must<Goal[]>(r)),
        supabase.from('expeditions').select('*').order('start_date').then(r => must<Expedition[]>(r)),
        supabase.from('expedition_members').select('expedition_id, role, status, reflection, invited_by').eq('user_id', uid).then(r => must<MyMembership[]>(r)),
        supabase.rpc('friend_summaries').then(r => must<FriendSummary[]>(r)),
        supabase.rpc('pending_requests').then(r => must<FriendRequest[]>(r)),
        supabase.rpc('my_checkins').then(r => must<Checkin[]>(r)),
        // Tolerate a deploy that lands before the resources migration: a missing table just means "none yet".
        supabase.from('resources').select('*').eq('user_id', uid).order('created_at', { ascending: false })
          .then(r => (r.error && /resources/.test(r.error.message) ? [] : must<Resource[]>(r))),
      ]);
    try {
      let result: Awaited<ReturnType<typeof fetchAll>>;
      try {
        result = await fetchAll();
      } catch (e) {
        if (!/issued at future|JWT/i.test((e as Error).message)) throw e;
        await new Promise(r => setTimeout(r, 1500));
        result = await fetchAll();
      }
      const [profile, activities, entries, goals, allExpeditions, memberships, friends, requests, checkins, resources] = result;
      // Expeditions I own or have accepted are mine; pending invitations are listed separately.
      const byId = new Map(memberships.map(m => [m.expedition_id, m]));
      const expeditions = allExpeditions.filter(x => x.user_id === uid || byId.get(x.id)?.status === 'accepted');
      const pending = allExpeditions.filter(x => byId.get(x.id)?.status === 'invited');
      const invites: ExpeditionInvite[] = await Promise.all(pending.map(async x => {
        const inviter = byId.get(x.id)?.invited_by;
        const { data } = await supabase.rpc('expedition_members_view', { p_exp: x.id });
        const row = (data as ExpeditionMember[] | null)?.find(m => m.user_id === uid);
        return { expedition: x, invitedByName: row?.invited_by_name ?? (inviter ? 'A friend' : null) };
      }));
      if (userRef.current !== uid) return;
      setSnapshot({ profile, activities, entries: entries.map(e => ({ ...e, hours: Number(e.hours) })), goals, expeditions, memberships, expeditionInvites: invites, resources });
      // numeric columns can arrive as strings depending on the PostgREST version
      const num = (v: number | string | null) => (v === null || v === undefined ? null : Number(v));
      setSocial({ friends: friends.map(f => ({ ...f, hours_vps: num(f.hours_vps), hours_pd: num(f.hours_pd), hours_pf: num(f.hours_pf), week_hours: num(f.week_hours) })), requests, checkins });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [userId, reload]);

  const api = useMemo<Api>(() => {
    const uid = () => { const id = userRef.current; if (!id) throw new Error('Not signed in'); return id; };
    const after = async <T,>(p: PromiseLike<T>) => { const r = await p; await reload(); return r; };
    return {
      updateProfile: patch => after(supabase.from('profiles').update(patch).eq('id', uid()).then(r => { must(r); })),
      addActivity: a => after(supabase.from('activities').insert({ ...a, user_id: uid() }).select().single().then(r => must<Activity>(r))),
      updateActivity: (id, patch) => after(supabase.from('activities').update(patch).eq('id', id).then(r => { must(r); })),
      addEntry: e => after(supabase.from('entries').insert({ ...e, user_id: uid() }).then(r => { must(r); })),
      setEntryStatus: (ids, status) => after(supabase.from('entries').update({ status }).in('id', ids).then(r => { must(r); })),
      deleteEntry: id => after(supabase.from('entries').delete().eq('id', id).then(r => { must(r); })),
      saveGoal: async (area, patch, note) => {
        const existing = snapshot?.goals.find(g => g.area === area);
        const today = toISODate(new Date());
        if (!existing) {
          await after(supabase.from('goals').insert({ user_id: uid(), area, ...patch, version: 1, status: 'draft', dated: today, history: [{ v: 1, note: note || 'Initial goal', date: today, text: patch.text }] }).then(r => { must(r); }));
        } else {
          const revising = existing.text.trim() !== patch.text.trim() && existing.status !== 'draft';
          const version = revising ? existing.version + 1 : existing.version;
          const history = revising
            ? [{ v: version, note: note || 'Revised', date: today, text: patch.text }, ...existing.history]
            : existing.history.map((h, i) => (i === 0 ? { ...h, text: patch.text, note: note || h.note } : h));
          await after(supabase.from('goals').update({ ...patch, version, status: revising ? 'draft' : existing.status, dated: revising ? today : existing.dated, history, updated_at: new Date().toISOString() }).eq('id', existing.id).then(r => { must(r); }));
        }
      },
      setGoalStatus: (id, status) => after(supabase.from('goals').update({ status, updated_at: new Date().toISOString() }).eq('id', id).then(r => { must(r); })),
      saveExpedition: x => after((x.id
        ? supabase.from('expeditions').update(x).eq('id', x.id)
        : supabase.from('expeditions').insert({ ...x, user_id: uid() })).then(r => { must(r); })),
      deleteExpedition: id => after(supabase.from('expeditions').delete().eq('id', id).then(r => { must(r); })),
      sendFriendRequest: code => after(supabase.rpc('send_friend_request', { p_code: code }).then(r => must<string>(r))),
      respondRequest: (id, accept) => after((accept
        ? supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)
        : supabase.from('friendships').delete().eq('id', id)).then(r => { must(r); })),
      removeFriend: id => after(supabase.from('friendships').delete().eq('id', id).then(r => { must(r); })),
      sendCheckin: (to_user, message) => after(supabase.from('checkins').insert({ from_user: uid(), to_user, message }).then(r => { must(r); })),
      uploadAvatar: async blob => {
        const path = `${uid()}/avatar.jpg`;
        const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
        if (error) throw new Error(error.message);
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        await after(supabase.from('profiles').update({ avatar_url: `${data.publicUrl}?v=${Date.now()}` }).eq('id', uid()).then(r => { must(r); }));
      },
      removeAvatar: async () => {
        await supabase.storage.from('avatars').remove([`${uid()}/avatar.jpg`]);
        await after(supabase.from('profiles').update({ avatar_url: null }).eq('id', uid()).then(r => { must(r); }));
      },
      addLink: r => after(supabase.from('resources').insert({ ...r, kind: 'link', user_id: uid() }).then(x => { must(x); })),
      uploadDocument: async (file, meta) => {
        const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
        const path = `${uid()}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || 'application/octet-stream' });
        if (error) throw new Error(error.message);
        await after(supabase.from('resources').insert({ ...meta, kind: 'file', user_id: uid(), storage_path: path, mime_type: file.type || null, size_bytes: file.size }).then(x => { must(x); }));
      },
      updateResource: (id, patch) => after(supabase.from('resources').update(patch).eq('id', id).then(r => { must(r); })),
      deleteResource: async r => {
        if (r.storage_path) await supabase.storage.from('documents').remove([r.storage_path]);
        await after(supabase.from('resources').delete().eq('id', r.id).then(x => { must(x); }));
      },
      documentUrl: async path => {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 120);
        if (error) throw new Error(error.message);
        return data.signedUrl;
      },
      friendProfile: async id => {
        const { data, error } = await supabase.rpc('friend_profile', { p_friend: id });
        if (error) throw new Error(error.message);
        const fp = data as FriendProfile;
        return { ...fp, entries: fp.entries?.map(e => ({ ...e, hours: Number(e.hours) })) ?? null, hours: fp.hours ? Object.fromEntries(Object.entries(fp.hours).map(([k, v]) => [k, Number(v)])) : null };
      },
      expeditionMembers: async id => must<ExpeditionMember[]>(await supabase.rpc('expedition_members_view', { p_exp: id })),
      inviteToExpedition: (expedition_id, user_id) => after(supabase.from('expedition_members').insert({ expedition_id, user_id, role: 'member', status: 'invited', invited_by: uid() }).then(r => { must(r); })),
      respondExpeditionInvite: (expedition_id, accept) => after((accept
        ? supabase.from('expedition_members').update({ status: 'accepted' }).eq('expedition_id', expedition_id).eq('user_id', uid())
        : supabase.from('expedition_members').delete().eq('expedition_id', expedition_id).eq('user_id', uid())).then(r => { must(r); })),
      leaveExpedition: expedition_id => after(supabase.from('expedition_members').delete().eq('expedition_id', expedition_id).eq('user_id', uid()).then(r => { must(r); })),
      removeExpeditionMember: (expedition_id, user_id) => after(supabase.from('expedition_members').delete().eq('expedition_id', expedition_id).eq('user_id', user_id).then(r => { must(r); })),
      saveReflection: (expedition_id, reflection) => after(supabase.from('expedition_members').update({ reflection: reflection.trim() || null }).eq('expedition_id', expedition_id).eq('user_id', uid()).then(r => { must(r); })),
      signOut: async () => { await supabase.auth.signOut(); setSnapshot(null); },
    };
  }, [reload, snapshot]);

  const value = useMemo<StoreValue>(() => ({ session, authReady, recovering, setRecovering, snapshot, social, loading, error, reload, api }), [session, authReady, recovering, snapshot, social, loading, error, reload, api]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

/** The loaded snapshot; only call from screens rendered after data is ready. */
export function useSnapshot(): Snapshot {
  const { snapshot } = useStore();
  if (!snapshot) throw new Error('Snapshot not loaded');
  return snapshot;
}

/** A per-device preference (theme, indicator style) kept in localStorage. */
export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { return (localStorage.getItem('award-ledger:' + key) as T) || fallback; } catch { return fallback; }
  });
  const set = useCallback((next: T) => {
    setV(next);
    try { localStorage.setItem('award-ledger:' + key, next); } catch { /* storage blocked: keep in memory */ }
  }, [key]);
  return [v, set];
}
