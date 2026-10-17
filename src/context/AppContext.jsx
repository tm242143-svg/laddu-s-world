import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from '../supabase';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!supabaseConfigured);
  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [requests, setRequests] = useState([]);   // incoming pending friend requests
  const [invites, setInvites] = useState([]);     // incoming pending room invites
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((text, kind = 'info') => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user?.id;

  const loadRooms = useCallback(async () => {
    if (!uid) return;
    const rpc = await supabase.rpc('my_rooms');
    if (!rpc.error) { setRooms(rpc.data || []); return; }
    // Fallback if upgrade-v2.sql has not been run yet.
    const { data } = await supabase.from('rooms').select('id,name,code,visibility,host_id,created_at').order('created_at', { ascending: false }).limit(30);
    setRooms(data || []);
  }, [uid]);

  const loadNotifs = useCallback(async () => {
    if (!uid) return;
    const fr = await supabase.from('friendships').select('requester_id,created_at').eq('addressee_id', uid).eq('status', 'pending');
    const ids = (fr.data || []).map(r => r.requester_id);
    let names = {};
    if (ids.length) { const p = await supabase.from('profiles').select('id,display_name').in('id', ids); (p.data || []).forEach(x => { names[x.id] = x.display_name; }); }
    setRequests((fr.data || []).map(r => ({ ...r, name: names[r.requester_id] || 'Someone' })));
    const inv = await supabase.from('room_invites').select('id,room_id,from_id,created_at').eq('to_id', uid).eq('status', 'pending');
    if (inv.error) { setInvites([]); return; }
    const rid = [...new Set((inv.data || []).map(i => i.room_id))];
    const fid = [...new Set((inv.data || []).map(i => i.from_id))];
    const rn = {}, fn = {};
    if (rid.length) (await supabase.from('rooms').select('id,name').in('id', rid)).data?.forEach(r => { rn[r.id] = r.name; });
    if (fid.length) (await supabase.from('profiles').select('id,display_name').in('id', fid)).data?.forEach(r => { fn[r.id] = r.display_name; });
    setInvites((inv.data || []).map(i => ({ ...i, room_name: rn[i.room_id] || 'a room', from_name: fn[i.from_id] || 'A friend' })));
  }, [uid]);

  useEffect(() => {
    if (!uid) { setProfile(null); setRooms([]); setRequests([]); setInvites([]); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (alive) setProfile(data || { id: uid, display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Viewer' });
    })();
    loadRooms(); loadNotifs();
    // Live friend requests and room invites.
    const ch = supabase.channel(`notifs:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, payload => {
        const row = payload.new || {};
        if (payload.eventType === 'INSERT' && row.addressee_id === uid && row.status === 'pending') toast('💌 New friend request', 'love');
        if (payload.eventType === 'UPDATE' && row.requester_id === uid && row.status === 'accepted') toast('🎉 Your friend request was accepted', 'love');
        loadNotifs();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_invites', filter: `to_id=eq.${uid}` }, payload => {
        if (payload.eventType === 'INSERT') toast('🎟️ You were invited to a room', 'love');
        loadNotifs();
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateProfile = useCallback(async patch => {
    const { error } = await supabase.from('profiles').upsert({ id: uid, ...patch });
    if (error) { toast(error.code === '23505' || /duplicate|unique/i.test(error.message) ? 'That username is already taken — pick another one.' : error.message, 'warn'); return false; }
    setProfile(p => ({ ...(p || { id: uid }), ...patch })); return true;
  }, [uid, toast]);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); window.location.hash = '#/'; }, []);

  const value = useMemo(() => ({
    session, uid, ready, profile, setProfile, rooms, loadRooms, requests, invites, loadNotifs, toast, signOut, updateProfile,
    displayName: profile?.display_name || session?.user?.email?.split('@')[0] || 'Viewer',
  }), [session, uid, ready, profile, rooms, loadRooms, requests, invites, loadNotifs, toast, signOut, updateProfile]);

  return <Ctx.Provider value={value}>
    {children}
    <div className="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}</div>
  </Ctx.Provider>;
}
