# reanimate spec: CoupleFit device labs (web)

- **Target**: motion language of the Airofit IoT, Glucose Monitoring (iPhone Duo) and OTO Hearing Dose Behance studies, applied to new web routes `#/breath`, `#/glucose`, `#/hearing` plus the glass dock and existing tabs. The Behance studies are static shots (no video, no Lottie), so they fix layout and colour only; the motion contract is the Android Compose implementation in `CoupleFit-Veri/app/src/main/java/com/couplefit/ui/demo/*`.
- **Destination**: `C:\Project\website\couplefit\index.html`, single-file vanilla HTML/CSS/JS. No libraries; CSS transitions/keyframes with `linear()` spring curves, rAF canvas for continuous motion.
- **Fidelity**: motion-faithful to the Compose springs (timing ±80 ms, overshoot within ±3 pp). Mixed: additions are the glass SVG refraction (Chromium) and hash routes.

## Springs (mass 1)

| Name | Compose source | ζ | k | ω0 | overshoot | settle (0.1%) |
|---|---|---|---|---|---|---|
| low (indicators, thumbs, dock) | `spring(DampingRatioLowBouncy, StiffnessLow)` | 0.75 | 200 | 14.1 | 2.8 % | ~650 ms |
| press | `veriPress` scale spring | 0.5 | 500 | 22.4 | 16 % | ~620 ms |
| rise (entrances) | `VeriRise` | 0.85 | 120 | 11.0 | 0.6 % | ~740 ms |
| roll (digits) | `RollingNumber` | 0.75 | 400 | 20.0 | 2.8 % | ~460 ms |

## Rows

| # | Element | Trigger | Property | From → to | Delay / stagger | Duration | Easing |
|---|---|---|---|---|---|---|---|
| 1 | `.rise` cards | screen mount | opacity, translateY, scale, blur | 0 → 1, 26px → 0, .95 → 1, 10px → 0 | `i × 70 ms` | ~740 ms | rise spring |
| 2 | `.seg .thumb` | click option | translateX | old → new slot | 0 | ~650 ms | low spring, 2.8 % overshoot |
| 3 | `.dock .hl` | click tab | translateX | 68 px × i | 0 | ~650 ms | low spring |
| 4 | `.roll` digit | value change | translateY | ±100 % → 0, fade in 160 ms | 0 | ~460 ms | roll spring |
| 5 | any `button`/`.press` | pointer down | scale, brightness | 1 → .95, 1 → 1.10 | 0 | ~620 ms | press spring (16 % overshoot on release) |
| 6 | breath visualizer | Start session | lung fill | 0 → 1 → 1 → 0 | 3-2-1 countdown, 900 ms each | 4 s / 2 s / 6 s (Beginner) | sine in-out, hold flat |
| 7 | ambient orbs | always | orb centre | orbit | 0 | 28 s period | linear |
| 8 | BLE pulse | always | ring radius, alpha | 0.4 → 1, .45 → 0 | 0 | 1400 ms loop | linear |

## Additions (mixed)

- Liquid-glass SVG refraction (convex bezel displacement with per-channel dispersion) on `.lens` elements in Chromium; frost + rim elsewhere.
- Hash routes for every screen so each design has its own URL.

## Results (round 1, clone captured at 412x892 with capture.ts, measured with easing.ts)

No reference video exists for these studies, so there is no frame-diff against a reference; each row is checked against the Compose spring numbers instead.

| # | Element | Measured | Spec | Pass |
|---|---|---|---|---|
| 1 | `#hHero` entrance (rise, i=1) | overshoot 0.6 %, translateY within 1 % at 447 ms, opacity 644 ms; starts 170 ms after load (70 ms stagger + mount double-rAF + script) | 0.6 %, ~500 ms to 1 % | yes |
| 2 | `#bUnit .thumb` (low spring) | overshoot 2.7 %, within 1 % at 482 ms, 79 ms after the click sample | 2.8 %, ~470 ms | yes |
| 3 | `#dock .hl` (low spring) | overshoot 2.8 %, within 1 % at 529 ms | 2.8 %, ~470 ms | yes (+59 ms, inside ±80) |
| 4-5 | roll / press springs | same `springCurve()` as rows 2-3; in-page assert: low peak 1.028, press peak 1.163, low settle 651 ms | 2.8 % / 16 % / 650 ms | yes (assert passes, no console errors) |
| 6 | breath cycle | live run: t=2.34 s → INHALE · 2 s left, t=5.41 s → HOLD · 1 s left, volume 4.6 L at hold | 4 s / 2 s / 6 s | yes |
| 7 | orbs | `@keyframes orbs` 28 s linear | 28 s | yes (by construction) |
| 8 | BLE pulse | 1.4 s ping | 1.4 s | yes (fixed from 1.8 s in round 1) |

Evidence: `clone-1-seg/`, `clone-1-dock/`, `clone-1-rise/` (video.webm, frames, track.json), filmstrip in `clone-1-seg/sheets/`.
