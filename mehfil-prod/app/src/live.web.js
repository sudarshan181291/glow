// Web build (used for testing in a browser): live video is shown only in the Android app.
import React from 'react';
import { Text, View } from 'react-native';

export const stage = { setFocus() {}, acquire: () => () => {}, tracks: new Map() };
export function useStageConnection() {}
export function useStageTrack() { return undefined; }
export function LiveVideo({ style }) {
  return <View style={[{ backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }, style]}><Text style={{ color: '#fff' }}>Live video plays in the Android app</Text></View>;
}
export function useLiveRoom() {
  return { room: null, error: 'Live video works in the Android app', local: undefined, remote: [], controls: { setCamera() {}, setMic() {}, flip() {}, facing: 'user' } };
}
