// Push notifications ("Priya is live now") via Expo's push service.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registerPush() {
  if (!Device.isDevice) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('live', { name: 'Live alerts', importance: Notifications.AndroidImportance.HIGH });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return; // set EAS_PROJECT_ID at build time to enable push (see README)
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api('POST', '/push/token', { token, platform: Platform.OS });
}
