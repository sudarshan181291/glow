// The single live stage: every on-stage dancer performs together on one screen.
// When a dancer accepts a private room she walks off through the "Private rooms" door,
// and a dancer from the bench walks on from backstage to take the free spot.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Dancer from './Dancer';
import { Btn, Chip, Floater, Sheet, st, statusInfo } from './ui';
import { C, GIFTS, fmt, fmtK, mmss } from './data';
import { BookSheet, StageTab } from './customer';
import { isVip, topFanOf } from './store';
import { t } from './i18n';
import { DanceVideo, Poster } from './media';

// ---------- stage geometry ----------
function rowsFor(W, H) {
  return [
    { n: 5, size: H * 0.225, base: H * 0.975, span: 0.9, z: 30 }, // front
    { n: 6, size: H * 0.19, base: H * 0.72, span: 0.84, z: 20 }, // middle (staggered)
    { n: 5, size: H * 0.16, base: H * 0.5, span: 0.64, z: 10 }, // back
  ];
}
function buildSlots(W, H) {
  const rows = rowsFor(W, H);
  const out = [];
  rows.forEach((r, ri) => {
    const rowW = W * r.span;
    const order = r.n === 5 ? [2, 1, 3, 0, 4] : [2, 3, 1, 4, 0, 5];
    order.forEach((i) => {
      out.push({ x: (W - rowW) / 2 + (rowW * (i + 0.5)) / r.n, base: r.base, size: r.size, z: r.z + i, row: ri });
    });
  });
  return out; // filled front-centre first
}

function StageBackdrop({ W, H }) {
  const floorH = H * 0.6;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}>
      {/* back wall */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H * 0.45, backgroundColor: '#1a0b26' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: H * 0.12, height: H * 0.33, backgroundColor: '#22102f' }} />
      {/* arch of lights */}
      {Array.from({ length: 13 }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', top: 30 + Math.abs(6 - i) * 3, left: W * 0.1 + (W * 0.8 * i) / 12 - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: i % 2 ? C.goldLight : C.rose, opacity: 0.9 }} />
      ))}
      {/* floor (trapezoid) */}
      <View style={{ position: 'absolute', left: 0, bottom: 0, width: 0, height: 0, borderLeftWidth: W * 0.14, borderRightWidth: W * 0.14, borderBottomWidth: floorH, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#3a1d2c', width: W * 0.72 }} />
      {[0.25, 0.5, 0.75].map((f) => (
        <View key={f} style={{ position: 'absolute', left: W * (0.14 - 0.14 * f), right: W * (0.14 - 0.14 * f), bottom: floorH * (1 - f), height: 1, backgroundColor: 'rgba(212,175,55,0.18)' }} />
      ))}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: C.gold, opacity: 0.6 }} />
      {/* spotlights */}
      {[0.22, 0.5, 0.78].map((f, i) => (
        <View key={f} style={{ position: 'absolute', top: -10, left: W * f - W * 0.16, width: W * 0.32, height: H * 1.05, backgroundColor: i === 1 ? 'rgba(255,107,157,0.07)' : 'rgba(212,175,55,0.06)', borderBottomLeftRadius: W, borderBottomRightRadius: W }} />
      ))}
      {/* curtains + valance */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: W * 0.06, backgroundColor: '#5c0f24' }} />
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: W * 0.06, backgroundColor: '#5c0f24' }} />
      {[0.015, 0.035].map((f) => <View key={f} style={{ position: 'absolute', left: W * f, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(0,0,0,0.25)' }} />)}
      {[0.015, 0.035].map((f) => <View key={`r${f}`} style={{ position: 'absolute', right: W * f, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(0,0,0,0.25)' }} />)}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 16, backgroundColor: '#6e1430', borderBottomWidth: 2, borderColor: C.gold }} />
      {/* wings: backstage (left) and private-room door (right) */}
      <View style={{ position: 'absolute', left: W * 0.065, top: H * 0.3, width: 34, height: 52, borderRadius: 4, backgroundColor: '#140a1e', borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 9, color: C.dim, textAlign: 'center' }}>back{'\n'}stage</Text>
      </View>
      <View style={{ position: 'absolute', right: W * 0.065, top: H * 0.27, width: 40, height: 60, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#2d1426', borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14 }}>🔒</Text>
        <Text style={{ fontSize: 8, color: C.goldLight, fontWeight: '800', textAlign: 'center' }}>PRIVATE{'\n'}ROOMS</Text>
      </View>
    </View>
  );
}

// A dancer standing in her slot. Walks in from backstage when she joins.
function OnStage({ p, slot, enter, W, spotlight, performing, group, onPress, isTopFanMine }) {
  const a = useRef(new Animated.Value(enter ? 0 : 1)).current;
  useEffect(() => {
    if (enter) Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, []);
  const w = slot.size * 0.7;
  const fromX = W * 0.08 - slot.x;
  return (
    <Animated.View
      style={{
        position: 'absolute', left: slot.x - w / 2, top: slot.base - slot.size - 12, width: w, alignItems: 'center', zIndex: slot.z,
        opacity: a.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
        transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }) }],
      }}
    >
      <Pressable onPress={onPress} hitSlop={4} style={{ alignItems: 'center' }}>
        {spotlight && <View style={{ position: 'absolute', bottom: 8, width: w * 1.3, height: w * 0.35, borderRadius: w, backgroundColor: 'rgba(212,175,55,0.35)' }} />}
        <Dancer p={p} size={slot.size} group={group} mode={spotlight || performing ? 'performing' : 'normal'} />
        <View style={{ marginTop: -2, backgroundColor: spotlight ? C.gold : 'rgba(10,6,18,0.78)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, flexDirection: 'row', alignItems: 'center' }}>
          {p.isNew && <Text style={{ color: C.green, fontSize: 8, fontWeight: '900', marginRight: 3 }}>NEW</Text>}
          <Text numberOfLines={1} style={{ color: spotlight ? C.bg : C.text, fontSize: slot.row === 0 ? 10 : 9, fontWeight: '800' }}>{p.name}{isTopFanMine ? ' ⭐' : ''}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// A dancer leaving the stage: walks to the private-room door (right) or backstage (left).
function Leaving({ g, W, H, onDone }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => onDone(g.key));
  }, []);
  const w = g.slot.size * 0.7;
  const toPrivate = g.to === 'private';
  const targetX = toPrivate ? W * 0.9 : W * 0.1;
  const targetY = H * 0.3 + 30;
  const dx = targetX - g.slot.x;
  const dy = targetY - (g.slot.base - g.slot.size / 2);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: g.slot.x - w / 2, top: g.slot.base - g.slot.size - 12, width: w, alignItems: 'center', zIndex: 60,
        opacity: a.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
          { scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
        ],
      }}
    >
      <View style={{ backgroundColor: toPrivate ? C.amber : C.panel2, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2 }}>
        <Text numberOfLines={1} style={{ color: toPrivate ? C.bg : C.text, fontSize: 9, fontWeight: '900' }}>{toPrivate ? '🔒 private room' : g.to === 'break' ? '☕ break' : 'backstage'}</Text>
      </View>
      <Dancer p={g.p} size={g.slot.size} mode="backstage" />
      <Text numberOfLines={1} style={{ color: C.text, fontSize: 9, fontWeight: '800' }}>{g.p.name}</Text>
    </Animated.View>
  );
}

export function LiveStage({ S, act, rankOf, mode = 'stage' }) {
  const { width, height } = useWindowDimensions();
  const W = width;
  const H = Math.round(Math.min(540, Math.max(360, height * 0.56)));
  const SH = Math.min(H, W * 1.3);
  const slots = useMemo(() => buildSlots(W, SH), [W, SH]);
  const slotOf = useRef({});
  const prevStage = useRef(null);
  const [ghosts, setGhosts] = useState([]);
  const [sel, setSel] = useState(null);
  const [bookFor, setBookFor] = useState(null);
  const [msg, setMsg] = useState('');
  const now = S.now || Date.now();

  const onStage = S.roster.filter((p) => p.status === 'stage');
  const ids = new Set(onStage.map((p) => p.id));
  // stable slot assignment
  Object.keys(slotOf.current).forEach((k) => { if (!ids.has(Number(k))) delete slotOf.current[k]; });
  const used = new Set(Object.values(slotOf.current));
  const isFirst = prevStage.current === null;
  const entering = new Set();
  onStage.forEach((p) => {
    if (slotOf.current[p.id] == null) {
      let i = 0;
      while (used.has(i) && i < slots.length - 1) i += 1;
      slotOf.current[p.id] = i;
      used.add(i);
      if (!isFirst) entering.add(p.id);
    }
  });
  const enteringRef = useRef(new Set());
  entering.forEach((id) => enteringRef.current.add(id));

  // detect dancers who just left the stage
  const lastSlot = useRef({});
  useEffect(() => {
    const prev = prevStage.current;
    if (prev) {
      const left = [...prev].filter((id) => !ids.has(id));
      if (left.length) {
        setGhosts((g) => [...g, ...left.map((id) => {
          const p = S.roster.find((x) => x.id === id);
          return { key: `${id}-${Date.now()}`, p, slot: slots[lastSlot.current[id] ?? 0], to: p.status };
        })]);
        if (sel != null && left.includes(sel)) setSel(null);
      }
    }
    prevStage.current = ids;
    onStage.forEach((p) => { lastSlot.current[p.id] = slotOf.current[p.id]; });
  });

  const selP = sel != null ? S.roster.find((x) => x.id === sel) : null;
  const rooms = Array.from({ length: S.config.maxRooms }).map((_, i) => S.rooms[i] || null);
  const chat = S.stageChat || [];
  const vip = isVip(S.user, now);
  const send = () => { if (msg.trim()) { act.sendStageChat(msg.trim()); setMsg(''); } };

  return (
    <View style={{ flex: 1 }}>
      {mode === 'wall' && <VideoWall S={S} W={W} H={SH} rankOf={rankOf} onSelect={setSel} now={now} />}
      {/* the one shared stage */}
      {mode === 'stage' && <View style={{ width: W, height: SH, overflow: 'hidden', backgroundColor: C.bg2 }}>
        <StageBackdrop W={W} H={SH} />
        {onStage.map((p) => (
          <OnStage
            key={p.id} p={p} W={W} slot={slots[slotOf.current[p.id]]} enter={enteringRef.current.has(p.id)}
            spotlight={S.spotlight?.did === p.id} performing={S.songs.some((x) => x.did === p.id)}
            isTopFanMine={S.user.registered && topFanOf(p) === S.user.name}
            onPress={() => setSel(p.id)}
          />
        ))}
        {ghosts.map((g) => <Leaving key={g.key} g={g} W={W} H={SH} onDone={(k) => setGhosts((x) => x.filter((y) => y.key !== k))} />)}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: W, height: SH, zIndex: 80 }}>
          {S.floaters.filter((f) => ids.has(f.did)).map((f) => {
            const s = slots[slotOf.current[f.did]];
            if (f.kind === 'rain' || f.kind === 'royal' || !s) return <Floater key={f.id} item={f} w={W} h={SH} onDone={act.removeFloater} />;
            return (
              <View key={f.id} style={{ position: 'absolute', left: s.x - 60, top: s.base - s.size * 1.6, width: 120, height: s.size * 1.6 }}>
                <Floater item={f} w={120} h={s.size * 1.6} onDone={act.removeFloater} />
              </View>
            );
          })}
        </View>
        <View style={{ position: 'absolute', top: 22, left: W * 0.08, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 90 }}>
          <View style={{ backgroundColor: C.red, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>● LIVE</Text></View>
          <Text style={{ color: C.text, fontSize: 11, fontWeight: '700' }}>{onStage.length} on stage</Text>
        </View>
        <Text style={{ position: 'absolute', bottom: 6, alignSelf: 'center', color: C.dim, fontSize: 10, zIndex: 90 }}>Tap any dancer to gift, book or follow</Text>
      </View>}

      {/* private-room doors */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 8, paddingVertical: 6 }}>
        <View style={{ justifyContent: 'center', paddingRight: 2 }}>
          <Text style={{ color: C.goldLight, fontWeight: '900', fontSize: 11 }}>🔒 {S.rooms.length}/{S.config.maxRooms}</Text>
          <Text style={{ color: C.dim, fontSize: 9 }}>rooms</Text>
        </View>
        {rooms.map((r, i) => {
          const p = r ? S.roster.find((x) => x.id === r.did) : null;
          return (
            <Pressable
              key={r ? r.id : `free${i}`}
              onPress={() => p && act.watch(p.id)}
              style={{ width: 74, height: 46, borderRadius: 10, borderWidth: 1, borderColor: r?.mine ? C.green : r ? C.amber : C.line, backgroundColor: r ? '#2a1726' : C.panel, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}
            >
              {p ? (
                <>
                  <View style={{ width: 28, height: 44, justifyContent: 'flex-end', alignItems: 'center' }}><Dancer p={p} size={38} mode="backstage" /></View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: C.text, fontSize: 10, fontWeight: '800' }}>{p.name}</Text>
                    <Text style={{ color: r.mine ? C.green : C.amber, fontSize: 10, fontWeight: '800' }}>{r.mine ? 'you · ' : ''}{mmss(r.endsAt - now)}</Text>
                  </View>
                </>
              ) : (
                <Text style={{ color: C.dim, fontSize: 10, flex: 1, textAlign: 'center' }}>🚪 free</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* shared stage chat */}
      <FlatList
        style={{ flex: 1, paddingHorizontal: 10 }} inverted data={[...chat].reverse()} keyExtractor={(m) => m.id}
        renderItem={({ item: m }) => {
          if (m.kind === 'system') return <Text style={{ color: C.gold, fontSize: 12, paddingVertical: 1 }}>{m.text}</Text>;
          const color = { fan: C.blue, gift: C.goldLight, mygift: C.rose, dancer: C.rose, me: C.green }[m.kind] || C.text;
          return (
            <Text style={{ fontSize: 12.5, lineHeight: 18 }}>
              <Text style={{ color, fontWeight: '800' }}>{m.kind === 'dancer' ? '💃 ' : ''}{m.kind === 'me' && vip ? '💎 ' : ''}{m.user}</Text>
              <Text style={{ color: C.text }}>  {m.text}</Text>
            </Text>
          );
        }}
      />
      <View style={[st.row, { gap: 8, padding: 8 }]}>
        <TextInput value={msg} onChangeText={setMsg} placeholder={t(S.lang, 'saySomething')} placeholderTextColor={C.dim} style={[st.input, { flex: 1 }]} onSubmitEditing={send} returnKeyType="send" />
        <Btn small label={t(S.lang, 'send')} onPress={send} />
      </View>

      {/* quick actions for the tapped dancer */}
      {selP && (
        <Sheet visible onClose={() => setSel(null)} title={`${selP.name}  #${rankOf[selP.id]}`}>
          <View style={[st.row, { gap: 12 }]}>
            <DanceVideo p={selP} style={{ width: 72, height: 110, borderRadius: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: statusInfo(selP, S.lang, now).color, fontWeight: '800' }}>● {statusInfo(selP, S.lang, now).label}</Text>
              <Text style={st.meta}>{selP.specs.join(', ')} · {selP.langs.join(', ')}</Text>
              <Text style={st.meta}>🪙 {fmt(selP.coins)} · ★ {selP.rating.toFixed(1)} · {fmt(selP.followers)} followers</Text>
              <Text style={st.meta}>Top fan: {topFanOf(selP)}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
            {GIFTS.filter((g) => !g.exclusive).map((g) => (
              <Pressable key={g.id} onPress={() => act.sendGift(selP.id, g)} style={[st.box, { padding: 8, alignItems: 'center', width: 70 }]}>
                <Text style={{ fontSize: 24 }}>{g.emoji}</Text>
                <Text numberOfLines={1} style={{ color: C.text, fontSize: 10, fontWeight: '700' }}>{g.name}</Text>
                <Text style={[st.gold, { fontSize: 11 }]}>🪙{fmtK(vip ? Math.ceil(g.cost * 0.8) : g.cost)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[st.row, { gap: 8 }]}>
            <Btn label={`🔒 ${t(S.lang, 'book')}`} onPress={() => { setBookFor(selP.id); setSel(null); }} style={{ flex: 1 }} />
            <Btn kind="gold" label={`📣 ${S.config.shoutout}`} onPress={() => act.shoutOut(selP.id)} />
          </View>
          <View style={[st.row, { gap: 8, marginTop: 8 }]}>
            <Btn kind="dark" label={S.user.follows.includes(selP.id) ? `✓ ${t(S.lang, 'followingBtn')}` : `+ ${t(S.lang, 'follow')}`} onPress={() => act.follow(selP.id)} style={{ flex: 1 }} />
            <Btn kind="ghost" label="Profile & chat ›" onPress={() => { const id = selP.id; setSel(null); act.watch(id); }} style={{ flex: 1 }} />
          </View>
        </Sheet>
      )}
      {bookFor != null && (
        <BookSheet
          visible p={S.roster.find((x) => x.id === bookFor)} S={S} onClose={() => setBookFor(null)}
          onBook={(min, credit) => { const id = bookFor; setBookFor(null); act.book(id, min, credit); }}
        />
      )}
    </View>
  );
}

// Video wall: every on-stage dancer's performance video on one screen (group-show style).
function VideoWall({ S, W, H, rankOf, onSelect, now }) {
  const live = S.roster.filter((p) => p.status === 'stage').sort((a, b) => b.coins - a.coins);
  const priv = S.roster.filter((p) => p.status === 'private');
  const tw = (W - 4 * 4) / 3;
  const th = tw * 1.5;
  return (
    <View style={{ width: W, height: H, backgroundColor: '#000' }}>
      <FlatList
        data={[...live, ...priv]} keyExtractor={(p) => String(p.id)} numColumns={3}
        contentContainerStyle={{ padding: 4, gap: 4 }} columnWrapperStyle={{ gap: 4 }}
        initialNumToRender={9} maxToRenderPerBatch={3} windowSize={3} removeClippedSubviews
        renderItem={({ item: p }) => {
          const isLive = p.status === 'stage';
          const spot = S.spotlight?.did === p.id;
          return (
            <Pressable onPress={() => onSelect(p.id)} style={{ width: tw, height: th, borderRadius: 10, overflow: 'hidden', borderWidth: spot ? 2 : 1, borderColor: spot ? C.gold : isLive ? C.line : C.amber }}>
              {isLive && !(S.selfCamera && p.id === S.selfId) ? <DanceVideo p={p} style={{ width: '100%', height: '100%' }} /> : <Poster p={p} dim={!isLive} style={{ width: '100%', height: '100%' }} />}
              {S.selfCamera && p.id === S.selfId && <View style={{ position: 'absolute', top: th * 0.4, left: 0, right: 0, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 11, backgroundColor: C.red, paddingHorizontal: 6, borderRadius: 5, overflow: 'hidden' }}>📷 LIVE CAMERA</Text><Text style={{ color: '#fff', fontSize: 10 }}>tap to watch</Text></View>}
              <View style={{ position: 'absolute', top: 4, left: 4, flexDirection: 'row', gap: 3 }}>
                <Text style={{ color: C.gold, fontSize: 10, fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' }}>#{rankOf[p.id]}</Text>
                {p.isNew && <Text style={{ color: C.bg, fontSize: 9, fontWeight: '900', backgroundColor: C.green, paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' }}>NEW</Text>}
              </View>
              {isLive && <View style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: C.red }} />}
              {!isLive && (
                <View style={{ position: 'absolute', left: 0, right: 0, top: th * 0.38, alignItems: 'center' }}>
                  <Text style={{ fontSize: 18 }}>🔒</Text>
                  <Text style={{ color: C.amber, fontSize: 10, fontWeight: '800' }}>private · {Math.max(1, Math.ceil(((p.returnAt || now) - now) / 60000))} min</Text>
                </View>
              )}
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <Text numberOfLines={1} style={{ color: C.text, fontWeight: '800', fontSize: 12 }}>{p.name}</Text>
                <Text style={{ color: C.goldLight, fontSize: 10 }}>🪙{fmtK(p.coins)} · {p.langs[0]}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// Stage tab: the live stage by default; video wall and browse grid one tap away.
export function StageHome({ S, act, rankOf }) {
  const [view, setView] = useState('stage');
  return (
    <View style={{ flex: 1 }}>
      <View style={[st.row, { gap: 6, paddingHorizontal: 10, paddingVertical: 6 }]}>
        <Chip label="🎭 Live stage" on={view === 'stage'} onPress={() => setView('stage')} />
        <Chip label="📹 Video wall" on={view === 'wall'} onPress={() => setView('wall')} />
        <Chip label="▦ All dancers" on={view === 'grid'} onPress={() => setView('grid')} />
      </View>
      {view === 'grid' ? <StageTab S={S} act={act} rankOf={rankOf} /> : <LiveStage key={view} S={S} act={act} rankOf={rankOf} mode={view} />}
    </View>
  );
}
