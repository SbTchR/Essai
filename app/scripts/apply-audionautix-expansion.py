#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import html
import json
import re
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
LIBRARY_PATH = ROOT / 'src' / 'data' / 'audioLibrary.ts'
CREDITS_PATH = ROOT / 'public' / 'audio-credits.html'

MARKER = 'Audionautix expansion: 20260807-audionautix-expansion-1'
BY3 = 'https://creativecommons.org/licenses/by/3.0/'
BY3_US = 'https://creativecommons.org/licenses/by/3.0/us/'

REMOVED_MUSIC_IDS = {
    'music-a-chantar',
    'music-janequin-la-guerre',
    'music-monteverdi-battle',
    'music-o-frondens',
    'music-santa-maria',
}

RECLASSIFIED_MUSIC = {
    'music-classical': 'Classique & orchestral',
    'music-banjo-short': 'Folk, country & banjo',
    'music-far-west-banjo': 'Folk, country & banjo',
    'music-dobro': 'Folk, country & banjo',
    'music-country-cue': 'Folk, country & banjo',
}

MUSIC_CATEGORIES = [
    'Époques historiques',
    'Classique & orchestral',
    'Jazz, blues & groove',
    'Folk, country & banjo',
    'Joyeux & léger',
    'Épique & action',
    'Mystère & tension',
    'Lieux & voyages',
    'Calme & émotion',
]


def commons_urls(filename: str) -> tuple[str, str, str]:
    normalized = filename.replace(' ', '_')
    digest = hashlib.md5(normalized.encode('utf-8')).hexdigest()
    encoded = quote(normalized, safe="_(),.-")
    original = f'https://upload.wikimedia.org/wikipedia/commons/{digest[0]}/{digest[:2]}/{encoded}'
    source = f'https://commons.wikimedia.org/wiki/File:{encoded}'
    if normalized.lower().endswith('.mp3'):
        return original, original, source
    transcode = f'https://upload.wikimedia.org/wikipedia/commons/transcoded/{digest[0]}/{digest[:2]}/{encoded}/{encoded}.mp3'
    return transcode, original, source


def music(
    *, id: str, title: str, category: str, icon: str, duration: float,
    description: str, tags: list[str], filename: str, fma: bool = False,
) -> dict:
    audio_url, fallback_url, source_page = commons_urls(filename)
    license_name = 'CC BY 3.0 US' if fma else 'CC BY 3.0'
    return {
        'id': id,
        'kind': 'music',
        'title': title,
        'category': category,
        'icon': icon,
        'duration': duration,
        'description': description,
        'tags': tags,
        'filename': filename,
        'audioUrl': audio_url,
        'fallbackUrl': fallback_url,
        'sourcePage': source_page,
        'author': 'Jason Shaw / Audionautix',
        'license': license_name,
        'licenseUrl': BY3_US if fma else BY3,
        'attribution': f'{title} — Jason Shaw / Audionautix — {license_name}.',
        'origin': 'recording',
        'clipDuration': min(30, duration),
    }


NEW_MUSIC = [
    music(id='music-moments-reflection', title='Moment de réflexion', category='Classique & orchestral', icon='🎼', duration=122,
          description='Pièce instrumentale posée pour une réflexion, une transition élégante ou une conclusion.',
          tags=['classique', 'instrumental', 'réflexion', 'élégant'], filename='A Moments Reflection.mp3'),

    music(id='music-acoustic-blues', title='Blues acoustique', category='Jazz, blues & groove', icon='🎸', duration=153,
          description='Guitare blues chaleureuse pour un récit de voyage, une chronique ou une ambiance rétro.',
          tags=['blues', 'guitare', 'acoustique', 'rétro'], filename='Jason Shaw - ACOUSTIC BLUES.ogg', fma=True),
    music(id='music-cryin-in-my-beer', title='Blues mélancolique', category='Jazz, blues & groove', icon='🍺', duration=398,
          description='Long blues lent et expressif pour une déception, un souvenir ou une scène nocturne.',
          tags=['blues', 'mélancolie', 'lent', 'nuit'], filename='Jason Shaw - CRYIN IN MY BEER.ogg', fma=True),
    music(id='music-bebop-25', title='Bebop en mouvement', category='Jazz, blues & groove', icon='🎷', duration=142,
          description='Jazz vif et mobile pour une ville animée, une enquête ou un montage rythmé.',
          tags=['jazz', 'bebop', 'ville', 'rythmé'], filename='Audionautix-com-ccby-bebop25.mp3'),
    music(id='music-boogie-woogie-bed', title='Boogie-woogie discret', category='Jazz, blues & groove', icon='🎹', duration=147,
          description='Piano boogie régulier conçu pour rester sous une narration sans perdre son énergie.',
          tags=['boogie-woogie', 'piano', 'blues', 'fond'], filename='Audionautix-com-ccby-boogiewoogiebed.mp3'),
    music(id='music-closer-to-jazz', title='Au plus près du jazz', category='Jazz, blues & groove', icon='🎺', duration=143,
          description='Jazz souple et élégant pour une chronique culturelle, un café ou une scène urbaine.',
          tags=['jazz', 'élégant', 'café', 'urbain'], filename='Audionautix-com-ccby-closertojazz.mp3'),
    music(id='music-jumpin-boogie', title='Boogie-woogie bondissant', category='Jazz, blues & groove', icon='🕺', duration=183,
          description='Boogie très joyeux pour une scène comique, une fête ou un passage plein d’élan.',
          tags=['boogie-woogie', 'joyeux', 'danse', 'fête'], filename='Audionautix-com-ccby-jumpinboogiewoogie.mp3'),
    music(id='music-smooth-jazz-night', title='Jazz doux de nuit', category='Jazz, blues & groove', icon='🌃', duration=110,
          description='Jazz feutré pour une ambiance nocturne, une confidence ou une émission calme.',
          tags=['jazz', 'doux', 'nuit', 'feutré'], filename='Audionautix-com-ccby-smoothjazznight.mp3'),
    music(id='music-standard-jazz-bars', title='Standards de jazz', category='Jazz, blues & groove', icon='🎶', duration=182,
          description='Suite de phrases jazz classiques pour un restaurant, une réception ou une évocation rétro.',
          tags=['jazz', 'standard', 'restaurant', 'rétro'], filename='Audionautix-com-ccby-standardjazzbars.mp3'),
    music(id='music-dat-groove', title='Groove détendu', category='Jazz, blues & groove', icon='🪩', duration=130,
          description='Groove instrumental souple pour une présentation moderne ou un passage décontracté.',
          tags=['groove', 'funk', 'moderne', 'décontracté'], filename='Audionautix-com-ccby-datgroovefulltrack.mp3'),

    music(id='music-hoedown', title='Fête country au banjo', category='Folk, country & banjo', icon='🪕', duration=133,
          description='Country et banjo rapides pour une fête rurale, un western ou une scène populaire.',
          tags=['country', 'banjo', 'fête', 'western'], filename='Jason Shaw - HOEDOWN.ogg', fma=True),
    music(id='music-tennessee-hayride', title='Balade du Tennessee', category='Folk, country & banjo', icon='🛻', duration=153,
          description='Country enjouée pour une route, une ferme ou un voyage dans l’Amérique rurale.',
          tags=['country', 'Tennessee', 'route', 'rural'], filename='Jason Shaw - TENNESEE HAYRIDE.ogg', fma=True),
    music(id='music-rocky-top', title='Banjo des montagnes', category='Folk, country & banjo', icon='⛰️', duration=104,
          description='Mélodie bluegrass vive pour une montagne, une course ou une aventure en plein air.',
          tags=['banjo', 'bluegrass', 'montagne', 'aventure'], filename='Jason Shaw - ROCKY TOP.ogg', fma=True),
    music(id='music-pioneers', title='La route des pionniers', category='Folk, country & banjo', icon='🧭', duration=173,
          description='Folk ample pour raconter une migration, une exploration ou la conquête d’un territoire.',
          tags=['folk', 'pionniers', 'exploration', 'voyage'], filename='Jason Shaw - PIONEERS.ogg', fma=True),
    music(id='music-minstrel', title='Ménestrel acoustique', category='Folk, country & banjo', icon='🏰', duration=138,
          description='Pièce folk acoustique évoquant un conte ancien, un village ou un récit médiéval.',
          tags=['folk', 'ménestrel', 'médiéval', 'conte'], filename='Jason Shaw - MINSTREL.ogg', fma=True),
    music(id='music-mountain-sun', title='Soleil sur les montagnes', category='Folk, country & banjo', icon='🌄', duration=153,
          description='Folk lumineuse pour un paysage, un départ en voyage ou un moment d’espoir.',
          tags=['folk', 'montagne', 'soleil', 'espoir'], filename='Jason Shaw - MOUNTAIN SUN.ogg', fma=True),

    music(id='music-one-fine-day', title='Une belle journée', category='Joyeux & léger', icon='☀️', duration=103,
          description='Musique acoustique lumineuse pour une réussite, une rencontre ou une conclusion positive.',
          tags=['joyeux', 'positif', 'acoustique', 'réussite'], filename='Jason Shaw - ONE FINE DAY.ogg', fma=True),
    music(id='music-good-friend', title='Entre bons amis', category='Joyeux & léger', icon='🤝', duration=76,
          description='Petit thème chaleureux pour parler d’amitié, d’entraide ou d’un souvenir heureux.',
          tags=['amitié', 'chaleureux', 'joyeux', 'souvenir'], filename='Jason Shaw - GOOD FRIEND.ogg', fma=True),
    music(id='music-snappy', title='Vif et malicieux', category='Joyeux & léger', icon='✨', duration=51,
          description='Morceau court et pétillant pour une annonce, une astuce ou une scène légère.',
          tags=['vif', 'malicieux', 'léger', 'annonce'], filename='Jason Shaw - SNAPPY.ogg', fma=True),
    music(id='music-yeah-yeah', title='Oui, quelle énergie !', category='Joyeux & léger', icon='🙌', duration=139,
          description='Morceau pop-rock enthousiaste pour une victoire, un générique ou une séquence dynamique.',
          tags=['joyeux', 'énergie', 'victoire', 'pop-rock'], filename='Audionautix-com-ccby-yeahyeah.mp3'),
    music(id='music-sideways-samba', title='Samba légère', category='Joyeux & léger', icon='💃', duration=191,
          description='Samba décalée et souriante pour un voyage, une fête ou un passage humoristique.',
          tags=['samba', 'latin', 'fête', 'joyeux'], filename='Audionautix-com-ccby-sidewayssamba.mp3'),

    music(id='music-ocean-floor', title='Mystère au fond de l’océan', category='Mystère & tension', icon='🌊', duration=228,
          description='Ambiance profonde et mystérieuse pour une exploration sous-marine ou une découverte inquiétante.',
          tags=['mystère', 'océan', 'exploration', 'profondeur'], filename='Audionautix-com-ccby-oceanfloor.mp3'),
    music(id='music-redwood-trail', title='Sentier des séquoias', category='Lieux & voyages', icon='🌲', duration=118,
          description='Musique d’aventure naturelle pour une forêt immense, une randonnée ou une découverte.',
          tags=['aventure', 'forêt', 'séquoias', 'randonnée'], filename='Audionautix-com-ccby-redwoodtrail.mp3'),
    music(id='music-pyramids', title='Mystère des pyramides', category='Mystère & tension', icon='🔺', duration=150,
          description='Ambiance électronique énigmatique pour l’Égypte, une civilisation disparue ou un secret ancien.',
          tags=['mystère', 'pyramides', 'Égypte', 'secret'], filename='Jason Shaw - Pyramids.ogg', fma=True),
    music(id='music-vanishing-horizon', title='Vers l’horizon', category='Lieux & voyages', icon='🌅', duration=164,
          description='Musique progressive pour un départ, un long voyage ou une aventure tournée vers l’inconnu.',
          tags=['aventure', 'horizon', 'voyage', 'inconnu'], filename='Jason Shaw - Vanishing Horizon.ogg', fma=True),
]


library = LIBRARY_PATH.read_text(encoding='utf-8')
marker = 'export const AUDIO_LIBRARY: LibraryPreset[] = '
array_start = library.index('[', library.index(marker) + len(marker))
array_end = library.index('] as LibraryPreset[];', array_start) + 1
items: list[dict] = json.loads(library[array_start:array_end])

by_id = {item['id']: item for item in items if item['id'] not in REMOVED_MUSIC_IDS}
for item_id, category in RECLASSIFIED_MUSIC.items():
    if item_id not in by_id:
        raise RuntimeError(f'Musique à reclasser introuvable : {item_id}')
    by_id[item_id]['category'] = category
for item in NEW_MUSIC:
    by_id[item['id']] = item

music_rank = {name: index for index, name in enumerate(MUSIC_CATEGORIES)}
music_items = sorted(
    (item for item in by_id.values() if item.get('kind') == 'music'),
    key=lambda item: (music_rank.get(item.get('category', ''), 99), item.get('title', '')),
)
sfx_items = [item for item in by_id.values() if item.get('kind') == 'sfx']
items = music_items + sfx_items
library = library[:array_start] + json.dumps(items, ensure_ascii=False, indent=2) + library[array_end:]

category_pattern = r"(export const LIBRARY_CATEGORIES: Record<LibraryKind, string\[]> = \{\n\s*music: ).*?(,\n\s*sfx: )"
library, category_count = re.subn(
    category_pattern,
    lambda match: match.group(1) + json.dumps(MUSIC_CATEGORIES, ensure_ascii=False) + match.group(2),
    library,
    count=1,
    flags=re.DOTALL,
)
if category_count != 1:
    raise RuntimeError('Liste des catégories musicales introuvable.')

library = f'// {MARKER}\n' + library
LIBRARY_PATH.write_text(library, encoding='utf-8')

rows = []
for item in items:
    rows.append(
        '<tr>'
        f'<td>{html.escape(item["title"])}</td>'
        f'<td>{"Musique" if item["kind"] == "music" else "Bruitage"}</td>'
        f'<td>{html.escape(item["author"])}</td>'
        f'<td><a href="{html.escape(item["licenseUrl"])}">{html.escape(item["license"])}</a></td>'
        f'<td><a href="{html.escape(item["sourcePage"])}">Source</a></td>'
        '</tr>'
    )

credits = '''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crédits audio — Podcast Facile</title><style>body{font:16px system-ui;margin:0;background:#f7f9fc;color:#17243b}main{max-width:1100px;margin:auto;padding:32px 18px}h1{margin-bottom:8px}p{line-height:1.5}table{width:100%;border-collapse:collapse;background:white;border-radius:14px;overflow:hidden}th,td{text-align:left;padding:10px;border-bottom:1px solid #e5e9f1;font-size:14px}th{background:#edf3ff}a{color:#2457d6}@media(max-width:700px){table,tbody,tr,td{display:block}thead{display:none}tr{padding:10px;border-bottom:1px solid #ddd}td{border:0;padding:4px 8px}}</style></head><body><main><h1>Crédits audio — Podcast Facile</h1><p>Les bruitages sont exclusivement des enregistrements réels. Les musiques et les enregistrements externes sont hébergés par Wikimedia Commons et restent associés à leur auteur et à leur licence.</p><table><thead><tr><th>Titre dans l’application</th><th>Type</th><th>Auteur</th><th>Licence</th><th>Fichier</th></tr></thead><tbody>''' + ''.join(rows) + '</tbody></table></main></body></html>'
CREDITS_PATH.write_text(credits, encoding='utf-8')

print(f'Bibliothèque Audionautix enrichie : {len(NEW_MUSIC)} ajouts et {len(REMOVED_MUSIC_IDS)} suppressions.')
