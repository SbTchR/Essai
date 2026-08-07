#!/usr/bin/env python3
from pathlib import Path


app = Path("app/src/App.tsx").read_text(encoding="utf-8")
types = Path("app/src/types.ts").read_text(encoding="utf-8")
engine = Path("app/src/audio/engine.ts").read_text(encoding="utf-8")
styles = Path("app/src/styles.css").read_text(encoding="utf-8")

checks = {
    "marqueur App": "20260807-jingle-music-mixing-1" in app,
    "curseur musique autonome": 'title="Volume de la musique"' in app and "update('musicVolume', value)" in app,
    "curseur musique de fond": "block.background.volume" in app,
    "curseur musique jingle": "jingle.musicVolume" in app,
    "accessibilité du curseur": 'aria-label={title}' in app,
    "compatibilité des anciens projets": "standaloneMusicFallback" in app and "backgroundMusicFallback" in app,
    "types optionnels": types.count("musicVolume?: number;") == 2 and "volume?: number;" in types,
    "courbe perceptuelle": "0.65 * ratio * ratio" in engine and "0.24 * ratio * ratio" in engine,
    "marge de fin du jingle": "JINGLE_TAIL_SECONDS = 2.4" in engine,
    "fermeture réservée après la voix": "Math.max(JINGLE_TAIL_SECONDS, closingTail)" in engine,
    "fenêtre de fermeture": "JINGLE_CLOSING_WINDOW_SECONDS = 4" in engine,
    "fondu long de fermeture": "JINGLE_CLOSING_FADE_SECONDS = 2.2" in engine,
    "enveloppe dédiée": "fadeProgress" in engine and "endProgress" in engine,
    "styles du curseur": ".music-volume-slider" in styles,
}

failed = [label for label, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Vérifications échouées: " + ", ".join(failed))

print("Mixage des musiques et fins de jingles vérifiés.")
