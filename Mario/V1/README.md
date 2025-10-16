Mini Mario - HTML + JSON level

Files:
- `index.html` - main HTML page
- `styles.css` - styles and layout
- `game.js` - lightweight platformer engine
- `levels.json` - sample level data

How to run:
1. Run a simple static server in the project folder. Example (PowerShell):

   python -m http.server 8000

2. Open http://localhost:8000 in your browser.

Controls:
- Left/Right arrows or A/D: move
- Up arrow, W, or Space: jump
- R: restart level

Notes:
- Levels are read from `levels.json`. Each tile row is a string; characters: '.' empty, 'T' tile (solid), 'C' coin, 'G' goal.
- The code is intentionally small and easy to extend.
