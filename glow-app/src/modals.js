// Every overlay in the app, plus the host that animates them in and out.
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, KeyboardAvoidingView, Pressable, ScrollView, Share, StyleSheet, Switch, TextInput, View, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, shadow } from './theme';
import {
  CATS, FAQS, GIFTS, LIVES, LIVE_COMMENTS, MATCHES, MY_STORY, NOTIFS, PACKS, SELF_COMMENTS, SET_LABELS, STORIES, STORY_ORDER, USERS,
  fmt, liveOf, mmss, pick, rand,
} from './data';
import { useApp, U } from './store';
import { LiveCard, MatchItem, UserRow } from './components';
import { Avatar, AvatarDot, Btn, Card, FollowBtn, Grad, Icon, LiveBadge, Pulse, Ring, RoundBtn, SheetHead, Tap, Txt } from './ui';

/* =========================================================
   SHARE HELPER (uses the phone's share sheet)
   ========================================================= */
export async function shareProfile(id, toast) {
  const handle = id === 'me' ? 'priya.glows' : id;
  try {
    const r = await Share.share({ message: `Come hang out with me on Glow: https://glow.live/@${handle}` });
    if (r.action === Share.sharedAction) toast('Link shared', 'link');
  } catch {
    toast(`Link: glow.live/@${handle}`, 'link');
  }
}

/* =========================================================
   HOST: backdrop fade + panel scale 0.9 → 1
   ========================================================= */
export function ModalHost() {
  const { modals } = useApp();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {modals.map(m => <ModalFrame key={m.key} item={m} />)}
    </View>
  );
}

function ModalFrame({ item }) {
  const { remove, close } = useApp();
  const insets = useSafeAreaInsets();
  const v = useRef(new Animated.Value(0)).current;
  const def = REGISTRY[item.type];
  const kind = def.kind;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v]);
  useEffect(() => {
    if (item.closing) Animated.timing(v, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => remove(item.key));
  }, [item.closing, item.key, remove, v]);

  const onClose = () => close(item.key);
  const Comp = def.C;
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const anim = kind === 'sheet'
    ? { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }
    : { opacity: v, transform: [{ scale }] };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={item.closing ? 'none' : 'auto'}>
      {kind !== 'full' && (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: v }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Dismiss" />
        </Animated.View>
      )}
      <KeyboardAvoidingView behavior="padding" pointerEvents="box-none"
        style={[{ flex: 1 }, kind === 'sheet' && { justifyContent: 'flex-end' }, kind === 'center' && { justifyContent: 'center', paddingHorizontal: 22 }]}>
        {kind === 'full' && <Animated.View style={[{ flex: 1, backgroundColor: C.bg }, anim]}><Comp {...item.props} onClose={onClose} modalKey={item.key} /></Animated.View>}
        {kind === 'center' && <Animated.View style={[styles.center, anim]}><Comp {...item.props} onClose={onClose} modalKey={item.key} /></Animated.View>}
        {kind === 'sheet' && (
          <Animated.View style={[styles.sheet, anim]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
              <Comp {...item.props} onClose={onClose} modalKey={item.key} />
            </ScrollView>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/* =========================================================
   PROFILE
   ========================================================= */
function ProfileModal({ id, onClose }) {
  const { open, following, favs, setFavs, toast } = useApp();
  const { width } = useWindowDimensions();
  const u = USERS[id];
  const L = liveOf(id);
  const photoW = (Math.min(width, 520) - 40 - 12) / 3;
  const icons = ['mountain-sun', 'mug-hot', 'music', 'camera-retro', 'umbrella-beach', 'star'];
  const interests = { Music: ['Deep house', 'Vinyl', 'Festivals'], Chat: ['Podcasts', 'Coffee', 'Travel'], Dance: ['Choreo', 'K-pop', 'Salsa'], Gaming: ['Ranked', 'Speedruns', 'Co-op'] }[u.cat];
  const fav = i => {
    const k = id + i;
    const on = !favs.has(k);
    setFavs(p => { const n = new Set(p); on ? n.add(k) : n.delete(k); return n; });
    toast(on ? 'Added to favorites' : 'Removed from favorites', on ? 'heart' : 'heart-crack');
  };
  return (
    <View>
      <LinearGradient colors={u.c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pmCover}>
        <View style={{ position: 'absolute', top: 14, right: 14 }}><RoundBtn icon="xmark" size={36} bg="rgba(255,255,255,0.3)" color="#fff" onPress={onClose} label="Close" /></View>
      </LinearGradient>
      <View style={{ alignItems: 'center', marginTop: -56, paddingHorizontal: 20 }}>
        <Ring size={116} pad={4}>
          {L ? <Pulse size={100} color={C.pink}><Avatar id={id} size={100} border={4} borderColor={C.bg} /></Pulse> : <Avatar id={id} size={100} border={4} borderColor={C.bg} />}
        </Ring>
        <Txt w={800} size={22} color={C.ink2} style={{ marginTop: 8 }}>{u.name}, {u.age}</Txt>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Txt w={600} size={12.5} color={C.muted}>📍 {u.city} · {u.km} km</Txt>
          <Txt w={600} size={12.5} color={u.online ? '#15803d' : C.muted}>● {u.online ? 'Online now' : 'Active 2h ago'}</Txt>
        </View>
        <Txt size={14} color="#5d4f6b" style={{ textAlign: 'center', marginTop: 10, lineHeight: 21, maxWidth: 300 }}>{u.bio}</Txt>
        <View style={styles.stats}>
          {[[fmt(u.followers + (following.has(id) ? 1 : 0)), 'Followers'], [fmt(u.following), 'Following'], [fmt(Math.round(u.followers * 1.7)), 'Hearts']].map(([v, l], i) => (
            <View key={l} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}>
              <Txt w={800} size={18} color={C.ink2}>{v}</Txt>
              <Txt w={600} size={11} color={C.muted} style={{ letterSpacing: 0.6 }}>{l.toUpperCase()}</Txt>
            </View>
          ))}
        </View>
      </View>
      {L && (
        <Tap onPress={() => open('live', { id })} style={styles.pmWatch}>
          <LiveBadge />
          <Txt w={700} size={13.5} color="#c0224f" style={{ flex: 1 }} numberOfLines={1}>{L.title}</Txt>
          <Icon name="play" size={13} color="#c0224f" />
        </Tap>
      )}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16 }}>
        <FollowBtn id={id} big />
        <RoundBtn icon="comment-dots" onPress={() => open('chat', { id })} label="Message" />
        <RoundBtn icon="video" onPress={() => open('call', { id })} label="Video call" />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 14 }}>
        {[...interests, u.cat].map(t => <View key={t} style={styles.tagPill}><Txt w={600} size={12} color="#5d4f6b">{t}</Txt></View>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20, paddingTop: 16 }}>
        {icons.map((ic, i) => {
          const on = favs.has(id + i);
          return (
            <Tap key={i} onPress={() => fav(i)} style={{ width: photoW, height: photoW * 1.33, borderRadius: 14, overflow: 'hidden', borderWidth: on ? 3 : 0, borderColor: C.pink }}>
              <LinearGradient colors={i % 2 ? [u.c[1], u.c[0]] : u.c} start={{ x: i * 0.15, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={ic} size={22} color="rgba(255,255,255,0.85)" />
                {on && <View style={{ position: 'absolute', top: 6, right: 6 }}><Icon name="heart" size={12} color="#fff" /></View>}
              </LinearGradient>
            </Tap>
          );
        })}
      </View>
      <Tap onPress={() => open('confirm', { kind: 'block', id })} style={{ alignSelf: 'center', marginTop: 18, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Icon name="flag" size={12} color={C.muted} /><Txt w={600} size={13} color={C.muted}>Report or block {u.name}</Txt>
      </Tap>
    </View>
  );
}

/* =========================================================
   LIVE VIEWER
   ========================================================= */
function FloatHeart({ h, onDone }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: h.d, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onDone(h.k));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.Text style={{
      position: 'absolute', bottom: 0, left: 18, fontSize: h.size, color: h.color,
      opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
      transform: [
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -300] }) },
        { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, h.x] }) },
        { scale: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1, 1.1] }) },
      ],
    }}>♥</Animated.Text>
  );
}

function GiftBurst({ g, onDone }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => onDone(g.k));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.Text pointerEvents="none" style={{
      position: 'absolute', alignSelf: 'center', top: '32%', fontSize: 84,
      opacity: v.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 1, 1, 0] }),
      transform: [
        { scale: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.2, 1.15, 0.85] }) },
        { translateY: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, -20, -120] }) },
      ],
    }}>{g.e}</Animated.Text>
  );
}

function Comment({ c }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 280, useNativeDriver: true }).start(); }, [v]);
  return (
    <Animated.View style={[styles.cmt, c.sys && { backgroundColor: 'rgba(250,61,108,0.45)' }, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      <Avatar id={c.id} size={22} />
      <Txt w={700} size={12.5} color="#ffc0d3">{c.name}</Txt>
      <Txt size={12.5} color="#fff" style={{ flexShrink: 1 }}>{c.text}</Txt>
    </Animated.View>
  );
}

function PopButton({ onPress, children, style, label }) {
  const s = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.timing(s, { toValue: 1.3, duration: 140, useNativeDriver: true }),
      Animated.spring(s, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress && onPress();
  };
  return (
    <Tap onPress={press} accessibilityLabel={label}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Tap>
  );
}

const VIEWER_IDS = ['sam', 'lena', 'marcus', 'nina', 'oliver', 'taylor', 'casey', 'dana', 'jordan', 'maya', 'alex'];

function LiveModal({ id, self, onClose }) {
  const { open, following, toggleFollow, liked, setLiked, toast } = useApp();
  const insets = useSafeAreaInsets();
  const isMe = id === 'me';
  const L = isMe ? { id: 'me', title: self.title, cat: self.cat, viewers: 0, likes: 0 } : liveOf(id);
  const u = isMe ? { name: 'You', c: ['#fa3d6c', '#a24bcf'] } : USERS[id];
  const [viewers, setViewers] = useState(L.viewers);
  const [likes, setLikes] = useState(L.likes);
  const [secs, setSecs] = useState(0);
  const [comments, setComments] = useState([{ k: 0, id: isMe ? 'me' : id, name: 'Glow', text: isMe ? 'You are live! Viewers are joining…' : `Welcome to ${u.name}’s live. Be kind 💜`, sys: true }]);
  const [hearts, setHearts] = useState([]);
  const [bursts, setBursts] = useState([]);
  const [text, setText] = useState('');
  const seq = useRef(1);
  const stats = useRef({ secs: 0, viewers: L.viewers });
  const isLiked = liked.has(id);

  const addComment = (c) => setComments(p => [...p.slice(-5), { k: seq.current++, ...c }]);
  const addHeart = (big) => {
    const cols = ['#fa3d6c', '#ff8fb3', '#ffffff', '#ffc46b', '#c58bff'];
    setHearts(p => [...p.slice(-24), { k: seq.current++, x: rand(-40, 40), color: big ? C.pink : pick(cols), size: big ? 34 : rand(16, 26), d: rand(2000, 3000) }]);
  };

  useEffect(() => {
    const t1 = setInterval(() => {
      const who = pick(VIEWER_IDS.filter(x => x !== id));
      addComment({ id: who, name: USERS[who].name, text: isMe ? pick(SELF_COMMENTS) : pick(LIVE_COMMENTS) });
    }, 2300);
    const t2 = setInterval(() => {
      setViewers(v => { const n = Math.max(0, v + (isMe ? rand(1, 6) : rand(-8, 14))); stats.current.viewers = n; return n; });
      if (isMe) setSecs(s => { stats.current.secs = s + 1; return s + 1; });
    }, 1000);
    const t3 = setInterval(() => { addHeart(false); if (Math.random() > 0.5) setLikes(l => l + 1); }, 700);
    return () => {
      clearInterval(t1); clearInterval(t2); clearInterval(t3);
      if (isMe) toast(`Live ended · ${mmss(stats.current.secs)} · ${stats.current.viewers} viewers`, 'tower-broadcast');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const v = text.trim(); if (!v) return;
    addComment({ id: 'me', name: 'You', text: v }); setText(''); toast('Comment sent', 'paper-plane');
  };
  const like = () => {
    const on = !isLiked;
    setLiked(p => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n; });
    if (on) { setLikes(l => l + 1); for (let i = 0; i < 4; i++) setTimeout(() => addHeart(true), i * 90); }
    toast(on ? `You liked ${isMe ? 'your live' : u.name + '’s live'}` : 'Like removed', 'heart');
  };
  const gift = () => {
    if (isMe) { toast('Viewers send you gifts here', 'gift'); return; }
    open('gifts', { id, onSent: g => {
      setBursts(p => [...p, { k: seq.current++, e: g.e }]);
      setLikes(l => l + g.p);
      addComment({ id: 'me', name: 'You', text: `sent a ${g.n} ${g.e}`, sys: true });
    } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.ink2 }}>
      <LinearGradient colors={[u.c[0], u.c[1], C.ink2]} locations={[0, 0.35, 0.8]} style={StyleSheet.absoluteFill} />
      <View style={[styles.lvTop, { paddingTop: insets.top + 8 }]}>
        <Tap onPress={() => (isMe ? toast('Streaming as you', 'tower-broadcast') : open('profile', { id }))} style={styles.lvHost}>
          <Avatar id={isMe ? 'me' : id} size={36} border={2} />
          <View>
            <Txt w={700} size={13.5} color="#fff">{u.name}</Txt>
            <Txt size={11} color="rgba(255,255,255,0.8)">♥ {fmt(likes)}</Txt>
          </View>
        </Tap>
        {!isMe && (
          <Tap onPress={() => toggleFollow(id)} style={[styles.lvFollow, following.has(id) && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Txt w={800} size={12} color="#fff">{following.has(id) ? 'Following' : 'Follow'}</Txt>
          </Tap>
        )}
        <View style={{ marginLeft: 'auto', alignItems: 'flex-end', gap: 6 }}>
          <LiveBadge extra={isMe ? mmss(secs) : null} />
          <View style={styles.vc}><Icon name="eye" size={10} color="#fff" /><Txt w={700} size={11} color="#fff">{fmt(viewers)}</Txt></View>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, paddingBottom: 150 }}>
        <Pulse size={150} width={3} spread={10}><Avatar id={isMe ? 'me' : id} size={150} border={4} borderColor="rgba(255,255,255,0.9)" /></Pulse>
        <Txt w={800} size={17} color="#fff" style={{ textAlign: 'center', marginTop: 10 }}>{L.title}</Txt>
        <View style={styles.lvCat}><Txt w={700} size={12} color="#fff">{L.cat}</Txt></View>
      </View>

      <View pointerEvents="none" style={[styles.hearts, { bottom: 90 + insets.bottom }]}>
        {hearts.map(h => <FloatHeart key={h.k} h={h} onDone={k => setHearts(p => p.filter(x => x.k !== k))} />)}
      </View>
      {bursts.map(g => <GiftBurst key={g.k} g={g} onDone={k => setBursts(p => p.filter(x => x.k !== k))} />)}
      <View pointerEvents="none" style={[styles.comments, { bottom: 76 + insets.bottom }]}>
        {comments.map(c => <Comment key={c.k} c={c} />)}
      </View>

      <View style={[styles.lvBar, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput value={text} onChangeText={setText} onSubmitEditing={send} placeholder={isMe ? 'Say hi to your viewers…' : 'Say something nice…'}
          placeholderTextColor="rgba(255,255,255,0.7)" style={styles.lvInput} returnKeyType="send" maxLength={80} />
        <Tap onPress={send} accessibilityLabel="Send comment"><Grad style={styles.lvBtn}><Icon name="paper-plane" size={14} color="#fff" /></Grad></Tap>
        <PopButton onPress={like} label="Like" style={[styles.lvBtn, isLiked && { backgroundColor: '#fff' }]}><Icon name="heart" size={15} color={isLiked ? C.pink : '#fff'} /></PopButton>
        <Tap onPress={gift} accessibilityLabel="Send gift"><Grad colors={['#ffb347', '#fa3d6c']} style={styles.lvBtn}><Icon name="gift" size={15} color="#fff" /></Grad></Tap>
        <Tap onPress={() => shareProfile(id, toast)} style={styles.lvBtn} accessibilityLabel="Share"><Icon name="share" size={15} color="#fff" /></Tap>
        <Tap onPress={onClose} style={styles.lvBtn} accessibilityLabel="Close live"><Icon name="xmark" size={16} color="#fff" /></Tap>
      </View>
    </View>
  );
}

/* =========================================================
   STORY VIEWER
   ========================================================= */
const STORY_MS = 4500;
function StoryModal({ start = 0, list = STORY_ORDER, onClose }) {
  const { open, setSeen, pushMsg, ensureChat, scheduleReply, toast } = useApp();
  const insets = useSafeAreaInsets();
  const [ui, setUi] = useState(start);
  const [fi, setFi] = useState(0);
  const [reply, setReply] = useState('');
  const [liked, setLiked] = useState(false);
  const prog = useRef(new Animated.Value(0)).current;
  const pos = useRef({ ui: start, fi: 0 });
  pos.current = { ui, fi };
  const id = list[ui];
  const frames = id === 'me' ? MY_STORY : STORIES[id];
  const f = frames[fi];
  const u = id === 'me' ? { name: 'Your story', c: ['#fa3d6c', '#a24bcf'] } : USERS[id];

  const next = () => {
    const { ui: a, fi: b } = pos.current;
    const fr = list[a] === 'me' ? MY_STORY : STORIES[list[a]];
    if (b < fr.length - 1) setFi(b + 1);
    else if (a < list.length - 1) { setUi(a + 1); setFi(0); }
    else onClose();
  };
  const prev = () => {
    const { ui: a, fi: b } = pos.current;
    if (b > 0) setFi(b - 1);
    else if (a > 0) { const fr = list[a - 1] === 'me' ? MY_STORY : STORIES[list[a - 1]]; setUi(a - 1); setFi(fr.length - 1); }
    else { setFi(0); prog.setValue(0); run(1); }
  };
  const run = (fraction) => {
    Animated.timing(prog, { toValue: 1, duration: STORY_MS * fraction, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => { if (finished) next(); });
  };
  useEffect(() => {
    if (id !== 'me') setSeen(p => new Set(p).add(id));
    setLiked(false);
    prog.setValue(0);
    run(1);
    return () => prog.stopAnimation();
  }, [ui, fi]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = () => prog.stopAnimation();
  const resume = () => prog.stopAnimation(v => run(Math.max(0.05, 1 - v)));
  const sendReply = () => {
    const v = reply.trim(); if (!v) return;
    ensureChat(id); pushMsg(id, 'me', `Replied to your story: ${v}`); scheduleReply(id);
    setReply(''); toast(`Reply sent to ${USERS[id].name}`, 'paper-plane');
  };

  return (
    <LinearGradient colors={u.c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.35)']} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: insets.top + 8 }}>
        {frames.map((_, i) => (
          <View key={i} style={styles.svBar}>
            <Animated.View style={{ height: 3, backgroundColor: '#fff', width: i < fi ? '100%' : i === fi ? prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }} />
          </View>
        ))}
      </View>
      <View style={styles.svHead}>
        <Tap onPress={() => (id === 'me' ? toast('That’s you!', 'user') : open('profile', { id }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Avatar id={id} size={36} border={2} />
          <Txt w={700} size={14} color="#fff">{u.name}</Txt>
          <Txt size={12} color="rgba(255,255,255,0.75)">{f.time}</Txt>
        </Tap>
        <RoundBtn icon="xmark" size={40} bg="rgba(255,255,255,0.18)" color="#fff" onPress={onClose} label="Close story" />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 16 }}>
          <Txt size={84}>{f.e}</Txt>
          <Txt w={800} size={24} color="#fff" style={{ textAlign: 'center', lineHeight: 31 }}>{f.t}</Txt>
        </View>
        <Pressable style={[styles.zone, { left: 0 }]} onPress={prev} accessibilityLabel="Previous" />
        <Pressable style={[styles.zone, { right: 0 }]} onPress={next} accessibilityLabel="Next" />
      </View>

      <View style={styles.svNav}>
        <Tap onPress={prev} style={styles.svNavBtn}><Icon name="chevron-left" size={12} color="#fff" /><Txt w={700} size={13} color="#fff">Prev</Txt></Tap>
        <Txt w={700} size={12} color="#fff">{ui + 1} / {list.length}</Txt>
        <Tap onPress={next} style={styles.svNavBtn}><Txt w={700} size={13} color="#fff">Next</Txt><Icon name="chevron-right" size={12} color="#fff" /></Tap>
      </View>
      <View style={[styles.svReply, { paddingBottom: insets.bottom + 14 }]}>
        {id === 'me' ? (
          <Txt w={700} size={13.5} color="#fff" style={{ paddingVertical: 12 }}>👁 214 views · 38 hearts</Txt>
        ) : (
          <>
            <TextInput value={reply} onChangeText={setReply} onFocus={pause} onBlur={resume} onSubmitEditing={sendReply} returnKeyType="send"
              placeholder={`Reply to ${USERS[id].name}…`} placeholderTextColor="rgba(255,255,255,0.8)" style={styles.svInput} maxLength={80} />
            <PopButton onPress={() => { setLiked(!liked); toast(liked ? 'Like removed' : `You liked ${USERS[id].name}’s story`, 'heart'); }} label="Like story" style={styles.svIcon}>
              <Icon name="heart" size={17} color={liked ? C.pink : '#fff'} />
            </PopButton>
            <Tap onPress={sendReply} style={styles.svIcon} accessibilityLabel="Send reply"><Icon name="paper-plane" size={16} color="#fff" /></Tap>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

function MyStorySheet({ onClose }) {
  const { setMyStory, toast } = useApp();
  const opts = [['camera', 'Take a photo', 'Opens your camera'], ['images', 'Choose from gallery', 'Pick a recent photo'], ['font', 'Write something', 'Coloured background, big type'], ['music', 'Share a song', 'Add what you’re listening to']];
  return (
    <View>
      <SheetHead title="Add to your story" onClose={onClose} />
      <View style={{ paddingHorizontal: 10 }}>
        {opts.map(([ic, t, s]) => (
          <Tap key={t} onPress={() => { onClose(); setMyStory(true); toast('Your story is live for 24 hours', 'circle-plus'); }} style={styles.row}>
            <View style={styles.mic}><Icon name={ic} size={15} color={C.g2} /></View>
            <View style={{ flex: 1 }}><Txt w={700} size={14.5} color={C.ink2}>{t}</Txt><Txt size={12.5} color={C.muted}>{s}</Txt></View>
            <Icon name="chevron-right" size={12} color="#c4b6d4" />
          </Tap>
        ))}
      </View>
    </View>
  );
}

/* =========================================================
   CHAT
   ========================================================= */
function Typing() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const loops = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(300 - i * 150),
    ])));
    loops.forEach(l => l.start()); return () => loops.forEach(l => l.stop());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={[styles.msg, styles.them, { flexDirection: 'row', gap: 4, paddingVertical: 14 }]}>
      {dots.map((d, i) => <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#c4b6d4', transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }} />)}
    </View>
  );
}

function ChatModal({ id, onClose, modalKey }) {
  const { open, chats, ensureChat, sendMessage, markRead, typing, activeChat, toast } = useApp();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const scroll = useRef(null);
  const u = USERS[id];
  const c = chats[id];

  useEffect(() => {
    ensureChat(id);
    activeChat.current = { id, key: modalKey };
    return () => { if (activeChat.current?.key === modalKey) activeChat.current = null; };
  }, [id, modalKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (c?.unread) markRead(id); }, [c?.unread, id, markRead]);

  const send = (v = text) => {
    const t = v.trim(); if (!t) return;
    sendMessage(id, t); setText(''); toast('Message sent', 'paper-plane');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.chHead, { paddingTop: insets.top + 8 }]}>
        <RoundBtn icon="arrow-left" size={38} color={C.ink} onPress={onClose} label="Back" />
        <Tap onPress={() => open('profile', { id })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <AvatarDot id={id} size={42} />
          <View>
            <Txt w={700} size={15.5} color={C.ink2}>{u.name}</Txt>
            <Txt w={600} size={12} color={u.online ? '#15803d' : C.muted}>{u.online ? 'Online now' : 'Active 2h ago'}</Txt>
          </View>
        </Tap>
        <RoundBtn icon="phone" size={38} onPress={() => open('call', { id, voice: true })} label="Voice call" />
        <RoundBtn icon="video" size={38} onPress={() => open('call', { id })} label="Video call" />
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: 14, gap: 6 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
        <View style={styles.day}><Txt w={700} size={11} color={C.muted}>Today</Txt></View>
        {(c?.msgs || []).map(([who, t, time], i) => who === 'event' ? (
          <View key={i} style={{ alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', padding: 4 }}>
            <Icon name="star" size={11} color={C.muted} /><Txt w={600} size={12.5} color={C.muted}>{t}</Txt>
          </View>
        ) : (
          <View key={i} style={{ alignSelf: who === 'me' ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
            {who === 'me'
              ? <Grad style={[styles.msg, styles.mine]}><Txt size={14} color="#fff" style={{ lineHeight: 20 }}>{t}</Txt></Grad>
              : <View style={[styles.msg, styles.them]}><Txt size={14} color={C.ink2} style={{ lineHeight: 20 }}>{t}</Txt></View>}
            {time ? <Txt size={10.5} color={C.muted} style={{ alignSelf: who === 'me' ? 'flex-end' : 'flex-start', marginTop: 3, marginHorizontal: 4 }}>{time}</Txt> : null}
          </View>
        ))}
        {typing === id && <Typing />}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: '#fff' }} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
        {['👋 Hey!', 'Wanna video call?', 'Love your live 🔥', 'What are you up to?'].map(q => (
          <Tap key={q} onPress={() => send(q)} style={styles.quick}><Txt w={600} size={12.5} color={C.g2}>{q}</Txt></Tap>
        ))}
      </ScrollView>
      <View style={[styles.chInput, { paddingBottom: insets.bottom + 10 }]}>
        <RoundBtn icon="gift" size={44} onPress={() => open('gifts', { id, onSent: g => {
          const { pushMsg, scheduleReply } = appRef.current;
          pushMsg(id, 'event', `You sent ${u.name} a ${g.n} ${g.e}`, false); scheduleReply(id);
        } })} label="Send gift" />
        <TextInput value={text} onChangeText={setText} onSubmitEditing={() => send()} returnKeyType="send" blurOnSubmit={false}
          placeholder={`Message ${u.name}…`} placeholderTextColor={C.muted} style={styles.chField} maxLength={300} />
        <Tap onPress={() => send()} accessibilityLabel="Send"><Grad style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}><Icon name="paper-plane" size={15} color="#fff" /></Grad></Tap>
      </View>
    </View>
  );
}
// Gift callbacks run after the tray closes, so they read the latest actions from here.
const appRef = { current: null };
export function AppRefBinder() { appRef.current = useApp(); return null; }

/* =========================================================
   CALL
   ========================================================= */
function CallModal({ id, voice, onClose }) {
  const { toast } = useApp();
  const insets = useSafeAreaInsets();
  const u = USERS[id];
  const [status, setStatus] = useState(voice ? 'Voice calling…' : 'Video calling…');
  const [secs, setSecs] = useState(0);
  const [on, setOn] = useState({ mute: false, cam: false, speaker: false, effects: false });
  const info = useRef({ connected: false, secs: 0 });

  useEffect(() => {
    const t0 = setTimeout(() => setStatus('Ringing…'), 900);
    let t2;
    const t1 = setTimeout(() => {
      info.current.connected = true; setStatus(null); toast(`Connected with ${u.name}`, 'phone');
      t2 = setInterval(() => setSecs(s => { info.current.secs = s + 1; return s + 1; }), 1000);
    }, 2400);
    return () => {
      clearTimeout(t0); clearTimeout(t1); clearInterval(t2);
      toast(info.current.connected ? `Call ended · ${mmss(info.current.secs)}` : `Call to ${u.name} cancelled`, 'phone-slash');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const MSG = { mute: ['Microphone muted', 'Microphone on', 'microphone-slash'], cam: ['Camera off', 'Camera on', 'video-slash'], speaker: ['Speaker on', 'Speaker off', 'volume-high'], effects: ['Beauty filter on', 'Filters off', 'wand-magic-sparkles'] };
  const toggle = k => { const n = !on[k]; setOn(p => ({ ...p, [k]: n })); toast(MSG[k][n ? 0 : 1], MSG[k][2]); };
  const ctrls = [['mute', 'microphone-slash', 'Mute'], ...(voice ? [] : [['cam', 'video-slash', 'Camera']]), ['speaker', 'volume-high', 'Speaker'], ['effects', 'wand-magic-sparkles', 'Effects']];

  return (
    <View style={{ flex: 1, backgroundColor: C.ink2 }}>
      <LinearGradient colors={[u.c[0], u.c[1], C.ink2]} locations={[0, 0.4, 0.85]} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: insets.top + 8 }}>
        <RoundBtn icon="chevron-down" size={42} bg="rgba(255,255,255,0.15)" color="#fff" onPress={onClose} label="End and close" />
        <Txt w={600} size={12} color="rgba(255,255,255,0.8)">🔒 End-to-end encrypted</Txt>
        <View style={{ width: 42 }} />
      </View>
      {!voice && (
        <View style={[styles.callSelf, { top: insets.top + 64, opacity: on.cam ? 0.45 : 1 }]}>
          <Avatar id="me" size={52} /><Txt w={700} size={11} color="#fff">{on.cam ? 'Camera off' : 'You'}</Txt>
        </View>
      )}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 40 }}>
        <Pulse size={132} width={3} spread={10}><Avatar id={id} size={132} border={4} borderColor="rgba(255,255,255,0.9)" /></Pulse>
        <Txt w={800} size={28} color="#fff" style={{ marginTop: 18 }}>{u.name}</Txt>
        <Txt size={15} color="rgba(255,255,255,0.85)">{status || mmss(secs)}</Txt>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, paddingBottom: insets.bottom + 32, paddingHorizontal: 12 }}>
        {ctrls.map(([k, ic, l]) => (
          <Tap key={k} onPress={() => toggle(k)} style={{ alignItems: 'center', gap: 6 }}>
            <View style={[styles.cbtn, on[k] && { backgroundColor: '#fff' }]}><Icon name={ic} size={19} color={on[k] ? C.ink2 : '#fff'} /></View>
            <Txt w={600} size={11} color="rgba(255,255,255,0.85)">{l}</Txt>
          </Tap>
        ))}
        <Tap onPress={onClose} style={{ alignItems: 'center', gap: 6 }}>
          <View style={[styles.cbtn, { backgroundColor: '#ef4444' }]}><Icon name="phone-slash" size={19} color="#fff" /></View>
          <Txt w={600} size={11} color="rgba(255,255,255,0.85)">End</Txt>
        </Tap>
      </View>
    </View>
  );
}

/* =========================================================
   SEARCH + NOTIFICATIONS
   ========================================================= */
function SearchModal({ onClose }) {
  const { recent, setRecent, toast } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const tagMap = { deephouse: 'music', kpopdance: 'dance', speedrun: 'gaming', acoustic: 'music', latenight: 'chat', goa: 'goa' };
  const qq = (tagMap[q.trim().toLowerCase()] || q.trim().toLowerCase());
  const res = qq ? Object.keys(USERS).filter(id => { const u = USERS[id]; return [u.name, u.city, u.cat, u.bio].join(' ').toLowerCase().includes(qq); }) : [];
  const submit = () => { const v = q.trim(); if (!v) return; setRecent(r => [v, ...r.filter(x => x !== v)].slice(0, 5)); toast(`Searching for “${v}”`, 'magnifying-glass'); };
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10 }}>
        <RoundBtn icon="arrow-left" size={38} color={C.ink} onPress={onClose} label="Back" />
        <View style={[styles.searchBar, shadow]}>
          <Icon name="magnifying-glass" size={15} color={C.muted} />
          <TextInput autoFocus value={q} onChangeText={setQ} onSubmitEditing={submit} returnKeyType="search" placeholder="Search people, cities, vibes" placeholderTextColor={C.muted} style={styles.searchInput} />
          {q ? <Tap onPress={() => setQ('')} hitSlop={8}><Icon name="circle-xmark" size={15} color={C.muted} /></Tap> : null}
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {!qq ? (
          <>
            {recent.length > 0 && (
              <>
                <View style={styles.label}><Txt w={800} size={12} color={C.muted} style={{ letterSpacing: 1 }}>RECENT</Txt>
                  <Tap onPress={() => { setRecent([]); toast('Recent searches cleared', 'trash'); }}><Txt w={700} size={12} color={C.g1}>Clear</Txt></Tap></View>
                <View style={styles.taglist}>{recent.map(r => <Chip key={r} icon="clock-rotate-left" label={r} onPress={() => setQ(r)} />)}</View>
              </>
            )}
            <View style={styles.label}><Txt w={800} size={12} color={C.muted} style={{ letterSpacing: 1 }}>TRENDING TAGS</Txt></View>
            <View style={styles.taglist}>{['deephouse', 'kpopdance', 'speedrun', 'acoustic', 'latenight', 'goa'].map(t => <Chip key={t} label={'#' + t} onPress={() => setQ(t)} />)}</View>
            <View style={styles.label}><Txt w={800} size={12} color={C.muted} style={{ letterSpacing: 1 }}>SUGGESTED FOR YOU</Txt></View>
            <View style={{ paddingHorizontal: 10 }}>{['maya', 'jordan', 'lena', 'sam'].map(id => <UserRow key={id} id={id} sub={`${USERS[id].city} · ${USERS[id].cat}`} />)}</View>
          </>
        ) : (
          <>
            <View style={styles.label}><Txt w={800} size={12} color={C.muted} style={{ letterSpacing: 1 }}>{res.length} RESULT{res.length === 1 ? '' : 'S'}</Txt></View>
            {res.length ? (
              <View style={{ paddingHorizontal: 10 }}>{res.map(id => <UserRow key={id} id={id} sub={`${USERS[id].city} · ${USERS[id].cat} · ${fmt(USERS[id].followers)} followers`} />)}</View>
            ) : (
              <Txt color={C.muted} style={{ textAlign: 'center', padding: 40 }}>No one matches “{q}”. Try a city or a category like Music.</Txt>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
function Chip({ label, icon, onPress, active }) {
  return (
    <Tap onPress={onPress} style={[styles.chip, shadow, active && { backgroundColor: C.ink2 }]}>
      {icon && <Icon name={icon} size={11} color={active ? '#fff' : C.muted} />}
      <Txt w={700} size={13} color={active ? '#fff' : C.ink}>{label}</Txt>
    </Tap>
  );
}

function NotifsModal({ onClose }) {
  const { open, notifsUnread, setNotifsUnread, toast } = useApp();
  const [read, setRead] = useState(new Set());
  const go = (n, i) => {
    setRead(p => new Set(p).add(i));
    if (n.act === 'live') open('live', { id: n.id });
    else if (n.act === 'chat') open('chat', { id: n.id });
    else if (n.act === 'call') open('call', { id: n.id });
    else open('profile', { id: n.id });
  };
  return (
    <View>
      <SheetHead title="Notifications" onClose={onClose}
        right={notifsUnread ? <Tap onPress={() => { setNotifsUnread(false); toast('All caught up', 'check-double'); }} hitSlop={8}><Txt w={700} size={13} color={C.g1}>Mark all read</Txt></Tap> : null} />
      <View style={{ paddingHorizontal: 10 }}>
        {NOTIFS.map((n, i) => {
          const unread = notifsUnread && i < 3 && !read.has(i);
          return (
            <Tap key={i} onPress={() => go(n, i)} style={[styles.row, unread && { backgroundColor: '#fff' }]}>
              <View>
                <Avatar id={n.id} size={46} />
                <View style={[styles.nic, { backgroundColor: n.nc }]}><Icon name={n.icon} size={9} color="#fff" /></View>
              </View>
              <Txt size={13.5} color="#4b3d58" style={{ flex: 1, lineHeight: 19 }}>
                {n.pre || ''}<Txt w={700} size={13.5} color={C.ink2}>{n.who}</Txt>{n.text}
              </Txt>
              <Txt w={600} size={11} color={C.muted}>{n.time}</Txt>
              {unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pink }} />}
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

/* =========================================================
   LISTS: CATEGORY, SEE ALL, STATS
   ========================================================= */
function CategoryModal({ catKey, onClose }) {
  const c = CATS.find(x => x.key === catKey);
  return (
    <View>
      <SheetHead title={c.name} onClose={onClose}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.cbg, alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={16} color={c.cc} /></View>
      </SheetHead>
      <Txt size={13.5} color={C.muted} style={{ paddingHorizontal: 18, paddingBottom: 10, lineHeight: 20 }}>{c.desc} <Txt w={700} size={13.5} color={c.cc}>{c.meta}</Txt></Txt>
      <View style={{ paddingHorizontal: 10 }}>
        {c.users.map(id => {
          const u = USERS[id]; const L = liveOf(id);
          const sub = catKey === 'nearby' ? `${u.km} km away · ${u.city}` : L ? `${L.title} · ${fmt(L.viewers)} watching` : `${u.city} · ${fmt(u.followers)} followers`;
          return <UserRow key={id} id={id} sub={sub} />;
        })}
      </View>
    </View>
  );
}

function SeeAllModal({ which, onClose }) {
  const { following } = useApp();
  const { width } = useWindowDimensions();
  const cw = (Math.min(width, 520) - 36 - 12) / 2;
  if (which === 'live') return (
    <View>
      <SheetHead title={`Live now · ${LIVES.length}`} onClose={onClose} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 18 }}>{LIVES.map(L => <LiveCard key={L.id} L={L} grid width={cw} />)}</View>
    </View>
  );
  if (which === 'matches') return (
    <View>
      <SheetHead title={`Matches · ${MATCHES.length}`} onClose={onClose} />
      <View style={{ gap: 10, paddingHorizontal: 18 }}>{MATCHES.map(m => <MatchItem key={m.id} m={m} />)}</View>
    </View>
  );
  const ids = Object.keys(USERS).filter(id => !following.has(id));
  return (
    <View>
      <SheetHead title="People you may like" onClose={onClose} />
      <View style={{ paddingHorizontal: 10 }}>{ids.map(id => <UserRow key={id} id={id} sub={`${USERS[id].city} · ${USERS[id].km} km · ${USERS[id].cat}`} />)}</View>
    </View>
  );
}

function StatModal({ which, onClose }) {
  const { me, following, open } = useApp();
  let ids, title;
  if (which === 'followers') { ids = ['lena', 'maya', 'jordan', 'dana', 'sam', 'taylor', 'oliver']; title = `Followers · ${fmt(me.followers)}`; }
  else if (which === 'following') { ids = [...following]; title = `Following · ${fmt(me.following + following.size)}`; }
  else { ids = MATCHES.map(m => m.id); title = `Matches · ${me.matches}`; }
  return (
    <View>
      <SheetHead title={title} onClose={onClose} />
      <View style={{ paddingHorizontal: 10 }}>
        {ids.length ? ids.map(id => (
          <UserRow key={id} id={id} sub={`${USERS[id].city} · ${USERS[id].cat}`}
            right={which === 'matches' ? <RoundBtn icon="comment-dots" size={36} onPress={() => open('chat', { id })} label="Message" /> : undefined} />
        )) : <Txt color={C.muted} style={{ textAlign: 'center', padding: 40 }}>You aren’t following anyone yet.</Txt>}
      </View>
    </View>
  );
}

/* =========================================================
   GIFTS + COINS
   ========================================================= */
function GiftsModal({ id, onSent, onClose }) {
  const { coins, setCoins, open, toast } = useApp();
  const { width } = useWindowDimensions();
  const gw = (Math.min(width, 520) - 36 - 20) / 3;
  const send = g => {
    if (coins < g.p) { toast('Not enough coins. Tap “Get more coins”', 'coins'); return; }
    setCoins(c => c - g.p); onClose(); onSent && onSent(g);
    toast(`Sent a ${g.n} to ${USERS[id].name} ${g.e}`, 'gift');
  };
  return (
    <View>
      <SheetHead title={`Send ${USERS[id].name} a gift`} onClose={onClose} right={<CoinPill coins={coins} />} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 18 }}>
        {GIFTS.map(g => (
          <Tap key={g.n} onPress={() => send(g)} style={[styles.gift, shadow, { width: gw }]}>
            <Txt size={34}>{g.e}</Txt>
            <Txt w={700} size={13} color={C.ink2}>{g.n}</Txt>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><Icon name="coins" size={10} color={C.coin} /><Txt w={700} size={11.5} color={C.coin}>{g.p}</Txt></View>
          </Tap>
        ))}
      </View>
      <View style={{ paddingHorizontal: 18, paddingTop: 16, flexDirection: 'row' }}><Btn kind="ghost" icon="plus" label="Get more coins" onPress={() => open('topUp')} /></View>
    </View>
  );
}
const CoinPill = ({ coins }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: C.coinBg }}>
    <Icon name="coins" size={12} color={C.coin} /><Txt w={700} size={13} color={C.coin}>{coins.toLocaleString()}</Txt>
  </View>
);

function TopUpModal({ onClose }) {
  const { coins, setCoins, toast } = useApp();
  return (
    <View>
      <SheetHead title="Top up coins" onClose={onClose} right={<CoinPill coins={coins} />} />
      <View style={{ gap: 10, paddingHorizontal: 18 }}>
        {PACKS.map(p => (
          <Tap key={p.c} onPress={() => { setCoins(c => c + p.c); onClose(); toast(`+${p.c.toLocaleString()} coins added`, 'coins'); }} style={[styles.pack, shadow]}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.coinBg, alignItems: 'center', justifyContent: 'center' }}><Icon name="coins" size={16} color="#c27a0e" /></View>
            <View style={{ flex: 1 }}>
              <Txt w={700} size={15} color={C.ink2}>{p.c.toLocaleString()} coins</Txt>
              {p.b && <Txt w={700} size={11.5} color="#15803d">{p.b}</Txt>}
            </View>
            <Grad style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 }}><Txt w={800} size={13.5} color="#fff">{p.p}</Txt></Grad>
          </Tap>
        ))}
      </View>
      <Txt size={12} color={C.muted} style={{ textAlign: 'center', marginTop: 14 }}>Prototype only. No real payment is taken.</Txt>
    </View>
  );
}

/* =========================================================
   PROFILE MENU SUB-SCREENS
   ========================================================= */
function Field({ label, ...rest }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingBottom: 14, gap: 6 }}>
      <Txt w={700} size={12} color={C.muted} style={{ letterSpacing: 0.5 }}>{label.toUpperCase()}</Txt>
      <TextInput {...rest} placeholderTextColor={C.muted} style={[styles.field, rest.multiline && { minHeight: 84, textAlignVertical: 'top' }]} />
    </View>
  );
}

function EditProfileModal({ onClose }) {
  const { me, setMe, toast } = useApp();
  const [name, setName] = useState(me.name);
  const [city, setCity] = useState(me.city);
  const [bio, setBio] = useState(me.bio);
  const save = () => {
    if (!name.trim()) { toast('Add a name so people can find you', 'circle-exclamation'); return; }
    setMe(m => ({ ...m, name: name.trim(), city: city.trim() || m.city, bio: bio.trim() }));
    onClose(); toast('Profile updated', 'circle-check');
  };
  return (
    <View>
      <SheetHead title="Edit profile" onClose={onClose} />
      <View style={{ alignItems: 'center', paddingBottom: 16, gap: 8 }}>
        <Ring size={96} pad={3}><Avatar id="me" size={84} border={3} /></Ring>
        <Tap onPress={() => toast('Photo picker opens here in the full app', 'camera')}><Txt w={700} size={13} color={C.g1}>Change photo</Txt></Tap>
      </View>
      <Field label="Name" value={name} onChangeText={setName} maxLength={30} />
      <Field label="City" value={city} onChangeText={setCity} maxLength={30} />
      <Field label={`Bio · ${bio.length}/120`} value={bio} onChangeText={setBio} maxLength={120} multiline />
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 18 }}>
        <Btn kind="ghost" label="Cancel" onPress={onClose} />
        <Btn label="Save changes" onPress={save} />
      </View>
    </View>
  );
}

function SetRow({ title, sub, right, onPress, first }) {
  const body = (
    <View style={[styles.setRow, !first && { borderTopWidth: 1, borderTopColor: C.line }]}>
      <View style={{ flex: 1 }}>
        <Txt w={600} size={14.5} color={C.ink2}>{title}</Txt>
        {sub ? <Txt size={12} color={C.muted} style={{ marginTop: 2 }}>{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? <Tap scale={0.99} onPress={onPress}>{body}</Tap> : body;
}
function ToggleRow({ k, first }) {
  const { settings, setSettings, toast } = useApp();
  const val = settings[k];
  const flip = v => { setSettings(s => ({ ...s, [k]: v })); toast(`${SET_LABELS[k][0]} ${v ? 'on' : 'off'}`, v ? 'toggle-on' : 'toggle-off'); };
  return (
    <SetRow first={first} title={SET_LABELS[k][0]} sub={SET_LABELS[k][1]}
      right={<Switch value={val} onValueChange={flip} trackColor={{ false: '#dcd2e6', true: C.g1 }} thumbColor="#fff" />} />
  );
}
const Chev = ({ val }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    {val ? <Txt w={600} size={13} color={C.muted}>{val}</Txt> : null}
    <Icon name="chevron-right" size={12} color="#c4b6d4" />
  </View>
);

function SettingsModal({ section, onClose }) {
  const { open, toast } = useApp();
  const [quiet, setQuiet] = useState(false);
  const [lang, setLang] = useState(0);
  const [cache, setCache] = useState('48 MB');
  const langs = ['English', 'हिन्दी', 'Español', 'Français'];
  const group = children => <Card style={{ marginHorizontal: 18, marginBottom: 14, overflow: 'hidden' }}>{children}</Card>;

  if (section === 'notifications') return (
    <View>
      <SheetHead title="Notifications" onClose={onClose} />
      {group(['liveAlerts', 'newMatches', 'messages', 'gifts'].map((k, i) => <ToggleRow key={k} k={k} first={i === 0} />))}
      {group(<SetRow first title="Quiet hours" sub="Mute alerts while you sleep" right={<Chev val={quiet ? '11 PM – 7 AM' : 'Off'} />}
        onPress={() => { setQuiet(!quiet); toast(!quiet ? 'Quiet hours set: 11 PM – 7 AM' : 'Quiet hours off', 'moon'); }} />)}
    </View>
  );
  if (section === 'privacy') return (
    <View>
      <SheetHead title="Privacy" onClose={onClose} />
      {group(['onlineStatus', 'privateAcct', 'showDistance', 'readReceipts'].map((k, i) => <ToggleRow key={k} k={k} first={i === 0} />))}
      {group(<>
        <SetRow first title="Blocked accounts" sub="People you’ve blocked can’t see you" right={<Chev val="2" />} onPress={() => toast('You have 2 blocked accounts', 'ban')} />
        <SetRow title="Download my data" sub="Get a copy of your Glow data by email" right={<Chev />} onPress={() => toast('We’ll email your data within 48 hours', 'envelope')} />
      </>)}
    </View>
  );
  return (
    <View>
      <SheetHead title="Settings" onClose={onClose} />
      {group(<>
        <SetRow first title="Language" sub="App language" right={<Chev val={langs[lang]} />} onPress={() => { const n = (lang + 1) % langs.length; setLang(n); toast(`Language: ${langs[n]}`, 'language'); }} />
        {['dataSaver', 'autoplay', 'sounds'].map(k => <ToggleRow key={k} k={k} />)}
      </>)}
      {group(<>
        <SetRow first title="Clear cache" sub="Frees up space on this device" right={<Txt w={600} size={13} color={C.muted}>{cache}</Txt>}
          onPress={() => open('confirm', { title: 'Clear cache?', text: 'Downloaded thumbnails and previews will load again next time.', ok: 'Clear', icon: 'broom', danger: false,
            onOk: () => { setCache('0 MB'); toast('Cache cleared · 48 MB freed', 'broom'); } })} />
        <SetRow title="About Glow" sub="Version 4.2.0" right={<Chev />} onPress={() => toast('Glow 4.2.0 · a prototype built with love', 'circle-info')} />
      </>)}
    </View>
  );
}

function HelpModal({ onClose }) {
  const { toast } = useApp();
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <View>
      <SheetHead title="Help & Support" onClose={onClose} />
      {FAQS.map(([q, a], i) => (
        <Card key={q} style={{ marginHorizontal: 18, marginBottom: 10, overflow: 'hidden' }}>
          <Tap scale={0.99} onPress={() => setOpenIdx(openIdx === i ? null : i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
            <Txt w={700} size={14} color={C.ink2} style={{ flex: 1 }}>{q}</Txt>
            <Icon name={openIdx === i ? 'chevron-up' : 'chevron-down'} size={12} color={C.muted} />
          </Tap>
          {openIdx === i && <Txt size={13.5} color="#5d4f6b" style={{ paddingHorizontal: 16, paddingBottom: 14, lineHeight: 20 }}>{a}</Txt>}
        </Card>
      ))}
      <View style={{ paddingHorizontal: 18, paddingTop: 6, flexDirection: 'row' }}>
        <Btn icon="headset" label="Contact support" onPress={() => toast('Support ticket opened · #GL-2048', 'headset')} />
      </View>
    </View>
  );
}

/* =========================================================
   CONFIRM, GO LIVE
   ========================================================= */
function ConfirmModal({ kind, id, title, text, ok = 'Confirm', icon = 'triangle-exclamation', danger = true, onOk, onClose }) {
  const app = useApp();
  if (kind === 'logout') {
    title = 'Log out of Glow?'; text = 'You’ll stop getting live alerts and messages on this device until you log back in.'; ok = 'Log out'; icon = 'arrow-right-from-bracket';
    onOk = () => { app.closeAll(); app.setLoggedOut(true); };
  } else if (kind === 'block') {
    const n = USERS[id].name;
    title = `Block ${n}?`; text = `${n} won’t be able to message you, see your lives or find you in search. They won’t be told.`; ok = 'Block'; icon = 'ban';
    onOk = () => { app.closeAll(); app.toast(`${n} has been blocked`, 'ban'); };
  }
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[styles.cfIc, !danger && { backgroundColor: '#f1e4fb' }]}><Icon name={icon} size={22} color={danger ? C.danger : C.g2} /></View>
      <Txt w={800} size={19} color={C.ink2} style={{ textAlign: 'center' }}>{title}</Txt>
      <Txt size={14} color="#5d4f6b" style={{ textAlign: 'center', marginTop: 6, lineHeight: 21 }}>{text}</Txt>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' }}>
        <Btn kind="ghost" label="Cancel" onPress={onClose} />
        <Btn kind={danger ? 'danger' : 'primary'} label={ok} onPress={() => { onClose(); onOk && onOk(); }} />
      </View>
    </View>
  );
}

function GoLiveModal({ onClose }) {
  const { open, toast } = useApp();
  const [title, setTitle] = useState('Sunset chai and a chat');
  const [cat, setCat] = useState('Chat');
  return (
    <View>
      <SheetHead title="Start a live" onClose={onClose} />
      <LinearGradient colors={['#2b1d33', '#6a2b72']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.preview}>
        <Pulse size={64} color={C.pink}><Avatar id="me" size={64} /></Pulse>
        <Txt size={13} color="#e8d8f2" style={{ marginTop: 10 }}>Camera preview appears here in the full app</Txt>
      </LinearGradient>
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={50} />
      <Txt w={700} size={12} color={C.muted} style={{ letterSpacing: 0.5, paddingHorizontal: 18, paddingBottom: 8 }}>CATEGORY</Txt>
      <View style={[styles.taglist, { paddingBottom: 16 }]}>{['Chat', 'Music', 'Gaming', 'Dance'].map(c => <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />)}</View>
      <View style={{ paddingHorizontal: 18, flexDirection: 'row' }}>
        <Btn icon="tower-broadcast" label="Go live now" onPress={() => { onClose(); open('live', { id: 'me', self: { title: title.trim() || 'Live with Priya', cat } }); toast('You’re live!', 'tower-broadcast'); }} />
      </View>
    </View>
  );
}

/* =========================================================
   REGISTRY
   ========================================================= */
const REGISTRY = {
  profile: { kind: 'sheet', C: ProfileModal },
  live: { kind: 'full', C: LiveModal, dark: true },
  story: { kind: 'full', C: StoryModal, dark: true },
  myStory: { kind: 'sheet', C: MyStorySheet },
  chat: { kind: 'full', C: ChatModal },
  call: { kind: 'full', C: CallModal, dark: true },
  search: { kind: 'full', C: SearchModal },
  notifs: { kind: 'sheet', C: NotifsModal },
  category: { kind: 'sheet', C: CategoryModal },
  seeAll: { kind: 'sheet', C: SeeAllModal },
  stat: { kind: 'sheet', C: StatModal },
  gifts: { kind: 'sheet', C: GiftsModal },
  topUp: { kind: 'sheet', C: TopUpModal },
  editProfile: { kind: 'sheet', C: EditProfileModal },
  settings: { kind: 'sheet', C: SettingsModal },
  help: { kind: 'sheet', C: HelpModal },
  confirm: { kind: 'center', C: ConfirmModal },
  goLive: { kind: 'sheet', C: GoLiveModal },
};
export const isDarkModal = type => !!REGISTRY[type]?.dark;

/* =========================================================
   STYLES
   ========================================================= */
const styles = StyleSheet.create({
  sheet: { maxHeight: '90%', backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  center: { backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18 },
  pmCover: { height: 130 },
  stats: { flexDirection: 'row', marginTop: 16, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 },
  pmWatch: { marginHorizontal: 20, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#ffe4ec' },
  tagPill: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  lvTop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  lvHost: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.28)', paddingVertical: 4, paddingLeft: 4, paddingRight: 12, borderRadius: 24 },
  lvFollow: { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.pink, justifyContent: 'center' },
  vc: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(31,19,38,0.45)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  lvCat: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  hearts: { position: 'absolute', right: 10, width: 70, height: 340 },
  comments: { position: 'absolute', left: 12, right: 84, gap: 6 },
  cmt: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.3)', paddingVertical: 5, paddingLeft: 5, paddingRight: 10, borderRadius: 16, maxWidth: '100%' },
  lvBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12 },
  lvInput: { flex: 1, minWidth: 80, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 14, color: '#fff', fontFamily: F[400], fontSize: 13.5, paddingVertical: 0 },
  lvBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  svBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  svHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 12 },
  zone: { position: 'absolute', top: 0, bottom: 0, width: '33%' },
  svNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10 },
  svNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)' },
  svReply: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  svInput: { flex: 1, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.12)', color: '#fff', paddingHorizontal: 16, fontFamily: F[400], fontSize: 14, paddingVertical: 0 },
  svIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  chHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.line },
  day: { alignSelf: 'center', backgroundColor: C.soft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginBottom: 6 },
  msg: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  mine: { borderBottomRightRadius: 6 },
  them: { backgroundColor: '#fff', borderBottomLeftRadius: 6, alignSelf: 'flex-start' },
  quick: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: C.soft },
  chInput: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#fff' },
  chField: { flex: 1, height: 44, borderRadius: 22, backgroundColor: C.soft, paddingHorizontal: 16, fontFamily: F[400], fontSize: 14.5, color: C.ink, paddingVertical: 0 },
  callSelf: { position: 'absolute', right: 16, width: 96, height: 132, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', gap: 6, zIndex: 2 },
  cbtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 16, borderRadius: 23, backgroundColor: '#fff' },
  searchInput: { flex: 1, fontFamily: F[400], fontSize: 14.5, color: C.ink, paddingVertical: 0 },
  label: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  taglist: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 16 },
  mic: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  nic: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  gift: { alignItems: 'center', gap: 4, paddingVertical: 14, borderRadius: 18, backgroundColor: '#fff' },
  pack: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#fff' },
  field: { borderWidth: 1.5, borderColor: C.line, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F[400], fontSize: 14.5, color: C.ink },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  cfIc: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.dangerBg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  preview: { marginHorizontal: 18, marginBottom: 14, height: 160, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
