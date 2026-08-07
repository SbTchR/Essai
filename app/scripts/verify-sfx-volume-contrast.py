from __future__ import annotations

import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
engine = (ROOT / 'src' / 'audio' / 'engine.ts').read_text(encoding='utf-8')

assert '20260722-sfx-volume-contrast-1' in engine
assert "function soundEffectVolumeValue(level: VolumeLevel)" in engine
assert "level === 'low' ? 0.08 : level === 'high' ? 1.05 : 0.28" in engine
assert "block.type === 'sfx' ? soundEffectVolumeValue(block.volume) : standaloneMusicValue(block.musicVolume, block.volume)" in engine

levels = {'low': 0.08, 'normal': 0.28, 'high': 1.05}
low_to_normal_db = 20 * math.log10(levels['normal'] / levels['low'])
normal_to_high_db = 20 * math.log10(levels['high'] / levels['normal'])

assert low_to_normal_db >= 10
assert normal_to_high_db >= 10
assert levels['low'] < levels['normal'] < levels['high']

print(
    'Contraste des bruitages vérifié : '
    f'discret → normal +{low_to_normal_db:.1f} dB, '
    f'normal → fort +{normal_to_high_db:.1f} dB avant compression.'
)
