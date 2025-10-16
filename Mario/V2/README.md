Mini Mario V2

Files:
- `index.html` - improved UI with level select
- `styles.css` - styles
- `game.js` - improved engine with enemies, one-way platforms, slopes, and audio
- `levels.json` - multiple sample levels
- `editor.html` - simple level editor (edit tiles and export JSON to clipboard)
- `start-server.ps1` - convenience script to run a static server

How to run (PowerShell):

1. Open PowerShell in this folder:
   cd 'd:\Midou\Coding\Html_json-projects\Mario\V2'
2. Start server (this will run until you stop it):

   .\start-server.ps1

3. Open http://localhost:8000 in your browser.

Controls and tips:
- Use the level select + Start to switch levels.
- Click the canvas to place a coin (dev helper).
- Open `editor.html` to edit the tile rows and Export to copy JSON for a level.

Future improvements:
- Import/Export levels directly into levels.json from the editor.
- Add sprite sheets, animated sprites, and music tracks.
- More advanced collision (slopes math), moving platforms, and enemy behaviors.
