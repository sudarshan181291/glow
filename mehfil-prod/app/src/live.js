// Live video with LiveKit.
//  - stage:      one shared connection to the stage room; every on-stage dancer's camera is available by her id.
//  - Publisher:  the dancer's own camera + mic, on the stage or in a private room.
//  - PrivateCall: a customer's connection to their private room.
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AudioSession, VideoTrack } from '@livekit/react-native';
import { Room, RoomEvent, Track } from 'livekit-client';
import { api } from './api';

// ---------------------------------------------------------------- stage watcher
class StageWatcher {
  room = null;
  tracks = new Map(); // dancerId -> TrackReference
  listeners = new Set();
  refs = 0;
  connecting = false;
  focus = null;
  retry = null;

  acquire() {
    this.refs += 1;
    if (!this.room && !this.connecting) this.connect();
    return () => { this.refs -= 1; if (this.refs <= 0) setTimeout(() => { if (this.refs <= 0) this.disconnect(); }, 3000); };
  }

  async connect() {
    this.connecting = true;
    try {
      const t = await api('GET', '/stage/token');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      const rebuild = () => this.rebuild();
      room
        .on(RoomEvent.TrackSubscribed, rebuild).on(RoomEvent.TrackUnsubscribed, rebuild)
        .on(RoomEvent.TrackPublished, rebuild).on(RoomEvent.TrackUnpublished, rebuild)
        .on(RoomEvent.ParticipantConnected, rebuild).on(RoomEvent.ParticipantDisconnected, rebuild)
        .on(RoomEvent.Disconnected, () => { this.room = null; this.tracks.clear(); this.emit(); if (this.refs > 0) this.retry = setTimeout(() => this.connect(), 5000); });
      await AudioSession.startAudioSession();
      await room.connect(t.url, t.token, { autoSubscribe: true });
      this.room = room;
      this.rebuild();
    } catch {
      if (this.refs > 0) this.retry = setTimeout(() => this.connect(), 5000);
    } finally {
      this.connecting = false;
    }
  }

  disconnect() {
    clearTimeout(this.retry);
    const r = this.room;
    this.room = null;
    this.tracks.clear();
    this.emit();
    if (r) r.disconnect().catch(() => {});
    AudioSession.stopAudioSession().catch?.(() => {});
  }

  /** Only hear the dancer you're focused on (16 microphones at once is noise). */
  setFocus(id) { this.focus = id; this.rebuild(); }

  rebuild() {
    if (!this.room) return;
    this.tracks.clear();
    for (const p of this.room.remoteParticipants.values()) {
      const cam = p.getTrackPublication(Track.Source.Camera);
      if (cam?.track) this.tracks.set(p.identity, { participant: p, publication: cam, source: Track.Source.Camera });
      const mic = p.getTrackPublication(Track.Source.Microphone);
      if (mic) { try { mic.setSubscribed(p.identity === this.focus); } catch { /* not yet ready */ } }
    }
    this.emit();
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach((f) => f()); }
}

export const stage = new StageWatcher();

/** Keep the stage connection open while a screen that shows video is mounted. */
export function useStageConnection(enabled = true) {
  useEffect(() => (enabled ? stage.acquire() : undefined), [enabled]);
}

/** The live camera track for a dancer, or undefined if she is not streaming. */
export function useStageTrack(dancerId) {
  const [ref, setRef] = useState(() => stage.tracks.get(dancerId));
  useEffect(() => {
    setRef(stage.tracks.get(dancerId));
    return stage.subscribe(() => setRef(stage.tracks.get(dancerId)));
  }, [dancerId]);
  return ref;
}

export function LiveVideo({ trackRef, style, mirror }) {
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <VideoTrack trackRef={trackRef} style={{ width: '100%', height: '100%' }} objectFit="cover" mirror={!!mirror} />
      <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: '#ff4d6d', borderRadius: 5, paddingHorizontal: 5 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>● LIVE</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- publishing (dancer) and private calls
function useRoomTracks(room) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!room) return undefined;
    const bump = () => setN((n) => n + 1);
    const evts = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted];
    evts.forEach((e) => room.on(e, bump));
    return () => evts.forEach((e) => room.off(e, bump));
  }, [room]);
  if (!room) return { local: undefined, remote: [] };
  const lp = room.localParticipant;
  const lcam = lp.getTrackPublication(Track.Source.Camera);
  const local = lcam?.track ? { participant: lp, publication: lcam, source: Track.Source.Camera } : undefined;
  const remote = [];
  for (const p of room.remoteParticipants.values()) {
    const cam = p.getTrackPublication(Track.Source.Camera);
    if (cam?.track) remote.push({ participant: p, publication: cam, source: Track.Source.Camera });
  }
  return { local, remote };
}

/**
 * Connect to a room and publish camera/mic.
 * kind 'stage'  → the dancer on the shared stage
 * kind 'room'   → either side of a private room (bookingId required)
 */
export function useLiveRoom({ kind, bookingId, tokenPath, camera = true, mic = true, enabled = true }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [facing, setFacing] = useState('user');
  useEffect(() => {
    if (!enabled) return undefined;
    let r = null;
    let cancelled = false;
    (async () => {
      try {
        const t = await api('GET', tokenPath || (kind === 'stage' ? '/dancer/stage-token' : `/bookings/${bookingId}/token`));
        await AudioSession.startAudioSession();
        r = new Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { facingMode: 'user', resolution: { width: 720, height: 1280, frameRate: 24 } } });
        await r.connect(t.url, t.token, { autoSubscribe: true });
        if (cancelled) { r.disconnect(); return; }
        if (camera) await r.localParticipant.setCameraEnabled(true);
        if (mic) await r.localParticipant.setMicrophoneEnabled(true);
        setRoom(r);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not start video');
      }
    })();
    return () => { cancelled = true; if (r) r.disconnect().catch(() => {}); AudioSession.stopAudioSession().catch?.(() => {}); setRoom(null); };
  }, [kind, bookingId, tokenPath, enabled]);
  const tracks = useRoomTracks(room);
  const controls = {
    async setCamera(on) { await room?.localParticipant.setCameraEnabled(on); },
    async setMic(on) { await room?.localParticipant.setMicrophoneEnabled(on); },
    async flip() {
      const pub = room?.localParticipant.getTrackPublication(Track.Source.Camera);
      const next = facing === 'user' ? 'environment' : 'user';
      try { await pub?.track?.restartTrack({ facingMode: next }); setFacing(next); } catch { /* device without a second camera */ }
    },
    facing,
  };
  return { room, error, ...tracks, controls };
}
