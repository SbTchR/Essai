#!/usr/bin/env python3
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
library = (ROOT / 'src' / 'data' / 'audioLibrary.ts').read_text(encoding='utf-8')
credits = (ROOT / 'public' / 'audio-credits.html').read_text(encoding='utf-8')

marker = 'export const AUDIO_LIBRARY: LibraryPreset[] = '
start = library.index('[', library.index(marker) + len(marker))
end = library.index('] as LibraryPreset[];', start) + 1
items: list[dict] = json.loads(library[start:end])
music = [item for item in items if item.get('kind') == 'music']
ids = {item['id'] for item in music}

new_ids = {
    'music-moments-reflection', 'music-acoustic-blues', 'music-cryin-in-my-beer',
    'music-bebop-25', 'music-boogie-woogie-bed', 'music-closer-to-jazz',
    'music-jumpin-boogie', 'music-smooth-jazz-night', 'music-standard-jazz-bars',
    'music-dat-groove', 'music-hoedown', 'music-tennessee-hayride', 'music-rocky-top',
    'music-pioneers', 'music-minstrel', 'music-mountain-sun', 'music-one-fine-day',
    'music-good-friend', 'music-snappy', 'music-yeah-yeah', 'music-sideways-samba',
    'music-ocean-floor', 'music-redwood-trail', 'music-pyramids', 'music-vanishing-horizon',
}
removed_ids = {
    'music-a-chantar', 'music-janequin-la-guerre', 'music-monteverdi-battle',
    'music-o-frondens', 'music-santa-maria',
}

assert '20260807-audionautix-expansion-1' in library
assert len(new_ids) == 25
assert new_ids <= ids, f'Musiques Audionautix manquantes : {sorted(new_ids - ids)}'
assert not (removed_ids & ids), f'Musiques à supprimer encore présentes : {sorted(removed_ids & ids)}'
assert len(ids) == len(music), 'Identifiants musicaux dupliqués.'

new_items = [item for item in music if item['id'] in new_ids]
assert all(item['author'] == 'Jason Shaw / Audionautix' for item in new_items)
assert all(item['sourcePage'].startswith('https://commons.wikimedia.org/wiki/File:') for item in new_items)
assert all(item['audioUrl'].startswith('https://upload.wikimedia.org/wikipedia/commons/') for item in new_items)
assert all(item['license'].startswith('CC BY 3.0') for item in new_items)
assert all(item['sourcePage'] in credits for item in new_items)

for category in ('Classique & orchestral', 'Jazz, blues & groove', 'Folk, country & banjo', 'Joyeux & léger'):
    assert category in library

items_by_id = {item['id']: item for item in music}
assert items_by_id['music-classical']['category'] == 'Classique & orchestral'
assert items_by_id['music-banjo-short']['category'] == 'Folk, country & banjo'

for forbidden in ('A Chantar', 'Janequin', 'Monteverdi', 'O frondens', 'Santa Maria, Strela do Dia'):
    assert forbidden not in library
    assert forbidden not in credits

print(f'Extension Audionautix vérifiée : {len(new_items)} nouvelles musiques, {len(music)} musiques au total.')
