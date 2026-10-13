import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated, Easing, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import Dancer from './Dancer';
import { Banner, Btn, Chip, DancerCard, Floater, Sheet, Stat, st, statusInfo } from './ui';
import { C, COIN_PACKS, EXCLUSIVE_UNLOCK, GIFTS, LANGS, SONGS, SPECS, fmt, fmtK, mmss } from './data';
import { LANG_OPTIONS, t } from './i18n';
import { exclusivesUnlocked, isVip, topFanOf } from './store';

// ======================= Stage 2: Enter =======================
export function Gate({ S, act, pad }) {
  const [lang, setLang] = useState('en');
  const preview = S.roster.filter((p) => p.status === 'stage').slice(0, 5);
  return (
    <ScrollView style={[st.root]} contentContainerStyle={[pad, { padding: 24, paddingTop: pad.paddingTop + 24 }]}>
      <Text style={{ fontSize: 46, textAlign: 'center' }}>🪔</Text>
      <Text style={[st.h2, { textAlign: 'center', color: C.rose, fontSize: 34 }]}>Mehfil Live</Text>
      <Text style={{ color: C.gold, textAlign: 'center', letterSpacing: 5, fontWeight: '800' }}>LIVE DANCE STAGE</Text>
      {/* BR-02: real preview of the stage before any wall */}
      <View style={[st.box, { marginTop: 18, paddingVertical: 10 }]}>
        <View style={[st.row, { marginBottom: 6 }]}>
          <View style={st.liveDot} />
          <Text style={st.meta}>{S.roster.filter((p) => p.status === 'stage').length} dancers live right now</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', height: 82, overflow: 'hidden' }}>
          {preview.map((p) => <Dancer key={p.id} p={p} size={70} />)}
        </View>
      </View>
      <Text style={[st.h3, { marginTop: 18 }]}>{t(lang, 'chooseLang')}</Text>
      <View style={[st.row, { flexWrap: 'wrap', gap: 8, marginTop: 8 }]}>
        {LANG_OPTIONS.map((l) => <Chip key={l.id} label={l.label} on={lang === l.id} onPress={() => setLang(l.id)} />)}
      </View>
      {LANG_OPTIONS.find((l) => l.id === lang)?.fallback && <Text style={[st.meta, { marginTop: 6 }]}>Full translation coming soon — English for now.</Text>}
      <View style={[st.box, { marginTop: 18 }]}>
        <Text style={st.h3}>18+ only</Text>
        <Text style={[st.body, { marginTop: 4 }]}>By entering you confirm you are 18 or older. Performances are dance and music only. No sign-up needed to watch.</Text>
      </View>
      <Btn label={`I'm 18+ · ${t(lang, 'enter')}`} onPress={() => act.passGate(lang)} style={{ marginTop: 16 }} />
      <Text style={[st.meta, { textAlign: 'center', marginTop: 12 }]}>Prototype · simulated dancers · demo coins</Text>
    </ScrollView>
  );
}

// ======================= Stage 3: Browse =======================
export function StageTab({ S, act, rankOf }) {
  const { width } = useWindowDimensions();
  const L = S.lang;
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('All');
  const [spec, setSpec] = useState('All');
  const [sort, setSort] = useState('popular');
  const [availOnly, setAvailOnly] = useState(false);
  const cardW = (width - 16 * 2 - 8 * 2) / 3;
  const now = S.now || Date.now();
  const match = (p) => (lang === 'All' || p.langs.includes(lang)) && (spec === 'All' || p.specs.includes(spec)) && (!q || p.name.toLowerCase().includes(q.toLowerCase()));
  let live = S.roster.filter((p) => p.status === 'stage' && match(p));
  live = sort === 'new' ? live.sort((a, b) => b.isNew - a.isNew || b.coins - a.coins) : live.sort((a, b) => b.coins - a.coins);
  const priv = availOnly ? [] : S.roster.filter((p) => p.status === 'private' && match(p));
  const mine = S.roster.filter((p) => S.user.follows.includes(p.id) || (S.user.spent[p.id] || 0) > 0)
    .sort((a, b) => (S.user.spent[b.id] || 0) - (S.user.spent[a.id] || 0));
  const grid = (list) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {list.map((p) => (
        <DancerCard
          key={p.id} p={p} w={cardW} rank={rankOf[p.id]} lang={L} now={now} spotlight={S.spotlight?.did === p.id}
          onPress={() => act.watch(p.id)} onBook={() => act.watch(p.id)}
        />
      ))}
    </View>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      {mine.length > 0 && (
        <>
          <Text style={[st.h3, { marginBottom: 8 }]}>{t(L, 'yourTop')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
            {mine.map((p) => {
              const s = statusInfo(p, L, now);
              return (
                <Pressable key={p.id} onPress={() => act.watch(p.id)} style={[st.box, { padding: 8, width: 96, alignItems: 'center' }]}>
                  <View style={{ height: 70, justifyContent: 'flex-end' }}><Dancer p={p} size={64} mode={p.status === 'stage' ? 'normal' : 'backstage'} /></View>
                  <Text style={[st.cardName, { fontSize: 12 }]} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: s.color, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{p.status === 'stage' ? t(L, 'live') : s.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
      <TextInput value={q} onChangeText={setQ} placeholder={`🔍 ${t(L, 'search')}`} placeholderTextColor={C.dim} style={st.input} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }}>
        <Chip label={`⭐ ${t(L, 'popular')}`} on={sort === 'popular'} onPress={() => setSort('popular')} color={C.gold} />
        <Chip label={`✨ ${t(L, 'newest')}`} on={sort === 'new'} onPress={() => setSort('new')} color={C.gold} />
        <Chip label={`🟢 ${t(L, 'availableOnly')}`} on={availOnly} onPress={() => setAvailOnly(!availOnly)} color={C.green} />
        {['All', ...LANGS].map((l) => <Chip key={l} label={l === 'All' ? `🗣 ${t(L, 'all')}` : l} on={lang === l} onPress={() => setLang(l)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 10 }}>
        {['All', ...SPECS].map((s) => <Chip key={s} label={s === 'All' ? `💃 ${t(L, 'all')}` : s} on={spec === s} onPress={() => setSpec(s)} color={C.blue} />)}
      </ScrollView>
      <View style={[st.row, { marginBottom: 8 }]}>
        <View style={st.liveDot} />
        <Text style={st.meta}>{live.length} {t(L, 'liveCount')} · {S.rooms.length}/{S.config.maxRooms} private rooms busy</Text>
      </View>
      {live.length ? grid(live) : <Text style={st.meta}>No dancers match these filters.</Text>}
      {priv.length > 0 && (
        <>
          <Text style={[st.h3, { marginTop: 18, marginBottom: 8 }]}>{t(L, 'inRooms')}</Text>
          {grid(priv)}
        </>
      )}
    </ScrollView>
  );
}

// ======================= Profile + watching (Stages 3–5) =======================
export function ProfileModal({ S, act, pad, rankOf, toast }) {
  const p = S.watching != null ? S.roster.find((x) => x.id === S.watching) : null;
  const { width, height } = useWindowDimensions();
  const [tab, setTab] = useState('chat');
  const [msg, setMsg] = useState('');
  const [bookOpen, setBookOpen] = useState(false);
  const [confirmGift, setConfirmGift] = useState(null);
  useEffect(() => { setTab('chat'); setBookOpen(false); }, [S.watching]);
  if (!p) return null;
  const L = S.lang;
  const now = S.now || Date.now();
  const s = statusInfo(p, L, now);
  const live = p.status === 'stage';
  const following = S.user.follows.includes(p.id);
  const chat = S.chats[p.id] || [];
  const stageH = Math.min(300, height * 0.34);
  const top = topFanOf(p);
  const fans = Object.entries(p.fans).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const myHist = S.user.history.filter((h) => h.did === p.id);
  const vip = isVip(S.user, now);
  const similar = S.roster.filter((x) => x.id !== p.id && x.status === 'stage' && (x.specs.some((k) => p.specs.includes(k)) || x.langs.some((k) => p.langs.includes(k)))).slice(0, 3);
  const share = () => Share.share({ message: `Watch ${p.name} dance live on Mehfil Live: mehfillive://dancer/${p.id}` });
  const gift = (g) => (g.cost >= 1000 ? setConfirmGift(g) : act.sendGift(p.id, g));
  const badge = (name) => (name === top ? ' ⭐' : '');

  return (
    <Modal visible animationType="slide" onRequestClose={act.unwatch}>
      <KeyboardAvoidingView behavior="padding" style={[st.root, pad]}>
        <View style={st.topBar}>
          <Pressable onPress={act.unwatch} hitSlop={10}><Text style={{ color: C.text, fontSize: 28 }}>‹</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={st.brand}>{p.name} <Text style={{ color: C.gold, fontSize: 13 }}>#{rankOf[p.id]}</Text></Text>
            <Text style={{ color: s.color, fontSize: 12, fontWeight: '700' }}>● {s.label} · {fmt(p.followers)} followers</Text>
          </View>
          <Pressable onPress={share} style={st.pill}><Text style={st.pillTxt}>⤴ {t(L, 'share')}</Text></Pressable>
          <Btn small kind={following ? 'dark' : 'primary'} label={following ? `✓ ${t(L, 'followingBtn')}` : `+ ${t(L, 'follow')}`} onPress={() => act.follow(p.id)} />
        </View>

        {/* stage view */}
        <View style={{ height: stageH, backgroundColor: C.bg2, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: -20, left: width / 2 - stageH * 0.55, width: stageH * 1.1, height: stageH * 1.3, backgroundColor: S.spotlight?.did === p.id ? 'rgba(212,175,55,0.16)' : 'rgba(255,107,157,0.08)', borderBottomLeftRadius: 400, borderBottomRightRadius: 400 }} />
          <View style={[st.center, { flex: 1, opacity: live ? 1 : 0.35 }]}>
            <Dancer p={p} size={stageH * 0.86} mode={S.spotlight?.did === p.id ? 'performing' : live ? 'normal' : 'backstage'} />
          </View>
          {!live && (
            <View style={[st.center, { position: 'absolute', left: 0, right: 0, top: stageH / 2 - 20 }]}>
              <Text style={[st.h3, { color: s.color }]}>{s.label}</Text>
            </View>
          )}
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
            {S.floaters.filter((f) => f.did === p.id).map((f) => <Floater key={f.id} item={f} w={width} h={stageH} onDone={act.removeFloater} />)}
          </View>
          {S.banners[0] && <Banner key={S.banners[0].id} b={S.banners[0]} onDone={act.shiftBanner} />}
          <View style={{ position: 'absolute', left: 10, bottom: 8 }}>
            <Text style={st.meta}>{p.specs.join(' · ')} · 🪙 {fmt(p.coins)} · ★ {p.rating.toFixed(1)}</Text>
          </View>
        </View>

        {/* BR-41: book visible on every profile */}
        <View style={[st.row, { gap: 8, padding: 10 }]}>
          {live || p.status === 'bench' ? (
            <Btn label={`🔒 ${t(L, 'book')} · from ${S.config.price5} 🪙`} onPress={() => setBookOpen(true)} style={{ flex: 1 }} />
          ) : (
            <Btn kind="dark" label={following ? '🔔 We will tell you when she is free' : '🔔 Follow to know when she is free'} onPress={() => !following && act.follow(p.id)} style={{ flex: 1 }} />
          )}
          <Btn kind="gold" label={`📣 ${S.config.shoutout}`} onPress={() => act.shoutOut(p.id)} disabled={!live} />
        </View>

        <View style={[st.row, { gap: 6, paddingHorizontal: 10 }]}>
          {['chat', 'gifts', 'songs', 'about'].map((k) => <Chip key={k} label={t(L, k)} on={tab === k} onPress={() => setTab(k)} />)}
        </View>

        <View style={{ flex: 1, marginTop: 8 }}>
          {tab === 'chat' && (
            <View style={{ flex: 1 }}>
              <FlatList
                inverted data={[...chat].reverse()} keyExtractor={(m) => m.id} contentContainerStyle={{ paddingHorizontal: 12 }}
                renderItem={({ item: m }) => <ChatLine m={m} me={S.user.name} badge={badge} vip={vip} />}
              />
              <View style={[st.row, { gap: 8, padding: 8 }]}>
                <TextInput value={msg} onChangeText={setMsg} placeholder={t(L, 'saySomething')} placeholderTextColor={C.dim} style={[st.input, { flex: 1 }]}
                  onSubmitEditing={() => { if (msg.trim()) { act.sendChat(p.id, msg.trim()); setMsg(''); } }} returnKeyType="send" />
                <Btn small label={t(L, 'send')} onPress={() => { if (msg.trim()) { act.sendChat(p.id, msg.trim()); setMsg(''); } }} />
              </View>
            </View>
          )}
          {tab === 'gifts' && (
            <ScrollView contentContainerStyle={{ padding: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
                {GIFTS.map((g) => {
                  const locked = g.exclusive && !exclusivesUnlocked(S.user);
                  const cost = vip ? Math.ceil(g.cost * 0.8) : g.cost;
                  return (
                    <Pressable key={g.id} onPress={() => gift(g)} style={[st.box, { width: '31.5%', alignItems: 'center', padding: 8 }, locked && { opacity: 0.45 }, g.exclusive && { borderColor: C.gold }]}>
                      <Text style={{ fontSize: 26 }}>{locked ? '🔒' : g.emoji}</Text>
                      <Text style={{ color: C.text, fontSize: 11, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{g.name}</Text>
                      <Text style={st.gold}>🪙{fmt(cost)}</Text>
                      {g.seasonal && <Text style={{ color: C.amber, fontSize: 9, fontWeight: '800' }}>FESTIVE</Text>}
                      {g.exclusive && <Text style={{ color: C.gold, fontSize: 9, fontWeight: '800' }}>EXCLUSIVE</Text>}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[st.meta, { marginTop: 8 }]}>
                {vip ? 'VIP: 20% off applied. ' : ''}Exclusive gifts unlock after {fmt(EXCLUSIVE_UNLOCK)} coins spent or with VIP. Gifts of 1,000+ ask to confirm.
              </Text>
            </ScrollView>
          )}
          {tab === 'songs' && (
            <ScrollView contentContainerStyle={{ padding: 10 }}>
              <Text style={[st.meta, { marginBottom: 8 }]}>{p.name} dedicates your song to you on stage. If she leaves before playing it, you get your coins back.</Text>
              {SONGS.map((sg) => (
                <Pressable key={sg.id} onPress={() => act.requestSong(p.id, sg)} style={st.listRow} disabled={!live}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700' }}>{sg.title}</Text>
                    <Text style={st.meta}>{sg.cat}</Text>
                  </View>
                  <Text style={st.gold}>🪙{sg.price}</Text>
                </Pressable>
              ))}
              {S.songs.filter((x) => x.did === p.id && x.mine).map((x) => <Text key={x.id} style={[st.meta, { color: C.rose }]}>⏳ "{x.song.title}" is coming up…</Text>)}
            </ScrollView>
          )}
          {tab === 'about' && (
            <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
              <Text style={st.body}>{p.bio}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{ width: '31.5%', height: 110, borderRadius: 12, backgroundColor: [C.panel2, '#2a1236', '#12233a'][i], alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
                    <Dancer p={{ ...p, variant: (p.variant + i) % 4 }} size={[96, 120, 80][i]} mode={i === 1 ? 'performing' : 'normal'} />
                  </View>
                ))}
              </View>
              <Text style={st.meta}>{t(L, 'specialties')}: <Text style={{ color: C.text }}>{p.specs.join(', ')}</Text></Text>
              <Text style={st.meta}>{t(L, 'languages')}: <Text style={{ color: C.text }}>{p.langs.join(', ')}</Text></Text>
              <Text style={st.meta}>From {p.city} · ★ {p.rating.toFixed(1)} · {fmt(p.followers)} followers</Text>
              <View style={st.box}>
                <Text style={st.h3}>⭐ {t(L, 'topFans')}</Text>
                {fans.map(([n, v], i) => (
                  <View key={n} style={[st.row, { paddingVertical: 4 }]}>
                    <Text style={{ color: C.gold, width: 26, fontWeight: '900' }}>{i + 1}</Text>
                    <Text style={{ color: n === S.user.name ? C.green : C.text, flex: 1, fontWeight: '700' }}>{n}{n === S.user.name ? ' (you)' : ''}</Text>
                    <Text style={st.gold}>🪙{fmt(v)}</Text>
                  </View>
                ))}
              </View>
              {myHist.length > 0 && (
                <View style={st.box}>
                  <Text style={st.h3}>Your private rooms with {p.name}</Text>
                  <Text style={st.meta}>Only you can see this</Text>
                  {myHist.map((h) => <Text key={h.id} style={[st.body, { marginTop: 4 }]}>{new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {h.min} min{h.rating ? ` · ${'★'.repeat(h.rating)}` : ''}</Text>)}
                </View>
              )}
            </ScrollView>
          )}
        </View>

        {/* BR-27: she left for a private room — similar dancers */}
        {S.leftPrompt === p.id && (
          <View style={{ position: 'absolute', left: 12, right: 12, top: pad.paddingTop + 70, ...st.box, borderColor: C.amber, zIndex: 60 }}>
            <Text style={st.h3}>{p.name} is in a private room</Text>
            <Text style={[st.meta, { marginBottom: 8 }]}>{t(L, 'similar')}</Text>
            <View style={[st.row, { gap: 8 }]}>
              {similar.map((x) => (
                <Pressable key={x.id} onPress={() => act.watch(x.id)} style={{ flex: 1, alignItems: 'center', backgroundColor: C.panel, borderRadius: 10, padding: 6 }}>
                  <View style={{ height: 64, justifyContent: 'flex-end' }}><Dancer p={x} size={60} /></View>
                  <Text style={{ color: C.text, fontWeight: '800', fontSize: 12 }}>{x.name}</Text>
                  <Text style={{ color: C.dim, fontSize: 10 }} numberOfLines={1}>{x.specs[0]}</Text>
                </Pressable>
              ))}
            </View>
            <Btn small kind="ghost" label={`Stay · ${following ? 'we will notify you' : 'follow her'}`} onPress={() => { if (!following) act.follow(p.id); act.dismissLeft(); }} style={{ marginTop: 8 }} />
          </View>
        )}

        {bookOpen && <BookSheet visible p={p} S={S} onClose={() => setBookOpen(false)} onBook={(min, credit) => { setBookOpen(false); act.book(p.id, min, credit); }} />}
        {!!confirmGift && <Sheet visible title={`Send ${confirmGift?.emoji} ${confirmGift?.name}?`} onClose={() => setConfirmGift(null)}>
          <Text style={st.body}>This costs {fmt(confirmGift ? (vip ? Math.ceil(confirmGift.cost * 0.8) : confirmGift.cost) : 0)} coins and goes to {p.name}.</Text>
          <View style={[st.row, { gap: 10, marginTop: 14 }]}>
            <Btn kind="ghost" label={t(L, 'cancel')} onPress={() => setConfirmGift(null)} style={{ flex: 1 }} />
            <Btn label={t(L, 'confirm')} onPress={() => { const g = confirmGift; setConfirmGift(null); act.sendGift(p.id, g); }} style={{ flex: 1 }} />
          </View>
        </Sheet>}
        <BookingStatus S={S} act={act} />
        {toast}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ChatLine = React.memo(function ChatLine({ m, me, badge, vip }) {
  if (m.kind === 'system') return <Text style={{ color: C.gold, fontSize: 13, paddingVertical: 2 }}>{m.text}</Text>;
  const color = { fan: C.blue, gift: C.goldLight, mygift: C.rose, dancer: C.rose, me: C.green }[m.kind] || C.text;
  const mine = m.user === me;
  return (
    <Text style={{ fontSize: 13, lineHeight: 19, paddingVertical: 2 }}>
      <Text style={{ color, fontWeight: '800' }}>{m.kind === 'dancer' ? '💃 ' : ''}{mine && vip ? '💎 ' : ''}{m.user}{m.kind !== 'dancer' ? badge(m.user) : ''}</Text>
      <Text style={{ color: C.text }}>  {m.text}</Text>
    </Text>
  );
});

// BR-42/43: pricing upfront + confirmation before coins move
export function BookSheet({ visible, p, S, onClose, onBook }) {
  const [min, setMin] = useState(5);
  const [credit, setCredit] = useState(false);
  const price = credit ? 0 : min === 5 ? S.config.price5 : S.config.price15;
  return (
    <Sheet visible={visible} onClose={onClose} title={`Private room with ${p.name}`}>
      <View style={[st.row, { gap: 10 }]}>
        {[5, 15].map((m) => (
          <Pressable key={m} onPress={() => { setMin(m); if (m === 15) setCredit(false); }} style={[st.box, { flex: 1, alignItems: 'center' }, min === m && { borderColor: C.rose, borderWidth: 2 }]}>
            <Text style={st.h2}>{m} min</Text>
            <Text style={st.gold}>🪙 {fmt(m === 5 ? S.config.price5 : S.config.price15)}</Text>
          </Pressable>
        ))}
      </View>
      {S.user.credits > 0 && min === 5 && (
        <Pressable onPress={() => setCredit(!credit)} style={[st.listRow, { marginTop: 10 }, credit && { borderColor: C.green }]}>
          <Text style={{ color: C.text, flex: 1 }}>🎟 Use a room credit ({S.user.credits} left)</Text>
          <Text style={{ color: credit ? C.green : C.dim, fontWeight: '900' }}>{credit ? '✓' : '○'}</Text>
        </Pressable>
      )}
      <View style={[st.box, { marginTop: 10 }]}>
        <Text style={st.body}>Dancer: <Text style={{ fontWeight: '800' }}>{p.name}</Text></Text>
        <Text style={st.body}>Duration: <Text style={{ fontWeight: '800' }}>{min} minutes</Text> · extend +5 min for {S.config.ext} coins</Text>
        <Text style={st.body}>Price: <Text style={{ fontWeight: '800', color: C.goldLight }}>{credit ? '1 room credit' : `${fmt(price)} coins`}</Text></Text>
        <Text style={[st.meta, { marginTop: 6 }]}>Coins are taken only when {p.name} accepts. If she ends early you get a pro-rata refund. Rooms are moderated.</Text>
      </View>
      <Btn label={`Send request · ${credit ? '1 credit' : `${fmt(price)} 🪙`}`} onPress={() => onBook(min, credit)} style={{ marginTop: 12 }} />
    </Sheet>
  );
}

export function BookingStatus({ S, act }) {
  const r = S.request;
  if (!r && !S.waitlist.length) return null;
  if (!r) {
    return (
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 20, ...st.box, borderColor: C.blue, zIndex: 70 }}>
        <Text style={st.body}>⏳ Waitlist: {S.waitlist.length} request · you will be connected when a room frees up</Text>
        <Btn small kind="ghost" label="Leave waitlist" onPress={act.leaveWaitlist} style={{ marginTop: 8 }} />
      </View>
    );
  }
  const p = S.roster.find((x) => x.id === r.did);
  const reasons = { busy: `${p.name} just became unavailable.`, full: 'All private rooms just filled up.', minimum: 'The stage is at its minimum right now.', declined: `${p.name} can't take a room right now.` };
  const similar = S.roster.filter((x) => x.id !== p.id && x.status === 'stage' && x.specs.some((k) => p.specs.includes(k))).slice(0, 3);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={act.cancelRequest}>
      <View style={[st.sheetBg, { justifyContent: 'center', padding: 24 }]}>
        <View style={[st.box, { backgroundColor: C.panel }]}>
          {r.state === 'waiting' ? (
            <>
              <View style={{ alignItems: 'center', height: 120, justifyContent: 'flex-end' }}><Dancer p={p} size={110} mode="performing" /></View>
              <Text style={[st.h3, { textAlign: 'center', marginTop: 8 }]}>Asking {p.name}…</Text>
              <Text style={[st.meta, { textAlign: 'center' }]}>{r.min} min · {r.credit ? '1 credit' : `${fmt(r.cost)} coins`} · no coins taken yet</Text>
              <Btn kind="ghost" label="Cancel request" onPress={act.cancelRequest} style={{ marginTop: 14 }} />
            </>
          ) : (
            <>
              <Text style={st.h3}>Not this time</Text>
              <Text style={[st.body, { marginTop: 4 }]}>{reasons[r.reason]} No coins were taken.</Text>
              <Text style={[st.meta, { marginTop: 10, marginBottom: 6 }]}>Similar dancers on stage</Text>
              <View style={[st.row, { gap: 8 }]}>
                {similar.map((x) => (
                  <Pressable key={x.id} onPress={() => { act.cancelRequest(); act.watch(x.id); }} style={{ flex: 1, alignItems: 'center', backgroundColor: C.panel2, borderRadius: 10, padding: 6 }}>
                    <View style={{ height: 60, justifyContent: 'flex-end' }}><Dancer p={x} size={56} /></View>
                    <Text style={{ color: C.text, fontWeight: '800', fontSize: 12 }}>{x.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Btn label={t(S.lang, 'close')} onPress={act.cancelRequest} style={{ marginTop: 12 }} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ======================= Stage 5: private room =======================
export function PrivateRoom({ S, act, pad, toast }) {
  const { height } = useWindowDimensions();
  const [text, setText] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const room = S.rooms.find((r) => r.id === S.myRoomId);
  if (!room) return null;
  const p = S.roster.find((x) => x.id === room.did);
  const left = room.endsAt - (S.now || Date.now());
  const send = () => { if (text.trim()) { act.roomSay(text.trim()); setText(''); } };
  return (
    <Modal visible animationType="slide" onRequestClose={() => {}}>
      <KeyboardAvoidingView behavior="padding" style={[st.root, pad]}>
        <View style={st.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={st.brand}>🔒 Private room · <Text style={{ color: C.rose }}>{p.name}</Text></Text>
            <Text style={st.meta}>Moderated · {room.min} min booked</Text>
          </View>
          <View style={[st.pill, left < 60000 && { borderColor: C.red }]}><Text style={[st.pillTxt, left < 60000 && { color: C.red }]}>⏱ {mmss(left)}</Text></View>
        </View>
        <View style={[st.center, { height: height * 0.4, backgroundColor: C.bg2 }]}>
          <Dancer p={p} size={height * 0.34} mode="performing" />
          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(61,220,151,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: C.green, fontWeight: '800', fontSize: 11 }}>🛡 Moderator present</Text>
          </View>
          <Text style={[st.meta, { position: 'absolute', bottom: 8, left: 10 }]}>{p.name} sees the same timer</Text>
        </View>
        <FlatList
          style={{ flex: 1 }} data={S.roomChat} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 10 }}
          renderItem={({ item: m }) => (
            <View style={{ maxWidth: '80%', padding: 10, borderRadius: 14, marginBottom: 6, alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', backgroundColor: m.from === 'me' ? C.roseDim : C.panel2 }}>
              <Text style={{ color: C.text }}>{m.text}</Text>
            </View>
          )}
        />
        <View style={[st.row, { gap: 8, paddingHorizontal: 10 }]}>
          <Btn kind="gold" label={`+5 min · ${S.config.ext} 🪙`} onPress={act.extendRoom} style={{ flex: 1 }} />
          <Btn kind="dark" label="⚑ Report" onPress={() => setReportOpen(true)} />
          <Btn kind="danger" label="Leave" onPress={act.leaveRoom} />
        </View>
        <View style={[st.row, { gap: 8, padding: 10 }]}>
          <TextInput value={text} onChangeText={setText} placeholder={`Message ${p.name}…`} placeholderTextColor={C.dim} style={[st.input, { flex: 1 }]} onSubmitEditing={send} returnKeyType="send" />
          <Btn small label="Send" onPress={send} />
        </View>
        {reportOpen && <Sheet visible onClose={() => setReportOpen(false)} title="Report this room">
          {['Inappropriate behaviour', 'Harassment', 'Underage concern', 'Technical problem'].map((r) => (
            <Pressable key={r} onPress={() => { setReportOpen(false); act.reportRoom(r); }} style={st.listRow}><Text style={st.body}>{r}</Text></Pressable>
          ))}
        </Sheet>}
        {(S.now || Date.now()) - room.startAt < 2600 && <WalkIn p={p} />}
        {toast}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// She walks from the stage into the private room
function WalkIn({ p }) {
  const { width, height } = useWindowDimensions();
  const a = React.useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(10,6,18,0.92)', alignItems: 'center', justifyContent: 'center', opacity: a.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }), zIndex: 90 }}>
      <Animated.View style={{ transform: [{ translateX: a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [-width * 0.6, 0, 0] }) }] }}>
        <Dancer p={p} size={height * 0.3} mode="performing" />
      </Animated.View>
      <Text style={[st.h3, { marginTop: 12 }]}>💃 {p.name} is walking to your private room…</Text>
      <Text style={st.meta}>She has left the stage — the show goes on for everyone else</Text>
    </Animated.View>
  );
}

// BR-51 rating, BR-52 "she'll remember you"
export function RateSheet({ S, act }) {
  const r = S.rateSheet;
  if (!r) return null;
  const p = S.roster.find((x) => x.id === r.did);
  return (
    <Sheet visible onClose={act.closeRate} title={`How was your time with ${p.name}?`}>
      <View style={[st.row, { justifyContent: 'center', gap: 10, marginVertical: 8 }]}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => act.rate(n)} hitSlop={6}><Text style={{ fontSize: 34, color: (r.rated || 0) >= n ? C.gold : C.line }}>★</Text></Pressable>
        ))}
      </View>
      {r.rated && <Text style={[st.body, { textAlign: 'center', color: C.green }]}>Thanks! {p.name} rated you ★★★★★</Text>}
      {r.followPrompt && !S.user.follows.includes(p.id) && (
        <View style={[st.box, { marginTop: 12, borderColor: C.rose }]}>
          <Text style={st.h3}>💕 She'll remember you</Text>
          <Text style={[st.body, { marginTop: 4 }]}>Follow {p.name} to know the moment she is live or free again.</Text>
          <Btn label={`Follow ${p.name}`} onPress={() => act.follow(p.id)} style={{ marginTop: 10 }} />
        </View>
      )}
      <Btn kind="ghost" label="Done" onPress={act.closeRate} style={{ marginTop: 12 }} />
    </Sheet>
  );
}

// BR-11..14: phone OTP, display name, under 60 s
export function RegisterSheet({ S, act }) {
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  useEffect(() => { if (S.showRegister) { setStep(0); setOtp(''); } }, [S.showRegister]);
  return (
    <Sheet visible={S.showRegister} onClose={act.cancelRegister} title="Quick sign-up · under a minute">
      <Text style={[st.meta, { marginBottom: 10 }]}>Needed only to spend coins. Your real name is never shown or required.</Text>
      {step === 0 && (
        <>
          <Text style={st.body}>Mobile number</Text>
          <View style={[st.row, { gap: 8, marginTop: 6 }]}>
            <Text style={[st.input, { paddingVertical: 10 }]}>+91</Text>
            <TextInput value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="98765 43210" placeholderTextColor={C.dim} style={[st.input, { flex: 1 }]} />
          </View>
          <Btn label="Send OTP" disabled={phone.length !== 10} onPress={() => setStep(1)} style={{ marginTop: 12 }} />
        </>
      )}
      {step === 1 && (
        <>
          <Text style={st.body}>Enter the 4-digit code sent to +91 {phone}</Text>
          <TextInput value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="• • • •" placeholderTextColor={C.dim} style={[st.input, { marginTop: 6, fontSize: 20, letterSpacing: 8, textAlign: 'center' }]} />
          <Text style={[st.meta, { marginTop: 4 }]}>Demo code: 1234</Text>
          <Btn label="Verify" disabled={otp !== '1234'} onPress={() => setStep(2)} style={{ marginTop: 12 }} />
        </>
      )}
      {step === 2 && (
        <>
          <Text style={st.body}>Pick a display name</Text>
          <TextInput value={name} onChangeText={(v) => setName(v.replace(/[^\w ]/g, '').slice(0, 16))} placeholder="e.g. Raja_007" placeholderTextColor={C.dim} style={[st.input, { marginTop: 6 }]} />
          <View style={[st.row, { gap: 10, marginTop: 10 }]}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.roseDim, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{(name[0] || '?').toUpperCase()}</Text>
            </View>
            <Text style={st.meta}>Default avatar — photo is optional</Text>
          </View>
          <Btn label="Done" disabled={name.trim().length < 3} onPress={() => act.register(name.trim(), phone)} style={{ marginTop: 12 }} />
        </>
      )}
    </Sheet>
  );
}

export function WalletSheet({ S, act }) {
  const [confirm, setConfirm] = useState(null);
  const vip = isVip(S.user, S.now || Date.now());
  return (
    <Sheet visible={S.walletOpen} onClose={act.closeWallet} title={`🪙 ${t(S.lang, 'wallet')}`} full>
      <ScrollView>
        <View style={[st.box, { alignItems: 'center' }]}>
          <Text style={st.meta}>Balance</Text>
          <Text style={{ color: C.goldLight, fontSize: 30, fontWeight: '900' }}>🪙 {fmt(S.user.coins)}</Text>
          {S.user.credits > 0 && <Text style={{ color: C.green, fontWeight: '700' }}>🎟 {S.user.credits} private room credits</Text>}
          {!S.user.bonusUsed && <Text style={{ color: C.green, fontWeight: '700', marginTop: 4 }}>🎁 +{S.config.firstBonus} bonus coins on your first purchase</Text>}
        </View>
        <Text style={[st.h3, { marginVertical: 10 }]}>{t(S.lang, 'recharge')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
          {COIN_PACKS.map((pk) => (
            <Pressable key={pk.coins} onPress={() => setConfirm(pk)} style={[st.box, { width: '48.5%', alignItems: 'center' }]}>
              {pk.bonus && <Text style={{ position: 'absolute', top: 6, right: 6, backgroundColor: C.green, color: C.bg, fontSize: 10, fontWeight: '900', paddingHorizontal: 5, borderRadius: 5, overflow: 'hidden' }}>{pk.bonus}</Text>}
              <Text style={st.h3}>🪙 {fmt(pk.coins)}</Text>
              <Text style={st.gold}>₹{fmt(pk.price)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[st.box, { marginTop: 12, borderColor: C.rose }]}>
          <Text style={st.h3}>🎟 Private room package</Text>
          <Text style={st.body}>Buy 5 × 5-minute rooms, get 1 free — {S.config.packageRooms} credits for {fmt(S.config.packageCoins)} coins.</Text>
          <Btn label={`Buy package · ${fmt(S.config.packageCoins)} 🪙`} onPress={act.buyPackage} style={{ marginTop: 8 }} />
        </View>
        <View style={[st.box, { marginTop: 12, borderColor: C.gold }]}>
          <Text style={[st.h3, { color: C.gold }]}>💎 VIP · ₹{S.config.vipRupees}/month</Text>
          <Text style={st.body}>Priority private-room booking · 20% off gifts · exclusive gifts · VIP badge</Text>
          {vip ? (
            <>
              <Text style={{ color: C.green, marginTop: 6 }}>Active · {Math.ceil((S.user.vipUntil - Date.now()) / 864e5)} days left</Text>
              <Btn small kind="ghost" label="Cancel VIP" onPress={act.cancelVip} style={{ marginTop: 6 }} />
            </>
          ) : <Btn kind="gold" label="Become VIP" onPress={() => setConfirm('vip')} style={{ marginTop: 8 }} />}
        </View>
        <Text style={[st.meta, { marginTop: 8 }]}>Demo purchases — no real payment is taken in this prototype. Prices include GST.</Text>
        <Text style={[st.h3, { marginTop: 14, marginBottom: 6 }]}>Activity</Text>
        {S.user.txns.length === 0 && <Text style={st.meta}>No transactions yet</Text>}
        {S.user.txns.slice(0, 25).map((x) => (
          <View key={x.id} style={[st.row, { paddingVertical: 6 }]}>
            <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{x.label}</Text>
            <Text style={{ color: x.delta >= 0 ? C.green : C.rose, fontWeight: '800' }}>{x.delta > 0 ? '+' : ''}{x.delta ? fmt(x.delta) : '—'}</Text>
          </View>
        ))}
      </ScrollView>
      {!!confirm && <Sheet visible onClose={() => setConfirm(null)} title={confirm === 'vip' ? 'Subscribe to VIP' : `Buy ${fmt(confirm?.coins || 0)} coins`}>
        <Text style={st.body}>{confirm === 'vip' ? `₹${S.config.vipRupees} per month, renews automatically, cancel anytime.` : `₹${fmt(confirm?.price || 0)} — demo purchase, no real payment.`}</Text>
        <Btn label={confirm === 'vip' ? `Pay ₹${S.config.vipRupees}` : `Pay ₹${fmt(confirm?.price || 0)}`} onPress={() => { const c = confirm; setConfirm(null); if (c === 'vip') act.buyVip(); else act.buyPack(c); }} style={{ marginTop: 12 }} />
      </Sheet>}
    </Sheet>
  );
}

// ======================= Stage 6: Return =======================
export function FollowingTab({ S, act }) {
  const L = S.lang;
  const now = S.now || Date.now();
  const mine = S.roster.filter((p) => S.user.follows.includes(p.id));
  const order = { stage: 0, private: 1, bench: 2, break: 3, off: 4 };
  mine.sort((a, b) => order[a.status] - order[b.status]);
  const trending = [...S.roster].filter((p) => p.status === 'stage').sort((a, b) => b.coins - a.coins).slice(0, 3);
  const fresh = S.roster.filter((p) => p.isNew && p.status === 'stage');
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={st.h3}>{t(L, 'following')} ({mine.length})</Text>
      {mine.length === 0 && <Text style={st.meta}>{t(L, 'nobodyFollowed')}</Text>}
      {mine.map((p) => {
        const s = statusInfo(p, L, now);
        return (
          <Pressable key={p.id} onPress={() => act.watch(p.id)} style={st.listRow}>
            <View style={{ width: 48, height: 56, justifyContent: 'flex-end', alignItems: 'center' }}><Dancer p={p} size={54} mode={p.status === 'stage' ? 'normal' : 'backstage'} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 15 }}>{p.name}</Text>
              <Text style={{ color: s.color, fontWeight: '700', fontSize: 12 }}>{p.status === 'stage' ? `● ${p.name} is live now` : `● ${s.label}`}</Text>
              {(S.user.spent[p.id] || 0) > 0 && <Text style={st.meta}>You've supported her with 🪙{fmt(S.user.spent[p.id])}</Text>}
            </View>
            <Text style={{ color: C.dim, fontSize: 20 }}>›</Text>
          </Pressable>
        );
      })}
      <View style={[st.box, { marginTop: 6 }]}>
        <Text style={st.h3}>Tonight at a glance</Text>
        <Text style={[st.meta, { marginTop: 6 }]}>🔥 Trending</Text>
        <Text style={st.body}>{trending.map((p) => p.name).join(', ')}</Text>
        <Text style={[st.meta, { marginTop: 6 }]}>✨ New on stage</Text>
        <Text style={st.body}>{fresh.length ? fresh.map((p) => p.name).join(', ') : 'No new dancers live right now'}</Text>
        <Text style={[st.meta, { marginTop: 6 }]}>🟢 Live now</Text>
        <Text style={st.body}>{S.roster.filter((p) => p.status === 'stage').length} dancers · {S.rooms.length} private rooms busy</Text>
      </View>
    </ScrollView>
  );
}

export function NotifSheet({ S, act, visible, onClose }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={`🔔 ${t(S.lang, 'notifications')}`} full>
      <ScrollView>
        {S.notifs.length === 0 && <Text style={st.meta}>{t(S.lang, 'noNotifs')}. Follow dancers to hear when they go live or become free.</Text>}
        {S.notifs.map((n) => (
          <Pressable key={n.id} onPress={() => { onClose(); act.watch(n.did); }} style={st.listRow}>
            <Text style={{ fontSize: 18 }}>💃</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.body}>{n.text}</Text>
              <Text style={st.meta}>{new Date(n.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

// ======================= Stage 7: Belong =======================
export function LeadersTab({ S, act, ranked }) {
  const [tab, setTab] = useState('dancers');
  const L = S.lang;
  const spenders = Object.entries(S.spenders).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const myRank = Object.entries(S.spenders).sort((a, b) => b[1] - a[1]).findIndex(([n]) => n === S.user.name) + 1;
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <View style={[st.row, { gap: 8, marginBottom: 12 }]}>
        <Chip label={`💃 ${t(L, 'topDancers')}`} on={tab === 'dancers'} onPress={() => setTab('dancers')} />
        <Chip label={`👑 ${t(L, 'topSpenders')}`} on={tab === 'spenders'} onPress={() => setTab('spenders')} color={C.gold} />
      </View>
      {tab === 'dancers' && ranked.slice(0, 20).map((p, i) => (
        <Pressable key={p.id} onPress={() => act.watch(p.id)} style={st.listRow}>
          <Text style={{ color: C.gold, fontWeight: '900', width: 28, textAlign: 'center' }}>{['👑', '🥈', '🥉'][i] || i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '800' }}>{p.name}</Text>
            <Text style={st.meta}>Top fan: {topFanOf(p)}{topFanOf(p) === S.user.name ? ' (you ⭐)' : ''}</Text>
          </View>
          <Text style={st.gold}>🪙{fmtK(p.coins)}</Text>
        </Pressable>
      ))}
      {tab === 'spenders' && (
        <>
          {S.user.registered && <Text style={[st.meta, { marginBottom: 8 }]}>Your rank: {myRank ? `#${myRank}` : 'not ranked yet'} · 🪙{fmt(S.user.total)} spent</Text>}
          {spenders.map(([n, v], i) => (
            <View key={n} style={[st.listRow, n === S.user.name && { borderColor: C.green }]}>
              <Text style={{ color: C.gold, fontWeight: '900', width: 28, textAlign: 'center' }}>{['👑', '🥈', '🥉'][i] || i + 1}</Text>
              <Text style={{ color: C.text, fontWeight: '800', flex: 1 }}>{n}{n === S.user.name ? ' (you)' : ''}</Text>
              <Text style={st.gold}>🪙{fmtK(v)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

export function MeTab({ S, act }) {
  const L = S.lang;
  const [cMsg, setCMsg] = useState('');
  const vip = isVip(S.user, S.now || Date.now());
  const topOf = S.roster.filter((p) => topFanOf(p) === S.user.name);
  const whale = S.user.total >= EXCLUSIVE_UNLOCK || vip;
  const invite = () => Share.share({ message: `Join me on Mehfil Live — live dance stage. mehfillive://invite/${(S.user.name || 'guest').replace(/\W/g, '')}` });
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={[st.box, st.row, { gap: 12 }]}>
        <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: C.roseDim, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22 }}>{(S.user.name[0] || '?').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.h3}>{S.user.registered ? S.user.name : 'Guest viewer'} {vip ? '💎' : ''}</Text>
          <Text style={st.meta}>{S.user.registered ? `🪙${fmt(S.user.total)} spent · ${S.user.history.length} private rooms` : 'Sign-up happens only when you first spend'}</Text>
          {topOf.length > 0 && <Text style={{ color: C.gold, fontWeight: '700', fontSize: 12 }}>⭐ Top fan of {topOf.map((p) => p.name).join(', ')}</Text>}
        </View>
      </View>
      <Btn label={`🎁 ${t(L, 'invite')} on WhatsApp / Telegram`} onPress={invite} />
      <View style={st.box}>
        <Text style={st.h3}>🗣 Language</Text>
        <View style={[st.row, { flexWrap: 'wrap', gap: 8, marginTop: 8 }]}>
          {LANG_OPTIONS.map((l) => <Chip key={l.id} label={l.label} on={S.lang === l.id} onPress={() => act.setLang(l.id)} />)}
        </View>
      </View>
      <View style={st.box}>
        <Text style={st.h3}>🔒 {t(L, 'history')}</Text>
        <Text style={st.meta}>Visible only to you</Text>
        {S.user.history.length === 0 && <Text style={[st.meta, { marginTop: 6 }]}>No private rooms yet</Text>}
        {S.user.history.map((h) => {
          const p = S.roster.find((x) => x.id === h.did);
          return (
            <Pressable key={h.id} onPress={() => act.watch(h.did)} style={[st.row, { paddingVertical: 6 }]}>
              <Text style={[st.body, { flex: 1 }]}>{p.name} · {h.min} min · {new Date(h.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</Text>
              <Text style={{ color: C.gold }}>{h.rating ? '★'.repeat(h.rating) : '—'}</Text>
            </Pressable>
          );
        })}
      </View>
      {whale ? (
        <View style={[st.box, { borderColor: C.gold }]}>
          <Text style={[st.h3, { color: C.gold }]}>🤵 Your concierge</Text>
          <Text style={st.meta}>A dedicated line for our top members</Text>
          {S.concierge.map((m) => <Text key={m.id} style={{ color: m.from === 'me' ? C.green : C.text, marginTop: 4 }}>{m.from === 'me' ? 'You: ' : 'Concierge: '}{m.text}</Text>)}
          <View style={[st.row, { gap: 8, marginTop: 8 }]}>
            <TextInput value={cMsg} onChangeText={setCMsg} placeholder="How can we help?" placeholderTextColor={C.dim} style={[st.input, { flex: 1 }]} />
            <Btn small kind="gold" label="Send" onPress={() => { if (cMsg.trim()) { act.concierge(cMsg.trim()); setCMsg(''); } }} />
          </View>
        </View>
      ) : (
        <Text style={st.meta}>Spend {fmt(EXCLUSIVE_UNLOCK)} coins or join VIP to unlock exclusive gifts and a personal concierge.</Text>
      )}
      <Text style={[st.meta, { textAlign: 'center' }]}>Mehfil Live prototype · build channel: APK · notifications are in-app in this demo</Text>
    </ScrollView>
  );
}
