import { useEffect, useState } from 'react';

// Tiny hash router: #/rooms, #/friends, #/room/<id>/<tab>
const read = () => (window.location.hash.replace(/^#/, '') || '/').split('?')[0];

export function navigate(path) {
  if (read() === path) return;
  window.location.hash = path;
}

export function useRoute() {
  const [path, setPath] = useState(read());
  useEffect(() => {
    const onChange = () => setPath(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const parts = path.split('/').filter(Boolean);
  return { path, parts };
}
