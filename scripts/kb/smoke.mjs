// scripts/kb/smoke.mjs — end-to-end smoke test on a fresh local DB.
// Usage: node scripts/kb/smoke.mjs [--model glm-5.3-flash]
// Uses 2 realistic sample sources; verifies all 6 stages write sane rows.
import { existsSync, unlinkSync } from 'node:fs';
import { openDb, applyKbMigration, newId, nowIso, tableCount } from './lib/db.mjs';
import { extractSource, MODEL_DEFAULT } from './extract.mjs';
import { glmJson } from './lib/glm.mjs';
import { PROCESSOR_VERSION, stage6MergeSuggestions } from './lib/prompts.mjs';
import { validateStage6 } from './lib/validate.mjs';

const DB_PATH = '/tmp/kb-smoke.db';

const SAMPLES = [
  {
    source_type: 'travel_event',
    source_id: 'evt_songshan_20261002',
    source_url: 'https://wzt.hk/travel/taiwan-2026#songshan',
    raw_text: '2026年10月2日下午，我在台北松山机场观景台拍飞机。用 Nikon Z8 配 180-600mm 镜头，拍到了长荣航空的 Hello Kitty 彩绘机。日落时分光线很好，快门 1/2000s，ISO 400。',
  },
  {
    source_type: 'kb_note',
    source_id: 'note_lr_sunset',
    source_url: 'https://wzt.hk/kb/note_lr_sunset',
    raw_text: 'Lightroom 后期笔记：Nikon Z8 在台北拍的日落照片，高光压了 -1.5EV，白平衡 5600K，镜头是尼康 180-600mm。这组照片准备用在台北城市合集视频里。',
  },
];

function sha(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

async function main() {
  const model = process.argv.includes('--model')
    ? process.argv[process.argv.indexOf('--model') + 1]
    : MODEL_DEFAULT;
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
  const db = openDb(DB_PATH);
  applyKbMigration(db);
  console.log(`[smoke] fresh DB at ${DB_PATH}, model=${model}`);

  const ins = db.prepare(
    `INSERT INTO kb_sources (id, source_type, source_id, source_url, raw_text, raw_hash, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const s of SAMPLES) {
    ins.run(newId('src'), s.source_type, s.source_id, s.source_url, s.raw_text, sha(s.raw_text), nowIso());
  }

  for (const s of SAMPLES) {
    const source = db.prepare('SELECT * FROM kb_sources WHERE source_id = ?').get(s.source_id);
    const stats = await extractSource(db, source, { model });
    console.log(`[smoke] ${s.source_id}:`, JSON.stringify(stats));
  }

  // Stage 6 — merge suggestions across both sources' entities
  const entities = db.prepare('SELECT id, canonical_name, entity_type FROM kb_entities').all();
  const { parsed } = await glmJson({ model, ...stage6MergeSuggestions(entities) });
  const merges = validateStage6(parsed);
  console.log(`[smoke] entities: ${entities.map((e) => `${e.canonical_name}[${e.entity_type}]`).join(', ')}`);
  console.log(`[smoke] merge suggestions: ${JSON.stringify(merges)}`);

  console.log('[smoke] counts:');
  for (const t of ['kb_sources', 'kb_entities', 'kb_entity_aliases', 'kb_relations', 'kb_knowledge_items', 'kb_timex', 'kb_chunks']) {
    console.log(`  ${t}: ${tableCount(db, t)}`);
  }
  console.log('[smoke] sample relations:');
  for (const r of db.prepare(
    `SELECT s.canonical_name AS subj, r.predicate, o.canonical_name AS obj, r.confidence
     FROM kb_relations r
     JOIN kb_entities s ON s.id = r.subject_id
     JOIN kb_entities o ON o.id = r.object_id LIMIT 10`
  ).all()) {
    console.log(`  ${r.subj} --${r.predicate}--> ${r.obj} (${r.confidence})`);
  }
  console.log('[smoke] sample timex:');
  for (const t of db.prepare('SELECT raw_text, value_start, precision FROM kb_timex').all()) {
    console.log(`  "${t.raw_text}" -> ${t.value_start} [${t.precision}]`);
  }
  db.close();
  console.log('[smoke] DONE');
}

main().catch((e) => {
  console.error('[smoke] fatal:', e);
  process.exit(1);
});
