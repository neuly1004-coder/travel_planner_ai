// app/lib/filterAndRankPlaces.ts
// 우선순위별 정렬/필터 유틸 (프랜차이즈 블랙리스트는 기존과 동일하게 유지)

export type PlaceItem = {
  title: string;
  address: string;
  mapx: string; // 네이버 Local의 x (문자열)
  mapy: string; // 네이버 Local의 y (문자열)
  link: string;
  category: string;
};

export type RankMode = "distance" | "theme" | "price_low" | "price_high";

export type RankOptions = {
  regionName?: string;  // "경주" 등
  themeHint?: string;   // "역사·유적" 등
  mode?: RankMode;
};

// 간단한 블랙리스트(프랜차이즈 등) — 프로젝트에 이미 있으시면 그 파일을 사용하세요.
const brandBlacklist = [
  "스타벅스", "파스쿠찌", "이디야", "할리스", "엔젤리너스",
  "맥도날드", "버거킹", "롯데리아", "써브웨이", "KFC",
  "투썸", "빽다방", "던킨", "베스킨라빈스", "파리바게뜨",
];

// 테마 키워드
const THEME_KEYWORDS: Record<string, string[]> = {
  "역사·유적": ["사찰", "유적", "고분", "성곽", "서원", "향교", "역사", "박물관"],
  "자연·힐링": ["공원", "정원", "숲", "산책", "전망대", "해변", "호수", "온천", "계곡"],
  "액티비티": ["서핑", "카약", "승마", "패러글라이딩", "짚라인", "클라이밍", "레저"],
  "맛집투어": ["맛집", "시장", "먹거리", "분식", "노포", "현지"],
};

// 가격 휴리스틱(정확 가격이 없으므로 키워드 기반 가중치)
const CHEAP_HINTS = ["분식", "국밥", "백반", "시장", "포장마차", "김밥", "칼국수", "버거", "치킨"];
const EXP_HINTS   = ["파인다이닝", "오마카세", "코스요리", "스테이크", "와인바", "루프탑", "프렌치", "코스"];

function includesAny(text: string, arr: string[]) {
  return arr.some((kw) => text.includes(kw));
}

function isBlacklisted(title: string) {
  return includesAny(title, brandBlacklist);
}

function toNum(x?: string) {
  const n = Number(x ?? "0");
  return Number.isFinite(n) ? n : 0;
}

// 후보들의 중심점(평균)과의 거리(유클리드, 단위 무관 — 상대값만 사용)
function distanceScore(items: PlaceItem[], item: PlaceItem) {
  if (!items.length) return 0;
  const cx = items.reduce((s, v) => s + toNum(v.mapx), 0) / items.length;
  const cy = items.reduce((s, v) => s + toNum(v.mapy), 0) / items.length;
  const dx = toNum(item.mapx) - cx;
  const dy = toNum(item.mapy) - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) + 1;
  // 거리가 짧을수록 높은 점수(0~50)
  const score = 50 / dist; // 상대적
  return Math.max(0, Math.min(50, score));
}

function themeScore(item: PlaceItem, hint?: string) {
  if (!hint) return 0;
  const text = `${item.title} ${item.address} ${item.category}`;
  const keys = THEME_KEYWORDS[hint] ?? [];
  return includesAny(text, keys) ? 40 : 0; // 매칭되면 +40
}

function priceScore(item: PlaceItem, mode: RankMode) {
  const text = `${item.title} ${item.address} ${item.category}`;
  if (mode === "price_low") {
    return includesAny(text, CHEAP_HINTS) ? 30 : 0;
  }
  if (mode === "price_high") {
    return includesAny(text, EXP_HINTS) ? 30 : 0;
  }
  return 0;
}

export function filterAndRankPlaces(
  items: PlaceItem[],
  regionName?: string,
  options?: RankOptions
) {
  const mode = options?.mode ?? "theme";
  const themeHint = options?.themeHint;

  // 1) 기본 필터: 주소/제목에 지역명이 아예 없고, 카테고리도 너무 엇나간 경우 약하게 제외
  let filtered = items.filter((it) => !isBlacklisted(it.title));

  // 2) 스코어링
  const scored = filtered.map((it) => {
    const base = 10; // 기본 가점
    const dist = mode === "distance" ? distanceScore(items, it) : 0;
    const theme = mode === "theme" ? themeScore(it, themeHint) : themeScore(it, themeHint) * 0.5; // 다른 모드에서도 약간 반영
    const price =
      mode === "price_low" || mode === "price_high" ? priceScore(it, mode) : 0;

    // 지역명이 들어있으면 소폭 가점
    const regionBoost =
      regionName && `${it.address} ${it.title}`.includes(regionName) ? 5 : 0;

    const score = base + dist + theme + price + regionBoost;
    return { ...it, _score: score };
  });

  // 3) 정렬 (점수 desc)
  scored.sort((a, b) => (b as any)._score - (a as any)._score);

  // 4) 상위 N개만 반환 (너무 많으면 3~5개 정도만)
  const top = scored.slice(0, 5).map(({ _score, ...rest }) => rest as PlaceItem);
  return top;
}
