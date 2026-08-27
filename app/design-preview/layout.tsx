import { Inter, Barlow_Condensed } from "next/font/google";
import "./hedges-tokens.css";

// Brief 30 — dev-only preview of the new design system. Importing hedges-tokens.css and these
// fonts here, in a nested layout rather than the root layout, keeps both scoped to this route
// segment: Next.js only ships a route's CSS/font chunks to that route, so none of this reaches
// any existing live screen. The real build swaps these next/font loaders for self-hosted fonts
// per the brief's own note; next/font/google is fine for this preview-only route.
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

export default function DesignPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.variable} ${barlowCondensed.variable}`}>
      {children}
    </div>
  );
}
