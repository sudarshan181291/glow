// The five tab screens.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, shadow } from './theme';
import { CATS, LIVES, MATCHES, STORY_ORDER, USERS, fmt, liveOf } from './data';
import { useApp } from './store';
import { LiveCard, MatchItem } from './components';
import { shareProfile } from './modals';
import { Avatar, AvatarDot, Card, FollowBtn, Grad, Icon, Pulse, Ring, SecHead, Tap, Txt, Btn } from './ui';

const H = { paddingHorizontal: 18 };

/* ================= HOME ================= */
export function HomeScreen() {
  const { open, seen, myStory } = useApp();
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingTop: 4 }}>
        <Tap onPress={() => open(myStory ? 'story' : 'myStory', myStory ? { list: ['me'], start: 0 } : {})} style={ss.story}>
          <View>
            <Ring size={70} none={!myStory}><Avatar id="me" size={62} border={3} borderColor={C.bg} /></Ring>
            {!myStory && <Grad style={ss.plus}><Icon name="plus" size={10} color="#fff" /></Grad>}
          </View>
          <Txt w={600} size={12} numberOfLines={1}>Your Story</Txt>
        </Tap>
        {STORY_ORDER.map((id, i) => (
          <Tap key={id} onPress={() => open('story', { start: i })} style={ss.story}>
            <Ring size={70} seen={seen.has(id)}><Avatar id={id} size={62} border={3} borderColor={C.bg} /></Ring>
            <Txt w={600} size={12} numberOfLines={1}>{USERS[id].name}</Txt>
          </Tap>
        ))}
      </ScrollView>

      <SecHead title="Live Now" live action="See all" onAction={() => open('seeAll', { which: 'live' })} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 6 }}>
        {LIVES.slice(0, 5).map(L => <LiveCard key={L.id} L={L} />)}
      </ScrollView>

      <SecHead title="Matches & Messages" action="See all" onAction={() => open('seeAll', { which: 'matches' })} />
      <View style={[H, { gap: 10 }]}>{MATCHES.map(m => <MatchItem key={m.id} m={m} />)}</View>
    </View>
  );
}

/* ================= DISCOVER ================= */
export function DiscoverScreen() {
  const { open } = useApp();
  const spot = liveOf('marcus');
  const { width } = useWindowDimensions();
  const cw = (Math.min(width, 520) - 36 - 12) / 2;
  return (
    <View>
      <Tap onPress={() => open('live', { id: 'marcus' })} style={[H]}>
        <LinearGradient colors={['#2b1d33', '#5a1f5c', '#ca3c7c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ss.spot}>
          <Pulse size={58} color={C.pink}><Avatar id="marcus" size={58} /></Pulse>
          <View style={{ flex: 1 }}>
            <Txt w={800} size={10.5} color="#ffb4cb" style={{ letterSpacing: 1 }}>SPOTLIGHT · {fmt(spot.viewers)} WATCHING</Txt>
            <Txt w={800} size={16.5} color="#fff" style={{ marginVertical: 3 }}>Marcus: {spot.title}</Txt>
            <Txt size={12.5} color="#e6d6ef">Top gaming stream in London right now</Txt>
          </View>
        </LinearGradient>
      </Tap>

      <SecHead title="Categories" />
      <View style={[H, { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }]}>
        {CATS.map(c => (
          <Tap key={c.key} onPress={() => open('category', { catKey: c.key })} style={[ss.cat, shadow, { width: cw }]}>
            <View style={[ss.catIc, { backgroundColor: c.cbg }]}><Icon name={c.icon} size={19} color={c.cc} /></View>
            <Txt w={800} size={15} color={C.ink2}>{c.name}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.cc }} />
              <Txt w={600} size={12} color={C.muted}>{c.meta}</Txt>
            </View>
          </Tap>
        ))}
      </View>

      <SecHead title="People you may like" action="See all" onAction={() => open('seeAll', { which: 'people' })} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }}>
        {['maya', 'jordan', 'taylor', 'oliver', 'dana', 'alex'].map(id => (
          <Tap key={id} onPress={() => open('profile', { id })} style={[ss.pcard, shadow]}>
            <AvatarDot id={id} size={64} />
            <Txt w={700} size={14} color={C.ink2}>{USERS[id].name}, {USERS[id].age}</Txt>
            <Txt size={11.5} color={C.muted}>{USERS[id].city} · {USERS[id].km} km</Txt>
            <FollowBtn id={id} />
          </Tap>
        ))}
      </ScrollView>
    </View>
  );
}

/* ================= LIVE ================= */
export function LiveScreen() {
  const { open, toast } = useApp();
  const [filter, setFilter] = useState('All');
  const [shown, setShown] = useState('All');
  const fade = useRef(new Animated.Value(1)).current;
  const { width } = useWindowDimensions();
  const cw = (Math.min(width, 520) - 36 - 12) / 2;
  const cats = ['All', 'Music', 'Chat', 'Gaming', 'Dance'];
  const count = c => (c === 'All' ? LIVES.length : LIVES.filter(l => l.cat === c).length);

  const choose = c => {
    if (c === filter) return;
    setFilter(c);
    toast(c === 'All' ? 'Showing all live streams' : `Showing ${c} streams`, 'filter');
    Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShown(c);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };
  const list = shown === 'All' ? LIVES : LIVES.filter(l => l.cat === shown);

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 8, paddingVertical: 4 }}>
        {cats.map(c => (
          <Tap key={c} onPress={() => choose(c)} style={[ss.chip, shadow, filter === c && { backgroundColor: C.ink2 }]}>
            <Txt w={700} size={13.5} color={filter === c ? '#fff' : C.ink}>{c}</Txt>
            <Txt w={600} size={11} color={filter === c ? 'rgba(255,255,255,0.6)' : C.muted}>{count(c)}</Txt>
          </Tap>
        ))}
      </ScrollView>

      <Tap onPress={() => open('goLive')} style={[ss.golive, shadow]}>
        <Grad style={ss.glIc}><Icon name="video" size={18} color="#fff" /></Grad>
        <View style={{ flex: 1 }}>
          <Txt w={700} size={14.5} color={C.ink2}>Go live</Txt>
          <Txt size={12} color={C.muted}>Start your own stream in a couple of taps</Txt>
        </View>
        <Icon name="chevron-right" size={12} color="#c4b6d4" />
      </Tap>

      <SecHead title={filter === 'All' ? 'Everyone live' : `${filter} streams`} live />
      <Animated.View style={[H, { flexDirection: 'row', flexWrap: 'wrap', gap: 12, opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}>
        {list.map(L => <LiveCard key={L.id} L={L} grid width={cw} />)}
      </Animated.View>
    </View>
  );
}

/* ================= CHATS ================= */
export function ChatsScreen() {
  const { open, chats, chatOrder, markAllRead, toast } = useApp();
  const [q, setQ] = useState('');
  const preview = id => {
    const m = chats[id].msgs[chats[id].msgs.length - 1];
    return m[0] === 'me' ? 'You: ' + m[1] : m[1];
  };
  const ids = chatOrder.filter(id => !q.trim() || USERS[id].name.toLowerCase().includes(q.toLowerCase()) || preview(id).toLowerCase().includes(q.toLowerCase()));
  const online = Object.keys(USERS).filter(id => USERS[id].online);
  return (
    <View>
      <View style={[ss.search, shadow]}>
        <Icon name="magnifying-glass" size={15} color={C.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search chats" placeholderTextColor={C.muted} style={ss.searchInput} />
        {q ? <Tap onPress={() => setQ('')} hitSlop={8}><Icon name="circle-xmark" size={15} color={C.muted} /></Tap> : null}
      </View>

      <SecHead title="Online now" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 10 }}>
        {online.map(id => (
          <Tap key={id} onPress={() => open('chat', { id })} style={{ alignItems: 'center', gap: 5, width: 58 }}>
            <AvatarDot id={id} size={52} />
            <Txt w={600} size={11.5}>{USERS[id].name}</Txt>
          </Tap>
        ))}
      </ScrollView>

      <SecHead title="Messages" action="Mark all read" onAction={() => { markAllRead(); toast('All chats marked as read', 'check-double'); }} />
      <View style={{ paddingHorizontal: 10 }}>
        {ids.length ? ids.map(id => {
          const c = chats[id];
          return (
            <Tap key={id} onPress={() => open('chat', { id })} style={ss.citem}>
              <AvatarDot id={id} size={54} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt w={700} size={15} color={C.ink2}>{USERS[id].name}</Txt>
                <Txt w={c.unread ? 600 : 400} size={13} color={c.unread ? C.ink : C.muted} numberOfLines={1} style={{ marginTop: 2 }}>{preview(id)}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Txt w={600} size={11} color={c.unread ? C.g1 : C.muted}>{c.time}</Txt>
                {c.unread ? <View style={ss.ubadge}><Txt w={800} size={11} color="#fff">{c.unread}</Txt></View> : null}
              </View>
            </Tap>
          );
        }) : (
          <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
            <Icon name="comment" regular size={28} color="#cbbbe0" />
            <Txt color={C.muted}>No chats match “{q}”</Txt>
          </View>
        )}
      </View>
    </View>
  );
}

/* ================= PROFILE ================= */
export function ProfileScreen() {
  const { me, open, following, coins, toast } = useApp();
  const items = [['edit', 'user-pen', 'Edit Profile'], ['notifications', 'bell', 'Notifications'], ['privacy', 'shield-halved', 'Privacy'], ['settings', 'gear', 'Settings'], ['help', 'circle-question', 'Help & Support']];
  return (
    <View style={{ paddingHorizontal: 18 }}>
      <Card style={{ overflow: 'hidden', alignItems: 'center', paddingBottom: 18 }}>
        <LinearGradient colors={['#ca3c7c', '#a24bcf', '#6d3fd6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 86, alignSelf: 'stretch' }} />
        <View style={{ marginTop: -50 }}><Ring size={110} pad={4}><Avatar id="me" size={96} border={4} /></Ring></View>
        <Txt w={800} size={21} color={C.ink2} style={{ marginTop: 8 }}>{me.name}</Txt>
        <Txt w={600} size={13} color={C.g1}>{me.handle} · {me.city}</Txt>
        <Txt size={13.5} color="#5d4f6b" style={{ textAlign: 'center', marginTop: 8, marginHorizontal: 22, lineHeight: 20 }}>{me.bio}</Txt>
        <View style={ss.stats}>
          {[['followers', fmt(me.followers), 'Followers'], ['following', fmt(me.following + following.size), 'Following'], ['matches', String(me.matches), 'Matches']].map(([k, v, l], i) => (
            <Tap key={k} onPress={() => open('stat', { which: k })} style={[ss.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}>
              <Txt w={800} size={18} color={C.ink2}>{v}</Txt>
              <Txt w={600} size={11} color={C.muted} style={{ letterSpacing: 0.6 }}>{l.toUpperCase()}</Txt>
            </Tap>
          ))}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Btn label="Edit profile" icon="pen" onPress={() => open('editProfile')} />
        <Btn label="Share" icon="share-nodes" kind="ghost" onPress={() => shareProfile('me', toast)} />
      </View>

      <Tap onPress={() => open('topUp')} style={{ marginTop: 14 }}>
        <LinearGradient colors={['#2b1d33', '#46214f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ss.wallet}>
          <View style={ss.wic}><Icon name="coins" size={18} color="#8a5200" /></View>
          <View style={{ flex: 1 }}>
            <Txt w={700} size={17} color="#fff">{coins.toLocaleString()} coins</Txt>
            <Txt size={12} color="#cdb9dc">Send gifts to your favourite streamers</Txt>
          </View>
          <View style={ss.topup}><Txt w={800} size={12.5} color={C.ink2}>Top up</Txt></View>
        </LinearGradient>
      </Tap>

      <Card style={{ marginTop: 14, overflow: 'hidden' }}>
        {items.map(([k, ic, t], i) => (
          <Tap key={k} scale={0.99} onPress={() => open(k === 'edit' ? 'editProfile' : k === 'help' ? 'help' : 'settings', { section: k })} style={[ss.mi, i > 0 && ss.miBorder]}>
            <View style={ss.mic}><Icon name={ic} size={15} color={C.g2} /></View>
            <Txt w={600} size={14.5} color={C.ink2} style={{ flex: 1 }}>{t}</Txt>
            <Icon name="chevron-right" size={12} color="#c4b6d4" />
          </Tap>
        ))}
        <Tap scale={0.99} onPress={() => open('confirm', { kind: 'logout' })} style={[ss.mi, ss.miBorder]}>
          <View style={[ss.mic, { backgroundColor: C.dangerBg }]}><Icon name="arrow-right-from-bracket" size={15} color={C.danger} /></View>
          <Txt w={600} size={14.5} color={C.danger} style={{ flex: 1 }}>Log out</Txt>
        </Tap>
      </Card>
      <Tap onPress={() => toast('Glow 4.2.0 · a prototype built with love', 'circle-info')}>
        <Txt size={11.5} color="#a797b8" style={{ textAlign: 'center', marginTop: 16 }}>Glow 4.2.0 · Made for late nights</Txt>
      </Tap>
    </View>
  );
}

const ss = StyleSheet.create({
  story: { alignItems: 'center', gap: 6, width: 74 },
  plus: { position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.bg },
  spot: { borderRadius: 30, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  cat: { backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 10 },
  catIc: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pcard: { width: 140, backgroundColor: C.card, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', gap: 6 },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  golive: { marginHorizontal: 18, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, backgroundColor: C.card },
  glIc: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 18, marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 16, borderRadius: 23, backgroundColor: C.card },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14.5, color: C.ink, paddingVertical: 0 },
  citem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 18 },
  ubadge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', marginTop: 16, marginHorizontal: 12, alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 22 },
  wic: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#ffcf5c', alignItems: 'center', justifyContent: 'center' },
  topup: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
  mi: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  miBorder: { borderTopWidth: 1, borderTopColor: C.line },
  mic: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
});
