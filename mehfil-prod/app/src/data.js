// Static catalogue and defaults for Mehfil Live (BRD v2, audience-journey-led)

export const C = {
  bg: '#0a0612',
  bg2: '#140b22',
  panel: '#1b1030',
  panel2: '#24163d',
  line: '#3a2659',
  rose: '#ff6b9d',
  roseDim: '#7a2d4b',
  gold: '#d4af37',
  goldLight: '#f3d77a',
  text: '#f6eefc',
  dim: '#a996c2',
  green: '#3ddc97',
  red: '#ff4d6d',
  blue: '#7aa7ff',
  amber: '#ffb648',
};

const OUTFITS = ['#ff6b9d', '#d4af37', '#9b5de5', '#00bbf9', '#f15bb5', '#00f5d4', '#fee440', '#ff8fab', '#c77dff', '#ff9e00'];
const SKINS = ['#e0ac69', '#c68642', '#f1c27d', '#8d5524', '#ffdbac'];
export const LANGS = ['Hindi', 'English', 'Punjabi', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Gujarati'];
export const SPECS = ['Bollywood', 'Kathak', 'Bhangra', 'Garba', 'Ghoomar', 'Lavani', 'Semi-classical', 'Sufi'];
const CITIES = ['Mumbai', 'Delhi', 'Pune', 'Kolkata', 'Jaipur', 'Lucknow', 'Hyderabad', 'Chennai', 'Amritsar', 'Ahmedabad'];

const NAMES = [
  'Priya', 'Noor', 'Zara', 'Meher', 'Sitara', 'Anaya', 'Kiran', 'Simran', 'Heer', 'Laila', 'Tara', 'Sana', 'Ishita', 'Kavya', 'Naina', 'Roshni',
  'Jasleen', 'Rani', 'Mahi', 'Riya', 'Aaliya', 'Bindiya', 'Chandni', 'Divya', 'Esha', 'Farah', 'Gauri', 'Hema', 'Inaya', 'Jiya', 'Komal', 'Lavanya',
];

export const FAN_NAMES = [
  'RajaSahab', 'DilSeDesi', 'ChaiLover', 'NawabOfDelhi', 'BollyBuff', 'SufiSoul', 'Dhillon_J', 'Mumbai_Meri', 'GoldenEra', 'Rangeela',
  'ShayarDil', 'Lucknowi', 'Jaan_e_Mehfil', 'KathakFan', 'Desi_Dhamaal', 'Maharaja99', 'NightOwl_Pune', 'Rockstar_R',
];

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function makeRoster() {
  const r = rng(4242);
  const pickN = (arr, n) => [...arr].sort(() => r() - 0.5).slice(0, n);
  return NAMES.map((name, i) => {
    const langs = [r() < 0.6 ? 'Hindi' : 'English', ...pickN(LANGS, 2)].filter((v, k, a) => a.indexOf(v) === k).slice(0, 3);
    const specs = pickN(SPECS, r() < 0.5 ? 1 : 2);
    const fans = {};
    pickN(FAN_NAMES, 3).forEach((f) => { fans[f] = Math.floor(100 + r() * 3000); });
    const coins = Object.values(fans).reduce((a, b) => a + b, 0) + Math.floor(r() * 1500);
    return {
      id: i,
      name,
      gender: 'f',
      langs,
      specs,
      city: CITIES[Math.floor(r() * CITIES.length)],
      bio: `${specs[0]} dancer from ${CITIES[Math.floor(r() * CITIES.length)]}. Requests welcome — ${langs.join(', ')} spoken.`,
      outfit: OUTFITS[Math.floor(r() * OUTFITS.length)],
      accent: OUTFITS[Math.floor(r() * OUTFITS.length)],
      skin: SKINS[Math.floor(r() * SKINS.length)],
      variant: i % 4,
      isNew: i % 9 === 4,
      status: i < 16 ? 'stage' : i < 25 ? 'bench' : i < 29 ? 'break' : 'off',
      since: Date.now() - Math.floor(r() * 600000),
      returnAt: i >= 25 && i < 29 ? Date.now() + 60000 + Math.floor(r() * 120000) : null,
      coins,
      followers: Math.floor(40 + r() * 900),
      fans,
      split: 50,
      rating: 4 + Math.round(r() * 9) / 10,
    };
  });
}

export function seedSpenders() {
  const r = rng(77);
  const out = {};
  FAN_NAMES.forEach((f) => { out[f] = Math.floor(500 + r() * 18000); });
  return out;
}

// Gift tiers (BR-29) + seasonal (BR-69) + exclusive above 5,000 (BR-65)
export const GIFTS = [
  { id: 'rose', name: 'Rose', emoji: '🌹', cost: 10, anim: 'float' },
  { id: 'heart', name: 'Heart', emoji: '💖', cost: 25, anim: 'float' },
  { id: 'chai', name: 'Chai', emoji: '☕', cost: 50, anim: 'float' },
  { id: 'jhumka', name: 'Jhumka', emoji: '💫', cost: 100, anim: 'burst' },
  { id: 'gajra', name: 'Gajra', emoji: '🌼', cost: 250, anim: 'rain' },
  { id: 'diya', name: 'Festive Diya', emoji: '🪔', cost: 300, anim: 'rain', seasonal: true },
  { id: 'firework', name: 'Firework', emoji: '🎆', cost: 500, anim: 'rain' },
  { id: 'crown', name: 'Crown', emoji: '👑', cost: 1000, anim: 'royal' },
  { id: 'diamond', name: 'Diamond', emoji: '💎', cost: 2500, anim: 'royal' },
  { id: 'stagecall', name: 'Stage Call', emoji: '🎤', cost: 5000, anim: 'stage' },
  { id: 'haathi', name: 'Shahi Haathi', emoji: '🐘', cost: 10000, anim: 'stage', exclusive: true },
  { id: 'mahal', name: 'Sheesh Mahal', emoji: '🏰', cost: 25000, anim: 'stage', exclusive: true },
];
export const EXCLUSIVE_UNLOCK = 10000; // lifetime coins spent to unlock exclusive gifts

export const SONGS = [
  { id: 's1', title: 'Chaiyya Chaiyya', cat: 'Bollywood', price: 150 },
  { id: 's2', title: 'Kajra Re', cat: 'Bollywood', price: 200 },
  { id: 's3', title: 'Dola Re Dola', cat: 'Semi-classical', price: 250 },
  { id: 's4', title: 'Nagada Sang Dhol', cat: 'Garba', price: 200 },
  { id: 's5', title: 'Ghoomar', cat: 'Rajasthani', price: 180 },
  { id: 's6', title: 'Kun Faya Kun', cat: 'Sufi', price: 220 },
  { id: 's7', title: 'Apsara Aali', cat: 'Lavani', price: 220 },
  { id: 's8', title: 'Laung Laachi', cat: 'Punjabi', price: 160 },
];

// Must match the server's COIN_PACKS (ids are also the Google Play product ids).
export const COIN_PACKS = [
  { id: 'coins_100', coins: 100, price: 100, bonus: null },
  { id: 'coins_550', coins: 550, price: 500, bonus: '+10%' },
  { id: 'coins_1200', coins: 1200, price: 1000, bonus: '+20%' },
  { id: 'coins_6500', coins: 6500, price: 5000, bonus: '+30%' },
];
export const VIP = { id: 'vip_month', playSubscriptionId: 'vip_monthly', price: 999 };

/** Stable look (outfit colours, skin, dance variant) for the animated stage figure, from the dancer's id. */
export function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < String(id).length; i++) { h ^= String(id).charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
export function visualFor(id) {
  const h = hashId(id);
  return { outfit: OUTFITS[h % OUTFITS.length], accent: OUTFITS[(h >> 4) % OUTFITS.length], skin: SKINS[(h >> 8) % SKINS.length], variant: (h >> 12) % 4, gender: 'f', rating: 4.5 + ((h >> 16) % 5) / 10 };
}

export const DEFAULT_CONFIG = {
  minStage: 12, // BR-R4
  stageCap: 16, // visible stage slots
  maxRooms: 6, // BR-R5
  split: 50, // BR-R11, default dancer share %
  price5: 500,
  price15: 1300,
  ext: 500,
  shoutout: 100,
  firstBonus: 50, // BR-39
  vipRupees: 999,
  packageCoins: 2500, // BR-70: 5 x 5-min rooms, get 1 free
  packageRooms: 6,
};

export const FAN_LINES = [
  'Wah wah! 👏', 'Kya baat hai!', 'Encore! 🔁', 'Best stage tonight 🔥', 'Thumka on point 💃', 'Mashallah ✨',
  'Front row seat 😍', 'This beat 🥁', 'Balle balle 🕺', 'Jhoom barabar!', 'Who is top fan tonight?',
];
export const DANCER_LINES = [
  'Thank you all for being here 🙏', 'Who wants a song next? 🎶', 'Mehfil garam hai aaj! 🔥', 'Send a Rose if you are enjoying 🌹',
  'I see you in the chat 💕', 'Private room is open — book me 😊',
];
export const THANKS = [
  'Thank you {name} for the {g}! 💕', 'Shukriya {name} for the {g} 🙏', '{name}, this step is for you 💃 Thanks for the {g}!',
  '{g} from {name} — dil khush ho gaya! ✨',
];
export const GREETS = ['Welcome back {name}! Missed you 💕', '{name} is here! Hi jaan 🌸', 'Look who is back — {name}! ✨'];
export const PRIVATE_LINES = [
  'So happy you came, {name} 🌸', 'Any song you want me to dance to?', 'Thank you for the support 🙏',
  'This step is my favourite — watch! 💃', 'You have great taste in music ✨', 'Shall I teach you a Kathak tukda?',
];

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const fmt = (n) => Math.round(n).toLocaleString('en-IN');
export const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);
export const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const minsLeft = (ms) => Math.max(1, Math.ceil(ms / 60000));
