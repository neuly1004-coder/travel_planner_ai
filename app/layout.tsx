// app/layout.tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react"; // ✅ ReactNode 타입 가져오기
import "./globals.css";

export const metadata: Metadata = {
  title: "국내 여행 일정 플래너",
  description: "네이버 실제 데이터로만 일정과 지도를 보여주는 여행 플래너",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode; // ✅ ReactNode 타입 사용
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
