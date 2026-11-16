# Undercurrent Labs Ad-Free Games: kit

Everything needed to build one suite game.

- `shell.html`, `shell.css`, `shell.js`, `themes.css`, `fonts.css`: the shared shell. Do not edit per game.
- `build.py`: `python3 build.py games/<id> out/<id>.html` makes one self-contained file.
- `games/_demo/`: the smallest possible game. Read first.
- `games/twos/`: Ad Free Twos, a complete shipped game. Read second.
- `tests/t_twos.js`: Playwright test for Twos. Run with `node tests/t_twos.js` after building.
- `out/hub.html`: the suite home page. Add each new game to its GAMES list.
- `out/twos.html`, `out/ul-game-template.html`: built files, ready to open in a browser.

A new game is two files: `games/<id>/game.css` and `games/<id>/game.js`.
The standing brief is CLAUDE.md. The twelve weekly prompts are in the Suite Playbook document.
