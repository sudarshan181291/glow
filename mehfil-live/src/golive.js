// Dancer "Go live with camera": real front-camera preview on the dancer's phone,
// with live viewers, gifts and private-room requests on top.
// NOTE: in this prototype the camera feed stays on this phone. Sending it to
// viewers' phones needs a live-video service (LiveKit, Agora, 100ms…) and a server.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Btn, st } from './ui';
import { C, fmt, mmss } from './data';

export function GoLiveScreen({ S, act, pad, onClose }) {
  const [cam, requestCam] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const [facing, setFacing] = useState('front');
  const [startedAt] = useState(Date.now());
  const me = S.roster.find((x) => x.id === S.selfId);
  const now = S.now || Date.now();
  const room = S.rooms.find((r) => r.did === me.id);
  const gifts = S.events.filter((e) => e.did === me.id && e.at >= startedAt).slice(0, 4);
  const earnedLive = S.events.filter((e) => e.did === me.id && e.at >= startedAt).reduce((a, e) => a + e.amt, 0);
  const viewers = 180 + ((Math.floor(now / 4000) * 37) % 140);

  useEffect(() => { act.setSelfCamera(true); }, []);
  const end = () => { act.setSelfCamera(false); onClose(); };

  const granted = cam?.granted && mic?.granted;
  const ask = async () => { await requestCam(); await requestMic(); };

  return (
    <Modal visible animationType="slide" onRequestClose={end}>
      <View style={[st.root, { backgroundColor: '#000' }]}>
        {granted ? (
          <CameraView style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} facing={facing} mirror={facing === 'front'} />
        ) : (
          <View style={[st.center, { flex: 1, padding: 30 }]}>
            <Text style={{ fontSize: 48 }}>📷</Text>
            <Text style={[st.h2, { textAlign: 'center', marginTop: 10 }]}>Allow camera and microphone</Text>
            <Text style={[st.body, { textAlign: 'center', marginTop: 8, color: C.dim }]}>Mehfil Live needs your camera and microphone to put you on stage.</Text>
            <Btn label="Allow access" onPress={ask} style={{ marginTop: 18, alignSelf: 'stretch' }} />
            {(cam && !cam.canAskAgain && !cam.granted) && <Text style={[st.meta, { marginTop: 10, textAlign: 'center' }]}>Access was blocked. Open phone Settings → Apps → Mehfil Live → Permissions and allow Camera and Microphone.</Text>}
            <Btn kind="ghost" label="Back" onPress={end} style={{ marginTop: 10, alignSelf: 'stretch' }} />
          </View>
        )}

        {granted && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, paddingTop: pad.paddingTop + 8, paddingBottom: pad.paddingBottom + 10 }} pointerEvents="box-none">
            {/* top bar */}
            <View style={[st.row, { paddingHorizontal: 12, gap: 8 }]}>
              <View style={{ backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: '#fff', fontWeight: '900' }}>● LIVE {mmss(now - startedAt)}</Text></View>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: '#fff', fontWeight: '700' }}>👁 {viewers}</Text></View>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setFacing(facing === 'front' ? 'back' : 'front')} style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 18, padding: 8 }}><Text style={{ fontSize: 18 }}>🔄</Text></Pressable>
            </View>
            <View style={{ marginTop: 8, marginHorizontal: 12, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: C.goldLight, fontWeight: '800' }}>{me.name} · {room ? `🔒 private with ${room.customer} · ${mmss(room.endsAt - now)}` : 'on stage'} · 🪙 +{fmt(earnedLive)}</Text>
            </View>

            <View style={{ flex: 1 }} pointerEvents="none" />

            {/* gifts arriving */}
            <View style={{ paddingHorizontal: 12, gap: 4 }} pointerEvents="none">
              {gifts.map((g) => (
                <GiftLine key={g.id} text={`${g.from} · ${g.kind === 'room' ? '🔒 private room' : g.kind === 'gift' ? '🎁 gift' : g.kind} · +${fmt(g.amt)}`} />
              ))}
            </View>

            {/* private-room requests */}
            {S.incoming.map((r) => (
              <View key={r.id} style={{ margin: 12, marginBottom: 0, backgroundColor: 'rgba(27,16,48,0.95)', borderRadius: 14, padding: 12, borderWidth: 2, borderColor: C.rose }}>
                <Text style={st.h3}>🔔 {r.customer} wants a private room</Text>
                <Text style={st.meta}>{r.min} min · you earn 🪙{fmt((r.cost * me.split) / 100)} · {mmss(r.expiresAt - now)} left</Text>
                <View style={[st.row, { gap: 8, marginTop: 8 }]}>
                  <Btn small label="Accept" onPress={() => act.acceptIncoming(r.id)} style={{ flex: 1 }} />
                  <Btn small kind="ghost" label="Decline" onPress={() => act.declineIncoming(r.id)} style={{ flex: 1 }} />
                </View>
              </View>
            ))}

            <View style={[st.row, { gap: 8, paddingHorizontal: 12, marginTop: 10 }]}>
              {room && <Btn kind="dark" label="End private room" onPress={act.endSelfRoom} style={{ flex: 1 }} />}
              <Btn kind="danger" label="End live" onPress={end} style={{ flex: 1 }} />
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center', marginTop: 6, paddingHorizontal: 16 }}>
              Prototype: your camera shows on this phone only. Streaming to viewers needs a live-video service.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

function GiftLine({ text }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 300, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(212,175,55,0.85)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] }}>
      <Text style={{ color: C.bg, fontWeight: '800', fontSize: 12 }}>{text}</Text>
    </Animated.View>
  );
}
