UPDATE kb_notes
SET category = 'ai-video'
WHERE id = 'ai-video-character-scene-image';

INSERT OR IGNORE INTO kb_notes (
  id,
  title,
  summary,
  category,
  tags,
  body,
  created_at,
  updated_at,
  draft,
  featured,
  strict
) VALUES (
  'ai-video-multi-character-scene-replacement',
  '多人物同场景替换',
  '多人物同场景替换',
  'ai-video',
  '["AI 视频"]',
  '进入ps
选合适范围Ctrl+J
复制新建文档
画布改为默认比例（2:3 / 3:4）
导出为png

图片生成prompt：
把图1中的角色改为图2中的角色，光影和构图保持一致

进阶prompt参考：
把图片1中的角色整个去掉并改成图片2中的角色，构图姿势和图一保持一致，明天匀称灯光，色温5500K，图片2中的角色大小和图一原本大小一致，手背在后面，表情严肃，角色保持Q版，不要和原版的人进行融合',
  '2026-07-31',
  '2026-07-31',
  0,
  0,
  1
);
