import React, { useEffect, useState } from 'react';
import { supabaseConfigured } from './supabase';
import { AppProvider, useApp } from './context/AppContext';
import { useRoute } from './lib/router';
import HeartCanvas from './components/HeartCanvas';
import Intro from './components/Intro';
import TopNav from './components/TopNav';
import AstroCard from './components/AstroCard';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import RoomsPage from './pages/RoomsPage';
import FriendsPage from './pages/FriendsPage';
import DiscoverPage from './pages/DiscoverPage';
import ErrorBoundary from './components/ErrorBoundary';
import AnimePage from './pages/AnimePage';
import AstroPage from './pages/AstroPage';
import SettingsPage from './pages/SettingsPage';
import RoomLayout from './pages/RoomLayout';

function SetupNeeded() {
  return <div className="center-screen"><div className="glass setup-card"><h1>Almost there ♥</h1>
    <p>Create a <code>.env</code> file next to <code>package.json</code> with your Supabase keys, then restart <code>npm run dev</code>.</p>
    <pre>{`VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY`}</pre></div></div>;
}

function Router() {
  const { path, parts } = useRoute();
  let page;
  if (parts[0] === 'room' && parts[1]) page = <RoomLayout key={parts[1]} roomId={parts[1]} tab={parts[2] || 'watch'} />;
  else if (parts[0] === 'rooms') page = <RoomsPage />;
  else if (parts[0] === 'discover') page = <DiscoverPage />;
  else if (parts[0] === 'astro') page = <AstroPage />;
  else if (parts[0] === 'anime') page = <AnimePage />;
  else if (parts[0] === 'settings') page = <SettingsPage />;
  else if (parts[0] === 'friends') page = <FriendsPage />;
  else page = <HomePage />;
  return <div className="page-anim" key={parts[0] === 'room' ? 'room' : path}><ErrorBoundary key={path}>{page}</ErrorBoundary></div>;
}

function Shell() {
  const { session, ready } = useApp();
  if (!ready) return <div className="center-screen"><div className="loader-heart">♥</div></div>;
  if (!session) return <AuthPage />;
  return <><TopNav /><main className="main"><Router /></main><AstroCard /></>;
}

export default function App() {
  const [intro, setIntro] = useState(() => { try { return !sessionStorage.getItem('lw-intro'); } catch { return true; } });
  const done = () => { try { sessionStorage.setItem('lw-intro', '1'); } catch { /* private mode */ } setIntro(false); };
  useEffect(() => { document.body.classList.toggle('no-scroll', intro); return () => document.body.classList.remove('no-scroll'); }, [intro]);
  return <AppProvider>
    <div className="bg-aurora" aria-hidden="true" />
    {!intro && <HeartCanvas density={0.35} className="bg-hearts" />}
    {supabaseConfigured ? <Shell /> : <SetupNeeded />}
    {intro && <Intro onDone={done} />}
  </AppProvider>;
}
