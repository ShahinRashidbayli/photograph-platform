# Contrast floor for the landing palette

Research for [#78 "Which contrast floor must the landing palette meet?"](https://github.com/ShahinRashidbayli/photograph-platform/issues/78),
a ticket on the map [#77 "A landing page whose light and dark themes look different"](https://github.com/ShahinRashidbayli/photograph-platform/issues/77).
Sources were read on 2026-11-25. Each claim cites its source in brackets; the
list is at the end.

> **Not legal advice.** The law sections separate what the text says from how
> it is read. Get a lawyer to confirm the scope questions before relying on them.

## Short answer

- **The thresholds (WCAG 2.2 Level AA).**
  - Text: 4.5:1. Large text: 3:1. "Large" means at least 18 pt (24 CSS px), or at least 14 pt (about 18.67 CSS px) when bold.
  - Non-text: 3:1 against adjacent colours for anything needed to identify a UI component or its state, including focus indicators. A button does not need a border, but a text input whose border is its only visual cue does.
  - Ratios are not rounded: 4.499:1 fails.
- **The law.**
  - **(a) The landing page:** most likely outside the BFSG. It sells to photographers as businesses, and the law covers services for consumers. The floor here is our own choice.
  - **(b) Client-facing pages:** the booking request form, the customer portal where clients sign contracts, and probably the galleries. The BFSG most likely applies to the *photographer*, as the provider of a consumer e-commerce service. But most photographers are micro-enterprises (fewer than 10 staff and at most €2M turnover or balance sheet), and those are exempt.
  - **Fotolio itself:** has no direct BFSG duty as the software vendor (this is interpretation).
  - **The standard:** where the BFSG does apply, the practical yardstick is EN 301 549, whose web clause is WCAG AA.
  - **Status of EN 301 549:** V4.1.1, which is built on WCAG 2.2, was published in September 2026. It is not yet cited in the Official Journal under the European Accessibility Act.
- **Text over photographs.** Measure each letter against the image pixels right next to it, in every viewport crop and for every image that can appear. Automated checkers cannot do this. The reliable fix is a scrim (overlay) sized for the worst case. White text needs at least 54% black under it for 4.5:1, or 42% for 3:1.
- **Recommended floor:** WCAG 2.2 AA, met by *both* themes on their own, with unrounded ratios. It is spelled out in [section 4](#4-recommended-floor).

## 1. WCAG 2.2 Level AA thresholds

WCAG 2.2 has been a W3C Recommendation since 12 December 2024 [WCAG22].

| What | Success criterion | Level | Floor |
|---|---|---|---|
| Text and images of text | 1.4.3 Contrast (Minimum) | AA | **4.5:1** |
| Large-scale text | 1.4.3 Contrast (Minimum) | AA | **3:1** |
| UI components and their states, graphical objects | 1.4.11 Non-text Contrast | AA | **3:1** against adjacent colours |
| A visible keyboard focus indicator exists | 2.4.7 Focus Visible | AA | no ratio of its own; its contrast comes from 1.4.11 |
| Focused component not entirely hidden | 2.4.11 Focus Not Obscured (Minimum) | AA | (not a contrast rule) |
| Enhanced text contrast | 1.4.6 Contrast (Enhanced) | AAA | 7:1, and 4.5:1 for large text |
| Focus indicator size and change | 2.4.13 Focus Appearance | AAA | at least a 2 CSS px perimeter, and 3:1 between focused and unfocused pixels |

Source for the whole table: [WCAG22] normative text.

### 1.1 What counts as "large"

- **Definition.** "with at least 18 point or 14 point bold or font size that would yield equivalent size for Chinese, Japanese and Korean (CJK) fonts" [WCAG22, *large scale (text)*].
- **Point to pixel.**
  - Points are CSS points: "1pt = 1.333px, therefore 14pt and 18pt are equivalent to approximately 18.5px and 24px" [U143], [G18].
  - Our arithmetic: 14 × 4/3 = **18.67 px**. W3C's "approximately 18.5px" is slightly low, so use 18.67 px as the bold cut-off.
- **Size as delivered.** Size is what the page delivers, before any user zoom: "It does not include resizing that may be done by a user" [WCAG22, note 2].
  - It should come "from the user agent, or calculated based on font metrics as the user agent does" [WCAG22, note 3].
  - With `clamp()`/`vw` type sizes, the size differs per viewport, so check the smallest rendered size.
- **"Bold" has no numeric definition** in WCAG.
  - *Interpretation:* treat `font-weight: 700` and above as bold.
  - The landing loads Host Grotesk only at 400/500/600 and Cormorant Garamond only at 500 (`apps/web/src/app/_landing/fonts.ts`). So no landing text qualifies via the 14 pt bold route, and **3:1 applies only from 24 px up**.
- **Thin faces.** "Fonts with extraordinarily thin strokes or unusual features and characteristics that reduce the familiarity of their letter forms are harder to read, especially at lower contrast levels" [WCAG22, note 1].
  - This is advisory, but it fits the hero's Cormorant Garamond 500 accent word.

### 1.2 How the ratio is measured

- **Formula.** (L1 + 0.05) / (L2 + 0.05), using sRGB relative luminance [WCAG22, *contrast ratio*, *relative luminance*].
  - The 0.04045 linearisation threshold replaced 0.03928 in May 2021, which "has no practical effect" [WCAG22].
- **No rounding.** "the computed values should not be rounded (e.g., 4.499:1 would not meet the 4.5:1 threshold)" [U143]. The same applies to 3:1: "2.999:1 would not meet the 3:1 threshold" [U1411].
- **Specified colours, not rendered pixels.**
  - The ratio uses colours "obtained from the user agent, or the underlying markup and stylesheets" [U143].
  - The contrast "can be evaluated with anti-aliasing turned off" [WCAG22, note 2].
- **Specify both colours.** Specifying a text colour without a background colour (or the reverse) is a failure [WCAG22, note 4], [U143] F24.
- **Borders and halos.** A narrow border around letters counts as part of the letter; a wide one counts as background (a halo) [WCAG22, note 5].
- **Which colour pairs.** Evaluate the pairs "that an author would expect to appear adjacent in typical presentation". Presentations caused by the user agent are excluded "except where caused by authors' code" [WCAG22, note 6].
  - *Interpretation:* our dark theme is applied by our own code, either from `prefers-color-scheme` or from the explicit toggle. So both themes are typical presentations, and each must pass.
  - WCAG offers a fallback (technique G174): a sufficiently contrasting control that switches to a conforming presentation [U143].
  - We should not rely on that fallback. It would leave one theme non-conforming, and the toggle is not on the landing page today.
- **Every viewport variation must conform.** "A full page includes each variation of the page that is automatically presented by the page for various screen sizes … Each of these variations needs to conform" [WCAG22 §5.2.2, note 3]. This matters for cropped hero images (section 3).

### 1.3 Non-text contrast (1.4.11): borders, focus, the theme toggle

- **UI components.** "any visual information provided that is necessary for a user to identify that a control is present and how to operate it must have a minimum 3:1 contrast ratio with the adjacent colors" [U1411].
- **Boundaries.** "This success criterion does not require that controls have a visual boundary indicating the hit area." A boundary is "only required when there is no other visual way to identify the presence of the control" [U1411].
  - **Buttons:** a text button "does not need a contrasting visual indicator to show that it is a button" [U1411, Buttons example].
  - **Text inputs:** when the border or underline is the only thing that marks the input, "that indicator must meet 3:1 contrast ratio" [U1411, Text input example].
- **Exceptions.** Inactive (disabled) components are exempt [WCAG22 1.4.11]. So is an unmodified browser-default focus ring ("exempt from contrast requirements (but must still be visible)") [U1411].
- **States, including focus.** "any visual information necessary to indicate state, such as whether a component is selected or focused" must meet 3:1 [U1411].
  - A focus indicator that sits outside the component must contrast with "the background that the component is on".
  - One drawn inside the component's border must contrast with the component [U1411].
  - Hover styles do not need 3:1 [U1411].
- **Focus Appearance (2.4.13, AAA)** adds two things on top of 1.4.11: a minimum size, and a 3:1 change between the focused and unfocused states [U2413]. It is optional at AA.
- **Graphical objects.** For "simple graphics such as single-color icons the entire image is a graphical object" [U1411]. Symbol-like glyphs such as × and › count as non-text and need 3:1 [U1411].
- **Gradients.** "If there are multiple colors and/or a gradient, choose the least contrasting area to test" [U1411].
- **The theme toggle** (applying the above):
  - Its sun/moon icon needs 3:1 against the nav background in both themes.
  - Its focus ring needs 3:1 against the colours next to it.
  - If it shows a selected state visually, as the dashboard's Light · Dark · System menu does, that state also needs 3:1.

## 2. Do the BFSG and EN 301 549 apply to Fotolio?

### 2.1 What the law says

**BFSG (Barrierefreiheitsstärkungsgesetz)** [BFSG]. This is Germany's transposition of Directive (EU) 2019/882, the European Accessibility Act [EAA]. It has applied since 28 June 2025.

- **Scope, § 1 Abs. 3.** The law covers listed "Dienstleistungen, die für Verbraucher nach dem 28. Juni 2025 erbracht werden" (services provided to consumers). No. 5 on that list is "Dienstleistungen im elektronischen Geschäftsverkehr" (e-commerce services).
- **Definition of an e-commerce service, § 2 Nr. 26.** Digital services "die über Webseiten und über Anwendungen auf Mobilgeräten angeboten werden und elektronisch und auf individuelle Anfrage eines Verbrauchers im Hinblick auf den Abschluss eines Verbrauchervertrags erbracht werden".
  - In English: offered through websites or apps, electronically, at a consumer's individual request, with a view to concluding a consumer contract.
  - The EAA wording is the same: "services provided at a distance, through websites and mobile device-based services by electronic means and at the individual request of a consumer with a view to concluding a consumer contract" [EAA Art. 3(30)], recital 42.
- **Definition of a consumer, § 2.** A natural person acting for purposes "die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden können" (mainly outside their trade or self-employed profession). The EAA says the same: "outside his trade, business, craft or profession" [EAA Art. 3(22)].
- **Definition of a service provider, § 2.** Whoever "auf dem Unionsmarkt eine Dienstleistung für Verbraucher erbringt oder anbietet" (provides or offers a service to consumers on the EU market).
- **Micro-enterprise exemption, § 3 Abs. 3.** "Absatz 1 gilt nicht für Kleinstunternehmen, die Dienstleistungen anbieten oder erbringen." Absatz 1 is the accessibility duty, so micro-enterprises that provide services are exempt from it.
  - § 2 defines a Kleinstunternehmen as "weniger als zehn Personen beschäftigt und … entweder einen Jahresumsatz von höchstens 2 Millionen Euro … oder … Jahresbilanzsumme … höchstens 2 Millionen Euro" (fewer than 10 staff, and either turnover or balance sheet total of at most €2M).
  - The EAA has the same rule: "Microenterprises providing services shall be exempt…" [EAA Art. 4(5)], with the same size test [EAA Art. 3(23)] and its reasoning in recital 70.
- **Presumption of conformity, § 4.** Conformity with harmonised standards whose references are published in the EU Official Journal creates a presumption that the requirements are met [BFSG § 4], [EAA Art. 15(1)].
- **Fines, § 37.** Up to €100,000 [BFSG § 37 Abs. 2].

**BFSGV** [BFSGV] is the ordinance that sets the concrete requirements. It was last amended on 10 July 2026.

- **It gives no contrast numbers for websites.**
  - § 12 Nr. 3 requires websites to be "wahrnehmbar, bedienbar, verständlich und robust" (perceivable, operable, understandable, robust).
  - § 12 Nr. 2 lit. f requires service information "mit ausreichendem Kontrast" (with sufficient contrast).
- **§ 19** adds e-commerce extras: identification, authentication, security and payment functions, and "elektronische Signaturen", must be perceivable, operable, understandable and robust.
- **§ 3** says to follow the state of the art ("Stand der Technik"). It also tasks the Bundesfachstelle Barrierefreiheit with publishing the relevant standards.

### 2.2 Where the numbers come from: EN 301 549

- **What exists today.**
  - **Cited version:** the only EN 301 549 version cited in the Official Journal is V3.2.1 (WCAG 2.1 based). It is cited under the Web Accessibility Directive (EU) 2016/2102, through Implementing Decision (EU) 2018/2048 as amended on 11 August 2021 [HS-WAD].
  - **No EAA citation:** the Commission's harmonised-standards index lists no entry for Directive (EU) 2019/882 (checked 2026-11-25) [HS].
- **EN 301 549 V4.1.1 (2026-09).**
  - It was adopted on 24 August 2026 and published on 2 September 2026 [EN4], [ETSI-dir].
  - It was "prepared under the Commission's standardisation request C(2022) 6456" (M/587) for the EAA. Its clauses 9, 10 and 11 "have all been updated to align with the WCAG 2.2 recommendation" [EN4, Foreword].
  - It applies **only once cited in the OJ**: "Once the present document is cited in the Official Journal … compliance … confers … a presumption of conformity" [EN4, Foreword].
  - National deadlines: latest announcement 30 Nov 2026, latest national publication 31 May 2027 [EN4].
- **Its web clauses copy WCAG AA directly.**
  - Clause 9.1.4.3: "the web page shall satisfy WCAG 2.2 Success Criterion 1.4.3 Contrast (Minimum)".
  - Clause 9.1.4.11 does the same for 1.4.11 [EN4].
  - WCAG AAA criteria, 1.4.6 and 2.4.13 among them, appear only in an informative list (clause 9.5) [EN4].
- **Bundesfachstelle Barrierefreiheit** (German federal accessibility agency):
  - Until M/587 standards are cited, "dienen insbesondere die geltende EN 301 549 sowie … WCAG … als maßgebliche Orientierung" (they are the main reference) [BF-Normen].
  - It expects the updated EN to take legal effect "voraussichtlich 2027" (probably in 2027) [BF-Normen].
  - Its e-commerce FAQ: e-commerce websites "müssen bestimmte Barrierefreiheitsanforderungen nach EN 301 549 erfüllen" (must meet certain requirements of EN 301 549) [BF-FAQ-EC, Q2].
- **What this means.** On contrast, every version in play gives the same floor: **WCAG AA, i.e. 1.4.3 and 1.4.11**. The move from 2.1 to 2.2 adds new criteria, such as 2.4.11 Focus Not Obscured and 2.5.8 Target Size, but changes no contrast threshold [WCAG22].

### 2.3 (a) The marketing landing page, aimed at photographers

- **What the law says:** the BFSG covers services "für Verbraucher" (for consumers). A photographer buying studio software buys it for their trade, so they are not a "Verbraucher" [BFSG § 2].
- **What the authorities say:**
  - The Bundesfachstelle: "Dienstleistungen, die ausschließlich [im] Bereich B2B … angeboten werden, sollten also nicht vom BFSG betroffen sein" (services offered exclusively B2B should not be affected) [BF-FAQ, Q14].
  - The Bundesfachstelle on websites: a pure presentation website that only informs or advertises is not an e-commerce service, partly because "das Merkmal der ‚individuellen Anfrage' eines Verbrauchers fehlen dürfte" (the consumer's individual request is likely missing) [BF-FAQ, Q19].
  - On portals: "Sofern die Vertriebsportale nicht auf den Abschluss eines Verbrauchervertrags abzielen, fallen sie nicht in den Anwendungsbereich" (sales portals that do not aim at a consumer contract are out of scope) [BF-FAQ-EC, Q10].
- **Interpretation:** the landing page leads into registration and a paid subscription, so it is not a pure presentation page. It stays out of scope *because the customer is a business*, not because it is informational.
- **Weak spot (unclear):**
  - Part A of our AGB says the terms apply to "registrierte Fotograf:innen" (`apps/web/src/lib/legal-content.ts`). It does not say the offer is **only** for Unternehmer (businesses, § 14 BGB).
  - If a hobbyist could sign up as a consumer, the "exclusively B2B" argument weakens. The fallback would then be the micro-enterprise exemption, if Fotolio qualifies.
  - Whether Fotolio qualifies is unknown here: it depends on Fotolio's own headcount and turnover.
  - A lawyer should confirm whether an explicit B2B-only clause is worth adding.
- **Result:** no legal floor for (a). WCAG AA here is a floor **we set ourselves**. It is still the industry norm, and the landing page is the first thing a prospective customer with a visual impairment sees.

### 2.4 (b) Client-facing pages that consumers use

The pages: the booking request form `/r/[subdomain]`, private galleries `/g/[subdomain]/[token]`, and the customer portal, where clients see invoices and sign contracts (`contract/controller/CustomerContractController.java`).

- **The booking request form is likely in scope** for the photographer (interpretation).
  - The BMAS guidelines' hairdresser example says an online appointment booking is an e-commerce service: "Hierunter fallen sowohl der Verkauf der Haarpflegeprodukte (e-Commerce) als auch die Buchung der Termine. Die gesamte Webseite inklusive Check-out ist … barrierefrei zu gestalten" (both the product sales and the appointment booking are covered; the whole website including checkout must be accessible) [BMAS-LL, Beispiel 3].
  - The Bundesfachstelle repeats this: "exemplarisch auch die Online-Buchung von Terminen" [BF-FAQ, Q19].
  - Our form is a *request*, not a binding booking. But the statutory test is a consumer's "individuelle Anfrage … im Hinblick auf den Abschluss eines Verbrauchervertrags" (individual request with a view to a consumer contract), and a request form fits that wording.
- **Signing a contract in the customer portal is in scope with more certainty.** That is a consumer contract concluded electronically, and BFSGV § 19 Nr. 3 names "elektronische Signaturen" explicitly [BFSGV].
- **Galleries: unclear.** A gallery delivers an already agreed service, so on its own it is arguably not "with a view to concluding" a contract.
  - The Bundesfachstelle reads the rules as covering "tatsächlich die gesamte Website oder App" (the whole website or app), based on BFSGV § 12 Nr. 3 and BFSG Annex 1 [BF-FAQ-EC, Q3/Q6].
  - So a non-micro photographer's galleries could be pulled in too.
  - No galleries offer purchases today, as far as the code shows.
- **Who carries the duty (interpretation):**
  - The *photographer* is the "Dienstleistungserbringer" (service provider). The consumer's contract is with them, and they offer the booking.
  - Fotolio supplies software to the photographer, which is B2B. The BFSG imposes no duty on software suppliers to service providers. Standalone SaaS is not one of the § 1 Abs. 2 products.
  - **Unclear:** the pages run on Fotolio's code and URLs. No source found addresses white-label SaaS that produces consumer-facing pages for a business customer.
- **Micro-enterprise exemption.**
  - Most photographers and small studios have fewer than 10 staff and at most €2M turnover, so they are **exempt** [BFSG § 3 Abs. 3], [BMAS-LL].
  - A studio with 10 or more staff, or above €2M in both turnover and balance sheet, is not exempt. Fotolio cannot know which customers those are.
  - The exemption belongs to each photographer. Fotolio's own size does not matter for (b).

### 2.5 Unclear (needs a lawyer, or depends on facts we do not have)

1. Whether a non-binding booking *request* is a "Dienstleistung im elektronischen Geschäftsverkehr". The BMAS example is a booking.
2. Whether delivery-only galleries are in scope, either on their own or under the whole-website reading.
3. Whether Fotolio, as the vendor that hosts client-facing pages, has any duty of its own.
4. Whether the landing page counts as "exclusively B2B" while the AGB does not limit sign-up to Unternehmer, and whether Fotolio is a micro-enterprise.
5. When EN 301 549 V4.1.1 will be cited under the EAA. The Bundesfachstelle says "voraussichtlich 2027". This does not change the contrast floor.

## 3. Text over photographs (the hero headline)

- **The overlaid headline must meet the floor.** The 1.4.3 "incidental" exception covers text "that [is] part of a picture that contains significant other visual content" [WCAG22 1.4.3], i.e. text *inside* the photo. A headline the page lays over the photo is not part of the picture, so it is not exempt.
- **The test, technique G18** [G18, Procedure]:
  - "Measure the relative luminance of each letter (unless they are all uniform)".
  - Then measure "the background pixels immediately next to the letter".
  - "For aliased letters, use the relative luminance value found two pixels in from the edge of the letter."
- **The quick check, failure F83** [F83]:
  - First compare the text with "the area of the image that is darkest (for dark text) or lightest (for light text)". If that passes, there is no failure.
  - Otherwise check each letter's local background.
  - The failure itself: "sufficient contrast between the text and those parts of the image that are most like the text and behind the text".
- **Fixes W3C names.**
  - Shade the area behind the letters: in the G18 example, "the area behind the text is fogged white so that the picture is very faint and the maximum darkness is still light enough to maintain a 4.5:1 contrast ratio".
  - Add a thin outline of at least 1 px, or a halo [G18].
- **Which threshold applies.** The hero headline is large text, so 3:1, *only* if it renders at 24 px or more at every viewport (Host Grotesk tops out at weight 600; see 1.1). Any smaller line over the photo (eyebrow, sub-line, button label, credit) needs 4.5:1.
- **The floor must hold in every case the page can show:**
  - **Every crop:** with `object-fit: cover`, different pixels sit behind the text at each viewport, and every variation must conform [WCAG22 §5.2.2, note 3].
  - **Every image:** this includes any image rotation from `_landing/stock.ts`.
- **Automated tools cannot check this.** axe-core reports such nodes as *incomplete* ("Element's background color could not be determined due to a background image" / "… background gradient") [axe]. A Playwright and axe check will not cover the hero, so the spec needs a different check.
  - *Our suggestion:* render a screenshot, take the hero image's worst-case luminance under the text box, and compute the ratio.
- **Worst-case scrim (our arithmetic, using the [WCAG22] formula).**
  - CSS blends in gamma-encoded sRGB, so a pure-white pixel under black at opacity *a* becomes channel 255·(1−a).
  - A uniform scrim at these opacities guarantees the ratio over **any** photo, whatever is in it:

| Text colour | Scrim | Opacity for 4.5:1 | Opacity for 3:1 |
|---|---|---|---|
| `#ffffff` | black | ≥ 53.5% | ≥ 41.7% |
| `#f6f1e9` (`--lp-cream`) | black | ≥ 56.7% | ≥ 45.2% |
| `#000000` | white | ≥ 45.6% | ≥ 35.0% |
| `#1c1917` (`--lp-text` light) | white | ≥ 50.7% | ≥ 39.7% |

  - A gradient scrim must reach these values at every pixel behind the text, not only on average.
  - A lighter scrim is fine for a *specific* image, but only if you measure that image at every crop, and the guarantee lapses whenever the image changes.

## 4. Recommended floor

Requirement 1 is the floor itself. Requirements 2 to 6 apply it to the palette. Requirement 7 sets the scope.

1. **WCAG 2.2 Level AA, in both themes independently.** That means 1.4.3 and 1.4.11, plus 2.4.7 and 2.4.11 for focus.
   - Do not rely on the toggle-to-a-conforming-theme fallback (G174).
   - Compute ratios from token values, unrounded, and report them to two decimals. Anything below 4.50 or 3.00 fails.
2. **Text tokens: at least 4.5:1** against every surface they can sit on: `bg`, `band`, `surface` and dark bands.
   - This includes `muted` and `subtle`. Today `subtle` on `band` is 4.91:1 (light), which is the tightest pair.
   - Allow 3:1 only for text that renders at **24 px or more at the smallest viewport**. No landing face is loaded at weight 700, so the 14 pt bold route does not apply.
   - *Our choice, above the floor:* hold the Cormorant Garamond accent to 4.5:1 even when large, because of its thin strokes [WCAG22, large-scale note 1].
3. **Non-text: at least 3:1 against adjacent colours** for:
   - any border or underline that is the only visual cue for an input or control;
   - focus rings, against the surface the component sits on (in both themes);
   - the theme toggle's icon and any selected-state mark;
   - icons that carry meaning.

   Decorative hairlines are exempt. Today `--lp-line` measures 1.24:1 (light) and 1.32:1 (dark), so it must never be the only thing that marks a control.
4. **Focus (our choice, above the floor):** a solid ring of 2 px or more at 3:1 or better, which also meets 2.4.13 (AAA) at almost no cost.
5. **Text over photos:** a scrim sized for the worst case under every text line, using the table in section 3.
   - If you use a lighter scrim, measure each image at the mobile, tablet and desktop crops.
   - Smaller copy on the photo needs 4.5:1. The headline gets 3:1 only if it stays at 24 px or more.
6. **AAA (7:1 for body text) is not required.** EN 301 549 lists it as informative only [EN4 §9.5]. Most current main-text pairs exceed it anyway: `text` on `bg` is 16.50:1 (light) and 16.84:1 (dark).
7. **Scope note for the spec:** this floor is self-imposed for the landing page. It is the **legal** floor (BFSG → EN 301 549 → WCAG AA) for the client-facing consumer pages of any photographer who is not a micro-enterprise. Those pages are out of this map's scope, but they should not fall below it.

## Sources

- **[WCAG22]** W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, W3C Recommendation 12 December 2024. Normative SC text and glossary (*contrast ratio*, *large scale (text)*, *relative luminance*, *conforming alternate version*, §5.2.2). https://www.w3.org/TR/WCAG22/
- **[U143]** W3C WAI, *Understanding SC 1.4.3 Contrast (Minimum)*. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- **[U1411]** W3C WAI, *Understanding SC 1.4.11 Non-text Contrast*. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- **[U2413]** W3C WAI, *Understanding SC 2.4.13 Focus Appearance*. https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html
- **[G18]** W3C WAI, *Technique G18* (updated 06 September 2026). https://www.w3.org/WAI/WCAG22/Techniques/general/G18
- **[F83]** W3C WAI, *Failure F83* (updated 09 March 2026). https://www.w3.org/WAI/WCAG22/Techniques/failures/F83
- **[BFSG]** Barrierefreiheitsstärkungsgesetz vom 16. Juli 2021 (BGBl. I S. 2970), zuletzt geändert durch Art. 32 G v. 6.5.2024: §§ 1, 2, 3, 4, 37. https://www.gesetze-im-internet.de/bfsg/BJNR297010021.html
- **[BFSGV]** Verordnung zum Barrierefreiheitsstärkungsgesetz vom 15. Juni 2022 (BGBl. I S. 928), geändert durch Art. 1 V v. 10.7.2026 (BGBl. 2026 I Nr. 205): §§ 3, 12, 19. https://www.gesetze-im-internet.de/bfsgv/BJNR092800022.html
- **[EAA]** Directive (EU) 2019/882 (OJ L 151, 7.6.2019, p. 70): Art. 2(2), 3, 4(5), 15, recitals 42, 47, 70, Annex I Sections III–IV. https://eur-lex.europa.eu/eli/dir/2019/882/oj (read via http://publications.europa.eu/resource/celex/32019L0882)
- **[EN4]** ETSI/CEN/CENELEC, *EN 301 549 V4.1.1 (2026-09)*, Harmonised European Standard: Foreword, clauses 9.1.4.3, 9.1.4.11, 9.5. https://www.etsi.org/deliver/etsi_en/301500_301599/301549/04.01.01_60/en_301549v040101p.pdf
- **[ETSI-dir]** ETSI deliverables directory for EN 301 549 (V4.1.1 file dated 9/2/2026). https://www.etsi.org/deliver/etsi_en/301500_301599/301549/
- **[HS]** European Commission, *Harmonised Standards* index (checked 2026-11-25). https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards_en
- **[HS-WAD]** European Commission, *Accessibility of websites and mobile applications* harmonised-standard references. https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/accessibility-websites-and-mobile-applications_en
- **[BF-Normen]** Bundesfachstelle Barrierefreiheit, *Normen und Standards zum BFSG*. https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/Normen-und-Standards/normen-und-standards_node.html
- **[BF-FAQ]** Bundesfachstelle Barrierefreiheit, *FAQ zum BFSG* (Stand: Juli 2025): Q14, Q19. https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/FAQ/faq_node.html
- **[BF-FAQ-EC]** Bundesfachstelle Barrierefreiheit, *FAQ zum BFSG – Dienstleistungen im elektronischen Geschäftsverkehr* (Stand: Mai 2025): Q2, Q3, Q6, Q10. https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/FAQ-elektronischer-Geschaeftsverkehr/faq-elektronischer-Geschaeftsverkehr_node.html
- **[BMAS-LL]** BMAS, *Leitlinien für die Anwendung des Barrierefreiheitsstärkungsgesetzes*: Beispiel 3, Kleinstunternehmen. https://www.bmas.de/SharedDocs/Downloads/DE/Teilhabe/leitlinien-barrierefreiheit.pdf
- **[axe]** Deque, axe-core message template (`color-contrast` incomplete reasons `bgImage`, `bgGradient`). https://github.com/dequelabs/axe-core/blob/develop/locales/_template.json
