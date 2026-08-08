#!/usr/bin/env bash
set -euo pipefail

test -s app/src/App.tsx
test -s app/src/styles.css
test -s app/src/data/audioLibrary.ts
test -s app/public/audio-credits.html
test -s app/public/audio-diagnostics.html
! grep -R "structuredClone(" app/src/App.tsx
grep -q "createMediaStreamDestination" app/src/audio/engine.ts
grep -q "setBrowserAudioSession('play-and-record')" app/src/App.tsx
grep -q "restoreBrowserAudioSession" app/src/App.tsx
grep -q "arraybuffer-v2" app/src/storage/db.ts
grep -q "audioBytes" app/src/storage/db.ts
grep -q "Ajouter un bruitage ici" app/src/App.tsx
grep -q "voiceCues" app/src/audio/engine.ts
grep -q "voicePlaybackRate" app/src/audio/engine.ts
grep -q "coreTimelineDuration" app/src/audio/engine.ts
grep -q "duration \* playbackRate" app/src/audio/engine.ts
grep -q "cueAtSource / playbackRate" app/src/audio/engine.ts
grep -q "Jingle d’intro" app/src/App.tsx
grep -q "Ajouter une section" app/src/App.tsx
python3 app/scripts/verify-editor-expansion.py
python3 app/scripts/verify-audionautix-expansion.py
python3 app/scripts/verify-guided-structure.py
python3 app/scripts/verify-sfx-volume-contrast.py
python3 app/scripts/verify-real-transitions-and-previews.py
python3 app/scripts/verify-jingle-music-mixing.py
python3 app/scripts/verify-vocal-magic-boost-and-jingle-timing.py
node app/scripts/verify-section-playback-order.mjs

for id in \
  sfx-horse-gallop-pavement \
  sfx-steam-locomotive \
  music-medieval-story \
  sfx-sword-fight-real \
  sfx-sword-unsheathe-real \
  sfx-sword-hit-real \
  sfx-male-scream-fear \
  sfx-cutting-beet-greens \
  sfx-explosion \
  sfx-explosions \
  sfx-gunshots-simulated \
  sfx-cannon-reveille \
  sfx-large-crowd-cheering \
  sfx-provence-market \
  sfx-fireworks-detonations \
  sfx-rotary-printing-press-1926 \
  sfx-military-drumbeat \
  sfx-1960s-factory-civil-defense-siren \
  sfx-19th-century-fire-brigade-bell; do
  grep -q "$id" app/src/data/audioLibrary.ts
done

for category in \
  "Guerres & combats" \
  "Sociétés & lieux historiques" \
  "Nature & paysages" \
  "Transports & industrie" \
  "Vie quotidienne & objets" \
  "Voix & foule" \
  "Époques historiques"; do
  grep -q "$category" app/src/data/audioLibrary.ts
done

grep -q "Chocs, impacts, transitions" app/src/data/audioLibrary.ts
grep -q "distant: 'Caverne'" app/src/App.tsx
grep -q "Plage du fichier" app/src/App.tsx
grep -q "Volume de la transition" app/src/App.tsx
grep -q "removeJingleAsset" app/src/App.tsx

grep -q "Les sons de la bibliothèque proviennent de sources libres ou sous licence" app/src/App.tsx
! grep -q "Les sons intégrés sont produits directement par l’application" app/src/App.tsx
grep -q "library-footer-note" app/src/App.tsx app/src/styles.css
grep -q "library-source-link" app/src/App.tsx app/src/styles.css
! grep -q "library-info\|library-credit" app/src/App.tsx
! grep -q "generated:\|synthesizeGeneratedEffect\|loadGeneratedAudio\|Créé dans l’application\|disponible hors ligne" app/src/data/audioLibrary.ts app/src/App.tsx
! grep -q "Chocs métalliques / épées" app/src/data/audioLibrary.ts

echo "Sources audio vérifiées."
