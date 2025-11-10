// lib/brandBlacklist.ts
// --- ① 프랜차이즈 키워드(음절·영문 모두) ---
const FRANCHISE_KEYWORDS = [
  // 카페/디저트
  "스타벅스","starbucks","이디야","ediya","투썸","twosome","파스쿠찌","빽다방","paik",
  "던킨","dunkin","배스킨라빈스","baskin","파리바게뜨","paris baguette","뚜레쥬르","tlj",
  "설빙","공차","gongcha","탐앤탐스","toms","할리스","hollys","엔제리너스","angel-in-us",
  // 버거/치킨/피자
  "맥도날드","mcdonald","버거킹","lotteria","롯데리아","kfc","맘스터치","mom's touch",
  "쉐이크쉑","shake shack","교촌","bhc","네네치킨","굽네","처갓집","푸라닭","호식이두마리",
  "도미노","domino","피자헛","pizza hut","파파존스","papa john",
  // 한식/기타
  "본죽","본도시락","한솥","신전","죠스떡볶이","죠스","역전할머니맥주","경성주막","두찜","육수당"
].map(x => x.toLowerCase());

// --- ② 이름 정규화 ---
const norm = (s: string) =>
  s.toLowerCase()
   .replace(/\s+/g, "")
   .replace(/[^\p{L}\p{N}]/gu, "");

// --- ③ ‘지점/호점/역점’ 같은 패턴들 ---
const BRANCH_PATTERNS: RegExp[] = [
  /[가-힣a-z0-9]{1,10}점$/i,            // …점 (예: 강남점)
  /[0-9]+호점$/i,                      // 1호점, 2호점
  /(역|터미널|센터|몰|타워)[가-힣]*점$/i, // ○○역점, ○○센터점 등
  /[가-힣a-z0-9]{1,10}(본점|본사)/i,     // 본점(프차 본점도 거르고 싶으면 점수)
];

// --- ④ 프랜차이즈 점수 계산 ---
// 점수 높을수록 프랜차이즈일 가능성 ↑
export function franchiseScore(placeName: string): number {
  const raw = placeName.trim();
  const n = norm(raw);
  let score = 0;

  // 1) 키워드 매칭
  if (FRANCHISE_KEYWORDS.some(k => n.includes(norm(k)))) score += 3;

  // 2) ‘지점/호점/역점’ 형태
  if (BRANCH_PATTERNS.some(re => re.test(raw))) score += 2;

  // 3) 너무 일반적인 업종+지점 조합(예: ○○치킨 강남점)
  if (/치킨|피자|버거|도시락|분식|카페|커피/i.test(raw) && /점$|호점$/i.test(raw)) score += 1;

  // 4) 영어 대문자 단어가 2개 이상(브랜드 네이밍스러운) → 약한 근거
  const caps = (raw.match(/[A-Z]{2,}/g) || []).length;
  if (caps >= 2) score += 1;

  return score;
}

// --- ⑤ 최종 판별: 임계값 이상이면 프랜차이즈로 간주 ---
export function isLikelyFranchise(placeName: string, threshold = 3): boolean {
  return franchiseScore(placeName) >= threshold;
}
