# Mehfil Live — production app

Two parts:

| Folder | What it is |
|---|---|
| `server/` | Node.js + PostgreSQL backend: logins, coins, gifts, private rooms, the stage engine, payments, moderation, payouts |
| `app/` | The Android app (Expo / React Native) for customers, dancers and studio staff |

Live video uses **LiveKit**. Payments use **Razorpay** in the sideload APK and **Google Play Billing** in the Play Store build.

**Content rule (built into the app and your legal terms):** performances are dance and music only, fully clothed, in public and private rooms. No nudity or sexual content. Every dancer must pass KYC and be 18 or older before she can go on stage. Moderators can join any private room invisibly and end it.

---

## 1. Accounts you need

| Service | Why | Cost to start |
|---|---|---|
| **LiveKit Cloud** (cloud.livekit.io) | Live video between phones | Free tier, then pay per minute |
| **Razorpay** | UPI/card payments in the APK | 2% per payment, needs business KYC |
| **MSG91** | OTP SMS. Requires **DLT registration** (Jio/Airtel/Vi portal) with an OTP template containing `##OTP##` | About ₹0.20 per SMS |
| **Google Play Console** | Play Store build + Play Billing | $25 once |
| **Expo** (expo.dev) | Push notifications (project id + access token) | Free |
| **A server host** (Render, Railway, DigitalOcean, AWS…) with **managed PostgreSQL 15+** | Runs the backend | About ₹1,500–4,000/month to start |
| **A domain + HTTPS**, e.g. `api.yourdomain.com` | The app talks to the server over HTTPS | About ₹1,000/year |
| **A KYC provider** (e.g. Digio, IDfy, HyperVerge) | Checking dancer ID and age | Per check |

You also need a lawyer to review your terms, privacy policy, content policy, refund policy and dancer contracts, and to confirm the business is allowed in each state you operate in.

---

## 2. Run the server

### Try it on your computer first (Docker)

```bash
cd server
cp .env.example .env          # then edit .env — for local testing set NODE_ENV=development, OTP_PROVIDER=console, DEV_FIXED_OTP=123456, SEED_DEMO_DANCERS=12
docker compose --profile setup run --rm seed     # creates tables, gifts, songs, studio, your admin account
docker compose up -d api
curl http://localhost:8080/healthz               # {"ok":true}
```

For local video testing add `--profile video` to run a local LiveKit and set `LIVEKIT_URL=ws://<your-computer-ip>:7880`, `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret`.

### Production

1. Create a managed PostgreSQL database and copy its connection string into `DATABASE_URL`.
2. Fill in **every** value in `.env.example` (the server refuses to start in production without real SMS, LiveKit and Razorpay keys). Generate secrets with `openssl rand -base64 48`.
3. Deploy the `server/` folder with its `Dockerfile` (any Docker host). Run the seed once: `node dist/db/seed.js`.
4. Put it behind HTTPS at e.g. `https://api.yourdomain.com`. WebSockets must be allowed (path `/ws`).
5. You can run 2+ copies for reliability: they coordinate through PostgreSQL, and only one runs the stage engine at a time.

### Webhooks to set up

| Where | URL | Secret |
|---|---|---|
| Razorpay Dashboard → Webhooks (events: `payment.captured`, `order.paid`, `payment.failed`) | `https://api.yourdomain.com/webhooks/razorpay` | `RAZORPAY_WEBHOOK_SECRET` |
| LiveKit Cloud → Settings → Webhooks | `https://api.yourdomain.com/webhooks/livekit` | Uses your LiveKit API key/secret |
| Google Cloud Pub/Sub push subscription for Play RTDN | `https://api.yourdomain.com/webhooks/play?token=<PLAY_RTDN_TOKEN>` | `PLAY_RTDN_TOKEN` |

### Products to create in Play Console (Play build only)

- In-app products (consumable): `coins_100`, `coins_550`, `coins_1200`, `coins_6500`
- Subscription: `vip_monthly` (with a monthly base plan)
- Give the service account in `PLAY_SERVICE_ACCOUNT_JSON` access in Play Console → Users and permissions (view financial data, manage orders).

---

## 3. Build the Android app

The app needs your server address baked in at build time.

### Option A — GitHub (free)

1. Put this whole folder (including the hidden `.github` folder) in a **private** GitHub repository.
2. Create a signing key once and keep it safe forever (you can't update the app without it):
   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias mehfil -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 release.keystore      # copy the output
   ```
3. In GitHub → Settings → Secrets and variables → Actions:
   - **Variables:** `API_URL` = `https://api.yourdomain.com`, optional `EAS_PROJECT_ID`
   - **Secrets:** `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`mehfil`), `ANDROID_KEY_PASSWORD`
4. Actions → **Build Android app** → Run workflow → choose:
   - `apk` → `mehfil-live.apk` with Razorpay, to share directly
   - `play` → `mehfil-live-play.aab` with Play Billing, to upload to Play Console
5. Download the file from the finished run.

### Option B — Expo EAS Build

Edit `API_URL` in `app/eas.json`, then `cd app && npx eas build -p android --profile apk` (or `--profile play`).

### Before each release

Increase `version` and `android.versionCode` in `app/app.config.js`.

---

## 4. First night checklist

1. Sign in to the app with the phone you set as `ADMIN_PHONE`. Top-right menu → **Studio console**.
2. **Add each dancer** (phone, stage name, date of birth). Check her ID and age through your KYC provider, then tap **Approve**.
3. Make your floor manager and moderators staff: **Staff roles** → their phone → `floor` or `moderator` (they must sign in once first).
4. Dancers sign in with their own phone, open **My dancer app**, set **Available**, and tap **Go live with camera** once the floor puts them on stage.
5. Watch from a customer phone: sign up, buy coins, gift, book a room.
6. Every Monday: Studio console → **Run payouts** → upload the CSV to your bank's bulk transfer → mark payouts paid.

---

## 5. Who sees what in the app

| Role | View |
|---|---|
| Customer (everyone) | Live stage, video wall, gifts, songs, private rooms, wallet, leaderboard |
| Dancer | **My dancer app**: availability, go live, accept/decline requests, earnings, ledger, top fans, message followers, block |
| Floor manager | **Studio console**: stage control, splits, prices, room limits, announcements, end rooms, kill switch |
| Moderator | **Moderation**: reports, invisible room checks, end rooms, ban users |
| Admin | Everything above + add dancers, KYC, staff roles, payouts |

---

## 6. What has been tested, and what you still need to test

**Tested here:**
- Server: 33 automated tests covering login and OTP limits, the coin ledger (no negative balances, no double credits), the stage engine (requests, accept/decline, timeouts, waitlist, backfill, pro-rata refunds, the kill switch), Razorpay and Play payment verification, real-time events and staff permissions.
- The full app flow in a browser against the real server: guest watching, sign-up with OTP, out-of-coins wallet, booking, the dancer accepting, both sides entering the private room, the floor manager ending it with a pro-rata refund.

**Only possible on real phones with your real keys:**
- Live camera video (LiveKit)
- Razorpay checkout
- Play Billing
- Push notifications
- SMS OTP delivery

Do a full test night with a few dancers and customers on **staging keys** before going public.

**Placeholders to replace:**
- The bundled dance clips and poster images, marked "DEMO VIDEO". Set each dancer's real photo and video URLs (`PATCH /dancer/me` with `photoUrl` and `videoUrl`). When a dancer is live, her camera replaces these automatically.
- `support@yourdomain.com` in the app's help text.
- The app icon and splash (`app/assets`).

---

## 7. Project layout

```
server/src/
  routes/      auth, customer, payments + webhooks, staff (dancer/floor/mod/admin)
  services/    engine (stage + rooms), actions (gifts, chat, follow…), ledger, payments, video, push, realtime
  db/          migrations, seed
server/test/   automated tests (embedded PostgreSQL)
app/src/
  api.js, realtime.js, store.js   server connection and app state
  live.js                         LiveKit video (stage, publishing, private rooms)
  payments.js                     Razorpay / Play Billing
  customer.js, stage.js           customer screens
  dancerApp.js                    dancer app
  floor.js                        studio console (floor, moderation, admin)
```
