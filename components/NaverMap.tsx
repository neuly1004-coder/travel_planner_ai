// components/NaverMap.tsx
"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import type { TimelineItem } from "./Timeline";

declare global {
  interface Window {
    naver: any;
  }
}

type NaverMapProps = {
  items: TimelineItem[];
  selectedDay: number; // ✅ 현재 선택된 Day
};

/** 이모지 선택 규칙: 필요시 자유롭게 수정하세요 */
function pickEmoji(item: TimelineItem): string {
  const key = (item.category || "").toLowerCase();
  if (key.includes("아침") || key.includes("breakfast")) return "🍳";
  if (key.includes("점심") || key.includes("lunch")) return "🍜";
  if (key.includes("저녁") || key.includes("dinner")) return "🍖";
  if (key.includes("카페") || key.includes("cafe")) return "☕️";
  if (key.includes("숙소") || key.includes("accommodation") || key.includes("호텔")) return "🏨";
  if (key.includes("관광") || key.includes("sight") || key.includes("명소")) return "🗺️";
  return "📍";
}

/** 이모지 동그라미 마커용 HTMLElement 생성 */
function createEmojiContent(emoji: string, size = 36) {
  const div = document.createElement("div");
  div.className = "emoji-pin";
  div.style.width = `${size}px`;
  div.style.height = `${size}px`;
  const font = Math.round(size * 0.56);
  div.style.fontSize = `${font}px`;
  div.textContent = emoji;
  return div;
}

/** 툴팁 HTML 문자열 생성 */
function makeTooltipHTML(title: string, address?: string) {
  const safeTitle = title?.replace?.(/</g, "&lt;").replace?.(/>/g, "&gt;") ?? "";
  const safeAddr = address?.replace?.(/</g, "&lt;").replace?.(/>/g, "&gt;") ?? "";
  return `
    <div class="map-tooltip">
      <div class="title">${safeTitle}</div>
      ${safeAddr ? `<div class="addr">${safeAddr}</div>` : ""}
    </div>
  `;
}

export default function NaverMap({ items, selectedDay }: NaverMapProps) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

  const handleLoad = () => {
    try {
      if (!window.naver) {
        setError("window.naver가 없습니다. 지도 스크립트 또는 키 설정을 확인하세요.");
        return;
      }
      if (!mapDivRef.current) {
        setError("지도 DOM 요소를 찾을 수 없습니다.");
        return;
      }

      const center = new window.naver.maps.LatLng(37.5665, 126.9780);
      const map = new window.naver.maps.Map(mapDivRef.current, { center, zoom: 10 });
      mapRef.current = map;

      setLoaded(true);
      setError(null);
    } catch (e: any) {
      console.error("네이버 지도 초기화 중 오류:", e);
      setError(e?.message || "네이버 지도 초기화 중 알 수 없는 오류가 발생했습니다.");
    }
  };

  const handleError = () => {
    setError("네이버 지도 스크립트를 불러오지 못했습니다. 키와 도메인 등록을 확인하세요.");
  };

  const getPlaceLabel = (item: TimelineItem) => {
    if (item.placeName) return item.placeName;
    if (item.note) return item.note;
    return `${item.region} ${item.category}`.trim();
  };

  useEffect(() => {
    if (!loaded || !window.naver || !mapRef.current) return;
    const map = mapRef.current;

    // 이전 마커 제거
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // 현재 선택된 Day만 사용
    const dayItems = items.filter((i) => i.day === selectedDay);
    const itemsWithAddress = dayItems.filter((i) => i.address && i.address.trim().length > 0);
    if (itemsWithAddress.length === 0) return;

    const bounds = new window.naver.maps.LatLngBounds();

    // ✅ 공용 InfoWindow (hover용) — 필요할 때 열고 닫습니다.
    const infoWindow = new window.naver.maps.InfoWindow({
      anchorSkew: true,
      backgroundColor: "#ffffff",
      borderWidth: 0, // 테두리는 CSS로
      pixelOffset: new window.naver.maps.Point(0, -6),
      disableAnchor: false,
    });

    itemsWithAddress.forEach((item) => {
      const queryForMap = item.address as string;

      if (!window.naver.maps.Service || typeof window.naver.maps.Service.geocode !== "function") {
        console.warn("지오코더 Service 모듈 없음, 마커를 표시하지 않습니다.");
        return;
      }

      window.naver.maps.Service.geocode({ query: queryForMap }, (status: any, response: any) => {
        try {
          if (status !== window.naver.maps.Service.Status.OK) {
            console.warn("지오코딩 실패:", status, queryForMap);
            return;
          }
          const result = response.v2?.addresses?.[0];
          if (!result) {
            console.warn("지오코딩 결과 없음:", queryForMap);
            return;
          }

          const lat = parseFloat(result.y);
          const lng = parseFloat(result.x);
          if (isNaN(lat) || isNaN(lng)) {
            console.warn("지오코딩 좌표 파싱 실패:", result);
            return;
          }

          const latlng = new window.naver.maps.LatLng(lat, lng);

          // ✅ 이모지 마커 (클릭 토글 제거)
          const size = 36;
          const emoji = pickEmoji(item);
          const contentEl = createEmojiContent(emoji, size);

          const marker = new window.naver.maps.Marker({
            position: latlng,
            map,
            title: getPlaceLabel(item),
            icon: {
              content: contentEl,
              size: new window.naver.maps.Size(size, size),
              anchor: new window.naver.maps.Point(size / 2, size),
              origin: new window.naver.maps.Point(0, 0),
            },
            zIndex: 10,
            clickable: true,
          });

          // ❌ 클릭으로 active 토글하던 코드 제거
          // window.naver.maps.Event.addListener(marker, "click", ... )  ← 더 이상 사용 안 함

          // ✅ 마우스 올리면 주소 툴팁 보이기, 떼면 닫기
          const title = getPlaceLabel(item);
          const contentHTML = makeTooltipHTML(title, item.address || undefined);

          window.naver.maps.Event.addListener(marker, "mouseover", () => {
            infoWindow.setContent(contentHTML);
            infoWindow.open(map, marker);
          });
          window.naver.maps.Event.addListener(marker, "mouseout", () => {
            infoWindow.close();
          });

          markersRef.current.push(marker);
          bounds.extend(latlng);

          if (markersRef.current.length === 1) {
            map.setCenter(latlng);
          } else {
            map.fitBounds(bounds);
          }
        } catch (e) {
          console.warn("지오코딩 처리 중 오류:", e);
        }
      });
    });
  }, [loaded, items, selectedDay]);

  return (
    <>
      {clientId && (
        <Script
          src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=geocoder,services`}
          strategy="afterInteractive"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      <div
        ref={mapDivRef}
        style={{ width: "100%", height: "100%", borderTop: "1px solid #e5e7eb" }}
      >
        {!loaded && !error && (
          <p style={{ padding: 12, fontSize: 14 }}>네이버 지도를 불러오는 중입니다...</p>
        )}
        {error && (
          <p style={{ padding: 12, fontSize: 13, color: "#b00020", whiteSpace: "pre-wrap" }}>
            지도 에러: {error}
          </p>
        )}
      </div>
    </>
  );
}