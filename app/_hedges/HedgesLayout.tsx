import { Inter, Barlow_Condensed } from "next/font/google";
import "../design-preview/hedges-tokens.css";
import { ThemeProvider } from "../design-preview/ThemeProvider";
import styles from "./hedges.module.css";

// Brief 33: the Brief 30 design system, applied to player-facing v2 screens. Imported from each
// route's own nested layout.tsx (not the root layout), so — as with /design-preview — Next only
// ships these tokens and fonts to the routes that use them, and the screens that haven't been
// rebuilt yet keep their existing look. Light/dark follows the device by default (ThemeProvider).
const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export default function HedgesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.variable} ${barlowCondensed.variable}`}>
      <ThemeProvider>
        <div className={styles.shell}>{children}</div>
      </ThemeProvider>
    </div>
  );
}
