// Performer media. Every dancer gets a looping performance video and a poster photo.
// The bundled clips are DUMMY placeholders (marked "DEMO VIDEO").
// To use real footage, add entries to MEDIA_OVERRIDES — either a bundled file
// (require('../assets/videos/priya.mp4')) or a URL ('https://cdn.example.com/priya.mp4').
import React from 'react';
import { Image, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LiveVideo, useStageTrack } from './live';
import { hashId } from './data';

const CLIPS = [
  require('../assets/videos/clip1.mp4'), require('../assets/videos/clip2.mp4'), require('../assets/videos/clip3.mp4'), require('../assets/videos/clip4.mp4'),
  require('../assets/videos/clip5.mp4'), require('../assets/videos/clip6.mp4'), require('../assets/videos/clip7.mp4'), require('../assets/videos/clip8.mp4'),
];
const POSTERS = [
  require('../assets/posters/clip1.jpg'), require('../assets/posters/clip2.jpg'), require('../assets/posters/clip3.jpg'), require('../assets/posters/clip4.jpg'),
  require('../assets/posters/clip5.jpg'), require('../assets/posters/clip6.jpg'), require('../assets/posters/clip7.jpg'), require('../assets/posters/clip8.jpg'),
];

// e.g. MEDIA_OVERRIDES.Priya = { video: 'https://…/priya.mp4', photo: 'https://…/priya.jpg' };
export const MEDIA_OVERRIDES = {};

const asSource = (s) => (typeof s === 'string' ? { uri: s } : s);
export function mediaFor(p) {
  const o = MEDIA_OVERRIDES[p.name] || {};
  const h = hashId(p.id);
  const video = p.videoUrl || o.video;
  const photo = p.photoUrl || o.photo;
  return {
    video: video ? asSource(video) : CLIPS[h % CLIPS.length],
    photo: photo ? asSource(photo) : POSTERS[h % POSTERS.length],
    demo: !video,
  };
}

// Her live camera when she is streaming on stage; otherwise her profile clip.
export function DanceVideo({ p, style, paused }) {
  const live = useStageTrack(p.id);
  if (live) return <LiveVideo trackRef={live} style={style} />;
  return <ClipVideo p={p} style={style} paused={paused} />;
}

function ClipVideo({ p, style, paused }) {
  const { video } = mediaFor(p);
  const player = useVideoPlayer(video, (pl) => {
    pl.loop = true;
    pl.muted = true;
    if (!paused) pl.play();
  });
  React.useEffect(() => {
    if (paused) player.pause(); else player.play();
  }, [paused, player]);
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
    </View>
  );
}

export function Poster({ p, style, dim }) {
  return <Image source={mediaFor(p).photo} style={[{ backgroundColor: '#140b22' }, style, dim && { opacity: 0.4 }]} resizeMode="cover" />;
}
