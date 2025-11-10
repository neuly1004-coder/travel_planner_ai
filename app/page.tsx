// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import ChatPanel from "../components/ChatPanel";
import Timeline, { TimelineItem } from "../components/Timeline";
import NaverMap from "../components/NaverMap";

/** ===== LocalStorage Keys ===== */
const STORAGE_KEY_COLLECTION = "travel_planner.itineraries.v1";

/** ===== 타입: 보관함에 저장될 일정 ===== */
type SavedItinerary = {
  id: string;
  name: string;
  createdAt: string;
  items: TimelineItem[];
};

/** ===== 유틸 함수 ===== */
function loadJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function saveJSON<T>(key: string, value: T) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 무시
  }
}

type DrawerView = "menu" | "vault";

export default function HomePage() {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [selectedDay, setSelectedDay] = useState<number>(1);

  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>("menu");
  const [vault, setVault] = useState<SavedItinerary[]>([]);

  useEffect(() => {
    if (!isDrawerOpen || drawerView !== "vault") return;
    const list = loadJSON<SavedItinerary[]>(STORAGE_KEY_COLLECTION, []);
    setVault(Array.isArray(list) ? list : []);
  }, [isDrawerOpen, drawerView]);

  const handleSaveCurrent = () => {
    if (!timelineItems || timelineItems.length === 0) {
      alert("저장할 일정이 없습니다. 먼저 일정을 생성하거나 수정해 주세요.");
      return;
    }
    const name = window.prompt("이 일정의 이름을 입력해 주세요 (예: 제주 2박3일)");
    if (!name || !name.trim()) return;

    const entry: SavedItinerary = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      items: timelineItems,
    };

    const current = loadJSON<SavedItinerary[]>(STORAGE_KEY_COLLECTION, []);
    const next = [entry, ...current];
    saveJSON(STORAGE_KEY_COLLECTION, next);
    setVault(next);
    alert("보관함에 저장했습니다.");
  };

  const handleOpenEntry = (entry: SavedItinerary) => {
    setTimelineItems(entry.items);
    setSelectedDay(1);
    setDrawerOpen(false);
  };

  const handleDeleteEntry = (entry: SavedItinerary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`"${entry.name}" 일정을 삭제할까요?`)) return;
    const current = loadJSON<SavedItinerary[]>(STORAGE_KEY_COLLECTION, []);
    const next = current.filter(v => v.id !== entry.id);
    saveJSON(STORAGE_KEY_COLLECTION, next);
    setVault(next);
  };

  const handleAccount = () => {
    alert("계정관리 기능은 준비 중입니다.");
  };
  const handleLogin = () => {
    alert("로그인 기능은 준비 중입니다.");
  };

  const openDrawer = () => {
    setDrawerOpen(true);
    setDrawerView("menu");
  };

  return (
    <div className="app-layout">
      <section className="map-panel card">
        <NaverMap items={timelineItems} selectedDay={selectedDay} />
      </section>

      <section className="timeline-panel card">
        <Timeline
          items={timelineItems}
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
        />
      </section>

      <section
        className="chat-panel card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 0,
        }}
      >
        {/* ====== 우선순위 버튼 바 ====== */}
        <div
          aria-label="우선순위 정렬 버튼 영역"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "8px 10px",
            borderRadius: 10,
            background: "var(--prioritybar-bg, #f7f7f8)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {["거리순", "테마순", "낮은 가격순", "높은 가격순"].map((label) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onClick={(e) => e.preventDefault()}
              style={{
                appearance: "none",
                border: "1px solid rgba(0,0,0,0.1)",
                background: "#fff",
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 13,
                lineHeight: 1,
                cursor: "default",
                userSelect: "none",
                whiteSpace: "nowrap", // ✅ 줄바꿈 방지 추가
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <ChatPanel onTimelineChange={setTimelineItems} />
        </div>
      </section>

      <button
        aria-label="메뉴 열기"
        onClick={openDrawer}
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 60,
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "1px solid rgba(0,0,0,0.12)",
          background: "#fff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          cursor: "pointer",
          fontSize: 20,
          lineHeight: "44px",
          textAlign: "center",
          fontWeight: 700,
        }}
        title="메뉴"
      >
        ☰
      </button>

      {isDrawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 55,
          }}
        />
      )}

      <div
        role="complementary"
        aria-label="사이드바 메뉴"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: "min(360px, 88vw)",
          background: "#fff",
          borderRight: "1px solid #eee",
          boxShadow: isDrawerOpen ? "8px 0 24px rgba(0,0,0,0.12)" : "none",
          transform: `translateX(${isDrawerOpen ? "0" : "-100%"})`,
          transition: "transform 200ms ease",
          zIndex: 60,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 12px",
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {drawerView === "menu" ? "메뉴" : "일정 보관함"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {drawerView === "vault" && (
              <button
                onClick={() => setDrawerView("menu")}
                style={{
                  height: 32,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ← 메뉴
              </button>
            )}
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                height: 32,
                width: 32,
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.1)",
                background: "#fff",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
          {drawerView === "menu" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={handleAccount}
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #e5e5e5",
                  background: "#fff",
                  textAlign: "left",
                  padding: "0 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                계정관리
              </button>
              <button
                onClick={handleLogin}
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #e5e5e5",
                  background: "#fff",
                  textAlign: "left",
                  padding: "0 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                로그인
              </button>
              <button
                onClick={() => setDrawerView("vault")}
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid #e5e5e5",
                  background: "#fff",
                  textAlign: "left",
                  padding: "0 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                일정보관함
              </button>
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 8,
                }}
              >
                <button
                  onClick={handleSaveCurrent}
                  style={{
                    height: 32,
                    padding: "0 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.1)",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  현재 일정 저장
                </button>
              </div>

              {vault.length === 0 ? (
                <p style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
                  저장된 일정이 없습니다. <b>현재 일정 저장</b>을 눌러 보관하세요.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {vault.map((entry) => {
                    const date = new Date(entry.createdAt);
                    const subtitle = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                    const dayCount = new Set(
                      entry.items.map((i) => String((i as any).day ?? ""))
                    ).size;

                    return (
                      <li
                        key={entry.id}
                        onClick={() => handleOpenEntry(entry)}
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 10,
                          padding: 10,
                          marginBottom: 8,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {entry.name}
                          </div>
                          <div style={{ color: "#666", fontSize: 12 }}>
                            저장: {subtitle} · 일수 추정: {dayCount || 1}일
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteEntry(entry, e)}
                          style={{
                            height: 28,
                            padding: "0 10px",
                            borderRadius: 6,
                            border: "1px solid rgba(0,0,0,0.1)",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          삭제
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
