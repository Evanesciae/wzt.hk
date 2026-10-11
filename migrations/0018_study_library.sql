CREATE TABLE study_folders (id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES ntu_courses(id),parent_id TEXT REFERENCES study_folders(id),name TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE UNIQUE INDEX study_folder_name ON study_folders(course_id,ifnull(parent_id,''),name);
ALTER TABLE study_sources ADD COLUMN folder_id TEXT REFERENCES study_folders(id);
ALTER TABLE study_sources ADD COLUMN origin TEXT NOT NULL DEFAULT 'ntulearn';
CREATE INDEX study_sources_folder ON study_sources(course_id,folder_id);
CREATE UNIQUE INDEX study_upload_name ON study_sources(course_id,ifnull(folder_id,''),title) WHERE origin='upload';
INSERT INTO study_folders(id,course_id,parent_id,name,created_at)
SELECT 'default:'||c.id||':'||t.slug,c.id,NULL,t.name,strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM ntu_courses c CROSS JOIN (SELECT 'materials' slug,'课件' name UNION ALL SELECT 'assignments','作业' UNION ALL SELECT 'references','参考资料') t
WHERE c.id IN (SELECT course_id FROM study_sources UNION SELECT j.value FROM ntu_settings n,json_each(n.config,'$.courseIds') j);
UPDATE study_sources SET folder_id='default:'||course_id||CASE WHEN kind='assignment' THEN ':assignments' ELSE ':materials' END
WHERE EXISTS(SELECT 1 FROM study_folders f WHERE f.id='default:'||study_sources.course_id||CASE WHEN study_sources.kind='assignment' THEN ':assignments' ELSE ':materials' END);
