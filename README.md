# Sonoarchive

Desktop shell and Python package for the Sonoarchive prototype. This scaffold opens an empty window and does not tag audio.

## Desktop

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
```

`npm run dev` opens one window with Library, Tag, and Search.

## Python

Requires Python 3.11 or newer. Run these commands from `python/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -m pytest
```

The offline model commands need the extra `offline` dependencies (`pip install -e ".[offline]"`). From `python/`:

```bash
python -m sonoarchive.export_cnn14
python -m sonoarchive.export_probe
python -m sonoarchive.fref
python -m sonoarchive.parity
```
