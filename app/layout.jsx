import "./globals.css";

export const metadata = {
  title: {
    default: "Taskapp",
    template: "%s | Taskapp",
  },
  description:
    "Manage tasks, organize work on a Kanban board, and stay on schedule with due-date reminders.",
  applicationName: "Taskapp",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#f6f7fb",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}