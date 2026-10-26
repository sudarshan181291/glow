-- Mehfil Live: initial schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE studios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            text UNIQUE NOT NULL,
  display_name     text NOT NULL,
  role             text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','dancer','floor','moderator','admin')),
  dob              date,
  age_confirmed_at timestamptz,
  lang             text NOT NULL DEFAULT 'en',
  vip_until        timestamptz,
  lifetime_spent   bigint NOT NULL DEFAULT 0,
  first_purchase_at timestamptz,
  banned_at        timestamptz,
  ban_reason       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_display_name_lower ON users (lower(display_name));

CREATE TABLE otp_codes (
  id          bigserial PRIMARY KEY,
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_phone ON otp_codes (phone, created_at DESC);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text UNIQUE NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Wallet: balance can never go negative. Every change is a ledger entry.
CREATE TABLE wallets (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance      bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  room_credits int NOT NULL DEFAULT 0 CHECK (room_credits >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entries (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id),
  delta         bigint NOT NULL,
  balance_after bigint NOT NULL,
  kind          text NOT NULL,           -- purchase, bonus, gift, shoutout, song, room, extend, refund, package, adjust
  ref_type      text,
  ref_id        text,
  idem_key      text UNIQUE,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_user ON ledger_entries (user_id, id DESC);

CREATE TABLE dancers (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  studio_id       uuid NOT NULL REFERENCES studios(id),
  stage_name      text NOT NULL,
  bio             text NOT NULL DEFAULT '',
  langs           text[] NOT NULL DEFAULT '{}',
  specs           text[] NOT NULL DEFAULT '{}',
  city            text NOT NULL DEFAULT '',
  photo_url       text,
  video_url       text,
  split_pct       int NOT NULL DEFAULT 50 CHECK (split_pct BETWEEN 0 AND 100),
  kyc_status      text NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','approved','rejected')),
  kyc_ref         text,
  status          text NOT NULL DEFAULT 'off' CHECK (status IN ('off','bench','stage','private','break')),
  busy            boolean NOT NULL DEFAULT false,
  camera_live     boolean NOT NULL DEFAULT false,
  slot            int,
  since           timestamptz NOT NULL DEFAULT now(),
  return_at       timestamptz,
  followers_count int NOT NULL DEFAULT 0,
  coins_earned    bigint NOT NULL DEFAULT 0,
  is_new          boolean NOT NULL DEFAULT true,
  last_follower_msg_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX dancers_slot ON dancers (studio_id, slot) WHERE slot IS NOT NULL;
CREATE INDEX dancers_status ON dancers (studio_id, status);

CREATE TABLE follows (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dancer_id  uuid NOT NULL REFERENCES dancers(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dancer_id)
);

CREATE TABLE blocks (
  dancer_id   uuid NOT NULL REFERENCES dancers(user_id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dancer_id, customer_id)
);

CREATE TABLE gift_catalog (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  emoji     text NOT NULL,
  cost      int NOT NULL CHECK (cost > 0),
  anim      text NOT NULL DEFAULT 'float',
  seasonal  boolean NOT NULL DEFAULT false,
  exclusive boolean NOT NULL DEFAULT false,
  active    boolean NOT NULL DEFAULT true,
  sort      int NOT NULL DEFAULT 0
);

CREATE TABLE songs (
  id     text PRIMARY KEY,
  title  text NOT NULL,
  cat    text NOT NULL,
  price  int NOT NULL CHECK (price > 0),
  active boolean NOT NULL DEFAULT true
);

-- Every coin spent on a dancer, and the dancer's share of it.
CREATE TABLE earnings (
  id           bigserial PRIMARY KEY,
  dancer_id    uuid NOT NULL REFERENCES dancers(user_id),
  customer_id  uuid REFERENCES users(id),
  kind         text NOT NULL,       -- gift, shoutout, song, room, extend, refund
  ref_id       text,
  gross        bigint NOT NULL,     -- coins (negative for refunds)
  dancer_share bigint NOT NULL,
  payout_id    uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX earnings_dancer ON earnings (dancer_id, created_at DESC);
CREATE INDEX earnings_unpaid ON earnings (dancer_id) WHERE payout_id IS NULL;

CREATE TABLE song_requests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  dancer_id  uuid NOT NULL REFERENCES dancers(user_id),
  song_id    text NOT NULL REFERENCES songs(id),
  cost       int NOT NULL,
  status     text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','played','refunded')),
  due_at     timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id    uuid NOT NULL REFERENCES studios(id),
  customer_id  uuid NOT NULL REFERENCES users(id),
  dancer_id    uuid NOT NULL REFERENCES dancers(user_id),
  minutes      int NOT NULL CHECK (minutes IN (5,15)),
  price        int NOT NULL,
  credit_used  boolean NOT NULL DEFAULT false,
  status       text NOT NULL CHECK (status IN ('waitlisted','requested','declined','expired','cancelled','active','ended')),
  priority     int NOT NULL DEFAULT 0,
  decide_by    timestamptz,
  started_at   timestamptz,
  ends_at      timestamptz,
  ended_at     timestamptz,
  end_reason   text,
  charged      bigint NOT NULL DEFAULT 0,
  refunded     bigint NOT NULL DEFAULT 0,
  room_name    text,
  dancer_left_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_status ON bookings (studio_id, status);
CREATE UNIQUE INDEX bookings_one_open_per_customer ON bookings (customer_id) WHERE status IN ('waitlisted','requested','active');
CREATE UNIQUE INDEX bookings_one_active_per_dancer ON bookings (dancer_id) WHERE status = 'active';

CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  provider        text NOT NULL CHECK (provider IN ('razorpay','play')),
  product_id      text NOT NULL,
  external_id     text UNIQUE NOT NULL,   -- Razorpay order id or Play purchase token
  external_payment_id text,
  amount_paise    int NOT NULL DEFAULT 0,
  gst_paise       int NOT NULL DEFAULT 0,
  coins           int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed','refunded')),
  raw             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz
);

CREATE TABLE payouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dancer_id    uuid NOT NULL REFERENCES dancers(user_id),
  coins        bigint NOT NULL,
  amount_paise bigint NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  reference    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz
);

CREATE TABLE chat_messages (
  id         bigserial PRIMARY KEY,
  studio_id  uuid NOT NULL REFERENCES studios(id),
  dancer_id  uuid REFERENCES dancers(user_id),   -- null = shared stage chat
  user_id    uuid REFERENCES users(id),
  kind       text NOT NULL,                       -- me, dancer, gift, system
  text       text NOT NULL,
  hidden     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_recent ON chat_messages (studio_id, dancer_id, id DESC);

CREATE TABLE reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id    uuid NOT NULL REFERENCES users(id),
  target_user_id uuid REFERENCES users(id),
  booking_id     uuid REFERENCES bookings(id),
  reason         text NOT NULL,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_by    uuid REFERENCES users(id),
  resolution     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz
);

CREATE TABLE push_tokens (
  token      text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform   text NOT NULL DEFAULT 'android',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dancer_id  uuid REFERENCES dancers(user_id),
  text       text NOT NULL,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications (user_id, id DESC);

CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  actor_id   uuid REFERENCES users(id),
  action     text NOT NULL,
  target     text,
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
