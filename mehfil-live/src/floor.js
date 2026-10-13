// Floor Manager console: movement engine control, remote config, moderation (BR-R1 … BR-R9, NFR-08, NFR-11)
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Btn, Chip, Stat, st, statusInfo } from './ui';
import { C, fmt, mmss } from './data';

function Stepper({ label, value, onChange, step = 1, min = 0, max = 99999, unit = '' }) {
  return (
    <View style={[st.row, { paddingVertical: 6 }]}>
      <Text style={[st.body, { flex: 1 }]}>{label}</Text>
      <Pressable onPress={() => onChange(Math.max(min, value - step))} style={stepBtn}><Text style={st.h3}>−</Text></Pressable>
      <Text style={[st.h3, { width: 78, textAlign: 'center' }]}>{fmt(value)}{unit}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + step))} style={stepBtn}><Text style={st.h3}>+</Text></Pressable>
    </View>
  );
}
const stepBtn = { width: 36, height: 32, borderRadius: 8, backgroundColor: C.roseDim, alignItems: 'center', justifyContent: 'center' };

export function FloorConsole({ S, act }) {
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');
  const now = S.now || Date.now();
  const cfg = S.config;
  const count = (k) => S.roster.filter((x) => x.status === k).length;
  const stageN = count('stage');
  const roster = S.roster.filter((x) => filter === 'all' || x.status === filter);
  const openReports = S.reports.filter((r) => r.open);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
        <Stat k="On stage" v={`${stageN} / ${cfg.stageCap}`} color={stageN < cfg.minStage ? C.red : C.green} />
        <Stat k="Bench" v={count('bench')} color={C.blue} />
        <Stat k="Private rooms" v={`${S.rooms.length} / ${cfg.maxRooms}`} color={C.amber} />
        <Stat k="Break · off shift" v={`${count('break')} · ${count('off')}`} />
        <Stat k="Gross tonight" v={`🪙${fmt(S.stats.gross)}`} color={C.goldLight} />
        <Stat k="Platform share" v={`🪙${fmt(S.stats.platform)}`} />
        <Stat k="Dancer payouts" v={`🪙${fmt(S.stats.dancerShare)}`} />
        <Stat k="Refunds" v={`🪙${fmt(S.stats.refunds)}`} />
      </View>

      <View style={st.box}>
        <Text style={st.h3}>⚙️ Remote config</Text>
        <Stepper label="Minimum stage dancers" value={cfg.minStage} min={1} max={cfg.stageCap} onChange={(v) => act.setConfig('minStage', v)} />
        <Stepper label="Max concurrent private rooms" value={cfg.maxRooms} min={0} max={12} onChange={(v) => act.setConfig('maxRooms', v)} />
        <Stepper label="Default dancer split" value={cfg.split} min={30} max={80} step={5} unit="%" onChange={(v) => act.setConfig('split', v)} />
        <Stepper label="5-min room price" value={cfg.price5} min={100} step={50} onChange={(v) => act.setConfig('price5', v)} />
        <Stepper label="15-min room price" value={cfg.price15} min={300} step={100} onChange={(v) => act.setConfig('price15', v)} />
        <Stepper label="+5 min extension" value={cfg.ext} min={100} step={50} onChange={(v) => act.setConfig('ext', v)} />
        <Text style={st.meta}>Backfill target: under 5 seconds · stage never drops below the minimum</Text>
      </View>

      <View style={st.box}>
        <Text style={st.h3}>🔒 Private rooms ({S.rooms.length})</Text>
        {S.rooms.length === 0 && <Text style={st.meta}>No rooms running</Text>}
        {S.rooms.map((r) => {
          const p = S.roster.find((x) => x.id === r.did);
          return (
            <View key={r.id} style={[st.row, { paddingVertical: 6, gap: 8 }]}>
              <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{p.name} · {r.mine ? 'You' : r.customer} · {mmss(r.endsAt - now)}</Text>
              <Btn small kind="danger" label="End" onPress={() => act.endRoomFloor(r.id)} />
            </View>
          );
        })}
        {S.waitlist.length > 0 && <Text style={st.meta}>Waitlist: {S.waitlist.length}</Text>}
        <Btn kind="danger" label="⛔ Kill switch — end all rooms" onPress={act.killAll} style={{ marginTop: 8 }} disabled={!S.rooms.length} />
      </View>

      <View style={st.box}>
        <Text style={st.h3}>📢 Announcement</Text>
        <TextInput value={msg} onChangeText={setMsg} placeholder="e.g. Special Lavani set at 10 PM" placeholderTextColor={C.dim} style={[st.input, { marginTop: 8 }]} />
        <Btn label="Broadcast banner" onPress={() => { act.announce(msg); setMsg(''); }} style={{ marginTop: 8 }} />
      </View>

      <View style={st.box}>
        <Text style={st.h3}>⚑ Reports ({openReports.length} open)</Text>
        {S.reports.length === 0 && <Text style={st.meta}>No reports</Text>}
        {S.reports.map((r) => (
          <View key={r.id} style={[st.row, { paddingVertical: 6, gap: 8 }]}>
            <Text style={[st.body, { flex: 1, opacity: r.open ? 1 : 0.5 }]}>{r.reason} · {r.about} · by {r.by}</Text>
            {r.open && <Btn small kind="ghost" label="Resolve" onPress={() => act.resolveReport(r.id)} />}
          </View>
        ))}
      </View>

      <View style={st.box}>
        <Text style={st.h3}>👥 Roster ({S.roster.length})</Text>
        <View style={[st.row, { gap: 6, flexWrap: 'wrap', marginVertical: 8 }]}>
          {['all', 'stage', 'bench', 'private', 'break', 'off'].map((k) => <Chip key={k} label={k} on={filter === k} onPress={() => setFilter(k)} />)}
        </View>
        {roster.map((p) => {
          const s = statusInfo(p, 'en', now);
          return (
            <View key={p.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
              <View style={st.row}>
                <Text style={{ color: C.text, fontWeight: '800', flex: 1 }}>{p.name} <Text style={{ color: s.color, fontSize: 12 }}>● {s.label}</Text></Text>
                <Text style={st.meta}>split </Text>
                <Pressable onPress={() => act.adjustSplit(p.id, -5)} style={[stepBtn, { width: 26, height: 24 }]}><Text style={{ color: '#fff' }}>−</Text></Pressable>
                <Text style={{ color: C.goldLight, width: 40, textAlign: 'center', fontWeight: '800' }}>{p.split}%</Text>
                <Pressable onPress={() => act.adjustSplit(p.id, 5)} style={[stepBtn, { width: 26, height: 24 }]}><Text style={{ color: '#fff' }}>+</Text></Pressable>
              </View>
              <View style={[st.row, { gap: 6, marginTop: 6 }]}>
                {p.status !== 'stage' && <Btn small kind="dark" label={p.status === 'private' ? 'Force return' : 'To stage'} onPress={() => act.forceStatus(p.id, 'stage')} />}
                {p.status !== 'bench' && p.status !== 'private' && <Btn small kind="dark" label="Bench" onPress={() => act.forceStatus(p.id, 'bench')} />}
                {p.status !== 'break' && p.status !== 'private' && <Btn small kind="dark" label="Break" onPress={() => act.forceStatus(p.id, 'break')} />}
                {p.status !== 'off' && p.status !== 'private' && <Btn small kind="dark" label="Off" onPress={() => act.forceStatus(p.id, 'off')} />}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
