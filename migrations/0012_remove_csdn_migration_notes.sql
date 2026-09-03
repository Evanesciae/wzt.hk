-- Remove the migration footer from CSDN-imported knowledge-base articles.
UPDATE kb_notes
SET body = rtrim(substr(
  body,
  1,
  instr(body, char(10) || char(10) || '---' || char(10) || char(10) || '> 从 [CSDN 原文](') - 1
))
WHERE instr(body, char(10) || char(10) || '---' || char(10) || char(10) || '> 从 [CSDN 原文](') > 0;

