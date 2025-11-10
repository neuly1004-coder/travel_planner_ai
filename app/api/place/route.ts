// app/api/place/route.ts
import { NextRequest, NextResponse } from "next/server";
import { filterAndRankPlaces } from "../../lib/filterAndRankPlaces";

type NaverLocalItem = {
  title: string; address: string; roadAddress: string;
  mapx: string; mapy: string; link: string; category: string;
};

function stripHtml(html: string) { return html.replace(/<[^>]+>/g, ""); }

/* ---- 거리 계산 (네이버 TM 좌표를 단순 유클리드로 근사) ---- */
function dist2(a:{x:number;y:number}, b:{x:number;y:number}) {
  const dx = a.x - b.x; const dy = a.y - b.y;
  return dx*dx + dy*dy; // 제곱거리(정렬용)
}

/* ---- 네이버 호출 ---- */
async function searchNaverLocal(q: string, display = 15) {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID!;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET!;
  const url =
    "https://openapi.naver.com/v1/search/local.json" +
    `?query=${encodeURIComponent(q)}` +
    `&display=${display}&sort=random`;

  try {
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("[NAVER LOCAL]", res.status, q, text);
      return { items: [] as NaverLocalItem[] };
    }
    return (await res.json()) as { items?: NaverLocalItem[] };
  } catch (e) {
    console.warn("[NAVER LOCAL] fetch error:", e);
    return { items: [] as NaverLocalItem[] };
  }
}

/* ---- 카테고리별 백업 쿼리 ---- */
function fallbackQueries(region: string, category?: string) {
  const base = (region ?? "").trim();
  const list: string[] = [];

  if (category?.includes("식사")) {
    list.push(
      `${base} 현지 맛집`,
      `${base} 인기 맛집`,
      `${base} 베스트 맛집`,
      `${base} 한식 맛집`,
      `${base} 해산물 맛집`,
      `${base} 음식점`
    );
  } else if (category?.includes("카페")) {
    list.push(
      `${base} 디저트 카페`,
      `${base} 분위기 좋은 카페`,
      `${base} 핫플 카페`,
      `${base} 베이커리`
    );
  } else {
    list.push(
      `${base} 관광 명소`,
      `${base} 랜드마크`,
      `${base} 볼거리`,
      `${base} 여행지`
    );
  }

  // 안전망: 지역 단독 쿼리도 마지막에 추가
  list.push(base);
  return Array.from(new Set(list));
}

/* ---- POST ----
req.body: {
  query: string,
  category?: string,
  region?: string,
  avoidFoods?: string[],
  anchor?: { x: number, y: number },
}
--------------------------------------------------- */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const rawQuery: string = body?.query ?? "";
  if (!rawQuery || typeof rawQuery !== "string") {
    return NextResponse.json({ items: [] });
  }

  const avoid: string[] = Array.isArray(body?.avoidFoods) ? body.avoidFoods : [];
  const anchor: {x:number;y:number}|null =
    body?.anchor && typeof body.anchor.x === "number" && typeof body.anchor.y === "number"
      ? { x: body.anchor.x, y: body.anchor.y }
      : null;

  const region = body?.region ?? rawQuery.split(/\s+/)[0];

  // 1) 1차 검색
  const collected: NaverLocalItem[] = [];
  const seen = new Set<string>();
  const first = await searchNaverLocal(rawQuery, 15);
  for (const it of first.items ?? []) {
    const key = `${it.link}|${stripHtml(it.title||"")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    collected.push(it);
  }

  // 2) 비었거나 적으면 → 카테고리 기반 백업 쿼리 순차 검색
  if (collected.length < 3) {
    const backups = fallbackQueries(region, body?.category);
    for (const q of backups) {
      const got = await searchNaverLocal(q, 15);
      for (const it of got.items ?? []) {
        const key = `${it.link}|${stripHtml(it.title||"")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(it);
      }
      if (collected.length >= 10) break;
    }
  }

  // 3) 전처리 + 비선호 필터
  const cleaned = collected.map((it) => ({
    title: stripHtml(it.title),
    address: it.roadAddress || it.address || "",
    mapx: it.mapx, mapy: it.mapy,
    link: it.link, category: it.category,
  })).filter(p => {
    const low = (p.title + " " + p.address + " " + (p.category || "")).toLowerCase();
    return !avoid.some(a => low.includes(String(a).toLowerCase()));
  });

  // 4) 프랜차이즈 필터/랭킹
  let refined = filterAndRankPlaces(cleaned, region);

  // 5) 동선 최소화: anchor가 있으면 거리순 섞어서 상위 고정
  if (anchor) {
    refined = [...refined].sort((a,b) => {
      const ax = Number(a.mapx) || 0, ay = Number(a.mapy) || 0;
      const bx = Number(b.mapx) || 0, by = Number(b.mapy) || 0;
      return dist2({x:ax,y:ay}, anchor) - dist2({x:bx,y:by}, anchor);
    });
  }

  // 6) 마지막 안전망: 그래도 없으면 지역 단독으로 다시 한 번
  if (refined.length === 0) {
    const last = await searchNaverLocal(region, 20);
    refined = (last.items ?? []).map(it => ({
      title: stripHtml(it.title),
      address: it.roadAddress || it.address || "",
      mapx: it.mapx, mapy: it.mapy,
      link: it.link, category: it.category,
    }));
  }

  // 결과는 최대 10개만
  return NextResponse.json({ items: refined.slice(0, 10) });
}
