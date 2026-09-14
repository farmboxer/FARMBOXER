type PrefixRule = {
  prefix: string;
  iso2: string;
  nameZh: string;
  nameEn: string;
};

/** 按前缀从长到短匹配，覆盖农机出口常见市场。 */
const RULES: PrefixRule[] = [
  { prefix: "255", iso2: "TZ", nameZh: "坦桑尼亚", nameEn: "Tanzania" },
  { prefix: "256", iso2: "UG", nameZh: "乌干达", nameEn: "Uganda" },
  { prefix: "254", iso2: "KE", nameZh: "肯尼亚", nameEn: "Kenya" },
  { prefix: "251", iso2: "ET", nameZh: "埃塞俄比亚", nameEn: "Ethiopia" },
  { prefix: "250", iso2: "RW", nameZh: "卢旺达", nameEn: "Rwanda" },
  { prefix: "234", iso2: "NG", nameZh: "尼日利亚", nameEn: "Nigeria" },
  { prefix: "233", iso2: "GH", nameZh: "加纳", nameEn: "Ghana" },
  { prefix: "212", iso2: "MA", nameZh: "摩洛哥", nameEn: "Morocco" },
  { prefix: "27", iso2: "ZA", nameZh: "南非", nameEn: "South Africa" },
  { prefix: "20", iso2: "EG", nameZh: "埃及", nameEn: "Egypt" },
  { prefix: "91", iso2: "IN", nameZh: "印度", nameEn: "India" },
  { prefix: "62", iso2: "ID", nameZh: "印度尼西亚", nameEn: "Indonesia" },
  { prefix: "84", iso2: "VN", nameZh: "越南", nameEn: "Vietnam" },
  { prefix: "66", iso2: "TH", nameZh: "泰国", nameEn: "Thailand" },
  { prefix: "63", iso2: "PH", nameZh: "菲律宾", nameEn: "Philippines" },
  { prefix: "92", iso2: "PK", nameZh: "巴基斯坦", nameEn: "Pakistan" },
  { prefix: "880", iso2: "BD", nameZh: "孟加拉国", nameEn: "Bangladesh" },
  { prefix: "55", iso2: "BR", nameZh: "巴西", nameEn: "Brazil" },
  { prefix: "52", iso2: "MX", nameZh: "墨西哥", nameEn: "Mexico" },
  { prefix: "57", iso2: "CO", nameZh: "哥伦比亚", nameEn: "Colombia" },
  { prefix: "51", iso2: "PE", nameZh: "秘鲁", nameEn: "Peru" },
  { prefix: "86", iso2: "CN", nameZh: "中国", nameEn: "China" },
  { prefix: "81", iso2: "JP", nameZh: "日本", nameEn: "Japan" },
  { prefix: "82", iso2: "KR", nameZh: "韩国", nameEn: "South Korea" },
  { prefix: "44", iso2: "GB", nameZh: "英国", nameEn: "United Kingdom" },
  { prefix: "49", iso2: "DE", nameZh: "德国", nameEn: "Germany" },
  { prefix: "33", iso2: "FR", nameZh: "法国", nameEn: "France" },
  { prefix: "39", iso2: "IT", nameZh: "意大利", nameEn: "Italy" },
  { prefix: "34", iso2: "ES", nameZh: "西班牙", nameEn: "Spain" },
  { prefix: "7", iso2: "RU", nameZh: "俄罗斯", nameEn: "Russia" },
  { prefix: "1", iso2: "US", nameZh: "美国/加拿大", nameEn: "US/Canada" },
].sort((a, b) => b.prefix.length - a.prefix.length);

export type CountryHit = {
  iso2: string;
  nameZh: string;
  nameEn: string;
  dialPrefix: string;
};

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function detectCountryFromPhone(phone: string): CountryHit | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  for (const rule of RULES) {
    if (digits.startsWith(rule.prefix)) {
      return {
        iso2: rule.iso2,
        nameZh: rule.nameZh,
        nameEn: rule.nameEn,
        dialPrefix: rule.prefix,
      };
    }
  }
  return null;
}

export function countryLabel(hit: CountryHit | null): string {
  if (!hit) return "未知";
  return `${hit.nameZh} (${hit.iso2})`;
}
