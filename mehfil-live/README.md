# Mehfil Live (v2) — Android prototype

React Native (Expo SDK 57) prototype built to BRD v2 (audience-journey-led). It has three views, switched from the top-right menu:

- **Customer**: the 7-stage journey, from discovering the app to becoming a top fan
- **Dancer app**: the supply side. You play "Priya".
- **Floor manager**: the movement engine, remote config and moderation

Dancers are animated figures performing dance only. Coins and payments are demo-only.

## Get the APK (GitHub, free)

1. Create a new GitHub repository and upload **everything in this folder**, including the hidden `.github` folder.
2. Open **Actions → Build Android APK**. It starts on push, or you can click **Run workflow**. It takes about 10–15 minutes.
3. Download **mehfil-live-apk** from the finished run, unzip it, copy `app-release.apk` to your phone and install it. Allow "Install unknown apps" when asked.

## Or try it in Expo Go

```
npm install
npx expo start
```
Scan the QR code with Expo Go. Your phone and computer need to be on the same Wi-Fi.

## What maps to the BRD

| Journey stage | In the app |
|---|---|
| 1 Discover | Live stage preview before any wall; invite friends link (WhatsApp/Telegram share); dancer profile share; deep links `mehfillive://dancer/<id>` and `mehfillive://invite/<code>`; discreet app name |
| 2 Enter | One-tap 18+ gate, language at first open (English, Hindi; Marathi, Bengali, Tamil, Telugu fall back to English), free viewing with no login. Sign-up (phone OTP, demo code 1234, display name, default avatar) appears only on first spend |
| 3 Browse | Scrollable grid of live dancers with rank, coins, languages and live status, plus an "In private room · back in X min" section; filters for language, specialty, availability, popular and new; search; NEW badges; dancer profile with bio, photos, top fans; bench backfill keeps the stage full; "explore similar dancers" when the one you're watching leaves |
| 4 Engage | Gifts from Rose 10 to Stage Call 5,000, animated; 1,000+ confirmation; shout-out; dancer thanks you by name; live chat; follow; low balance opens recharge; +50 first-purchase bonus; ⭐ top-fan tag in chat; song request with dedication (refunded if not played) |
| 5 Go Private | Book on every card and profile; prices up front; confirmation; dancer accepts or declines; she leaves the stage live and her slot is backfilled; countdown; +5 min extension; pro-rata refund if she ends early; report; rating; "She'll remember you" follow prompt; studio room cap with waitlist |
| 6 Return | Following list with live status; in-app alerts when a favourite goes live or is free; dancer greets returning customers; "Your top dancers" on home; tonight's summary; private room history (only you) |
| 7 Belong | Top-spender and top-dancer leaderboards; top-fan badges; exclusive gifts above 5,000 (unlock at 10,000 spent or VIP); priority booking for VIP and top fans; VIP ₹999/month; festive gift; room package (buy 5 get 1 free); concierge chat for whales |
| Dancer journey | Availability (available, busy, break, off shift); accept or decline requests without penalty; end room early; real-time earnings and ledger; top fans; rate-limited message to followers; block customers; support line; KYC and bank verified status |
| Movement engine | Stage cap 16, minimum 12 (configurable), max 6 rooms (configurable), bench backfill under 5 s, automatic return to stage or bench, floor override (force return, end room, bench, break, off), kill switch, per-dancer split, announcements, reports queue |

## Not in this prototype

Real video, real payments or OTP SMS, push notifications (alerts are in-app), and a server. Every viewer, dancer and room is simulated on the phone.
