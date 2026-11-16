#!/usr/bin/env python3
"""Assemble one self-contained game file:  python3 build.py games/<id> out/<id>.html"""
import sys, pathlib
root = pathlib.Path(__file__).parent
g = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
r = lambda p: p.read_text(encoding="utf-8").rstrip()+"\n"
html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#101820">
<title>Undercurrent Labs Ad-Free Games</title>
<style>
/* ---- fonts, built in so the game looks the same offline ---- */
{r(root/'fonts.css')}</style>
<style>
/* ---- SHELL STYLES (shared, do not edit per game) ---- */
{r(root/'themes.css')}{r(root/'shell.css')}
/* ==== GAME STYLES START ==== */
{r(g/'game.css')}/* ==== GAME STYLES END ==== */
</style>
</head>
<body>
{r(root/'shell.html')}
<script>
{r(root/'shell.js')}
/* ==== GAME START ==== */
{r(g/'game.js')}/* ==== GAME END ==== */

UL.boot();
</script>
</body>
</html>
"""
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"{out}  {len(html.encode())/1024:.1f} KB")
