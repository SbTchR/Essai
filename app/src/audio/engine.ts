import type { AudioAsset, FadeLevel, PodcastBlock, PodcastProject, TransitionPreset, VoiceEffect, VolumeLevel } from '../types';

type RenderContext = AudioContext | OfflineAudioContext;

const SAMPLE_RATE = 44100;
const PRE_ROLL = 0.75;
const POST_ROLL = 0.75;

export interface TimelineEntry {
  block: PodcastBlock;
  start: number;
  end: number;
  duration: number;
}

export interface PlaybackController {
  context: AudioContext;
  totalDuration: number;
  startOffset: number;
  getElapsed: () => number;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function getBlockDuration(block: PodcastBlock): number {
  if (block.type === 'silence') return Math.max(0.1, block.duration);
  if (block.type === 'transition') return Math.min(3, Math.max(0.5, block.duration));
  if (block.type === 'jingle') {
    return block.jingle?.length === 'short' ? 6 : block.jingle?.length === 'long' ? 15 : 10;
  }
  const core = Math.max(0, block.trimEnd - block.trimStart || block.duration);
  if (block.type === 'voice' && block.background) {
    return core + (block.background.startBefore ? PRE_ROLL : 0) + (block.background.continueAfter ? POST_ROLL : 0);
  }
  return core;
}

export function getTimeline(project: PodcastProject): TimelineEntry[] {
  let cursor = 0;
  return project.blocks.map((block) => {
    const duration = getBlockDuration(block);
    const entry = { block, start: cursor, end: cursor + duration, duration };
    cursor += duration;
    return entry;
  });
}

export function getProjectDuration(project: PodcastProject): number {
  return getTimeline(project).at(-1)?.end ?? 0;
}

export async function getAudioDuration(blob: Blob): Promise<number> {
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    return buffer.duration;
  } finally {
    await context.close();
  }
}

function volumeValue(level: VolumeLevel): number {
  return level === 'low' ? 0.62 : level === 'high' ? 1.22 : 0.92;
}

function backgroundValue(level: 'very-low' | 'low' | 'present'): number {
  return level === 'very-low' ? 0.08 : level === 'present' ? 0.23 : 0.14;
}

function fadeSeconds(level: FadeLevel): number {
  return level === 'short' ? 0.5 : level === 'normal' ? 1.5 : 0;
}

async function decodeAsset(context: RenderContext, asset: AudioAsset, cache: Map<string, AudioBuffer>): Promise<AudioBuffer> {
  const cached = cache.get(asset.id);
  if (cached) return cached;
  const buffer = await context.decodeAudioData(await asset.blob.arrayBuffer());
  cache.set(asset.id, buffer);
  return buffer;
}

function assetById(project: PodcastProject, id?: string): AudioAsset | undefined {
  return id ? project.assets.find((asset) => asset.id === id) : undefined;
}

function connectVoiceEffect(context: RenderContext, source: AudioBufferSourceNode, effect: VoiceEffect, output: AudioNode): AudioNode {
  if (effect === 'phone') {
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 450;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3200;
    source.connect(highpass).connect(lowpass).connect(output);
    return output;
  }
  if (effect === 'echo') {
    const dry = context.createGain();
    const delay = context.createDelay(1);
    const feedback = context.createGain();
    delay.delayTime.value = 0.22;
    feedback.gain.value = 0.28;
    source.connect(dry).connect(output);
    source.connect(delay).connect(feedback).connect(delay);
    delay.connect(output);
    return output;
  }
  if (effect === 'deep') source.playbackRate.value = 0.9;
  if (effect === 'high') source.playbackRate.value = 1.1;
  source.connect(output);
  return output;
}

function applyFades(gain: GainNode, start: number, duration: number, fadeIn: FadeLevel, fadeOut: FadeLevel, peak: number, elapsed = 0): void {
  const inSeconds = Math.min(fadeSeconds(fadeIn), duration / 2);
  const outSeconds = Math.min(fadeSeconds(fadeOut), duration / 2);
  gain.gain.cancelScheduledValues(start);
  if (inSeconds > 0 && elapsed < inSeconds) {
    const initial = peak * Math.max(0.001, elapsed / inSeconds);
    gain.gain.setValueAtTime(initial, start);
    gain.gain.linearRampToValueAtTime(peak, start + (inSeconds - elapsed));
  } else {
    gain.gain.setValueAtTime(peak, start);
  }
  if (outSeconds > 0) {
    const fadeStart = start + Math.max(0, duration - outSeconds);
    gain.gain.setValueAtTime(peak, fadeStart);
    gain.gain.linearRampToValueAtTime(0.0001, start + duration);
  }
}

async function scheduleAsset(
  context: RenderContext,
  destination: AudioNode,
  asset: AudioAsset,
  cache: Map<string, AudioBuffer>,
  start: number,
  offset: number,
  duration: number,
  volume: number,
  fadeIn: FadeLevel,
  fadeOut: FadeLevel,
  effect: VoiceEffect = 'none',
  loop = false,
): Promise<void> {
  if (duration <= 0) return;
  const buffer = await decodeAsset(context, asset, cache);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  const gain = context.createGain();
  applyFades(gain, start, duration, fadeIn, fadeOut, volume, offset);
  connectVoiceEffect(context, source, effect, gain);
  gain.connect(destination);
  const safeOffset = loop ? offset % buffer.duration : Math.min(offset, Math.max(0, buffer.duration - 0.01));
  source.start(start, safeOffset, loop ? undefined : Math.min(duration, buffer.duration - safeOffset));
  source.stop(start + duration + 0.03);
}

function transitionTone(context: RenderContext, destination: AudioNode, preset: TransitionPreset, start: number, duration: number): void {
  const gain = context.createGain();
  gain.connect(destination);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.34, start + Math.min(0.08, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  if (preset === 'whoosh' || preset === 'page' || preset === 'radio') {
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      const progress = index / frames;
      const noise = Math.random() * 2 - 1;
      data[index] = noise * (preset === 'page' ? Math.sin(progress * Math.PI * 8) : 1) * (1 - progress);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = preset === 'radio' ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(preset === 'radio' ? 1800 : 350, start);
    filter.frequency.exponentialRampToValueAtTime(preset === 'radio' ? 700 : 6500, start + duration);
    source.connect(filter).connect(gain);
    source.start(start);
    return;
  }

  const oscillator = context.createOscillator();
  oscillator.type = preset === 'bell' ? 'sine' : preset === 'percussion' ? 'square' : 'triangle';
  const startFrequency = preset === 'mystery' ? 190 : preset === 'rise' ? 260 : 520;
  const endFrequency = preset === 'mystery' ? 110 : preset === 'rise' ? 950 : 360;
  oscillator.frequency.setValueAtTime(startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  oscillator.connect(gain);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

async function scheduleVoiceBlock(
  context: RenderContext,
  destination: AudioNode,
  block: PodcastBlock,
  project: PodcastProject,
  cache: Map<string, AudioBuffer>,
  start: number,
  localOffset: number,
): Promise<void> {
  const voiceAsset = assetById(project, block.assetId);
  if (!voiceAsset) return;
  const coreDuration = Math.max(0, block.trimEnd - block.trimStart || block.duration);
  const pre = block.background?.startBefore ? PRE_ROLL : 0;
  const post = block.background?.continueAfter ? POST_ROLL : 0;
  const total = pre + coreDuration + post;
  const remainingTotal = total - localOffset;
  if (remainingTotal <= 0) return;

  if (block.background) {
    const background = assetById(project, block.background.assetId);
    if (background) {
      const bgGain = context.createGain();
      bgGain.connect(destination);
      const level = backgroundValue(block.background.level);
      const bgStart = start;
      const voiceStartRelative = Math.max(0, pre - localOffset);
      const voiceRemaining = Math.max(0, coreDuration - Math.max(0, localOffset - pre));
      bgGain.gain.setValueAtTime(0.0001, bgStart);
      bgGain.gain.linearRampToValueAtTime(level * 1.35, bgStart + Math.min(0.5, remainingTotal / 4));
      if (voiceRemaining > 0) {
        bgGain.gain.linearRampToValueAtTime(level, bgStart + voiceStartRelative + 0.08);
        bgGain.gain.setValueAtTime(level, bgStart + voiceStartRelative + voiceRemaining);
        if (post > 0) bgGain.gain.linearRampToValueAtTime(level * 1.25, Math.min(bgStart + remainingTotal, bgStart + voiceStartRelative + voiceRemaining + 0.18));
      }
      bgGain.gain.linearRampToValueAtTime(0.0001, bgStart + remainingTotal);
      const bgBuffer = await decodeAsset(context, background, cache);
      const bgSource = context.createBufferSource();
      bgSource.buffer = bgBuffer;
      bgSource.loop = true;
      bgSource.connect(bgGain);
      bgSource.start(bgStart, localOffset % bgBuffer.duration);
      bgSource.stop(bgStart + remainingTotal + 0.03);
    }
  }

  const voiceTimelineStart = pre;
  const consumedVoice = Math.max(0, localOffset - voiceTimelineStart);
  if (consumedVoice >= coreDuration) return;
  const delay = Math.max(0, voiceTimelineStart - localOffset);
  const voiceDuration = coreDuration - consumedVoice;
  await scheduleAsset(
    context,
    destination,
    voiceAsset,
    cache,
    start + delay,
    block.trimStart + consumedVoice,
    voiceDuration,
    volumeValue(block.volume),
    block.fadeIn === 'none' ? 'short' : block.fadeIn,
    block.fadeOut === 'none' ? 'short' : block.fadeOut,
    block.voiceEffect,
  );
}

async function scheduleJingle(
  context: RenderContext,
  destination: AudioNode,
  block: PodcastBlock,
  project: PodcastProject,
  cache: Map<string, AudioBuffer>,
  start: number,
  localOffset: number,
): Promise<void> {
  const total = getBlockDuration(block);
  const remaining = total - localOffset;
  if (remaining <= 0) return;
  const music = assetById(project, block.jingle?.musicAssetId);
  const voice = assetById(project, block.jingle?.voiceAssetId);
  const opening = assetById(project, block.jingle?.openingAssetId);
  const closing = assetById(project, block.jingle?.closingAssetId);

  if (music) {
    const level = backgroundValue(block.jingle?.musicLevel ?? 'low');
    const gain = context.createGain();
    gain.connect(destination);
    const voiceStart = Math.max(0, 1.1 - localOffset);
    const voiceLength = voice ? Math.min(voice.duration, Math.max(0, total - 2.1)) : 0;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(level * 2.3, start + Math.min(0.45, remaining / 4));
    if (voiceLength > 0) {
      gain.gain.linearRampToValueAtTime(level, start + voiceStart + 0.12);
      gain.gain.setValueAtTime(level, start + voiceStart + voiceLength);
      gain.gain.linearRampToValueAtTime(level * 1.8, Math.min(start + remaining, start + voiceStart + voiceLength + 0.25));
    }
    gain.gain.linearRampToValueAtTime(0.0001, start + remaining);
    const buffer = await decodeAsset(context, music, cache);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start(start, localOffset % buffer.duration);
    source.stop(start + remaining + 0.03);
  } else {
    transitionTone(context, destination, block.jingle?.style === 'mysterious' ? 'mystery' : 'rise', start, remaining);
  }

  if (opening && localOffset < Math.min(opening.duration, 1.5)) {
    await scheduleAsset(context, destination, opening, cache, start, localOffset, Math.min(opening.duration - localOffset, remaining), 0.8, 'short', 'short');
  }
  if (voice) {
    const voiceStart = 1.1;
    const consumed = Math.max(0, localOffset - voiceStart);
    const delay = Math.max(0, voiceStart - localOffset);
    const voiceDuration = Math.min(voice.duration - consumed, total - voiceStart - 0.8);
    if (voiceDuration > 0) {
      await scheduleAsset(context, destination, voice, cache, start + delay, consumed, voiceDuration, 1, 'short', 'short');
    }
  }
  if (closing) {
    const closingStart = Math.max(0, total - Math.min(1.5, closing.duration));
    if (localOffset < total) {
      const delay = Math.max(0, closingStart - localOffset);
      const consumed = Math.max(0, localOffset - closingStart);
      const duration = Math.min(closing.duration - consumed, remaining - delay);
      if (duration > 0) await scheduleAsset(context, destination, closing, cache, start + delay, consumed, duration, 0.8, 'short', 'short');
    }
  }
}

async function scheduleBlock(
  context: RenderContext,
  destination: AudioNode,
  block: PodcastBlock,
  project: PodcastProject,
  cache: Map<string, AudioBuffer>,
  start: number,
  localOffset: number,
): Promise<void> {
  const total = getBlockDuration(block);
  if (localOffset >= total) return;
  if (block.type === 'silence') return;
  if (block.type === 'transition') {
    transitionTone(context, destination, block.transitionPreset ?? 'fade', start, total - localOffset);
    return;
  }
  if (block.type === 'jingle') {
    await scheduleJingle(context, destination, block, project, cache, start, localOffset);
    return;
  }
  if (block.type === 'voice') {
    await scheduleVoiceBlock(context, destination, block, project, cache, start, localOffset);
    return;
  }
  const asset = assetById(project, block.assetId);
  if (!asset) return;
  const sourceOffset = block.trimStart + localOffset;
  const duration = total - localOffset;
  await scheduleAsset(
    context,
    destination,
    asset,
    cache,
    start,
    sourceOffset,
    duration,
    volumeValue(block.volume),
    block.fadeIn,
    block.fadeOut,
  );
}

function referencedAssetIds(project: PodcastProject): Set<string> {
  const ids = new Set<string>();
  for (const block of project.blocks) {
    if (block.assetId) ids.add(block.assetId);
    if (block.background?.assetId) ids.add(block.background.assetId);
    if (block.jingle?.musicAssetId) ids.add(block.jingle.musicAssetId);
    if (block.jingle?.voiceAssetId) ids.add(block.jingle.voiceAssetId);
    if (block.jingle?.openingAssetId) ids.add(block.jingle.openingAssetId);
    if (block.jingle?.closingAssetId) ids.add(block.jingle.closingAssetId);
  }
  return ids;
}

async function decodeProjectAssets(context: RenderContext, project: PodcastProject): Promise<Map<string, AudioBuffer>> {
  const cache = new Map<string, AudioBuffer>();
  const ids = referencedAssetIds(project);
  const assets = project.assets.filter((asset) => ids.has(asset.id));
  await Promise.all(assets.map((asset) => decodeAsset(context, asset, cache)));
  return cache;
}

async function scheduleProject(
  context: RenderContext,
  destination: AudioNode,
  project: PodcastProject,
  offset: number,
  baseStart: number,
  cache: Map<string, AudioBuffer>,
): Promise<void> {
  const timeline = getTimeline(project);
  let scheduleCursor = baseStart;
  for (const entry of timeline) {
    if (offset >= entry.end) continue;
    const localOffset = Math.max(0, offset - entry.start);
    await scheduleBlock(context, destination, entry.block, project, cache, scheduleCursor, localOffset);
    scheduleCursor += entry.duration - localOffset;
  }
}

export async function playProject(project: PodcastProject, offset = 0): Promise<PlaybackController> {
  const context = new AudioContext();

  // Safari iOS exige que resume() soit appelé pendant le geste utilisateur.
  // L'appel est lancé immédiatement, avant tout décodage ou autre attente asynchrone.
  const unlockPromise = context.state === 'suspended'
    ? context.resume().catch(() => undefined)
    : Promise.resolve();

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 12;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.2;
  compressor.connect(context.destination);

  try {
    // Tous les fichiers sont décodés avant de fixer l'instant de départ.
    // La timeline ne peut ainsi plus commencer dans le passé pendant le décodage.
    const cache = await decodeProjectAssets(context, project);
    await unlockPromise;
    if (context.state === 'suspended') await context.resume();

    const startAt = context.currentTime + 0.2;
    await scheduleProject(context, compressor, project, offset, startAt, cache);
    const totalDuration = getProjectDuration(project);
    return {
      context,
      totalDuration,
      startOffset: offset,
      getElapsed: () => Math.min(totalDuration, offset + Math.max(0, context.currentTime - startAt)),
      pause: () => context.suspend(),
      resume: () => context.resume(),
      stop: () => context.state === 'closed' ? Promise.resolve() : context.close(),
    };
  } catch (error) {
    if (context.state !== 'closed') await context.close().catch(() => undefined);
    throw error;
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  let offset = 0;
  const writeString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
    offset += value.length;
  };
  writeString('RIFF');
  view.setUint32(offset, length - 8, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channels, true); offset += 2;
  view.setUint32(offset, buffer.sampleRate, true); offset += 4;
  view.setUint32(offset, buffer.sampleRate * channels * 2, true); offset += 4;
  view.setUint16(offset, channels * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString('data');
  view.setUint32(offset, length - offset - 4, true); offset += 4;

  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let index = 0; index < buffer.length; index += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function renderProjectToWav(project: PodcastProject): Promise<Blob> {
  const duration = Math.max(0.1, getProjectDuration(project));
  const context = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 12;
  compressor.ratio.value = 10;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  compressor.connect(context.destination);
  const cache = await decodeProjectAssets(context, project);
  await scheduleProject(context, compressor, project, 0, 0, cache);
  const rendered = await context.startRendering();
  return audioBufferToWav(rendered);
}
