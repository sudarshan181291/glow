// Minimal UI translations (BR-15). Regional languages fall back to English for now.
export const LANG_OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'mr', label: 'मराठी', fallback: true },
  { id: 'bn', label: 'বাংলা', fallback: true },
  { id: 'ta', label: 'தமிழ்', fallback: true },
  { id: 'te', label: 'తెలుగు', fallback: true },
];

const en = {
  stage: 'Stage', following: 'Following', leaders: 'Leaders', me: 'Me', wallet: 'Wallet',
  live: 'LIVE', available: 'Available', inPrivate: 'In private room', backIn: 'back in', min: 'min',
  book: 'Book private', follow: 'Follow', followingBtn: 'Following', gifts: 'Gifts', chat: 'Chat', about: 'About', songs: 'Songs',
  shoutout: 'Shout-out', search: 'Search dancers', all: 'All', availableOnly: 'Available', popular: 'Popular', newest: 'New',
  newHere: 'NEW', yourTop: 'Your top dancers', inRooms: 'In private rooms now', liveCount: 'live on stage',
  enter: 'Enter the stage', chooseLang: 'Choose your language', send: 'Send', saySomething: 'Say something…',
  recharge: 'Recharge', topFans: 'Top fans', specialties: 'Specialties', languages: 'Languages', share: 'Share',
  invite: 'Invite friends', history: 'Private room history', notifications: 'Notifications', noNotifs: 'No notifications yet',
  topSpenders: 'Top spenders', topDancers: 'Top dancers', freeNow: 'Free now', onBreak: 'On break', offShift: 'Off shift',
  upNext: 'Up next', nobodyFollowed: 'Follow a dancer to see when she is live.', similar: 'Explore similar dancers',
  coins: 'coins', close: 'Close', confirm: 'Confirm', cancel: 'Cancel',
};

const hi = {
  stage: 'स्टेज', following: 'फ़ॉलोइंग', leaders: 'लीडर्स', me: 'मैं', wallet: 'वॉलेट',
  live: 'लाइव', available: 'उपलब्ध', inPrivate: 'प्राइवेट रूम में', backIn: 'वापसी', min: 'मिनट',
  book: 'प्राइवेट बुक करें', follow: 'फ़ॉलो', followingBtn: 'फ़ॉलो किया', gifts: 'गिफ़्ट', chat: 'चैट', about: 'परिचय', songs: 'गाने',
  shoutout: 'शाउट-आउट', search: 'डांसर खोजें', all: 'सभी', availableOnly: 'उपलब्ध', popular: 'लोकप्रिय', newest: 'नए',
  newHere: 'नई', yourTop: 'आपकी पसंदीदा डांसर', inRooms: 'अभी प्राइवेट रूम में', liveCount: 'स्टेज पर लाइव',
  enter: 'स्टेज पर चलें', chooseLang: 'अपनी भाषा चुनें', send: 'भेजें', saySomething: 'कुछ कहिए…',
  recharge: 'रिचार्ज', topFans: 'टॉप फ़ैन', specialties: 'खासियत', languages: 'भाषाएँ', share: 'शेयर',
  invite: 'दोस्तों को बुलाएँ', history: 'प्राइवेट रूम इतिहास', notifications: 'सूचनाएँ', noNotifs: 'अभी कोई सूचना नहीं',
  topSpenders: 'टॉप स्पेंडर', topDancers: 'टॉप डांसर', freeNow: 'अब फ्री', onBreak: 'ब्रेक पर', offShift: 'शिफ़्ट ख़त्म',
  upNext: 'अगली', nobodyFollowed: 'किसी डांसर को फ़ॉलो करें — लाइव होने पर पता चलेगा।', similar: 'मिलती-जुलती डांसर देखें',
  coins: 'कॉइन', close: 'बंद करें', confirm: 'पक्का करें', cancel: 'रद्द करें',
};

export function t(lang, key) {
  const dict = lang === 'hi' ? hi : en;
  return dict[key] ?? en[key] ?? key;
}
