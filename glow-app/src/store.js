// App-wide state: user data, chats, modal stack and toasts.
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ME_DEFAULT, USERS, CHATS, CHAT_ORDER, MATCHES, REPLIES, pick, nowTime } from './data';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
export const U = (me, id) => (id === 'me' ? me : USERS[id]);

let modalSeq = 0;

export function AppProvider({ children }) {
  const [me, setMe] = useState(ME_DEFAULT);
  const [tab, setTab] = useState('home');
  const [following, setFollowing] = useState(new Set(['riley', 'casey', 'lena']));
  const [seen, setSeen] = useState(new Set());
  const [myStory, setMyStory] = useState(false);
  const [coins, setCoins] = useState(1250);
  const [notifsUnread, setNotifsUnread] = useState(true);
  const [favs, setFavs] = useState(new Set());
  const [liked, setLiked] = useState(new Set());
  const [recent, setRecent] = useState(['Riley', 'acoustic', 'Seoul']);
  const [settings, setSettings] = useState({ liveAlerts: true, newMatches: true, messages: true, gifts: false, onlineStatus: true, privateAcct: false, showDistance: true, readReceipts: true, dataSaver: false, autoplay: true, sounds: true });
  const [chats, setChats] = useState(CHATS);
  const [chatOrder, setChatOrder] = useState(CHAT_ORDER);
  const [typing, setTyping] = useState(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [modals, setModals] = useState([]);
  const [toastState, setToastState] = useState(null);
  const activeChat = useRef(null);

  /* ---------- toasts ---------- */
  const toast = useCallback((msg, icon = 'circle-check') => setToastState({ msg, icon, n: Date.now() }), []);

  /* ---------- modal stack ---------- */
  const open = useCallback((type, props = {}) => {
    const key = ++modalSeq;
    // Only one live, story, chat or call at a time: opening a new one replaces the old.
    const single = ['live', 'story', 'chat', 'call'].includes(type);
    setModals(m => [...m.map(x => (single && x.type === type ? { ...x, closing: true } : x)), { key, type, props, closing: false }]);
    return key;
  }, []);
  const close = useCallback(key => {
    setModals(m => {
      const target = key ?? [...m].reverse().find(x => !x.closing)?.key;
      return m.map(x => (x.key === target ? { ...x, closing: true } : x));
    });
  }, []);
  const remove = useCallback(key => setModals(m => m.filter(x => x.key !== key)), []);
  const closeAll = useCallback(() => setModals(m => m.map(x => ({ ...x, closing: true }))), []);
  const closeWhere = useCallback(fn => setModals(m => m.map(x => (fn(x) ? { ...x, closing: true } : x))), []);

  /* ---------- follows ---------- */
  const followingRef = useRef(following);
  followingRef.current = following;
  const toggleFollow = useCallback(id => {
    const had = followingRef.current.has(id);
    setFollowing(prev => {
      const next = new Set(prev);
      if (had) next.delete(id); else next.add(id);
      return next;
    });
    toast(had ? `Unfollowed ${USERS[id].name}` : `Following ${USERS[id].name} ✨`, had ? 'user-minus' : 'user-check');
  }, [toast]);

  /* ---------- chats ---------- */
  const ensureChat = useCallback(id => {
    setChats(prev => {
      if (prev[id]) return prev;
      const mm = MATCHES.find(x => x.id === id);
      const first = mm ? `${USERS[id].name} ${mm.msg === 'You matched!' ? 'matched with you' : mm.msg}` : `You and ${USERS[id].name} are now connected`;
      return { ...prev, [id]: { unread: 0, time: 'now', msgs: [['event', first]] } };
    });
    setChatOrder(o => (o.includes(id) ? o : [id, ...o]));
  }, []);

  const pushMsg = useCallback((id, who, text, stamp = true) => {
    setChats(prev => {
      const c = prev[id] || { unread: 0, time: 'now', msgs: [] };
      return { ...prev, [id]: { ...c, time: 'now', msgs: [...c.msgs, stamp ? [who, text, nowTime()] : [who, text]] } };
    });
    setChatOrder(o => [id, ...o.filter(x => x !== id)]);
  }, []);

  const scheduleReply = useCallback(id => {
    setTimeout(() => { if (activeChat.current?.id === id) setTyping(id); }, 700);
    setTimeout(() => {
      setTyping(null);
      const reading = activeChat.current?.id === id;
      if (!reading) toast(`${USERS[id].name} replied`, 'comment-dots');
      setChats(prev => {
        const c = prev[id];
        return { ...prev, [id]: { ...c, unread: reading ? 0 : c.unread + 1, msgs: [...c.msgs, ['them', pick(REPLIES), nowTime()]] } };
      });
    }, 2200);
  }, [toast]);

  const sendMessage = useCallback((id, text) => {
    ensureChat(id);
    pushMsg(id, 'me', text);
    scheduleReply(id);
  }, [ensureChat, pushMsg, scheduleReply]);

  const markRead = useCallback(id => {
    setChats(prev => (prev[id] && prev[id].unread ? { ...prev, [id]: { ...prev[id], unread: 0 } } : prev));
  }, []);
  const markAllRead = useCallback(() => {
    setChats(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, unread: 0 }])));
  }, []);

  const value = useMemo(() => ({
    me, setMe, tab, setTab, following, toggleFollow, seen, setSeen, myStory, setMyStory,
    coins, setCoins, notifsUnread, setNotifsUnread, favs, setFavs, liked, setLiked,
    recent, setRecent, settings, setSettings, chats, chatOrder, typing, activeChat,
    ensureChat, pushMsg, sendMessage, scheduleReply, markRead, markAllRead,
    loggedOut, setLoggedOut, modals, open, close, remove, closeAll, closeWhere,
    toastState, toast,
  }), [me, tab, following, toggleFollow, seen, myStory, coins, notifsUnread, favs, liked, recent, settings, chats, chatOrder, typing,
    ensureChat, pushMsg, sendMessage, scheduleReply, markRead, markAllRead, loggedOut, modals, open, close, remove, closeAll, closeWhere, toastState, toast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
