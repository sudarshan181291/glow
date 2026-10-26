// Supply side: the dancer's own app (BR-72 … BR-85)
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Dancer from './Dancer';
import { Btn, Chip, Stat, st, statusInfo } from './ui';
import { C, fmt, mmss } from './data';
import { GoLiveScreen } from './golive';

export function DancerHome({ S, act, pad }) {
  const me = S.roster.find((x) => x.id === S.selfId);
  const [msg, setMsg] = useState('');
  const [live, setLive] = useState(false);
  const now = S.now || Date.now();
  const s = statusInfo(me, S.lang, now);
  const room = S.rooms.find((r) => r.did === me.id);
  const mode = me.status === 'off' ? 'off' : me.status === 'break' ? 'break' : S.selfBusy ? 'busy' : 'available';
  const ledger = S.events.filter((e) => e.did === me.id).slice(0, 25);
  const earned = (me.coins * me.split) / 100;
  const today = S.events.filter((e) => e.did === me.id).reduce((a, e) => a + e.amt, 0);
  const fans = Object.entries(me.fans).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const recent = [...new Set(S.events.filter((e) => e.did === me.id).map((e) => e.from))].slice(0, 6);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={[st.box, st.row, { gap: 12 }]}>
        <View style={{ width: 70, height: 84, justifyContent: 'flex-end', alignItems: 'center' }}><Dancer p={me} size={80} mode={me.status === 'stage' ? 'normal' : 'backstage'} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.h2}>{me.name}</Text>
          <Text style={{ color: s.color, fontWeight: '800' }}>● {s.label}</Text>
          <Text style={st.meta}>{me.specs.join(', ')} · {fmt(me.followers)} followers · split {me.split}%</Text>
          <Text style={[st.meta, { color: C.green }]}>✓ Profile · ✓ KYC verified · ✓ Bank verified</Text>
        </View>
      </View>

      <Btn label={S.selfCamera ? '📷 Return to my live camera' : '📷 Go live with camera'} onPress={() => setLive(true)} />
      {live && <GoLiveScreen S={S} act={act} pad={pad || { paddingTop: 0, paddingBottom: 0 }} onClose={() => setLive(false)} />}

      {/* BR-75 availability */}
      <View style={st.box}>
        <Text style={st.h3}>My availability</Text>
        <View style={[st.row, { gap: 6, marginTop: 8, flexWrap: 'wrap' }]}>
          {[['available', '🟢 Available'], ['busy', '🟡 Busy'], ['break', '☕ Break'], ['off', '🌙 Off shift']].map(([k, l]) => (
            <Chip key={k} label={l} on={mode === k} onPress={() => act.setSelfAvailability(k)} color={k === 'available' ? C.green : C.amber} />
          ))}
        </View>
        <Text style={[st.meta, { marginTop: 6 }]}>Busy keeps you on stage but pauses private requests. You can decline any request without penalty.</Text>
      </View>

      {/* BR-44/76 incoming requests */}
      {S.incoming.map((r) => (
        <View key={r.id} style={[st.box, { borderColor: C.rose, borderWidth: 2 }]}>
          <Text style={st.h3}>🔔 Private room request</Text>
          <Text style={st.body}>{r.customer} · {r.min} min · 🪙{fmt(r.cost)} (you earn 🪙{fmt((r.cost * me.split) / 100)})</Text>
          <Text style={st.meta}>Expires in {mmss(r.expiresAt - now)}</Text>
          <View style={[st.row, { gap: 8, marginTop: 8 }]}>
            <Btn label="Accept" onPress={() => act.acceptIncoming(r.id)} style={{ flex: 1 }} />
            <Btn kind="ghost" label="Decline" onPress={() => act.declineIncoming(r.id)} style={{ flex: 1 }} />
            <Btn kind="dark" small label="Block" onPress={() => act.blockCustomer(r.customer)} />
          </View>
        </View>
      ))}
      {!S.incoming.length && me.status === 'stage' && !S.selfBusy && !room && <Text style={st.meta}>Waiting for private room requests… (they arrive while you are on stage and available)</Text>}

      {room && (
        <View style={[st.box, { borderColor: C.amber }]}>
          <Text style={st.h3}>🔒 In a private room with {room.customer}</Text>
          <Text style={{ color: C.amber, fontSize: 26, fontWeight: '900' }}>⏱ {mmss(room.endsAt - now)}</Text>
          <Text style={st.meta}>Your slot on stage was backfilled. You return automatically when the room ends.</Text>
          <View style={[st.row, { gap: 8, marginTop: 8 }]}>
            <Btn kind="danger" label="End room (pro-rata refund)" onPress={act.endSelfRoom} style={{ flex: 1 }} />
            <Btn kind="dark" label="Block" onPress={() => { act.blockCustomer(room.customer); act.endSelfRoom(); }} />
          </View>
        </View>
      )}

      {/* BR-77 earnings */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
        <Stat k="My earnings (share)" v={`🪙${fmt(earned)}`} color={C.goldLight} />
        <Stat k="Tonight (gross)" v={`🪙${fmt(today)}`} />
        <Stat k="Next payout" v="Monday" />
        <Stat k="Payout threshold" v="₹1,000" />
      </View>

      {/* BR-80 followers + top fans */}
      <View style={st.box}>
        <Text style={st.h3}>⭐ My top fans</Text>
        {fans.map(([n, v], i) => (
          <View key={n} style={[st.row, { paddingVertical: 4 }]}>
            <Text style={{ color: C.gold, width: 24, fontWeight: '900' }}>{i + 1}</Text>
            <Text style={{ color: C.text, flex: 1, fontWeight: '700' }}>{n}</Text>
            <Text style={st.gold}>🪙{fmt(v)}</Text>
          </View>
        ))}
      </View>

      {/* BR-81 rate-limited message */}
      <View style={st.box}>
        <Text style={st.h3}>💌 Message my followers</Text>
        <Text style={st.meta}>One message every 10 minutes</Text>
        <TextInput value={msg} onChangeText={setMsg} placeholder="e.g. Live at 9 tonight — see you! 💃" placeholderTextColor={C.dim} style={[st.input, { marginTop: 8 }]} />
        <Btn label="Send to followers" onPress={() => { if (msg.trim()) { act.messageFollowers(msg.trim()); setMsg(''); } }} style={{ marginTop: 8 }} />
      </View>

      {/* BR-79 ledger */}
      <View style={st.box}>
        <Text style={st.h3}>📒 Ledger</Text>
        {ledger.length === 0 && <Text style={st.meta}>Nothing yet tonight</Text>}
        {ledger.map((e) => (
          <View key={e.id} style={[st.row, { paddingVertical: 4 }]}>
            <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{{ gift: '🎁', room: '🔒', song: '🎶', shoutout: '📣', refund: '↩️' }[e.kind]} {e.kind} · {e.from}</Text>
            <Text style={{ color: e.amt >= 0 ? C.green : C.red, fontWeight: '800' }}>{e.amt >= 0 ? '+' : ''}{fmt((e.amt * me.split) / 100)}</Text>
          </View>
        ))}
      </View>

      {/* BR-84 safety */}
      <View style={st.box}>
        <Text style={st.h3}>🛡 Safety</Text>
        <Text style={st.meta}>Recent customers — block anyone, any time</Text>
        {recent.map((n) => (
          <View key={n} style={[st.row, { paddingVertical: 4 }]}>
            <Text style={[st.body, { flex: 1 }]}>{n}</Text>
            {S.blocked.includes(n)
              ? <Btn small kind="dark" label="Unblock" onPress={() => act.unblockCustomer(n)} />
              : <Btn small kind="ghost" label="Block" onPress={() => act.blockCustomer(n)} />}
          </View>
        ))}
        <Btn kind="gold" label="📞 Call dancer support" onPress={act.support} style={{ marginTop: 10 }} />
      </View>
    </ScrollView>
  );
}
