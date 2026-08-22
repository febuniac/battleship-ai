# Bugs found during development and QA

Only bugs that were actually reproduced are listed here. Each one was seen in the running game
before it was fixed.

## Bug 1: An invalid overlapping placement deleted the ship it overlapped

**What happened:**
During placement, with the Carrier already on the board, selecting the Battleship and trying to
drop it on top of the Carrier was correctly rejected — but the Carrier was taken off the board at
the same time, and the selection jumped from the Battleship back to the Carrier. The player had to
place the Carrier all over again, and it was easy not to notice that it had gone.

**How we found it:**
Manual QA of the placement screen: place one ship, select another, aim it deliberately at the first
one.

**Why it happened:**
Clicking a cell meant two different things. Clicking an occupied cell was the shortcut for "pick
that ship back up", and that check ran first — before the placement attempt. So a click that the
player intended as "put the Battleship here" was read as "lift the Carrier", and the rejection
message that followed described a board that had already been changed.

**How we fixed it:**
A click on an occupied cell only picks that ship up when no ship is waiting to be placed. While a
ship is selected for placement the click stays a placement attempt, so the engine rejects it and
nothing on the board changes. Ships can still be picked up deliberately from the fleet list at any
time.

**How we verified the fix:**
We reproduced the bug in Chrome on the old code (the Carrier disappeared and the selection
changed), then re-ran the same steps on the fix: the placement is rejected, the Carrier stays
exactly where it was, "Overlaps Carrier" is shown, the Battleship stays selected and places
normally on the next click. Seven automated placement tests now cover full overlap, partial
overlap, a perpendicular crossing, overlapping a vertical ship and an off-board attempt, each
asserting the existing ship keeps its exact cells and orientation.

**Severity:**
High

## Bug 2: Muted text was too pale to read

**What happened:**
Small grey text around the game — the board captions, the coordinate letters and numbers, the
"what just happened" line, the fleet labels — was too light against the near-white background.
It looked elegant at a glance but was genuinely hard to read, and it fell below the accessibility
standard (WCAG AA) that a submission like this is expected to meet.

**How we found it:**
The final QA pass measured the contrast of every piece of visible text on the opening screen,
the rules modal, placement, battle and game over. Six of those measurements came back below the
required ratio — the palest text was at about 3.0 where 4.5 is required.

**Why it happened:**
The light art direction pushed the muted greys and the accent colours several steps lighter to
make the interface feel airy. Contrast had been judged by eye, and because much of the text sits
on translucent "glass" panels rather than a solid colour, the real contrast was lower than it
looked.

**How we fixed it:**
We darkened the four affected colours (the two muted greys, the hit red and the status blue) just
enough to clear the standard, without changing the light, minimal look.

**How we verified the fix:**
The same measurement now passes on all five screens, and it is a permanent Playwright test, so a
future palette change that makes text too pale fails the build. We confirmed the test really
catches the problem by putting the old colour back — the test failed at 2.96 — and then restoring
the fix.

**Severity:**
Medium

## Bug 3: The enemy board still said "locked" after you won

**What happened:**
After sinking the last enemy ship, the caption under the enemy board read "Locked while the AI
plays". The game was over and the player had won, so the message was simply wrong and briefly
suggested the AI was still taking a turn.

**How we found it:**
Manual play-through in Chrome: we finished a full game and read the screen after the winning shot,
instead of only looking at the victory overlay.

**Why it happened:**
The caption only distinguished two situations — "you can fire" and "not your turn". Game over
falls into neither, so it silently fell through to the "not your turn" wording.

**How we fixed it:**
The caption now handles game over explicitly and reads "Game over".

**How we verified the fix:**
Replayed a game to victory in the browser and confirmed the caption; the end-to-end test also
plays a full game and asserts the finished board is locked and shows the game-over state.

**Severity:**
Low

## Bug 4: Vertical ships looked like thin slivers

**What happened:**
When the new realistic ship graphics shipped, ships placed vertically rendered as very narrow
slivers instead of proper vessels. Horizontal ships looked correct, so the same ship changed shape
depending on which way the player rotated it.

**How we found it:**
Browser QA of the ship redesign at desktop, tablet and phone widths — we placed each of the five
ships both horizontally and vertically and compared them.

**Why it happened:**
Each ship is drawn once as a wide horizontal shape and rotated for vertical placement. The hull
was drawn thin relative to its length, which is fine across five cells but becomes a sliver when
that same shape is squeezed into one cell of width.

**How we fixed it:**
The hulls were redrawn to fill much more of their cell, so a ship reads as a solid vessel in both
orientations.

**How we verified the fix:**
Re-inspected all five ships in both orientations at all three viewport sizes, and a visual QA pass
measured the rendered ship graphics to confirm they span their cells rather than collapsing.

**Severity:**
Medium

## Bug 5: Cruiser and Submarine were impossible to tell apart on a phone

**What happened:**
The Cruiser and the Submarine both occupy three cells, and at phone size their silhouettes looked
essentially identical. The whole point of the redesign was that a player can recognise each ship,
so on mobile that failed.

**How we found it:**
The same browser QA pass, viewed at 390px wide.

**Why it happened:**
The two shapes differed mainly in fine detail — a slightly different superstructure — and those
details disappear once a three-cell ship is only about 100px long.

**How we fixed it:**
The Submarine was given a distinctly different profile: a taller sail with periscope masts and a
rounded hull, so the difference survives at small sizes.

**How we verified the fix:**
Placed both ships side by side at 390px and confirmed they are immediately distinguishable; a
visual QA check also verifies the two ships render different graphics.

**Severity:**
Low

## QA Summary

- **Real bugs found:** 5
- **Bugs fixed:** 5
- **By severity:** Critical 0 · High 1 · Medium 2 · Low 2

**Most important bug:** the overlapping placement deleting an already-placed ship (Bug 1). It was
the only bug that destroyed work the player had already done, and it happened during a completely
ordinary action.

**Most valuable test:** manual play in the browser. Every bug except the contrast failure was found
by a person using the game — the destructive placement, the wrong game-over caption and both
ship-drawing problems. The runner-up is the automated contrast measurement added in final QA: it
found a real accessibility problem that four rounds of looking at the screen had missed, and it now
protects the palette permanently.

**Known limitations:**

- Below the desktop breakpoint the two boards stack, so the battle screen scrolls vertically on a
  tablet in portrait. This is a deliberate layout choice, not a defect.
- Between the desktop breakpoint and about 820px wide the ships are drawn small; they remain
  readable but the detail is less visible than on desktop.
- The AI is a single difficulty (hunt/target with parity). No easy or hard mode.
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
