<div align="center">

<img src="docs/gemma-logo.svg" width="64" height="64" alt="Gemma">

# Gemma 4 Local

**Run Google's Gemma 4 AI entirely on your Mac. No internet. No subscriptions. Free forever.**

[![Download](https://img.shields.io/github/v/release/mario-hernandez/gemma4-local?label=Download&style=for-the-badge)](https://github.com/mario-hernandez/gemma4-local/releases)
[![Landing](https://img.shields.io/badge/Website-Live-blue?style=for-the-badge)](https://mario-hernandez.github.io/gemma4-local/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<img src="docs/macbook-mockup.jpg" width="600" alt="Gemma 4 Local running on a MacBook Pro">

</div>

---

## What is this?

A native Mac app that lets you chat with Google's Gemma 4 AI model — completely offline. Your conversations never leave your machine. No account needed, no API keys, no monthly fees.

## Features

- **100% offline** — works without internet, on a plane, anywhere
- **Private** — zero telemetry, no data sent anywhere, ever
- **Thinking mode** — toggle with Cmd+T for step-by-step reasoning
- **Conversation history** — auto-saved, searchable across all chats
- **Inline controls** — temperature, tokens, thinking mode right above the input
- **Multimodal** — text, images and audio (Gemma 4 E4B)
- **Benchmark slideshow** — see how it compares to paid models
- **Signed & notarized** — Apple Developer ID, opens without security warnings

## Requirements

- Mac with Apple Silicon (M1, M2, M3, M4)
- 16 GB RAM
- macOS 13 Ventura or later
- ~7 GB free disk space

## Install

1. [Download the DMG](https://github.com/mario-hernandez/gemma4-local/releases/latest)
2. Open it, drag to Applications
3. Open the app, click "Iniciar modelo"
4. Wait ~10 seconds while the model loads into memory
5. Chat

The first launch downloads the model (~5 GB) from HuggingFace. After that, everything runs locally.

## Benchmarks

Gemma 4 E4B (free, local) vs paid API models:

| Benchmark | Gemma 4 E4B | GPT-4o mini | Claude 3.5 Haiku |
|-----------|------------|-------------|-----------------|
| MMLU Pro | **69.4** | 63.1 | 65.0 |
| LiveCodeBench | **52.0** | 23.4 | 31.4 |
| GPQA Diamond | **58.6** | 44.2 | 41.6 |

It beats every paid lightweight model. [See the full comparison →](https://mario-hernandez.github.io/gemma4-local/)

## How it works

The app bundles a Python virtual environment with [vMLX](https://github.com/jjang-ai/vmlx) (an MLX-based inference engine optimized for Apple Silicon). When you click "Iniciar modelo", it starts a local server and loads the Gemma 4 E4B model into GPU memory. The Electron frontend communicates with it via a local API. Nothing touches the network.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+T` | Toggle thinking mode |
| `Cmd+N` | New conversation |
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `Cmd+Q` | Quit (stops model, frees RAM) |

## Security audit

The vMLX engine was [fully audited](https://github.com/jjang-ai/vmlx) before integration:

- **No telemetry** — zero outbound connections
- **No eval/exec** — only `mx.eval()` (MLX GPU sync)
- **No pickle** — all weights loaded via safetensors
- **API key auth** — optional, for network exposure
- **Agentic tools disabled** — shell execution features are off by default

## Uninstall

```bash
# Remove the app
rm -rf "/Applications/Gemma 4 Local.app"

# Remove the model (~5 GB)
rm -rf ~/.cache/huggingface/hub/models--mlx-community--gemma-4-e4b-it-4bit

# Remove the project (if installed from source)
rm -rf ~/Desarrollo/vmlx-gemma4-gqck2
```

Nothing else is modified. No daemons, no PATH changes, no config files.

## Legal

This is an independent project. Not affiliated with Google, Alphabet, or DeepMind. "Gemma" is a trademark of Google LLC. Model weights are licensed under [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) by Google. See [NOTICE](NOTICE) for full trademark attributions.

## License

[MIT](LICENSE) — the app code is yours to use, modify, and distribute.

---

<div align="center">
  <sub>Built by <a href="https://github.com/mario-hernandez">Mario Hernandez</a> · <a href="https://x.com/mariohernandez">@mariohernandez</a></sub>
</div>
