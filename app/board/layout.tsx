import { HedgesShell } from "../_hedges/HedgesLayout";

// The TV board defaults to DARK (TVs look better in dark); the light toggle is on the screen.
export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <HedgesShell defaultTheme="dark">{children}</HedgesShell>;
}
