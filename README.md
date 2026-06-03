# 🎨 ChromaVault

An interactive color palette generator with a draggable color wheel, harmony presets, and multi‑format exports.

![ChromaVault screenshot]()

## ✨ Features

- **Live color wheel** – Drag any color point, hear subtle audio feedback.
- **Harmony shapes** – Complementary, Triadic, Split‑complementary, Tetradic, Pentadic.
- **Grayscale core** – Pick neutrals from black to white in the wheel’s center.
- **Manual mode** – Freely position each swatch anywhere on the wheel.
- **Save palettes** – Store your favorite combinations in the sidebar (local storage).
- **Copy palette** – HEX, RGB, HSV, HSL, CSS variables, or Midjourney prompt.
- **Export PNG** – Beautifully formatted swatch card with your palette.
- **Ambient sound** – Optional background audio with volume control.

## 🧰 Tech Stack

- React 18 + TypeScript
- HTML Canvas (color wheel & markers)
- CSS Modules / custom styling
- Web Audio API (tick feedback)

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/kerneljay/ChromaVault.git
cd ChromaVault

# Install dependencies
npm install

# Run the development server
npm start