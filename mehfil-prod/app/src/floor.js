// Studio staff console: floor manager (stage control, config, rooms), moderator (reports, room checks, bans), admin (dancers, KYC, roles, payouts).
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Btn, Chip, Stat, st, statusInfo } from './ui';
import { C, fmt, mmss } from './data';
import { api } from './api';
import { LiveVideo, useLiveRoom } from './live';

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
const ms = (v) => (v ? new Date(v).getTime() : 0);

/** Moderator joins a private room invisibly (watch only). */
function RoomCheck({ room, onClose, onEnd }) {
  const { error, remote } = useLiveRoom({ kind: 'room', tokenPath: `/mod/rooms/${room.id}/token`, camera: false, mic: false });
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: 30 }}>
        <View style={[st.row, { padding: 12 }]}>
          <Text style={{ color: '#fff', fontWeight: '900', flex: 1 }}>👁 Hidden check · {room.stage_name} with {room.customer}</Text>
          <Pressable onPress={onClose} hitSlop={10}><Text style={{ color: '#fff', fontSize: 24 }}>✕</Text></Pressable>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
          {remote.length === 0 && <Text style={{ color: '#ccc', padding: 20 }}>{error || 'Connecting… (nobody sees you)'}</Text>}
          {remote.map((r) => <LiveVideo key={r.participant.identity} trackRef={r} style={{ width: remote.length > 1 ? '50%' : '100%', height: '100%' }} />)}
        </View>
        <View style={{ padding: 12 }}><Btn kind="danger" label="⛔ End this room now" onPress={() => { onEnd(room.id); onClose(); }} /></View>
      </View>
    </Modal>
  );
}

function AdminPanel({ act, roster, reload }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [rolePhone, setRolePhone] = useState('');
  const [role, setRole] = useState('floor');
  const [csv, setCsv] = useState('');
  const pending = roster.filter((p) => p.kycStatus !== 'approved');
  const call = async (fn, ok) => { try { await fn(); act.toast(ok); reload(); } catch (e) { act.toast(e.message || 'Failed'); } };
  return (
    <>
      <View style={st.box}>
        <Text style={st.h3}>➕ Add a dancer</Text>
        <Text style={st.meta}>She signs in with this phone number. Check her ID and age through your KYC provider before approving.</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="Phone (10 digits)" keyboardType="phone-pad" placeholderTextColor={C.dim} style={[st.input, { marginTop: 8 }]} />
        <TextInput value={name} onChangeText={setName} placeholder="Stage name" placeholderTextColor={C.dim} style={[st.input, { marginTop: 8 }]} />
        <TextInput value={dob} onChangeText={setDob} placeholder="Date of birth YYYY-MM-DD" placeholderTextColor={C.dim} style={[st.input, { marginTop: 8 }]} />
        <Btn label="Create dancer" style={{ marginTop: 8 }} onPress={() => call(() => api('POST', '/admin/dancers', { phone, stageName: name, dob }), 'Dancer created — KYC pending')} />
      </View>

      <View style={st.box}>
        <Text style={st.h3}>🪪 KYC ({pending.length} waiting)</Text>
        {pending.length === 0 && <Text style={st.meta}>Everyone is approved</Text>}
        {pending.map((p) => (
          <View key={p.id} style={[st.row, { paddingVertical: 6, gap: 6 }]}>
            <Text style={[st.body, { flex: 1 }]}>{p.name} · {p.kycStatus}</Text>
            <Btn small label="Approve" onPress={() => call(() => api('POST', `/admin/dancers/${p.id}/kyc`, { status: 'approved' }), 'KYC approved')} />
            <Btn small kind="ghost" label="Reject" onPress={() => call(() => api('POST', `/admin/dancers/${p.id}/kyc`, { status: 'rejected' }), 'KYC rejected')} />
          </View>
        ))}
      </View>

      <View style={st.box}>
        <Text style={st.h3}>👤 Staff roles</Text>
        <TextInput value={rolePhone} onChangeText={setRolePhone} placeholder="Phone of someone who has signed in" keyboardType="phone-pad" placeholderTextColor={C.dim} style={[st.input, { marginTop: 8 }]} />
        <View style={[st.row, { gap: 6, marginTop: 8, flexWrap: 'wrap' }]}>
          {['customer', 'floor', 'moderator', 'admin'].map((r) => <Chip key={r} label={r} on={role === r} onPress={() => setRole(r)} />)}
        </View>
        <Btn label="Set role" style={{ marginTop: 8 }} onPress={() => call(() => api('POST', '/admin/users/role', { phone: rolePhone, role }), `Role set to ${role}`)} />
      </View>

      <View style={st.box}>
        <Text style={st.h3}>💸 Weekly payouts</Text>
        <Text style={st.meta}>Creates payout records for every dancer owed ₹1,000 or more and produces a CSV for your bank's bulk transfer.</Text>
        <Btn kind="gold" label="Run payouts" style={{ marginTop: 8 }} onPress={() => call(async () => { setCsv(await api('POST', '/admin/payouts/run', { minRupees: 1000 })); }, 'Payout file ready')} />
        {!!csv && <Text selectable style={[st.meta, { marginTop: 8, fontFamily: 'monospace' }]}>{typeof csv === 'string' ? csv : JSON.stringify(csv)}</Text>}
      </View>
    </>
  );
}

export function FloorConsole({ S, act }) {
  const role = S.user.role;
  const isFloor = role === 'floor' || role === 'admin';
  const isMod = role === 'moderator' || role === 'admin';
  const [ov, setOv] = useState(null);
  const [reports, setReports] = useState([]);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');
  const [check, setCheck] = useState(null);
  const now = S.now || Date.now();

  const reload = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([api('GET', '/floor/overview'), api('GET', '/mod/reports')]);
      setOv(o); setReports(r.items);
    } catch (e) { act.toast(e.message || 'Could not load the console'); }
  }, [act]);
  useEffect(() => { reload(); const t = setInterval(reload, 5000); return () => clearInterval(t); }, [reload]);

  const call = async (fn, ok) => { try { await fn(); if (ok) act.toast(ok); reload(); } catch (e) { act.toast(e.message || 'Failed'); } };
  const setConfig = (k, v) => call(() => api('PATCH', '/floor/config', { [k]: v }));
  const endRoom = (id) => call(() => api('POST', `/floor/rooms/${id}/end`), 'Room ended — customer refunded pro-rata');

  if (!ov) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={st.meta}>Loading studio…</Text></View>;
  const cfg = ov.config;
  const c = (k) => ov.counts[k] || 0;
  const roster = ov.roster.map((p) => ({ ...p, returnAt: ms(p.returnAt) })).filter((x) => filter === 'all' || x.status === filter);
  const openReports = reports.filter((r) => r.status === 'open');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
        <Stat k="On stage" v={`${c('stage')} / ${cfg.stageCap}`} color={c('stage') < cfg.minStage ? C.red : C.green} />
        <Stat k="Bench" v={c('bench')} color={C.blue} />
        <Stat k="Private rooms" v={`${ov.rooms.length} / ${cfg.maxRooms}`} color={C.amber} />
        <Stat k="Break · off" v={`${c('break')} · ${c('off')}`} />
        <Stat k="Gross today" v={`🪙${fmt(ov.today.gross)}`} color={C.goldLight} />
        <Stat k="Platform share" v={`🪙${fmt(ov.today.platform)}`} />
        <Stat k="Dancer share" v={`🪙${fmt(ov.today.dancerShare)}`} />
        <Stat k="Waitlist · reports" v={`${ov.waitlist} · ${ov.openReports}`} />
      </View>

      <View style={st.box}>
        <Text style={st.h3}>🔒 Private rooms ({ov.rooms.length})</Text>
        {ov.rooms.length === 0 && <Text style={st.meta}>No rooms running</Text>}
        {ov.rooms.map((r) => (
          <View key={r.id} style={[st.row, { paddingVertical: 6, gap: 6 }]}>
            <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{r.stage_name} · {r.customer} · {mmss(ms(r.ends_at) - now)}</Text>
            <Btn small kind="dark" label="👁 Check" onPress={() => setCheck(r)} />
            <Btn small kind="danger" label="End" onPress={() => endRoom(r.id)} />
          </View>
        ))}
        <Btn kind="danger" label="⛔ Kill switch — end all rooms" onPress={() => call(() => api('POST', '/floor/kill'), 'All rooms ended')} style={{ marginTop: 8 }} disabled={!ov.rooms.length} />
      </View>
      {check && <RoomCheck room={check} onClose={() => setCheck(null)} onEnd={endRoom} />}

      {isFloor && (
        <View style={st.box}>
          <Text style={st.h3}>⚙️ Studio settings</Text>
          <Stepper label="Minimum stage dancers" value={cfg.minStage} min={0} max={cfg.stageCap} onChange={(v) => setConfig('minStage', v)} />
          <Stepper label="Max private rooms" value={cfg.maxRooms} min={0} max={24} onChange={(v) => setConfig('maxRooms', v)} />
          <Stepper label="Default dancer split" value={cfg.defaultSplit} min={30} max={80} step={5} unit="%" onChange={(v) => setConfig('defaultSplit', v)} />
          <Stepper label="5-min room price" value={cfg.price5} min={100} step={50} onChange={(v) => setConfig('price5', v)} />
          <Stepper label="15-min room price" value={cfg.price15} min={300} step={100} onChange={(v) => setConfig('price15', v)} />
          <Stepper label="+5 min extension" value={cfg.ext} min={100} step={50} onChange={(v) => setConfig('ext', v)} />
          <Stepper label="Request timeout" value={cfg.requestTimeoutSec} min={10} max={120} step={5} unit="s" onChange={(v) => setConfig('requestTimeoutSec', v)} />
        </View>
      )}

      {isFloor && (
        <View style={st.box}>
          <Text style={st.h3}>📢 Announcement</Text>
          <TextInput value={msg} onChangeText={setMsg} maxLength={200} placeholder="e.g. Special Lavani set at 10 PM" placeholderTextColor={C.dim} style={[st.input, { marginTop: 8 }]} />
          <Btn label="Broadcast banner" onPress={() => { if (msg.trim()) { call(() => api('POST', '/floor/announce', { text: msg.trim() }), 'Announced'); setMsg(''); } }} style={{ marginTop: 8 }} />
        </View>
      )}

      <View style={st.box}>
        <Text style={st.h3}>⚑ Reports ({openReports.length} open)</Text>
        {reports.length === 0 && <Text style={st.meta}>No reports</Text>}
        {reports.slice(0, 30).map((r) => (
          <View key={r.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderColor: C.line, opacity: r.status === 'open' ? 1 : 0.5 }}>
            <Text style={st.body}>{r.reason} · about {r.target || 'a room'} · by {r.reporter}</Text>
            {!!r.details && <Text style={st.meta}>{r.details}</Text>}
            {r.status === 'open' && (
              <View style={[st.row, { gap: 6, marginTop: 6 }]}>
                <Btn small kind="ghost" label="Resolve" onPress={() => call(() => api('POST', `/mod/reports/${r.id}/resolve`, { resolution: 'reviewed' }), 'Resolved')} />
                {isMod && r.target_user_id && <Btn small kind="danger" label="Ban user" onPress={() => call(() => api('POST', `/mod/users/${r.target_user_id}/ban`, { reason: r.reason, ban: true }), 'User banned')} />}
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={st.box}>
        <Text style={st.h3}>👥 Roster ({ov.roster.length})</Text>
        <View style={[st.row, { gap: 6, flexWrap: 'wrap', marginVertical: 8 }]}>
          {['all', 'stage', 'bench', 'private', 'break', 'off'].map((k) => <Chip key={k} label={k} on={filter === k} onPress={() => setFilter(k)} />)}
        </View>
        {roster.map((p) => {
          const s = statusInfo(p, 'en', now);
          return (
            <View key={p.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
              <View style={st.row}>
                <Text style={{ color: C.text, fontWeight: '800', flex: 1 }}>{p.name} <Text style={{ color: s.color, fontSize: 12 }}>● {s.label}{p.cameraLive ? ' · 📷' : ''}</Text></Text>
                {isFloor && <>
                  <Pressable onPress={() => call(() => api('POST', `/floor/dancers/${p.id}/split`, { split: Math.max(0, p.split - 5) }))} style={[stepBtn, { width: 26, height: 24 }]}><Text style={{ color: '#fff' }}>−</Text></Pressable>
                  <Text style={{ color: C.goldLight, width: 40, textAlign: 'center', fontWeight: '800' }}>{p.split}%</Text>
                  <Pressable onPress={() => call(() => api('POST', `/floor/dancers/${p.id}/split`, { split: Math.min(100, p.split + 5) }))} style={[stepBtn, { width: 26, height: 24 }]}><Text style={{ color: '#fff' }}>+</Text></Pressable>
                </>}
              </View>
              {p.kycStatus !== 'approved' && <Text style={[st.meta, { color: C.amber }]}>KYC {p.kycStatus}</Text>}
              {isFloor && p.status !== 'private' && (
                <View style={[st.row, { gap: 6, marginTop: 6 }]}>
                  {['stage', 'bench', 'break', 'off'].filter((k) => k !== p.status).map((k) => (
                    <Btn key={k} small kind="dark" label={{ stage: 'To stage', bench: 'Bench', break: 'Break', off: 'Off' }[k]} onPress={() => call(() => api('POST', `/floor/dancers/${p.id}/status`, { status: k }))} />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {role === 'admin' && <AdminPanel act={act} roster={ov.roster} reload={reload} />}
    </ScrollView>
  );
}
