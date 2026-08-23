# Bugs found during development and QA

Only bugs I actually reproduced in the running game are listed here. Each one was seen before it
was fixed.

## Bug 1: Invalid ship placement could remove an already placed ship

**What happened:**
During placement, with the Carrier already on the board, I selected the Battleship and tried to
drop it on top of the Carrier. The placement was correctly rejected — but the Carrier was taken off
the board at the same time, and the selection jumped from the Battleship back to the Carrier. I had
to place the Carrier all over again, and it was easy not to notice that it had gone.

**How I found it:**
Manual QA of the placement screen: I placed one ship, selected another, and deliberately aimed it
at the first one.

**Why it happened:**
A click on a cell meant two different things. Clicking an occupied cell was the shortcut for "pick
that ship back up", and that check ran first — before the placement attempt. So a click I intended
as "put the Battleship here" was read as "lift the Carrier", and the rejection message that
followed described a board that had already been changed.

**How I fixed it:**
I made the pick-up shortcut apply only when no ship is waiting to be placed. While a ship is
selected for placement the click stays a placement attempt, so the engine rejects it and nothing on
the board changes. Ships can still be picked up deliberately from the fleet list at any time.

**How I verified it:**
I reproduced the bug in Chrome on the old code (the Carrier disappeared and the selection changed),
then re-ran the same steps on the fix: the placement is rejected, the Carrier stays exactly where it
was, "Overlaps Carrier" is shown, and the Battleship stays selected and places normally on the next
click. I also added automated placement tests covering a full overlap, a partial overlap, a
perpendicular crossing, an overlap with a vertical ship and an off-board attempt, each asserting the
existing ship keeps its exact cells and orientation.

**Severity:**
High

## Bug 2: Muted text was too pale to read

**What happened:**
Small grey text around the game — the board captions, the coordinate letters and numbers, the
"what just happened" line, the fleet labels — was too light against the near-white background. It
looked elegant at a glance but was genuinely hard to read, and it fell below the accessibility
standard (WCAG AA) that a submission like this is expected to meet.

**How I found it:**
In the final QA pass I measured the contrast of every piece of visible text on the opening screen,
the rules modal, placement, battle and game over. Six of those measurements came back below the
required ratio — the palest text was at about 3.0 where 4.5 is required.

**Why it happened:**
The light art direction pushed the muted greys and the accent colours several steps lighter to make
the interface feel airy. I had judged contrast by eye, and because much of the text sits on
translucent "glass" panels rather than a solid colour, the real contrast was lower than it looked.

**How I fixed it:**
I darkened the four affected colours (the two muted greys, the hit red and the status blue) just
enough to clear the standard, without changing the light, minimal look.

**How I verified it:**
The same measurement now passes on all five screens, and I turned it into a permanent Playwright
test, so a future palette change that makes text too pale fails the build. I confirmed the test
really catches the problem by putting the old colour back — it failed at 2.96 — and then restoring
the fix.

**Severity:**
Medium

## Bug 3: Vertical ships looked like thin slivers

**What happened:**
When the realistic ship graphics shipped, ships placed vertically rendered as very narrow slivers
instead of proper vessels. Horizontal ships looked correct, so the same ship changed shape depending
on which way I rotated it.

**How I found it:**
Browser QA of the ship redesign at desktop, tablet and phone widths — I placed each of the five
ships both horizontally and vertically and compared them.

**Why it happened:**
Each ship is drawn once as a wide horizontal shape and rotated for vertical placement. The hull was
drawn thin relative to its length, which is fine across five cells but becomes a sliver when that
same shape is squeezed into one cell of width.

**How I fixed it:**
I redrew the hulls to fill much more of their cell, so a ship reads as a solid vessel in both
orientations.

**How I verified it:**
I re-inspected all five ships in both orientations at all three viewport sizes, and a visual QA pass
measures the rendered ship graphics to confirm they span their cells rather than collapsing.

**Severity:**
Medium

## Bug 4: Cruiser and Submarine were difficult to distinguish on mobile

**What happened:**
The Cruiser and the Submarine both occupy three cells, and at phone size their silhouettes looked
essentially identical. The whole point of the redesign was that a player can recognise each ship, so
on mobile that failed.

**How I found it:**
The same browser QA pass, viewed at 390px wide.

**Why it happened:**
The two shapes differed mainly in fine detail — a slightly different superstructure — and those
details disappear once a three-cell ship is only about 100px long.

**How I fixed it:**
I gave the Submarine a distinctly different profile: a taller sail with periscope masts and a
rounded hull, so the difference survives at small sizes.

**How I verified it:**
I placed both ships at 390px and confirmed they are immediately distinguishable; a visual QA check
also verifies the two ships render different graphics.

**Severity:**
Low

## Bug 5: The enemy board showed the wrong state after victory

**What happened:**
After sinking the last enemy ship, the caption under the enemy board read "Locked while the AI
plays". The game was over and I had won, so the message was simply wrong and suggested the AI was
still taking a turn.

**How I found it:**
Manual play-through in Chrome: I finished a full game and read the whole screen after the winning
shot, instead of only looking at the victory overlay.

**Why it happened:**
The caption only distinguished two situations — "you can fire" and "not your turn". Game over falls
into neither, so it silently fell through to the "not your turn" wording.

**How I fixed it:**
The caption now handles game over explicitly and reads "Game over".

**How I verified it:**
I replayed a game to victory in the browser and confirmed the caption; the end-to-end test also
plays a full game and asserts the finished board is locked and shows the game-over state.

**Severity:**
Low

## QA Summary

- **Real bugs found:** 5
- **Bugs fixed:** 5
- **By severity:** Critical 0 · High 1 · Medium 2 · Low 2

**Most important bug:** invalid placement removing an already placed ship (Bug 1). It was the only
bug that destroyed work I had already done, and it happened during a completely ordinary action.

**Most valuable test:** manual play in the browser. Four of the five bugs came from actually using
the game — the destructive placement, the wrong caption after victory and both ship-drawing
problems. The runner-up is the automated contrast measurement I added in final QA: it found a real
accessibility problem that several rounds of looking at the screen had missed, and it now protects
the palette permanently.

**Known limitations:**

- Below the desktop breakpoint the two boards stack, so the battle screen scrolls vertically on a
  tablet in portrait. This is a deliberate layout choice, not a defect.
- Between the desktop breakpoint and about 820px wide the ships are drawn small; they remain
  readable but the detail is less visible than on desktop.
- The AI is a single difficulty (hunt/target with parity). There is no easy or hard mode.
- Nothing is persisted: reloading the page abandons the game in progress.

## Validation

Everything below was run on the final commit of this branch.

| Check                                                                                           | Result                                                                |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Typecheck, lint, format                                                                         | pass                                                                  |
| Unit / UI tests (Vitest, engine + jsdom)                                                        | 133 passed, 0 failed                                                  |
| Coverage (engine + AI)                                                                          | 96.6% statements, 92.1% branches, 100% functions (thresholds 90%)     |
| End-to-end (Playwright, Chromium, production bundle)                                            | 4 passed                                                              |
| Production build                                                                                | pass — 219 kB JS / 34 kB CSS (69 kB / 7 kB gzipped)                   |
| AI self-play simulation                                                                         | 500 seeded games, 0 illegal moves, 254/246 win split, mean 47.3 shots |
| Browser QA (Chrome, scripted, full game played)                                                 | 35 gameplay/turn-ownership checks passed, no console errors           |
| Keyboard and accessibility                                                                      | 19 keyboard checks + 11 accessibility checks passed                   |
| Contrast (5 screens, glass surfaces composited)                                                 | pass at WCAG AA                                                       |
| Responsive (1440 desktop, 1024/834 tablet, 390 mobile)                                          | 33 checks passed, no horizontal overflow, no clipped boards or ships  |
| Opening screen and rules modal                                                                  | 39 checks passed                                                      |
| Placement (all five ships, rotation, invalid, overlap, out of bounds, randomize, clear, gating) | 29 checks passed                                                      |
| Non-destructive invalid placement (browser, reproduced before the fix, passing after)           | 17 checks passed                                                      |
| Full journey regression (opening → rules → placement → battle → game over → play again)         | 60 checks passed at 1440 desktop and 390 mobile (touch)               |
