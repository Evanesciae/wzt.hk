// scripts/kb/extract.mjs — run the 6-stage GLM extraction for one kb_sources row.
// Writes kb_entities / aliases / relations / knowledge_items / timex / chunks.
import { glmJson } from './lib/glm.mjs';
import { newId, nowIso } from './lib/db.mjs';
import {
  PROCESSOR_VERSION,
  stage1Entities, stage2Timex, stage3Relations, stage4Tags, stage5Summary,
} from './lib/prompts.mjs';
import {
  validateStage1, validateStage2, validateStage3, validateStage4, validateStage5,
} from './lib/validate.mjs';

export const MODEL_DEFAULT = 'glm-5.3-flash';

function normAlias(s) {
  return s.toLowerCase().replace(/[\s\u3000]+/g, '').trim();
}

function knowledgeItem(db, { source, itemType, payload, sourceText, confidence, model }) {
  db.prepare(
    `INSERT INTO kb_knowledge_items
     (id, source_type, source_id, source_text, item_type, payload, confidence, model, processor_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    newId('kbi'), source.source_type, source.source_id,
    sourceText ?? null, itemType, JSON.stringify(payload),
    confidence ?? null, model, PROCESSOR_VERSION, nowIso(),
  );
}

/** Find entity by alias norm, or create it. Returns entity id. */
function findOrCreateEntity(db, { name, type, note, model }) {
  const norm = normAlias(name);
  const hit = db.prepare('SELECT entity_id FROM kb_entity_aliases WHERE alias_norm = ?').get(norm);
  if (hit) return { id: hit.entity_id, created: false };
  const id = newId('ent');
  const now = nowIso();
  db.prepare(
    `INSERT INTO kb_entities (id, entity_type, canonical_name, metadata, needs_review, created_at, updated_at)
     VALUES (?, ?, ?, '{}', 0, ?, ?)`
  ).run(id, type, name, now, now);
  db.prepare(
    `INSERT INTO kb_entity_aliases (id, entity_id, alias, alias_norm, source, created_at)
     VALUES (?, ?, ?, ?, 'ai', ?)`
  ).run(newId('als'), id, name, norm, now);
  return { id, created: true };
}

function addAlias(db, entityId, alias) {
  const norm = normAlias(alias);
  const exists = db.prepare('SELECT 1 FROM kb_entity_aliases WHERE alias_norm = ?').get(norm);
  if (exists) return;
  db.prepare(
    `INSERT INTO kb_entity_aliases (id, entity_id, alias, alias_norm, source, created_at)
     VALUES (?, ?, ?, ?, 'ai', ?)`
  ).run(newId('als'), entityId, alias, norm, nowIso());
}

function resolveEntityId(db, name) {
  const hit = db.prepare('SELECT entity_id FROM kb_entity_aliases WHERE alias_norm = ?').get(normAlias(name));
  return hit?.entity_id ?? null;
}

export async function extractSource(db, source, { model = MODEL_DEFAULT } = {}) {
  const raw = source.raw_text;
  const stats = { entities: 0, aliases: 0, timex: 0, relations: 0, relationsSkipped: 0, tags: 0, chunks: 0 };

  // Stage 1 — entities
  const s1 = await glmJson({ model, ...stage1Entities(raw) });
  const entities = validateStage1(s1.parsed);
  const entityIds = new Map(); // name -> id
  for (const e of entities) {
    const { id } = findOrCreateEntity(db, { name: e.name, type: e.type, note: e.note, model });
    entityIds.set(e.name, id);
    stats.entities++;
    for (const a of e.aliases ?? []) {
      if (normAlias(a) && normAlias(a) !== normAlias(e.name)) {
        addAlias(db, id, a);
        stats.aliases++;
      }
    }
    knowledgeItem(db, { source, itemType: 'entity_mention', payload: { ...e, entity_id: id }, model });
  }

  // Stage 2 — time expressions
  const s2 = await glmJson({ model, ...stage2Timex(raw) });
  const times = validateStage2(s2.parsed);
  const insTimex = db.prepare(
    `INSERT INTO kb_timex
     (id, source_type, source_id, value_start, value_end, precision, timezone, raw_text, confidence, model, processor_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of times) {
    insTimex.run(
      newId('tmx'), source.source_type, source.source_id,
      t.value_start ?? null, t.value_end ?? null, t.precision,
      t.timezone ?? null, t.raw, t.confidence ?? null,
      model, PROCESSOR_VERSION, nowIso(),
    );
    stats.timex++;
  }

  // Stage 3 — relations
  const s3 = await glmJson({ model, ...stage3Relations(raw, entities.map((e) => e.name)) });
  const relations = validateStage3(s3.parsed);
  const insRel = db.prepare(
    `INSERT INTO kb_relations
     (id, subject_id, predicate, object_id, source_type, source_id, confidence, model, processor_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const r of relations) {
    const sid = entityIds.get(r.subject) ?? resolveEntityId(db, r.subject);
    const oid = entityIds.get(r.object) ?? resolveEntityId(db, r.object);
    if (!sid || !oid) {
      stats.relationsSkipped++;
      knowledgeItem(db, {
        source, itemType: 'relation_unresolved',
        payload: r, model, confidence: r.confidence ?? null,
      });
      continue;
    }
    insRel.run(
      newId('rel'), sid, r.predicate, oid,
      source.source_type, source.source_id, r.confidence ?? null,
      model, PROCESSOR_VERSION, nowIso(),
    );
    stats.relations++;
  }

  // Stage 4 — tags
  const s4 = await glmJson({ model, ...stage4Tags(raw) });
  const tags = validateStage4(s4.parsed);
  for (const tag of tags) {
    const { id } = findOrCreateEntity(db, { name: tag, type: 'tag', model });
    knowledgeItem(db, { source, itemType: 'tag_suggestion', payload: { tag, entity_id: id }, model });
    stats.tags++;
  }

  // Stage 5 — summary chunk
  const s5 = await glmJson({ model, ...stage5Summary(raw) });
  const summary = validateStage5(s5.parsed);
  db.prepare(
    `INSERT INTO kb_chunks
     (id, source_type, source_id, chunk_type, text, entity_ids, model, processor_version, created_at)
     VALUES (?, ?, ?, 'summary', ?, ?, ?, ?, ?)`
  ).run(
    newId('chk'), source.source_type, source.source_id,
    summary.summary, JSON.stringify([...entityIds.values()]),
    model, PROCESSOR_VERSION, nowIso(),
  );
  stats.chunks++;
  knowledgeItem(db, { source, itemType: 'summary', payload: summary, model });

  return stats;
}
