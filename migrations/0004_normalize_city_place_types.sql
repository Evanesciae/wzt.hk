UPDATE city_places
SET type = '山野自然', updated_at = CURRENT_TIMESTAMP
WHERE type = '山野';

UPDATE city_places
SET type = '文化艺术', updated_at = CURRENT_TIMESTAMP
WHERE type = '文化区';
