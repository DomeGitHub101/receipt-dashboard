---
name: Moo Tang (หมูตังค์)
description: A little clarity for your everyday spending. Thai slip logging told as a cast of category pals.
colors:
  blush-ground: "#fff4f7"
  ink-navy: "#2a2f5a"
  muted-ink: "#5f6388"
  card-white: "#ffffff"
  primary-pink: "#d63378"
  primary-pink-deep: "#c42c6c"
  primary-lip: "#a8205b"
  ribbon-pink: "#ff6ba7"
  blush-field: "#ffe3ec"
  lilac-field: "#ede4ff"
  mint-field: "#e6f7ef"
  butter-field: "#fff0b8"
  muted-field: "#f7f1fa"
  border-haze: "#efe4ee"
  input-stroke: "#e3d7e6"
  income-blue: "#1d5fa8"
  warn-amber: "#a15c00"
  destructive-red: "#b3261e"
  danger-soft: "#ffe9e6"
typography:
  display:
    fontFamily: "Fredoka, Mali, Nunito, sans-serif"
    fontSize: "clamp(34px, 11cqi, 60px)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Fredoka, Mali, Nunito, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Fredoka, Mali, Nunito, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  plate:
    fontFamily: "Fredoka, Mali, Nunito, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Nunito, Anuphan, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Nunito, Anuphan, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  field: "12px"
  soft: "14px"
  pal: "22px"
  card: "24px"
  plate: "28px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "22px"
  card: "24px"
  plate: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary-pink}"
    textColor: "{colors.card-white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-pink-deep}"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.lilac-field}"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.card}"
    padding: "24px"
  month-plate:
    backgroundColor: "{colors.blush-field}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.plate}"
    padding: "26px 28px"
  pill:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.pill}"
    padding: "6px 13px"
  pal-card:
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.pal}"
    padding: "18px 10px 12px"
  amount-plate:
    backgroundColor: "{colors.mint-field}"
    typography: "{typography.plate}"
    rounded: "{rounded.pill}"
    padding: "3px 12px"
  note-plate:
    backgroundColor: "{colors.butter-field}"
    rounded: "{rounded.pill}"
    padding: "3px 12px"
  rank-flag:
    backgroundColor: "{colors.lilac-field}"
    textColor: "{colors.ink-navy}"
    width: "30px"
    height: "36px"
  rank-flag-top:
    backgroundColor: "{colors.ribbon-pink}"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.field}"
    padding: "12px 13px"
  nav-item:
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.pill}"
    padding: "11px 15px"
  nav-item-active:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.primary-pink-deep}"
  segmented-active:
    backgroundColor: "{colors.ribbon-pink}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
---

# Design System: Moo Tang (หมูตังค์)

## Overview

**Creative North Star: "The Character Goods Shelf"**

Moo Tang reads like a page from a character goods catalog: every spending category is a small chibi pal standing on a pastel tile, wearing a rank ribbon, with its name, amount and share printed on rounded plates beneath it. The month answers "who ate my money" as a ranked cast, not a grey chart. Money still reads first and plainly; the cast frames it.

The ground is a pale blush, surfaces are white or pastel tiles with a white sticker edge, ink is deep navy and never black. Type is rounded throughout: a bubble display face for numerals and headings and a rounded sans for reading, each with a Thai partner so Thai text is first-class. Density is relaxed on phones, a one-handed flow where Scan a slip is always within reach of the thumb.

The world rejects the dark fintech look with a neon accent, white cards with a blue accent, and any dark or green-led theme (a standing product commitment).

**Key Characteristics:**
- Pale blush ground, white and pastel tiles, navy ink.
- A sticker edge (white ring plus a pastel outer ring) instead of borders on the main surfaces.
- Every label that carries a value is a pill or a plate.
- One cast of six deterministic chibi species, tinted from each category colour.
- One motion only: a small bounce when a pal is hovered or focused.
- Pink is the only saturated colour on the screen.

## Colors

A soft pastel candy palette on blush, held together by one navy ink and one family of pinks.

### Primary
- **Bow Pink** (primary-pink): the fill of primary actions (Scan a slip, Save, Sign in) and the focus ring. Deep enough to carry white text.
- **Pressed Bow** (primary-pink-deep): hover state of primary actions, and the pink used for text: active nav label, text buttons, saved and confirmed messages.
- **Bow Lip** (primary-lip): the 2px under-edge of the primary button only.
- **Ribbon Pink** (ribbon-pink): the saturated decorative pink. Top rank flag and the top pal's outer ring, the active segment, meter fills, the nav active dot, the brand dot and the sprinkle pattern on the sign-in ground. Carries navy text, never white.

### Secondary
- **Pastel fields** (blush-field, lilac-field, mint-field, butter-field): the tiles that things stand on. Blush holds the month plate and the over-budget hero; lilac is the desktop rail, the default rank flag, settings icon discs and tags; mint holds amounts, money in, the on-budget hero and success notices; butter holds share notes, the money left pill and the avatar.

### Tertiary
- **Income Blue** (income-blue), **Warn Amber** (warn-amber), **Alert Red** (destructive-red) on **Soft Alert** (danger-soft): status text and the destructive action. Used sparingly and never decoratively.

### Neutral
- **Blush Ground** (blush-ground): the page background everywhere, including the fade behind the phone scan dock.
- **Navy Ink** (ink-navy): all primary text, the secondary button stroke, the toast fill, the mascot outline and pal faces.
- **Muted Ink** (muted-ink): supporting copy, captions, resting labels.
- **Card White** (card-white): cards, inputs, pills by default and the inner ring of every sticker edge.
- **Muted Field** (muted-field), **Border Haze** (border-haze), **Input Stroke** (input-stroke): segmented track and resting plates; hairlines and dashed dividers; field strokes.

### Named Rules
**The Navy Not Black Rule.** No text, outline or shadow is pure black. Ink is navy and shadows are navy or pink at low alpha.

**The Two Pinks Rule.** Ribbon Pink decorates and carries navy text; Bow Pink acts and carries white text. Never put white text on Ribbon Pink.

**The Pal Tint Rule.** Pal colours are never picked by hand. They derive from the category colour through the tint function: tile at 95% lightness, name plate at 88%, body at 82%, limbs and accents at 66%, all at 72% saturation; near-grey colours fall back to lilac.

## Typography

**Display Font:** Fredoka (with Mali for Thai, then Nunito)
**Body Font:** Nunito (with Anuphan for Thai, then Segoe UI)

**Character:** A chubby bubble face for everything you count or name, a friendly rounded sans for everything you read. Both have Thai partners with matching softness.

### Hierarchy
- **Display** (700, fluid with the month plate, 1.05): the month's spending total only. Tabular numerals, never wraps; it shrinks with its container so seven-figure amounts fit a phone.
- **Headline** (600, 34px desktop, 25px under 1200px, 26px on phones, 1.15): page titles and the sign-in title, balanced wrapping.
- **Title** (600, 19px): card and section headings; 15-17px for sub-headings inside plates and settings rows.
- **Plate** (600, 15-16px, tabular): name plates, amount plates, pill values, chart facts, budget totals.
- **Body** (400, 14px root, 1.6): descriptions and supporting copy, mostly 13px in Muted Ink inside cards.
- **Label** (700, 12px): form labels (600), tags, plates notes, status text. Sentence case.

### Named Rules
**The Counted Things Are Round Rule.** Every amount and every category name sets in the display face with tabular numerals. Running copy never does.

**The Sentence Case Rule.** No uppercase labels and no tracked-out small caps. Letter-spacing is only ever slightly negative on display type.

## Layout

Mobile first. On phones (760px and below) the shell is a top bar with the logo, month switch and a menu button that opens the lilac rail as an off-canvas drawer over a navy scrim, and a fixed scan dock pinned to the bottom that fades into the blush ground. Inputs go to 16px there to avoid zoom. Above 760px the lilac rail is fixed at the left (240px, narrowing to 205px under 1200px and 185px under 980px) and Scan moves into the page header.

Content sits in a centred column up to 1400px with 38px side padding on desktop and about 19px on phones. The Overview stacks the month plate, then a two-column grid (roster 1.25fr beside the daily chart 1fr) that collapses to one column under 980px. The roster is an auto-filling grid of 150px-minimum tiles, forced to two-up on phones.

Rhythm is loose and even: 6-8px inside clusters of pills and plates, 14px between pal tiles, 22px between major blocks, 24px card padding and 26-28px plate padding.

## Elevation & Depth

Depth comes from a sticker edge, not from borders or glows. Main surfaces wear a white inner ring and a thin pastel outer ring, with a very soft navy or pink drop pulled well underneath by a negative spread so it reads as a tile resting on a shelf. Pressable things carry a 2px same-hue lip under their bottom edge, like a moulded toy button. Interior hierarchy is tonal: pastel tiles on white, white pills on pastel.

### Shadow Vocabulary
- **Plate sticker** (`0 0 0 4px #fff, 0 0 0 6px #ffc9dc, 0 18px 36px -28px rgb(214 51 120 / 0.6)`): the month plate; the budget hero uses the same shape in mint (`#c5ecd9`, green drop) or blush when over.
- **Form sticker** (`0 0 0 4px #fff, 0 0 0 6px var(--color-lilac), 0 30px 60px -34px rgb(42 47 90 / 0.4)`): sign-in cards.
- **Card rest** (`0 0 0 1px #f3e9f1, 0 2px 0 #f0e4ee, 0 14px 30px -24px rgb(42 47 90 / 0.4)`): every standard white card.
- **Pal edge** (`0 0 0 3px #fff, 0 0 0 4px #f1e6ef`) and **top pal edge** (`0 0 0 3px #fff, 0 0 0 5px var(--color-ribbon)`): roster tiles.
- **Bow lip** (`0 2px 0 #a8205b, 0 8px 18px -10px rgb(214 51 120 / 0.7)`): the primary button.
- **Floating** (`0 12px 28px -12px rgb(42 47 90 / 0.6)`): the navy toast.

### Named Rules
**The Sticker Edge Rule.** A raised surface gets a white ring and a pastel ring, not a grey border. Hairlines are reserved for list dividers inside a card.

**The Same-Hue Lip Rule.** A lip is 2px, straight down and a darker step of the element's own colour. Never black, never diagonal, never more than 2px.

**The No Glow Rule.** Drops always use a negative spread and sit below the surface; nothing glows around its edges.

## Shapes

Everything is rounded and soft: plates 28px (24px on phones), cards 24px, pal tiles 22px, tooltips and notices 14px, fields 12px (10px on sign-in). Buttons, nav items, pills, plates, tags, meters and segmented controls are full pills. Avatars and icon discs are circles. The one sharp silhouette is the rank flag, a short ribbon tail clipped with a notch at the bottom. Section dividers inside surfaces are 2px dashed lines (rail footer, settings rows), like a perforated tear line.

## Components

### Buttons
Chunky and pressable, like toy buttons.
- **Shape:** full pill, 44px minimum height (54px for the scan call to action).
- **Primary:** Bow Pink with white 700 text and the bow lip; hover deepens to Pressed Bow; press nudges down 1px.
- **Secondary:** white with a 2px navy stroke; hover fills lilac.
- **Text button:** Pressed Bow text, 13px 700, no fill.
- **Focus:** 2.5px Bow Pink outline offset 4px on every interactive element.

### Chips (pills, tags and plates)
- **Pill:** white or pastel, navy 600 text with the value in the display face; month plate pills are mint (money in), butter or blush (left), lilac (counts).
- **Tag:** lilac pill, 12px 700; mint when it marks success.
- **Segmented:** pills on a muted track; the pressed segment is Ribbon Pink with navy text and a ribbon lip.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** white on the blush ground.
- **Shadow Strategy:** card rest (see Elevation & Depth).
- **Internal Padding:** 24px.

### Inputs / Fields
- **Style:** white, 1.5px Input Stroke, 12px radius, 12px 13px padding, 12px 600 label above with an 8px gap.
- **Focus:** stroke turns Bow Pink, plus the shared focus outline.
- **Pill fields:** the month picker and category limits are pills with a 2px stroke.

### Navigation
A lilac rail on desktop with pill nav items (14px 600 navy); hover fills translucent white; the active item is a white pill with Pressed Bow 800 text, a lilac lip and a Ribbon Pink dot. A butter-edged note card and a dashed footer with the profile close the rail. On phones the rail is a drawer.

### Month Plate (signature)
The blush plate that opens Overview: a small heading, the display total, a ribbon spend meter on a white track (amber when high, red when over) and a row of pastel pills, with Scan a slip and Add by hand on the right; on phones the actions stack under it and Scan moves to the dock.

### Pal Roster (signature)
A ranked grid of pal tiles. Each tile is tinted from its category, with a notched rank flag top-left (lilac, Ribbon Pink for rank one, whose tile also gets the ribbon ring), the pal, a tinted name plate, a mint amount plate and a butter share note. Pals are one of six full-body chibi species (bunny with a bow, bear, chick, dino, cat, whale), chosen by hashing the category name so a category always keeps its character, with navy eyes with catchlights, a "w" mouth and blush cheeks. Categories with no spend sit below a 2px dashed divider under a "Resting this month" heading, as small grayscale pals at 60% opacity with muted plates. The same cast appears on the sign-in panel over a dotted Ribbon Pink sprinkle ground.

**The One Bounce Rule.** The only decorative motion in the world is the pal bounce: a 6px hop with a squash and stretch, 0.45s on a soft overshoot curve (cubic-bezier(0.22, 1, 0.36, 1)), played when a pal's tile or table row is hovered or takes focus. Nothing else animates for delight, and reduced motion turns it off.

**The Resting Grey Rule.** A category with no spend this month keeps its character but loses its colour (grayscale at 60% opacity). Colour means money moved.

### Brand Mark
A pink piggy bank with a navy outline, rosy cheeks and a gold coin dropping into its slot, set beside the Thai wordmark "หมูตังค์" with "ตังค์" in Pressed Bow.

### Scan Dock
On phones, a full-width 54px primary button fixed above the safe area, on a blush gradient, so Scan a slip is one tap away on every page.

## Do's and Don'ts

### Do:
- **Do** set the ground to Blush Ground and lift white cards with the card rest shadow.
- **Do** derive every pal colour from the category colour through the tint function.
- **Do** put every amount, name and share in a pill or plate, with amounts in the display face and tabular numerals.
- **Do** keep Scan a slip as the primary pink button on every page, pinned to the dock on phones.
- **Do** use the sticker edge (white ring plus pastel ring) for raised surfaces.
- **Do** respect reduced motion; transitions are short (0.15-0.25s) and functional.
- **Do** bounce a pal on hover or focus of its tile or row, and print resting pals in grayscale.

### Don't:
- **Don't** use pure black for text, outlines or shadows; use Navy Ink.
- **Don't** put white text on Ribbon Pink or the pastel fields.
- **Don't** reintroduce a dark theme or a green-led palette; mint is a field colour, never the brand colour.
- **Don't** add grey borders around cards or glows around anything.
- **Don't** set labels in uppercase or with tracked-out letter-spacing.
- **Don't** add hover lifts, entrance animations or looping motion; the pal bounce is the only flourish.
- **Don't** draw lips deeper than 2px, offset sideways, or in a colour outside the element's own hue.
