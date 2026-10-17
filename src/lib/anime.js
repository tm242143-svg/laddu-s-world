// Anime catalogue from AniList (free public GraphQL API, no key). Episodes stream from official free YouTube channels
// (Ani-One Asia, Muse Asia, etc.) which are legal and embeddable; Tamil dubs are linked from AnimeRulz.
const Q = `query($page:Int,$search:String,$sort:[MediaSort],$genre:String){Page(page:$page,perPage:24){media(type:ANIME,search:$search,sort:$sort,genre:$genre,isAdult:false){id title{romaji english} coverImage{large color} bannerImage description(asHtml:false) averageScore episodes status seasonYear genres trailer{id site}}}}`;
export async function anilist({ search = '', sort = 'TRENDING_DESC', genre = '', page = 1 } = {}) {
  const variables = { page, sort: [search ? 'SEARCH_MATCH' : sort] }; if (search) variables.search = search; if (genre) variables.genre = genre;
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 10000);
  try {
    const r = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: Q, variables }), signal: c.signal });
    if (!r.ok) throw new Error(`AniList ${r.status}`);
    const j = await r.json(); return j?.data?.Page?.media || [];
  } finally { clearTimeout(t); }
}
export const animeTitle = a => a?.title?.english || a?.title?.romaji || 'Untitled';
export const stripHtml = h => String(h || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
export const TAMIL_ANIME_URL = 'https://animerulz.co.in/language/tamil';
export const animerulzSearch = t => `https://animerulz.co.in/?s=${encodeURIComponent(t)}`;
