import type { Airport } from './types';

export const seedAirports: Airport[] = [
  { code: 'HKG', icao: 'VHHH', name: 'Hong Kong International Airport', city: '香港', country: '中国香港', lat: 22.308, lng: 113.9185, timezone: 'Asia/Hong_Kong' },
  { code: 'TPE', icao: 'RCTP', name: 'Taiwan Taoyuan International Airport', city: '台北', country: '中国台湾', lat: 25.0797, lng: 121.2342, timezone: 'Asia/Taipei' },
  { code: 'TSA', icao: 'RCSS', name: 'Taipei Songshan Airport', city: '台北', country: '中国台湾', lat: 25.0694, lng: 121.5525, timezone: 'Asia/Taipei' },
  { code: 'KHH', icao: 'RCKH', name: 'Kaohsiung International Airport', city: '高雄', country: '中国台湾', lat: 22.5771, lng: 120.3500, timezone: 'Asia/Taipei' },
  { code: 'RMQ', icao: 'RCMQ', name: 'Taichung International Airport', city: '台中', country: '中国台湾', lat: 24.2647, lng: 120.6206, timezone: 'Asia/Taipei' },
  { code: 'NRT', icao: 'RJAA', name: 'Narita International Airport', city: '东京', country: '日本', lat: 35.7720, lng: 140.3929, timezone: 'Asia/Tokyo' },
  { code: 'HND', icao: 'RJTT', name: 'Haneda Airport', city: '东京', country: '日本', lat: 35.5494, lng: 139.7798, timezone: 'Asia/Tokyo' },
  { code: 'KIX', icao: 'RJBB', name: 'Kansai International Airport', city: '大阪', country: '日本', lat: 34.4347, lng: 135.2441, timezone: 'Asia/Tokyo' },
  { code: 'ICN', icao: 'RKSI', name: 'Incheon International Airport', city: '首尔', country: '韩国', lat: 37.4602, lng: 126.4407, timezone: 'Asia/Seoul' },
  { code: 'GMP', icao: 'RKSS', name: 'Gimpo International Airport', city: '首尔', country: '韩国', lat: 37.5583, lng: 126.7906, timezone: 'Asia/Seoul' },
  { code: 'SIN', icao: 'WSSS', name: 'Singapore Changi Airport', city: '新加坡', country: '新加坡', lat: 1.3644, lng: 103.9915, timezone: 'Asia/Singapore' },
  { code: 'BKK', icao: 'VTBS', name: 'Suvarnabhumi Airport', city: '曼谷', country: '泰国', lat: 13.6900, lng: 100.7501, timezone: 'Asia/Bangkok' },
  { code: 'PVG', icao: 'ZSPD', name: 'Shanghai Pudong International Airport', city: '上海', country: '中国', lat: 31.1443, lng: 121.8083, timezone: 'Asia/Shanghai' },
  { code: 'SHA', icao: 'ZSSS', name: 'Shanghai Hongqiao International Airport', city: '上海', country: '中国', lat: 31.1979, lng: 121.3363, timezone: 'Asia/Shanghai' },
  { code: 'PEK', icao: 'ZBAA', name: 'Beijing Capital International Airport', city: '北京', country: '中国', lat: 40.0799, lng: 116.6031, timezone: 'Asia/Shanghai' },
  { code: 'PKX', icao: 'ZBAD', name: 'Beijing Daxing International Airport', city: '北京', country: '中国', lat: 39.5098, lng: 116.4105, timezone: 'Asia/Shanghai' },
  { code: 'CAN', icao: 'ZGGG', name: 'Guangzhou Baiyun International Airport', city: '广州', country: '中国', lat: 23.3924, lng: 113.2988, timezone: 'Asia/Shanghai' },
  { code: 'SZX', icao: 'ZGSZ', name: 'Shenzhen Baoan International Airport', city: '深圳', country: '中国', lat: 22.6393, lng: 113.8107, timezone: 'Asia/Shanghai' },
  { code: 'CTU', icao: 'ZUUU', name: 'Chengdu Shuangliu International Airport', city: '成都', country: '中国', lat: 30.5783, lng: 103.9469, timezone: 'Asia/Shanghai' },
  { code: 'TFU', icao: 'ZUTF', name: 'Chengdu Tianfu International Airport', city: '成都', country: '中国', lat: 30.3190, lng: 104.4450, timezone: 'Asia/Shanghai' },
  { code: 'PNH', icao: 'VDPP', name: 'Phnom Penh International Airport', city: '金边', country: '柬埔寨', lat: 11.5466, lng: 104.8441, timezone: 'Asia/Phnom_Penh' },
  { code: 'KTI', icao: 'VDTI', name: 'Techo International Airport', city: '金边', country: '柬埔寨', lat: 11.3629, lng: 104.9166, timezone: 'Asia/Phnom_Penh' },
  { code: 'CTS', icao: 'RJCC', name: 'New Chitose Airport', city: '札幌', country: '日本', lat: 42.7752, lng: 141.6923, timezone: 'Asia/Tokyo' },
  { code: 'LJG', icao: 'ZPLJ', name: 'Lijiang Sanyi Airport', city: '丽江', country: '中国', lat: 26.6786, lng: 100.2469, timezone: 'Asia/Shanghai' },
  { code: 'CKG', icao: 'ZUCK', name: 'Chongqing Jiangbei International Airport', city: '重庆', country: '中国', lat: 29.7200, lng: 106.6417, timezone: 'Asia/Shanghai' },
  { code: 'SYX', icao: 'ZJSY', name: 'Sanya Phoenix International Airport', city: '三亚', country: '中国', lat: 18.3029, lng: 109.4123, timezone: 'Asia/Shanghai' },
  { code: 'HAK', icao: 'ZJHK', name: 'Haikou Meilan International Airport', city: '海口', country: '中国', lat: 19.9349, lng: 110.4589, timezone: 'Asia/Shanghai' },
  { code: 'LZO', icao: 'ZULZ', name: 'Luzhou Yunlong Airport', city: '泸州', country: '中国', lat: 29.0300, lng: 105.4680, timezone: 'Asia/Shanghai' },
  { code: 'TAO', icao: 'ZSQD', name: 'Qingdao Jiaodong International Airport', city: '青岛', country: '中国', lat: 36.3619, lng: 120.0883, timezone: 'Asia/Shanghai' },
  { code: 'DLU', icao: 'ZPDL', name: 'Dali Fengyi Airport', city: '大理', country: '中国', lat: 25.6494, lng: 100.3194, timezone: 'Asia/Shanghai' },
  { code: 'NKG', icao: 'ZSNJ', name: 'Nanjing Lukou International Airport', city: '南京', country: '中国', lat: 31.7420, lng: 118.8620, timezone: 'Asia/Shanghai' },
  { code: 'NGB', icao: 'ZSNB', name: 'Ningbo Lishe International Airport', city: '宁波', country: '中国', lat: 29.8267, lng: 121.4619, timezone: 'Asia/Shanghai' },
  { code: 'HGH', icao: 'ZSHC', name: 'Hangzhou Xiaoshan International Airport', city: '杭州', country: '中国', lat: 30.2361, lng: 120.4320, timezone: 'Asia/Shanghai' },
  { code: 'YBP', icao: 'ZUYB', name: 'Yibin Wuliangye Airport', city: '宜宾', country: '中国', lat: 28.8584, lng: 104.5260, timezone: 'Asia/Shanghai' },
  { code: 'ZUH', icao: 'ZGSD', name: 'Zhuhai Jinwan Airport', city: '珠海', country: '中国', lat: 22.0064, lng: 113.3760, timezone: 'Asia/Shanghai' },
];

export function fallbackAirport(code: string): Airport {
  const normalized = code.trim().toUpperCase();
  return { code: normalized, name: normalized, city: normalized, country: '', lat: 0, lng: 0 };
}
