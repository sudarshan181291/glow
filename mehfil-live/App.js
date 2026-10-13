import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudio, isVip } from './src/store';
import { Banner, Sheet, Toast, LiveDot, st } from './src/ui';
import {
  BookingStatus, FollowingTab, Gate, LeadersTab, MeTab, NotifSheet, PrivateRoom, ProfileModal, RateSheet, RegisterSheet, StageTab, WalletSheet,
} from './src/customer';
import { DancerHome } from './src/dancerApp';
import { FloorConsole } from './src/floor';
import { C, fmt } from './src/data';
import { t } from './src/i18n';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [S, act] = useStudio();
  const [tab, setTab] = useState('stage');
  const [roleOpen, setRoleOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const pad = { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right };
  const L = S.lang;

  const ranked = useMemo(() => [...S.roster].sort((a, b) => b.coins - a.coins), [S.roster]);
  const rankOf = useMemo(() => { const m = {}; ranked.forEach((p, i) => { m[p.id] = i + 1; }); return m; }, [ranked]);

  // BR-05 deep links: mehfillive://dancer/<id>, mehfillive://invite/<code>
  useEffect(() => {
    Linking.getInitialURL().then((u) => u && act.deepLink(u)).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => act.deepLink(url));
    return () => sub.remove();
  }, [act]);
  useEffect(() => { if (S.screen === 'main' && S.pendingLink != null) act.consumeLink(); }, [S.screen, S.pendingLink, act]);
  useEffect(() => {
    if (!S.liveNotif) return undefined;
    const tm = setTimeout(act.clearLiveNotif, 4500);
    return () => clearTimeout(tm);
  }, [S.liveNotif?.id]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (S.watching != null) { act.unwatch(); return true; }
      if (S.role === 'customer' && tab !== 'stage') { setTab('stage'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [S.watching, S.role, tab, act]);

  if (S.screen === 'gate') return <Gate S={S} act={act} pad={pad} />;
  const toastEl = S.toast ? <Toast key={S.toast.id} text={S.toast.text} bottom={insets.bottom + 70} onDone={() => act.clearToast(S.toast.id)} /> : null;

  const roles = [['customer', '👁 Customer'], ['dancer', '💃 Dancer app'], ['floor', '🎬 Floor manager']];
  const roleLabel = roles.find((r) => r[0] === S.role)[1];
  const stageCount = S.roster.filter((p) => p.status === 'stage').length;
  const tabs = [['stage', '🎭', t(L, 'stage')], ['following', '💕', t(L, 'following')], ['leaders', '🏆', t(L, 'leaders')], ['me', '👤', t(L, 'me')]];

  return (
    <View style={[st.root, pad]}>
      <View style={st.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={st.brand}>Mehfil Live {S.role === 'dancer' ? '· Dancer' : S.role === 'floor' ? '· Floor' : ''}</Text>
          <View style={st.row}>
            <LiveDot />
            <Text style={st.meta} numberOfLines={1}>{stageCount} {t(L, 'live')} · {S.rooms.length}/{S.config.maxRooms} 🔒</Text>
            {isVip(S.user, S.now || Date.now()) && <Text numberOfLines={1} style={{ flexShrink: 0, marginLeft: 6, color: C.bg, backgroundColor: C.gold, fontSize: 10, fontWeight: '900', paddingHorizontal: 5, borderRadius: 4, overflow: 'hidden' }}>VIP</Text>}
          </View>
        </View>
        {S.role === 'customer' && (
          <>
            <Pressable onPress={() => { setNotifOpen(true); act.readNotifs(); }} hitSlop={8} style={{ paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 20 }}>🔔</Text>
              {S.unread > 0 && <View style={{ position: 'absolute', right: -2, top: -2, backgroundColor: C.red, borderRadius: 8, minWidth: 16, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{S.unread}</Text></View>}
            </Pressable>
            <Pressable onPress={act.openWallet} style={st.pill}><Text style={st.pillTxt}>🪙 {fmt(S.user.coins)}</Text></Pressable>
          </>
        )}
        <Pressable onPress={() => setRoleOpen(true)} style={[st.pill, { borderColor: C.line, backgroundColor: C.panel2 }]}><Text style={{ color: C.text, fontWeight: '700', fontSize: 12 }}>{roleLabel} ▾</Text></Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {S.role === 'customer' && tab === 'stage' && <StageTab S={S} act={act} rankOf={rankOf} />}
        {S.role === 'customer' && tab === 'following' && <FollowingTab S={S} act={act} />}
        {S.role === 'customer' && tab === 'leaders' && <LeadersTab S={S} act={act} ranked={ranked} />}
        {S.role === 'customer' && tab === 'me' && <MeTab S={S} act={act} />}
        {S.role === 'dancer' && <DancerHome S={S} act={act} />}
        {S.role === 'floor' && <FloorConsole S={S} act={act} />}
        {S.watching == null && S.banners[0] && <Banner key={S.banners[0].id} b={S.banners[0]} onDone={act.shiftBanner} />}
        {S.liveNotif && S.watching == null && (
          <Pressable onPress={() => { act.watch(S.liveNotif.did); act.clearLiveNotif(); }} style={{ position: 'absolute', top: 8, left: 10, right: 10, ...st.box, borderColor: C.green, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 60 }}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
            <Text style={[st.body, { flex: 1 }]}>{S.liveNotif.text}</Text>
            <Text style={{ color: C.green, fontWeight: '800' }}>Watch ›</Text>
          </Pressable>
        )}
      </View>

      {S.role === 'customer' && (
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: C.line, backgroundColor: C.bg2 }}>
          {tabs.map(([k, icon, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontSize: 18, opacity: tab === k ? 1 : 0.6 }}>{icon}</Text>
              <Text style={{ color: tab === k ? C.rose : C.dim, fontSize: 11, fontWeight: '800' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {S.role === 'customer' && <ProfileModal S={S} act={act} pad={pad} rankOf={rankOf} toast={!S.myRoomId && toastEl} />}
      {S.role === 'customer' && S.watching == null && <BookingStatus S={S} act={act} />}
      <PrivateRoom S={S} act={act} pad={pad} toast={toastEl} />
      <RateSheet S={S} act={act} />
      {S.showRegister && <RegisterSheet S={S} act={act} />}
      {S.walletOpen && <WalletSheet S={S} act={act} />}
      {notifOpen && <NotifSheet S={S} act={act} visible onClose={() => setNotifOpen(false)} />}
      {roleOpen && <Sheet visible onClose={() => setRoleOpen(false)} title="Switch view">
        {roles.map(([k, l]) => (
          <Pressable key={k} onPress={() => { act.setRole(k); setRoleOpen(false); }} style={[st.listRow, S.role === k && { borderColor: C.rose }]}>
            <Text style={[st.body, { fontWeight: '800' }]}>{l}</Text>
            <Text style={[st.meta, { flex: 1, textAlign: 'right' }]}>{{ customer: 'Watch, gift, book', dancer: 'You are Priya', floor: 'Run the studio' }[k]}</Text>
          </Pressable>
        ))}
      </Sheet>}
      {S.watching == null && !S.myRoomId && toastEl}
    </View>
  );
}
