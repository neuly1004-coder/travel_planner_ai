"use client";

import styles from "./PriorityBar.module.css";

export default function PriorityBar() {
  // 실행(정렬) 로직은 의도적으로 비워둡니다. 버튼 UI만 제공합니다.
  return (
    <div className={styles.wrap} aria-label="우선순위 정렬 버튼 영역">
      <button type="button" className={styles.btn} aria-label="거리순">거리순</button>
      <button type="button" className={styles.btn} aria-label="테마순">테마순</button>
      <button type="button" className={styles.btn} aria-label="낮은 가격순">낮은 가격순</button>
      <button type="button" className={styles.btn} aria-label="높은 가격순">높은 가격순</button>
    </div>
  );
}
