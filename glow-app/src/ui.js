// Shared building blocks: text, icons, avatars, buttons, pulse rings.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { C, F, GRAD, shadow } from './theme';
import { useApp, U } from './store';

/* ---------- text + icon ---------- */
export function Txt({ w = 400, size = 14, color = C.ink, style, children, ...rest }) {
  return <Text {...rest} style={[{ fontFamily: F[w], fontSize: size, color }, style]}>{children}</Text>;
}
export function Icon({ name, size = 16, color = C.ink, regular, style }) {
  return regular
    ? <FontAwesome6 name={name} size={size} color={color} style={style} />
    : <FontAwesome6 name={name} size={size} color={color} style={style} solid />;
}

/* ---------- tap with scale-down feedback ---------- */
export function Tap({ style, children, onPress, disabled, scale = 0.97, ...rest }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={null}
      style={({ pressed }) => [style, pressed && { transform: [{ scale }], opacity: 0.9 }]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export const Grad = ({ colors = GRAD, style, children, start = { x: 0, y: 0 }, end = { x: 1, y: 1 } }) => (
  <LinearGradient colors={colors} start={start} end={end} style={style}>{children}</LinearGradient>
);

/* ---------- avatars ---------- */
export function Avatar({ id, size = 48, border, borderColor = '#fff' }) {
  const { me } = useApp();
  const u = U(me, id);
  return (
    <LinearGradient
      colors={u.c}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: border || 0, borderColor }}
    >
      <Txt w={800} size={size * 0.4} color="#fff">{u.name[0]}</Txt>
    </LinearGradient>
  );
}
export function AvatarDot({ id, size = 48 }) {
  const { me } = useApp();
  const u = U(me, id);
  return (
    <View>
      <Avatar id={id} size={size} />
      {u.online && <View style={[s.dot, { width: size * 0.26, height: size * 0.26, borderRadius: size }]} />}
    </View>
  );
}

/* story-style gradient ring */
export function Ring({ size, seen, none, children, pad = 3 }) {
  if (none) return <View style={{ padding: pad }}>{children}</View>;
  return (
    <LinearGradient colors={seen ? ['#d8cfe3', '#d8cfe3'] : [C.pink, C.g2, '#f59e0b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ padding: pad, borderRadius: size }}>
      {children}
    </LinearGradient>
  );
}

/* ---------- pulse ring (2s loop) ---------- */
export function Pulse({ size, color = 'rgba(255,255,255,0.85)', width = 2, spread = 5, children }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = v => Animated.loop(Animated.timing(v, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    const l1 = loop(a); l1.start();
    const t = setTimeout(() => loop(b).start(), 1000);
    return () => { clearTimeout(t); a.stopAnimation(); b.stopAnimation(); };
  }, [a, b]);
  const ring = v => ({
    position: 'absolute', width: size + spread * 2, height: size + spread * 2, borderRadius: size, borderWidth: width, borderColor: color,
    left: -spread, top: -spread,
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.45] }) }],
  });
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View pointerEvents="none" style={ring(a)} />
      <Animated.View pointerEvents="none" style={ring(b)} />
      {children}
    </View>
  );
}

/* blinking dot used in "Live Now" headings */
export function LiveDot() {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    l.start(); return () => l.stop();
  }, [v]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.pink, opacity: v }} />;
}

export function LiveBadge({ extra }) {
  return (
    <View style={s.liveBadge}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
      <Txt w={800} size={10} color="#fff" style={{ letterSpacing: 0.8 }}>LIVE{extra ? ` ${extra}` : ''}</Txt>
    </View>
  );
}

/* ---------- buttons ---------- */
export function Btn({ label, icon, kind = 'primary', onPress, style, small }) {
  const h = small ? 38 : 46;
  const fg = { primary: '#fff', ghost: C.ink2, danger: C.danger, dark: '#fff', white: C.ink2 }[kind];
  const inner = (
    <View style={[s.btnInner, { height: h }]}>
      {icon && <Icon name={icon} size={14} color={fg} />}
      <Txt w={700} size={small ? 13 : 14} color={fg}>{label}</Txt>
    </View>
  );
  const bg = { ghost: C.soft, danger: C.dangerBg, dark: C.ink2, white: '#fff' }[kind];
  return (
    <Tap onPress={onPress} style={[{ flex: 1, borderRadius: h / 2, overflow: 'hidden' }, style]}>
      {kind === 'primary' ? <Grad style={{ borderRadius: h / 2 }}>{inner}</Grad> : <View style={{ backgroundColor: bg, borderRadius: h / 2 }}>{inner}</View>}
    </Tap>
  );
}

export function FollowBtn({ id, big, style }) {
  const { following, toggleFollow } = useApp();
  const on = following.has(id);
  const h = big ? 46 : 32;
  const content = (
    <View style={[s.btnInner, { height: h, paddingHorizontal: big ? 18 : 14 }]}>
      <Icon name={on ? 'check' : 'plus'} size={big ? 14 : 11} color={on ? C.g2 : '#fff'} />
      <Txt w={700} size={big ? 14.5 : 12.5} color={on ? C.g2 : '#fff'}>{on ? 'Following' : 'Follow'}</Txt>
    </View>
  );
  return (
    <Tap onPress={() => toggleFollow(id)} style={[{ borderRadius: h / 2, overflow: 'hidden' }, big && { flex: 1 }, style]} hitSlop={6}>
      {on ? <View style={{ backgroundColor: C.soft, borderRadius: h / 2 }}>{content}</View> : <Grad style={{ borderRadius: h / 2 }}>{content}</Grad>}
    </Tap>
  );
}

export function RoundBtn({ icon, onPress, size = 46, bg = C.soft, color = C.g2, label }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }} hitSlop={4}>
      <Icon name={icon} size={size * 0.36} color={color} />
    </Tap>
  );
}

/* ---------- layout helpers ---------- */
export function SecHead({ title, live, action, onAction }) {
  return (
    <View style={s.secHead}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {live && <LiveDot />}
        <Txt w={800} size={18} color={C.ink2} style={{ letterSpacing: -0.3 }}>{title}</Txt>
      </View>
      {action && <Tap onPress={onAction} hitSlop={8}><Txt w={700} size={13} color={C.g1}>{action}</Txt></Tap>}
    </View>
  );
}

export function SheetHead({ title, right, onClose, children }) {
  return (
    <View>
      <View style={s.grab} />
      <View style={s.sheetHead}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {children}
          {title ? <Txt w={800} size={19} color={C.ink2} style={{ letterSpacing: -0.3, flexShrink: 1 }}>{title}</Txt> : null}
        </View>
        {right}
        <RoundBtn icon="xmark" size={36} color={C.ink} onPress={onClose} label="Close" />
      </View>
    </View>
  );
}

export const Card = ({ style, children }) => <View style={[{ backgroundColor: C.card, borderRadius: 22 }, shadow, style]}>{children}</View>;

export const s = StyleSheet.create({
  dot: { position: 'absolute', right: 0, bottom: 0, backgroundColor: C.online, borderWidth: 2.5, borderColor: '#fff' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.pink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginTop: 20, marginBottom: 12 },
  grab: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#d8cde5', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },
});
