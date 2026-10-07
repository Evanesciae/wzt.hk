// scripts/kb/run.mjs — offline queue runner.
// Usage: node scripts/kb/run.mjs --db /path/to/kb.db [--model glm-5.3-flash] [--limit 10]
//
// 1. Enqueues a pending 'extract' job for every kb_sources row without a
//    completed job at the current processor version.
// 2. Processes pending jobs one by one (extract.mjs), updating kb_jobs.
// 3. Runs stage 6 (merge suggestions) over all entities at the end.
import { openDb, newId, nowIso, tableCount } from './lib/db.mjs';
import { extractSource, MODEL_DEFAULT } from './extract.mjs';
import { glmJson } from './lib/glm.mjs';
import { PROCESSOR_VERSION, stage6MergeSuggestions } from './lib/prompts.mjs';
import { validateStage6 } from './lib/validate.mjs';

function parseArgs() {
  const args = { db: null, model: MODEL_DEFAULT, limit: 10 };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--db') args.db = argv[++i];
    else if (argv[i] === '--model') args.model = argv[++i];
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]);
  }
  if (!args.db) {
    console.error('missing --db /path/to/kb.db');
    process.exit(1);
  }
  return args;
}

function enqueue(db) {
  const sources = db.prepare(
    `SELECT s.* FROM kb_sources s
     LEFT JOIN kb_jobs j ON j.source_type = s.source_type
       AND j.source_id = s.source_id
       AND j.job_type = 'extract'
       AND j.status = 'completed'
       AND j.processor_version = ?
     WHERE j.id IS NULL`
  ).all(PROCESSOR_VERSION);
  const ins = db.prepare(
    `INSERT INTO kb_jobs
     (id, job_type, source_type, source_id, stage, status, attempt, processor_version, created_at, updated_at)
     VALUES (?, 'extract', ?, ?, 'extract', 'pending', 0, ?, ?, ?)`
  );
  let n = 0;
  for (const s of sources) {
    ins.run(newId('job'), s.source_type, s.source_id, PROCESSOR_VERSION, nowIso(), nowIso());
    n++;
  }
  return n;
}

async function processJobs(db, { model, limit }) {
  const upd = db.prepare('UPDATE kb_jobs SET status = ?, attempt = ?, last_error = ?, updated_at = ? WHERE id = ?');
  let done = 0, failed = 0;
  for (;;) {
    const job = db.prepare(
      `SELECT * FROM kb_jobs WHERE job_type = 'extract' AND status = 'pending' ORDER BY created_at LIMIT 1`
    ).get();
    if (!job || done + failed >= limit) break;
    upd.run('processing', job.attempt + 1, null, nowIso(), job.id);
    const source = db.prepare(
      'SELECT * FROM kb_sources WHERE source_type = ? AND source_id = ?'
    ).get(job.source_type, job.source_id);
    if (!source) {
      upd.run('failed', job.attempt + 1, 'source row missing', nowIso(), job.id);
      failed++;
      continue;
    }
    try {
      const stats = await extractSource(db, source, { model });
      upd.run('completed', job.attempt + 1, null, nowIso(), job.id);
      done++;
      console.log(`  completed ${job.source_type}/${job.source_id}`, JSON.stringify(stats));
    } catch (e) {
      upd.run('failed', job.attempt + 1, String(e).slice(0, 500), nowIso(), job.id);
      failed++;
      console.error(`  FAILED ${job.source_type}/${job.source_id}: ${String(e).slice(0, 200)}`);
    }
  }
  return { done, failed };
}

async function stage6(db, model) {
  const entities = db.prepare('SELECT id, canonical_name, entity_type FROM kb_entities').all();
  if (entities.length < 2) return 0;
  const { parsed } = await glmJson({ model, ...stage6MergeSuggestions(entities) });
  const suggestions = validateStage6(parsed);
  const ins = db.prepare(
    `INSERT INTO kb_knowledge_items
     (id, source_type, source_id, item_type, payload, confidence, model, processor_version, created_at)
     VALUES (?, 'system', 'entity-resolution', 'merge_suggestion', ?, ?, ?, ?, ?)`
  );
  for (const s of suggestions) {
    ins.run(newId('kbi'), JSON.stringify(s), s.confidence, model, PROCESSOR_VERSION, nowIso());
  }
  return suggestions.length;
}

async function main() {
  const { db: dbPath, model, limit } = parseArgs();
  const db = openDb(dbPath);
  console.log(`[kb] enqueueing (model=${model}, processor=${PROCESSOR_VERSION})…`);
  const enqueued = enqueue(db);
  console.log(`[kb] enqueued ${enqueued} job(s)`);
  const { done, failed } = await processJobs(db, { model, limit });
  console.log(`[kb] extract done: ${done} completed, ${failed} failed`);
  const merges = await stage6(db, model).catch((e) => {
    console.error('[kb] stage6 failed:', String(e).slice(0, 200));
    return 0;
  });
  console.log(`[kb] merge suggestions: ${merges}`);
  for (const t of ['kb_entities', 'kb_entity_aliases', 'kb_relations', 'kb_knowledge_items', 'kb_timex', 'kb_chunks']) {
    console.log(`[kb] ${t}: ${tableCount(db, t)}`);
  }
  db.close();
}

main().catch((e) => {
  console.error('[kb] fatal:', e);
  process.exit(1);
});
