// Static catalogue for Mehfil Live · Studio Royale

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
};

const OUTFITS = ['#ff6b9d', '#d4af37', '#9b5de5', '#00bbf9', '#f15bb5', '#00f5d4', '#fee440', '#ff8fab', '#c77dff', '#ff9e00'];
const SKINS = ['#e0ac69', '#c68642', '#f1c27d', '#8d5524', '#ffdbac'];
const STYLES = ['Kathak', 'Bollywood', 'Bhangra', 'Sufi', 'Garba', 'Thumka', 'Ghoomar', 'Semi-Classical'];

const NAMES = [
  ['Noor', 'f'], ['Zara', 'f'], ['Meher', 'f'], ['Kabir', 'm'], ['Sitara', 'f'],
  ['Anaya', 'f'], ['Kiran', 'f'], ['Arjun', 'm'], ['Simran', 'f'], ['Heer', 'f'],
  ['Laila', 'f'], ['Tara', 'f'], ['Veer', 'm'], ['Sana', 'f'], ['Ishita', 'f'],
  ['Kavya', 'f'], ['Rehan', 'm'], ['Naina', 'f'], ['Roshni', 'f'], ['Jasleen', 'f'],
];

// Simple seeded random so each studio has a stable line-up
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function makePerformers(seed = 1) {
  const r = rng(seed * 7919);
  const names = [...NAMES].sort(() => r() - 0.5);
  return names.map(([name, g], i) => ({
    id: i,
    name,
    gender: g,
    style: STYLES[Math.floor(r() * STYLES.length)],
    outfit: OUTFITS[Math.floor(r() * OUTFITS.length)],
    accent: OUTFITS[Math.floor(r() * OUTFITS.length)],
    skin: SKINS[Math.floor(r() * SKINS.length)],
    variant: i % 4,
    coins: Math.floor(200 + r() * 2800),
    gifts: Math.floor(r() * 30),
  }));
}

export const STUDIOS = [
  { id: 1, name: 'Studio Royale', theme: 'Bollywood · Mehfil', viewers: 2480, tag: 'FLAGSHIP' },
  { id: 2, name: 'Sufi Nights', theme: 'Sufi · Qawwali dance', viewers: 1310, tag: 'TRENDING' },
  { id: 3, name: 'Punjabi Dhamaka', theme: 'Bhangra · Giddha', viewers: 1875, tag: 'HOT' },
  { id: 4, name: 'Rajwada Darbar', theme: 'Ghoomar · Kathak', viewers: 920, tag: 'NEW' },
];

// 9 gift tiers
export const GIFTS = [
  { id: 'rose', name: 'Rose', emoji: '🌹', cost: 10, anim: 'float' },
  { id: 'heart', name: 'Heart', emoji: '💖', cost: 25, anim: 'float' },
  { id: 'chai', name: 'Chai', emoji: '☕', cost: 50, anim: 'float' },
  { id: 'jhumka', name: 'Jhumka', emoji: '💫', cost: 100, anim: 'burst' },
  { id: 'gajra', name: 'Gajra', emoji: '🌼', cost: 250, anim: 'rain' },
  { id: 'firework', name: 'Firework', emoji: '🎆', cost: 500, anim: 'rain' },
  { id: 'crown', name: 'Crown', emoji: '👑', cost: 1000, anim: 'royal' },
  { id: 'diamond', name: 'Diamond', emoji: '💎', cost: 2500, anim: 'royal' },
  { id: 'stagecall', name: 'Stage Call', emoji: '🎤', cost: 5000, anim: 'stage' },
];

export const SONGS = [
  { id: 's1', title: 'Chaiyya Chaiyya', cat: 'Bollywood', price: 150 },
  { id: 's2', title: 'Kajra Re', cat: 'Bollywood', price: 200 },
  { id: 's3', title: 'Dola Re Dola', cat: 'Semi-Classical', price: 250 },
  { id: 's4', title: 'Nagada Sang Dhol', cat: 'Garba', price: 200 },
  { id: 's5', title: 'Ghoomar', cat: 'Rajasthani', price: 180 },
  { id: 's6', title: 'Kun Faya Kun', cat: 'Sufi', price: 220 },
  { id: 's7', title: 'Dama Dam Mast Qalandar', cat: 'Sufi', price: 300 },
  { id: 's8', title: 'Laung Laachi', cat: 'Punjabi', price: 160 },
  { id: 's9', title: 'Mohe Rang Do Laal', cat: 'Classical', price: 280 },
  { id: 's10', title: 'Sheila Ki Jawani', cat: 'Item Number', price: 350 },
];

export const COIN_PACKS = [
  { coins: 100, price: 100, bonus: null },
  { coins: 550, price: 500, bonus: '+10%' },
  { coins: 1200, price: 1000, bonus: '+20%' },
  { coins: 6500, price: 5000, bonus: '+30%' },
];

export const CAMERAS = [
  { id: 'wide', label: 'Wide', icon: '🎥', cost: 0 },
  { id: 'close', label: 'Close-Up', icon: '🔍', cost: 50 },
  { id: 'side', label: 'Side', icon: '↔️', cost: 30 },
  { id: 'top', label: 'Top', icon: '⬇️', cost: 40 },
  { id: 'backstage', label: 'Backstage', icon: '🎭', cost: 100 },
];

export const ACCESS_MS = 5 * 60 * 1000; // paid camera access lasts 5 minutes

export const PRICES = {
  shoutout: 100,
  private5: 500,
  private15: 1300,
  vipRupees: 999,
  songBidStep: 50,
};

export const FAN_NAMES = [
  'RajaSahab', 'DilSeDesi', 'Mastani_22', 'ChaiLover', 'NawabOfDelhi', 'Pinky_P', 'BollyBuff',
  'SufiSoul', 'Dhillon_J', 'Mumbai_Meri', 'GoldenEra', 'Rangeela', 'ShayarDil', 'Lucknowi',
  'Jaan_e_Mehfil', 'TheWhale👑', 'KathakFan', 'Desi_Dhamaal',
];

export const FAN_LINES = [
  'Wah wah! 👏', 'Kya baat hai!', 'Encore! 🔁', 'Best mehfil tonight 🔥', 'Thumka on point 💃',
  'Who is winning tonight?', 'Play Kajra Re next!', 'Mashallah ✨', 'Studio Royale never disappoints',
  'Group dance please!', 'Balle balle 🕺', 'Front row seat 😍', 'This beat 🥁', 'Jhoom barabar!',
];

export const THANKS = [
  'Thank you for the {g}! 💕', 'Shukriya for the {g} 🙏', 'Aww, a {g}! This one is for you 💃',
  '{g} received — dil khush ho gaya! ✨', 'Thank you jaan-e-mehfil for the {g} 🌸',
];

export const PRIVATE_LINES = [
  'Welcome to my private room! 🌸', 'Any song you want me to dance to?', 'Thank you for the support 🙏',
  'This step is my favourite — watch! 💃', 'You have great taste in music ✨', 'Shall I teach you a Kathak tukda?',
];

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const fmt = (n) => Math.round(n).toLocaleString('en-IN');
