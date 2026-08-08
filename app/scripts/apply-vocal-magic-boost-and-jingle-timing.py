#!/usr/bin/env python3
"""Ajoute le traitement vocal dédié et le minutage réglable des jingles.

Ce correctif s'exécute après les autres transformations de reconstruction. Les
fichiers de ``app/src`` restent donc régénérables depuis les sources durables.
"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "src" / "App.tsx"
ENGINE_PATH = ROOT / "src" / "audio" / "engine.ts"
TYPES_PATH = ROOT / "src" / "types.ts"
MARKER = "20260808-vocal-magic-boost-jingle-timing-1"


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: attendu une occurrence, trouvé {count}.")
    return source.replace(before, after, 1)


types = TYPES_PATH.read_text(encoding="utf-8")
if MARKER not in types:
    types = replace_once(
        types,
        "export type VoiceEffect = 'none' | 'phone' | 'echo' | 'distant' | 'deep' | 'high' | 'very-high';",
        "export type VoiceEffect = 'none' | 'phone' | 'echo' | 'distant' | 'deep' | 'high' | 'very-high';\n"
        "export type VoiceEnhancement = 'natural' | 'magic-boost';",
        "type du traitement vocal",
    )
    types = replace_once(
        types,
        "  voiceEffect: VoiceEffect;\n  background?: BackgroundAudio;",
        "  voiceEffect: VoiceEffect;\n  voiceEnhancement?: VoiceEnhancement;\n  background?: BackgroundAudio;",
        "traitement vocal d'un bloc",
    )
    types = replace_once(
        types,
        "    musicLevel: 'very-low' | 'low' | 'present';\n    musicVolume?: number;",
        "    musicLevel: 'very-low' | 'low' | 'present';\n"
        "    musicVolume?: number;\n"
        "    voiceEnhancement?: VoiceEnhancement;\n"
        "    musicLeadSeconds?: 1 | 2 | 3 | 4;\n"
        "    musicTailSeconds?: 1 | 2 | 3 | 4;",
        "réglages vocaux et temporels du jingle",
    )
    types += f"\n// Traitement vocal et minutage de jingle : {MARKER}\n"
    TYPES_PATH.write_text(types, encoding="utf-8")


app = APP_PATH.read_text(encoding="utf-8")
if MARKER not in app:
    app = replace_once(
        app,
        "  VoiceEffect,\n  VoiceSoundCue,",
        "  VoiceEffect,\n  VoiceEnhancement,\n  VoiceSoundCue,",
        "import du traitement vocal",
    )
    app = replace_once(
        app,
        "const sectionGuideContent: Record<SectionGuideType, {",
        "const voiceEnhancementLabels: Record<VoiceEnhancement, string> = {\n"
        "  natural: 'Naturel',\n"
        "  'magic-boost': 'Magic Boost',\n"
        "};\n\n"
        "const sectionGuideContent: Record<SectionGuideType, {",
        "libellés du traitement vocal",
    )
    app = replace_once(
        app,
        "    voiceEffect: 'none',\n    voiceCues: type === 'voice' ? [] : undefined,",
        "    voiceEffect: 'none',\n"
        "    voiceEnhancement: type === 'voice' ? 'magic-boost' : 'natural',\n"
        "    voiceCues: type === 'voice' ? [] : undefined,",
        "valeur par défaut du traitement vocal",
    )
    app = app.replace(
        "{ style: 'modern-radio', musicLevel: 'low', musicVolume: 32 }",
        "{ style: 'modern-radio', musicLevel: 'low', musicVolume: 32, voiceEnhancement: 'magic-boost', musicLeadSeconds: 2, musicTailSeconds: 3 }",
    )
    app = replace_once(
        app,
        "  const jingle = block.jingle ?? { style: 'modern-radio' as const, musicLevel: 'low' as const, musicVolume: 32 };",
        "  const jingle = block.jingle ?? { style: 'modern-radio' as const, musicLevel: 'low' as const, musicVolume: 32, voiceEnhancement: 'magic-boost' as const, musicLeadSeconds: 2 as const, musicTailSeconds: 3 as const };",
        "valeurs par défaut du jingle",
    )
    voice_controls = """              <div className=\"setting-group voice-processing-setting\">
                <div className=\"setting-title-row\"><div><h3>Traitement vocal</h3><p>Magic Boost rend la voix plus régulière, plus présente et plus riche. Il ne s’applique jamais aux musiques ni aux bruitages.</p></div></div>
                <div className=\"option-grid compact-options\">{(Object.keys(voiceEnhancementLabels) as VoiceEnhancement[]).map((enhancement) => <button key={enhancement} className={(block.voiceEnhancement ?? 'magic-boost') === enhancement ? 'selected' : ''} onClick={() => update('voiceEnhancement', enhancement)}>{voiceEnhancementLabels[enhancement]}</button>)}</div>
              </div>
              <div className=\"setting-group\"><h3>Effet sur la voix</h3><div className=\"option-grid compact-options\">{(Object.keys(voiceEffectLabels) as VoiceEffect[]).map((effect) => <button key={effect} className={block.voiceEffect === effect ? 'selected' : ''} onClick={() => update('voiceEffect', effect)}>{voiceEffectLabels[effect]}</button>)}</div></div>"""
    app = replace_once(
        app,
        "              <div className=\"setting-group\"><h3>Effet sur la voix</h3><div className=\"option-grid compact-options\">{(Object.keys(voiceEffectLabels) as VoiceEffect[]).map((effect) => <button key={effect} className={block.voiceEffect === effect ? 'selected' : ''} onClick={() => update('voiceEffect', effect)}>{voiceEffectLabels[effect]}</button>)}</div></div>",
        voice_controls,
        "contrôle Magic Boost d'une voix",
    )
    jingle_controls = """      <div className=\"settings-columns jingle-settings\">
        <ChoiceSetting title=\"Style\" value={jingle.style} options={[[\"dynamic\", \"Dynamique\"], [\"adventure\", \"Aventure\"], [\"mysterious\", \"Mystérieux\"], [\"serious\", \"Sérieux\"], [\"historical\", \"Historique\"], [\"modern-radio\", \"Radio moderne\"]]} onChange={(value) => updateJingle({ style: value as NonNullable<PodcastBlock['jingle']>['style'] })} />
        <ChoiceSetting title=\"Musique avant la voix\" value={String(jingle.musicLeadSeconds ?? 2)} options={[[\"1\", \"1 seconde\"], [\"2\", \"2 secondes\"], [\"3\", \"3 secondes\"], [\"4\", \"4 secondes\"]]} onChange={(value) => updateJingle({ musicLeadSeconds: Number(value) as 1 | 2 | 3 | 4 })} />
        <ChoiceSetting title=\"Musique après la voix\" value={String(jingle.musicTailSeconds ?? 3)} options={[[\"1\", \"1 seconde\"], [\"2\", \"2 secondes\"], [\"3\", \"3 secondes\"], [\"4\", \"4 secondes\"]]} onChange={(value) => updateJingle({ musicTailSeconds: Number(value) as 1 | 2 | 3 | 4 })} />
        <ChoiceSetting title=\"Traitement de la voix\" value={jingle.voiceEnhancement ?? 'magic-boost'} options={[[\"natural\", \"Naturel\"], [\"magic-boost\", \"Magic Boost\"]]} onChange={(value) => updateJingle({ voiceEnhancement: value as VoiceEnhancement })} />
        <MusicVolumeSlider title=\"Musique sous la voix\" value={musicVolumePercent(jingle.musicVolume, backgroundMusicFallback(jingle.musicLevel))} onChange={(value) => updateJingle({ musicVolume: value })} />
      </div>"""
    old_jingle_controls = """      <div className=\"settings-columns jingle-settings\">
        <ChoiceSetting title=\"Style\" value={jingle.style} options={[[\"dynamic\", \"Dynamique\"], [\"adventure\", \"Aventure\"], [\"mysterious\", \"Mystérieux\"], [\"serious\", \"Sérieux\"], [\"historical\", \"Historique\"], [\"modern-radio\", \"Radio moderne\"]]} onChange={(value) => updateJingle({ style: value as NonNullable<PodcastBlock['jingle']>['style'] })} />
        <MusicVolumeSlider title=\"Musique sous la voix\" value={musicVolumePercent(jingle.musicVolume, backgroundMusicFallback(jingle.musicLevel))} onChange={(value) => updateJingle({ musicVolume: value })} />
      </div>"""
    app = replace_once(app, old_jingle_controls, jingle_controls, "contrôles temporels du jingle")
    app += f"\n// Traitement vocal et minutage de jingle : {MARKER}\n"
    APP_PATH.write_text(app, encoding="utf-8")


engine = ENGINE_PATH.read_text(encoding="utf-8")
if MARKER not in engine:
    engine = replace_once(
        engine,
        "import type { AudioAsset, FadeLevel, PodcastBlock, PodcastProject, VoiceEffect, VolumeLevel } from '../types';",
        "import type { AudioAsset, FadeLevel, PodcastBlock, PodcastProject, VoiceEffect, VoiceEnhancement, VolumeLevel } from '../types';",
        "import du traitement vocal dans le moteur",
    )
    timing_constants = """function voicePlaybackRate(effect: VoiceEffect): number {
  return effect === 'deep' ? 0.9 : effect === 'high' ? 1.12 : effect === 'very-high' ? 1.24 : 1;
}

const DEFAULT_JINGLE_LEAD_SECONDS = 2;
const DEFAULT_JINGLE_TAIL_SECONDS = 3;
const JINGLE_CLOSING_WINDOW_SECONDS = 4;
const JINGLE_CLOSING_FADE_SECONDS = 2.2;

function jingleTiming(value: number | undefined, fallback: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : fallback;
}

function jingleLeadIn(block: PodcastBlock): number {
  return jingleTiming(block.jingle?.musicLeadSeconds, DEFAULT_JINGLE_LEAD_SECONDS);
}

function jingleTail(block: PodcastBlock): number {
  return jingleTiming(block.jingle?.musicTailSeconds, DEFAULT_JINGLE_TAIL_SECONDS);
}"""
    old_timing_constants = """function voicePlaybackRate(effect: VoiceEffect): number {
  return effect === 'deep' ? 0.9 : effect === 'high' ? 1.12 : effect === 'very-high' ? 1.24 : 1;
}

// Jingle fades and music sliders: 20260807-jingle-music-mixing-1
const JINGLE_TAIL_SECONDS = 2.4;
const JINGLE_CLOSING_WINDOW_SECONDS = 4;
const JINGLE_CLOSING_FADE_SECONDS = 2.2;

const JINGLE_VOICE_START: Record<NonNullable<PodcastBlock['jingle']>['style'], number> = {
  dynamic: 0.65, adventure: 1.25, mysterious: 1.6, serious: 1, historical: 1.35, 'modern-radio': 0.8,
};"""
    engine = replace_once(engine, old_timing_constants, timing_constants, "constantes temporelles du jingle")
    engine = replace_once(
        engine,
        "    const style = block.jingle?.style ?? 'modern-radio';\n    return Math.max(legacyFallback, JINGLE_VOICE_START[style] + voice.duration + Math.max(JINGLE_TAIL_SECONDS, closingTail));",
        "    return jingleLeadIn(block) + voice.duration + Math.max(jingleTail(block), closingTail);",
        "durée calculée du jingle",
    )
    magic_boost = """function connectMagicBoost(context: RenderContext, input: AudioNode, destination: AudioNode): void {
  const rumbleFilter = context.createBiquadFilter();
  const warmth = context.createBiquadFilter();
  const presence = context.createBiquadFilter();
  const air = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  const makeup = context.createGain();
  const limiter = context.createDynamicsCompressor();

  rumbleFilter.type = 'highpass';
  rumbleFilter.frequency.value = 75;
  rumbleFilter.Q.value = 0.7;
  warmth.type = 'lowshelf';
  warmth.frequency.value = 160;
  warmth.gain.value = 2.2;
  presence.type = 'peaking';
  presence.frequency.value = 2800;
  presence.Q.value = 0.9;
  presence.gain.value = 2.6;
  air.type = 'highshelf';
  air.frequency.value = 7200;
  air.gain.value = 1.1;
  compressor.threshold.value = -20;
  compressor.knee.value = 14;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.012;
  compressor.release.value = 0.18;
  makeup.gain.value = 1.22;
  limiter.threshold.value = -1.2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.06;

  input.connect(rumbleFilter).connect(warmth).connect(presence).connect(air).connect(compressor).connect(makeup).connect(limiter).connect(destination);
}

function createMasterSafetyLimiter(context: RenderContext, destination: AudioNode): DynamicsCompressorNode {
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -1.2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.06;
  limiter.connect(destination);
  return limiter;
}
"""
    engine = replace_once(engine, "function applyFades(", magic_boost + "\nfunction applyFades(", "chaîne Magic Boost")
    engine = replace_once(
        engine,
        "  effect: VoiceEffect = 'none',\n  loop = false,",
        "  effect: VoiceEffect = 'none',\n  enhancement: VoiceEnhancement = 'natural',\n  loop = false,",
        "paramètre Magic Boost de la source",
    )
    engine = replace_once(
        engine,
        "  connectVoiceEffect(context, source, effect, gain);\n  gain.connect(destination);",
        "  connectVoiceEffect(context, source, effect, gain);\n  if (enhancement === 'magic-boost') connectMagicBoost(context, gain, destination);\n  else gain.connect(destination);",
        "routage vocal dédié",
    )
    engine = replace_once(
        engine,
        "      block.voiceEffect,\n    );\n  }\n\n  for (const cue",
        "      block.voiceEffect,\n      block.voiceEnhancement ?? 'magic-boost',\n    );\n  }\n\n  for (const cue",
        "Magic Boost des blocs vocaux",
    )
    engine = replace_once(
        engine,
        "  const profile = JINGLE_STYLE_PROFILES[style];\n  const music = assetById(project, block.jingle?.musicAssetId);",
        "  const profile = JINGLE_STYLE_PROFILES[style];\n  const leadIn = jingleLeadIn(block);\n  const tail = jingleTail(block);\n  const music = assetById(project, block.jingle?.musicAssetId);",
        "durées réglables du jingle",
    )
    engine = engine.replace("profile.voiceStart - localOffset", "leadIn - localOffset")
    engine = engine.replace("localOffset - profile.voiceStart", "localOffset - leadIn")
    engine = engine.replace("total - profile.voiceStart - JINGLE_TAIL_SECONDS", "total - leadIn - tail")
    engine = replace_once(
        engine,
        "      await scheduleAsset(context, destination, voice, cache, start + delay, consumed, voiceDuration, profile.voice, 'short', 'short', profile.voiceEffect);",
        "      await scheduleAsset(context, destination, voice, cache, start + delay, consumed, voiceDuration, profile.voice, 'short', 'short', profile.voiceEffect, block.jingle?.voiceEnhancement ?? 'magic-boost');",
        "Magic Boost de la voix de jingle",
    )
    old_playback_compressor = """  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 12;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;

  let mediaElement: HTMLAudioElement | null = null;
  let mediaStream: MediaStream | null = null;"""
    new_playback_compressor = """  let mediaElement: HTMLAudioElement | null = null;
  let mediaStream: MediaStream | null = null;
  let outputBus: AudioNode;"""
    engine = replace_once(engine, old_playback_compressor, new_playback_compressor, "compresseur global de lecture")
    engine = replace_once(
        engine,
        "    compressor.connect(mediaDestination);\n    mediaStream = mediaDestination.stream;",
        "    outputBus = createMasterSafetyLimiter(context, mediaDestination);\n    mediaStream = mediaDestination.stream;",
        "limiteur iOS de sortie",
    )
    engine = replace_once(
        engine,
        "  } else {\n    compressor.connect(context.destination);\n  }",
        "  } else {\n    outputBus = createMasterSafetyLimiter(context, context.destination);\n  }",
        "limiteur standard de sortie",
    )
    engine = replace_once(
        engine,
        "    await scheduleProject(context, compressor, project, offset, startAt, cache);",
        "    await scheduleProject(context, outputBus, project, offset, startAt, cache);",
        "bus de lecture",
    )
    old_export_compressor = """  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 12;
  compressor.ratio.value = 10;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  compressor.connect(context.destination);
  const cache = await decodeProjectAssets(context, project);
  await scheduleProject(context, compressor, project, 0, 0, cache);"""
    new_export_compressor = """  const outputBus = createMasterSafetyLimiter(context, context.destination);
  const cache = await decodeProjectAssets(context, project);
  await scheduleProject(context, outputBus, project, 0, 0, cache);"""
    engine = replace_once(engine, old_export_compressor, new_export_compressor, "compresseur global d'export")
    engine += f"\n// Traitement vocal et minutage de jingle : {MARKER}\n"
    ENGINE_PATH.write_text(engine, encoding="utf-8")


print("Traitement Magic Boost vocal et minutage réglable des jingles appliqués.")
