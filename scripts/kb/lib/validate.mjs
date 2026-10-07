// scripts/kb/lib/validate.mjs — shape validation for each extraction stage.
// Throws on invalid shape; never silently drops fields.

const ENTITY_TYPES = new Set(['place', 'person', 'device', 'org', 'event', 'project', 'tag', 'other']);
const PRECISIONS = new Set(['datetime', 'day', 'month', 'year', 'range', 'approximate']);
const PREDICATES = new Set([
  'contains', 'visits', 'occurred_at', 'captured_with', 'produced',
  'tagged_with', 'references', 'belongs_to', 'used_in',
]);

function assert(cond, msg) {
  if (!cond) throw new Error(`validate: ${msg}`);
}

export function validateStage1(out) {
  assert(out && Array.isArray(out.entities), 'stage1.entities must be an array');
  for (const e of out.entities) {
    assert(typeof e.name === 'string' && e.name.trim(), 'entity.name required');
    assert(ENTITY_TYPES.has(e.type), `unknown entity type: ${e.type}`);
    if (e.aliases !== undefined) assert(Array.isArray(e.aliases), 'entity.aliases must be array');
  }
  return out.entities;
}

export function validateStage2(out) {
  assert(out && Array.isArray(out.times), 'stage2.times must be an array');
  for (const t of out.times) {
    assert(typeof t.raw === 'string' && t.raw.trim(), 'timex.raw required');
    assert(PRECISIONS.has(t.precision), `unknown precision: ${t.precision}`);
  }
  return out.times;
}

export function validateStage3(out) {
  assert(out && Array.isArray(out.relations), 'stage3.relations must be an array');
  for (const r of out.relations) {
    assert(typeof r.subject === 'string' && r.subject.trim(), 'relation.subject required');
    assert(typeof r.object === 'string' && r.object.trim(), 'relation.object required');
    assert(PREDICATES.has(r.predicate), `unknown predicate: ${r.predicate}`);
    if (r.confidence !== undefined) {
      assert(typeof r.confidence === 'number' && r.confidence >= 0 && r.confidence <= 1, 'confidence must be 0-1');
    }
  }
  return out.relations;
}

export function validateStage4(out) {
  assert(out && Array.isArray(out.tags), 'stage4.tags must be an array');
  return out.tags.filter((t) => typeof t === 'string' && t.trim()).slice(0, 12);
}

export function validateStage5(out) {
  assert(out && typeof out.summary === 'string' && out.summary.trim(), 'stage5.summary required');
  assert(!out.key_facts || Array.isArray(out.key_facts), 'stage5.key_facts must be array');
  return out;
}

export function validateStage6(out) {
  assert(out && Array.isArray(out.merge_suggestions), 'stage6.merge_suggestions must be an array');
  return out.merge_suggestions.filter((s) => typeof s.confidence === 'number' && s.confidence >= 0.8);
}
