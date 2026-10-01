import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Dancer from './src/Dancer';
import {
  ACCESS_MS, C, CAMERAS, COIN_PACKS, FAN_LINES, FAN_NAMES, GIFTS, PRICES, PRIVATE_LINES,
  SONGS, STUDIOS, THANKS, fmt, makePerformers, pick,
} from './src/data';

let _id = 0;
const nid = () => `${++_id}`;
const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);
const mmss = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const sortQueue = (q) => [...q].sort((a, b) => (b.vip - a.vip) || (b.bid - a.bid) || (a.t - b.t));
const initStats = () => ({ gross: 0, gifts: 0, songs: 0, shoutouts: 0, privates: 0, cameraSales: 0, myGifts: 0 });
const SONG_MS = 20000;
const PERF_LINES = [
  'Thank you all for joining tonight 🙏', 'Next song request kaun karega? 🎶', 'This one is for my top fans 💃',
  'Mehfil garam hai aaj! 🔥', 'Send a Rose if you are enjoying 🌹', 'Group dance soon? 😍',
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [screen, setScreen] = useState('gate');
  const [coins, setCoins] = useState(500);
  const coinsRef = useRef(500);
  const [vipUntil, setVipUntil] = useState(0);
  const [txns, setTxns] = useState([]);
  const [studio, setStudio] = useState(null);
  const [performers, setPerformers] = useState([]);
  const perfRef = useRef([]);
  const [selectedId, setSelectedId] = useState(null);
  const [camera, setCamera] = useState('wide');
  const [access, setAccess] = useState({});
  const [role, setRole] = useState('viewer');
  const [tab, setTab] = useState('chat');
  const [chat, setChat] = useState([]);
  const [queue, setQueue] = useState([]);
  const [nowPlaying, setNowPlaying] = useState(null);
  const nextSongAt = useRef(0);
  const [stats, setStats] = useState(initStats);
  const [viewers, setViewers] = useState(0);
  const [groupUntil, setGroupUntil] = useState(0);
  const [spotlight, setSpotlight] = useState(null);
  const [directorCut, setDirectorCut] = useState(null);
  const [followCut, setFollowCut] = useState(true);
  const [floaters, setFloaters] = useState([]);
  const [banners, setBanners] = useState([]);
  const [toastMsg, setToastMsg] = useState(null);
  const [privateRoom, setPrivateRoom] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { perfRef.current = performers; }, [performers]);
  const vip = vipUntil > now;

  // ---------- feedback helpers ----------
  const addChat = useCallback((m) => setChat((c) => [...c.slice(-90), { id: nid(), ...m }]), []);
  const toast = useCallback((t) => setToastMsg({ id: nid(), t }), []);
  const banner = useCallback((text, color = C.gold) => setBanners((b) => [...b.slice(-4), { id: nid(), text, color }]), []);
  const fly = useCallback((emoji, anim, pid) => {
    const items = [];
    if (anim === 'float' || anim === 'burst' || anim === 'rain') items.push({ id: nid(), emoji, kind: anim === 'burst' ? 'burst' : 'float', pid });
    if (anim === 'rain' || anim === 'stage') {
      for (let i = 0; i < 12; i++) items.push({ id: nid(), emoji: anim === 'stage' && i % 2 ? '⭐' : emoji, kind: 'rain', fx: Math.random(), delay: i * 90 });
    }
    if (anim === 'royal' || anim === 'stage') items.push({ id: nid(), emoji, kind: 'royal' });
    setFloaters((f) => [...f.slice(-40), ...items]);
  }, []);
  const removeFloater = useCallback((id) => setFloaters((f) => f.filter((x) => x.id !== id)), []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2400);
    return () => clearTimeout(t);
  }, [toastMsg]);
  useEffect(() => {
    if (!banners.length) return;
    const t = setTimeout(() => setBanners((b) => b.slice(1)), 3200);
    return () => clearTimeout(t);
  }, [banners[0]?.id]);

  const addTxn = (label, delta) => setTxns((t) => [{ id: nid(), label, delta, at: Date.now() }, ...t].slice(0, 40));
  const spend = useCallback((cost, label) => {
    if (coinsRef.current < cost) {
      toast(`Not enough coins — need ${fmt(cost)} 🪙`);
      setTab('coins');
      return false;
    }
    coinsRef.current -= cost;
    setCoins(coinsRef.current);
    addTxn(label, -cost);
    return true;
  }, [toast]);
  const credit = (amount, label) => {
    coinsRef.current += amount;
    setCoins(coinsRef.current);
    addTxn(label, amount);
  };

  const perf = (id) => perfRef.current.find((p) => p.id === id);
  const ranked = useMemo(() => [...performers].sort((a, b) => b.coins - a.coins), [performers]);
  const rankOf = useMemo(() => {
    const m = {};
    ranked.forEach((p, i) => { m[p.id] = i + 1; });
    return m;
  }, [ranked]);

  // ---------- gifting ----------
  const creditGift = useCallback((pid, gift, from, mine) => {
    const p = perf(pid);
    if (!p) return;
    setPerformers((ps) => ps.map((x) => (x.id === pid ? { ...x, coins: x.coins + gift.cost, gifts: x.gifts + 1 } : x)));
    setStats((s) => ({ ...s, gross: s.gross + gift.cost, gifts: s.gifts + 1, myGifts: s.myGifts + (mine ? 1 : 0) }));
    addChat({ user: mine ? 'You' : from, text: `sent ${gift.emoji} ${gift.name} to ${p.name}`, kind: mine ? 'mygift' : 'gift' });
    fly(gift.emoji, mine || gift.cost >= 1000 ? gift.anim : 'float', pid);
    if (gift.id === 'stagecall') {
      banner(`🎤 STAGE CALL — ${p.name} takes centre stage for ${mine ? 'You' : from}!`, C.rose);
      setSpotlight({ id: pid, until: Date.now() + 15000 });
    } else if (gift.cost >= 1000) {
      banner(`${gift.emoji} ${mine ? 'You' : from} sent a ${gift.name} to ${p.name}!`);
    }
    setTimeout(() => {
      addChat({ user: p.name, text: `${pick(THANKS).replace('{g}', gift.name)} @${mine ? 'You' : from}`, kind: 'performer' });
    }, 1200);
  }, [addChat, banner, fly]);

  const sendGift = (gift) => {
    if (selectedId == null) { toast('Tap a performer on the stage first'); return; }
    const p = perf(selectedId);
    const cost = vip ? Math.ceil(gift.cost * 0.8) : gift.cost;
    const go = () => { if (spend(cost, `${gift.emoji} ${gift.name} → ${p.name}`)) creditGift(p.id, gift, 'You', true); };
    if (gift.cost >= 1000) {
      setConfirm({ title: `Send ${gift.emoji} ${gift.name} to ${p.name}?`, body: `This costs ${fmt(cost)} coins${vip ? ' (VIP 20% off)' : ''}.`, confirmLabel: `Send · ${fmt(cost)} 🪙`, onConfirm: go });
    } else go();
  };

  // ---------- songs ----------
  const playNext = () => {
    if (!queue.length) { toast('Song queue is empty'); return; }
    const [top, ...rest] = sortQueue(queue);
    setQueue(rest);
    const p = perf(top.pid);
    setNowPlaying({ ...top, endsAt: Date.now() + SONG_MS });
    setStats((s) => ({ ...s, songs: s.songs + 1 }));
    banner(`🎶 Now playing: ${top.song.title} — ${p?.name} dances!`, C.rose);
    addChat({ kind: 'system', text: `🎶 ${p?.name} is dancing to "${top.song.title}" — requested by ${top.user} (${fmt(top.bid)} coins)` });
  };
  const requestSong = (song, extra) => {
    if (selectedId == null) { toast('Tap a performer on the stage first'); return false; }
    const p = perf(selectedId);
    const cost = song.price + extra;
    if (!spend(cost, `🎶 ${song.title} → ${p.name}`)) return false;
    const item = { id: nid(), song, pid: p.id, bid: cost, user: 'You', mine: true, vip: vip ? 1 : 0, t: Date.now() };
    const q = sortQueue([...queue, item]);
    setQueue(q);
    const pos = q.findIndex((x) => x.id === item.id) + 1;
    toast(`Request added — #${pos} in queue`);
    addChat({ kind: 'mygift', user: 'You', text: `requested "${song.title}" from ${p.name} (bid ${fmt(cost)})` });
    return true;
  };

  // ---------- perks ----------
  const shoutOut = () => {
    if (selectedId == null) { toast('Tap a performer on the stage first'); return; }
    const p = perf(selectedId);
    if (!spend(PRICES.shoutout, `📣 Shout-out from ${p.name}`)) return;
    setStats((s) => ({ ...s, shoutouts: s.shoutouts + 1, gross: s.gross + PRICES.shoutout }));
    setPerformers((ps) => ps.map((x) => (x.id === p.id ? { ...x, coins: x.coins + PRICES.shoutout } : x)));
    banner(`📣 ${p.name}: "Shout-out to You! Thank you for being here 💕"`, C.rose);
    fly('📣', 'burst', p.id);
    setTimeout(() => addChat({ user: p.name, kind: 'performer', text: 'Everyone, give some love to @You — my favourite in the mehfil tonight! 💕' }), 800);
  };
  const openPrivate = (min) => {
    if (selectedId == null) { toast('Tap a performer on the stage first'); return; }
    const p = perf(selectedId);
    const cost = min === 5 ? PRICES.private5 : PRICES.private15;
    setConfirm({
      title: `Private room with ${p.name}`,
      body: `${min} minutes, 1-on-1 · ${fmt(cost)} coins.\nAll private sessions are moderated and follow the studio content policy.`,
      confirmLabel: `Enter · ${fmt(cost)} 🪙`,
      onConfirm: () => {
        if (!spend(cost, `🔒 Private ${min}m · ${p.name}`)) return;
        setStats((s) => ({ ...s, privates: s.privates + 1, gross: s.gross + cost }));
        setPerformers((ps) => ps.map((x) => (x.id === p.id ? { ...x, coins: x.coins + cost } : x)));
        setPrivateRoom({ pid: p.id, min, endsAt: Date.now() + min * 60000 });
      },
    });
  };
  const extendPrivate = () => {
    if (!privateRoom) return;
    if (!spend(PRICES.private5, '🔒 Private room +5m')) return;
    setPrivateRoom((r) => ({ ...r, endsAt: r.endsAt + 5 * 60000 }));
    toast('Extended by 5 minutes');
  };
  const buyPack = (pack) => setConfirm({
    title: `Buy ${fmt(pack.coins)} coins`,
    body: `₹${fmt(pack.price)}${pack.bonus ? ` · ${pack.bonus} bonus` : ''}\n\nDemo purchase — this prototype does not take real payments.`,
    confirmLabel: `Pay ₹${fmt(pack.price)}`,
    onConfirm: () => { credit(pack.coins, `Recharge ₹${fmt(pack.price)}`); toast(`+${fmt(pack.coins)} coins added`); },
  });
  const buyVip = () => setConfirm({
    title: 'Join VIP · ₹999/month',
    body: '• Free close-ups on every performer\n• Priority in the song queue\n• 20% off all gifts\n• Gold VIP badge in chat\n\nDemo purchase — no real payment.',
    confirmLabel: 'Subscribe ₹999',
    onConfirm: () => {
      setVipUntil(Date.now() + 30 * 864e5);
      addTxn('💎 VIP subscription (₹999)', 0);
      banner('💎 Welcome to VIP! Close-ups are now free.', C.gold);
    },
  });
  const cancelVip = () => setConfirm({
    title: 'Cancel VIP?', body: 'You will lose free close-ups, queue priority and the gift discount.', confirmLabel: 'Cancel VIP',
    onConfirm: () => { setVipUntil(0); toast('VIP cancelled'); },
  });

  // ---------- cameras ----------
  const cut = directorCut && role === 'viewer' && followCut ? directorCut : null;
  const viewCam = cut ? cut.cam : camera;
  const viewId = cut ? cut.id : selectedId;
  const isUnlocked = (id, cam) =>
    cam === 'wide' || role === 'director' || (cam === 'close' && vip) || (access[`${id}:${cam}`] || 0) > now;
  const viewUnlocked = !!cut || isUnlocked(viewId, viewCam);

  const chooseCamera = (cam) => {
    setFollowCut(false);
    if (cam !== 'wide' && selectedId == null) { toast('Tap a performer on the stage first'); return; }
    setCamera(cam);
  };
  const unlockCamera = () => {
    const camDef = CAMERAS.find((c) => c.id === viewCam);
    const p = perf(viewId);
    if (!spend(camDef.cost, `${camDef.icon} ${camDef.label} · ${p.name} (5 min)`)) return;
    setAccess((a) => ({ ...a, [`${viewId}:${viewCam}`]: Date.now() + ACCESS_MS }));
    setStats((s) => ({ ...s, cameraSales: s.cameraSales + camDef.cost }));
    toast(`${camDef.label} unlocked for 5 minutes`);
  };
  const tapPerformer = (id) => {
    setSelectedId(id);
    setFollowCut(false);
    setCamera('close');
  };

  // ---------- director ----------
  const broadcastCut = (cam, target) => {
    const id = target === 'top' ? ranked[0]?.id : selectedId;
    if (cam !== 'wide' && id == null) { toast('Select a performer or use Top Earner'); return; }
    setDirectorCut({ cam, id });
    setFollowCut(true);
    const label = CAMERAS.find((c) => c.id === cam).label;
    banner(`📡 Director's Cut: ${label}${cam !== 'wide' ? ` on ${perf(id)?.name}` : ''}`, C.blue);
  };
  const endCut = () => { setDirectorCut(null); toast("Director's Cut ended"); };
  const announce = (text) => {
    if (!text.trim()) return;
    banner(`📢 ${text.trim()}`, C.gold);
    addChat({ kind: 'system', text: `📢 Studio announcement: ${text.trim()}` });
  };
  const spotlightTop = () => {
    const top = ranked[0];
    if (!top) return;
    setSpotlight({ id: top.id, until: Date.now() + 15000 });
    setSelectedId(top.id);
    banner(`🌟 Spotlight on ${top.name} — tonight's top earner with ${fmt(top.coins)} coins!`, C.gold);
    fly('🌟', 'burst', top.id);
  };
  const groupDance = () => {
    setGroupUntil(Date.now() + 15000);
    banner('💃 GROUP DANCE! All 20 performers, together! 🕺', C.rose);
    fly('🎉', 'rain', null);
  };
  const skipSong = () => {
    if (nowPlaying) { setNowPlaying(null); }
    nextSongAt.current = 0;
    if (queue.length) playNext(); else toast('Queue is empty');
  };
  const toggleRole = () => {
    const next = role === 'viewer' ? 'director' : 'viewer';
    setRole(next);
    setTab(next === 'director' ? 'console' : 'chat');
    toast(next === 'director' ? '🎬 Director view — cameras free, console open' : '👁 Viewer view');
  };

  // ---------- studio lifecycle ----------
  const enterStudio = (st) => {
    const ps = makePerformers(st.id);
    perfRef.current = ps;
    setStudio(st);
    setPerformers(ps);
    setSelectedId(null);
    setCamera('wide');
    setAccess({});
    setChat([{ id: nid(), kind: 'system', text: `Welcome to ${st.name}! 20 performers are live. Tap any dancer for a close-up.` }]);
    setQueue([]);
    setNowPlaying(null);
    nextSongAt.current = Date.now() + 6000;
    setStats(initStats());
    setViewers(st.viewers);
    setGroupUntil(0);
    setSpotlight(null);
    setDirectorCut(null);
    setFloaters([]);
    setBanners([]);
    setTab(role === 'director' ? 'console' : 'chat');
    setScreen('studio');
  };

  // 1-second clock
  useEffect(() => {
    if (screen !== 'studio') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [screen]);

  // timed state machine: songs, group dance, spotlight, private room
  useEffect(() => {
    if (screen !== 'studio') return;
    if (nowPlaying && now >= nowPlaying.endsAt) {
      setNowPlaying(null);
      nextSongAt.current = now + 3000;
    } else if (!nowPlaying && queue.length && now >= nextSongAt.current) {
      playNext();
    }
    if (groupUntil && now > groupUntil) setGroupUntil(0);
    if (spotlight && now > spotlight.until) setSpotlight(null);
    if (privateRoom && now >= privateRoom.endsAt) {
      const p = perf(privateRoom.pid);
      setPrivateRoom(null);
      toast(`Private room with ${p?.name} ended`);
    }
  }, [now]);

  // simulated live activity every 4s
  useEffect(() => {
    if (screen !== 'studio') return;
    const iv = setInterval(() => {
      const ps = perfRef.current;
      if (!ps.length) return;
      setViewers((v) => Math.max(300, v + Math.floor(Math.random() * 76) - 30));
      if (Math.random() < 0.7) addChat({ user: pick(FAN_NAMES), text: pick(FAN_LINES), kind: 'fan' });
      if (Math.random() < 0.4) {
        const g = GIFTS[Math.min(Math.floor(Math.pow(Math.random(), 3) * 9), 8)];
        creditGift(pick(ps).id, g, pick(FAN_NAMES), false);
      }
      if (Math.random() < 0.13) {
        const song = pick(SONGS);
        setQueue((q) => sortQueue([...q, {
          id: nid(), song, pid: pick(ps).id, bid: song.price + Math.floor(Math.random() * 5) * 50,
          user: pick(FAN_NAMES), mine: false, vip: Math.random() < 0.2 ? 1 : 0, t: Date.now(),
        }]));
      }
      if (Math.random() < 0.15) addChat({ user: pick(ps).name, text: pick(PERF_LINES), kind: 'performer' });
    }, 4000);
    return () => clearInterval(iv);
  }, [screen, addChat, creditGift]);

  const sendChat = (text) => {
    addChat({ user: 'You', text, kind: 'me', vip });
    if (Math.random() < 0.5) {
      const p = selectedId != null ? perf(selectedId) : pick(perfRef.current);
      setTimeout(() => addChat({ user: p.name, kind: 'performer', text: `@You ${pick(['Thank you! 💕', 'Aap ka swagat hai 🙏', 'Stay till the group dance! 💃', 'Request a song for me? 🎶', '✨✨✨'])}` }), 1500);
    }
  };

  // Android back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirm) { setConfirm(null); return true; }
      if (screen === 'studio') {
        if (viewCam !== 'wide') { setFollowCut(false); setCamera('wide'); return true; }
        setScreen('lobby');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [confirm, screen, viewCam]);

  // ---------- render ----------
  const pad = { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right };

  if (screen === 'gate') return <Gate pad={pad} onEnter={() => setScreen('lobby')} />;
  if (screen === 'lobby') {
    return (
      <Lobby
        pad={pad} coins={coins} vip={vip} role={role} onToggleRole={toggleRole}
        onEnter={enterStudio} onBuyCoins={buyPack} confirm={confirm} setConfirm={setConfirm} toastMsg={toastMsg}
      />
    );
  }

  const stageW = width - 16 - insets.left - insets.right - 2; // inner width (stage has a 1px border)
  const cellW = Math.floor((stageW / 5) * 100) / 100;
  const cellH = Math.min(cellW * 1.32, (height * 0.42) / 4);
  const stageH = cellH * 4;
  const selected = selectedId != null ? performers.find((p) => p.id === selectedId) : null;
  const viewPerf = viewId != null ? performers.find((p) => p.id === viewId) : null;
  const group = groupUntil > now;
  const tabs = [
    ['chat', '💬 Chat'], ['gifts', '🎁 Gifts'], ['songs', '🎶 Songs'], ['perks', '✨ Perks'],
    ['board', '🏆 Board'], ['coins', '🪙 Coins'], ...(role === 'director' ? [['console', '🎬 Console']] : []),
  ];

  return (
    <KeyboardAvoidingView style={[st.root, pad]} behavior="padding">
      {/* top bar */}
      <View style={st.topBar}>
        <Pressable onPress={() => setScreen('lobby')} hitSlop={10} style={st.backBtn}><Text style={st.backTxt}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.brand} numberOfLines={1}>Mehfil Live · <Text style={{ color: C.gold }}>{studio?.name}</Text></Text>
          <View style={st.row}>
            <LiveDot />
            <Text style={st.meta}>LIVE · 👁 {fmt(viewers)}</Text>
            {vip && <Text style={st.vipTag}>VIP</Text>}
          </View>
        </View>
        <Pressable onPress={() => setTab('coins')} style={st.coinPill}><Text style={st.coinTxt}>🪙 {fmt(coins)}</Text></Pressable>
        <Pressable onPress={toggleRole} style={[st.rolePill, role === 'director' && { backgroundColor: C.gold }]}>
          <Text style={[st.roleTxt, role === 'director' && { color: C.bg }]}>{role === 'director' ? '🎬 Director' : '👁 Viewer'}</Text>
        </Pressable>
      </View>

      {/* camera bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.camBar} contentContainerStyle={{ paddingHorizontal: 8, gap: 6 }}>
        {CAMERAS.map((c) => {
          const active = viewCam === c.id;
          const exp = selectedId != null ? (access[`${selectedId}:${c.id}`] || 0) : 0;
          let sub = c.cost ? `${c.cost}🪙` : 'Free';
          if (c.id === 'wide') sub = 'Free';
          else if (role === 'director') sub = 'Free';
          else if (c.id === 'close' && vip) sub = 'VIP';
          else if (exp > now) sub = mmss(exp - now);
          return (
            <Pressable key={c.id} onPress={() => chooseCamera(c.id)} style={[st.camChip, active && st.camChipOn]}>
              <Text style={[st.camLabel, active && { color: C.bg }]}>{c.icon} {c.label}</Text>
              <Text style={[st.camSub, active && { color: C.bg }]}>{sub}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* stage */}
      <View style={[st.stage, { width: stageW + 2, height: stageH + 2 }]}>
        {viewCam === 'wide' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {performers.map((p) => (
              <StageCell
                key={p.id} p={p} w={cellW} h={cellH} rank={rankOf[p.id]} group={group}
                selected={p.id === selectedId} spot={spotlight?.id === p.id}
                performing={nowPlaying?.pid === p.id} onPress={() => tapPerformer(p.id)}
              />
            ))}
          </View>
        ) : (
          <FocusView
            p={viewPerf} cam={viewCam} w={stageW} h={stageH} rank={viewPerf ? rankOf[viewPerf.id] : 0}
            unlocked={viewUnlocked} vip={vip} group={group} performing={nowPlaying?.pid === viewPerf?.id}
            spot={spotlight?.id === viewPerf?.id} onUnlock={unlockCamera}
            onWide={() => { setFollowCut(false); setCamera('wide'); }}
          />
        )}
        {cut && (
          <Pressable onPress={() => setFollowCut(false)} style={st.cutTag}>
            <Text style={st.cutTxt}>📡 DIRECTOR'S CUT · tap to leave</Text>
          </Pressable>
        )}
        {!cut && directorCut && role === 'viewer' && (
          <Pressable onPress={() => setFollowCut(true)} style={[st.cutTag, { backgroundColor: 'rgba(122,167,255,0.25)' }]}>
            <Text style={st.cutTxt}>📡 Watch Director's Cut</Text>
          </Pressable>
        )}
        {group && <View pointerEvents="none" style={st.groupTag}><Text style={st.groupTxt}>💃 GROUP DANCE {mmss(groupUntil - now)}</Text></View>}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {floaters.map((f) => {
            let ox = stageW / 2;
            let oy = stageH / 2;
            if (f.pid != null && viewCam === 'wide') {
              const idx = performers.findIndex((p) => p.id === f.pid);
              ox = (idx % 5) * cellW + cellW / 2;
              oy = Math.floor(idx / 5) * cellH + cellH / 2;
            }
            return <Floater key={f.id} item={f} w={stageW} h={stageH} ox={ox} oy={oy} onDone={removeFloater} />;
          })}
        </View>
        {banners[0] && <Banner key={banners[0].id} b={banners[0]} />}
      </View>

      {/* now playing strip */}
      <View style={st.npStrip}>
        {nowPlaying ? (
          <Text style={st.npTxt} numberOfLines={1}>
            🎶 <Text style={{ color: C.rose, fontWeight: '700' }}>{nowPlaying.song.title}</Text> · {perf(nowPlaying.pid)?.name} · {mmss(nowPlaying.endsAt - now)}
            <Text style={{ color: C.dim }}>  ·  {queue.length} in queue</Text>
          </Text>
        ) : (
          <Text style={st.npTxt} numberOfLines={1}>
            {selected ? <>Selected: <Text style={{ color: C.rose, fontWeight: '700' }}>{selected.name}</Text> · {selected.style} · #{rankOf[selected.id]}</> : 'Tap a dancer to select them'}
            <Text style={{ color: C.dim }}>  ·  🎶 {queue.length} in queue</Text>
          </Text>
        )}
      </View>

      {/* tabs */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8, gap: 6 }} style={st.tabBar}>
          {tabs.map(([k, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[st.tab, tab === k && st.tabOn]}>
              <Text style={[st.tabTxt, tab === k && { color: C.text }]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* panel */}
      <View style={st.panel}>
        {tab === 'chat' && <ChatPanel chat={chat} onSend={sendChat} />}
        {tab === 'gifts' && <GiftsPanel selected={selected} vip={vip} coins={coins} onGift={sendGift} />}
        {tab === 'songs' && <SongsPanel selected={selected} vip={vip} queue={queue} perf={perf} onRequest={requestSong} />}
        {tab === 'perks' && (
          <PerksPanel
            selected={selected} vip={vip} vipUntil={vipUntil} now={now} onShout={shoutOut} onPrivate={openPrivate}
            onVip={buyVip} onCancelVip={cancelVip} onBackstage={() => chooseCamera('backstage')}
          />
        )}
        {tab === 'board' && <BoardPanel ranked={ranked} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); toast(`Selected ${perf(id)?.name}`); }} />}
        {tab === 'coins' && <CoinsPanel coins={coins} txns={txns} onBuy={buyPack} vip={vip} />}
        {tab === 'console' && role === 'director' && (
          <ConsolePanel
            stats={stats} viewers={viewers} queue={queue} ranked={ranked} selected={selected} directorCut={directorCut}
            nowPlaying={nowPlaying} perf={perf} onCut={broadcastCut} onEndCut={endCut} onAnnounce={announce}
            onSpotlight={spotlightTop} onGroup={groupDance} onSkip={skipSong} group={group}
          />
        )}
      </View>

      {toastMsg && <Toast key={toastMsg.id} text={toastMsg.t} bottom={insets.bottom + 12} />}
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
      {privateRoom && (
        <PrivateRoom
          room={privateRoom} p={perf(privateRoom.pid)} now={now} pad={pad} onExtend={extendPrivate}
          onEnd={() => { setPrivateRoom(null); toast('You left the private room'); }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ======================= screens =======================

function Gate({ pad, onEnter }) {
  return (
    <View style={[st.root, pad, { justifyContent: 'center', padding: 28 }]}>
      <Text style={st.gateEmoji}>🪔</Text>
      <Text style={st.gateTitle}>Mehfil Live</Text>
      <Text style={st.gateSub}>STUDIO ROYALE</Text>
      <Text style={st.gateTag}>20 performers. One stage.{'\n'}Your mehfil, your rules.</Text>
      <View style={st.card}>
        <Text style={st.h3}>18+ only</Text>
        <Text style={st.body}>
          This studio is for adults. Performances are dance and music only, private rooms are moderated, and all studios are verified.
          {'\n\n'}This is a prototype: performers are animated simulations and all purchases are demo purchases.
        </Text>
      </View>
      <Pressable onPress={onEnter} style={[st.btn, { marginTop: 18 }]}><Text style={st.btnTxt}>I'm 18 or older — Enter</Text></Pressable>
    </View>
  );
}

function Lobby({ pad, coins, vip, role, onToggleRole, onEnter, onBuyCoins, confirm, setConfirm, toastMsg }) {
  return (
    <View style={[st.root, pad]}>
      <View style={st.topBar}>
        <View style={{ flex: 1, paddingLeft: 6 }}>
          <Text style={[st.brand, { fontSize: 20 }]}>Mehfil Live</Text>
          <Text style={st.meta}>Browse studios {vip ? '· 💎 VIP' : ''}</Text>
        </View>
        <Pressable onPress={() => onBuyCoins(COIN_PACKS[1])} style={st.coinPill}><Text style={st.coinTxt}>🪙 {fmt(coins)}</Text></Pressable>
        <Pressable onPress={onToggleRole} style={[st.rolePill, role === 'director' && { backgroundColor: C.gold }]}>
          <Text style={[st.roleTxt, role === 'director' && { color: C.bg }]}>{role === 'director' ? '🎬 Director' : '👁 Viewer'}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        {STUDIOS.map((s, i) => (
          <Pressable key={s.id} onPress={() => onEnter(s)} style={st.studioCard}>
            <View style={st.studioPreview}>
              {makePerformers(s.id).slice(0, 5).map((p) => <Dancer key={p.id} p={p} size={62} />)}
            </View>
            <View style={{ padding: 12 }}>
              <View style={st.row}>
                <View style={st.liveBadge}><Text style={st.liveBadgeTxt}>● LIVE</Text></View>
                <Text style={[st.tagTxt]}>{s.tag}</Text>
                <View style={{ flex: 1 }} />
                <Text style={st.meta}>👁 {fmt(s.viewers)}</Text>
              </View>
              <Text style={st.studioName}>{s.name}</Text>
              <Text style={st.meta}>{s.theme} · 20 performers</Text>
              <View style={[st.btn, { marginTop: 10, paddingVertical: 9 }]}><Text style={st.btnTxt}>Enter studio</Text></View>
            </View>
          </Pressable>
        ))}
        <Text style={[st.meta, { textAlign: 'center', marginVertical: 8 }]}>Prototype · simulated performers · demo coins</Text>
      </ScrollView>
      {toastMsg && <Toast key={toastMsg.id} text={toastMsg.t} bottom={20} />}
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
    </View>
  );
}

// ======================= stage pieces =======================

const StageCell = React.memo(function StageCell({ p, w, h, rank, selected, spot, performing, group, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[st.cell, { width: w, height: h }, selected && st.cellSel, spot && st.cellSpot, performing && st.cellPerf]}
    >
      {spot && <View style={st.spotBeam} />}
      <View style={{ position: 'absolute', top: 2, left: 3 }}>
        <Text style={st.cellRank}>{rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</Text>
      </View>
      {performing && <Text style={{ position: 'absolute', top: 2, right: 3, fontSize: 10 }}>🎶</Text>}
      <View style={{ alignItems: 'center', marginTop: h * 0.08 }}>
        <Dancer p={p} size={h * 0.66} group={group} mode={performing || spot ? 'performing' : 'normal'} />
      </View>
      <View style={st.cellFoot}>
        <Text style={st.cellName} numberOfLines={1}>{p.name}</Text>
        <Text style={st.cellCoins}>🪙{fmtK(p.coins)}</Text>
      </View>
    </Pressable>
  );
});

function FocusView({ p, cam, w, h, rank, unlocked, vip, group, performing, spot, onUnlock, onWide }) {
  if (!p) {
    return (
      <View style={[st.center, { width: w, height: h }]}>
        <Text style={st.body}>Select a performer first</Text>
        <Pressable onPress={onWide} style={[st.btnGhost, { marginTop: 10 }]}><Text style={st.btnGhostTxt}>◀ Back to Wide</Text></Pressable>
      </View>
    );
  }
  const camDef = CAMERAS.find((c) => c.id === cam);
  const size = h * 0.82;
  let body = <Dancer p={p} size={size} group={group} mode={performing || spot ? 'performing' : 'normal'} />;
  let bg = C.bg2;
  if (cam === 'side') body = <View style={{ transform: [{ perspective: 800 }, { rotateY: '58deg' }] }}>{body}</View>;
  if (cam === 'top') {
    body = (
      <View style={{ alignItems: 'center' }}>
        <View style={[st.floorEllipse, { width: size * 0.8, height: size * 0.3, bottom: size * 0.05 }]} />
        <View style={{ transform: [{ perspective: 800 }, { rotateX: '52deg' }, { scale: 0.9 }] }}>{body}</View>
      </View>
    );
  }
  if (cam === 'backstage') {
    bg = '#120a0a';
    body = (
      <View style={[st.mirror, { width: size * 0.9, height: size }]}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={i} style={[st.bulb, i < 5 ? { top: -5, left: `${10 + i * 19}%` } : { bottom: -5, left: `${10 + (i - 5) * 19}%` }]} />
        ))}
        <Dancer p={p} size={size * 0.85} mode="backstage" />
      </View>
    );
  }
  return (
    <View style={{ width: w, height: h, backgroundColor: bg, overflow: 'hidden' }}>
      <View style={[st.spotCone, { left: w / 2 - h * 0.5, width: h, height: h * 1.2 }]} />
      <View style={[st.center, { flex: 1, opacity: unlocked ? 1 : 0.15 }]}>{body}</View>
      <View style={st.focusInfo}>
        <Text style={st.focusName}>{p.name} <Text style={{ color: C.gold, fontSize: 13 }}>#{rank}</Text></Text>
        <Text style={st.meta}>{p.style} · 🪙 {fmt(p.coins)} · 🎁 {p.gifts}</Text>
        <Text style={[st.meta, { color: C.rose }]}>{camDef.icon} {camDef.label}{cam === 'backstage' ? ' · prep cam' : ''}</Text>
      </View>
      <Pressable onPress={onWide} style={st.focusBack}><Text style={st.btnGhostTxt}>◀ Wide</Text></Pressable>
      {!unlocked && (
        <View style={[StyleSheet.absoluteFill, st.center]}>
          <View style={st.lockCard}>
            <Text style={{ fontSize: 30 }}>🔒</Text>
            <Text style={st.h3}>{camDef.label} · {p.name}</Text>
            <Text style={[st.body, { textAlign: 'center' }]}>5 minutes of access{cam === 'close' ? '\nVIP members get close-ups free' : ''}</Text>
            <Pressable onPress={onUnlock} style={[st.btn, { marginTop: 10, alignSelf: 'stretch' }]}><Text style={st.btnTxt}>Unlock · {camDef.cost} 🪙</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function Floater({ item, w, h, ox, oy, onDone }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const duration = item.kind === 'royal' ? 2400 : item.kind === 'rain' ? 1900 : 1600;
    Animated.timing(a, { toValue: 1, duration, delay: item.delay || 0, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(() => onDone(item.id));
  }, []);
  let style;
  let fontSize = 28;
  if (item.kind === 'float') {
    style = {
      left: ox - 16, top: oy - 18,
      opacity: a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -110] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] }) }],
    };
  } else if (item.kind === 'burst') {
    style = {
      left: ox - 16, top: oy - 18,
      opacity: a.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
      transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 3] }) }],
    };
  } else if (item.kind === 'rain') {
    fontSize = 24;
    style = {
      left: item.fx * (w - 30), top: -30,
      opacity: a.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
      transform: [
        { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, h + 30] }) },
        { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '320deg'] }) },
      ],
    };
  } else {
    fontSize = 64;
    style = {
      left: w / 2 - 40, top: h / 2 - 44,
      opacity: a.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
      transform: [
        { scale: a.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.2, 1.7, 1.3] }) },
        { rotate: a.interpolate({ inputRange: [0, 0.35, 1], outputRange: ['-25deg', '0deg', '0deg'] }) },
      ],
    };
  }
  return <Animated.Text style={[{ position: 'absolute', fontSize }, style]}>{item.emoji}</Animated.Text>;
}

function Banner({ b }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.delay(2400),
      Animated.timing(a, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[st.banner, { borderColor: b.color, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] }]}
    >
      <Text style={[st.bannerTxt, { color: b.color }]}>{b.text}</Text>
    </Animated.View>
  );
}

function LiveDot() {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[st.liveDot, { opacity: a }]} />;
}

function Toast({ text, bottom }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View pointerEvents="none" style={[st.toast, { bottom, opacity: a }]}>
      <Text style={st.toastTxt}>{text}</Text>
    </Animated.View>
  );
}

function ConfirmModal({ confirm, onClose }) {
  return (
    <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.modalBg}>
        <View style={st.modalCard}>
          <Text style={st.h3}>{confirm?.title}</Text>
          <Text style={[st.body, { marginTop: 8 }]}>{confirm?.body}</Text>
          <View style={[st.row, { marginTop: 18, gap: 10 }]}>
            <Pressable onPress={onClose} style={[st.btnGhost, { flex: 1 }]}><Text style={st.btnGhostTxt}>Cancel</Text></Pressable>
            <Pressable onPress={() => { const fn = confirm?.onConfirm; onClose(); fn && fn(); }} style={[st.btn, { flex: 1 }]}>
              <Text style={st.btnTxt}>{confirm?.confirmLabel || 'Confirm'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ======================= panels =======================

function ChatPanel({ chat, onSend }) {
  const [text, setText] = useState('');
  const data = useMemo(() => [...chat].reverse(), [chat]);
  const send = () => { if (text.trim()) { onSend(text.trim()); setText(''); } };
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        inverted data={data} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 10 }}
        renderItem={({ item: m }) => <ChatLine m={m} />}
      />
      <View style={st.inputRow}>
        <TextInput
          value={text} onChangeText={setText} placeholder="Say something to the mehfil…" placeholderTextColor={C.dim}
          style={st.input} onSubmitEditing={send} returnKeyType="send"
        />
        <Pressable onPress={send} style={st.sendBtn}><Text style={st.btnTxt}>Send</Text></Pressable>
      </View>
    </View>
  );
}

const ChatLine = React.memo(function ChatLine({ m }) {
  if (m.kind === 'system') return <Text style={[st.chatLine, { color: C.gold }]}>{m.text}</Text>;
  const color = { fan: C.blue, gift: C.goldLight, mygift: C.rose, performer: C.rose, me: C.green }[m.kind] || C.text;
  const bg = m.kind === 'gift' || m.kind === 'mygift' ? 'rgba(212,175,55,0.08)' : 'transparent';
  return (
    <Text style={[st.chatLine, { backgroundColor: bg }]}>
      <Text style={{ color, fontWeight: '700' }}>{m.kind === 'performer' ? '💃 ' : ''}{m.vip ? '💎 ' : ''}{m.user}</Text>
      <Text style={{ color: C.text }}>  {m.text}</Text>
    </Text>
  );
});

function Target({ selected }) {
  return (
    <Text style={[st.meta, { marginBottom: 8 }]}>
      To: {selected ? <Text style={{ color: C.rose, fontWeight: '700' }}>{selected.name}</Text> : <Text style={{ color: C.red }}>tap a performer on the stage</Text>}
    </Text>
  );
}

function GiftsPanel({ selected, vip, coins, onGift }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 10 }}>
      <Target selected={selected} />
      <View style={st.giftGrid}>
        {GIFTS.map((g) => {
          const cost = vip ? Math.ceil(g.cost * 0.8) : g.cost;
          return (
            <Pressable key={g.id} onPress={() => onGift(g)} style={[st.giftCell, coins < cost && { opacity: 0.5 }]}>
              <Text style={{ fontSize: 28 }}>{g.emoji}</Text>
              <Text style={st.giftName}>{g.name}</Text>
              <Text style={st.giftCost}>
                {vip && <Text style={{ textDecorationLine: 'line-through', color: C.dim }}>{fmt(g.cost)} </Text>}🪙{fmt(cost)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[st.meta, { marginTop: 8 }]}>Every gift is split 50% performer · 50% studio. {vip ? 'VIP: 20% off applied.' : 'VIP members get 20% off.'}</Text>
    </ScrollView>
  );
}

function SongsPanel({ selected, vip, queue, perf, onRequest }) {
  const [song, setSong] = useState(null);
  const [extra, setExtra] = useState(0);
  const step = PRICES.songBidStep;
  return (
    <ScrollView contentContainerStyle={{ padding: 10 }}>
      <Target selected={selected} />
      {SONGS.map((s) => (
        <Pressable key={s.id} onPress={() => setSong(s)} style={[st.songRow, song?.id === s.id && st.songRowOn]}>
          <View style={{ flex: 1 }}>
            <Text style={st.songTitle}>{s.title}</Text>
            <Text style={st.meta}>{s.cat}</Text>
          </View>
          <Text style={st.giftCost}>🪙{s.price}</Text>
        </Pressable>
      ))}
      <View style={[st.card, { marginTop: 10 }]}>
        <Text style={st.h3}>Bid for priority</Text>
        <Text style={st.meta}>Higher total bids play first{vip ? ' · VIP priority active 💎' : ''}</Text>
        <View style={[st.row, { marginTop: 10, gap: 10 }]}>
          <Pressable onPress={() => setExtra((e) => Math.max(0, e - step))} style={st.stepBtn}><Text style={st.btnTxt}>−</Text></Pressable>
          <Text style={[st.h3, { flex: 1, textAlign: 'center' }]}>+{extra} 🪙</Text>
          <Pressable onPress={() => setExtra((e) => e + step)} style={st.stepBtn}><Text style={st.btnTxt}>+</Text></Pressable>
        </View>
        <Pressable
          onPress={() => { if (song && onRequest(song, extra)) { setSong(null); setExtra(0); } }}
          style={[st.btn, { marginTop: 10 }, !song && { opacity: 0.5 }]} disabled={!song}
        >
          <Text style={st.btnTxt}>{song ? `Request "${song.title}" · ${song.price + extra} 🪙` : 'Choose a song'}</Text>
        </Pressable>
      </View>
      <Text style={[st.h3, { marginTop: 14, marginBottom: 6 }]}>Queue ({queue.length})</Text>
      {queue.length === 0 && <Text style={st.meta}>No requests yet — be the first!</Text>}
      {queue.map((q, i) => (
        <View key={q.id} style={[st.queueRow, q.mine && { borderColor: C.rose }]}>
          <Text style={st.queuePos}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.songTitle} numberOfLines={1}>{q.song.title} <Text style={st.meta}>· {perf(q.pid)?.name}</Text></Text>
            <Text style={st.meta}>{q.vip ? '💎 ' : ''}{q.user}</Text>
          </View>
          <Text style={st.giftCost}>🪙{fmt(q.bid)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function PerksPanel({ selected, vip, vipUntil, now, onShout, onPrivate, onVip, onCancelVip, onBackstage }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 10, gap: 10 }}>
      <Target selected={selected} />
      <Pressable onPress={onShout} style={st.perkRow}>
        <Text style={st.perkIcon}>📣</Text>
        <View style={{ flex: 1 }}><Text style={st.songTitle}>Shout-Out</Text><Text style={st.meta}>Performer calls your name on stage</Text></View>
        <Text style={st.giftCost}>🪙{PRICES.shoutout}</Text>
      </Pressable>
      <Pressable onPress={() => onPrivate(5)} style={st.perkRow}>
        <Text style={st.perkIcon}>🔒</Text>
        <View style={{ flex: 1 }}><Text style={st.songTitle}>Private Room · 5 min</Text><Text style={st.meta}>Moderated 1-on-1</Text></View>
        <Text style={st.giftCost}>🪙{PRICES.private5}</Text>
      </Pressable>
      <Pressable onPress={() => onPrivate(15)} style={st.perkRow}>
        <Text style={st.perkIcon}>🔐</Text>
        <View style={{ flex: 1 }}><Text style={st.songTitle}>Private Room · 15 min</Text><Text style={st.meta}>Moderated 1-on-1 · best value</Text></View>
        <Text style={st.giftCost}>🪙{fmt(PRICES.private15)}</Text>
      </Pressable>
      <Pressable onPress={onBackstage} style={st.perkRow}>
        <Text style={st.perkIcon}>🎭</Text>
        <View style={{ flex: 1 }}><Text style={st.songTitle}>Backstage Cam</Text><Text style={st.meta}>Behind the scenes · 5 min</Text></View>
        <Text style={st.giftCost}>🪙100</Text>
      </Pressable>
      <View style={[st.card, { borderColor: C.gold }]}>
        <Text style={[st.h3, { color: C.gold }]}>💎 VIP · ₹{PRICES.vipRupees}/month</Text>
        <Text style={st.body}>Free close-ups · song queue priority · 20% off all gifts · VIP badge</Text>
        {vip ? (
          <>
            <Text style={[st.meta, { marginTop: 8, color: C.green }]}>Active · {Math.ceil((vipUntil - now) / 864e5)} days left</Text>
            <Pressable onPress={onCancelVip} style={[st.btnGhost, { marginTop: 8 }]}><Text style={st.btnGhostTxt}>Cancel VIP</Text></Pressable>
          </>
        ) : (
          <Pressable onPress={onVip} style={[st.btn, { marginTop: 10, backgroundColor: C.gold }]}><Text style={[st.btnTxt, { color: C.bg }]}>Become VIP</Text></Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function BoardPanel({ ranked, selectedId, onSelect }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 10 }}>
      <Text style={[st.h3, { marginBottom: 6 }]}>🏆 Who's winning tonight</Text>
      {ranked.map((p, i) => (
        <Pressable key={p.id} onPress={() => onSelect(p.id)} style={[st.queueRow, p.id === selectedId && { borderColor: C.rose }]}>
          <Text style={st.queuePos}>{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.songTitle}>{p.name}</Text>
            <Text style={st.meta}>{p.style} · {p.gifts} gifts</Text>
          </View>
          <Text style={st.giftCost}>🪙{fmt(p.coins)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function CoinsPanel({ coins, txns, onBuy, vip }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 10 }}>
      <View style={[st.card, { alignItems: 'center' }]}>
        <Text style={st.meta}>Wallet balance</Text>
        <Text style={st.bigNum}>🪙 {fmt(coins)}</Text>
        {vip && <Text style={[st.meta, { color: C.gold }]}>💎 VIP member</Text>}
      </View>
      <Text style={[st.h3, { marginVertical: 8 }]}>Recharge</Text>
      <View style={st.giftGrid}>
        {COIN_PACKS.map((p) => (
          <Pressable key={p.coins} onPress={() => onBuy(p)} style={[st.giftCell, { width: '48%' }]}>
            {p.bonus && <View style={st.bonusTag}><Text style={st.bonusTxt}>{p.bonus}</Text></View>}
            <Text style={st.h3}>🪙 {fmt(p.coins)}</Text>
            <Text style={[st.giftCost, { marginTop: 4 }]}>₹{fmt(p.price)}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[st.meta, { marginTop: 6 }]}>Demo purchases — no real payment is taken in this prototype.</Text>
      <Text style={[st.h3, { marginTop: 14, marginBottom: 6 }]}>Recent activity</Text>
      {txns.length === 0 && <Text style={st.meta}>No transactions yet</Text>}
      {txns.map((t) => (
        <View key={t.id} style={[st.row, { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line }]}>
          <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{t.label}</Text>
          <Text style={{ color: t.delta >= 0 ? C.green : C.rose, fontWeight: '700' }}>{t.delta >= 0 ? '+' : ''}{fmt(t.delta)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function ConsolePanel({ stats, viewers, queue, ranked, selected, directorCut, nowPlaying, perf, onCut, onEndCut, onAnnounce, onSpotlight, onGroup, onSkip, group }) {
  const [cam, setCam] = useState('close');
  const [target, setTarget] = useState('top');
  const [msg, setMsg] = useState('');
  const studioCut = stats.gross * 0.5;
  const tiles = [
    ['Total gifted', `🪙${fmt(stats.gross)}`], ['Studio earnings', `🪙${fmt(studioCut + stats.cameraSales)}`],
    ['Performer payouts', `🪙${fmt(stats.gross * 0.5)}`], ['Gifts', fmt(stats.gifts)], ['Songs played', fmt(stats.songs)],
    ['Viewers', fmt(viewers)], ['Queue', fmt(queue.length)], ['Private rooms', fmt(stats.privates)],
  ];
  return (
    <ScrollView contentContainerStyle={{ padding: 10, gap: 10 }} keyboardShouldPersistTaps="handled">
      <View style={st.giftGrid}>
        {tiles.map(([k, v]) => (
          <View key={k} style={[st.statTile]}>
            <Text style={st.meta}>{k}</Text>
            <Text style={st.statVal}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={st.card}>
        <Text style={st.h3}>📡 Master camera</Text>
        <View style={[st.row, { flexWrap: 'wrap', gap: 6, marginTop: 8 }]}>
          {CAMERAS.map((c) => (
            <Pressable key={c.id} onPress={() => setCam(c.id)} style={[st.chip, cam === c.id && st.chipOn]}>
              <Text style={[st.chipTxt, cam === c.id && { color: C.bg }]}>{c.icon} {c.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[st.row, { gap: 6, marginTop: 8 }]}>
          {[['top', '👑 Top earner'], ['selected', `🎯 ${selected ? selected.name : 'Selected'}`]].map(([k, l]) => (
            <Pressable key={k} onPress={() => setTarget(k)} style={[st.chip, target === k && st.chipOn]}>
              <Text style={[st.chipTxt, target === k && { color: C.bg }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[st.row, { gap: 8, marginTop: 10 }]}>
          <Pressable onPress={() => onCut(cam, target)} style={[st.btn, { flex: 1 }]}><Text style={st.btnTxt}>Broadcast to all</Text></Pressable>
          {directorCut && <Pressable onPress={onEndCut} style={[st.btnGhost, { flex: 1 }]}><Text style={st.btnGhostTxt}>End cut</Text></Pressable>}
        </View>
        {directorCut && (
          <Text style={[st.meta, { marginTop: 6, color: C.blue }]}>
            Live: {CAMERAS.find((c) => c.id === directorCut.cam).label}{directorCut.cam !== 'wide' ? ` on ${perf(directorCut.id)?.name}` : ''}
          </Text>
        )}
      </View>

      <View style={st.card}>
        <Text style={st.h3}>📢 Studio announcement</Text>
        <TextInput
          value={msg} onChangeText={setMsg} placeholder="e.g. Group dance at 10 PM! 💃" placeholderTextColor={C.dim}
          style={[st.input, { marginTop: 8 }]}
        />
        <Pressable onPress={() => { onAnnounce(msg); setMsg(''); }} style={[st.btn, { marginTop: 8 }]}><Text style={st.btnTxt}>Broadcast banner</Text></Pressable>
      </View>

      <View style={[st.row, { gap: 8 }]}>
        <Pressable onPress={onSpotlight} style={[st.btn, { flex: 1, backgroundColor: C.gold }]}><Text style={[st.btnTxt, { color: C.bg }]}>🌟 Spotlight top</Text></Pressable>
        <Pressable onPress={onGroup} style={[st.btn, { flex: 1 }, group && { opacity: 0.6 }]}><Text style={st.btnTxt}>💃 Group dance</Text></Pressable>
      </View>
      <Pressable onPress={onSkip} style={st.btnGhost}>
        <Text style={st.btnGhostTxt}>{nowPlaying ? `⏭ Skip "${nowPlaying.song.title}" & play next` : '▶ Play next request'}</Text>
      </Pressable>

      <View style={st.card}>
        <Text style={st.h3}>🏆 Top 5 performers</Text>
        {ranked.slice(0, 5).map((p, i) => (
          <View key={p.id} style={[st.row, { paddingVertical: 5 }]}>
            <Text style={[st.queuePos, { width: 28 }]}>{['👑', '🥈', '🥉', '4', '5'][i]}</Text>
            <Text style={[st.body, { flex: 1 }]}>{p.name} <Text style={st.meta}>· {p.style}</Text></Text>
            <Text style={st.giftCost}>🪙{fmt(p.coins)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ======================= private room =======================

function PrivateRoom({ room, p, now, pad, onEnd, onExtend }) {
  const { height } = useWindowDimensions();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const timers = useRef([]);
  const say = (m) => setMsgs((x) => [...x, { id: nid(), ...m }]);
  useEffect(() => {
    timers.current.push(setTimeout(() => say({ from: p.name, text: PRIVATE_LINES[0] }), 700));
    return () => timers.current.forEach(clearTimeout);
  }, []);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    say({ from: 'You', text: t });
    setText('');
    timers.current.push(setTimeout(() => say({ from: p.name, text: pick(PRIVATE_LINES.slice(1)) }), 1500));
  };
  const left = room.endsAt - now;
  return (
    <Modal visible animationType="slide" onRequestClose={onEnd}>
      <KeyboardAvoidingView behavior="padding" style={[st.root, pad]}>
        <View style={st.topBar}>
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <Text style={st.brand}>🔒 Private Room · <Text style={{ color: C.rose }}>{p?.name}</Text></Text>
            <Text style={st.meta}>Moderated session · {room.min} min booked</Text>
          </View>
          <View style={[st.coinPill, left < 60000 && { borderColor: C.red }]}><Text style={[st.coinTxt, left < 60000 && { color: C.red }]}>⏱ {mmss(left)}</Text></View>
        </View>
        <View style={[st.center, { height: height * 0.42, backgroundColor: C.bg2 }]}>
          <View style={[st.spotCone, { width: height * 0.4, height: height * 0.5, left: undefined }]} />
          {p && <Dancer p={p} size={height * 0.36} mode="performing" />}
          <View style={st.modTag}><Text style={st.modTxt}>🛡 Moderator present</Text></View>
        </View>
        <FlatList
          style={{ flex: 1 }} data={msgs} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 10 }}
          renderItem={({ item: m }) => (
            <View style={[st.bubble, m.from === 'You' ? st.bubbleMe : st.bubbleThem]}>
              <Text style={{ color: C.text }}>{m.text}</Text>
            </View>
          )}
        />
        <View style={[st.row, { gap: 8, paddingHorizontal: 10 }]}>
          <Pressable onPress={onExtend} style={[st.btnGhost, { flex: 1 }]}><Text style={st.btnGhostTxt}>+5 min · 500 🪙</Text></Pressable>
          <Pressable onPress={onEnd} style={[st.btn, { flex: 1, backgroundColor: C.red }]}><Text style={st.btnTxt}>Leave room</Text></Pressable>
        </View>
        <View style={st.inputRow}>
          <TextInput value={text} onChangeText={setText} placeholder={`Message ${p?.name}…`} placeholderTextColor={C.dim} style={st.input} onSubmitEditing={send} returnKeyType="send" />
          <Pressable onPress={send} style={st.sendBtn}><Text style={st.btnTxt}>Send</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ======================= styles =======================

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  backBtn: { width: 28, alignItems: 'center' },
  backTxt: { color: C.text, fontSize: 30, lineHeight: 32 },
  brand: { color: C.text, fontWeight: '800', fontSize: 15 },
  meta: { color: C.dim, fontSize: 12 },
  body: { color: C.text, fontSize: 14, lineHeight: 20 },
  h3: { color: C.text, fontWeight: '800', fontSize: 16 },
  vipTag: { marginLeft: 6, color: C.bg, backgroundColor: C.gold, fontSize: 10, fontWeight: '900', paddingHorizontal: 5, borderRadius: 4, overflow: 'hidden' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, marginRight: 5 },
  coinPill: { borderWidth: 1, borderColor: C.gold, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  coinTxt: { color: C.goldLight, fontWeight: '800', fontSize: 13 },
  rolePill: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.panel2 },
  roleTxt: { color: C.text, fontWeight: '700', fontSize: 12 },
  camBar: { flexGrow: 0, paddingVertical: 6 },
  camChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
  camChipOn: { backgroundColor: C.rose, borderColor: C.rose },
  camLabel: { color: C.text, fontSize: 12, fontWeight: '700' },
  camSub: { color: C.gold, fontSize: 10, fontWeight: '700' },
  stage: { alignSelf: 'center', borderRadius: 12, overflow: 'hidden', backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  cell: { borderWidth: 1, borderColor: 'rgba(58,38,89,0.6)', backgroundColor: '#170d27', overflow: 'hidden' },
  cellSel: { borderColor: C.rose, borderWidth: 2, backgroundColor: '#2a1236' },
  cellSpot: { borderColor: C.gold, borderWidth: 2 },
  cellPerf: { backgroundColor: '#2b1630' },
  spotBeam: { position: 'absolute', top: -20, left: '15%', width: '70%', height: '120%', backgroundColor: 'rgba(212,175,55,0.18)', borderBottomLeftRadius: 60, borderBottomRightRadius: 60 },
  cellRank: { color: C.gold, fontSize: 10, fontWeight: '800' },
  cellFoot: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 3, paddingBottom: 2, backgroundColor: 'rgba(10,6,18,0.7)' },
  cellName: { color: C.text, fontSize: 10, fontWeight: '700' },
  cellCoins: { color: C.goldLight, fontSize: 9 },
  spotCone: { position: 'absolute', top: -20, backgroundColor: 'rgba(255,107,157,0.08)', borderBottomLeftRadius: 400, borderBottomRightRadius: 400 },
  floorEllipse: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
  mirror: { borderWidth: 3, borderColor: C.gold, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'flex-end' },
  bulb: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#ffe9a8' },
  focusInfo: { position: 'absolute', left: 10, bottom: 8 },
  focusName: { color: C.text, fontSize: 20, fontWeight: '900' },
  focusBack: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(10,6,18,0.7)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.line },
  lockCard: { backgroundColor: C.panel, borderRadius: 14, padding: 16, alignItems: 'center', width: '75%', borderWidth: 1, borderColor: C.rose },
  cutTag: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(122,167,255,0.85)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  cutTxt: { color: C.bg, fontWeight: '800', fontSize: 11 },
  groupTag: { position: 'absolute', bottom: 6, alignSelf: 'center', backgroundColor: C.rose, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  groupTxt: { color: C.bg, fontWeight: '900', fontSize: 12 },
  banner: { position: 'absolute', top: 8, left: 10, right: 10, backgroundColor: 'rgba(20,11,34,0.95)', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bannerTxt: { fontWeight: '800', fontSize: 13, textAlign: 'center' },
  npStrip: { marginHorizontal: 8, marginTop: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.panel, borderRadius: 10 },
  npTxt: { color: C.text, fontSize: 12 },
  tabBar: { flexGrow: 0, paddingVertical: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: C.panel },
  tabOn: { backgroundColor: C.roseDim, borderWidth: 1, borderColor: C.rose },
  tabTxt: { color: C.dim, fontWeight: '700', fontSize: 13 },
  panel: { flex: 1, marginHorizontal: 8, backgroundColor: C.panel, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  chatLine: { fontSize: 13, lineHeight: 19, paddingVertical: 2, paddingHorizontal: 4, borderRadius: 6 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 8 },
  input: { flex: 1, backgroundColor: C.bg2, color: C.text, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.line },
  sendBtn: { backgroundColor: C.rose, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center' },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  giftCell: { width: '31.5%', backgroundColor: C.panel2, borderRadius: 12, alignItems: 'center', paddingVertical: 10, borderWidth: 1, borderColor: C.line },
  giftName: { color: C.text, fontSize: 12, fontWeight: '700', marginTop: 2 },
  giftCost: { color: C.goldLight, fontSize: 12, fontWeight: '800' },
  songRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: C.panel2, marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  songRowOn: { borderColor: C.rose, backgroundColor: '#3a1a3f' },
  songTitle: { color: C.text, fontWeight: '700', fontSize: 14 },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, backgroundColor: C.panel2, marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  queuePos: { color: C.gold, fontWeight: '900', width: 24, textAlign: 'center' },
  stepBtn: { width: 44, height: 40, borderRadius: 10, backgroundColor: C.roseDim, alignItems: 'center', justifyContent: 'center' },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line },
  perkIcon: { fontSize: 24 },
  card: { backgroundColor: C.panel2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line },
  bigNum: { color: C.goldLight, fontSize: 30, fontWeight: '900', marginVertical: 4 },
  bonusTag: { position: 'absolute', top: 6, right: 6, backgroundColor: C.green, borderRadius: 6, paddingHorizontal: 5 },
  bonusTxt: { color: C.bg, fontSize: 10, fontWeight: '900' },
  statTile: { width: '48.5%', backgroundColor: C.panel2, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.line },
  statVal: { color: C.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.gold, borderColor: C.gold },
  chipTxt: { color: C.text, fontSize: 12, fontWeight: '700' },
  btn: { backgroundColor: C.rose, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnGhost: { borderWidth: 1, borderColor: C.rose, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, alignItems: 'center' },
  btnGhostTxt: { color: C.rose, fontWeight: '800', fontSize: 13 },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(36,22,61,0.97)', borderColor: C.gold, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, maxWidth: '90%' },
  toastTxt: { color: C.text, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: C.panel, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.line },
  gateEmoji: { fontSize: 54, textAlign: 'center' },
  gateTitle: { color: C.rose, fontSize: 36, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  gateSub: { color: C.gold, fontSize: 14, fontWeight: '800', letterSpacing: 6, textAlign: 'center' },
  gateTag: { color: C.dim, fontSize: 15, textAlign: 'center', marginVertical: 22, lineHeight: 22 },
  studioCard: { backgroundColor: C.panel, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  studioPreview: { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 12, backgroundColor: C.bg2, height: 86, overflow: 'hidden' },
  studioName: { color: C.text, fontSize: 20, fontWeight: '900', marginTop: 6 },
  liveBadge: { backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 },
  liveBadgeTxt: { color: '#fff', fontWeight: '900', fontSize: 10 },
  tagTxt: { color: C.gold, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  modTag: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(61,220,151,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  modTxt: { color: C.green, fontWeight: '800', fontSize: 11 },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 14, marginBottom: 6 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: C.roseDim },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: C.panel2 },
});
