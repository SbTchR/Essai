#!/usr/bin/env bash
set -euo pipefail

test -s app/dist/index.html
test -s app/dist/audio-credits.html
test -s app/dist/audio-diagnostics.html
test -n "$(find app/dist/assets -maxdepth 1 -name '*.js' -print -quit)"
test -n "$(find app/dist/assets -maxdepth 1 -name '*.css' -print -quit)"
! grep -R "DecompressionStream\|pako\.ungzip\|\.js\.gz\|structuredClone(" app/dist/index.html app/dist/assets/*.js
grep -q '<script type="module"' app/dist/index.html
grep -q "createMediaStreamDestination" app/dist/assets/*.js
grep -q "play-and-record" app/dist/assets/*.js
grep -q "arraybuffer-v2" app/dist/assets/*.js
grep -q "audioBytes" app/dist/assets/*.js
grep -q "Ajouter un bruitage ici" app/dist/assets/*.js
grep -q "voiceCues" app/dist/assets/*.js
grep -q "Jingle d’intro" app/dist/assets/*.js
grep -q "Chocs, impacts, transitions" app/dist/assets/*.js
grep -q "Voix très aiguë" app/dist/assets/*.js
grep -q "Caverne" app/dist/assets/*.js
grep -q "Plage du fichier" app/dist/assets/*.js
grep -q "Volume de la transition" app/dist/assets/*.js
grep -q "music-chase-action" app/dist/assets/*.js
grep -q "music-acoustic-blues" app/dist/assets/*.js
grep -q "music-smooth-jazz-night" app/dist/assets/*.js
grep -q "music-hoedown" app/dist/assets/*.js
grep -q "music-pyramids" app/dist/assets/*.js
grep -q "Jazz, blues & groove" app/dist/assets/*.js
grep -q "Folk, country & banjo" app/dist/assets/*.js
grep -q "Joyeux & léger" app/dist/assets/*.js
! grep -q "music-a-chantar\|music-janequin-la-guerre\|music-monteverdi-battle\|music-o-frondens\|music-santa-maria" app/dist/assets/*.js
grep -q "sfx-medieval-battle-ambience" app/dist/assets/*.js
grep -q "Enregistrer mon propre bruitage" app/dist/assets/*.js
grep -q "Commencer avant la voix" app/dist/assets/*.js
grep -Eq "low.{0,24}\\.08.{0,24}high.{0,24}1\\.05.{0,24}\\.28" app/dist/assets/*.js
grep -q "Enregistrements réels" app/dist/assets/*.js
grep -q "Chargement…" app/dist/assets/*.js
grep -q "Coups à la porte" app/dist/assets/*.js
grep -q "Pop vocal" app/dist/assets/*.js
grep -q "Volume de la musique" app/dist/assets/*.js
grep -q "0 % = muet" app/dist/assets/*.js
grep -q "music-volume-slider" app/dist/assets/*.js app/dist/assets/*.css
grep -q "Magic Boost" app/dist/assets/*.js
grep -q "Musique avant la voix" app/dist/assets/*.js
grep -q "Musique après la voix" app/dist/assets/*.js

for id in \
  sfx-horse-gallop-pavement \
  music-medieval-story \
  sfx-sword-fight-real \
  sfx-male-scream-fear \
  sfx-cutting-beet-greens \
  sfx-gunshots-simulated \
  sfx-cannon-reveille \
  sfx-large-crowd-cheering \
  sfx-provence-market \
  sfx-fireworks-detonations \
  sfx-rotary-printing-press-1926 \
  sfx-military-drumbeat \
  sfx-1960s-factory-civil-defense-siren \
  sfx-19th-century-fire-brigade-bell; do
  grep -q "$id" app/dist/assets/*.js
done

for category in \
  "Guerres & combats" \
  "Sociétés & lieux historiques" \
  "Nature & paysages" \
  "Transports & industrie" \
  "Voix & foule" \
  "Époques historiques"; do
  grep -q "$category" app/dist/assets/*.js
done

grep -q "Les sons de la bibliothèque proviennent de sources libres ou sous licence" app/dist/assets/*.js
! grep -q "Les sons intégrés sont produits directement par l’application" app/dist/assets/*.js
grep -q "library-footer-note" app/dist/assets/*.js app/dist/assets/*.css
grep -q "library-source-link" app/dist/assets/*.js app/dist/assets/*.css
! grep -q "library-info\|library-credit" app/dist/assets/*.js
! grep -q "generated:\|synthesizeGeneratedEffect\|loadGeneratedAudio\|Créé dans l’application\|disponible hors ligne" app/dist/assets/*.js
! grep -q "Chocs métalliques / épées" app/dist/assets/*.js

echo "Build audio vérifié."
