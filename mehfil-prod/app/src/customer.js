import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated, Easing, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import Dancer from './Dancer';
import { DanceVideo, Poster } from './media';
import { Banner, Btn, Chip, DancerCard, Floater, Sheet, Stat, st, statusInfo } from './ui';
import { C, COIN_PACKS, LANGS, SPECS, VIP, fmt, fmtK, mmss } from './data';
import { api } from './api';
import { LiveVideo, stage, useLiveRoom, useStageConnection } from './live';
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
      <Text style={[st.meta, { textAlign: 'center', marginTop: 12 }]}>Live performers · secure payments · report anything that feels wrong</Text>
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
  useStageConnection(S.watching != null);
  useEffect(() => { stage.setFocus(S.watching); return () => stage.setFocus(null); }, [S.watching]);
  if (!p) return null;
  const L = S.lang;
  const now = S.now || Date.now();
  const s = statusInfo(p, L, now);
  const live = p.status === 'stage';
  const following = S.user.follows.includes(p.id);
  const chat = S.chats[p.id] || [];
  const stageH = Math.min(300, height * 0.34);
  const top = S.details[p.id]?.topFans?.[0]?.name ?? null;
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
          <Poster p={p} dim style={{ position: 'absolute', left: 0, top: 0, width, height: stageH, opacity: 0.25 }} />
          {live
            ? <DanceVideo p={p} style={{ position: 'absolute', top: 0, left: (width - stageH * 0.5625) / 2, width: stageH * 0.5625, height: stageH }} />
            : <Poster p={p} dim style={{ position: 'absolute', top: 0, left: (width - stageH * 0.5625) / 2, width: stageH * 0.5625, height: stageH }} />}
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
                {(S.gifts || []).map((g) => {
                  const locked = g.exclusive && !exclusivesUnlocked(S.user, S.config);
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
                {vip ? 'VIP: 20% off applied. ' : ''}Exclusive gifts unlock after {fmt(S.config.exclusiveUnlock)} coins spent or with VIP. Gifts of 1,000+ ask to confirm.
              </Text>
            </ScrollView>
          )}
          {tab === 'songs' && (
            <ScrollView contentContainerStyle={{ padding: 10 }}>
              <Text style={[st.meta, { marginBottom: 8 }]}>{p.name} dedicates your song to you on stage. If she leaves before playing it, you get your coins back.</Text>
              {(S.songList || []).map((sg) => (
                <Pressable key={sg.id} onPress={() => act.requestSong(p.id, sg)} style={st.listRow} disabled={!live}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700' }}>{sg.title}</Text>
                    <Text style={st.meta}>{sg.cat}</Text>
                  </View>
                  <Text style={st.gold}>🪙{sg.price}</Text>
                </Pressable>
              ))}
              {S.mySongs.filter((x) => x.did === p.id && x.mine).map((x) => <Text key={x.id} style={[st.meta, { color: C.rose }]}>⏳ "{x.song.title}" is coming up…</Text>)}
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
  if (!r) return null;
  const p = S.roster.find((x) => x.id === r.did);
  if (!p) return null;
  if (r.state === 'waitlisted') {
    return (
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: 20, ...st.box, borderColor: C.blue, zIndex: 70 }}>
        <Text style={st.body}>⏳ On the waitlist for {p.name} · you will be connected when a room frees up</Text>
        <Btn small kind="ghost" label="Leave waitlist" onPress={act.leaveWaitlist} style={{ marginTop: 8 }} />
      </View>
    );
  }
  const reasons = { busy: `${p.name} didn't answer in time.`, declined: `${p.name} can't take a room right now.` };
  const similar = S.roster.filter((x) => x.id !== p.id && x.status === 'stage' && x.specs.some((k) => p.specs.includes(k))).slice(0, 3);
  const left = r.decideBy ? Math.max(0, Math.ceil((r.decideBy - S.now) / 1000)) : null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={act.cancelRequest}>
      <View style={[st.sheetBg, { justifyContent: 'center', padding: 24 }]}>
        <View style={[st.box, { backgroundColor: C.panel }]}>
          {r.state === 'waiting' ? (
            <>
              <View style={{ alignItems: 'center', height: 120, justifyContent: 'flex-end' }}><Dancer p={p} size={110} mode="performing" /></View>
              <Text style={[st.h3, { textAlign: 'center', marginTop: 8 }]}>Asking {p.name}…</Text>
              <Text style={[st.meta, { textAlign: 'center' }]}>{r.min} min · {r.credit ? '1 credit' : `${fmt(r.cost ?? 0)} coins`} · no coins taken yet{left != null ? ` · ${left}s` : ''}</Text>
              <Btn kind="ghost" label="Cancel request" onPress={act.cancelRequest} style={{ marginTop: 14 }} />
            </>
          ) : (
            <>
              <Text style={st.h3}>Not this time</Text>
              <Text style={[st.body, { marginTop: 4 }]}>{reasons[r.reason] ?? reasons.declined} No coins were taken.</Text>
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

// ======================= Stage 5: private room (live video) =======================
export function PrivateRoom({ S, act, pad, toast }) {
  const room = S.myRoom;
  if (!room) return null;
  return <PrivateRoomCall key={room.id} S={S} act={act} pad={pad} toast={toast} room={room} />;
}

function PrivateRoomCall({ S, act, pad, toast, room }) {
  const { height, width } = useWindowDimensions();
  const [reportOpen, setReportOpen] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const call = useLiveRoom({ kind: 'room', bookingId: room.id, camera: false, mic: true });
  const p = S.roster.find((x) => x.id === room.did) || { id: room.did, name: 'Dancer', specs: [], langs: [] };
  const left = room.endsAt - S.now;
  const her = call.remote.find((r) => r.participant.identity === room.did) ?? call.remote[0];
  return (
    <Modal visible animationType="slide" onRequestClose={() => {}}>
      <View style={[st.root, pad]}>
        <View style={st.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={st.brand}>🔒 Private room · <Text style={{ color: C.rose }}>{p.name}</Text></Text>
            <Text style={st.meta}>Moderated · {room.min} min booked</Text>
          </View>
          <View style={[st.pill, left < 60000 && { borderColor: C.red }]}><Text style={[st.pillTxt, left < 60000 && { color: C.red }]}>⏱ {mmss(left)}</Text></View>
        </View>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {her ? <LiveVideo trackRef={her} style={{ flex: 1 }} /> : (
            <View style={[st.center, { flex: 1 }]}>
              <Poster p={p} dim style={{ position: 'absolute', left: 0, top: 0, width, height: '100%' }} />
              <Text style={[st.h3, { marginTop: 10 }]}>{call.error ? call.error : `Connecting to ${p.name}…`}</Text>
            </View>
          )}
          {call.local && camOn && <LiveVideo trackRef={call.local} mirror style={{ position: 'absolute', right: 10, bottom: 10, width: 96, height: 150, borderRadius: 10 }} />}
          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(61,220,151,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: C.green, fontWeight: '800', fontSize: 11 }}>🛡 Moderated</Text>
          </View>
        </View>
        <View style={[st.row, { gap: 8, padding: 10 }]}>
          <Btn small kind={micOn ? 'dark' : 'danger'} label={micOn ? '🎙 Mic on' : '🔇 Mic off'} onPress={() => { call.controls.setMic(!micOn); setMicOn(!micOn); }} />
          <Btn small kind="dark" label={camOn ? '📷 Camera on' : '📷 Camera off'} onPress={() => { call.controls.setCamera(!camOn); setCamOn(!camOn); }} />
          <View style={{ flex: 1 }} />
          <Btn small kind="dark" label="⚑ Report" onPress={() => setReportOpen(true)} />
        </View>
        <View style={[st.row, { gap: 8, paddingHorizontal: 10, paddingBottom: 10 }]}>
          <Btn kind="gold" label={`+5 min · ${S.config.ext} 🪙`} onPress={act.extendRoom} style={{ flex: 1 }} />
          <Btn kind="danger" label="Leave room" onPress={act.leaveRoom} style={{ flex: 1 }} />
        </View>
        {reportOpen && <Sheet visible onClose={() => setReportOpen(false)} title="Report this room">
          {['Inappropriate behaviour', 'Harassment', 'Underage concern', 'Technical problem'].map((r) => (
            <Pressable key={r} onPress={() => { setReportOpen(false); act.reportRoom(r); }} style={st.listRow}><Text style={st.body}>{r}</Text></Pressable>
          ))}
        </Sheet>}
        {room.startAt && S.now - room.startAt < 2600 && <WalkIn p={p} />}
        {toast}
      </View>
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

// BR-11..14: phone OTP, display name, 18+ check, under a minute
export function RegisterSheet({ S, act }) {
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [adult, setAdult] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (S.showRegister) { setStep(0); setOtp(''); setErr(''); } }, [S.showRegister]);
  const go = async (fn) => { setBusy(true); setErr(''); try { await fn(); } catch (e) { setErr(e?.message || 'Something went wrong'); } finally { setBusy(false); } };
  const sendCode = () => go(async () => { const r = await act.requestOtp(phone); setIsNew(!!r.isNewUser); setStep(1); });
  const verify = () => go(async () => {
    if (isNew) { setStep(2); return; }
    await act.register({ phone, code: otp });
  });
  const finish = () => go(() => act.register({ phone, code: otp, displayName: name.trim(), dob, ageConfirmed: adult, lang: S.lang }));
  const dobOk = /^\d{4}-\d{2}-\d{2}$/.test(dob);
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
          <Btn label={busy ? 'Sending…' : 'Send OTP'} disabled={phone.length !== 10 || busy} onPress={sendCode} style={{ marginTop: 12 }} />
        </>
      )}
      {step === 1 && (
        <>
          <Text style={st.body}>Enter the 6-digit code sent to +91 {phone}</Text>
          <TextInput value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="• • • • • •" placeholderTextColor={C.dim} style={[st.input, { marginTop: 6, fontSize: 20, letterSpacing: 6, textAlign: 'center' }]} />
          <Btn label={busy ? 'Checking…' : 'Verify'} disabled={otp.length !== 6 || busy} onPress={verify} style={{ marginTop: 12 }} />
          <Btn small kind="ghost" label="Change number / resend" onPress={() => setStep(0)} style={{ marginTop: 8 }} />
        </>
      )}
      {step === 2 && (
        <>
          <Text style={st.body}>Pick a display name</Text>
          <TextInput value={name} onChangeText={(v) => setName(v.replace(/[^\w ]/g, '').slice(0, 20))} placeholder="e.g. Raja_007" placeholderTextColor={C.dim} style={[st.input, { marginTop: 6 }]} />
          <Text style={[st.body, { marginTop: 10 }]}>Date of birth</Text>
          <TextInput value={dob} onChangeText={(v) => setDob(v.replace(/[^\d-]/g, '').slice(0, 10))} placeholder="YYYY-MM-DD" placeholderTextColor={C.dim} keyboardType="numbers-and-punctuation" style={[st.input, { marginTop: 6 }]} />
          <Pressable onPress={() => setAdult(!adult)} style={[st.row, { gap: 10, marginTop: 12 }]}>
            <Text style={{ fontSize: 20, color: adult ? C.green : C.dim }}>{adult ? '☑' : '☐'}</Text>
            <Text style={[st.body, { flex: 1 }]}>I confirm I am 18 or older and accept the terms and content policy.</Text>
          </Pressable>
          <Btn label={busy ? 'Creating…' : 'Done'} disabled={name.trim().length < 3 || !dobOk || !adult || busy} onPress={finish} style={{ marginTop: 12 }} />
        </>
      )}
      {!!err && <Text style={{ color: C.red, marginTop: 10, fontWeight: '700' }}>{err}</Text>}
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
          <Text style={[st.h3, { color: C.gold }]}>💎 VIP · ₹{VIP.price}/month</Text>
          <Text style={st.body}>Priority private-room booking · 20% off gifts · exclusive gifts · VIP badge</Text>
          {vip ? (
            <>
              <Text style={{ color: C.green, marginTop: 6 }}>Active · {Math.ceil((S.user.vipUntil - Date.now()) / 864e5)} days left</Text>
              <Btn small kind="ghost" label="Cancel VIP" onPress={act.cancelVip} style={{ marginTop: 6 }} />
            </>
          ) : <Btn kind="gold" label="Become VIP" onPress={() => setConfirm('vip')} style={{ marginTop: 8 }} />}
        </View>
        <Text style={[st.meta, { marginTop: 8 }]}>Prices include GST. Coins have no cash value and cannot be transferred.</Text>
        <Text style={[st.h3, { marginTop: 14, marginBottom: 6 }]}>Activity</Text>
        {S.user.txns.length === 0 && <Text style={st.meta}>No transactions yet</Text>}
        {S.user.txns.slice(0, 25).map((x) => (
          <View key={x.id} style={[st.row, { paddingVertical: 6 }]}>
            <Text style={[st.body, { flex: 1 }]} numberOfLines={1}>{({ purchase: '🪙 Coins bought', bonus: '🎁 Bonus', gift: '🎁 Gift', shoutout: '📣 Shout-out', song: '🎶 Song request', room: '🔒 Private room', extend: '🔒 Room extended', refund: '↩️ Refund', package: '🎟 Room package', adjust: 'Adjustment' })[x.label] ?? x.label}</Text>
            <Text style={{ color: x.delta >= 0 ? C.green : C.rose, fontWeight: '800' }}>{x.delta > 0 ? '+' : ''}{x.delta ? fmt(x.delta) : '—'}</Text>
          </View>
        ))}
      </ScrollView>
      {!!confirm && <Sheet visible onClose={() => setConfirm(null)} title={confirm === 'vip' ? 'Subscribe to VIP' : `Buy ${fmt(confirm?.coins || 0)} coins`}>
        <Text style={st.body}>{confirm === 'vip' ? `₹${VIP.price} for 30 days of VIP.` : `₹${fmt(confirm?.price || 0)} incl. GST — you will pay securely on the next screen.`}</Text>
        <Btn label={confirm === 'vip' ? `Pay ₹${VIP.price}` : `Pay ₹${fmt(confirm?.price || 0)}`} onPress={() => { const c = confirm; setConfirm(null); if (c === 'vip') act.buyVip(); else act.buyPack(c); }} style={{ marginTop: 12 }} />
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
  const [board, setBoard] = useState({ spenders: [], dancers: [] });
  const L = S.lang;
  useEffect(() => { api('GET', '/leaderboard').then(setBoard).catch(() => {}); }, [tab]);
  const myRank = board.spenders.findIndex((x) => x.id === S.user.id) + 1;
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
            <Text style={st.meta}>{p.specs.join(', ')}{S.user.topFanOf.includes(p.id) ? ' · you are her top fan ⭐' : ''}</Text>
          </View>
          <Text style={st.gold}>🪙{fmtK(p.coins)}</Text>
        </Pressable>
      ))}
      {tab === 'spenders' && (
        <>
          {S.user.registered && <Text style={[st.meta, { marginBottom: 8 }]}>Your rank (30 days): {myRank ? `#${myRank}` : 'not ranked yet'} · 🪙{fmt(S.user.total)} spent overall</Text>}
          {board.spenders.length === 0 && <Text style={st.meta}>No spenders yet this month</Text>}
          {board.spenders.map((x, i) => (
            <View key={x.id} style={[st.listRow, x.id === S.user.id && { borderColor: C.green }]}>
              <Text style={{ color: C.gold, fontWeight: '900', width: 28, textAlign: 'center' }}>{['👑', '🥈', '🥉'][i] || i + 1}</Text>
              <Text style={{ color: C.text, fontWeight: '800', flex: 1 }}>{x.name}{x.id === S.user.id ? ' (you)' : ''}</Text>
              <Text style={st.gold}>🪙{fmtK(x.coins)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

export function MeTab({ S, act }) {
  const L = S.lang;
  const vip = isVip(S.user, S.now);
  const topOf = S.roster.filter((p) => S.user.topFanOf.includes(p.id));
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
      {!S.user.registered && <Btn label="Sign in / Sign up" onPress={act.openRegister} />}
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
        {S.user.history.map((h) => (
          <Pressable key={h.id} onPress={() => act.watch(h.did)} style={[st.row, { paddingVertical: 6 }]}>
            <Text style={[st.body, { flex: 1 }]}>{h.name} · {h.min} min · {new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Text>
          </Pressable>
        ))}
      </View>
      <View style={st.box}>
        <Text style={st.h3}>🛟 Help and safety</Text>
        <Text style={[st.meta, { marginTop: 4 }]}>Report anything in a room with ⚑ Report. Payment problems: support@yourdomain.com</Text>
      </View>
      {S.user.registered && <Btn kind="ghost" label="Sign out" onPress={act.logout} />}
      <Text style={[st.meta, { textAlign: 'center' }]}>Mehfil Live · {S.connected === 'online' ? 'connected' : 'reconnecting…'}</Text>
    </ScrollView>
  );
}
