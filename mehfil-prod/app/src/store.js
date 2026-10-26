// App state driven by the server: REST for actions, WebSocket for live events.
// Keeps the same shape the screens were built against (S + act).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { produce } from 'immer';
import { C, visualFor } from './data';
import {
  ApiError, api, guestLogin, idemKey, logout, requestOtp, restoreSession, session, verifyOtp,
} from './api';
import { connectRealtime } from './realtime';
import { buyProduct } from './payments';
import { registerPush } from './push';

let _id = 0;
export const nid = () => `${Date.now().toString(36)}${++_id}`;
const ms = (v) => (v ? new Date(v).getTime() : null);
const COLORS = { gold: C.gold, rose: C.rose, red: C.red, blue: C.blue };

function initState() {
  return {
    booting: true, screen: 'gate', lang: 'en', role: 'customer', connected: 'offline',
    config: { minStage: 12, stageCap: 16, maxRooms: 6, price5: 500, price15: 1300, ext: 500, shoutout: 100, firstBonus: 50, packageCoins: 2500, packageRooms: 6, exclusiveUnlock: 10000, vipGiftDiscountPct: 20 },
    roster: [], rooms: [], stageChat: [], chats: {}, gifts: [], songList: [], details: {},
    user: { registered: false, id: null, name: '', role: 'customer', coins: 0, credits: 0, vipUntil: 0, follows: [], spent: {}, total: 0, history: [], txns: [], bonusUsed: false, topFanOf: [] },
    notifs: [], unread: 0, liveNotif: null,
    request: null, myRoom: null, myRoomId: null, rateSheet: null, mySongs: [],
    spotlight: null, floaters: [], banners: [], toast: null,
    showRegister: false, walletOpen: false, watching: null, leftPrompt: null, pendingAction: null, pendingLink: null,
    incoming: [], dancerMe: null, selfId: null, selfCamera: false,
    now: Date.now(), clockSkew: 0,
  };
}

function decorate(d) { return { ...visualFor(d.id), ...d, since: ms(d.since), returnAt: ms(d.returnAt), fans: {} }; }
function mapRoom(r, myBookingId) {
  return { id: r.id, did: r.dancerId, endsAt: ms(r.endsAt), startAt: ms(r.startedAt), min: r.minutes, mine: r.mine || r.id === myBookingId };
}
function fly(d, did, emoji, anim) {
  const items = [];
  if (anim === 'float' || anim === 'burst' || anim === 'rain') items.push({ id: nid(), did, emoji, kind: anim === 'burst' ? 'burst' : 'float' });
  if (anim === 'rain' || anim === 'stage') for (let i = 0; i < 12; i++) items.push({ id: nid(), did, emoji: anim === 'stage' && i % 2 ? '⭐' : emoji, kind: 'rain', fx: Math.random(), delay: i * 90 });
  if (anim === 'royal' || anim === 'stage') items.push({ id: nid(), did, emoji, kind: 'royal' });
  d.floaters.push(...items);
  if (d.floaters.length > 40) d.floaters.splice(0, d.floaters.length - 40);
}
const pushChat = (list, m) => { if (!list.some((x) => x.id === m.id)) list.push(m); if (list.length > 80) list.shift(); };

export const isVip = (u, now = Date.now()) => (u.vipUntil || 0) > now;
export const topFanOf = (p) => p?.topFan ?? null;
export const exclusivesUnlocked = (u, cfg) => u.total >= (cfg?.exclusiveUnlock ?? 10000) || isVip(u);

export function useStudio() {
  const [S, setS] = useState(initState);
  const ref = useRef(S);
  ref.current = S;
  const up = useCallback((fn) => setS((s) => produce(s, (d) => { fn(d); })), []);
  const toast = useCallback((text) => up((d) => { d.toast = { id: nid(), text }; }), [up]);

  const fail = useCallback((e) => {
    if (e instanceof ApiError) {
      if (e.code === 'insufficient_coins') { up((d) => { d.walletOpen = true; d.toast = { id: nid(), text: e.message }; }); return; }
      if (e.status === 401) { up((d) => { d.showRegister = true; }); return; }
      toast(e.message);
    } else toast(e?.message || 'Something went wrong');
  }, [up, toast]);

  // ---------------------------------------------------------------- loading
  const loadMe = useCallback(async () => {
    if (session.guest) return;
    const me = await api('GET', '/me');
    const w = await api('GET', '/wallet');
    up((d) => {
      const u = me.user;
      d.user = {
        registered: true, id: u.id, name: u.displayName, role: u.role, coins: me.wallet.balance, credits: me.wallet.credits,
        vipUntil: ms(u.vipUntil) || 0, follows: me.follows, spent: me.spent, total: u.lifetimeSpent, bonusUsed: u.firstPurchaseDone, topFanOf: me.topFanOf,
        history: me.history.map((h) => ({ id: h.id, did: h.dancer_id, name: h.stage_name, min: h.minutes, at: ms(h.started_at), rating: null })),
        txns: w.entries.map((x) => ({ id: String(x.id), label: x.kind, delta: x.delta, at: ms(x.created_at) })),
      };
      if (u.lang) d.lang = u.lang;
      if (u.role === 'dancer') d.selfId = u.id;
      const ob = me.openBooking;
      if (ob && ob.status === 'active') { d.myRoom = { id: ob.id, did: ob.dancerId, endsAt: ms(ob.endsAt), min: ob.minutes }; d.myRoomId = ob.id; }
      else if (ob) d.request = { id: ob.id, did: ob.dancerId, min: ob.minutes, state: ob.status === 'waitlisted' ? 'waitlisted' : 'waiting' };
    });
  }, [up]);

  // ---------------------------------------------------------------- live events
  const onEvent = useCallback((evt) => {
    const { type, data } = evt;
    up((d) => {
      switch (type) {
        case 'snapshot': {
          d.config = { ...d.config, ...data.studio.config };
          d.roster = data.dancers.map(decorate);
          d.rooms = data.rooms.map((r) => mapRoom(r, d.myRoomId));
          d.stageChat = data.stageChat;
          d.gifts = data.gifts;
          d.songList = data.songs;
          d.clockSkew = new Date(data.serverTime).getTime() - Date.now();
          break;
        }
        case 'dancer': {
          const nd = decorate(data);
          const i = d.roster.findIndex((x) => x.id === data.id);
          const prev = i >= 0 ? d.roster[i] : null;
          if (i >= 0) d.roster[i] = { ...prev, ...nd, fans: prev.fans, topFan: prev.topFan }; else d.roster.push(nd);
          if (prev && prev.status === 'stage' && nd.status !== 'stage' && d.watching === nd.id && d.myRoom?.did !== nd.id && d.role === 'customer') d.leftPrompt = nd.id;
          break;
        }
        case 'rooms': d.rooms = data.map((r) => mapRoom(r, d.myRoomId)); break;
        case 'camera': { const x = d.roster.find((r) => r.id === data.dancerId); if (x) x.cameraLive = data.live; break; }
        case 'chat': {
          const m = { id: data.id, userId: data.userId, user: data.user, kind: data.userId && data.userId === d.user.id ? (data.kind === 'gift' ? 'mygift' : 'me') : data.kind, text: data.text, at: data.at };
          if (data.dancerId) pushChat(d.chats[data.dancerId] || (d.chats[data.dancerId] = []), m); else pushChat(d.stageChat, m);
          break;
        }
        case 'chat_hidden':
          d.stageChat = d.stageChat.filter((m) => m.id !== data.id);
          Object.keys(d.chats).forEach((k) => { d.chats[k] = d.chats[k].filter((m) => m.id !== data.id); });
          break;
        case 'gift': fly(d, data.dancerId, data.emoji, data.anim); break;
        case 'spotlight': d.spotlight = { did: data.dancerId, until: ms(data.until) }; break;
        case 'banner': d.banners.push({ id: nid(), text: data.text, color: COLORS[data.color] || C.gold }); if (d.banners.length > 4) d.banners.shift(); break;
        case 'toast': d.toast = { id: nid(), text: data.text }; break;
        case 'config': d.config = { ...d.config, ...data }; break;
        case 'notification': {
          const n = { id: nid(), text: data.text, did: data.dancerId, at: ms(data.at) };
          d.notifs.unshift(n); d.unread += 1; if (d.role === 'customer') d.liveNotif = n;
          break;
        }
        case 'incoming_request':
          if (!d.incoming.some((x) => x.id === data.id)) d.incoming.push({ id: data.id, customer: data.customer, customerId: data.customerId, min: data.minutes, cost: data.price, share: data.share, expiresAt: ms(data.decideBy) });
          break;
        case 'song_request': d.toast = { id: nid(), text: `🎶 ${data.from} requested "${data.title}"` }; break;
        case 'shoutout_request': d.toast = { id: nid(), text: `📣 Give a shout-out to ${data.from}!` }; break;
        case 'booking': {
          const b = data;
          const mineAsCustomer = b.customerId === d.user.id;
          if (b.dancerId === d.selfId && !mineAsCustomer) {
            if (b.status !== 'requested') d.incoming = d.incoming.filter((x) => x.id !== b.id);
            if (d.dancerMe) {
              d.dancerMe.room = b.status === 'active' ? { id: b.id, endsAt: ms(b.endsAt), customerId: b.customerId, customer: d.dancerMe.room?.customer ?? d.incoming.find((x) => x.id === b.id)?.customer } : (d.dancerMe.room?.id === b.id ? null : d.dancerMe.room);
            }
            if (b.status === 'ended') d.toast = { id: nid(), text: b.refund ? `Room ended — customer refunded ${b.refund} coins` : 'Room ended' };
            break;
          }
          if (!mineAsCustomer) break;
          if (b.status === 'requested') d.request = { id: b.id, did: b.dancerId, min: b.minutes, cost: b.price, credit: b.creditUsed, state: 'waiting', decideBy: ms(b.decideBy) };
          else if (b.status === 'waitlisted') d.request = { id: b.id, did: b.dancerId, min: b.minutes, cost: b.price, credit: b.creditUsed, state: 'waitlisted' };
          else if (['declined', 'expired'].includes(b.status)) { if (d.request?.id === b.id) { d.request.state = 'declined'; d.request.reason = b.status === 'expired' ? 'busy' : 'declined'; } }
          else if (b.status === 'cancelled') { if (d.request?.id === b.id) d.request = null; }
          else if (b.status === 'active') {
            d.request = null; d.myRoomId = b.id;
            d.myRoom = { id: b.id, did: b.dancerId, endsAt: ms(b.endsAt), startAt: ms(b.startedAt), min: b.minutes };
            d.rooms.forEach((r) => { if (r.id === b.id) r.mine = true; });
          } else if (b.status === 'ended' && d.myRoomId === b.id) {
            const firstEver = d.user.history.length === 0;
            d.myRoom = null; d.myRoomId = null;
            d.rateSheet = { did: b.dancerId, bookingId: b.id, reason: b.endReason, refund: b.refund, followPrompt: firstEver && !d.user.follows.includes(b.dancerId) };
            if (b.endReason === 'dancer' || b.endReason === 'disconnect') d.toast = { id: nid(), text: `She ended the room early — ${b.refund} coins refunded` };
            if (b.endReason === 'floor' || b.endReason === 'kill') d.toast = { id: nid(), text: `Room ended by the floor manager — ${b.refund} coins refunded` };
          }
          break;
        }
        default: break;
      }
    });
    if (type === 'wallet_changed' || (type === 'booking' && ['active', 'ended'].includes(data.status))) loadMe().catch(() => {});
  }, [up, loadMe]);

  // ---------------------------------------------------------------- lifecycle
  useEffect(() => {
    let stopRt = null;
    (async () => {
      try {
        const signedIn = await restoreSession();
        if (signedIn) { await loadMe(); registerPush().catch(() => {}); up((d) => { d.screen = 'main'; }); }
      } catch { /* offline: realtime will keep retrying */ }
      up((d) => { d.booting = false; });
      stopRt = connectRealtime(onEvent, (st) => up((d) => { d.connected = st; }));
    })();
    const t = setInterval(() => up((d) => { d.now = Date.now() + d.clockSkew; if (d.spotlight && d.now > d.spotlight.until) d.spotlight = null; d.incoming = d.incoming.filter((x) => !x.expiresAt || x.expiresAt > d.now); }), 1000);
    return () => { clearInterval(t); stopRt?.(); };
  }, []);

  // ---------------------------------------------------------------- actions
  const act = useMemo(() => {
    const gated = (type, args) => {
      if (!session.guest) return false;
      up((d) => { d.showRegister = true; d.pendingAction = { type, args }; });
      return true; // BR-10: sign-up only at the moment of spend
    };
    const run = (fn) => fn().catch(fail);
    const A = {
      passGate: (lang) => up((d) => { d.lang = lang; d.screen = 'main'; }),
      setLang: (lang) => { up((d) => { d.lang = lang; }); if (!session.guest) api('PATCH', '/me', { lang }).catch(() => {}); },
      setRole: (role) => up((d) => { d.role = role; d.watching = null; }),
      requestOtp: (phone) => requestOtp(phone),
      register: async (payload) => {
        const user = await verifyOtp(payload);
        await loadMe();
        registerPush().catch(() => {});
        up((d) => { d.showRegister = false; d.toast = { id: nid(), text: `Welcome, ${user.displayName}!` }; });
      },
      logout: () => run(async () => { await logout(); up((d) => { const s = initState(); Object.assign(d, { ...s, screen: 'main', booting: false, roster: d.roster, rooms: d.rooms, stageChat: d.stageChat, gifts: d.gifts, songList: d.songList, config: d.config }); }); }),
      cancelRegister: () => up((d) => { d.showRegister = false; d.pendingAction = null; }),
      clearPending: () => up((d) => { d.pendingAction = null; }),
      openWallet: () => up((d) => { d.walletOpen = true; }),
      openRegister: () => up((d) => { d.showRegister = true; }),
      closeWallet: () => up((d) => { d.walletOpen = false; }),
      refreshMe: () => loadMe().catch(() => {}),

      buyPack: (pack) => { if (gated('buyPack', [pack])) return; run(async () => { const r = await buyProduct(pack.id, 'inapp'); if (r?.ok) { await loadMe(); toast(`+${pack.coins} coins added`); } }); },
      buyVip: () => { if (gated('buyVip', [])) return; run(async () => { const r = await buyProduct('vip', 'subs'); if (r?.ok) { await loadMe(); toast('💎 You are VIP now'); } }); },
      cancelVip: () => toast('Manage or cancel VIP from Google Play → Subscriptions, or it ends at the period end'),
      buyPackage: () => { if (gated('buyPackage', [])) return; run(async () => { const r = await api('POST', '/packages', { idemKey: idemKey() }); toast(`${r.credits} room credits available`); await loadMe(); }); },

      watch: (did) => {
        up((d) => { d.watching = did; d.leftPrompt = null; });
        api('GET', `/dancers/${did}`).then((r) => up((d) => {
          d.details[did] = { topFans: r.topFans, history: r.history, following: r.following };
          d.chats[did] = r.chat.map((m) => ({ ...m, kind: m.userId && m.userId === d.user.id ? 'me' : m.kind }));
          const x = d.roster.find((p) => p.id === did);
          if (x) { x.topFan = r.topFans[0]?.name ?? null; x.fans = Object.fromEntries(r.topFans.map((f) => [f.name, f.coins])); }
        })).catch(() => {});
      },
      unwatch: () => up((d) => { d.watching = null; d.leftPrompt = null; }),
      dismissLeft: () => up((d) => { d.leftPrompt = null; }),
      follow: (did) => {
        if (gated('follow', [did])) return;
        const following = ref.current.user.follows.includes(did);
        up((d) => { d.user.follows = following ? d.user.follows.filter((x) => x !== did) : [...d.user.follows, did]; });
        run(async () => { await api('POST', `/dancers/${did}/follow`, { follow: !following }); toast(following ? 'Unfollowed' : "Following — we'll tell you when she's live"); });
      },
      sendGift: (did, gift) => {
        if (gated('sendGift', [did, gift])) return;
        run(async () => { const r = await api('POST', '/gifts', { dancerId: did, giftId: gift.id, idemKey: idemKey() }); up((d) => { d.user.coins = r.balance; }); });
      },
      shoutOut: (did) => {
        if (gated('shoutOut', [did])) return;
        run(async () => { const r = await api('POST', '/shoutouts', { dancerId: did, idemKey: idemKey() }); up((d) => { d.user.coins = r.balance; }); });
      },
      requestSong: (did, song) => {
        if (gated('requestSong', [did, song])) return;
        run(async () => {
          const r = await api('POST', '/songs/request', { dancerId: did, songId: song.id, idemKey: idemKey() });
          up((d) => { d.user.coins = r.balance; d.mySongs.push({ id: nid(), did, song, mine: true }); });
          toast(`Requested "${song.title}" — #${r.position} in her queue`);
        });
      },
      sendChat: (did, text) => { if (gated('sendChat', [did, text])) return; run(() => api('POST', '/chat', { dancerId: did, text })); },
      sendStageChat: (text) => { if (gated('sendStageChat', [text])) return; run(() => api('POST', '/chat', { dancerId: null, text })); },

      book: (did, min, useCredit = false) => {
        if (gated('book', [did, min, useCredit])) return;
        run(async () => {
          const b = await api('POST', '/bookings', { dancerId: did, minutes: min, useCredit });
          up((d) => { d.request = { id: b.id, did, min, cost: b.price, credit: useCredit, state: b.status === 'waitlisted' ? 'waitlisted' : 'waiting', decideBy: ms(b.decideBy) }; });
          if (b.status === 'waitlisted') toast('All rooms are busy — you are on the waitlist');
        });
      },
      cancelRequest: () => {
        const r = ref.current.request;
        up((d) => { d.request = null; });
        if (r && (r.state === 'waiting' || r.state === 'waitlisted')) api('POST', `/bookings/${r.id}/cancel`).catch(() => {});
      },
      leaveWaitlist: () => A.cancelRequest(),
      extendRoom: () => run(async () => { await api('POST', `/bookings/${ref.current.myRoomId}/extend`); toast('Extended by 5 minutes'); }),
      leaveRoom: () => run(() => api('POST', `/bookings/${ref.current.myRoomId}/end`)),
      reportRoom: (reason) => run(async () => { await api('POST', '/reports', { bookingId: ref.current.myRoomId ?? undefined, reason }); toast('Reported — a moderator will review within 15 minutes'); }),
      rate: (stars) => {
        const rs = ref.current.rateSheet;
        up((d) => { if (d.rateSheet) d.rateSheet.rated = stars; });
        if (rs?.bookingId) api('POST', `/bookings/${rs.bookingId}/rate`, { stars }).catch(() => {});
      },
      closeRate: () => up((d) => { d.rateSheet = null; }),
      removeFloater: (id) => up((d) => { d.floaters = d.floaters.filter((f) => f.id !== id); }),
      shiftBanner: () => up((d) => { d.banners.shift(); }),
      clearToast: (id) => up((d) => { if (!id || d.toast?.id === id) d.toast = null; }),
      clearLiveNotif: () => up((d) => { d.liveNotif = null; }),
      readNotifs: () => { up((d) => { d.unread = 0; }); if (!session.guest) api('POST', '/notifications/read').catch(() => {}); },
      deepLink: (url) => {
        const m = /dancer\/([0-9a-f-]{36})/i.exec(url);
        if (m) up((d) => { d.pendingLink = m[1]; });
      },
      consumeLink: () => { const id = ref.current.pendingLink; if (id) { up((d) => { d.pendingLink = null; }); A.watch(id); } },

      // ---------- dancer
      loadDancer: () => run(async () => {
        const r = await api('GET', '/dancer/me');
        up((d) => {
          const room = r.bookings.find((b) => b.status === 'active');
          d.dancerMe = { ...r, room: room ? { id: room.id, endsAt: ms(room.endsAt), customerId: room.customerId, customer: room.customer } : null };
          d.selfId = r.dancer.id;
          r.bookings.filter((b) => b.status === 'requested').forEach((b) => {
            if (!d.incoming.some((x) => x.id === b.id)) d.incoming.push({ id: b.id, customer: b.customer, customerId: b.customerId, min: b.minutes, cost: b.price, share: Math.floor((b.price * r.dancer.split) / 100), expiresAt: ms(b.decideBy) });
          });
        });
      }),
      setSelfAvailability: (mode) => run(async () => { await api('POST', '/dancer/availability', { mode }); await A.loadDancer(); }),
      acceptIncoming: (id) => run(async () => { await api('POST', `/dancer/bookings/${id}/accept`); up((d) => { d.incoming = d.incoming.filter((x) => x.id !== id); }); await A.loadDancer(); }),
      declineIncoming: (id) => run(async () => { await api('POST', `/dancer/bookings/${id}/decline`); up((d) => { d.incoming = d.incoming.filter((x) => x.id !== id); }); toast('Declined — no penalty'); }),
      endSelfRoom: () => { const room = ref.current.dancerMe?.room; if (room) run(async () => { await api('POST', `/bookings/${room.id}/end`); await A.loadDancer(); }); },
      messageFollowers: (text) => run(async () => { const r = await api('POST', '/dancer/message-followers', { text }); toast(`Sent to ${r.sent} followers`); }),
      blockCustomer: (customerId, block = true) => run(async () => { await api('POST', '/dancer/block', { customerId, block }); toast(block ? 'Blocked' : 'Unblocked'); await A.loadDancer(); }),
      setSelfCamera: (on) => up((d) => { d.selfCamera = on; }),
      toast,
    };
    return A;
  }, [up, fail, loadMe, toast]);

  // replay the action that triggered sign-up
  useEffect(() => {
    if (S.user.registered && S.pendingAction) {
      const { type, args } = S.pendingAction;
      act.clearPending();
      setTimeout(() => act[type](...args), 50);
    }
  }, [S.user.registered, S.pendingAction, act]);

  return [S, act];
}
