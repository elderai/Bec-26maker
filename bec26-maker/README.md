# BEC ’26 Portrait Maker

A static Vite app that removes a photo background in the visitor's browser and draws the BEC ’26 poster with Canvas. No account or server is required.

## Run locally

```bash
npm install
npm run dev
```

## Host online

Push this folder to GitHub, then import it into Vercel or Netlify. Set the build command to `npm run build` and output directory to `dist`. Or run `npm run build` and upload `dist/` to any static host.

The first portrait can take a minute while the browser downloads the segmentation model. A modern browser with WebAssembly and an internet connection is required. The app does not upload visitor photos to the site, but it loads the model files from IMG.LY's CDN. Test the exact browser devices you expect visitors to use.

`@imgly/background-removal` is AGPL licensed. Review its terms before hosting a modified/public version or arrange a commercial license with IMG.LY if needed.
