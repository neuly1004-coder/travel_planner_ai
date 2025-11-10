// app/api/plan/route.ts
import { NextRequest, NextResponse } from "next/server";

/* ---------------- Types ---------------- */
type Season = "봄" | "여름" | "가을" | "겨울";

type PlanInfo = {
  region: string;
  nights?: number;
  days?: number;
  companions?: string;
  theme?: "역사" | "맛집" | "자연" | "액티비티" | "카페";
  budgetKRW?: number;
  seasonHint?: Season | null;
  avoidFoods?: string[];
};

type PlanSlot = {
  day: number;
  time: string;
  region: string;
  category:
    | "아침식사"
    | "점심식사"
    | "저녁식사"
    | "관광"
    | "카페"
    | "야간활동";
  keyword: string;
  note?: string;
};

/* ---------------- LLM: 정보 추출 ---------------- */
const SYSTEM_PROMPT_INFO = `
당신의 유일한 역할은 "사용자 여행 요구를 구조화"하는 것입니다.
아래 스키마의 단일 JSON 객체만 출력하세요:

- region: 필수. 도시/지역명(예: "경주").
- nights: 선택. "N박"이면 N.
- days: 선택. "N일"이면 N. (없으면 nights+1 로)
- companions: 선택. (예: "친구", "가족"...)
- theme: 선택. ["역사","맛집","자연","액티비티","카페"] 중 1개.
- budgetKRW: 선택. "50만원" -> 500000 처럼 원 단위 정수.
- seasonHint: 선택. ["봄","여름","가을","겨울"] 중 1개. (사용자가 계절/월을 말했을 때만)
- avoidFoods: 선택. 사용자가 "알레르기/비선호"라고 말한 음식 키워드 배열. (예: ["갑각류","땅콩","매운"])

금지:
- 장소/상호/호텔/카페 이름 생성 금지.
- 배열이 아닌 "단일 JSON"만.
`;

function extractJsonObject(text: string): PlanInfo | null {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e === -1 || e <= s) return null;
  try {
    return JSON.parse(text.slice(s, e + 1));
  } catch {
    return null;
  }
}

/* ---------------- 계절/특산 ---------------- */
function monthToSeason(m: number): Season {
  if ([3, 4, 5].includes(m)) return "봄";
  if ([6, 7, 8].includes(m)) return "여름";
  if ([9, 10, 11].includes(m)) return "가을";
  return "겨울";
}

const REGION_SEASONAL: Record<string, Partial<Record<Season, string[]>>> = {
  경주: {
    봄: ["봄나물 한정식"],
    여름: ["냉면", "물회"],
    가을: ["버섯 전골"],
    겨울: ["국밥", "수육국밥"],
  },
  부산: {
    여름: ["물회", "회센터"],
    겨울: ["돼지국밥"],
  },
  강릉: {
    여름: ["물회", "생선구이"],
    겨울: ["초당순두부"],
  },
  제주: {
    여름: ["갈치회", "해산물"],
    겨울: ["고기국수", "흑돼지"],
  },
};

/* ---------------- 일정 템플릿 ---------------- */
const FULL_DAY: Array<{ time: string; category: PlanSlot["category"] }> = [
  { time: "09:00", category: "아침식사" },
  { time: "11:00", category: "관광" },
  { time: "13:00", category: "점심식사" },
  { time: "15:00", category: "관광" },
  { time: "18:00", category: "저녁식사" },
  { time: "20:00", category: "야간활동" },
];

function dayTemplateFor(day: number, totalDays: number) {
  const isFirst = day === 1;
  const isLast = day === totalDays;
  return FULL_DAY.filter((b) => {
    if (isFirst && b.time === "09:00") return false;
    if (isLast && b.time === "20:00") return false;
    return true;
  });
}

/* ---------------- 음식/테마 ---------------- */
const BASE_CUISINES = ["한식", "해산물", "일식", "중식", "양식", "분식"] as const;
type Cuisine = (typeof BASE_CUISINES)[number];

function cuisinePool(theme?: PlanInfo["theme"]): Cuisine[] {
  switch (theme) {
    case "맛집":
      return ["한식", "해산물", "일식", "중식", "양식", "분식"];
    case "역사":
      return ["한식", "해산물", "분식", "중식", "일식", "양식"];
    case "자연":
      return ["해산물", "한식", "양식", "분식", "일식", "중식"];
    case "카페":
      return ["한식", "양식", "일식", "중식", "해산물", "분식"];
    case "액티비티":
      return ["한식", "분식", "일식", "중식", "양식", "해산물"];
    default:
      return [...BASE_CUISINES];
  }
}

type DayCuisineUsed = Record<number, Set<Cuisine>>;
type TripCuisineUsed = Set<Cuisine>;
type TripKeywordUsed = Set<string>;

function excludes(keyword: string, avoid?: string[]) {
  if (!avoid?.length) return false;
  const low = keyword.toLowerCase();
  return avoid.some((a) => low.includes(String(a).toLowerCase()));
}

function nextCuisineAvoiding(
  day: number,
  usedPerDay: DayCuisineUsed,
  usedTrip: TripCuisineUsed,
  theme: PlanInfo["theme"] | undefined,
  avoid?: string[]
): Cuisine {
  const pool = cuisinePool(theme);
  if (!usedPerDay[day]) usedPerDay[day] = new Set<Cuisine>();

  const candidates = pool.filter((c) => !usedPerDay[day].has(c));
  const sorted = [
    ...candidates.filter((c) => !usedTrip.has(c)),
    ...candidates.filter((c) => usedTrip.has(c)),
  ];
  const pick =
    sorted.find((c) => !excludes(c, avoid)) ??
    pool.find((c) => !excludes(c, avoid)) ??
    pool[0];

  usedPerDay[day].add(pick);
  usedTrip.add(pick);
  return pick;
}

/* ---------------- 지역별 아침 메뉴 ---------------- */
const REGION_BREAKFAST: Record<string, string[]> = {
  전주: ["콩나물국밥", "한식 아침식사"],
  부산: ["돼지국밥", "해장국", "한식 아침식사"],
  경주: ["한식 아침식사", "국밥", "해장국"],
  강릉: ["순두부 백반", "한식 아침식사"],
  제주: ["고기국수", "한식 아침식사"],
};

/* ---------------- 키워드 생성 ---------------- */
function mealKeyword(
  region: string,
  meal: "아침식사" | "점심식사" | "저녁식사",
  cuisine: Cuisine,
  budget?: number,
  season?: Season,
  avoid?: string[]
) {
  const price =
    typeof budget === "number"
      ? budget <= 200000
        ? " 가성비"
        : budget >= 700000
        ? " 고급"
        : ""
      : "";

  if (meal === "아침식사") {
    const pref = REGION_BREAKFAST[region] ?? [];
    const base = pref.find((k) => !excludes(k, avoid)) ?? "한식 아침식사";
    return `${base}${price}`;
  }

  // ✅ 수정 완료: 타입 안전한 계절 특산 처리
  const seasonKey = (season ?? "") as Season;
  const seasonal =
    (REGION_SEASONAL[region]?.[seasonKey] ?? []).find(
      (k: string) => !excludes(k, avoid)
    );

  if (seasonal) {
    return `${seasonal} ${meal === "점심식사" ? "점심" : "저녁"} 맛집${price}`;
  }
  return `${cuisine} ${meal === "점심식사" ? "점심" : "저녁"} 맛집${price}`;
}

function nonMealKeyword(
  category: Exclude<PlanSlot["category"], "아침식사" | "점심식사" | "저녁식사">,
  theme?: PlanInfo["theme"]
) {
  if (category === "카페") return "디저트 카페";
  if (category === "관광") {
    if (theme === "역사") return "유적지 박물관 성곽 사적지";
    if (theme === "자연") return "자연 명소 전망 포토스팟";
    if (theme === "액티비티") return "체험 액티비티 체험장";
    if (theme === "카페") return "포토 스팟";
    return "명소";
  }
  if (theme === "맛집") return "야시장 포장마차";
  if (theme === "역사") return "야간 명소";
  return "야경 명소";
}

/* ---------------- 슬롯 빌드 ---------------- */
function buildSlotsFromInfo(info: PlanInfo): PlanSlot[] {
  const region = info.region?.trim().replace(/시|군|구$/, "") || "서울";
  const days = info.days ?? (info.nights ? info.nights + 1 : 1);
  const theme = info.theme;
  const budget = info.budgetKRW;
  const avoid = info.avoidFoods ?? [];
  const season =
    info.seasonHint ?? monthToSeason(new Date().getMonth() + 1);

  const slots: PlanSlot[] = [];
  const usedPerDay: DayCuisineUsed = {};
  const usedTrip: TripCuisineUsed = new Set<Cuisine>();
  const usedKeywords: TripKeywordUsed = new Set<string>();

  for (let d = 1; d <= Math.max(1, days); d++) {
    const tmpl = dayTemplateFor(d, days);
    for (const block of tmpl) {
      if (
        block.category === "아침식사" ||
        block.category === "점심식사" ||
        block.category === "저녁식사"
      ) {
        const cuisine = nextCuisineAvoiding(d, usedPerDay, usedTrip, theme, avoid);
        let kw = mealKeyword(region, block.category, cuisine, budget, season, avoid);

        if (usedKeywords.has(kw)) kw += " 추천";
        usedKeywords.add(kw);

        slots.push({ day: d, time: block.time, region, category: block.category, keyword: kw });
      } else {
        const kw = nonMealKeyword(block.category, theme);
        slots.push({ day: d, time: block.time, region, category: block.category, keyword: kw });
      }
    }
  }
  return slots;
}

/* ---------------- API Handler ---------------- */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userMessage: string = body?.message ?? "";
  if (!userMessage) {
    return NextResponse.json({ error: "message가 필요합니다." }, { status: 400 });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error("CLAUDE_API_KEY 미설정");
    return NextResponse.json({ error: "서버 환경변수 미설정 (CLAUDE_API_KEY)" }, { status: 500 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 512,
      system: SYSTEM_PROMPT_INFO,
      messages: [{ role: "user", content: `사용자 입력: """${userMessage}"""` }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Claude API 에러:", res.status, text);
    return NextResponse.json({ error: "Claude API 호출 실패" }, { status: 500 });
  }

  const data = await res.json();
  const txt = data?.content?.[0]?.text ?? "";
  const info = extractJsonObject(txt);
  const safe: PlanInfo = info && info.region ? info : { region: "서울" };

  const slots = buildSlotsFromInfo(safe);

  return NextResponse.json({
    slots,
    meta: {
      season: safe.seasonHint ?? monthToSeason(new Date().getMonth() + 1),
      avoidFoods: safe.avoidFoods ?? [],
    },
  });
}
