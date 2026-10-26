// Performer media. Every dancer gets a looping performance video and a poster photo.
// The bundled clips are DUMMY placeholders (marked "DEMO VIDEO").
// To use real footage, add entries to MEDIA_OVERRIDES — either a bundled file
// (require('../assets/videos/priya.mp4')) or a URL ('https://cdn.example.com/priya.mp4').
import React from 'react';
import { Image, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CameraView } from 'expo-camera';

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
  return {
    video: o.video ? asSource(o.video) : CLIPS[p.id % CLIPS.length],
    photo: o.photo ? asSource(o.photo) : POSTERS[p.id % POSTERS.length],
    demo: !o.video,
  };
}

// Looping, muted performance video.
// The dancer's real camera (prototype: works when her camera is live on this same phone).
export function LiveCamera({ style }) {
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <CameraView style={{ width: '100%', height: '100%' }} facing="front" mirror />
      <View style={{ position: 'absolute', top: 6, left: 6, backgroundColor: '#ff4d6d', borderRadius: 5, paddingHorizontal: 5 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10 }}>📷 LIVE CAMERA</Text>
      </View>
    </View>
  );
}

export function DanceVideo({ p, style, paused, camera }) {
  if (camera) return <LiveCamera style={style} />;
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
