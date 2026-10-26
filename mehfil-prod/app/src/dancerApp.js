// Dancer's own app: go live, availability, private room requests, earnings, fans, safety.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Dancer from './Dancer';
import { Btn, Chip, Stat, st, statusInfo } from './ui';
import { C, fmt, mmss } from './data';
import { api } from './api';
import { LiveVideo, useLiveRoom } from './live';

const KIND_ICON = { gift: '🎁', room: '🔒', song: '🎶', shoutout: '📣', refund: '↩️', package: '🎟', extension: '⏱' };

/** Full-screen camera: on the shared stage, or in the private room when one is running. */
function GoLiveScreen({ S, act, pad, onClose }) {
  const room = S.dancerMe?.room;
  const kind = room ? 'room' : 'stage';
  const { error, local, remote, controls } = useLiveRoom({ kind, bookingId: room?.id, enabled: true });
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(true);
  const now = S.now || Date.now();
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[{ flex: 1, backgroundColor: '#000' }, pad]}>
        {local && cam
          ? <LiveVideo trackRef={local} mirror={controls.facing === 'user'} style={{ flex: 1 }} />
          : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', textAlign: 'center', padding: 20 }}>{error || (cam ? 'Starting camera…' : 'Camera is off')}</Text></View>}

        {room && remote[0] && (
          <View style={{ position: 'absolute', right: 12, top: pad.paddingTop + 60, width: 110, height: 160, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: C.gold }}>
            <LiveVideo trackRef={remote[0]} style={{ flex: 1 }} />
          </View>
        )}

        <View style={{ position: 'absolute', top: pad.paddingTop + 10, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '900', backgroundColor: room ? C.amber : C.red, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' }}>
            {room ? `🔒 PRIVATE · ${room.customer || 'Customer'} · ${mmss(room.endsAt - now)}` : '● LIVE ON STAGE'}
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={10}><Text style={{ color: '#fff', fontSize: 26 }}>✕</Text></Pressable>
        </View>

        <View style={{ position: 'absolute', bottom: pad.paddingBottom + 16, left: 12, right: 12, gap: 8 }}>
          <Text style={{ color: '#ddd', fontSize: 12, textAlign: 'center' }}>Dance & music only · keep it fully clothed · moderators may check any room</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn kind="dark" label={cam ? '📷 Camera on' : '📷 Camera off'} onPress={() => { controls.setCamera(!cam); setCam(!cam); }} style={{ flex: 1 }} />
            <Btn kind="dark" label={mic ? '🎙 Mic on' : '🔇 Muted'} onPress={() => { controls.setMic(!mic); setMic(!mic); }} style={{ flex: 1 }} />
            <Btn kind="dark" label="🔄" onPress={controls.flip} />
          </View>
          {room && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn kind="danger" label="End room" onPress={act.endSelfRoom} style={{ flex: 1 }} />
              <Btn kind="dark" label="Block & end" onPress={() => { act.blockCustomer(room.customerId); act.endSelfRoom(); }} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function DancerHome({ S, act, pad }) {
  const [msg, setMsg] = useState('');
  const [live, setLive] = useState(false);
  const [ledger, setLedger] = useState(null);
  const now = S.now || Date.now();
  const dm = S.dancerMe;

  useEffect(() => {
    act.loadDancer();
    const t = setInterval(act.loadDancer, 20000);
    return () => clearInterval(t);
  }, [act]);
  const loadLedger = () => api('GET', '/dancer/ledger').then((r) => setLedger(r.items)).catch(() => setLedger([]));
  useEffect(() => { loadLedger(); }, [dm?.earnings?.todayGross]);
  // A room just started: open the camera straight into it.
  useEffect(() => { if (dm?.room) setLive(true); }, [dm?.room?.id]);

  if (!dm) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}><Text style={st.meta}>Loading your dancer profile…</Text></View>;

  const me = { ...(S.roster.find((x) => x.id === dm.dancer.id) || {}), ...dm.dancer };
  const s = statusInfo(me, S.lang, now);
  const mode = me.status === 'off' ? 'off' : me.status === 'break' ? 'break' : me.busy ? 'busy' : 'available';
  const kycOk = dm.dancer.kycStatus === 'approved';

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={[st.box, st.row, { gap: 12 }]}>
        <View style={{ width: 70, height: 84, justifyContent: 'flex-end', alignItems: 'center' }}><Dancer p={me} size={80} mode={me.status === 'stage' ? 'normal' : 'backstage'} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.h2}>{me.name}</Text>
          <Text style={{ color: s.color, fontWeight: '800' }}>● {s.label}{me.cameraLive ? ' · 📷 camera live' : ''}</Text>
          <Text style={st.meta}>{(me.specs || []).join(', ')} · {fmt(me.followers || 0)} followers · split {dm.dancer.split}%</Text>
          <Text style={[st.meta, { color: kycOk ? C.green : C.amber }]}>{kycOk ? '✓ KYC approved' : `KYC ${dm.dancer.kycStatus} — the studio must verify you before you can go on stage`}</Text>
        </View>
      </View>

      <Btn label={dm.room ? '🔒 Open private room camera' : '📷 Go live with camera'} disabled={!kycOk || (me.status !== 'stage' && !dm.room)} onPress={() => setLive(true)} />
      {me.status !== 'stage' && !dm.room && kycOk && <Text style={st.meta}>Set yourself Available — when the floor puts you on stage, your camera can go live.</Text>}
      {live && <GoLiveScreen S={S} act={act} pad={pad || { paddingTop: 0, paddingBottom: 0 }} onClose={() => setLive(false)} />}

      <View style={st.box}>
        <Text style={st.h3}>My availability</Text>
        <View style={[st.row, { gap: 6, marginTop: 8, flexWrap: 'wrap' }]}>
          {[['available', '🟢 Available'], ['busy', '🟡 Busy'], ['break', '☕ Break'], ['off', '🌙 Off shift']].map(([k, l]) => (
            <Chip key={k} label={l} on={mode === k} onPress={() => act.setSelfAvailability(k)} color={k === 'available' ? C.green : C.amber} />
          ))}
        </View>
        <Text style={[st.meta, { marginTop: 6 }]}>Busy keeps you on stage but pauses private requests. You can decline any request without penalty.</Text>
      </View>

      {S.incoming.map((r) => (
        <View key={r.id} style={[st.box, { borderColor: C.rose, borderWidth: 2 }]}>
          <Text style={st.h3}>🔔 Private room request</Text>
          <Text style={st.body}>{r.customer} · {r.min} min · 🪙{fmt(r.cost)} (you earn 🪙{fmt(r.share ?? (r.cost * dm.dancer.split) / 100)})</Text>
          <Text style={st.meta}>Expires in {mmss(r.expiresAt - now)}</Text>
          <View style={[st.row, { gap: 8, marginTop: 8 }]}>
            <Btn label="Accept" onPress={() => act.acceptIncoming(r.id)} style={{ flex: 1 }} />
            <Btn kind="ghost" label="Decline" onPress={() => act.declineIncoming(r.id)} style={{ flex: 1 }} />
            <Btn kind="dark" small label="Block" onPress={() => { act.declineIncoming(r.id); act.blockCustomer(r.customerId); }} />
          </View>
        </View>
      ))}
      {!S.incoming.length && me.status === 'stage' && !me.busy && !dm.room && <Text style={st.meta}>Waiting for private room requests… (they arrive while you are on stage and available)</Text>}

      {dm.room && (
        <View style={[st.box, { borderColor: C.amber }]}>
          <Text style={st.h3}>🔒 In a private room with {dm.room.customer || 'a customer'}</Text>
          <Text style={{ color: C.amber, fontSize: 26, fontWeight: '900' }}>⏱ {mmss(dm.room.endsAt - now)}</Text>
          <Text style={st.meta}>Your stage slot was backfilled. You go back on stage automatically when the room ends.</Text>
          <View style={[st.row, { gap: 8, marginTop: 8 }]}>
            <Btn kind="danger" label="End room (pro-rata refund)" onPress={act.endSelfRoom} style={{ flex: 1 }} />
            <Btn kind="dark" label="Block" onPress={() => { act.blockCustomer(dm.room.customerId); act.endSelfRoom(); }} />
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
        <Stat k="Unpaid earnings" v={`🪙${fmt(dm.earnings.unpaidShare)}`} color={C.goldLight} />
        <Stat k="≈ in rupees" v={`₹${fmt(dm.earnings.unpaidRupees)}`} />
        <Stat k="Today (gross)" v={`🪙${fmt(dm.earnings.todayGross)}`} />
        <Stat k="Payouts" v="Weekly" />
      </View>

      <View style={st.box}>
        <Text style={st.h3}>⭐ My top fans</Text>
        {dm.topFans.length === 0 && <Text style={st.meta}>No fans yet — they appear here when people gift you.</Text>}
        {dm.topFans.map((f, i) => (
          <View key={f.id} style={[st.row, { paddingVertical: 4 }]}>
            <Text style={{ color: C.gold, width: 24, fontWeight: '900' }}>{i + 1}</Text>
            <Text style={{ color: C.text, flex: 1, fontWeight: '700' }}>{f.name}</Text>
            <Text style={st.gold}>🪙{fmt(f.coins)}</Text>
          </View>
        ))}
      </View>

      <View style={st.box}>
        <Text style={st.h3}>💌 Message my followers</Text>
        <Text style={st.meta}>Up to 140 characters · one message every {S.config.followerMsgIntervalMin || 10} minutes</Text>
        <TextInput value={msg} onChangeText={setMsg} maxLength={140} placeholder="e.g. Live at 9 tonight — see you! 💃" placeholderTextColor={C.dim} style={[st.input, { marginTop: 8 }]} />
        <Btn label="Send to followers" onPress={() => { if (msg.trim()) { act.messageFollowers(msg.trim()); setMsg(''); } }} style={{ marginTop: 8 }} />
      </View>

      <View style={st.box}>
        <View style={st.row}><Text style={[st.h3, { flex: 1 }]}>📒 Ledger</Text><Pressable onPress={loadLedger}><Text style={{ color: C.rose, fontWeight: '800' }}>Refresh</Text></Pressable></View>
        {ledger === null && <Text style={st.meta}>Loading…</Text>}
        {ledger && ledger.length === 0 && <Text style={st.meta}>Nothing yet</Text>}
        {(ledger || []).slice(0, 40).map((e) => (
          <View key={e.id} style={[st.row, { paddingVertical: 4 }]}>
            <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{KIND_ICON[e.kind] || '•'} {e.kind} · {e.display_name || '—'}{e.payout_id ? ' · paid' : ''}</Text>
            <Text style={{ color: e.dancer_share >= 0 ? C.green : C.red, fontWeight: '800' }}>{e.dancer_share >= 0 ? '+' : ''}{fmt(e.dancer_share)}</Text>
          </View>
        ))}
      </View>

      <View style={st.box}>
        <Text style={st.h3}>🛡 Safety</Text>
        <Text style={st.meta}>Blocked customers can't book you or send you requests.</Text>
        {dm.blocked.length === 0 && <Text style={[st.meta, { marginTop: 4 }]}>Nobody blocked</Text>}
        {dm.blocked.map((b) => (
          <View key={b.id} style={[st.row, { paddingVertical: 4 }]}>
            <Text style={[st.body, { flex: 1 }]}>{b.name}</Text>
            <Btn small kind="dark" label="Unblock" onPress={() => act.blockCustomer(b.id, false)} />
          </View>
        ))}
        <Text style={[st.meta, { marginTop: 8 }]}>Something wrong? Tell the floor manager or end the room at any time — you never lose your slot for ending a room.</Text>
      </View>
    </ScrollView>
  );
}
