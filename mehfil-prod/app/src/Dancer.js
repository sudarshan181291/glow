import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

// Shared beat drivers so 20 dancers don't each run their own loop.
const drivers = [800, 950, 1100, 720].map((d) => ({ v: new Animated.Value(0), d }));
const groupDriver = { v: new Animated.Value(0), d: 520 };
let started = false;

function startDrivers() {
  if (started) return;
  started = true;
  [...drivers, groupDriver].forEach(({ v, d }) => {
    Animated.loop(
      Animated.timing(v, { toValue: 1, duration: d, easing: Easing.linear, useNativeDriver: true })
    ).start();
  });
}

/**
 * A stylised dancer drawn from plain Views.
 * props: p (performer), size (height px), group (bool), mode ('normal'|'backstage'|'performing')
 */
export default function Dancer({ p, size = 80, group = false, mode = 'normal' }) {
  useEffect(startDrivers, []);
  const beat = group ? groupDriver.v : drivers[p.variant % drivers.length].v;
  const amp = group ? 1.6 : mode === 'backstage' ? 0.35 : mode === 'performing' ? 1.4 : 1;
  const s = size;

  const bounce = beat.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -s * 0.05 * amp, 0, -s * 0.05 * amp, 0],
  });
  const sway = beat.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [`${-6 * amp}deg`, `${6 * amp}deg`, `${-6 * amp}deg`],
  });
  const hips = beat.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-s * 0.03 * amp, s * 0.03 * amp, -s * 0.03 * amp],
  });
  const lArm = beat.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [`${20 + 10 * amp}deg`, `${60 + 80 * amp}deg`, `${20 + 10 * amp}deg`],
  });
  const rArm = beat.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [`${-60 - 80 * amp}deg`, `${-20 - 10 * amp}deg`, `${-60 - 80 * amp}deg`],
  });

  const w = s * 0.7;
  const cx = w / 2;
  const headD = s * 0.17;
  const torsoW = s * 0.2;
  const torsoTop = s * 0.25;
  const male = p.gender === 'm';

  return (
    <Animated.View
      style={{ width: w, height: s, transform: [{ translateY: bounce }, { translateX: hips }, { rotate: sway }] }}
    >
      {/* dupatta / sash */}
      <View
        style={{
          position: 'absolute', left: cx - torsoW * 0.9, top: torsoTop + s * 0.02, width: torsoW * 1.8, height: s * 0.035,
          backgroundColor: p.accent, opacity: 0.85, borderRadius: 4, transform: [{ rotate: '-28deg' }], zIndex: 3,
        }}
      />
      {/* arms */}
      <Animated.View
        style={{
          position: 'absolute', left: cx - torsoW / 2 - s * 0.045, top: torsoTop + s * 0.01, width: s * 0.055, height: s * 0.24,
          backgroundColor: p.skin, borderRadius: s * 0.03, transformOrigin: 'top', transform: [{ rotate: lArm }], zIndex: 1,
        }}
      >
        <View style={{ position: 'absolute', bottom: s * 0.03, left: -1, right: -1, height: s * 0.02, backgroundColor: '#d4af37', borderRadius: 2 }} />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute', left: cx + torsoW / 2 - s * 0.01, top: torsoTop + s * 0.01, width: s * 0.055, height: s * 0.24,
          backgroundColor: p.skin, borderRadius: s * 0.03, transformOrigin: 'top', transform: [{ rotate: rArm }], zIndex: 1,
        }}
      >
        <View style={{ position: 'absolute', bottom: s * 0.03, left: -1, right: -1, height: s * 0.02, backgroundColor: '#d4af37', borderRadius: 2 }} />
      </Animated.View>

      {/* hair back / bun */}
      {!male && (
        <View
          style={{
            position: 'absolute', left: cx - headD * 0.62, top: s * 0.035, width: headD * 1.24, height: headD * 1.35,
            borderRadius: headD, backgroundColor: '#1a0d0d',
          }}
        />
      )}
      {/* head */}
      <View
        style={{
          position: 'absolute', left: cx - headD / 2, top: s * 0.06, width: headD, height: headD,
          borderRadius: headD / 2, backgroundColor: p.skin, zIndex: 2,
        }}
      >
        {/* eyes */}
        <View style={{ position: 'absolute', top: headD * 0.42, left: headD * 0.25, width: headD * 0.12, height: headD * 0.12, borderRadius: headD, backgroundColor: '#2b1a1a' }} />
        <View style={{ position: 'absolute', top: headD * 0.42, right: headD * 0.25, width: headD * 0.12, height: headD * 0.12, borderRadius: headD, backgroundColor: '#2b1a1a' }} />
        <View style={{ position: 'absolute', top: headD * 0.68, left: headD * 0.36, width: headD * 0.28, height: headD * 0.08, borderRadius: headD, backgroundColor: '#b23a48' }} />
      </View>
      {male ? (
        // pagdi (turban)
        <View
          style={{
            position: 'absolute', left: cx - headD * 0.62, top: s * 0.02, width: headD * 1.24, height: headD * 0.62,
            borderTopLeftRadius: headD, borderTopRightRadius: headD, backgroundColor: p.accent, zIndex: 3,
            borderBottomWidth: 2, borderColor: '#d4af37',
          }}
        />
      ) : (
        <>
          {/* hair top + maang tikka */}
          <View
            style={{
              position: 'absolute', left: cx - headD * 0.55, top: s * 0.05, width: headD * 1.1, height: headD * 0.45,
              borderTopLeftRadius: headD, borderTopRightRadius: headD, backgroundColor: '#1a0d0d', zIndex: 3,
            }}
          />
          <View style={{ position: 'absolute', left: cx - s * 0.012, top: s * 0.085, width: s * 0.024, height: s * 0.024, borderRadius: s, backgroundColor: '#d4af37', zIndex: 4 }} />
        </>
      )}

      {/* torso: choli or sherwani */}
      <View
        style={{
          position: 'absolute', left: cx - torsoW / 2, top: torsoTop, width: torsoW, height: male ? s * 0.38 : s * 0.2,
          backgroundColor: p.outfit, borderTopLeftRadius: s * 0.05, borderTopRightRadius: s * 0.05,
          borderBottomLeftRadius: male ? s * 0.02 : 0, borderBottomRightRadius: male ? s * 0.02 : 0, zIndex: 2,
          borderWidth: 1, borderColor: 'rgba(212,175,55,0.7)',
        }}
      >
        {male && <View style={{ position: 'absolute', left: torsoW / 2 - 1, top: 2, bottom: 2, width: 2, backgroundColor: '#d4af37' }} />}
      </View>

      {male ? (
        // churidar legs
        <>
          <View style={{ position: 'absolute', left: cx - torsoW * 0.38, top: torsoTop + s * 0.37, width: s * 0.06, height: s * 0.3, backgroundColor: '#f3ead8', borderRadius: 3 }} />
          <View style={{ position: 'absolute', left: cx + torsoW * 0.38 - s * 0.06, top: torsoTop + s * 0.37, width: s * 0.06, height: s * 0.3, backgroundColor: '#f3ead8', borderRadius: 3 }} />
        </>
      ) : (
        // lehenga (triangle) with gold border
        <>
          <View
            style={{
              position: 'absolute', left: cx - s * 0.27, top: torsoTop + s * 0.18, width: 0, height: 0,
              borderLeftWidth: s * 0.27, borderRightWidth: s * 0.27, borderBottomWidth: s * 0.47,
              borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: p.outfit, zIndex: 1,
            }}
          />
          <View style={{ position: 'absolute', left: cx - s * 0.27, top: torsoTop + s * 0.64, width: s * 0.54, height: s * 0.03, backgroundColor: '#d4af37', borderRadius: 2, zIndex: 2 }} />
          <View style={{ position: 'absolute', left: cx - s * 0.12, top: torsoTop + s * 0.67, width: s * 0.06, height: s * 0.03, backgroundColor: p.skin, borderRadius: 3 }} />
          <View style={{ position: 'absolute', left: cx + s * 0.06, top: torsoTop + s * 0.67, width: s * 0.06, height: s * 0.03, backgroundColor: p.skin, borderRadius: 3 }} />
        </>
      )}
    </Animated.View>
  );
}
