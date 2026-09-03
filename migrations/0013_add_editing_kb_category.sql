-- Split general video-editing notes out of the AI-video category.
UPDATE kb_notes
SET category = 'editing'
WHERE id = 'practical-video-editing-playbook'
  AND category = 'ai-video';
