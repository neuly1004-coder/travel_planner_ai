"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import type { TimelineItem } from "./Timeline";
import styles from "./ChatPanel.module.css";

/* ---------- 타입 ---------- */
type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt?: number; // 시간 표시용 (ms)
};

type PlanSlot = {
  day: number;
  time: string;
  region: string;
  category: string;
  keyword: string;
  note?: string;
};

type ChatPanelProps = {
  onTimelineChange: (items: TimelineItem[]) => void;
};

/* ---------- 유틸 ---------- */
const fmtTime = (ts?: number) => {
  const d = ts ? new Date(ts) : new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

/* ---------- 말풍선 한 줄 렌더러 ---------- */
function MessageItem({ m }: { m: Message }) {
  const isUser = m.role === "user";
  return (
    <div
      className={[
        styles.item,
        isUser ? styles.right : styles.left,
      ].join(" ")}
    >
      {!isUser && <div className={styles.avatar}>🤖</div>}

      <div>
        <div
          className={[
            styles.bubble,
            isUser ? styles.user : styles.bot,
          ].join(" ")}
        >
          {m.content}
        </div>
        <div className={styles.meta}>{fmtTime(m.createdAt)}</div>
      </div>

      {isUser && <div className={styles.avatar}>😊</div>}
    </div>
  );
}

/* =========================================================
 *                       컴포넌트
 * ======================================================= */
export default function ChatPanel({ onTimelineChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content:
        "안녕하세요! 😊 여행 일정을 도와드릴게요.\n예: '경주 2박 3일, 친구들이랑, 역사 테마, 예산 50만원, 여름, 해산물 알레르기' 처럼 입력해 주세요.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // 하루별 앵커 좌표(이전 장소 기준으로 동선 최소화)
  const dayAnchors = useRef<Record<number, { x: number; y: number } | null>>({});

  // 자동 스크롤
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userContent = input.trim();

    // 사용자 메시지 추가
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: userContent, createdAt: Date.now() },
    ]);
    setInput("");
    setLoading(true);

    try {
      /* ---------------- 1) /api/plan: 일정 슬롯 생성 ---------------- */
      const planRes = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userContent }),
      });
      const planData = await planRes.json();
      const slots: PlanSlot[] = planData.slots ?? [];
      const avoidFoods: string[] = planData.meta?.avoidFoods ?? [];

      if (!planRes.ok || slots.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            role: "assistant",
            content:
              "일정을 생성하지 못했어요 😢\n지역/기간/테마/예산을 조금 더 구체적으로 알려주세요.",
            createdAt: Date.now(),
          },
        ]);
        onTimelineChange([]);
        setLoading(false);
        return;
      }

      /* ---------------- 2) 각 슬롯별 /api/place: 실제 장소 검색 ---------------- */
      const timelineItems: TimelineItem[] = [];
      const usedTitles = new Set<string>();
      dayAnchors.current = {};

      for (const slot of slots) {
        // 카테고리에 따른 검색 suffix
        let suffix = "";
        if (slot.category === "숙소") suffix = " 호텔";
        else if (slot.category.includes("식사") || slot.category.includes("맛집"))
          suffix = " 맛집";
        else if (slot.category.includes("카페")) suffix = " 카페";
        else suffix = " 관광";

        const query = `${slot.region} ${slot.keyword}${suffix}`;

        // 1차 검색
        const primaryRes = await fetch("/api/place", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            category: slot.category,
            region: slot.region,
            avoidFoods,
            // 동선 최소화: 같은 Day의 이전 선택 좌표를 기준점으로 전달
            anchor: dayAnchors.current[slot.day] ?? undefined,
          }),
        });
        let primaryData = await primaryRes.json();
        let items: { title: string; address: string; mapx?: string; mapy?: string }[] =
          primaryData.items ?? [];

        // 1차 결과가 비었으면 → 간단 백업 쿼리로 2차 검색
        if (!items.length) {
          const backupSuffix = slot.category.includes("식사")
            ? " 맛집"
            : slot.category.includes("카페")
            ? " 카페"
            : " 명소";
          const backupRes = await fetch("/api/place", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `${slot.region}${backupSuffix}`,
              category: slot.category,
              region: slot.region,
              avoidFoods,
              anchor: dayAnchors.current[slot.day] ?? undefined,
            }),
          });
          const backupData = await backupRes.json();
          items = backupData.items ?? [];
        }

        // 이미 추천한 상호는 제외
        const chosen =
          items.find((p) => !usedTitles.has(p.title)) ??
          items[0] /* 비어있지 않다면 첫 번째라도 채워서 빈칸 방지 */;

        // 선택 성공시에만 타임라인에 push (실패면 이 슬롯은 건너뜀)
        if (chosen) {
          usedTitles.add(chosen.title);

          // 앵커 갱신(다음 슬롯의 동선 최소화에 사용)
          const x = Number(chosen.mapx) || 0;
          const y = Number(chosen.mapy) || 0;
          if (x || y) dayAnchors.current[slot.day] = { x, y };

          timelineItems.push({
            id: `${slot.day}-${slot.time}-${chosen.title}`,
            day: slot.day,
            time: slot.time,
            category: slot.category,
            region: slot.region,
            placeName: chosen.title,
            address: chosen.address,
            note: slot.note,
          });
        }
      }

      // 타임라인 반영
      onTimelineChange(timelineItems);

      // 완료 메시지
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: "assistant",
          content: `✅ ${timelineItems.length}개의 일정을 생성했어요!\n(계절·비선호·동선 최소화 적용)`,
          createdAt: Date.now(),
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 3,
          role: "assistant",
          content:
            "일정을 생성하는 중 오류가 발생했어요 😥\n잠시 후 다시 시도해 주세요.",
          createdAt: Date.now(),
        },
      ]);
      onTimelineChange([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ---------------- UI (말풍선 스타일) ---------------- */
  return (
    <section className={styles.chatWrap}>
      {/* 메시지 리스트 */}
      <div className={styles.list} id="chat-scroll-region">
        {messages.map((m) => (
          <MessageItem key={m.id} m={m} />
        ))}

        {loading && (
          <div className={[styles.item, styles.left].join(" ")}>
            <div className={styles.avatar}>🤖</div>
            <div>
              <div className={[styles.bubble, styles.bot].join(" ")} style={{ opacity: 0.8 }}>
                일정을 설계하고 장소를 찾는 중입니다...
              </div>
              <div className={styles.meta}>{fmtTime()}</div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <form
        className={styles.inputBar}
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          className={styles.textarea}
          placeholder="예: 경주 2박 3일, 친구들이랑, 역사 테마, 예산 50만원, 여름, 해산물 알레르기"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className={styles.sendBtn}
          aria-label="전송"
          title="전송"
        >
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}