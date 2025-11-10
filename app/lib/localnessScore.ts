// lib/localnessScore.ts
/**
 * 지역 특색(Localness) 점수를 계산하는 함수입니다.
 * - 프랜차이즈일수록 감점
 * - 지역 단어(예: 부산, 경주, 속초 등) 또는 전통/노포/시장 관련 단어가 있을수록 가산점
 */

import { isLikelyFranchise, franchiseScore } from "./brandBlacklist";

// 지역 관련 키워드 (도시명, 지역명, 전통시장, 토박이 표현 등)
const LOCAL_KEYWORDS = [
  "시장", "전통", "노포", "토박이", "로컬", "향토", "가맥", "골목",
  "분식집", "식당", "포장마차", "재래시장", "국밥", "순대국", "칼국수",
  "비빔밥", "막국수", "회센터", "횟집", "정식", "한정식", "오미자", "황태", "메밀",
  "속초", "강릉", "경주", "전주", "여수", "통영", "부산", "춘천", "제주", "인천",
  "광주", "대구", "대전", "청주", "안동", "공주", "포항", "군산"
];

// 점수 계산
export function localnessScore(placeName: string, regionName?: string): number {
  let score = 0;
  const name = placeName.toLowerCase();

  // ① 지역 단어 포함 시 가산점
  LOCAL_KEYWORDS.forEach(k => {
    if (name.includes(k)) score += 2;
  });

  // ② 현재 검색 지역 이름이 포함되면 추가 가산점
  if (regionName && name.includes(regionName.toLowerCase())) {
    score += 3;
  }

  // ③ 프랜차이즈 점수(감점)
  if (isLikelyFranchise(placeName)) {
    score -= 5; // 프랜차이즈일 경우 큰 감점
  } else {
    // 프랜차이즈 점수가 낮을수록 약한 가산점
    const fScore = franchiseScore(placeName);
    if (fScore <= 1) score += 1;
  }

  return score;
}
