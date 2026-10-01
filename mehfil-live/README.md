# Mehfil Live · Studio Royale (Android)

React Native (Expo SDK 57) app: 20 performers on one stage, with gifting, song requests, private rooms, VIP, coins and a Director console.

## Option A: Get an APK from GitHub (free, no setup on your computer)

1. Create a new repository on github.com (it can be private).
2. Upload **all files in this folder**, including the hidden `.github` folder. Easiest way: on the repo page click **Add file → Upload files**, then drag the whole unzipped folder in.
   - If the `.github` folder doesn't upload by drag-and-drop, click **Add file → Create new file**, type `.github/workflows/build-apk.yml` as the name, and paste in the contents of that file.
3. Open the **Actions** tab. The **Build Android APK** run starts by itself; if it doesn't, select it and click **Run workflow**. It takes about 10–15 minutes.
4. When it shows a green tick, open the run and download **mehfil-live-apk** under *Artifacts*. Unzip it to get `app-release.apk`.
5. Copy the APK to your phone, open it, and allow "Install unknown apps" when Android asks.

## Option B: Try it instantly with Expo Go

1. Install **Expo Go** from the Play Store.
2. Install Node.js 20+ on your computer, then in this folder run:
   ```
   npm install
   npx expo start
   ```
3. Scan the QR code with Expo Go (phone and computer on the same Wi-Fi).

## What's in the app

| Area | Features |
|---|---|
| Entry | 18+ gate, studio lobby (4 live studios) |
| Stage | 5×4 grid of 20 animated dancers, live rank, coins, spotlight, group dance |
| Cameras | Wide (free), Close-Up 50, Side 30, Top 40, Backstage 100. Each unlock lasts 5 minutes, and close-ups are free for VIPs |
| Gifts | 9 tiers from Rose (10) to Stage Call (5,000), each with its own animation and a performer thank-you |
| Songs | 10-song catalogue, bid for priority, live queue, auto-play with a "now playing" banner |
| Perks | Shout-out (100), Private Room 5 min (500) / 15 min (1,300) with a countdown, chat and +5 min extension, VIP ₹999/month |
| Coins | Wallet, 4 recharge packs with bonuses, transaction history |
| Leaderboard | All 20 performers ranked live |
| Director | Master camera ("Director's Cut" pushed to viewers), announcements, spotlight top earner, group dance, skip song, live stats, top 5 |
| Live sim | Viewer count, fan chat, fan gifts and fan song requests every 4 seconds |

**Prototype note:** the performers are animated simulations and all purchases are demo purchases. No real payments are taken.
