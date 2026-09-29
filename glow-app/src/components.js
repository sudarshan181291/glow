// Cards and rows reused across tabs and modals.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, shadow } from './theme';
import { USERS, fmt, liveOf } from './data';
import { useApp } from './store';
import { Avatar, AvatarDot, FollowBtn, Icon, LiveBadge, Pulse, Tap, Txt } from './ui';

export function LiveCard({ L, grid, width }) {
  const { open } = useApp();
  const u = USERS[L.id] || { c: ['#fa3d6c', '#a24bcf'], name: 'You' };
  const av = grid ? 70 : 64;
  return (
    <Tap onPress={() => open('live', { id: L.id })} style={[st.lcard, grid ? { height: 232, width } : { width: 156, height: 216 }]} accessibilityLabel={`Watch ${u.name} live`}>
      <LinearGradient colors={u.c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['transparent', 'rgba(31,19,38,0.8)']} style={[StyleSheet.absoluteFill, { top: '40%' }]} />
      <View style={st.lTop}>
        <LiveBadge />
        <View style={st.vc}><Icon name="eye" size={10} color="#fff" /><Txt w={700} size={11} color="#fff">{fmt(L.viewers)}</Txt></View>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Pulse size={av}><Avatar id={L.id} size={av} border={3} borderColor="rgba(255,255,255,0.9)" /></Pulse>
      </View>
      <View>
        <Txt w={800} size={15} color="#fff">{u.name}</Txt>
        <Txt size={11.5} color="rgba(255,255,255,0.88)" numberOfLines={1}>{L.title}</Txt>
        <View style={st.lMeta}>
          <View style={st.tag}><Txt w={700} size={11} color="#fff">{L.cat}</Txt></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="heart" size={10} color="#ff9ab8" /><Txt w={700} size={11} color="#fff">{fmt(L.likes)}</Txt></View>
        </View>
      </View>
    </Tap>
  );
}

const STATUS = {
  New: { bg: '#ffe4ec', fg: '#d02a5a' },
  Online: { bg: '#dcfce7', fg: '#15803d' },
  Super: { bg: C.g2, fg: '#fff' },
};
export function StatusPill({ kind }) {
  const k = STATUS[kind];
  return <View style={{ backgroundColor: k.bg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 }}><Txt w={800} size={9.5} color={k.fg} style={{ letterSpacing: 0.5 }}>{kind.toUpperCase()}</Txt></View>;
}

export function MatchItem({ m }) {
  const { open } = useApp();
  const u = USERS[m.id];
  const col = m.kind === 'hot' ? C.g1 : m.kind === 'missed' ? '#e0445f' : C.muted;
  return (
    <Tap onPress={() => open('profile', { id: m.id })} style={[st.match, shadow]}>
      <AvatarDot id={m.id} size={54} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt w={700} size={15} color={C.ink2}>{u.name}, {u.age}</Txt>
          {m.badge && <StatusPill kind={m.badge} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
          {m.icon && <Icon name={m.icon} size={11} color={col} />}
          <Txt w={m.kind ? 600 : 400} size={13} color={col} numberOfLines={1} style={{ flexShrink: 1 }}>{m.msg}</Txt>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Txt w={600} size={11} color={C.muted}>{m.time}</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Tap onPress={() => open('call', { id: m.id })} style={[st.qa, { backgroundColor: C.g1 }]} hitSlop={4} accessibilityLabel={`Video call ${u.name}`}>
            <Icon name="video" size={13} color="#fff" />
          </Tap>
          <Tap onPress={() => open('chat', { id: m.id })} style={[st.qa, { backgroundColor: C.soft }]} hitSlop={4} accessibilityLabel={`Message ${u.name}`}>
            <Icon name="comment-dots" size={13} color={C.g2} />
          </Tap>
        </View>
      </View>
    </Tap>
  );
}

export function UserRow({ id, sub, right }) {
  const { open } = useApp();
  const u = USERS[id];
  const L = liveOf(id);
  return (
    <Tap onPress={() => open('profile', { id })} style={st.row}>
      <AvatarDot id={id} size={48} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt w={700} size={14.5} color={C.ink2}>{u.name}, {u.age}</Txt>
          {L && <View style={st.miniLive}><Txt w={800} size={9} color="#fff">LIVE</Txt></View>}
        </View>
        <Txt size={12.5} color={C.muted} numberOfLines={1} style={{ marginTop: 2 }}>{sub}</Txt>
      </View>
      {right === undefined ? <FollowBtn id={id} /> : right}
    </Tap>
  );
}

export const st = StyleSheet.create({
  lcard: { borderRadius: 24, overflow: 'hidden', padding: 10, justifyContent: 'space-between' },
  lTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vc: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(31,19,38,0.45)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  lMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  tag: { backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, backgroundColor: C.card },
  qa: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 16 },
  miniLive: { backgroundColor: C.pink, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
});
