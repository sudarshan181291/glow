// Design tokens shared by every screen.
export const C = {
  g1: '#ca3c7c',
  g2: '#a24bcf',
  bg: '#f8f6fc',
  card: '#ffffff',
  soft: '#f1ebf8',
  line: '#ebe4f3',
  ink: '#2b1d33',
  ink2: '#1f1326',
  muted: '#85769a',
  pink: '#fa3d6c',
  online: '#22c55e',
  coinBg: '#fff4dc',
  coin: '#a0620a',
  danger: '#d42a50',
  dangerBg: '#ffe4ea',
};

export const GRAD = [C.g1, C.g2];

// Inter faces loaded in App.js. Android ignores fontWeight on custom fonts,
// so each weight is its own family.
export const F = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
};

export const shadow = {
  shadowColor: '#2b1d33',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};
