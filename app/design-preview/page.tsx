"use client";

import { useState } from "react";
import Image from "next/image";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "./components/ThemeToggle";
import { Button } from "./components/Button";
import { Card } from "./components/Card";
import { Chip } from "./components/Chip";
import { StatTile } from "./components/StatTile";
import { MatchStatePill } from "./components/MatchStatePill";
import { Stepper } from "./components/Stepper";
import { TabBar } from "./components/TabBar";
import styles from "./design-preview.module.css";

// Brief 30 — proves every token and every Part E primitive component in both themes on an
// isolated route. Not linked from nav, and not wired into any existing live screen — that's
// Briefs 31-35, one screen at a time. See BRIEF_30_DESIGN_SYSTEM_FOUNDATION.md.

const NEUTRALS = ["bg", "surf", "surf2", "surf3", "bd", "bd2", "tx", "tx2", "tx3"];
const TEAM_COLORS = [
  { name: "North Hedges", varBase: "n" },
  { name: "South Hedges", varBase: "s" },
];
const SEMANTIC_COLORS = [
  { name: "Live", varBase: "live" },
  { name: "Win", varBase: "win" },
  { name: "Loss", varBase: "loss" },
  { name: "Halve", varBase: "halve" },
];
const SPACE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8];
const RADIUS_STEPS = ["xs", "sm", "md", "lg", "xl", "full"];

function ColorSwatch({ name, cssVar }: { name: string; cssVar: string }) {
  return (
    <div className={styles.swatch}>
      <div className={styles.swatchColor} style={{ background: `var(${cssVar})` }} />
      <div className={styles.swatchLabel}>
        <span className={styles.swatchName}>{name}</span>
        <span className={styles.swatchValue}>{cssVar}</span>
      </div>
    </div>
  );
}

function DesignPreviewContent() {
  const [dropKey, setDropKey] = useState(0);

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div className={styles.lockup}>
          <Image src="/icons/mark-color.svg" alt="" width={40} height={40} unoptimized />
          <div className={styles.lockupText}>
            <span className={styles.lockupTitle}>The Hedges Invitational</span>
            <span className={styles.lockupSub}>Design system foundation</span>
          </div>
          <span className={styles.devBadge}>dev only</span>
        </div>
        <ThemeToggle />
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Team colors</h2>
        <p className={styles.sectionSub}>
          North Hedges blue and South Hedges gold — fixed identity, each with an -ink and -soft
          variant.
        </p>
        <div className={styles.swatchGrid}>
          {TEAM_COLORS.flatMap(({ name, varBase }) => [
            <ColorSwatch key={varBase} name={name} cssVar={`--${varBase}`} />,
            <ColorSwatch key={`${varBase}-ink`} name={`${name} ink`} cssVar={`--${varBase}-ink`} />,
            <ColorSwatch key={`${varBase}-soft`} name={`${name} soft`} cssVar={`--${varBase}-soft`} />,
          ])}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Semantic colors</h2>
        <p className={styles.sectionSub}>Live / win / loss / halve — deliberately distinct from both team colors.</p>
        <div className={styles.swatchGrid}>
          {SEMANTIC_COLORS.flatMap(({ name, varBase }) => [
            <ColorSwatch key={varBase} name={name} cssVar={`--${varBase}`} />,
            <ColorSwatch key={`${varBase}-ink`} name={`${name} ink`} cssVar={`--${varBase}-ink`} />,
            <ColorSwatch key={`${varBase}-soft`} name={`${name} soft`} cssVar={`--${varBase}-soft`} />,
          ])}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Neutrals</h2>
        <p className={styles.sectionSub}>Its own scale per theme — dark mode is not an inverted light theme.</p>
        <div className={styles.swatchGrid}>
          {NEUTRALS.map((n) => (
            <ColorSwatch key={n} name={n} cssVar={`--${n}`} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Typography</h2>
        <p className={styles.sectionSub}>Inter (--font-ui) for interface text, Barlow Condensed (--font-display) for scores and headings.</p>
        <div>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>--font-ui 14px</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 14 }}>Live scoring for the trip, one hole at a time.</span>
          </div>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>--font-ui 14px 700</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700 }}>North Hedges vs South Hedges</span>
          </div>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>--font-display 32px</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700 }}>2UP</span>
          </div>
          <div className={styles.typeRow}>
            <span className={styles.typeLabel}>--font-display 44px</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700 }}>4</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Spacing — 4px base grid</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {SPACE_STEPS.map((step) => (
            <div className={styles.scaleRow} key={step}>
              <span className={styles.scaleLabel}>--space-{step}</span>
              <div className={styles.spaceBar} style={{ width: `var(--space-${step})` }} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Radius</h2>
        <div className={styles.inlineGroup}>
          {RADIUS_STEPS.map((step) => (
            <div className={styles.scaleRow} key={step}>
              <span className={styles.scaleLabel}>--radius-{step}</span>
              <div className={styles.radiusBox} style={{ borderRadius: `var(--radius-${step})` }} />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Motion</h2>
        <div className={styles.motionRow}>
          <div className={styles.inlineGroup}>
            <span className={styles.pulseDot} />
            <span className={styles.sectionSub}>hedgePulse — the &ldquo;live&rdquo; dot</span>
          </div>
          <div className={styles.inlineGroup}>
            <div key={dropKey} className={`${styles.dropDemo} ${styles.animate}`}>
              hedgeDrop
            </div>
            <Button variant="secondary" onClick={() => setDropKey((k) => k + 1)}>
              Replay
            </Button>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Components</h2>
        <div className={styles.componentGallery}>
          <div className={styles.componentRow}>
            <span className={styles.componentLabel}>Button</span>
            <div className={styles.inlineGroup}>
              <Button variant="primary">Post hole 4</Button>
              <Button variant="secondary">Replay reveal</Button>
              <Button variant="ghost">← Cup</Button>
              <Button variant="destructive">Void bet</Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
          </div>

          <div className={styles.componentRow}>
            <span className={styles.componentLabel}>Card / surface container</span>
            <div className={styles.cardGroup}>
              <Card edge="north">
                <strong>North Hedges</strong>
                <p style={{ fontSize: 12, color: "var(--tx2)", marginTop: 4 }}>Duo: Chris &amp; Doc</p>
              </Card>
              <Card edge="south">
                <strong>South Hedges</strong>
                <p style={{ fontSize: 12, color: "var(--tx2)", marginTop: 4 }}>Duo: Marty &amp; Reed</p>
              </Card>
              <Card>
                <strong>Neutral card</strong>
                <p style={{ fontSize: 12, color: "var(--tx2)", marginTop: 4 }}>No team edge</p>
              </Card>
            </div>
          </div>

          <div className={styles.componentRow}>
            <span className={styles.componentLabel}>Chip / badge</span>
            <div className={styles.inlineGroup}>
              <Chip variant="live" pulse>
                Live
              </Chip>
              <Chip variant="win">Won 6</Chip>
              <Chip variant="loss">Lost 3</Chip>
              <Chip variant="halve">Halved 2</Chip>
              <Chip variant="north">North</Chip>
              <Chip variant="south">South</Chip>
              <Chip variant="neutral">Drives used</Chip>
            </div>
          </div>

          <div className={styles.componentRow}>
            <span className={styles.componentLabel}>Stat tile</span>
            <div className={styles.cardGroup}>
              <StatTile label="Cup points" value="7½" accent="north" />
              <StatTile label="Cup points" value="4½" accent="south" />
              <StatTile label="Holes won" value={9} />
            </div>
          </div>

          <div className={styles.componentRow}>
            <span className={styles.componentLabel}>Match state pill</span>
            <div className={styles.inlineGroup}>
              <MatchStatePill state="north-up">2UP</MatchStatePill>
              <MatchStatePill state="south-up">1UP</MatchStatePill>
              <MatchStatePill state="all-square">AS</MatchStatePill>
              <MatchStatePill state="live">LIVE</MatchStatePill>
            </div>
          </div>

          <div className={styles.componentRow}>
            <span className={styles.componentLabel}>Stepper</span>
            <Stepper initialValue={4} min={1} />
          </div>

          <div className={styles.componentRow}>
            <span className={styles.componentLabel}>Tab bar / nav</span>
            <TabBar tabs={["Cup", "Pairings", "Score", "Ledger"]} />
          </div>

          <div className={styles.componentRow}>
            <span className={styles.componentLabel}>Logo mark</span>
            <div className={styles.inlineGroup}>
              <Image src="/icons/mark-color.svg" alt="Hedges mark, color" width={48} height={48} unoptimized />
              <div style={{ background: "var(--n)", padding: 8, borderRadius: "var(--radius-md)" }}>
                <Image
                  src="/icons/mark-color-dark-bg.svg"
                  alt="Hedges mark, dark-bg color"
                  width={48}
                  height={48}
                  unoptimized
                />
              </div>
              <div style={{ background: "#FFFFFF", padding: 8, borderRadius: "var(--radius-md)" }}>
                <Image src="/icons/mark-mono-dark.svg" alt="Hedges mark, mono dark" width={48} height={48} unoptimized />
              </div>
              <div style={{ background: "var(--tx)", padding: 8, borderRadius: "var(--radius-md)" }}>
                <Image
                  src="/icons/mark-mono-light.svg"
                  alt="Hedges mark, mono light"
                  width={48}
                  height={48}
                  unoptimized
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function DesignPreviewPage() {
  return (
    <ThemeProvider>
      <DesignPreviewContent />
    </ThemeProvider>
  );
}
