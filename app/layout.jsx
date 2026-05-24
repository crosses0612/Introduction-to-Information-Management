import "./globals.css";

export const metadata = {
  title: "訂單與原料管理系統",
  description: "訂單與原料管理 MVP"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
