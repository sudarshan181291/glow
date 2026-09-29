// Sample data for the prototype. Everything lives in memory.

export const ME_DEFAULT = {
  id: 'me',
  name: 'Priya Sharma',
  handle: '@priya.glows',
  city: 'Mumbai',
  c: ['#fa3d6c', '#a24bcf'],
  bio: 'Chai-powered product designer. Sunset walks, indie playlists and terrible puns.',
  followers: 2840,
  following: 410,
  matches: 57,
};

export const USERS = {
  riley:  { name: 'Riley',  age: 24, city: 'Lisbon',  km: 3,  c: ['#ff8a9e', '#ca3c7c'], cat: 'Music',  online: true,  followers: 12400, following: 318, bio: 'Sunset chaser and late-night DJ. Deep house, vinyl, too many plants.' },
  casey:  { name: 'Casey',  age: 26, city: 'Toronto', km: 5,  c: ['#7cc4ff', '#6a5cff'], cat: 'Chat',   online: true,  followers: 3180,  following: 540, bio: 'Barista by day, podcast host by night. Ask me about my cat, Mochi.' },
  dana:   { name: 'Dana',   age: 23, city: 'Seoul',   km: 8,  c: ['#ffc46b', '#fa3d6c'], cat: 'Dance',  online: false, followers: 8920,  following: 201, bio: 'K-pop choreo every Friday. I teach the hard parts slowly.' },
  alex:   { name: 'Alex',   age: 27, city: 'Berlin',  km: 12, c: ['#5ee7c1', '#2f80ed'], cat: 'Gaming', online: false, followers: 5610,  following: 390, bio: 'Strategy games, techno and long bike rides along the canal.' },
  maya:   { name: 'Maya',   age: 22, city: 'Goa',     km: 2,  c: ['#ffd36e', '#ff7a59'], cat: 'Chat',   online: true,  followers: 2150,  following: 612, bio: 'Surf mornings, café afternoons. New here, be nice!' },
  jordan: { name: 'Jordan', age: 25, city: 'Austin',  km: 6,  c: ['#b18cff', '#6a3fd1'], cat: 'Music',  online: true,  followers: 4470,  following: 280, bio: 'Guitarist in a band nobody has heard of yet. Playlist curator.' },
  taylor: { name: 'Taylor', age: 28, city: 'Madrid',  km: 9,  c: ['#ff9ad5', '#a24bcf'], cat: 'Dance',  online: false, followers: 6730,  following: 150, bio: 'Salsa teacher. Two left feet are very welcome.' },
  sam:    { name: 'Sam',    age: 24, city: 'Tokyo',   km: 15, c: ['#6ee7f0', '#0d9488'], cat: 'Gaming', online: true,  followers: 9820,  following: 95,  bio: 'Speedrunner. Currently losing to one very specific boss.' },
  lena:   { name: 'Lena',   age: 26, city: 'Vienna',  km: 4,  c: ['#ffb199', '#ca3c7c'], cat: 'Music',  online: true,  followers: 15300, following: 210, bio: 'Acoustic covers and original songs. Requests open every stream.' },
  marcus: { name: 'Marcus', age: 29, city: 'London',  km: 11, c: ['#8fd3f4', '#2b5bd7'], cat: 'Gaming', online: true,  followers: 22800, following: 120, bio: 'Ranked grinder. Chill vibes, zero toxicity.' },
  nina:   { name: 'Nina',   age: 23, city: 'Paris',   km: 7,  c: ['#f6a5ff', '#fa3d6c'], cat: 'Dance',  online: true,  followers: 11100, following: 330, bio: 'Contemporary dancer learning one new routine every week.' },
  oliver: { name: 'Oliver', age: 27, city: 'Sydney',  km: 20, c: ['#a3f7bf', '#16a34a'], cat: 'Chat',   online: false, followers: 4020,  following: 460, bio: 'Night owl hosting honest Q&As. Nothing is off limits (within reason).' },
};

export const LIVES = [
  { id: 'riley',  title: 'Sunset deep house set',            cat: 'Music',  viewers: 2431, likes: 18200 },
  { id: 'marcus', title: 'Ranked grind to Diamond',          cat: 'Gaming', viewers: 3120, likes: 21000 },
  { id: 'lena',   title: 'Acoustic covers, taking requests', cat: 'Music',  viewers: 1893, likes: 9400 },
  { id: 'nina',   title: 'Learn this choreo with me',        cat: 'Dance',  viewers: 1204, likes: 7600 },
  { id: 'oliver', title: 'Late-night Q&A, ask anything',     cat: 'Chat',   viewers: 876,  likes: 3100 },
  { id: 'sam',    title: 'Speedrun attempt #41',             cat: 'Gaming', viewers: 1567, likes: 8900 },
  { id: 'taylor', title: 'Salsa basics in 20 minutes',       cat: 'Dance',  viewers: 654,  likes: 2800 },
  { id: 'maya',   title: 'Coffee chat from the beach',       cat: 'Chat',   viewers: 432,  likes: 1900 },
];
export const liveOf = id => LIVES.find(l => l.id === id);

export const MATCHES = [
  { id: 'riley',  badge: 'New',    msg: 'started a live video', time: '2m',  kind: 'hot',    icon: 'tower-broadcast' },
  { id: 'casey',  badge: 'Online', msg: "Hey, how's your day?", time: '8m' },
  { id: 'dana',   badge: 'Super',  msg: 'sent you a gift',      time: '21m', kind: 'hot',    icon: 'gift' },
  { id: 'alex',   badge: null,     msg: 'missed video call',    time: '1h',  kind: 'missed', icon: 'phone-slash' },
  { id: 'maya',   badge: 'New',    msg: 'You matched!',         time: '3h',  kind: 'hot',    icon: 'heart' },
  { id: 'jordan', badge: 'Online', msg: 'shared a playlist',    time: '5h',  icon: 'music' },
  { id: 'taylor', badge: 'Super',  msg: 'liked your photo',     time: 'Yesterday', icon: 'heart' },
];

export const STORY_ORDER = ['riley', 'casey', 'dana', 'alex', 'maya', 'jordan'];
export const STORIES = {
  riley:  [{ e: '🌅', t: 'Golden hour from the rooftop. Set starts at 9', time: '2h' }, { e: '🎧', t: 'New vinyl haul, three records I can’t stop playing', time: '1h' }],
  casey:  [{ e: '☕', t: 'Latte art attempt #27. Getting there', time: '4h' }, { e: '🐱', t: 'Mochi has claimed the podcast mic', time: '3h' }, { e: '🎙️', t: 'New episode drops tomorrow', time: '1h' }],
  dana:   [{ e: '💃', t: 'Friday choreo preview. Can you guess the song?', time: '5h' }, { e: '✨', t: 'Studio mirror selfie, obviously', time: '2h' }],
  alex:   [{ e: '🚲', t: '42 km along the canal this morning', time: '6h' }],
  maya:   [{ e: '🏄‍♀️', t: 'Caught my first clean wave!!', time: '7h' }, { e: '🥥', t: 'Post-surf coconut, the only correct choice', time: '6h' }],
  jordan: [{ e: '🎸', t: 'Writing something new. Chorus is almost there', time: '8h' }, { e: '🌃', t: 'Late Night Drive playlist is live', time: '5h' }],
};
export const MY_STORY = [{ e: '🌇', t: 'Sunset chai at Bandra Bandstand', time: 'now' }];

export const CHAT_ORDER = ['casey', 'riley', 'dana', 'sam', 'jordan', 'alex'];
export const CHATS = {
  casey:  { unread: 2, time: '8m',  msgs: [['them', 'Saw your story from the beach, where was that?'], ['me', 'Juhu! Went for sunset chai'], ['them', 'Okay I am officially jealous'], ['them', "Hey, how's your day?"]] },
  riley:  { unread: 1, time: '2m',  msgs: [['them', 'Going live in 5, come hang?'], ['event', 'Riley started a live video']] },
  dana:   { unread: 2, time: '21m', msgs: [['me', 'Your choreo stream was so good'], ['them', 'Thank you!! Took me three days to learn'], ['event', 'Dana sent you a gift: Teddy 🧸']] },
  sam:    { unread: 1, time: '1d',  msgs: [['them', 'Finally beat the boss. 41 attempts.'], ['them', 'You owe me a celebratory coffee']] },
  jordan: { unread: 0, time: '5h',  msgs: [['them', 'Made this for your commute'], ['event', 'Jordan shared a playlist: Late Night Drive'], ['me', 'Adding it now, thank you!']] },
  alex:   { unread: 0, time: '1h',  msgs: [['me', 'Call you after my meeting?'], ['event', 'Missed video call from Alex']] },
};

export const REPLIES = ['Haha I love that', 'No way, tell me more!', 'Same here 😄', 'Wanna hop on a video call later?', 'That is so cool', 'Okay you’re actually funny', 'Sending good vibes your way ✨', 'Wait, really? 😂'];
export const LIVE_COMMENTS = ['this is so good 🔥', 'hi from Brazil!!', 'play the one from last week', 'your vibe is unmatched', 'first time here, instant follow', '❤️❤️❤️', 'how are you so good at this', 'can you say hi to me?', 'the lighting today 😍', 'sending a rose 🌹', 'who else is watching from bed', 'LET’S GO'];
export const SELF_COMMENTS = ['hiii Priya!', 'love the vibe', 'where are you streaming from?', 'first!', '👋👋'];

export const CATS = [
  { key: 'trending', name: 'Trending',  icon: 'fire',          cc: '#fa3d6c', cbg: '#ffe3ea', meta: '2.1K live now',    desc: 'The streams getting the most hearts in the last hour.', users: ['marcus', 'riley', 'lena', 'nina', 'sam'] },
  { key: 'nearby',   name: 'Nearby',    icon: 'location-dot',  cc: '#a24bcf', cbg: '#f1e4fb', meta: '38 within 10 km',  desc: 'People close to you who are online right now.',         users: ['maya', 'riley', 'lena', 'casey', 'jordan', 'nina'] },
  { key: 'new',      name: 'New Faces', icon: 'user-plus',     cc: '#3b82f6', cbg: '#e2edff', meta: '412 joined today', desc: 'Say hi to people who joined Glow this week.',            users: ['maya', 'oliver', 'taylor', 'dana'] },
  { key: 'popular',  name: 'Popular',   icon: 'crown',         cc: '#16a34a', cbg: '#dcf5e4', meta: 'Top 100 creators', desc: 'The most-followed creators this month.',                 users: ['marcus', 'lena', 'riley', 'nina', 'sam'] },
  { key: 'music',    name: 'Music',     icon: 'music',         cc: '#f97316', cbg: '#ffeddc', meta: '640 live sets',    desc: 'DJ sets, acoustic covers and original songs.',          users: ['riley', 'lena', 'jordan'] },
  { key: 'gaming',   name: 'Gaming',    icon: 'gamepad',       cc: '#0d9488', cbg: '#d6f3ef', meta: '1.3K streams',     desc: 'Ranked grinds, speedruns and chill co-op sessions.',    users: ['marcus', 'sam', 'alex'] },
];

export const NOTIFS = [
  { id: 'riley',  icon: 'tower-broadcast', nc: '#fa3d6c', who: 'Riley',  text: ' started a live video: Sunset deep house set', time: '2m',  act: 'live' },
  { id: 'dana',   icon: 'gift',            nc: '#f97316', who: 'Dana',   text: ' sent you a gift: Teddy 🧸',                  time: '21m', act: 'chat' },
  { id: 'maya',   icon: 'heart',           nc: '#ca3c7c', pre: 'You matched with ', who: 'Maya', text: '. Say hi!',          time: '3h',  act: 'chat' },
  { id: 'jordan', icon: 'music',           nc: '#a24bcf', who: 'Jordan', text: ' shared a playlist: Late Night Drive',      time: '5h',  act: 'chat' },
  { id: 'lena',   icon: 'user-plus',       nc: '#3b82f6', who: 'Lena',   text: ' started following you',                     time: '8h',  act: 'profile' },
  { id: 'alex',   icon: 'phone-slash',     nc: '#85769a', pre: 'Missed video call from ', who: 'Alex', text: '',            time: '1d',  act: 'call' },
  { id: 'marcus', icon: 'at',              nc: '#16a34a', who: 'Marcus', text: ' mentioned you in his live',                  time: '1d',  act: 'live' },
];

export const GIFTS = [{ e: '🌹', n: 'Rose', p: 5 }, { e: '💖', n: 'Heart', p: 10 }, { e: '🧸', n: 'Teddy', p: 25 }, { e: '💎', n: 'Diamond', p: 50 }, { e: '🚀', n: 'Rocket', p: 100 }, { e: '👑', n: 'Crown', p: 250 }];
export const PACKS = [{ c: 100, p: '₹89' }, { c: 550, p: '₹449', b: '+10% bonus' }, { c: 1200, p: '₹899', b: '+20% bonus' }, { c: 3000, p: '₹1,999', b: 'Best value' }];

export const SET_LABELS = {
  liveAlerts: ['Live alerts', 'When people you follow go live'],
  newMatches: ['New matches', 'When someone matches with you'],
  messages: ['Messages', 'New messages and replies'],
  gifts: ['Gifts', 'When someone sends you a gift'],
  onlineStatus: ['Show online status', 'Let people see when you’re active'],
  privateAcct: ['Private account', 'Only approved followers see your posts'],
  showDistance: ['Show distance', 'Show how far away you are in Nearby'],
  readReceipts: ['Read receipts', 'Let people know you’ve read their messages'],
  dataSaver: ['Data saver', 'Lower video quality on mobile data'],
  autoplay: ['Autoplay lives', 'Start previews as you scroll'],
  sounds: ['In-app sounds', 'Tones for messages and gifts'],
};

export const FAQS = [
  ['How do coins and gifts work?', 'Buy coins in your wallet, then tap the gift button during any live stream or chat. Streamers receive hearts equal to the gift value.'],
  ['How do I go live?', 'Open the Live tab and tap “Go live”. Add a title, pick a category and start streaming.'],
  ['Someone is bothering me. What can I do?', 'Open their profile and tap “Report or block”. Blocked people can’t message you, see your lives or find you in search.'],
  ['Why can’t I see someone’s distance?', 'They may have turned off “Show distance” in their privacy settings.'],
];

// helpers
export const fmt = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n));
export const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const nowTime = () => {
  const d = new Date();
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
};
