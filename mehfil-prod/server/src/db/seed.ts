// Creates the studio, gift catalogue and song list. Safe to run more than once.
import { DEFAULT_STUDIO_CONFIG } from '../config.js';
import type { Db } from './pool.js';

export const GIFTS = [
  ['rose', 'Rose', '🌹', 10, 'float', false, false], ['heart', 'Heart', '💖', 25, 'float', false, false],
  ['chai', 'Chai', '☕', 50, 'float', false, false], ['jhumka', 'Jhumka', '💫', 100, 'burst', false, false],
  ['gajra', 'Gajra', '🌼', 250, 'rain', false, false], ['diya', 'Festive Diya', '🪔', 300, 'rain', true, false],
  ['firework', 'Firework', '🎆', 500, 'rain', false, false], ['crown', 'Crown', '👑', 1000, 'royal', false, false],
  ['diamond', 'Diamond', '💎', 2500, 'royal', false, false], ['stagecall', 'Stage Call', '🎤', 5000, 'stage', false, false],
  ['haathi', 'Shahi Haathi', '🐘', 10000, 'stage', false, true], ['mahal', 'Sheesh Mahal', '🏰', 25000, 'stage', false, true],
] as const;
export const SONGS = [
  ['s1', 'Chaiyya Chaiyya', 'Bollywood', 150], ['s2', 'Kajra Re', 'Bollywood', 200], ['s3', 'Dola Re Dola', 'Semi-classical', 250],
  ['s4', 'Nagada Sang Dhol', 'Garba', 200], ['s5', 'Ghoomar', 'Rajasthani', 180], ['s6', 'Kun Faya Kun', 'Sufi', 220],
  ['s7', 'Apsara Aali', 'Lavani', 220], ['s8', 'Laung Laachi', 'Punjabi', 160],
] as const;

const DEMO_NAMES = ['Aarohi', 'Meher', 'Tara', 'Noor', 'Ishita', 'Kavya', 'Rhea', 'Zoya', 'Anaya', 'Mira', 'Sana', 'Diya', 'Riya', 'Pari', 'Naina', 'Saira'];
const DEMO_SPECS = [['Bollywood'], ['Kathak', 'Semi-classical'], ['Garba'], ['Sufi'], ['Lavani'], ['Bhangra'], ['Bollywood', 'Hip-hop'], ['Ghoomar']];

export async function seed(db: Db, opts: { studioName?: string; adminPhone?: string; demoDancers?: number } = {}) {
  const s = await db.query('SELECT id FROM studios LIMIT 1');
  if (!s.rows[0]) await db.query('INSERT INTO studios(name, config) VALUES ($1,$2)', [opts.studioName ?? 'Studio Royale', JSON.stringify(DEFAULT_STUDIO_CONFIG)]);
  for (const [i, g] of GIFTS.entries()) {
    await db.query(
      `INSERT INTO gift_catalog(id,name,emoji,cost,anim,seasonal,exclusive,sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, emoji=EXCLUDED.emoji, cost=EXCLUDED.cost, anim=EXCLUDED.anim, sort=EXCLUDED.sort`,
      [...g, i]);
  }
  for (const sg of SONGS) await db.query('INSERT INTO songs(id,title,cat,price) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', sg as unknown as unknown[]);
  if (opts.adminPhone) {
    await db.query(`INSERT INTO users(phone, display_name, role, age_confirmed_at) VALUES ($1,'Admin','admin',now())
      ON CONFLICT (phone) DO UPDATE SET role='admin'`, [opts.adminPhone]);
  }
  // Staging only: test dancer accounts (+9190000000NN) so you can try the app before real dancers are onboarded.
  if (opts.demoDancers) {
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to create demo dancers in production');
    const studio = (await db.query('SELECT id, config FROM studios LIMIT 1')).rows[0];
    for (let i = 0; i < Math.min(opts.demoDancers, DEMO_NAMES.length); i += 1) {
      const phone = `+9190000000${String(i + 1).padStart(2, '0')}`;
      const u = (await db.query(
        `INSERT INTO users(phone, display_name, role, dob, age_confirmed_at) VALUES ($1,$2,'dancer','1998-01-01',now())
         ON CONFLICT (phone) DO UPDATE SET role='dancer' RETURNING id`, [phone, DEMO_NAMES[i]])).rows[0];
      await db.query('INSERT INTO wallets(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [u.id]);
      await db.query(
        `INSERT INTO dancers(user_id, studio_id, stage_name, bio, langs, specs, city, split_pct, kyc_status, status)
         VALUES ($1,$2,$3,'Demo profile for testing',$4,$5,'Mumbai',$6,'approved','bench') ON CONFLICT (user_id) DO NOTHING`,
        [u.id, studio.id, DEMO_NAMES[i], ['Hindi', 'English'], DEMO_SPECS[i % DEMO_SPECS.length], studio.config.defaultSplit ?? 50]);
    }
  }
}

if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1])) {
  const { createPool } = await import('./pool.js');
  const { migrate } = await import('./migrate.js');
  const db = createPool(process.env.DATABASE_URL!);
  await migrate(db);
  await seed(db, { studioName: process.env.STUDIO_NAME, adminPhone: process.env.ADMIN_PHONE, demoDancers: Number(process.env.SEED_DEMO_DANCERS || 0) });
  console.log('Seed complete');
  await db.end();
}
