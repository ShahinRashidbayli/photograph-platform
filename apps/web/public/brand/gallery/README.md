# Landing gallery preview photographs

The hero tile in the "Run your studio without the busywork" section shows a mock
client gallery. It is the first thing a photographer looks at, and until these
files exist it renders as abstract colour gradients — which invites exactly the
wrong question from exactly the wrong visitor ("do they not have any actual
photos?").

## What to drop here

Eight JPEGs, named `01.jpg` … `08.jpg`, **plus one line each** in
`GALLERY_FRAMES` (`apps/web/src/app/LandingPage.tsx`): set `src` on the frame
you just filled, e.g. `{ no: '25', ar: '1 / 1', src: '/brand/gallery/02.jpg' }`.

The frames used to name all eight paths up front so the files could be dropped
in without touching the page. That cost eight 404s on every single load of the
landing page, for files nobody ever committed — a browser cannot fall back to
the gradient without asking for the image first. A path in that array is a
promise the file exists, so the file goes in first.

A frame with no `src` paints the duotone gradient alone, which is what all
eight show today. Add them one at a time if you like.

| File | Aspect ratio | Notes |
|--------|--------------|-------------------------------------------|
| 01.jpg | 3 : 4 | portrait — carries a "favourited" heart |
| 02.jpg | 1 : 1 | square |
| 03.jpg | 1 : 1 | square — carries the "selected" ring + tick |
| 04.jpg | 4 : 5 | portrait |
| 05.jpg | 1 : 1 | square |
| 06.jpg | 3 : 4 | portrait — carries a "favourited" heart |
| 07.jpg | 4 : 5 | portrait |
| 08.jpg | 1 : 1 | square |

The frames are `background-size: cover`, so a file that is not exactly the ratio
above is centre-cropped rather than distorted — the ratio is what the *frame*
uses, not a requirement on the file.

## Guidance

- **Wedding and portrait work**, since that is what the sample gallery is called
  (`Lena & Kaan`) and what the target customer shoots. A mix of ceremony,
  couple and detail shots reads like a real delivery; eight portraits of the
  same pose does not.
- **Roughly 1400px on the long edge, ~80% quality.** These render at a few
  hundred pixels wide in a masonry column, and eight full-resolution files on
  the landing page is a real load cost. For reference, the two existing brand
  photographs (`../auth-visual.jpg`) are 1050×1400 and ~240 KB each.
- **Check the licence.** Client work needs the couple's permission — a landing
  page is publication. Unsplash and Pexels are fine for placeholders; keep a
  note of the source either way.
- **Look at both themes** after adding them. Each frame paints a dark shade
  overlay (`gpShade`) so the white heart and tick stay legible, which a very
  bright, high-key image can fight.
