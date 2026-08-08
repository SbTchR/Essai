#!/usr/bin/env python3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / 'src' / 'App.tsx').read_text(encoding='utf-8')
engine = (ROOT / 'src' / 'audio' / 'engine.ts').read_text(encoding='utf-8')
types = (ROOT / 'src' / 'types.ts').read_text(encoding='utf-8')

checks = {
    'type Magic Boost': "export type VoiceEnhancement = 'natural' | 'magic-boost';" in types,
    'bloc vocal réglable': 'voiceEnhancement?: VoiceEnhancement;' in types,
    'jingle vocal réglable': types.count('voiceEnhancement?: VoiceEnhancement;') == 2,
    'durées de jingle': 'musicLeadSeconds?: 1 | 2 | 3 | 4;' in types and 'musicTailSeconds?: 1 | 2 | 3 | 4;' in types,
    'contrôle Magic Boost voix': 'Traitement vocal' in app and 'voiceEnhancementLabels' in app,
    'contrôle Magic Boost jingle': 'Traitement de la voix' in app,
    'préréglages avant': 'title="Musique avant la voix"' in app,
    'préréglages après': 'title="Musique après la voix"' in app,
    'valeurs par défaut': "musicLeadSeconds: 2, musicTailSeconds: 3" in app,
    'égalisation de la voix': 'warmth.frequency.value = 160;' in engine and 'presence.frequency.value = 2800;' in engine,
    'compression de la voix': 'compressor.threshold.value = -20;' in engine and 'compressor.ratio.value = 3;' in engine,
    'limiteur de la voix': 'limiter.threshold.value = -1.2;' in engine and 'limiter.ratio.value = 20;' in engine,
    'routage uniquement vocal': "block.voiceEnhancement ?? 'magic-boost'" in engine and "block.jingle?.voiceEnhancement ?? 'magic-boost'" in engine,
    'limiteur de sécurité global': 'createMasterSafetyLimiter' in engine,
    'ancien compresseur global retiré': 'compressor.threshold.value = -8;' not in engine,
    'durée jingle calculée': 'jingleLeadIn(block) + voice.duration + Math.max(jingleTail(block), closingTail)' in engine,
    'lecture jingle réglable': 'const leadIn = jingleLeadIn(block);' in engine and 'const tail = jingleTail(block);' in engine,
}

failed = [label for label, ok in checks.items() if not ok]
if failed:
    raise SystemExit('Vérifications échouées: ' + ', '.join(failed))

print('Traitement Magic Boost vocal et minutage des jingles vérifiés.')
