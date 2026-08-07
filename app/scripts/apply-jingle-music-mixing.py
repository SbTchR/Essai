#!/usr/bin/env python3
from pathlib import Path


MARKER = "Jingle fades and music sliders: 20260807-jingle-music-mixing-1"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: attendu 1 occurrence, trouvé {count}")
    return source.replace(old, new, 1)


types_path = Path("app/src/types.ts")
types = types_path.read_text(encoding="utf-8")
if MARKER not in types:
    types = replace_once(
        types,
        "export interface BackgroundAudio {\n  assetId: string;\n  level: 'very-low' | 'low' | 'present';",
        f"// {MARKER}\nexport interface BackgroundAudio {{\n  assetId: string;\n  level: 'very-low' | 'low' | 'present';\n  volume?: number;",
        "volume de musique de fond",
    )
    types = replace_once(
        types,
        "  volume: VolumeLevel;\n  fadeIn: FadeLevel;",
        "  volume: VolumeLevel;\n  musicVolume?: number;\n  fadeIn: FadeLevel;",
        "volume de musique autonome",
    )
    types = replace_once(
        types,
        "    musicLevel: 'very-low' | 'low' | 'present';\n  };",
        "    musicLevel: 'very-low' | 'low' | 'present';\n    musicVolume?: number;\n  };",
        "volume de musique du jingle",
    )
    types_path.write_text(types, encoding="utf-8")


app_path = Path("app/src/App.tsx")
app = app_path.read_text(encoding="utf-8")
if MARKER not in app:
    app = replace_once(
        app,
        "    volume: 'normal',\n    fadeIn: type === 'voice' ? 'short' : 'normal',",
        "    volume: 'normal',\n    musicVolume: type === 'music' ? 30 : undefined,\n    fadeIn: type === 'voice' ? 'short' : 'normal',",
        "volume initial d'une musique",
    )
    app = replace_once(
        app,
        "    jingle: type === 'jingle' ? { style: 'modern-radio', musicLevel: 'low' } : undefined,",
        "    jingle: type === 'jingle' ? { style: 'modern-radio', musicLevel: 'low', musicVolume: 32 } : undefined,",
        "volume initial du jingle",
    )
    app = app.replace(
        "background: { assetId: asset.id, level: 'low', startBefore: true, startBeforeSeconds: 2, continueAfter: true, continueAfterSeconds: 2 }",
        "background: { assetId: asset.id, level: 'low', volume: 32, startBefore: true, startBeforeSeconds: 2, continueAfter: true, continueAfterSeconds: 2 }",
    )
    if app.count("volume: 32, startBefore") != 2:
        raise SystemExit("volume initial des musiques de fond: attendu 2 remplacements")
    app = app.replace(
        "{ style: 'modern-radio', musicLevel: 'low' }",
        "{ style: 'modern-radio', musicLevel: 'low', musicVolume: 32 }",
    )
    app = replace_once(
        app,
        "{ style: 'modern-radio' as const, musicLevel: 'low' as const }",
        "{ style: 'modern-radio' as const, musicLevel: 'low' as const, musicVolume: 32 }",
        "valeur initiale du panneau de jingle",
    )
    if app.count("musicVolume: 32") < 4:
        raise SystemExit("valeurs initiales des jingles incomplètes")

    app = replace_once(
        app,
        """          {(block.type === 'voice' || block.type === 'music' || block.type === 'sfx') && (
            <div className="settings-columns">
              <ChoiceSetting title="Volume" value={block.volume} options={block.type === 'voice' ? [['low', 'Plus faible'], ['normal', 'Normal'], ['high', 'Plus fort']] : [['low', 'Discret'], ['normal', 'Normal'], ['high', 'Fort']]} onChange={(value) => update('volume', value as VolumeLevel)} />
              <ChoiceSetting title="Début" value={block.fadeIn} options={[["none", "Direct"], ["short", "Fondu court"], ["normal", "Fondu normal"]]} onChange={(value) => update('fadeIn', value as FadeLevel)} />
              <ChoiceSetting title="Fin" value={block.fadeOut} options={[["none", "Directe"], ["short", "Fondu court"], ["normal", "Fondu normal"]]} onChange={(value) => update('fadeOut', value as FadeLevel)} />
            </div>
          )}""",
        """          {(block.type === 'voice' || block.type === 'music' || block.type === 'sfx') && (
            <div className="settings-columns">
              {block.type === 'music' ? (
                <MusicVolumeSlider title="Volume de la musique" value={musicVolumePercent(block.musicVolume, standaloneMusicFallback(block.volume))} onChange={(value) => update('musicVolume', value)} />
              ) : (
                <ChoiceSetting title="Volume" value={block.volume} options={block.type === 'voice' ? [['low', 'Plus faible'], ['normal', 'Normal'], ['high', 'Plus fort']] : [['low', 'Discret'], ['normal', 'Normal'], ['high', 'Fort']]} onChange={(value) => update('volume', value as VolumeLevel)} />
              )}
              <ChoiceSetting title="Début" value={block.fadeIn} options={[["none", "Direct"], ["short", "Fondu court"], ["normal", "Fondu normal"]]} onChange={(value) => update('fadeIn', value as FadeLevel)} />
              <ChoiceSetting title="Fin" value={block.fadeOut} options={[["none", "Directe"], ["short", "Fondu court"], ["normal", "Fondu normal"]]} onChange={(value) => update('fadeOut', value as FadeLevel)} />
            </div>
          )}""",
        "curseur de musique autonome",
    )
    app = replace_once(
        app,
        """                    <ChoiceSetting title="Présence" value={block.background.level} options={[["very-low", "Très discrète"], ["low", "Discrète"], ["present", "Présente"]]} onChange={(value) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, level: value as 'very-low' | 'low' | 'present' } : undefined }))} />""",
        """                    <MusicVolumeSlider title="Volume de la musique" value={musicVolumePercent(block.background.volume, backgroundMusicFallback(block.background.level))} onChange={(value) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, volume: value } : undefined }))} />""",
        "curseur de musique de fond",
    )
    app = replace_once(
        app,
        """        <ChoiceSetting title="Musique sous la voix" value={jingle.musicLevel} options={[["very-low", "Très discrète"], ["low", "Discrète"], ["present", "Présente"]]} onChange={(value) => updateJingle({ musicLevel: value as 'very-low' | 'low' | 'present' })} />""",
        """        <MusicVolumeSlider title="Musique sous la voix" value={musicVolumePercent(jingle.musicVolume, backgroundMusicFallback(jingle.musicLevel))} onChange={(value) => updateJingle({ musicVolume: value })} />""",
        "curseur de musique du jingle",
    )
    app = replace_once(
        app,
        "function ChoiceSetting({ title, value, options, onChange }: { title: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {",
        f"""// {MARKER}
function musicVolumePercent(value: number | undefined, fallback: number): number {{
  return Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value as number : fallback)));
}}

function standaloneMusicFallback(level: VolumeLevel): number {{
  return level === 'low' ? 18 : level === 'high' ? 45 : 30;
}}

function backgroundMusicFallback(level: 'very-low' | 'low' | 'present'): number {{
  return level === 'very-low' ? 20 : level === 'present' ? 45 : 32;
}}

function MusicVolumeSlider({{ title, value, onChange }}: {{ title: string; value: number; onChange: (value: number) => void }}) {{
  const safeValue = musicVolumePercent(value, 30);
  return (
    <label className="music-volume-slider">
      <span className="music-volume-heading"><strong>{{title}}</strong><output>{{safeValue}} %</output></span>
      <input aria-label={{title}} type="range" min="0" max="100" step="1" value={{safeValue}} onChange={{(event) => onChange(Number(event.target.value))}} />
      <small>0 % = muet · 100 % = maximum</small>
    </label>
  );
}}

function ChoiceSetting({{ title, value, options, onChange }}: {{ title: string; value: string; options: [string, string][]; onChange: (value: string) => void }}) {{""",
        "composant de curseur",
    )
    app = replace_once(
        app,
        "  if (project.blocks.some((block) => block.type === 'music' && block.volume === 'high')) warnings.push('Une musique réglée sur « fort » peut fatiguer l’écoute.');\n  if (project.blocks.some((block) => block.type === 'voice' && block.background?.level === 'present')) warnings.push('Une musique de fond « présente » peut masquer certains mots. Écoute le résultat avant l’export.');",
        "  if (project.blocks.some((block) => block.type === 'music' && musicVolumePercent(block.musicVolume, standaloneMusicFallback(block.volume)) > 70)) warnings.push('Une musique réglée au-dessus de 70 % peut fatiguer l’écoute.');\n  if (project.blocks.some((block) => block.type === 'voice' && block.background && musicVolumePercent(block.background.volume, backgroundMusicFallback(block.background.level)) > 60)) warnings.push('Une musique de fond réglée au-dessus de 60 % peut masquer certains mots. Écoute le résultat avant l’export.');",
        "avertissements d'export",
    )
    app_path.write_text(app, encoding="utf-8")


engine_path = Path("app/src/audio/engine.ts")
engine = engine_path.read_text(encoding="utf-8")
if MARKER not in engine:
    engine = replace_once(
        engine,
        "const JINGLE_VOICE_START: Record<NonNullable<PodcastBlock['jingle']>['style'], number> = {",
        f"// {MARKER}\nconst JINGLE_TAIL_SECONDS = 2.4;\nconst JINGLE_CLOSING_WINDOW_SECONDS = 4;\nconst JINGLE_CLOSING_FADE_SECONDS = 2.2;\n\nconst JINGLE_VOICE_START: Record<NonNullable<PodcastBlock['jingle']>['style'], number> = {{",
        "constantes de fin du jingle",
    )
    engine = replace_once(
        engine,
        """    const voice = assets.find((asset) => asset.id === block.jingle?.voiceAssetId);
    if (!voice) return legacyFallback;
    const style = block.jingle?.style ?? 'modern-radio';
    return Math.max(legacyFallback, JINGLE_VOICE_START[style] + voice.duration + 0.8);""",
        """    const voice = assets.find((asset) => asset.id === block.jingle?.voiceAssetId);
    if (!voice) return legacyFallback;
    const closing = assets.find((asset) => asset.id === block.jingle?.closingAssetId);
    const closingTail = Math.min(JINGLE_CLOSING_WINDOW_SECONDS, closing?.duration ?? 0);
    const style = block.jingle?.style ?? 'modern-radio';
    return Math.max(legacyFallback, JINGLE_VOICE_START[style] + voice.duration + Math.max(JINGLE_TAIL_SECONDS, closingTail));""",
        "durée complète du jingle",
    )
    engine = replace_once(
        engine,
        "function backgroundValue(level: 'very-low' | 'low' | 'present'): number {\n  return level === 'very-low' ? 0.045 : level === 'present' ? 0.23 : 0.14;\n}",
        """function musicVolumePercent(value: number | undefined, fallback: number): number {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value as number : fallback));
}

function standaloneMusicFallback(level: VolumeLevel): number {
  return level === 'low' ? 18 : level === 'high' ? 45 : 30;
}

function backgroundMusicFallback(level: 'very-low' | 'low' | 'present'): number {
  return level === 'very-low' ? 20 : level === 'present' ? 45 : 32;
}

function standaloneMusicValue(value: number | undefined, legacyLevel: VolumeLevel): number {
  const ratio = musicVolumePercent(value, standaloneMusicFallback(legacyLevel)) / 100;
  return 0.65 * ratio * ratio;
}

function backgroundMusicValue(value: number | undefined, legacyLevel: 'very-low' | 'low' | 'present'): number {
  const ratio = musicVolumePercent(value, backgroundMusicFallback(legacyLevel)) / 100;
  return 0.24 * ratio * ratio;
}""",
        "courbes de volume des musiques",
    )
    engine = replace_once(
        engine,
        "const level = backgroundValue(block.background.level);",
        "const level = backgroundMusicValue(block.background.volume, block.background.level);",
        "gain de musique de fond",
    )
    engine = replace_once(
        engine,
        "const level = backgroundValue(block.jingle?.musicLevel ?? 'low');",
        "const level = backgroundMusicValue(block.jingle?.musicVolume, block.jingle?.musicLevel ?? 'low');",
        "gain de musique du jingle",
    )
    engine = engine.replace("total - profile.voiceStart - 0.8", "total - profile.voiceStart - JINGLE_TAIL_SECONDS")
    if engine.count("JINGLE_TAIL_SECONDS") < 4:
        raise SystemExit("les marges de fin du jingle n'ont pas toutes été remplacées")
    engine = replace_once(
        engine,
        """  if (closing) {
    const closingStart = Math.max(0, total - Math.min(1.5, closing.duration));
    if (localOffset < total) {
      const delay = Math.max(0, closingStart - localOffset);
      const consumed = Math.max(0, localOffset - closingStart);
      const duration = Math.min(closing.duration - consumed, remaining - delay);
      if (duration > 0) await scheduleAsset(context, destination, closing, cache, start + delay, consumed, duration, profile.closing, 'short', 'short');
    }
  }""",
        """  if (closing) {
    const closingDuration = Math.min(JINGLE_CLOSING_WINDOW_SECONDS, closing.duration, total);
    const closingStart = total - closingDuration;
    if (localOffset < total && localOffset < closingStart + closingDuration) {
      const delay = Math.max(0, closingStart - localOffset);
      const timelineAtPlayback = localOffset + delay;
      const consumed = Math.max(0, timelineAtPlayback - closingStart);
      const duration = Math.min(closingDuration - consumed, remaining - delay);
      if (duration > 0) {
        const buffer = await decodeAsset(context, closing, cache);
        const source = context.createBufferSource();
        const gain = context.createGain();
        const playbackStart = start + delay;
        const fadeDuration = Math.min(JINGLE_CLOSING_FADE_SECONDS, closingDuration);
        const fadeStart = total - fadeDuration;
        const fadeProgress = timelineAtPlayback <= fadeStart ? 0 : Math.min(1, (timelineAtPlayback - fadeStart) / fadeDuration);
        const initialGain = Math.max(0.0001, profile.closing * (1 - fadeProgress));
        const playbackEndTimeline = timelineAtPlayback + duration;
        const endProgress = playbackEndTimeline <= fadeStart ? 0 : Math.min(1, (playbackEndTimeline - fadeStart) / fadeDuration);
        const endGain = Math.max(0.0001, profile.closing * (1 - endProgress));
        source.buffer = buffer;
        source.connect(gain).connect(destination);
        gain.gain.setValueAtTime(initialGain, playbackStart);
        if (timelineAtPlayback < fadeStart && playbackEndTimeline > fadeStart) {
          gain.gain.setValueAtTime(profile.closing, playbackStart + fadeStart - timelineAtPlayback);
        }
        gain.gain.linearRampToValueAtTime(endGain, playbackStart + duration);
        source.start(playbackStart, consumed, duration);
        source.stop(playbackStart + duration + 0.03);
      }
    }
  }""",
        "fondu du bruit de fermeture",
    )
    engine = replace_once(
        engine,
        "block.type === 'sfx' ? soundEffectVolumeValue(block.volume) : volumeValue(block.volume),",
        "block.type === 'sfx' ? soundEffectVolumeValue(block.volume) : standaloneMusicValue(block.musicVolume, block.volume),",
        "gain de musique autonome",
    )
    engine_path.write_text(engine, encoding="utf-8")


styles_path = Path("app/src/styles.css")
styles = styles_path.read_text(encoding="utf-8")
if MARKER not in styles:
    styles += f"""

/* {MARKER} */
.music-volume-slider {{ display: grid; gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: white; }}
.music-volume-heading {{ display: flex; align-items: center; justify-content: space-between; gap: 12px; }}
.music-volume-heading strong {{ font-size: .94rem; }}
.music-volume-heading output {{ min-width: 58px; padding: 5px 9px; border-radius: 999px; background: var(--primary-soft); color: var(--primary-dark); font-size: .82rem; font-weight: 850; text-align: center; font-variant-numeric: tabular-nums; }}
.music-volume-slider input {{ width: 100%; accent-color: var(--primary); cursor: pointer; }}
.music-volume-slider small {{ color: var(--muted); font-size: .75rem; }}
.background-controls .music-volume-slider {{ padding: 10px; }}
"""
    styles_path.write_text(styles, encoding="utf-8")

print("Curseurs de musique et fondus de jingle appliqués.")
