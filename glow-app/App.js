// Glow: a live-streaming and social discovery prototype.
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, BackHandler, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
// Import only the five weights the app uses, to keep the APK small.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { C, GRAD, shadow } from './src/theme';
import { AppProvider, useApp } from './src/store';
import { Btn, Grad, Icon, RoundBtn, Tap, Txt } from './src/ui';
import { AppRefBinder, ModalHost, isDarkModal } from './src/modals';
import { ChatsScreen, DiscoverScreen, HomeScreen, LiveScreen, ProfileScreen } from './src/screens';

export default function App() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.g1} /></View>;
  }
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppRefBinder />
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const TABS = [
  { id: 'home', icon: 'house', label: 'Home' },
  { id: 'discover', icon: 'compass', label: 'Discover' },
  { id: 'live', icon: 'tower-broadcast', label: 'Live', center: true },
  { id: 'chats', icon: 'comment-dots', label: 'Chats' },
  { id: 'profile', icon: 'user', label: 'Profile' },
];
const SCREENS = { home: HomeScreen, discover: DiscoverScreen, live: LiveScreen, chats: ChatsScreen, profile: ProfileScreen };

function Root() {
  const { tab, setTab, modals, close, loggedOut } = useApp();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(1)).current;
  const scroll = useRef(null);

  // Android back button closes the top overlay first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modals.some(m => !m.closing)) { close(); return true; }
      if (tab !== 'home') { switchTab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }); // re-subscribe each render so it sees current state

  const switchTab = id => {
    if (id === tab) { scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    setTab(id);
    scroll.current?.scrollTo({ y: 0, animated: false });
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const top = [...modals].reverse().find(m => !m.closing);
  const darkTop = top && isDarkModal(top.type);
  const Screen = SCREENS[tab];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={darkTop || loggedOut ? 'light' : 'dark'} />
      <Header insetTop={insets.top} />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
          <Screen />
        </Animated.View>
      </ScrollView>
      <TabBar onTab={switchTab} insetBottom={insets.bottom} />
      <ModalHost />
      <Toast insetBottom={insets.bottom} />
      {loggedOut && <LoggedOut />}
    </View>
  );
}

function Header({ insetTop }) {
  const { tab, open, notifsUnread } = useApp();
  const titles = { discover: 'Discover', live: 'Live', chats: 'Chats', profile: 'Profile' };
  return (
    <View style={[styles.header, { paddingTop: insetTop + 8 }]}>
      {tab === 'home' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="fire-flame-curved" size={20} color={C.pink} />
          <Txt w={800} size={28} color={C.g1} style={{ letterSpacing: -1 }}>glow</Txt>
        </View>
      ) : (
        <Txt w={800} size={26} color={C.ink2} style={{ letterSpacing: -0.8 }}>{titles[tab]}</Txt>
      )}
      <View style={{ flex: 1 }} />
      <Tap onPress={() => open('search')} style={[styles.hBtn, shadow]} accessibilityLabel="Search"><Icon name="magnifying-glass" size={17} color={C.ink} /></Tap>
      <Tap onPress={() => open('notifs')} style={[styles.hBtn, shadow]} accessibilityLabel="Notifications">
        <Icon name="bell" regular size={17} color={C.ink} />
        {notifsUnread && <View style={styles.ndot} />}
      </Tap>
    </View>
  );
}

function TabBar({ onTab, insetBottom }) {
  const { tab, chats } = useApp();
  const unread = Object.values(chats).reduce((a, c) => a + c.unread, 0);
  return (
    <View style={[styles.tabbar, { paddingBottom: Math.max(insetBottom, 10) + 6 }]}>
      {TABS.map(t => {
        const on = tab === t.id;
        return (
          <Tap key={t.id} onPress={() => onTab(t.id)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            {t.center ? (
              <Grad style={[styles.centerTab, on && { borderWidth: 3, borderColor: '#fbd5e5' }]}><Icon name={t.icon} size={20} color="#fff" /></Grad>
            ) : (
              <View style={{ height: 26, justifyContent: 'center' }}>
                <Icon name={t.icon} size={20} color={on ? C.g1 : '#b3a5c4'} />
                {t.id === 'chats' && unread > 0 && (
                  <View style={styles.tabBadge}><Txt w={800} size={10} color="#fff">{unread}</Txt></View>
                )}
              </View>
            )}
            <Txt w={700} size={10.5} color={on ? C.g1 : '#a797b8'}>{t.label}</Txt>
          </Tap>
        );
      })}
    </View>
  );
}

/* slide-up toast, auto-dismiss after 2s */
function Toast({ insetBottom }) {
  const { toastState } = useApp();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toastState) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const t = setTimeout(() => Animated.timing(v, { toValue: 0, duration: 220, useNativeDriver: true }).start(), 2000);
    return () => clearTimeout(t);
  }, [toastState, v]);
  if (!toastState) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { bottom: insetBottom + 96, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
      <Icon name={toastState.icon} size={14} color="#ff8fb3" />
      <Txt w={600} size={13.5} color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>{toastState.msg}</Txt>
    </Animated.View>
  );
}

function LoggedOut() {
  const { me, setLoggedOut, setTab, toast } = useApp();
  return (
    <LinearGradient colors={['#ca3c7c', '#a24bcf', '#4b2a8a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.loggedOut]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="fire-flame-curved" size={36} color="#fff" />
        <Txt w={800} size={52} color="#fff" style={{ letterSpacing: -2 }}>glow</Txt>
      </View>
      <Txt size={15} color="#f3e3fb" style={{ textAlign: 'center', lineHeight: 22, maxWidth: 260 }}>You’ve logged out. Your matches and chats will be waiting for you.</Txt>
      <View style={{ flexDirection: 'row', width: 240, marginTop: 10 }}>
        <Btn kind="white" label={`Log back in as ${me.name.split(' ')[0]}`} onPress={() => { setLoggedOut(false); setTab('home'); toast(`Welcome back, ${me.name.split(' ')[0]}`, 'hand'); }} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 10, backgroundColor: C.bg },
  hBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  ndot: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: C.pink, borderWidth: 2, borderColor: '#fff' },
  tabbar: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 8, paddingHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderTopColor: C.line },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  centerTab: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: -24, shadowColor: C.g1, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  tabBadge: { position: 'absolute', top: -6, left: 12, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  toast: { position: 'absolute', alignSelf: 'center', maxWidth: '88%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 18, backgroundColor: 'rgba(31,19,38,0.94)', ...shadow },
  loggedOut: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 30 },
});
