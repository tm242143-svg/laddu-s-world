// Daily astrology card — generated on-device, deterministic per (day + sign), so everyone gets the same reading for a sign on a given day.
export const RASIS = [
  ['mesham', 'Mesham', 'Aries', '♈'], ['rishabam', 'Rishabam', 'Taurus', '♉'], ['mithunam', 'Mithunam', 'Gemini', '♊'], ['kadagam', 'Kadagam', 'Cancer', '♋'],
  ['simmam', 'Simmam', 'Leo', '♌'], ['kanni', 'Kanni', 'Virgo', '♍'], ['thulaam', 'Thulaam', 'Libra', '♎'], ['viruchigam', 'Viruchigam', 'Scorpio', '♏'],
  ['dhanusu', 'Dhanusu', 'Sagittarius', '♐'], ['magaram', 'Magaram', 'Capricorn', '♑'], ['kumbam', 'Kumbam', 'Aquarius', '♒'], ['meenam', 'Meenam', 'Pisces', '♓'],
];
const MSG = [
  'A kind word you give today comes back to you doubled before the night ends.',
  'Someone from your past may message you — answer with an open heart.',
  'Slow down. The answer you are chasing is already walking toward you.',
  'Your laughter is the lucky charm today; spend it freely on your people.',
  'A small risk taken before noon opens a bigger door by evening.',
  'Music will fix what words cannot — put on your favourite song.',
  'Trust your first instinct on a decision you have been postponing.',
  'Good news travels to you through a friend. Keep your phone close.',
  'Rest is productive today. Guilt-free break, then you will fly.',
  'An old dream taps your shoulder again. Give it ten honest minutes.',
  'Share your food, share your time — the universe is watching and smiling.',
  'A calm evening with loved ones will out-shine any grand plan.',
  'Someone is quietly proud of you. Let that sink in.',
  'Clear one small mess today, and your mind clears with it.',
  'Your patience gets rewarded, maybe in a way you did not expect.',
];
const TIPS = ['Wear something bright', 'Call your mother', 'Drink more water', 'Watch the sunset', 'Compliment a stranger', 'Skip the argument', 'Share a song with a friend', 'Walk for ten minutes', 'Write down three thanks', 'Start the thing you keep delaying'];
const COLORS = [['Rose pink', '#ff4d8d'], ['Royal violet', '#8b5cf6'], ['Temple gold', '#ffb86b'], ['Jasmine white', '#f5f0ff'], ['Peacock teal', '#2dd4bf'], ['Kumkum red', '#ff3b5c'], ['Sky blue', '#60a5fa'], ['Mango yellow', '#fbbf24']];
const TIMES = ['6:15 AM', '8:40 AM', '11:05 AM', '1:30 PM', '4:10 PM', '6:45 PM', '8:20 PM', '9:50 PM'];

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dailyReading(signId, day = todayKey()) {
  const r = rng(hash(`${day}:${signId}`));
  const pick = a => a[Math.floor(r() * a.length)];
  const [colorName, colorHex] = pick(COLORS);
  return {
    message: pick(MSG), tip: pick(TIPS), luckyNumber: 1 + Math.floor(r() * 9), colorName, colorHex, luckyTime: pick(TIMES),
    love: 2 + Math.floor(r() * 4), career: 2 + Math.floor(r() * 4), luck: 2 + Math.floor(r() * 4),
  };
}
export const seenToday = () => { try { return localStorage.getItem('lw-astro-day') === todayKey(); } catch { return false; } };
export const markSeen = () => { try { localStorage.setItem('lw-astro-day', todayKey()); } catch { /* ignore */ } };
export const getSign = () => { try { return localStorage.getItem('lw-rasi') || ''; } catch { return ''; } };
export const setSign = id => { try { localStorage.setItem('lw-rasi', id); } catch { /* ignore */ } };

/* =====================================================================================
   v5 — personal astrology: profile, approximate rasi/nakshatra from birth data,
   personalised daily reading, 10-porutham partner match, and a future outlook.
   Everything is generated on-device. For fun & reflection — not real predictions.
   ===================================================================================== */
export const NAKSHATRAS = ['Ashwini', 'Bharani', 'Karthigai', 'Rohini', 'Mirugaseerisham', 'Thiruvathirai', 'Punarpoosam', 'Poosam', 'Ayilyam', 'Magam', 'Pooram', 'Uthiram', 'Hastham', 'Chithirai', 'Swathi', 'Visakam', 'Anusham', 'Kettai', 'Moolam', 'Pooradam', 'Uthiradam', 'Thiruvonam', 'Avittam', 'Sathayam', 'Poorattathi', 'Uthirattathi', 'Revathi'];
const LORD = { mesham: 'Mars', rishabam: 'Venus', mithunam: 'Mercury', kadagam: 'Moon', simmam: 'Sun', kanni: 'Mercury', thulaam: 'Venus', viruchigam: 'Mars', dhanusu: 'Jupiter', magaram: 'Saturn', kumbam: 'Saturn', meenam: 'Jupiter' };
const rasiIdx = id => RASIS.findIndex(r => r[0] === id);
export const rasiName = id => RASIS.find(r => r[0] === id)?.[1] || '';

// Low-precision Moon longitude (Meeus, main terms ≈ 0.3°) → sidereal (Lahiri). Birth time is taken as IST.
export function moonSign(dob, tob = '12:00') {
  const [y, m, d] = String(dob).split('-').map(Number); if (!y || !m || !d) return null;
  const [hh, mm] = String(tob || '12:00').split(':').map(Number);
  const ut = (hh || 0) + (mm || 0) / 60 - 5.5;
  const jd = Date.UTC(y, m - 1, d, 0, 0, 0) / 86400000 + 2440587.5 + ut / 24;
  const T = (jd - 2451545.0) / 36525; const R = Math.PI / 180;
  const L = 218.3164477 + 481267.88123421 * T, D = 297.8501921 + 445267.1114034 * T, M = 357.5291092 + 35999.0502909 * T, Mp = 134.9633964 + 477198.8675055 * T, F = 93.272095 + 483202.0175233 * T;
  let lon = L + 6.289 * Math.sin(Mp * R) + 1.274 * Math.sin((2 * D - Mp) * R) + 0.658 * Math.sin(2 * D * R) + 0.214 * Math.sin(2 * Mp * R) - 0.186 * Math.sin(M * R) - 0.114 * Math.sin(2 * F * R) + 0.059 * Math.sin((2 * D - 2 * Mp) * R) + 0.057 * Math.sin((2 * D - M - Mp) * R) + 0.053 * Math.sin((2 * D + Mp) * R);
  const ayan = 23.853 + 0.013969 * (y + (m - 1) / 12 - 2000);
  lon = (((lon - ayan) % 360) + 360) % 360;
  return { rasi: RASIS[Math.floor(lon / 30)][0], nakshatra: Math.floor(lon / (360 / 27)) };
}

const PKEY = 'lw-astro-profile';
export const emptyProfile = { name: '', dob: '', tob: '', rasi: '', nak: -1 };
export const getProfile = () => { try { return { ...emptyProfile, ...JSON.parse(localStorage.getItem(PKEY) || '{}') }; } catch { return { ...emptyProfile }; } };
export const saveProfile = p => { try { localStorage.setItem(PKEY, JSON.stringify(p)); if (p.rasi) setSign(p.rasi); } catch { /* ignore */ } };
export const profileReady = p => Boolean(p && p.name && p.rasi && p.nak >= 0);

const POOL = {
  work: ['A pending file finally moves — follow it up politely before noon.', 'Your effort is noticed by someone senior today; do not hide your work.', 'Avoid starting arguments in meetings; your calm earns the win.', 'A new idea at work is worth writing down before it fades.'],
  love: ['A soft message to someone you care about lands beautifully.', 'Listen more than you speak with your loved one tonight.', 'Old misunderstandings melt if you apologise first.', 'A small surprise — a song, a sweet, a call — makes the day.'],
  money: ['Hold off on impulse buying; a better deal shows up in a few days.', 'A small saving today is bigger than it looks.', 'Pay one pending bill and feel lighter.', 'Money comes through effort, not shortcuts, today.'],
  health: ['Drink water first, tea second.', 'A ten-minute walk will reset your mood.', 'Sleep early — your body is asking politely.', 'Stretch your neck and shoulders; you have been tense.'],
};
const NAK_TRAIT = ['energetic and quick to start', 'loyal and determined', 'sharp, bold and truthful', 'charming and creative', 'curious and gentle', 'deep-thinking and resilient', 'optimistic and kind', 'nurturing and wise', 'intuitive and mysterious', 'regal and respectful', 'warm and pleasure-loving', 'generous and dependable', 'skilful and witty', 'artistic and bright', 'independent and graceful', 'ambitious and focused', 'devoted and friendly', 'protective and intense', 'honest and investigative', 'confident and cheerful', 'principled and steady', 'a listener and learner', 'rhythmic and prosperous', 'healing and private', 'passionate and idealistic', 'patient and compassionate', 'gentle and guiding'];

export function personalDaily(p, day = todayKey()) {
  const base = dailyReading(p.rasi, day);
  const r = rng(hash(`${day}:${p.name.toLowerCase()}:${p.nak}:${p.dob}`));
  const pick = a => a[Math.floor(r() * a.length)];
  const tara = (Math.floor(r() * 9)); // simple "tara bala" style day-quality for the nakshatra
  const quality = [4, 2, 3, 5, 1, 4, 3, 5, 5][tara];
  return { ...base, luckyNumber: 1 + (hash(`${p.name}${day}`) % 9), work: pick(POOL.work), loveLine: pick(POOL.love), money: pick(POOL.money), health: pick(POOL.health),
    dayScore: Math.round(55 + quality * 8 + r() * 5), starNote: `${NAKSHATRAS[p.nak]} natives are ${NAK_TRAIT[p.nak]} — lean into that today.`, rahu: ['7:30–9:00 AM', '9:00–10:30 AM', '10:30 AM–12:00 PM', '12:00–1:30 PM', '1:30–3:00 PM', '3:00–4:30 PM', '4:30–6:00 PM'][new Date(day).getDay() % 7], greet: p.name.split(' ')[0] };
}

/* ---- 10 Porutham (Tamil marriage matching) — classical tables, simplified rules ---- */
const GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0]; // 0 deva 1 manushya 2 rakshasa
const YONI = ['horse', 'elephant', 'sheep', 'serpent', 'serpent', 'dog', 'cat', 'sheep', 'cat', 'rat', 'rat', 'cow', 'buffalo', 'tiger', 'buffalo', 'tiger', 'deer', 'deer', 'dog', 'monkey', 'mongoose', 'monkey', 'lion', 'horse', 'lion', 'cow', 'elephant'];
const YONI_ENEMY = [['cow', 'tiger'], ['elephant', 'lion'], ['horse', 'buffalo'], ['dog', 'deer'], ['serpent', 'mongoose'], ['monkey', 'sheep'], ['cat', 'rat']];
const RAJJU = n => [[0, 8, 9, 17, 18, 26], [1, 7, 10, 16, 19, 25], [2, 6, 11, 15, 20, 24], [3, 5, 12, 14, 21, 23], [4, 13, 22]].findIndex(g => g.includes(n));
const VEDHA = [[0, 17], [1, 16], [2, 15], [3, 14], [5, 21], [6, 20], [7, 19], [8, 18], [9, 26], [10, 25], [11, 24], [12, 23], [4, 13], [4, 22], [13, 22]];
const FRIEND = { Sun: ['Moon', 'Mars', 'Jupiter'], Moon: ['Sun', 'Mercury'], Mars: ['Sun', 'Moon', 'Jupiter'], Mercury: ['Sun', 'Venus'], Jupiter: ['Sun', 'Moon', 'Mars'], Venus: ['Mercury', 'Saturn'], Saturn: ['Mercury', 'Venus'] };
const VASYA = { mesham: 'q', rishabam: 'q', mithunam: 'h', kadagam: 'w', simmam: 'v', kanni: 'h', thulaam: 'h', viruchigam: 'k', dhanusu: 'h', magaram: 'w', kumbam: 'h', meenam: 'w' };
const cnt = (a, b) => ((b - a + 27) % 27) + 1;

export function porutham(girl, boy) {
  const gn = girl.nak, bn = boy.nak, gr = rasiIdx(girl.rasi), br = rasiIdx(boy.rasi);
  const star = cnt(gn, bn), rc = ((br - gr + 12) % 12) + 1;
  const gl = LORD[girl.rasi], bl = LORD[boy.rasi];
  const items = [
    ['Dina', 'Daily harmony & health', [0, 2, 4, 6, 8].includes(star % 9)],
    ['Gana', 'Temperament', GANA[gn] === GANA[bn] || (GANA[gn] + GANA[bn] === 1) || (GANA[gn] === 1 && GANA[bn] === 2 && false)],
    ['Mahendra', 'Children & family growth', [4, 7, 10, 13, 16, 19, 22, 25].includes(star)],
    ['Stree Deergha', 'Long-term prosperity', star >= 13],
    ['Yoni', 'Chemistry & intimacy', !YONI_ENEMY.some(([a, b]) => (YONI[gn] === a && YONI[bn] === b) || (YONI[gn] === b && YONI[bn] === a))],
    ['Rasi', 'Family bonding', rc === 1 || rc >= 7],
    ['Rasiyathipathi', 'Mutual friendship of lords', gl === bl || FRIEND[gl]?.includes(bl) || FRIEND[bl]?.includes(gl)],
    ['Vasya', 'Mutual attraction', VASYA[girl.rasi] === VASYA[boy.rasi] || (VASYA[girl.rasi] === 'h' && VASYA[boy.rasi] !== 'k') || (VASYA[boy.rasi] === 'h' && VASYA[girl.rasi] !== 'k')],
    ['Rajju', 'Longevity of the marriage', RAJJU(gn) !== RAJJU(bn)],
    ['Vedha', 'Freedom from afflictions', !VEDHA.some(([a, b]) => (gn === a && bn === b) || (gn === b && bn === a))],
  ].map(([name, meaning, ok]) => ({ name, meaning, ok: Boolean(ok) }));
  const passed = items.filter(i => i.ok).length;
  const critical = items.filter(i => ['Rajju', 'Vedha', 'Yoni'].includes(i.name) && !i.ok).length;
  return { items, passed, critical };
}

const lifeSum = s => String(s).toLowerCase().replace(/[^a-z]/g, '').split('').reduce((a, c) => a + (c.charCodeAt(0) - 96), 0);
export function nameNumber(n) { let x = lifeSum(n); while (x > 9) x = String(x).split('').reduce((a, c) => a + +c, 0); return x || 1; }

const VERDICT = [[85, 'A rare, glowing match 💞', 'Stars, signs and names flow together. Build slowly and keep communicating — this is a lovely base.'], [70, 'A strong, warm match ♥', 'Plenty of natural understanding. A few small differences are normal — talk about money and family early.'], [55, 'A good match with homework 🌱', 'You complement each other, but need patience. Agree on routines, respect space and celebrate small things.'], [0, 'A match that needs extra care 🪔', 'Different rhythms here. It can still work beautifully with honest talk, humour and shared goals — real life matters more than any chart.']];
const COUPLE_THEMES = ['a home or a shared space', 'a joint trip you will remember', 'a family function bringing both sides closer', 'a career jump for one of you', 'saving for a big shared goal', 'learning something new together', 'meeting each other’s elders', 'a fresh start after a small misunderstanding'];

export function coupleReading(me, partner) {
  // Tradition: compare girl → boy. Without gender we run the match both ways and take the kinder reading.
  const a = porutham(me, partner), b = porutham(partner, me); const best = a.passed >= b.passed ? a : b;
  const nm = (nameNumber(me.name) + nameNumber(partner.name)) % 9; const nameBond = [60, 90, 70, 85, 65, 95, 72, 80, 88][nm];
  const ageOk = me.dob && partner.dob ? Math.max(0, 100 - Math.abs(new Date(me.dob) - new Date(partner.dob)) / 31557600000 * 4) : 75;
  let score = Math.round(best.passed * 6.2 + nameBond * 0.2 + ageOk * 0.08 + (best.critical ? -6 * best.critical : 4));
  score = Math.max(28, Math.min(97, score));
  const v = VERDICT.find(([min]) => score >= min);
  const r = rng(hash(`${me.name}|${partner.name}|${me.dob}|${partner.dob}`.toLowerCase())); const pick = a2 => a2[Math.floor(r() * a2.length)];
  const y = new Date().getFullYear(); const years = [0, 1, 2, 3, 4].map(i => ({ year: y + i, theme: COUPLE_THEMES[(Math.floor(r() * 99) + i) % COUPLE_THEMES.length], mood: 3 + Math.floor(r() * 3) }));
  return { ...best, score, verdict: v[1], advice: v[2], nameBond, years, luckyMonth: MONTHS[Math.floor(r() * 12)], fight: pick(['money talk', 'time with family', 'phone time', 'small chores', 'planning trips']), strength: pick(['laughing together', 'taking care of each other', 'shared dreams', 'trust', 'music and movies']) };
}

/* ---- Future outlook ---- */
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const AREAS = [['career', 'Career & work', '💼'], ['love', 'Love & family', '💞'], ['money', 'Money', '🪙'], ['health', 'Health', '🌿'], ['study', 'Learning', '📚'], ['travel', 'Travel', '✈️']];
const AREA_TXT = {
  career: ['Steady climb; speak up about your skills.', 'A role change or new responsibility looks likely.', 'Quiet period — build skills, the jump comes later.', 'Teamwork brings the biggest win.'],
  love: ['A deep conversation strengthens an important bond.', 'New connections arrive through friends.', 'Family brings joy; make time for them.', 'Heal an old distance with one honest message.'],
  money: ['Disciplined saving pays off.', 'Extra income through a side effort is possible.', 'Avoid lending; protect your savings.', 'A planned purchase is better than an impulsive one.'],
  health: ['Build a daily routine; consistency wins.', 'Watch sleep and screen time.', 'Energy rises — start a sport or walks.', 'Eat home-cooked; skip late nights.'],
  study: ['Great time to start a course.', 'Exams or tests favour steady revision.', 'A mentor appears — ask questions.', 'Skills you learn now pay off in two years.'],
  travel: ['A short trip refreshes you.', 'A long-planned journey comes together.', 'Pilgrimage or family travel is favoured.', 'Travel for work or study opens a door.'],
};
export function futureReading(p, now = new Date()) {
  const seed = hash(`${p.name.toLowerCase()}|${p.dob}|${p.nak}|${p.rasi}`); const r = rng(seed); const pick = a => a[Math.floor(r() * a.length)];
  const y = now.getFullYear(), m0 = now.getMonth();
  const months = Array.from({ length: 12 }, (_, i) => { const mi = (m0 + i) % 12; const yr = y + Math.floor((m0 + i) / 12); const rr = rng(hash(`${seed}:${yr}:${mi}`)); return { label: `${MONTHS[mi].slice(0, 3)} ${String(yr).slice(2)}`, full: `${MONTHS[mi]} ${yr}`, score: 2 + Math.floor(rr() * 4), tag: ['Start', 'Build', 'Rest', 'Meet', 'Travel', 'Save', 'Learn', 'Celebrate'][Math.floor(rr() * 8)] }; });
  const best = [...months].sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.full);
  const areas = AREAS.map(([id, label, icon]) => ({ id, label, icon, stars: 2 + Math.floor(r() * 4), text: pick(AREA_TXT[id]) }));
  const age = p.dob ? Math.max(0, Math.floor((now - new Date(p.dob)) / 31557600000)) : null;
  const phases = [1, 2, 3, 4, 5].map(i => ({ year: y + i - 1, title: ['Foundation', 'Growth', 'Harvest', 'Change', 'Settling'][Math.floor(r() * 5)], text: pick(['Focus on one big goal and finish it.', 'Say yes to the opportunity that scares you slightly.', 'People you help now will help you later.', 'Let go of one habit that holds you back.', 'Invest in your health and your home.', 'A new city, role or circle is possible.', 'Your reputation grows quietly.']), age: age !== null ? age + i - 1 : null }));
  return { months, best, areas, phases, caution: pick(['Do not sign anything in a hurry.', 'Avoid gossip; it travels back to you.', 'Do not skip sleep for work.', 'Check documents twice before travel.']), blessing: pick(['Light a lamp on Fridays and call someone you miss.', 'Feed birds or street animals once a week.', 'Start the morning with five quiet minutes.', 'Visit a temple, church or mosque of your choice with family.']), trait: NAK_TRAIT[p.nak], lord: LORD[p.rasi] };
}
