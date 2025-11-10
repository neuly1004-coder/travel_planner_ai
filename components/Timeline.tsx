// components/Timeline.tsx

export type TimelineItem = {
  id: string;
  day: number;
  time: string;
  category: string;
  region: string;
  placeName?: string; // 네이버 검색 결과에서 가져올 실제 상호명
  address?: string;   // 네이버 검색 결과에서 가져올 실제 주소
  note?: string;
};

type TimelineProps = {
  items: TimelineItem[];
  selectedDay: number;                // 현재 선택한 Day
  onDayChange: (day: number) => void; // Day 변경 콜백
};

export default function Timeline({
  items,
  selectedDay,
  onDayChange,
}: TimelineProps) {
  if (!items || items.length === 0) {
    return (
      <div className="timeline-empty">
        아직 생성된 일정이 없습니다. 오른쪽 챗봇에 여행 조건을 입력해 보세요!
      </div>
    );
  }

  // 전체 일정에 포함된 Day 목록 (1,2,3,...)
  const days = Array.from(new Set(items.map((i) => i.day))).sort((a, b) => a - b);

  // 선택된 Day가 없으면 첫 번째 Day로
  const activeDay = days.includes(selectedDay) ? selectedDay : days[0];

  // 현재 Day의 일정만 필터링
  const dayItems = items
    .filter((item) => item.day === activeDay)
    // 시간 문자열 그대로 유지(기능 변경 금지). 보기 좋게만 정렬 시도.
    .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));

  return (
    <div className="timeline-ui">
      {/* Day 탭 */}
      <div className="day-tabs" role="tablist" aria-label="여행 일자 선택">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => onDayChange(day)}
            className={`day-tab ${day === activeDay ? "active" : ""}`}
            role="tab"
            aria-selected={day === activeDay}
            title={`Day ${day}`}
          >
            Day {day}
          </button>
        ))}
      </div>

      {/* 타임라인 리스트 */}
      <div className="tl-scroll">
        <ol className="tl-list" aria-label={`Day ${activeDay} 일정`}>
          {dayItems.map((item) => (
            <li key={item.id} className="tl-row">
              {/* 좌측 세로 레일 + 점 */}
              <div className="tl-rail" aria-hidden="true">
                <span className="tl-dot" />
              </div>

              {/* 우측 카드 */}
              <article className="tl-card">
                <header className="tl-head">
                  <h3 className="tl-title">{item.category}</h3>
                  <time className="tl-time">{item.time}</time>
                </header>

                <div className="tl-place">
                  {item.placeName ?? "추천 준비중 (네이버 검색 대기)"}
                </div>

                <div className="tl-sub">
                  <span className="tl-meta">
                    Day {item.day} · {item.region}
                  </span>
                </div>

                {item.address && <div className="tl-addr">{item.address}</div>}

                {item.note && <div className="tl-note">메모: {item.note}</div>}
              </article>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}