BEC ’26 Portrait Maker — plain static files

Upload index.html, style.css, script.js together to the root of any static hosting service (Netlify, Vercel static, GitHub Pages). No npm, build command, or server code is needed. Or run `python3 -m http.server 8000` in this folder and open http://localhost:8000.

An internet connection is needed for the Anton font and automatic background removal model. Processing happens in the visitor's browser. A transparent PNG can still be used if background removal fails. The initial model download can take a minute. The result is a 1120 × 1400 PNG.
