INSERT OR IGNORE INTO airports (code, icao, name, city, country, lat, lng, timezone) VALUES
  ('CKG', 'ZUCK', 'Chongqing Jiangbei International Airport', '重庆', '中国', 29.72, 106.6417, 'Asia/Shanghai'),
  ('PEK', 'ZBAA', 'Beijing Capital International Airport', '北京', '中国', 40.0799, 116.6031, 'Asia/Shanghai'),
  ('SHA', 'ZSSS', 'Shanghai Hongqiao International Airport', '上海', '中国', 31.1979, 121.3363, 'Asia/Shanghai');

INSERT INTO flights (
  id, date, date_precision, flight_number, from_airport, to_airport,
  distance_km, note, source, created_at, updated_at
) VALUES
  ('memory-ckg-pek-outbound', '', 'unknown', '', 'CKG', 'PEK', 1465,
    '童年乘坐，仅记得重庆到北京；具体日期、航班号和机场不详，北京机场暂按首都机场推定。', 'memory', datetime('now'), datetime('now')),
  ('memory-pek-ckg-return', '', 'unknown', '', 'PEK', 'CKG', 1465,
    '童年乘坐，仅记得北京返回重庆；具体日期、航班号和机场不详，北京机场暂按首都机场推定。', 'memory', datetime('now'), datetime('now')),
  ('memory-ckg-sha-outbound', '', 'unknown', '', 'CKG', 'SHA', 1417,
    '童年乘坐，仅记得重庆到上海；具体日期、航班号和机场不详，上海机场暂按虹桥机场推定。', 'memory', datetime('now'), datetime('now')),
  ('memory-sha-ckg-return', '', 'unknown', '', 'SHA', 'CKG', 1417,
    '童年乘坐，仅记得上海返回重庆；具体日期、航班号和机场不详，上海机场暂按虹桥机场推定。', 'memory', datetime('now'), datetime('now'))
ON CONFLICT(id) DO NOTHING;
