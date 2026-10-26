// Build settings. Set these environment variables when building:
//   API_URL         https address of your Mehfil server, e.g. https://api.mehfil.live   (required)
//   APP_CHANNEL     apk (Razorpay, sideloaded APK) or play (Google Play Billing, Play Store build)
//   EAS_PROJECT_ID  Expo project id, needed for push notifications (optional)
const channel = process.env.APP_CHANNEL === 'play' ? 'play' : 'apk';

module.exports = () => ({
  expo: {
    name: 'Mehfil Live',
    slug: 'mehfil-live-studio-royale',
    version: '3.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    backgroundColor: '#0a0612',
    scheme: 'mehfillive',
    splash: { backgroundColor: '#0a0612' },
    android: {
      package: 'com.mehfillive.studioroyale',
      versionCode: 4,
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: { backgroundColor: '#0a0612' },
      permissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
      ],
    },
    ios: { bundleIdentifier: 'com.mehfillive.studioroyale' },
    plugins: [
      ['@livekit/react-native-expo-plugin', { android: { audioType: 'media' } }],
      ['@config-plugins/react-native-webrtc', { cameraPermission: 'Mehfil Live uses your camera when you go live.', microphonePermission: 'Mehfil Live uses your microphone when you go live or join a private room.' }],
      'expo-secure-store',
      ['expo-notifications', { color: '#ff6b9d' }],
      // Always configured (the module is linked in both builds); only the Play build uses it.
      ['expo-iap', { android: { store: 'play' } }],
    ],
    extra: {
      apiUrl: process.env.API_URL || 'http://10.0.2.2:8080',
      channel,
      ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
    },
  },
});
