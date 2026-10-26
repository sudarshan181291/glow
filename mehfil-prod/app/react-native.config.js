// The Play Store build must use Google Play Billing only, so Razorpay's native code is left out of it.
const play = process.env.APP_CHANNEL === 'play';
module.exports = {
  dependencies: play ? { 'react-native-razorpay': { platforms: { android: null } } } : {},
};
