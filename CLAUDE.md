# Undercurrent Labs Ad-Free Games

You are building and shipping games for "Undercurrent Labs Ad-Free Games", a suite of small, polished, offline puzzle and arcade games. The owner is Arun, a non-technical solo founder. He tests on a Pixel 8 and with his family. Explain anything he must do in plain steps. Each week he pastes one game prompt. This file is the standing brief for every game.

## The promise (never break these)
- No ads, ever. No analytics, no trackers, no accounts, no network requests of any kind.
- No dark patterns: no lives, energy, timers that lock play, streak guilt, fake urgency, or nagging.
- The free tier is a complete, generous game. Pro (one-time purchase) adds more, it never removes pain.
- Every game works fully offline from one self-contained HTML file.

## This repository
- `shell.html`, `shell.css`, `shell.js`, `themes.css`, `fonts.css`: the shared shell. DO NOT EDIT THESE for a game. If you believe the shell has a bug or lacks something, stop and tell Arun; do not patch it inside the game.
- `build.py`: `python3 build.py games/<id> out/<id>.html` assembles one self-contained file.
- `games/_demo/`: the smallest possible game. Read it first.
- `games/twos/`: a complete shipped game. Read it second and match its quality and style.
- `tests/t_twos.js`: the Playwright test for Twos. Copy its approach. Run with `node tests/t_<id>.js`.
- `out/`: build output for testing.
- `docs/`: THE LIVE WEBSITE (GitHub Pages serves this folder at devaru1230.github.io/games/). `docs/index.html` is the hub with a GAMES list; each game lives at `docs/<id>/index.html`.

A new game is exactly two source files: `games/<id>/game.css` and `games/<id>/game.js`.

## What the shell already does (do not rebuild any of it)
Masthead, Play and Trends tabs, themes (7, three are Pro), player name picker, tutorial cards, New game picker with level list and Daily, Pro paywall and purchase bridge, pause and resume, restart same game, a "New game" control, timer, auto-save every 5 seconds and on app hide, resume after reload, win or loss card with WhatsApp share, records and trends charts, version and changelog card, reset.

## The game contract
`game.js` declares one object: `const GAME = { ... }` (the build adds `UL.boot()` after it).

Required fields:
- `id` lowercase, unique, never changes (it is the storage key)
- `name` "Ad Free <Name>"
- `title` ["FIRST","SECOND"] masthead halves, second is tinted
- `icon` one emoji, used in share text
- `version` "1.0"
- `changelog` [["1.0","First release: ..."]]
- `blurb` one line shown in the New game picker
- `timer` true shows the clock; false hides it (score-attack games)
- `daily` the level id used for the Daily
- `levels` [{id, name, note, pro:1 (optional), ...your own fields}]
- `proPerks` array of short strings for the paywall
- `tutorial` [{icon, title, body}] 2 to 4 cards, plain words
- `start({level, daily, restore})` build the board inside `document.getElementById("stage")`
- `serialize()` return a plain JSON-safe object of the full game state

Optional hooks: `mount(stage)`, `onPause()`, `onResume()`, `onPro()`, `onTheme(id)`, `onReset()`.
Do not set `price` or `sku`; the shell default applies to the whole suite.

How start works: the shell empties `#stage`, `#controls` and `#below`, then calls `GAME.start`. It is called for a new game AND to reload a saved one; when `restore` is present it is exactly what `serialize()` returned and you must rebuild the identical position from it. `#stage` is a square that always fits one phone screen; put your board inside it with `position:absolute; inset:0`. Non-square boards must still fit inside the square.

## The UL API (use these, do not reinvent them)
- Randomness: `UL.rnd(n)` integer 0..n-1, `UL.random()` 0..1, `UL.pick(array)`, `UL.shuffle(array)`. Use ONLY these for anything that affects the game. Never `Math.random`. This is what makes Restart and the Daily replay the identical game on every device.
- State: `UL.cur {level, daily, seed, sec, score, over, paused}`; `UL.paused()`; `UL.save()` after every move; `UL.kv(key, fallback)` and `UL.setKv(key, value)` for game-scoped settings and bests.
- Score and status: `UL.setScore(n)`, `UL.addScore(n)`, `UL.setStat(html)` for the status line, `UL.fmtTime(sec)`.
- Controls: `UL.ctrl({icon, label, onTap})` adds a button under the board and returns it (it has `.setLabel(text)`; toggle classes `on` and `dim`). Icons: undo, erase, pencil, bolt, hint, fresh, flag, shuffle. Use at most 4; the shell adds "New game".
- Ending: `UL.end({won:true|false, title, line})`. `line` is the one-line result used in the share text.
- Pro: `UL.isPro()`; at the top of any Pro-only action write `if(!UL.requirePro("Unlimited undo is part of Pro.")) return;`. Levels marked `pro:1` are gated by the shell.
- Feel: `UL.buzz("tap"|"act"|"err"|"wow"|"win")`, `UL.pop(el)`, `UL.shake(el)`, `UL.sweep(arrayOfEls, stepMs)`, `UL.toast(msg)`, `UL.badge(el, text)`, `UL.confetti()`.
- Praise: `UL.praise(el, tier)` and `UL.milestone(el, text)`. The shell picks the word, limits how often it shows, and keeps the badge on screen.

## The reward rules (the heart of the suite)
Every correct action gets an instant, small, physical response: a pop, a soft haptic, a number ticking up. That is the baseline and it needs no words.

Words are rationed by skill:
- Tier 1: a good ordinary move. Shown only sometimes.
- Tier 2: a clearly good move.
- Tier 3: a skilled move that most players do not make every game.
- Tier 4: superlatives. ONLY for rare, genuinely expert play. A casual player should see tier 4 less than once a game.

Milestones (`UL.milestone` + `UL.confetti`) are for reaching the level goal or a personal best. Never praise a mistake, a forced move, or something the game did for the player. Never stack effects. Mistakes get a short shake and an "err" buzz, never a lecture. Each game prompt lists which moves earn which tier. Follow it, then tune by playing.

## Design rules
- Colours: only the theme tokens `--cream --ink --gold --gold-deep --muted --line --sel --peer --same --err --err-bg --cellbg --radius`. For shades use `color-mix(in srgb, var(--gold) X%, var(--cellbg))`. No hard-coded colours, except where the game needs distinct piece colours; then define them once as CSS variables, check them on all 7 themes, and never rely on colour alone (add a shape, letter or pattern).
- Fonts: Fraunces for numbers and headings, Inter for text, JetBrains Mono for small labels. Already embedded.
- Class names carry a two-letter game prefix (`tw-` for Twos) so they never collide with the shell.
- Touch first: targets at least 40px, pointer events, no hover-only behaviour, no long-press as the only way to do something. Keyboard works too where it makes sense.
- Animations under 250ms, transform and opacity only, and respect `prefers-reduced-motion`.
- No images, no external files, no libraries, no network. Draw with CSS and inline SVG.
- One screen, no scrolling during play, at 360x640 and at 412x915.

## Originality
Game mechanics are free to use. Names, logos, art, level sets and distinctive looks of existing commercial games are not. Use only the name Arun gives. Do not copy any existing game's colour scheme, tile art, sounds or wording. Generate every level in code from the seeded random functions; never include a level pack or word list taken from another product.

## How to work
1. Read `games/_demo` and `games/twos` fully before writing anything.
2. Work on a branch named `game/<id>`. Write `game.css` and `game.js`. Build with `build.py`.
3. Write `tests/t_<id>.js` with Playwright (offline context, 412x860) and run it. It must cover at least:
   - first run: name picker, then tutorial, then level picker
   - a free level starts; a Pro level shows the paywall in the free tier and starts once Pro is on
   - Restart replays the identical starting position
   - the Daily is identical in two separate browser contexts
   - save, reload, and the exact position and score come back
   - a full win and a full loss both reach the end card and write a record; Trends shows it
   - every free limit (for example undo count) holds, and lifts with Pro
   - zero network requests and zero page errors for the whole run
   - nothing overflows the stage at 360x640

   Also test the game's own logic directly (generator validity, solvability, scoring) over at least 200 seeded games.
4. Take screenshots of mid-game on the "clear" and "night" themes and look at them. Fix what looks wrong.
5. Play it yourself through the test browser for a few full games and tune the praise tiers so tier 4 stays rare.
6. Re-run `tests/t_twos.js` and every other existing test. A new game must not break an old one.

## What to give Arun when a build is ready
- `out/<id>.html` sent to him as a file so he can open it on his phone before anything is published
- the PASS/FAIL output of the tests, unedited
- two screenshots
- a short note in plain words: what is free, what is Pro, anything you are unsure about, and what you would improve in version 1.1

If a test fails, say so plainly. Do not say it is finished until every check passes.

## Shipping (only when Arun says "ship it")
Never publish on your own. `docs/` is the public website; a push to `main` goes live within minutes.
1. Copy `out/<id>.html` to `docs/<id>/index.html`.
2. In `docs/index.html`, update the GAMES list: the new game gets `status:"new"`, last week's becomes `"live"`, and next week's is listed as `"soon"`.
3. Commit, merge to `main`, push.
4. Give Arun the live link `https://devaru1230.github.io/games/<id>/` and remind him to open it on his phone.
5. Remind him that the Play Store app needs the same file copied in and its version code raised by one.

## Things you must not do
- Do not add any dependency, CDN link, font link, analytics or network call.
- Do not edit the shell for one game.
- Do not touch anything outside this repository. The family unlock key in `shell.js` is private; never print it in a reply, README or commit message.
- Ad Free Sudoku lives in a separate repository (`adfreesudoku`) and is not built on this shell. Leave it alone unless Arun asks.
