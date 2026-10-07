// scripts/kb/lib/prompts.mjs — 6-stage extraction prompts (processor_version: extract-v1).
// All prompts ask for JSON only. Content is primarily Chinese (user's notes).

export const PROCESSOR_VERSION = 'extract-v1';

const JSON_ONLY = '只输出 JSON，不要解释，不要 markdown 代码块。';

export function stage1Entities(rawText) {
  return {
    system: `你是知识库实体抽取器。从文本中抽取出值得长期记录的实体。${JSON_ONLY}`,
    user: `文本：\n${rawText}\n\n输出 JSON：{"entities":[{"name":"实体原名","type":"place|person|device|org|event|project|tag|other","aliases":["别名1"],"note":"一句话说明"}]}。\n规则：地点精确到具体名称（如"台北松山机场"而非"机场"）；设备写全称（如"Nikon Z8"）；只抽取文本中明确提到的实体，不要臆造。`,
  };
}

export function stage2Timex(rawText) {
  return {
    system: `你是时间表达式抽取器。${JSON_ONLY}`,
    user: `文本：\n${rawText}\n\n输出 JSON：{"times":[{"raw":"原文写法","value_start":"ISO 8601 或 null","value_end":"ISO 8601 或 null","precision":"datetime|day|month|year|range|approximate","timezone":"如 Asia/Taipei 或 null"}]}。\n规则：无法确定的日期填 null 且 precision 用 approximate，绝不编造；"10月初"→ precision=approximate；区间用 value_start/value_end + precision=range。`,
  };
}

export function stage3Relations(rawText, entityNames) {
  return {
    system: `你是关系抽取器。只抽取文本明确支持的关系。${JSON_ONLY}`,
    user: `文本：\n${rawText}\n\n已知实体：${entityNames.join('、')}\n\n输出 JSON：{"relations":[{"subject":"实体名","predicate":"visits|occurred_at|captured_with|produced|tagged_with|references|belongs_to|used_in|contains","object":"实体名","confidence":0.0-1.0}]}。\n规则：subject/object 必须是已知实体中的原名；不确定的关系不要输出；confidence 低于 0.6 的不要输出。`,
  };
}

export function stage4Tags(rawText) {
  return {
    system: `你是内容标签生成器。${JSON_ONLY}`,
    user: `文本：\n${rawText}\n\n输出 JSON：{"tags":["标签1","标签2"]}。\n规则：3-8 个标签，中文为主，覆盖主题/场景/地点/设备；不要过于宽泛（如"旅行"），要具体（如"台北日落"、"飞机摄影"）。`,
  };
}

export function stage5Summary(rawText) {
  return {
    system: `你是知识库摘要生成器，输出供 RAG 检索用的事实清单风格摘要。${JSON_ONLY}`,
    user: `文本：\n${rawText}\n\n输出 JSON：{"summary":"200-400字结构化摘要，分点列出关键事实（时间、地点、人物、设备、事件），不要文学性改写","key_facts":["事实1","事实2"]}。\n规则：只写文本中有的事实，不扩写不推断；key_facts 每条一句话。`,
  };
}

export function stage6MergeSuggestions(entityList) {
  return {
    system: `你是实体融合助手，找出可能是同一实体的候选对。${JSON_ONLY}`,
    user: `实体列表（id: 规范名 [类型]）：\n${entityList.map((e) => `${e.id}: ${e.canonical_name} [${e.entity_type}]`).join('\n')}\n\n输出 JSON：{"merge_suggestions":[{"entity_a":"id","entity_b":"id","reason":"合并理由","confidence":0.0-1.0}]}。\n规则：只有高可信度（>=0.8）才建议；同名不同地点的不要合并；无候选则返回空数组。`,
  };
}
