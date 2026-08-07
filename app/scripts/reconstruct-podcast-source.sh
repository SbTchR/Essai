#!/usr/bin/env bash
set -euo pipefail

mkdir -p app/src/data
cat app-parts/App-00.txt app-parts/App-01.txt app-parts/App-02.txt app-parts/App-03.txt app-parts/App-04.txt app-parts/App-05.txt > app/src/App.tsx
cat app-parts/styles-00.txt app-parts/styles-01.txt app-parts/styles-02.txt > app/src/styles.css
cat app-parts/audioLibrary-00.txt > app/src/data/audioLibrary.ts
sed '$d' app-parts/audioLibrary-01.txt >> app/src/data/audioLibrary.ts
cat app-parts/audioLibrary-02.txt app-parts/audioLibrary-03.txt >> app/src/data/audioLibrary.ts

node app/scripts/apply-runtime-fixes.mjs
node app/scripts/apply-ios-output-fix.mjs
node app/scripts/apply-recording-session-fix.mjs
python3 app/scripts/apply-student-workflow-v2.py

python3 - <<'PY'
from pathlib import Path
path = Path('app/scripts/apply-sfx-library-upgrade.py')
source = path.read_text(encoding='utf-8')
source = source.replace(
    "array_start = library.index('[', library.index(marker))",
    "array_start = library.index('[', library.index(marker) + len(marker))",
)
path.write_text(source, encoding='utf-8')
PY
python3 app/scripts/apply-sfx-library-upgrade.py

python3 - <<'PY'
from pathlib import Path
path = Path('app/scripts/apply-recorded-sfx-only.py')
source = path.read_text(encoding='utf-8')
marker = "music = [item for item in items if item.get('kind') == 'music']"
exclusion = "items = [item for item in items if item.get('id') not in {'sfx-small-stream', 'sfx-writing-feltpen', 'sfx-wine-glass'}]"
while f"{exclusion}\n{exclusion}" in source:
    source = source.replace(f"{exclusion}\n{exclusion}", exclusion)
if exclusion not in source:
    if marker not in source:
        raise SystemExit('Point de limitation de la bibliothèque introuvable.')
    source = source.replace(marker, exclusion + "\n" + marker, 1)
path.write_text(source, encoding='utf-8')
PY
python3 app/scripts/apply-recorded-sfx-only.py
python3 app/scripts/apply-historical-library.py
python3 app/scripts/apply-library-simplification.py
python3 app/scripts/apply-audio-corrections.py
python3 app/scripts/apply-editor-expansion.py
python3 app/scripts/apply-audionautix-expansion.py
python3 app/scripts/apply-guided-structure.py
python3 app/scripts/apply-sfx-volume-contrast.py
python3 app/scripts/apply-real-transitions-and-previews.py
python3 app/scripts/apply-jingle-music-mixing.py
