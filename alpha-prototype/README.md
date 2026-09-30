# Alpha Prototype

An offline AI chat app that runs **LFM2.5-350M** entirely on the phone, in the browser, using WebGPU.
Installable as a PWA (Add to Home Screen). After the first model download it works with no internet.

## Deploy on GitHub Pages

1. Create a new GitHub repository and upload every file from this folder, keeping the structure
   (including the hidden `.github/workflows/pages.yml`). If your file picker hides dotfiles, create that
   file in the GitHub web editor with **Add file > Create new file** and paste the contents.
2. In the repo go to **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The **Deploy to GitHub Pages** workflow runs (see the Actions tab).
4. Open `https://<your-username>.github.io/<repo-name>/` on your phone.
5. iPhone: open it in Safari, tap Share, **Add to Home Screen**, then open the app from the Home Screen
   before downloading the model. Android: Chrome menu, **Install app**.

All paths are relative, so it works under the `/<repo-name>/` sub-path with no changes.

## Configuration

- **Model**: `MODEL_ID` in `worker.js` is `LiquidAI/LFM2.5-350M-ONNX` (q4, WebGPU). It downloads from Hugging Face on first use.
- **Pin the library version** once everything works. `worker.js` imports `@huggingface/transformers` from jsDelivr
  unpinned. Run `npm view @huggingface/transformers version` and change the URL to `.../transformers@X.Y.Z`.
- **Updating the app**: when you change any app file, bump `SHELL` in `sw.js` (`shell-v9` to `shell-v10`).
  Files are served cache-first, so phones will not see changes otherwise.

## Requirements and limits

- Needs **WebGPU**: iOS/iPadOS 26 or newer (Safari), or Chrome 121+ on a compatible Android phone.
  Phones without WebGPU see a clear message. There is no CPU fallback.
- First run needs internet twice over: the app files and library, then the model download. Keep the screen open.
- Chats are stored in the browser on the device (up to 30). Clearing site data removes chats and the downloaded model.
- The model is released under the LFM 1.0 license. Read its terms before any commercial use.

## Testing checklist

1. Desktop Chrome: open the site, download, chat. Watch the tokens/s line under each reply.
2. Install to Home Screen, download the model, close the app.
3. Turn on airplane mode and reopen the app from the Home Screen. It should load the model and answer.
4. Test on the oldest phone you support (for example iPhone 11) with other apps open.

## Files

- `index.html` interface and styling
- `app.js` app logic, chat history, latency effects
- `worker.js` loads the model and generates text off the main thread
- `sw.js` service worker for offline use
- `manifest.webmanifest`, `icon-*.png` PWA install info
- `.github/workflows/pages.yml` GitHub Pages deployment
