// Studio engine: state, movement engine (stage <-> private room), bookings, economy, simulation.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { produce } from 'immer';
import {
  C, DANCER_LINES, DEFAULT_CONFIG, EXCLUSIVE_UNLOCK, FAN_LINES, FAN_NAMES, GIFTS, GREETS, PRIVATE_LINES,
  SONGS, THANKS, fmt, makeRoster, pick, seedSpenders,
} from './data';

let _id = 0;
export const nid = () => `${Date.now().toString(36)}${++_id}`;

function initState() {
  const roster = makeRoster();
  return {
    screen: 'gate',
    role: 'customer',
    lang: 'en',
    config: { ...DEFAULT_CONFIG },
    roster,
    rooms: [],
    request: null, // my pending booking {did,min,cost,credit,state,decideAt,reason}
    waitlist: [],
    myRoomId: null,
    rateSheet: null,
    roomChat: [],
    user: {
      registered: false, name: '', phone: '', coins: 0, bonusUsed: false, vipUntil: 0,
      follows: [], spent: {}, total: 0, history: [], credits: 0, txns: [], invitedBy: null,
    },
    chats: {},
    notifs: [],
    unread: 0,
    liveNotif: null,
    events: [],
    spenders: seedSpenders(),
    songs: [],
    scheduled: [],
    watching: null,
    leftPrompt: null,
    spotlight: null,
    floaters: [],
    banners: [],
    toast: null,
    pendingAction: null,
    showRegister: false,
    walletOpen: false,
    selfId: roster.find((r) => r.name === 'Priya').id,
    selfBusy: false,
    incoming: [],
    selfMsgAt: 0,
    blocked: [],
    reports: [],
    stats: { gross: 0, dancerShare: 0, platform: 0, rooms: 0, gifts: 0, refunds: 0 },
    backfillAt: null,
    greeted: {},
    concierge: [],
    lastWatchStart: 0,
    sessionDone: false,
    pendingLink: null,
  };
}

// ---------------- helpers that work on an immer draft ----------------
const get = (d, id) => d.roster.find((x) => x.id === id);
const onStage = (d) => d.roster.filter((x) => x.status === 'stage');
const onBench = (d) => d.roster.filter((x) => x.status === 'bench').sort((a, b) => a.since - b.since);
export const isVip = (u, now = Date.now()) => u.vipUntil > now;
export const topFanOf = (dancer) => {
  let best = null;
  Object.entries(dancer.fans).forEach(([n, v]) => { if (!best || v > best[1]) best = [n, v]; });
  return best ? best[0] : null;
};
export const exclusivesUnlocked = (u) => u.total >= EXCLUSIVE_UNLOCK || isVip(u);

function toast(d, text) { d.toast = { id: nid(), text }; }
function banner(d, text, color = C.gold) { d.banners.push({ id: nid(), text, color }); if (d.banners.length > 4) d.banners.shift(); }
function chatPush(d, did, m) {
  const list = d.chats[did] || (d.chats[did] = []);
  list.push({ id: nid(), ...m });
  if (list.length > 60) list.shift();
}
function schedule(d, ms, item) { d.scheduled.push({ at: Date.now() + ms, ...item }); }
function fly(d, did, emoji, anim) {
  const items = [];
  if (anim === 'float' || anim === 'burst' || anim === 'rain') items.push({ id: nid(), did, emoji, kind: anim === 'burst' ? 'burst' : 'float' });
  if (anim === 'rain' || anim === 'stage') for (let i = 0; i < 12; i++) items.push({ id: nid(), did, emoji: anim === 'stage' && i % 2 ? '⭐' : emoji, kind: 'rain', fx: Math.random(), delay: i * 90 });
  if (anim === 'royal' || anim === 'stage') items.push({ id: nid(), did, emoji, kind: 'royal' });
  d.floaters.push(...items);
  if (d.floaters.length > 40) d.floaters.splice(0, d.floaters.length - 40);
}
function notifyFollowers(d, dancer, text) {
  if (!d.user.follows.includes(dancer.id)) return;
  const n = { id: nid(), text, did: dancer.id, at: Date.now() };
  d.notifs.unshift(n);
  if (d.notifs.length > 50) d.notifs.pop();
  d.unread += 1;
  if (d.role === 'customer') d.liveNotif = n;
}
function spend(d, cost, label) {
  if (d.user.coins < cost) {
    toast(d, `Not enough coins — need ${fmt(cost)}`);
    d.walletOpen = true;
    return false;
  }
  d.user.coins -= cost;
  d.user.txns.unshift({ id: nid(), label, delta: -cost, at: Date.now() });
  return true;
}
function creditUser(d, amount, label) {
  d.user.coins += amount;
  d.user.txns.unshift({ id: nid(), label, delta: amount, at: Date.now() });
}
function creditDancer(d, dancer, amt, from, kind, mine) {
  dancer.coins += amt;
  dancer.fans[from] = (dancer.fans[from] || 0) + amt;
  const share = (amt * dancer.split) / 100;
  d.stats.gross += amt;
  d.stats.dancerShare += share;
  d.stats.platform += amt - share;
  d.events.unshift({ id: nid(), did: dancer.id, kind, amt, from, at: Date.now() });
  if (d.events.length > 400) d.events.pop();
  d.spenders[from] = (d.spenders[from] || 0) + amt;
  if (mine) {
    d.user.spent[dancer.id] = (d.user.spent[dancer.id] || 0) + amt;
    d.user.total += amt;
  }
}
function leaveStage(d, dancer, status, now, mine = false) {
  dancer.status = status;
  dancer.since = now;
  if (d.watching === dancer.id && !mine && d.role === 'customer') d.leftPrompt = dancer.id; // BR-27 / BR-R9
  // BR-R15: refund unplayed song requests for this dancer
  d.songs = d.songs.filter((s) => {
    if (s.did !== dancer.id) return true;
    if (s.mine) { creditUser(d, s.cost, `Refund: "${s.song.title}" not played`); toast(d, `"${s.song.title}" refunded — ${dancer.name} left the stage`); }
    return false;
  });
}
function returnToFloor(d, dancer, now) {
  const free = onStage(d).length < d.config.stageCap;
  dancer.status = free ? 'stage' : 'bench'; // BR-R7, BR-R8
  dancer.since = now;
  dancer.returnAt = null;
  if (free) {
    chatPush(d, dancer.id, { kind: 'system', text: `${dancer.name} is back on stage` });
    notifyFollowers(d, dancer, `${dancer.name} is free now — back on stage`);
  }
}
function startRoom(d, dancer, o, now) {
  const durMs = o.durMs || o.min * 60000;
  const room = {
    id: nid(), did: dancer.id, customer: o.customer, min: o.min, cost: o.cost, mine: !!o.mine, selfRoom: !!o.selfRoom,
    startAt: now, endsAt: now + durMs, earlyEndAt: o.mine && Math.random() < 0.08 ? now + durMs * (0.3 + Math.random() * 0.4) : null,
  };
  if (o.cost > 0) creditDancer(d, dancer, o.cost, o.customer, 'room', o.mine);
  leaveStage(d, dancer, 'private', now, !!o.mine); // BR-R1
  dancer.returnAt = room.endsAt;
  d.rooms.push(room);
  d.stats.rooms += 1;
  chatPush(d, dancer.id, { kind: 'system', text: `${dancer.name} left the stage for a private room with ${o.mine ? 'you' : o.customer}` });
  if (o.mine) {
    d.myRoomId = room.id;
    d.roomChat = [];
    schedule(d, 900, { type: 'room', text: pick(GREETS).replace('{name}', d.user.name) });
  }
  return room;
}
function endRoom(d, room, reason, now) {
  d.rooms = d.rooms.filter((r) => r.id !== room.id);
  const dancer = get(d, room.did);
  let refund = 0;
  if (['dancer', 'floor', 'kill'].includes(reason) && now < room.endsAt && room.cost > 0) {
    refund = Math.floor((room.cost * (room.endsAt - now)) / (room.endsAt - room.startAt)); // BR-49 pro-rata
    dancer.coins -= refund;
    d.stats.refunds += refund;
    d.stats.gross -= refund;
    d.stats.dancerShare -= (refund * dancer.split) / 100;
    d.stats.platform -= refund - (refund * dancer.split) / 100;
    d.events.unshift({ id: nid(), did: dancer.id, kind: 'refund', amt: -refund, from: room.customer, at: now });
    if (room.mine) creditUser(d, refund, `Pro-rata refund · ${dancer.name}`);
  }
  returnToFloor(d, dancer, now);
  if (room.mine) {
    d.myRoomId = null;
    d.user.history.unshift({ id: nid(), did: dancer.id, min: room.min, at: room.startAt, cost: room.cost, rating: null });
    const firstEver = d.user.history.length === 1;
    d.rateSheet = { did: dancer.id, reason, refund, followPrompt: firstEver && !d.user.follows.includes(dancer.id), histId: d.user.history[0].id };
    if (reason === 'dancer') toast(d, `${dancer.name} ended the room early — ${fmt(refund)} coins refunded`);
    if (reason === 'floor' || reason === 'kill') toast(d, `Room ended by the floor manager — ${fmt(refund)} coins refunded`);
  }
  if (room.selfRoom && d.role === 'dancer') toast(d, `Room with ${room.customer} ended`);
}
function canLeaveStage(d, dancer) {
  if (dancer.status !== 'stage') return true;
  return onStage(d).length - 1 >= d.config.minStage || onBench(d).length > 0; // BR-R4
}

// ---------------- the 1-second tick ----------------
function tick(d, now) {
  if (d.screen === 'gate') return;
  d.now = now;
  // scheduled chat lines
  const due = d.scheduled.filter((s) => s.at <= now);
  if (due.length) {
    d.scheduled = d.scheduled.filter((s) => s.at > now);
    due.forEach((s) => {
      if (s.type === 'chat') chatPush(d, s.did, s.msg);
      if (s.type === 'room' && d.myRoomId) d.roomChat.push({ id: nid(), from: 'her', text: s.text });
    });
  }
  // rooms ending
  [...d.rooms].forEach((r) => {
    if (r.earlyEndAt && now >= r.earlyEndAt) endRoom(d, r, 'dancer', now);
    else if (now >= r.endsAt) endRoom(d, r, 'time', now);
  });
  // my booking decision (BR-44)
  const rq = d.request;
  if (rq && rq.state === 'waiting' && now >= rq.decideAt) {
    const dn = get(d, rq.did);
    const avail = dn.status === 'stage' || dn.status === 'bench';
    const capOk = d.rooms.length < d.config.maxRooms;
    const minOk = canLeaveStage(d, dn);
    if (avail && capOk && minOk && Math.random() < 0.85) {
      let ok = true;
      if (rq.credit) d.user.credits -= 1;
      else ok = spend(d, rq.cost, `🔒 Private ${rq.min} min · ${dn.name}`);
      d.request = null;
      if (ok) startRoom(d, dn, { customer: d.user.name, min: rq.min, cost: rq.credit ? 0 : rq.cost, mine: true }, now);
    } else {
      rq.state = 'declined';
      rq.reason = !avail ? 'busy' : !capOk ? 'full' : !minOk ? 'minimum' : 'declined';
    }
  }
  // waitlist (priority fans first)
  if (!d.request && !d.myRoomId && d.waitlist.length && d.rooms.length < d.config.maxRooms) {
    const idx = d.waitlist.findIndex((w) => ['stage', 'bench'].includes(get(d, w.did).status));
    if (idx >= 0) {
      const w = d.waitlist.splice(idx, 1)[0];
      d.request = { ...w, state: 'waiting', decideAt: now + 1500 };
      toast(d, `A room opened — asking ${get(d, w.did).name}`);
    }
  }
  // bench backfill (BR-R2, < 5 s)
  const stageN = onStage(d).length;
  const bench = onBench(d);
  if (stageN < d.config.stageCap && bench.length) {
    if (!d.backfillAt) d.backfillAt = now + (stageN < d.config.minStage ? 600 : 1500 + Math.random() * 2000);
    if (now >= d.backfillAt) {
      const next = bench[0];
      next.status = 'stage';
      next.since = now;
      notifyFollowers(d, next, `${next.name} is live now`);
      d.backfillAt = null;
    }
  } else d.backfillAt = null;
  // song dedications
  d.songs = d.songs.filter((s) => {
    if (now < s.dueAt) return true;
    const dn = get(d, s.did);
    if (dn.status === 'stage') {
      chatPush(d, dn.id, { kind: 'system', text: `🎶 ${dn.name} is dancing to "${s.song.title}" — dedicated to ${s.user}` });
      if (s.mine) banner(d, `🎶 ${dn.name} dedicates "${s.song.title}" to you, ${s.user}!`, C.rose);
    } else if (s.mine) {
      creditUser(d, s.cost, `Refund: "${s.song.title}" not played`);
    }
    return false;
  });
  // dancer-app incoming requests expire
  d.incoming = d.incoming.filter((r) => r.expiresAt > now);
  if (d.spotlight && now > d.spotlight.until) d.spotlight = null;
  // dancers returning from break
  d.roster.forEach((x) => { if (x.status === 'break' && x.returnAt && now >= x.returnAt) { x.status = 'bench'; x.since = now; x.returnAt = null; } });
  // a "full session" = 5 minutes watching (BR-16 gate for notifications)
  if (!d.sessionDone && d.lastWatchStart && now - d.lastWatchStart > 300000) d.sessionDone = true;
}

// ---------------- simulated live activity every 4 s ----------------
function simulate(d, now) {
  if (d.screen === 'gate') return;
  const stage = onStage(d);
  if (!stage.length) return;
  const w = d.watching != null ? get(d, d.watching) : null;
  if (w && w.status === 'stage') {
    if (Math.random() < 0.75) chatPush(d, w.id, { kind: 'fan', user: pick(FAN_NAMES), text: pick(FAN_LINES) });
    if (Math.random() < 0.25) chatPush(d, w.id, { kind: 'dancer', user: w.name, text: pick(DANCER_LINES) });
  }
  if (Math.random() < 0.5) {
    const g = GIFTS[Math.min(Math.floor(Math.pow(Math.random(), 3) * 10), 9)];
    const dn = pick(stage);
    const fan = pick(FAN_NAMES);
    creditDancer(d, dn, g.cost, fan, 'gift', false);
    d.stats.gifts += 1;
    chatPush(d, dn.id, { kind: 'gift', user: fan, text: `sent ${g.emoji} ${g.name}` });
    if (d.watching === dn.id) {
      fly(d, dn.id, g.emoji, g.cost >= 1000 ? g.anim : 'float');
      schedule(d, 1100, { type: 'chat', did: dn.id, msg: { kind: 'dancer', user: dn.name, text: pick(THANKS).replace('{name}', fan).replace('{g}', g.name) } });
    }
    if (g.cost >= 1000) banner(d, `${g.emoji} ${fan} sent ${g.name} to ${dn.name}!`);
  }
  // other customers book private rooms
  if (d.rooms.length < d.config.maxRooms && Math.random() < 0.3) {
    const cands = stage.filter((x) => x.id !== d.request?.did && x.id !== d.selfId && canLeaveStage(d, x)); // Priya's requests come via the dancer app
    if (cands.length) {
      const dn = pick(cands);
      const min = Math.random() < 0.7 ? 5 : 15;
      startRoom(d, dn, { customer: pick(FAN_NAMES), min, cost: min === 5 ? d.config.price5 : d.config.price15, durMs: 60000 + Math.random() * 150000 }, now);
    }
  }
  // breaks and shifts
  if (Math.random() < 0.1 && stage.length > d.config.minStage + 1 && onBench(d).length > 1) {
    const dn = pick(stage.filter((x) => x.id !== d.watching && x.id !== d.selfId));
    if (dn) { leaveStage(d, dn, 'break', now); dn.returnAt = now + 60000 + Math.random() * 90000; }
  }
  if (Math.random() < 0.06) {
    const off = d.roster.filter((x) => x.status === 'off' && x.id !== d.selfId);
    if (off.length) { const dn = pick(off); dn.status = 'bench'; dn.since = now; }
  }
  // dancer app: customers request the dancer
  const self = get(d, d.selfId);
  if (d.role === 'dancer' && self.status === 'stage' && !d.selfBusy && !d.rooms.some((r) => r.did === self.id)
    && d.incoming.length < 2 && d.rooms.length < d.config.maxRooms && Math.random() < 0.4) {
    const customer = pick(FAN_NAMES.filter((f) => !d.blocked.includes(f)));
    const min = Math.random() < 0.7 ? 5 : 15;
    d.incoming.push({ id: nid(), customer, min, cost: min === 5 ? d.config.price5 : d.config.price15, expiresAt: now + 20000 });
  }
  // followed dancers sometimes message followers (BR-61, rate-limited)
  if (d.user.follows.length && Math.random() < 0.03) {
    const dn = get(d, pick(d.user.follows));
    if (dn) notifyFollowers(d, dn, `${dn.name}: ${pick(['Going live tonight at 9 💃', 'Thank you for following me 💕', 'New song in my list — request it! 🎶'])}`);
  }
}

// ---------------- hook ----------------
export function useStudio() {
  const [S, setS] = useState(initState);
  const ref = useRef(S);
  ref.current = S;
  const up = useCallback((fn) => setS((s) => produce(s, (d) => { fn(d, Date.now()); })), []);

  useEffect(() => {
    const a = setInterval(() => up(tick), 1000);
    const b = setInterval(() => up(simulate), 4000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [up]);

  const act = useMemo(() => {
    const gated = (type, args) => {
      if (ref.current.user.registered) return false;
      up((d) => { d.showRegister = true; d.pendingAction = { type, args }; });
      return true; // BR-10: registration only at the moment of spend
    };
    const A = {
      passGate: (lang) => up((d) => { d.lang = lang; d.screen = 'main'; }),
      setLang: (lang) => up((d) => { d.lang = lang; }),
      setRole: (role) => up((d) => { d.role = role; d.watching = null; }),
      register: (name, phone) => up((d) => {
        d.user.registered = true; d.user.name = name; d.user.phone = phone; d.showRegister = false;
        toast(d, `Welcome, ${name}!`);
      }),
      cancelRegister: () => up((d) => { d.showRegister = false; d.pendingAction = null; }),
      clearPending: () => up((d) => { d.pendingAction = null; }),
      openWallet: () => up((d) => { d.walletOpen = true; }),
      closeWallet: () => up((d) => { d.walletOpen = false; }),
      buyPack: (pack) => {
        if (gated('buyPack', [pack])) return;
        up((d) => {
          creditUser(d, pack.coins, `Recharge ₹${fmt(pack.price)}`);
          if (!d.user.bonusUsed) { d.user.bonusUsed = true; creditUser(d, d.config.firstBonus, 'First purchase bonus'); toast(d, `+${fmt(pack.coins)} coins, plus ${d.config.firstBonus} first-purchase bonus 🎉`); }
          else toast(d, `+${fmt(pack.coins)} coins added`);
        });
      },
      buyVip: () => {
        if (gated('buyVip', [])) return;
        up((d) => { d.user.vipUntil = Date.now() + 30 * 864e5; d.user.txns.unshift({ id: nid(), label: `💎 VIP (₹${d.config.vipRupees}/month)`, delta: 0, at: Date.now() }); banner(d, '💎 You are VIP — priority booking and 20% off gifts', C.gold); });
      },
      cancelVip: () => up((d) => { d.user.vipUntil = 0; toast(d, 'VIP cancelled'); }),
      buyPackage: () => {
        if (gated('buyPackage', [])) return;
        up((d) => { if (spend(d, d.config.packageCoins, `🎟 Room package (${d.config.packageRooms} × 5 min)`)) { d.user.credits += d.config.packageRooms; toast(d, `${d.config.packageRooms} private room credits added`); } });
      },
      watch: (did) => up((d) => {
        d.watching = did;
        d.leftPrompt = null;
        if (!d.lastWatchStart) d.lastWatchStart = Date.now();
        const dn = get(d, did);
        const returning = d.user.registered && ((d.user.spent[did] || 0) > 0 || d.user.history.some((h) => h.did === did));
        if (returning && !d.greeted[did] && dn.status === 'stage') {
          d.greeted[did] = true; // BR-57: she greets returning customers by name
          schedule(d, 1500, { type: 'chat', did, msg: { kind: 'dancer', user: dn.name, text: pick(GREETS).replace('{name}', d.user.name) } });
        }
      }),
      unwatch: () => up((d) => { d.watching = null; d.leftPrompt = null; }),
      dismissLeft: () => up((d) => { d.leftPrompt = null; }),
      follow: (did) => {
        if (gated('follow', [did])) return;
        up((d) => {
          const dn = get(d, did);
          const i = d.user.follows.indexOf(did);
          if (i >= 0) { d.user.follows.splice(i, 1); dn.followers -= 1; toast(d, `Unfollowed ${dn.name}`); }
          else { d.user.follows.push(did); dn.followers += 1; toast(d, `Following ${dn.name} — we'll tell you when she's live`); }
        });
      },
      sendGift: (did, gift) => {
        if (gated('sendGift', [did, gift])) return;
        up((d) => {
          const dn = get(d, did);
          if (dn.status !== 'stage') { toast(d, `${dn.name} is not on stage right now`); return; }
          if (gift.exclusive && !exclusivesUnlocked(d.user)) { toast(d, `Exclusive gifts unlock after ${fmt(EXCLUSIVE_UNLOCK)} coins spent`); return; }
          const cost = isVip(d.user) ? Math.ceil(gift.cost * 0.8) : gift.cost;
          if (!spend(d, cost, `${gift.emoji} ${gift.name} → ${dn.name}`)) return;
          creditDancer(d, dn, gift.cost, d.user.name, 'gift', true);
          d.stats.gifts += 1;
          chatPush(d, did, { kind: 'mygift', user: d.user.name, text: `sent ${gift.emoji} ${gift.name}` });
          fly(d, did, gift.emoji, gift.anim);
          if (gift.id === 'stagecall' || gift.exclusive) {
            d.spotlight = { did, until: Date.now() + 15000 }; // BR-37
            banner(d, `${gift.emoji} ${d.user.name} called ${dn.name} to centre stage!`, C.rose);
          } else if (gift.cost >= 1000) banner(d, `${gift.emoji} ${d.user.name} sent ${gift.name} to ${dn.name}!`);
          schedule(d, 1200, { type: 'chat', did, msg: { kind: 'dancer', user: dn.name, text: pick(THANKS).replace('{name}', d.user.name).replace('{g}', gift.name) } });
        });
      },
      shoutOut: (did) => {
        if (gated('shoutOut', [did])) return;
        up((d) => {
          const dn = get(d, did);
          if (dn.status !== 'stage') { toast(d, `${dn.name} is not on stage right now`); return; }
          if (!spend(d, d.config.shoutout, `📣 Shout-out from ${dn.name}`)) return;
          creditDancer(d, dn, d.config.shoutout, d.user.name, 'shoutout', true);
          banner(d, `📣 ${dn.name}: "Shout-out to ${d.user.name}! Thank you for being here 💕"`, C.rose);
          fly(d, did, '📣', 'burst');
        });
      },
      requestSong: (did, song) => {
        if (gated('requestSong', [did, song])) return;
        up((d) => {
          const dn = get(d, did);
          if (dn.status !== 'stage') { toast(d, `${dn.name} is not on stage right now`); return; }
          if (!spend(d, song.price, `🎶 "${song.title}" → ${dn.name}`)) return;
          creditDancer(d, dn, song.price, d.user.name, 'song', true);
          d.songs.push({ id: nid(), did, song, cost: song.price, user: d.user.name, mine: true, dueAt: Date.now() + 8000 + Math.random() * 6000 });
          toast(d, `Requested "${song.title}" — ${dn.name} will dedicate it to you`);
        });
      },
      sendChat: (did, text) => {
        if (gated('sendChat', [did, text])) return;
        up((d) => {
          const dn = get(d, did);
          chatPush(d, did, { kind: 'me', user: d.user.name, text });
          if (Math.random() < 0.6) schedule(d, 1500, { type: 'chat', did, msg: { kind: 'dancer', user: dn.name, text: `${d.user.name} ${pick(['thank you! 💕', 'aap ka swagat hai 🙏', 'stay with me tonight 💃', 'request a song? 🎶', '✨✨✨'])}` } });
        });
      },
      book: (did, min, useCredit = false) => {
        if (gated('book', [did, min, useCredit])) return;
        up((d) => {
          const dn = get(d, did);
          if (d.myRoomId || d.request) { toast(d, 'You already have a room or request in progress'); return; }
          if (dn.status === 'private') { toast(d, `${dn.name} is in a private room — back in ${Math.max(1, Math.ceil((dn.returnAt - Date.now()) / 60000))} min`); return; }
          if (dn.status === 'break' || dn.status === 'off') { toast(d, `${dn.name} is not available right now`); return; }
          const cost = useCredit ? 0 : min === 5 ? d.config.price5 : d.config.price15;
          if (!useCredit && d.user.coins < cost) { toast(d, `You need ${fmt(cost)} coins for this room`); d.walletOpen = true; return; }
          const priority = isVip(d.user) || topFanOf(dn) === d.user.name ? 1 : 0;
          if (d.rooms.length >= d.config.maxRooms) { // BR-53 cap, BR-66 priority
            d.waitlist.push({ id: nid(), did, min, cost, credit: useCredit, priority, at: Date.now() });
            d.waitlist.sort((a, b) => b.priority - a.priority || a.at - b.at);
            toast(d, `All ${d.config.maxRooms} rooms are busy — you are #${d.waitlist.findIndex((w) => w.did === did) + 1} on the waitlist${priority ? ' (priority)' : ''}`);
            return;
          }
          d.request = { did, min, cost, credit: useCredit, state: 'waiting', decideAt: Date.now() + 2000 + Math.random() * 2000 };
        });
      },
      cancelRequest: () => up((d) => { d.request = null; }),
      leaveWaitlist: () => up((d) => { d.waitlist = []; toast(d, 'Left the waitlist'); }),
      extendRoom: () => up((d) => {
        const r = d.rooms.find((x) => x.id === d.myRoomId);
        if (!r) return;
        if (!spend(d, d.config.ext, '🔒 Private room +5 min')) return;
        r.endsAt += 5 * 60000; r.cost += d.config.ext; r.min += 5;
        const dn = get(d, r.did); dn.returnAt = r.endsAt;
        creditDancer(d, dn, d.config.ext, d.user.name, 'room', true);
        toast(d, 'Extended by 5 minutes');
      }),
      leaveRoom: () => up((d, now) => { const r = d.rooms.find((x) => x.id === d.myRoomId); if (r) endRoom(d, r, 'user', now); }),
      roomSay: (text) => up((d) => {
        d.roomChat.push({ id: nid(), from: 'me', text });
        const r = d.rooms.find((x) => x.id === d.myRoomId);
        if (r) schedule(d, 1500, { type: 'room', text: pick(PRIVATE_LINES).replace('{name}', d.user.name) });
      }),
      reportRoom: (reason) => up((d) => {
        const r = d.rooms.find((x) => x.id === d.myRoomId);
        d.reports.unshift({ id: nid(), by: d.user.name, about: r ? get(d, r.did).name : 'stage', reason, at: Date.now(), open: true });
        toast(d, 'Reported — a moderator will review within 15 minutes');
      }),
      rate: (stars) => up((d) => {
        const h = d.user.history.find((x) => x.id === d.rateSheet?.histId);
        if (h) h.rating = stars;
        if (d.rateSheet) d.rateSheet.rated = stars;
      }),
      closeRate: () => up((d) => { d.rateSheet = null; }),
      removeFloater: (id) => up((d) => { d.floaters = d.floaters.filter((f) => f.id !== id); }),
      shiftBanner: () => up((d) => { d.banners.shift(); }),
      clearToast: (id) => up((d) => { if (!id || d.toast?.id === id) d.toast = null; }),
      clearLiveNotif: () => up((d) => { d.liveNotif = null; }),
      readNotifs: () => up((d) => { d.unread = 0; }),
      concierge: (text) => up((d) => {
        d.concierge.push({ id: nid(), from: 'me', text });
        d.concierge.push({ id: nid(), from: 'them', text: 'Namaste! Your concierge here — I will sort this out for you within a few minutes. 🙏' });
      }),
      deepLink: (url) => up((d) => {
        const m = /dancer\/(\d+)/.exec(url);
        const inv = /invite\/(\w+)/.exec(url);
        if (inv) { d.user.invitedBy = inv[1]; toast(d, `Invited by ${inv[1]} — welcome!`); }
        if (m && get(d, Number(m[1]))) { d.screen = d.screen === 'gate' ? 'gate' : 'main'; d.pendingLink = Number(m[1]); }
      }),
      consumeLink: () => up((d) => { if (d.pendingLink != null) { d.watching = d.pendingLink; d.pendingLink = null; } }),

      // ---------- dancer app ----------
      setSelfAvailability: (mode) => up((d, now) => {
        const me = get(d, d.selfId);
        if (me.status === 'private' && mode !== 'available') { toast(d, 'Finish your private room first'); return; }
        if (mode === 'available') { d.selfBusy = false; if (me.status === 'break' || me.status === 'off') { me.status = 'bench'; me.since = now; me.returnAt = null; } toast(d, 'You are available — joining the stage'); }
        if (mode === 'busy') { d.selfBusy = true; toast(d, 'Busy — private requests paused, you stay on stage'); }
        if (mode === 'break') { d.selfBusy = false; leaveStage(d, me, 'break', now); me.returnAt = null; toast(d, 'On break'); }
        if (mode === 'off') { d.selfBusy = false; leaveStage(d, me, 'off', now); me.returnAt = null; toast(d, 'Off shift'); }
      }),
      acceptIncoming: (id) => up((d, now) => {
        const rq = d.incoming.find((x) => x.id === id);
        if (!rq) return;
        const me = get(d, d.selfId);
        if (d.rooms.length >= d.config.maxRooms) { toast(d, 'Studio room cap reached'); return; }
        if (!canLeaveStage(d, me)) { toast(d, 'Stage is at its minimum — try again shortly'); return; }
        d.incoming = d.incoming.filter((x) => x.id !== id);
        startRoom(d, me, { customer: rq.customer, min: rq.min, cost: rq.cost, selfRoom: true }, now);
      }),
      declineIncoming: (id) => up((d) => { d.incoming = d.incoming.filter((x) => x.id !== id); toast(d, 'Declined — no penalty'); }),
      endSelfRoom: () => up((d, now) => { const r = d.rooms.find((x) => x.did === d.selfId); if (r) endRoom(d, r, 'dancer', now); }),
      messageFollowers: (text) => up((d, now) => {
        if (now - d.selfMsgAt < 10 * 60000) { toast(d, `You can message followers again in ${Math.ceil((10 * 60000 - (now - d.selfMsgAt)) / 60000)} min`); return; }
        d.selfMsgAt = now;
        const me = get(d, d.selfId);
        if (d.user.follows.includes(me.id)) { d.notifs.unshift({ id: nid(), text: `${me.name}: ${text}`, did: me.id, at: now }); d.unread += 1; }
        toast(d, `Sent to ${fmt(me.followers)} followers`);
      }),
      blockCustomer: (name) => up((d) => { if (!d.blocked.includes(name)) d.blocked.push(name); d.incoming = d.incoming.filter((x) => x.customer !== name); toast(d, `${name} blocked`); }),
      unblockCustomer: (name) => up((d) => { d.blocked = d.blocked.filter((x) => x !== name); }),
      support: () => up((d) => { toast(d, 'Support will call you back within 15 minutes'); }),

      // ---------- floor manager ----------
      setConfig: (key, value) => up((d) => { d.config[key] = value; }),
      forceStatus: (did, status) => up((d, now) => {
        const dn = get(d, did);
        if (dn.status === 'private') { const r = d.rooms.find((x) => x.did === did); if (r) endRoom(d, r, 'floor', now); if (status === 'stage') return; }
        if (status === 'stage') {
          if (onStage(d).length >= d.config.stageCap) { toast(d, 'Stage is full'); return; }
          dn.status = 'stage'; dn.since = now; dn.returnAt = null; notifyFollowers(d, dn, `${dn.name} is live now`);
        } else { leaveStage(d, dn, status, now); dn.returnAt = null; }
      }),
      endRoomFloor: (roomId) => up((d, now) => { const r = d.rooms.find((x) => x.id === roomId); if (r) endRoom(d, r, 'floor', now); }),
      killAll: () => up((d, now) => { [...d.rooms].forEach((r) => endRoom(d, r, 'kill', now)); banner(d, '⛔ All private rooms ended by the floor manager', C.red); }),
      adjustSplit: (did, delta) => up((d) => { const dn = get(d, did); dn.split = Math.max(30, Math.min(80, dn.split + delta)); }),
      announce: (text) => up((d) => { if (text.trim()) banner(d, `📢 ${text.trim()}`, C.gold); }),
      resolveReport: (id) => up((d) => { const r = d.reports.find((x) => x.id === id); if (r) r.open = false; }),
    };
    return A;
  }, [up]);

  // replay the action that triggered registration
  useEffect(() => {
    if (S.user.registered && S.pendingAction) {
      const { type, args } = S.pendingAction;
      act.clearPending();
      setTimeout(() => act[type](...args), 50);
    }
  }, [S.user.registered, S.pendingAction, act]);

  return [S, act];
}

export { SONGS };
