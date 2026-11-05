/** Re-mounts on each navigation, so every page gently fades in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
