// Print layout — renders nothing but children.
// This escapes the dashboard's nav/sidebar so the print page is chrome-free.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
