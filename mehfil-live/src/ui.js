import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Dancer from './Dancer';
import { Poster } from './media';
import { C, fmtK, minsLeft } from './data';
import { t } from './i18n';

export function Btn({ label, onPress, kind = 'primary', small, disabled, style }) {
  const bg = { primary: C.rose, gold: C.gold, danger: C.red, ghost: 'transparent', dark: C.panel2 }[kind];
  const fg = kind === 'gold' ? C.bg : kind === 'ghost' ? C.rose : '#fff';
  return (
    <Pressable
      onPress={onPress} disabled={disabled}
      style={[st.btn, { backgroundColor: bg }, kind === 'ghost' && { borderWidth: 1, borderColor: C.rose }, small && st.btnSmall, disabled && { opacity: 0.45 }, style]}
    >
      <Text style={[st.btnTxt, { color: fg }, small && { fontSize: 12 }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, color = C.rose }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, on && { backgroundColor: color, borderColor: color }]}>
      <Text style={[st.chipTxt, on && { color: C.bg }]}>{label}</Text>
    </Pressable>
  );
}

export function Sheet({ visible, onClose, title, children, full }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.sheetBg}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[st.sheet, full && { maxHeight: '92%' }]}>
          <View style={st.sheetHead}>
            <Text style={st.h3}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={[st.h3, { color: C.dim }]}>✕</Text></Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function statusInfo(p, lang, now = Date.now()) {
  if (p.status === 'stage') return { label: t(lang, 'available'), color: C.green };
  if (p.status === 'private') return { label: `${t(lang, 'inPrivate')} · ${t(lang, 'backIn')} ${minsLeft((p.returnAt || now) - now)} ${t(lang, 'min')}`, color: C.amber };
  if (p.status === 'bench') return { label: t(lang, 'upNext'), color: C.blue };
  if (p.status === 'break') return { label: t(lang, 'onBreak'), color: C.dim };
  return { label: t(lang, 'offShift'), color: C.dim };
}

export const DancerCard = React.memo(function DancerCard({ p, w, rank, lang, onPress, onBook, spotlight, now }) {
  const s = statusInfo(p, lang, now);
  const live = p.status === 'stage';
  return (
    <Pressable onPress={onPress} style={[st.card, { width: w }, spotlight && { borderColor: C.gold, borderWidth: 2 }, !live && { opacity: 0.72 }]}>
      <View style={st.cardTop}>
        <Text style={st.cardRank}>{rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</Text>
        {p.isNew && <Text style={st.newTag}>{t(lang, 'newHere')}</Text>}
        {live && <View style={st.liveDotSm} />}
      </View>
      <View style={{ alignItems: 'center', height: w * 1.05, justifyContent: 'flex-end' }}>
        <Poster p={p} dim={!live} style={{ position: 'absolute', left: -8, top: -8, width: w, height: w * 1.05 + 8 }} />
      </View>
      <Text style={st.cardName} numberOfLines={1}>{p.name}</Text>
      <Text style={st.cardMeta} numberOfLines={1}>🪙{fmtK(p.coins)} · {p.langs.slice(0, 2).join(', ')}</Text>
      <Text style={[st.cardStatus, { color: s.color }]} numberOfLines={1}>● {s.label}</Text>
      {live && onBook && (
        <Pressable onPress={onBook} style={st.cardBook}><Text style={st.cardBookTxt}>🔒 {t(lang, 'book')}</Text></Pressable>
      )}
    </Pressable>
  );
});

export function Floater({ item, w, h, onDone }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const duration = item.kind === 'royal' ? 2400 : item.kind === 'rain' ? 1900 : 1600;
    Animated.timing(a, { toValue: 1, duration, delay: item.delay || 0, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => onDone(item.id));
  }, []);
  let style;
  let fontSize = 30;
  const ox = w / 2;
  const oy = h * 0.6;
  if (item.kind === 'float') {
    style = { left: ox - 16 + (item.id.length % 5) * 12 - 24, top: oy, opacity: a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -140] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }] };
  } else if (item.kind === 'burst') {
    style = { left: ox - 16, top: oy - 20, opacity: a.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 3.2] }) }] };
  } else if (item.kind === 'rain') {
    fontSize = 24;
    style = { left: item.fx * (w - 30), top: -30, opacity: a.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, h + 30] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '320deg'] }) }] };
  } else {
    fontSize = 68;
    style = { left: w / 2 - 42, top: h / 2 - 46, opacity: a.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.2, 1.7, 1.3] }) }] };
  }
  return <Animated.Text style={[{ position: 'absolute', fontSize }, style]}>{item.emoji}</Animated.Text>;
}

export function Banner({ b, onDone, top = 8 }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.delay(2600),
      Animated.timing(a, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDone && onDone());
  }, []);
  return (
    <Animated.View pointerEvents="none" style={[st.banner, { top, borderColor: b.color, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] }]}>
      <Text style={[st.bannerTxt, { color: b.color }]}>{b.text}</Text>
    </Animated.View>
  );
}

export function Toast({ text, bottom, onDone }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2300),
      Animated.timing(a, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDone && onDone());
  }, []);
  return (
    <Animated.View pointerEvents="none" style={[st.toast, { bottom, opacity: a }]}>
      <Text style={st.toastTxt}>{text}</Text>
    </Animated.View>
  );
}

export function LiveDot() {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.25, duration: 700, useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[st.liveDot, { opacity: a }]} />;
}

export function Stat({ k, v, color = C.text }) {
  return (
    <View style={st.statTile}>
      <Text style={st.meta}>{k}</Text>
      <Text style={[st.statVal, { color }]}>{v}</Text>
    </View>
  );
}

export const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  meta: { color: C.dim, fontSize: 12 },
  body: { color: C.text, fontSize: 14, lineHeight: 20 },
  h2: { color: C.text, fontWeight: '900', fontSize: 22 },
  h3: { color: C.text, fontWeight: '800', fontSize: 16 },
  brand: { color: C.text, fontWeight: '900', fontSize: 17 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  pill: { borderWidth: 1, borderColor: C.gold, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  pillTxt: { color: C.goldLight, fontWeight: '800', fontSize: 13 },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 10 },
  btnTxt: { fontWeight: '800', fontSize: 14 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  chipTxt: { color: C.text, fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: C.panel, borderRadius: 14, padding: 8, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 5, position: 'absolute', top: 6, left: 8, right: 8, zIndex: 2 },
  cardRank: { color: C.gold, fontWeight: '900', fontSize: 11 },
  newTag: { color: C.bg, backgroundColor: C.green, fontSize: 9, fontWeight: '900', paddingHorizontal: 4, borderRadius: 4, overflow: 'hidden' },
  liveDotSm: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red, marginLeft: 'auto' },
  cardName: { color: C.text, fontWeight: '800', fontSize: 14, marginTop: 4 },
  cardMeta: { color: C.dim, fontSize: 11 },
  cardStatus: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  cardBook: { marginTop: 6, backgroundColor: C.roseDim, borderRadius: 8, paddingVertical: 5, alignItems: 'center' },
  cardBookTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28, maxHeight: '85%', borderWidth: 1, borderColor: C.line },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  banner: { position: 'absolute', left: 10, right: 10, backgroundColor: 'rgba(20,11,34,0.96)', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, zIndex: 50 },
  bannerTxt: { fontWeight: '800', fontSize: 13, textAlign: 'center' },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(36,22,61,0.97)', borderColor: C.gold, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, maxWidth: '90%', zIndex: 99 },
  toastTxt: { color: C.text, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, marginRight: 5 },
  statTile: { width: '48.5%', backgroundColor: C.panel2, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.line },
  statVal: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  input: { backgroundColor: C.bg2, color: C.text, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.line },
  box: { backgroundColor: C.panel2, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: C.panel2, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  gold: { color: C.goldLight, fontWeight: '800', fontSize: 13 },
});
