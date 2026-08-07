import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AUDIO_LIBRARY, LIBRARY_CATEGORIES, loadLibraryAudio, type LibraryKind, type LibraryPreset } from './data/audioLibrary';
import {
  formatTime,
  getAudioDuration,
  getBlockDuration,
  getProjectDuration,
  getTimeline,
  playProject,
  renderProjectToWav,
  type PlaybackController,
} from './audio/engine';
import { deleteProject, listProjects, loadProject, saveProject } from './storage/db';
import { deserializeProject, serializeProject } from './storage/projectFile';
import type {
  AudioAsset,
  BackgroundAudio,
  BlockType,
  FadeLevel,
  PodcastBlock,
  PodcastProject,
  PodcastSection,
  Screen,
  SectionGuideType,
  TransitionPreset,
  VoiceEffect,
  VoiceSoundCue,
  VolumeLevel,
} from './types';

// Guided structure and audio levels: 20260722-guided-structure-1
// Real transitions and coherent previews: 20260722-real-transitions-preview-1
const APP_NAME = 'Podcast Facile';
const WELCOME_TEXT = 'Crée ton podcast en assemblant simplement ta voix, des musiques et des bruitages.';
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const blockLabels: Record<BlockType, string> = {
  voice: 'Voix',
  music: 'Musique',
  sfx: 'Bruitage',
  silence: 'Pause',
  jingle: 'Jingle',
  transition: 'Transition',
};

const blockIcons: Record<BlockType, string> = {
  voice: '🎙️',
  music: '🎵',
  sfx: '🔊',
  silence: '⏸️',
  jingle: '📻',
  transition: '✨',
};

type TransitionRecording = {
  preset: TransitionPreset;
  libraryId: string;
  label: string;
  icon: string;
  description: string;
};

const TRANSITION_RECORDINGS: TransitionRecording[] = [
  { preset: 'impact', libraryId: 'sfx-dull-thud', label: 'Impact sourd', icon: '💥', description: 'Un coup sec pour ponctuer une idée.' },
  { preset: 'failure', libraryId: 'sfx-buzzer-real', label: 'Buzzer d’échec', icon: '🚫', description: 'Un signal immédiatement reconnaissable.' },
  { preset: 'question', libraryId: 'sfx-onomatopoeia-question', label: 'Interrogation', icon: '❓', description: 'Une courte réaction vocale interrogative.' },
  { preset: 'drop', libraryId: 'sfx-pen-drop', label: 'Objet qui tombe', icon: '🖊️', description: 'Un petit objet heurte le sol.' },
  { preset: 'bell', libraryId: 'sfx-bicycle-bell', label: 'Sonnette', icon: '🔔', description: 'Une sonnette de vélo claire et légère.' },
  { preset: 'fade', libraryId: 'sfx-door-knocker', label: 'Coups à la porte', icon: '🚪', description: 'Trois coups brefs sur un heurtoir.' },
  { preset: 'rise', libraryId: 'sfx-human-whistling', label: 'Sifflement', icon: '😗', description: 'Un sifflement humain très court.' },
  { preset: 'cinematic', libraryId: 'sfx-explosion', label: 'Explosion', icon: '💣', description: 'Une détonation unique et nette.' },
  { preset: 'portal', libraryId: 'sfx-steamboat-horn', label: 'Corne de bateau', icon: '🛳️', description: 'Un bref appel de bateau à vapeur.' },
  { preset: 'mystery', libraryId: 'sfx-music-box', label: 'Boîte à musique', icon: '🎠', description: 'Une ponctuation musicale intrigante.' },
  { preset: 'sparkle', libraryId: 'sfx-onomatopoeia-pop', label: 'Pop vocal', icon: '🫧', description: 'Un petit “pop” produit avec la bouche.' },
  { preset: 'radio', libraryId: 'sfx-airplane-chime', label: 'Signal sonore', icon: '✈️', description: 'Le carillon bref entendu dans un avion.' },
  { preset: 'page', libraryId: 'sfx-turn-page', label: 'Page tournée', icon: '📄', description: 'Une vraie page tournée, idéale pour changer de chapitre.' },
  { preset: 'whoosh', libraryId: 'sfx-car-horn', label: 'Klaxon bref', icon: '🚗', description: 'Un coup de klaxon court et reconnaissable.' },
];

const voiceEffectLabels: Record<VoiceEffect, string> = {
  none: 'Aucun effet',
  phone: 'Effet téléphone',
  echo: 'Rêve',
  distant: 'Caverne',
  deep: 'Voix grave',
  high: 'Voix aiguë',
  'very-high': 'Voix très aiguë',
};

const sectionGuideContent: Record<SectionGuideType, {
  title: string;
  icon: string;
  summary: string;
  prompts: string[];
  examples: string[];
}> = {
  'intro-jingle': {
    title: 'Jingle d’intro', icon: '🎬',
    summary: 'Ouvre le podcast avec une identité sonore courte et annonce clairement le programme.',
    prompts: ['Présente le nom du podcast.', 'Annonce le thème général en une phrase.', 'Donne envie d’écouter la suite.'],
    examples: ['« Bienvenue dans “…”, le podcast qui parle de… »', '« Installez-vous : aujourd’hui, nous allons… »'],
  },
  introduction: {
    title: 'Introduction', icon: '👋',
    summary: 'Présente le sujet, la question principale et le chemin que suivra l’épisode.',
    prompts: ['Explique pourquoi le sujet mérite qu’on s’y intéresse.', 'Pose une question directrice.', 'Annonce brièvement les grandes parties.'],
    examples: ['« Aujourd’hui, nous allons chercher à comprendre… »', '« Pour commencer, posons-nous cette question : … »', '« Nous verrons d’abord…, puis…, avant de… »'],
  },
  part: {
    title: 'Partie', icon: '🧩',
    summary: 'Développe une idée importante avec des explications, des faits et des exemples.',
    prompts: ['Commence par l’idée principale de cette partie.', 'Ajoute un exemple ou un fait utile.', 'Termine par une transition vers la suite.'],
    examples: ['« Tout d’abord, il faut comprendre que… »', '« Un élément important est… »', '« Cet exemple montre que… »', '« Passons maintenant à… »'],
  },
  'intermediate-jingle': {
    title: 'Jingle intermédiaire', icon: '🔀',
    summary: 'Crée une respiration sonore et signale clairement le passage vers une nouvelle étape.',
    prompts: ['Résume très brièvement ce qui vient d’être dit.', 'Annonce la partie suivante.', 'Garde une formulation courte et rythmée.'],
    examples: ['« Après cette première étape, poursuivons avec… »', '« Dans un instant, nous allons découvrir… »'],
  },
  conclusion: {
    title: 'Conclusion', icon: '✅',
    summary: 'Rassemble les idées essentielles, répond à la question de départ et propose une ouverture.',
    prompts: ['Rappelle les deux ou trois idées principales.', 'Formule une réponse claire.', 'Termine par une ouverture ou une invitation à réfléchir.'],
    examples: ['« Pour résumer, nous avons vu que… »', '« Nous pouvons donc retenir que… »', '« Il reste maintenant à se demander… »'],
  },
  'final-jingle': {
    title: 'Jingle final', icon: '🏁',
    summary: 'Ferme l’épisode avec une signature sonore, un remerciement et éventuellement un rendez-vous.',
    prompts: ['Remercie les auditeurs.', 'Rappelle le nom du podcast.', 'Invite à écouter un prochain épisode.'],
    examples: ['« Merci d’avoir écouté “…”. »', '« À bientôt pour un nouvel épisode consacré à… »'],
  },
};

function cloneBlock(block: PodcastBlock): PodcastBlock {
  return {
    ...block,
    background: block.background ? { ...block.background } : undefined,
    jingle: block.jingle ? { ...block.jingle } : undefined,
    voiceCues: block.voiceCues?.map((cue) => ({ ...cue })),
  };
}

function cloneProject(project: PodcastProject): PodcastProject {
  return {
    ...project,
    sections: project.sections.map((section) => ({ ...section })),
    blocks: project.blocks.map(cloneBlock),
    assets: project.assets.map((asset) => ({ ...asset, blob: asset.blob })),
  };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'podcast';
}

const PREVIEW_STOP_EVENT = 'podcast-facile-stop-preview';

interface PreviewSession {
  totalDuration: number;
  getElapsed: () => number;
  stop: () => Promise<void> | void;
}

function requestExclusivePreview(ownerId: string): void {
  window.dispatchEvent(new CustomEvent<string>(PREVIEW_STOP_EVENT, { detail: ownerId }));
}

async function createLibraryPreviewSession(preset: LibraryPreset): Promise<PreviewSession> {
  const blob = await loadLibraryAudio(preset);
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  const previewStart = Math.max(0, preset.clipStart ?? 0);
  const requestedDuration = Math.max(0.05, preset.clipDuration ?? preset.duration);
  try {
    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error('Le navigateur ne parvient pas à lire cet aperçu.'));
      audio.load();
    });
    const safeStart = Math.min(previewStart, Math.max(0, audio.duration - 0.05));
    const totalDuration = Math.min(requestedDuration, Math.max(0.05, audio.duration - safeStart));
    audio.currentTime = safeStart;
    await audio.play();
    return {
      totalDuration,
      getElapsed: () => Math.min(totalDuration, Math.max(0, audio.currentTime - safeStart)),
      stop: () => {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    audio.pause();
    URL.revokeObjectURL(url);
    throw error;
  }
}

function TimedPreviewButton({ previewId, onStart, disabled = false, label = 'Écouter l’aperçu', compact = false }: {
  previewId: string;
  onStart: () => Promise<PreviewSession>;
  disabled?: boolean;
  label?: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const sessionRef = useRef<PreviewSession | null>(null);
  const timerRef = useRef<number | null>(null);
  const requestRef = useRef(0);

  const stop = useCallback(() => {
    requestRef.current += 1;
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) void Promise.resolve(session.stop()).catch(() => undefined);
    setStatus('idle');
    setElapsed(0);
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== previewId) stop();
    };
    window.addEventListener(PREVIEW_STOP_EVENT, listener);
    return () => {
      window.removeEventListener(PREVIEW_STOP_EVENT, listener);
      stop();
    };
  }, [previewId, stop]);

  const toggle = async () => {
    if (status !== 'idle') {
      stop();
      return;
    }
    requestExclusivePreview(previewId);
    const request = ++requestRef.current;
    setError('');
    setElapsed(0);
    setDuration(0);
    setStatus('loading');
    try {
      const session = await onStart();
      if (request !== requestRef.current) {
        await Promise.resolve(session.stop());
        return;
      }
      sessionRef.current = session;
      setDuration(session.totalDuration);
      setStatus('playing');
      timerRef.current = window.setInterval(() => {
        const current = sessionRef.current;
        if (!current) return;
        const value = current.getElapsed();
        setElapsed(value);
        if (value >= current.totalDuration - 0.04) stop();
      }, 80);
    } catch (reason) {
      if (request !== requestRef.current) return;
      setStatus('idle');
      setError(reason instanceof Error ? reason.message : 'Impossible de lire cet aperçu.');
    }
  };

  const progress = duration > 0 ? Math.min(100, elapsed / duration * 100) : 0;
  return (
    <div className={`timed-preview ${compact ? 'compact' : ''}`}>
      <button className={`preview-control ${status}`} disabled={disabled} onClick={() => void toggle()} aria-busy={status === 'loading'}>
        <span className="preview-control-main">
          {status === 'loading' ? <i className="preview-spinner" aria-hidden="true" /> : <span aria-hidden="true">{status === 'playing' ? '■' : '▶'}</span>}
          <strong>{status === 'loading' ? 'Chargement…' : status === 'playing' ? 'Arrêter' : label}</strong>
          {status === 'playing' && <small>{formatTime(elapsed)} / {formatTime(duration)}</small>}
        </span>
        {status === 'playing' && <span className="preview-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></span>}
      </button>
      {error && <small className="preview-error" role="alert">{error}</small>}
    </div>
  );
}

function makeSection(title: string, kind: PodcastSection['kind'] = 'standard', guideType?: SectionGuideType): PodcastSection {
  return { id: crypto.randomUUID(), title, collapsed: false, kind, guideType };
}

function makeBlock(type: BlockType, sectionId: string): PodcastBlock {
  const duration = type === 'silence' ? 1 : type === 'transition' ? 1.2 : type === 'jingle' ? 10 : 0;
  return {
    id: crypto.randomUUID(),
    sectionId,
    type,
    title: type === 'voice' ? 'Nouvelle voix' : type === 'music' ? 'Nouvelle musique' : type === 'sfx' ? 'Nouveau bruitage' : type === 'silence' ? 'Pause' : type === 'jingle' ? 'Mon jingle' : 'Transition',
    duration,
    trimStart: 0,
    trimEnd: duration,
    volume: 'normal',
    fadeIn: type === 'voice' ? 'short' : 'normal',
    fadeOut: type === 'voice' ? 'short' : 'normal',
    voiceEffect: 'none',
    voiceCues: type === 'voice' ? [] : undefined,
    transitionPreset: undefined,
    transitionVolume: type === 'transition' ? 'normal' : undefined,
    jingle: type === 'jingle' ? { style: 'modern-radio', musicLevel: 'low' } : undefined,
  };
}

function makeGuidedSection(guideType: SectionGuideType, existingSections: PodcastSection[]): { section: PodcastSection; block?: PodcastBlock } {
  const isJingle = guideType === 'intro-jingle' || guideType === 'intermediate-jingle' || guideType === 'final-jingle';
  const partNumber = existingSections.filter((section) => section.guideType === 'part').length + 1;
  const title = guideType === 'part' ? `Partie ${partNumber}` : sectionGuideContent[guideType].title;
  const section = makeSection(title, isJingle ? 'jingle' : 'standard', guideType);
  if (!isJingle) return { section };
  const block = makeBlock('jingle', section.id);
  block.title = title;
  return { section, block };
}

function createProject(title: string, author: string): PodcastProject {
  const now = new Date().toISOString();
  const sections: PodcastSection[] = [];
  const blocks: PodcastBlock[] = [];
  const preset: SectionGuideType[] = ['intro-jingle', 'introduction', 'part', 'part', 'intermediate-jingle', 'part', 'conclusion', 'final-jingle'];
  for (const guideType of preset) {
    const created = makeGuidedSection(guideType, sections);
    sections.push(created.section);
    if (created.block) blocks.push(created.block);
  }
  return {
    id: crypto.randomUUID(),
    title: title.trim() || 'Mon podcast',
    author: author.trim(),
    targetDuration: undefined,
    templateId: 'guided',
    sections,
    blocks,
    assets: [],
    createdAt: now,
    updatedAt: now,
  };
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [project, setProject] = useState<PodcastProject | null>(null);
  const [projects, setProjects] = useState<PodcastProject[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const [toast, setToast] = useState<string>('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [sectionHelp, setSectionHelp] = useState<PodcastSection | null>(null);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addSectionId, setAddSectionId] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<PodcastBlock | null>(null);
  const [editingIsNew, setEditingIsNew] = useState(false);
  const [setupTitle, setSetupTitle] = useState('');
  const [setupAuthor, setSetupAuthor] = useState('');
  const undoRef = useRef<PodcastProject[]>([]);
  const redoRef = useRef<PodcastProject[]>([]);

  const playbackRef = useRef<PlaybackController | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const playbackRequestRef = useRef(0);
  const [playbackStatus, setPlaybackStatus] = useState<'stopped' | 'loading' | 'playing' | 'paused'>('stopped');
  const [playbackDisplayDuration, setPlaybackDisplayDuration] = useState(0);
  const [playbackKind, setPlaybackKind] = useState<'project' | 'block'>('project');
  const [elapsed, setElapsed] = useState(0);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossible de lire les projets locaux.');
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    requestExclusivePreview(`screen-${screen}`);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [screen]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const applyChange = useCallback((mutator: (draft: PodcastProject) => void, recordHistory = true) => {
    setProject((current) => {
      if (!current) return current;
      if (recordHistory) {
        undoRef.current.push(cloneProject(current));
        if (undoRef.current.length > 40) undoRef.current.shift();
        redoRef.current = [];
      }
      const draft = cloneProject(current);
      mutator(draft);
      draft.updatedAt = new Date().toISOString();
      return draft;
    });
    setDirty(true);
    setSaveState('dirty');
  }, []);

  const saveCurrentProject = useCallback(async (showToast = true) => {
    if (!project) return;
    setSaveState('saving');
    try {
      const next = { ...project, updatedAt: new Date().toISOString() };
      await saveProject(next);
      setProject(next);
      setDirty(false);
      setSaveState('saved');
      if (showToast) setToast('Projet sauvegardé sur cet appareil.');
      await refreshProjects();
    } catch (error) {
      setSaveState('dirty');
      setToast(error instanceof Error ? error.message : 'Échec de la sauvegarde.');
    }
  }, [project, refreshProjects]);

  useEffect(() => {
    if (!project || !dirty) return;
    const timeout = window.setTimeout(() => void saveCurrentProject(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [dirty, project, saveCurrentProject]);

  const stopPlayback = useCallback(() => {
    playbackRequestRef.current += 1;
    if (playbackTimerRef.current !== null) window.clearInterval(playbackTimerRef.current);
    playbackTimerRef.current = null;
    const controller = playbackRef.current;
    playbackRef.current = null;
    if (controller) void controller.stop().catch(() => undefined);
    setPlaybackStatus('stopped');
    setActiveBlockId(null);
  }, []);

  useEffect(() => () => { void stopPlayback(); }, [stopPlayback]);

  useEffect(() => {
    const listener = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== 'global-player') stopPlayback();
    };
    window.addEventListener(PREVIEW_STOP_EVENT, listener);
    return () => window.removeEventListener(PREVIEW_STOP_EVENT, listener);
  }, [stopPlayback]);

  const beginPlayback = useCallback(async (offset = 0) => {
    if (!project || getProjectDuration(project) <= 0) return;
    requestExclusivePreview('global-player');
    stopPlayback();
    const request = ++playbackRequestRef.current;
    setPlaybackKind('project');
    setPlaybackDisplayDuration(getProjectDuration(project));
    setPlaybackStatus('loading');
    try {
      const controller = await playProject(project, offset);
      if (request !== playbackRequestRef.current) {
        await controller.stop();
        return;
      }
      playbackRef.current = controller;
      setElapsed(offset);
      setPlaybackStatus('playing');
      playbackTimerRef.current = window.setInterval(() => {
        const current = playbackRef.current;
        if (!current) return;
        const value = current.getElapsed();
        setElapsed(value);
        const active = getTimeline(project).find((entry) => value >= entry.start && value < entry.end);
        setActiveBlockId(active?.block.id ?? null);
        if (value >= current.totalDuration - 0.04) void stopPlayback();
      }, 100);
    } catch (error) {
      if (request !== playbackRequestRef.current) return;
      setToast(error instanceof Error ? error.message : 'La lecture audio a échoué.');
      stopPlayback();
    }
  }, [project, stopPlayback]);

  const togglePause = useCallback(async () => {
    const controller = playbackRef.current;
    if (!controller) {
      await beginPlayback(elapsed);
      return;
    }
    if (playbackStatus === 'loading') return;
    if (playbackStatus === 'playing') {
      await controller.pause();
      setPlaybackStatus('paused');
    } else {
      await controller.resume();
      setPlaybackStatus('playing');
    }
  }, [beginPlayback, elapsed, playbackStatus]);

  const undo = useCallback(() => {
    if (!project || undoRef.current.length === 0) return;
    const previous = undoRef.current.pop()!;
    redoRef.current.push(cloneProject(project));
    setProject(previous);
    setDirty(true);
    setSaveState('dirty');
  }, [project]);

  const redo = useCallback(() => {
    if (!project || redoRef.current.length === 0) return;
    const next = redoRef.current.pop()!;
    undoRef.current.push(cloneProject(project));
    setProject(next);
    setDirty(true);
    setSaveState('dirty');
  }, [project]);

  const openProject = async (id: string) => {
    const loaded = await loadProject(id);
    if (!loaded) {
      setToast('Ce projet est introuvable.');
      return;
    }
    await stopPlayback();
    undoRef.current = [];
    redoRef.current = [];
    setProject(loaded);
    setDirty(false);
    setSaveState('saved');
    setElapsed(0);
    setScreen('editor');
  };

  const startSetup = () => {
    setSetupTitle('');
    setSetupAuthor('');
    setScreen('setup');
  };

  const finishSetup = () => {
    if (!setupTitle.trim()) {
      setToast('Indique un titre pour commencer.');
      return;
    }
    const next = createProject(setupTitle, setupAuthor);
    setProject(next);
    undoRef.current = [];
    redoRef.current = [];
    setDirty(true);
    setSaveState('dirty');
    setScreen('editor');
  };

  const goHome = async () => {
    if (dirty) await saveCurrentProject(false);
    await stopPlayback();
    setScreen('home');
    setProject(null);
    setElapsed(0);
    await refreshProjects();
  };

  const registerAsset = async (file: Blob, name: string, mimeType = file.type || 'audio/webm', knownDuration?: number, metadata?: Pick<AudioAsset, 'source' | 'libraryId'>): Promise<AudioAsset> => {
    if (file.size > MAX_FILE_SIZE) throw new Error('Ce fichier dépasse la limite de 50 Mo.');
    const duration = knownDuration ?? await getAudioDuration(file);
    const asset: AudioAsset = { id: crypto.randomUUID(), name, mimeType, duration, blob: file, ...metadata };
    applyChange((draft) => { draft.assets.push(asset); });
    return asset;
  };

  const saveBlock = (block: PodcastBlock) => {
    applyChange((draft) => {
      const existingIndex = draft.blocks.findIndex((item) => item.id === block.id);
      if (existingIndex >= 0) draft.blocks[existingIndex] = block;
      else {
        const indexes = draft.blocks.map((item, index) => item.sectionId === block.sectionId ? index : -1).filter((index) => index >= 0);
        const insertAt = indexes.length ? Math.max(...indexes) + 1 : draft.blocks.length;
        draft.blocks.splice(insertAt, 0, block);
      }
    });
    setEditingBlock(null);
    setEditingIsNew(false);
  };

  const addGuidedSection = (guideType: SectionGuideType) => {
    if (!project) return;
    const created = makeGuidedSection(guideType, project.sections);
    applyChange((draft) => {
      draft.sections.push(created.section);
      if (created.block) draft.blocks.push(created.block);
    });
    setAddSectionOpen(false);
    if (created.block) {
      setEditingBlock(created.block);
      setEditingIsNew(true);
    }
  };


  const closeBlockEditor = () => {
    if (editingIsNew && editingBlock?.type === 'jingle' && project?.sections.find((section) => section.id === editingBlock.sectionId)?.kind === 'jingle') {
      applyChange((draft) => {
        draft.blocks = draft.blocks.filter((item) => item.id !== editingBlock.id);
        draft.sections = draft.sections.filter((item) => item.id !== editingBlock.sectionId);
      });
    }
    setEditingBlock(null);
    setEditingIsNew(false);
  };

  const exportProjectFile = async () => {
    if (!project) return;
    setRendering(true);
    try {
      const blob = await serializeProject(project);
      downloadBlob(blob, `${safeFilename(project.title)}.podfacile`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Impossible d’exporter la sauvegarde.');
    } finally {
      setRendering(false);
    }
  };

  const importProjectFile = async (file: File) => {
    try {
      const imported = await deserializeProject(file);
      await saveProject(imported);
      setToast('Projet importé.');
      await refreshProjects();
      await openProject(imported.id);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Ce fichier ne peut pas être importé.');
    }
  };

  const exportWav = async () => {
    if (!project) return;
    setRendering(true);
    setToast('Création du fichier WAV en cours…');
    try {
      const wav = await renderProjectToWav(project);
      downloadBlob(wav, `${safeFilename(project.title)}.wav`);
      setToast('Le podcast WAV a été créé.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'L’export WAV a échoué.');
    } finally {
      setRendering(false);
    }
  };

  const projectDuration = project ? getProjectDuration(project) : 0;
  const timeline = useMemo(() => project ? getTimeline(project) : [], [project]);

  if (screen === 'home') {
    return (
      <HomeScreen
        projects={projects}
        onCreate={startSetup}
        onOpen={openProject}
        onDelete={async (id) => {
          if (!window.confirm('Supprimer définitivement ce projet enregistré sur cet appareil ?')) return;
          await deleteProject(id);
          await refreshProjects();
        }}
        onDuplicate={async (source) => {
          const copy = cloneProject(source);
          copy.id = crypto.randomUUID();
          copy.title = `${copy.title} – copie`;
          copy.createdAt = new Date().toISOString();
          copy.updatedAt = copy.createdAt;
          await saveProject(copy);
          await refreshProjects();
          setToast('Projet dupliqué.');
        }}
        onImport={importProjectFile}
        onHelp={() => setHelpOpen(true)}
      />
    );
  }

  if (screen === 'setup') {
    return (
      <SetupScreen
        title={setupTitle}
        author={setupAuthor}
        onTitle={setSetupTitle}
        onAuthor={setSetupAuthor}
        onBack={() => setScreen('home')}
        onFinish={finishSetup}
      />
    );
  }

  if (!project) return null;

  if (screen === 'export') {
    return (
      <ExportScreen
        project={project}
        duration={projectDuration}
        rendering={rendering}
        onBack={() => setScreen('editor')}
        onListen={() => playProject(project, 0)}
        onExportWav={() => void exportWav()}
        onExportProject={() => void exportProjectFile()}
      />
    );
  }

  return (
    <div className="app-shell">
      <EditorTopbar
        project={project}
        duration={projectDuration}
        saveState={saveState}
        canUndo={undoRef.current.length > 0}
        canRedo={redoRef.current.length > 0}
        onHome={() => void goHome()}
        onSave={() => void saveCurrentProject()}
        onUndo={undo}
        onRedo={redo}
        onHelp={() => setHelpOpen(true)}
        onExport={() => setScreen('export')}
      />

      <main className="editor-main">
        <div className="editor-intro">
          <div>
            <h1>{project.title}</h1>
            <p>Assemble les éléments dans l’ordre d’écoute. Les réglages complexes restent automatiques.</p>
          </div>
        </div>

        {project.sections.map((section, sectionIndex) => {
          const blocks = project.blocks.filter((block) => block.sectionId === section.id);
          const duration = blocks.reduce((sum, block) => sum + getBlockDuration(block, project.assets), 0);
          return (
            <SectionPanel
              key={section.id}
              section={section}
              sectionIndex={sectionIndex}
              sectionCount={project.sections.length}
              blocks={blocks}
              assets={project.assets}
              duration={duration}
              activeBlockId={activeBlockId}
              playbackStatus={playbackStatus}
              onRename={(title) => applyChange((draft) => { const item = draft.sections.find((candidate) => candidate.id === section.id); if (item) item.title = title; })}
              onToggle={() => applyChange((draft) => { const item = draft.sections.find((candidate) => candidate.id === section.id); if (item) item.collapsed = !item.collapsed; })}
              onHelp={() => setSectionHelp(section)}
              onAdd={() => setAddSectionId(section.id)}
              onMoveSection={(direction) => applyChange((draft) => {
                const index = draft.sections.findIndex((item) => item.id === section.id);
                const target = index + direction;
                if (target < 0 || target >= draft.sections.length) return;
                [draft.sections[index], draft.sections[target]] = [draft.sections[target], draft.sections[index]];
              })}
              onDeleteSection={() => {
                const contentWarning = blocks.length > 0 ? ' et tout son contenu' : '';
                if (!window.confirm(`Supprimer la section « ${section.title} »${contentWarning} ?`)) return;
                applyChange((draft) => {
                  draft.blocks = draft.blocks.filter((item) => item.sectionId !== section.id);
                  draft.sections = draft.sections.filter((item) => item.id !== section.id);
                });
              }}
              onPlay={(block) => {
                if (activeBlockId === block.id && (playbackStatus === 'playing' || playbackStatus === 'paused')) {
                  void togglePause();
                  return;
                }
                requestExclusivePreview('global-player');
                stopPlayback();
                const request = ++playbackRequestRef.current;
                const previewProject = { ...project, blocks: [block] };
                setPlaybackKind('block');
                setPlaybackDisplayDuration(getBlockDuration(block, project.assets));
                setElapsed(0);
                setActiveBlockId(block.id);
                setPlaybackStatus('loading');
                void playProject(previewProject, 0).then((controller) => {
                  if (request !== playbackRequestRef.current) {
                    void controller.stop();
                    return;
                  }
                  playbackRef.current = controller;
                  setPlaybackStatus('playing');
                  playbackTimerRef.current = window.setInterval(() => {
                    const current = playbackRef.current;
                    if (!current) return;
                    const value = current.getElapsed();
                    setElapsed(value);
                    if (value >= current.totalDuration - 0.04) { setElapsed(0); void stopPlayback(); }
                  }, 80);
                }).catch((error) => {
                  if (request !== playbackRequestRef.current) return;
                  setToast(error instanceof Error ? error.message : 'Impossible de lire cet élément.');
                  stopPlayback();
                });
              }}
              onEdit={(block) => { setEditingBlock(cloneBlock(block)); setEditingIsNew(false); }}
              onDuplicate={(block) => applyChange((draft) => {
                const index = draft.blocks.findIndex((item) => item.id === block.id);
                const copy = cloneBlock(block);
                copy.id = crypto.randomUUID();
                copy.title = `${copy.title} – copie`;
                draft.blocks.splice(index + 1, 0, copy);
              })}
              onDelete={(block) => {
                if (!window.confirm(`Supprimer « ${block.title} » ?`)) return;
                applyChange((draft) => { draft.blocks = draft.blocks.filter((item) => item.id !== block.id); });
              }}
              onMove={(block, direction) => applyChange((draft) => {
                const index = draft.blocks.findIndex((item) => item.id === block.id);
                const sectionIndexes = draft.blocks.map((item, itemIndex) => item.sectionId === block.sectionId ? itemIndex : -1).filter((value) => value >= 0);
                const localIndex = sectionIndexes.indexOf(index);
                const targetLocal = localIndex + direction;
                if (targetLocal < 0 || targetLocal >= sectionIndexes.length) return;
                const targetIndex = sectionIndexes[targetLocal];
                [draft.blocks[index], draft.blocks[targetIndex]] = [draft.blocks[targetIndex], draft.blocks[index]];
              })}
              onDropBlock={(draggedId, beforeId) => applyChange((draft) => {
                if (section.kind === 'jingle') return;
                const fromIndex = draft.blocks.findIndex((item) => item.id === draggedId);
                if (fromIndex < 0) return;
                const [moved] = draft.blocks.splice(fromIndex, 1);
                moved.sectionId = section.id;
                if (beforeId) {
                  const beforeIndex = draft.blocks.findIndex((item) => item.id === beforeId);
                  draft.blocks.splice(beforeIndex >= 0 ? beforeIndex : draft.blocks.length, 0, moved);
                } else {
                  const indexes = draft.blocks.map((item, index) => item.sectionId === section.id ? index : -1).filter((value) => value >= 0);
                  draft.blocks.splice(indexes.length ? Math.max(...indexes) + 1 : draft.blocks.length, 0, moved);
                }
              })}
            />
          );
        })}

        <div className="section-add-actions">
          <button className="add-section-button" onClick={() => setAddSectionOpen(true)}>＋ Ajouter une section</button>
        </div>
      </main>

      <GlobalPlayer
        status={playbackStatus}
        elapsed={elapsed}
        duration={playbackStatus === 'stopped' ? projectDuration : playbackDisplayDuration}
        seekable={playbackKind === 'project'}
        activeTitle={timeline.find((entry) => entry.block.id === activeBlockId)?.block.title}
        onPlayPause={() => void togglePause()}
        onStop={() => { setElapsed(0); void stopPlayback(); }}
        onSeek={(value) => { if (playbackKind !== 'project') return; setElapsed(value); if (playbackStatus !== 'stopped') void beginPlayback(value); }}
      />

      {addSectionId && (
        <AddBlockModal
          onClose={() => setAddSectionId(null)}
          onChoose={(type) => {
            const block = makeBlock(type, addSectionId);
            setAddSectionId(null);
            setEditingBlock(block);
            setEditingIsNew(true);
          }}
        />
      )}

      {addSectionOpen && <AddSectionModal onClose={() => setAddSectionOpen(false)} onChoose={addGuidedSection} />}

      {editingBlock && (
        <BlockEditorModal
          key={`${editingBlock.id}-${editingIsNew ? 'new' : 'edit'}`}
          block={editingBlock}
          assets={project.assets}
          isNew={editingIsNew}
          onClose={closeBlockEditor}
          onSave={saveBlock}
          onRegisterAsset={registerAsset}
          onPreview={(block) => playProject({ ...project, blocks: [block] }, 0)}
        />
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {sectionHelp && <SectionHelpModal section={sectionHelp} onClose={() => setSectionHelp(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function HomeScreen({
  projects,
  onCreate,
  onOpen,
  onDelete,
  onDuplicate,
  onImport,
  onHelp,
}: {
  projects: PodcastProject[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (project: PodcastProject) => void;
  onImport: (file: File) => void;
  onHelp: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="home-screen">
      <header className="home-header">
        <div className="brand"><span className="brand-mark">PF</span><span>{APP_NAME}</span></div>
        <button className="ghost-button" onClick={onHelp}>? Aide</button>
      </header>
      <main className="home-content">
        <section className="home-hero">
          <div className="hero-symbol" aria-hidden="true"><span>🎙️</span><span>＋</span><span>🎵</span></div>
          <h1>Ton podcast, bloc après bloc.</h1>
          <p>{WELCOME_TEXT}</p>
          <div className="hero-actions">
            <button className="primary-button large" onClick={onCreate}>Créer un nouveau podcast</button>
            <button className="secondary-button large" onClick={() => document.getElementById('saved-projects')?.scrollIntoView({ behavior: 'smooth' })}>Reprendre un projet</button>
          </div>
          <p className="privacy-line">🔒 Tes fichiers restent sur cet appareil. Rien n’est envoyé sur internet.</p>
        </section>

        <section id="saved-projects" className="saved-projects">
          <div className="section-heading-row">
            <div><h2>Projets enregistrés</h2><p>Les projets restent dans ce navigateur tant que ses données ne sont pas effacées.</p></div>
            <button className="secondary-button" onClick={() => inputRef.current?.click()}>Ouvrir un fichier .podfacile</button>
            <input ref={inputRef} type="file" accept=".podfacile,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = ''; }} />
          </div>
          {projects.length === 0 ? (
            <div className="empty-projects"><div>📭</div><strong>Aucun projet sauvegardé</strong><p>Crée ton premier podcast ou ouvre une sauvegarde.</p></div>
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <article className="project-row" key={project.id}>
                  <div className="project-icon">🎧</div>
                  <div className="project-details"><h3>{project.title}</h3><p>{project.author || 'Auteur non indiqué'} · modifié le {new Date(project.updatedAt).toLocaleDateString('fr-CH')}</p></div>
                  <div className="project-actions">
                    <button className="primary-button compact" onClick={() => onOpen(project.id)}>Ouvrir</button>
                    <button className="icon-text-button" onClick={() => onDuplicate(project)}>⧉ Dupliquer</button>
                    <button className="icon-text-button danger" onClick={() => onDelete(project.id)}>🗑 Supprimer</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SetupScreen({ title, author, onTitle, onAuthor, onBack, onFinish }: {
  title: string;
  author: string;
  onTitle: (value: string) => void;
  onAuthor: (value: string) => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="setup-screen">
      <header className="simple-header"><button className="ghost-button" onClick={onBack}>← Retour</button><div className="brand"><span className="brand-mark">PF</span><span>{APP_NAME}</span></div><span /></header>
      <main className="setup-content setup-content-simple">
        <h1>Nouveau podcast</h1>
        <p className="lead">Donne simplement un titre à ton projet. Tu ajouteras ensuite les sections et les sons au fur et à mesure.</p>
        <div className="setup-form-grid setup-form-simple">
          <label className="field"><span>Titre du podcast <b>*</b></span><input autoFocus value={title} onChange={(event) => onTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && title.trim()) onFinish(); }} placeholder="Ex. Magellan : héros ou envahisseur ?" /></label>
          <label className="field"><span>Nom de l’élève ou du groupe <small>(facultatif)</small></span><input value={author} onChange={(event) => onAuthor(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && title.trim()) onFinish(); }} placeholder="Ex. Groupe 3" /></label>
        </div>
        <div className="setup-footer"><button className="secondary-button large" onClick={onBack}>Annuler</button><button className="primary-button large" disabled={!title.trim()} onClick={onFinish}>Créer le podcast →</button></div>
      </main>
    </div>
  );
}

function EditorTopbar({ project, duration, saveState, canUndo, canRedo, onHome, onSave, onUndo, onRedo, onHelp, onExport }: {
  project: PodcastProject; duration: number; saveState: 'saved' | 'dirty' | 'saving'; canUndo: boolean; canRedo: boolean;
  onHome: () => void; onSave: () => void; onUndo: () => void; onRedo: () => void; onHelp: () => void; onExport: () => void;
}) {
  return (
    <header className="editor-topbar">
      <button className="brand-button" onClick={onHome}><span className="brand-mark">PF</span><span className="brand-name">{APP_NAME}</span></button>
      <div className="topbar-project"><strong>{project.title}</strong><span className={`save-indicator ${saveState}`}>{saveState === 'saved' ? '✓ Sauvegardé' : saveState === 'saving' ? 'Sauvegarde…' : '● Modifications non sauvegardées'}</span></div>
      <div className="topbar-actions">
        <button className="toolbar-button" onClick={onSave}>💾 <span>Enregistrer</span></button>
        <button className="toolbar-button" disabled={!canUndo} onClick={onUndo} title="Annuler">↶</button>
        <button className="toolbar-button" disabled={!canRedo} onClick={onRedo} title="Rétablir">↷</button>
        <button className="toolbar-button" onClick={onHelp}>? <span>Aide</span></button>
        <span className="duration-chip">⏱ {formatTime(duration)}</span>
        <button className="primary-button compact" onClick={onExport}>Exporter →</button>
      </div>
    </header>
  );
}

function SectionPanel({
  section, sectionIndex, sectionCount, blocks, assets, duration, activeBlockId, playbackStatus,
  onRename, onToggle, onHelp, onAdd, onMoveSection, onDeleteSection, onPlay, onEdit, onDuplicate, onDelete, onMove, onDropBlock,
}: {
  section: PodcastSection; sectionIndex: number; sectionCount: number; blocks: PodcastBlock[]; assets: AudioAsset[]; duration: number; activeBlockId: string | null; playbackStatus: 'stopped' | 'loading' | 'playing' | 'paused';
  onRename: (title: string) => void; onToggle: () => void; onHelp: () => void; onAdd: () => void; onMoveSection: (direction: -1 | 1) => void; onDeleteSection: () => void;
  onPlay: (block: PodcastBlock) => void; onEdit: (block: PodcastBlock) => void; onDuplicate: (block: PodcastBlock) => void; onDelete: (block: PodcastBlock) => void;
  onMove: (block: PodcastBlock, direction: -1 | 1) => void; onDropBlock: (draggedId: string, beforeId?: string) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  return (
    <section className={`podcast-section ${section.kind === 'jingle' ? 'jingle-section' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (section.kind === 'jingle') return; const id = event.dataTransfer.getData('text/plain') || draggedId; if (id) onDropBlock(id); setDraggedId(null); }}>
      <div className="podcast-section-header">
        <button className="collapse-button" onClick={onToggle} aria-label={section.collapsed ? 'Déplier' : 'Replier'}>{section.collapsed ? '▸' : '▾'}</button>
        <input className="section-title-input" value={section.title} onChange={(event) => onRename(event.target.value)} aria-label="Nom de la section" />
        <button className="section-help-button" onClick={onHelp} title="Conseils et exemples pour cette section" aria-label={`Aide pour ${section.title}`}>?</button>
        {section.kind === 'jingle' && <span className="section-kind-badge">Jingle</span>}
        <span className="section-duration">{formatTime(duration)}</span>
        <button className="mini-button" disabled={sectionIndex === 0} onClick={() => onMoveSection(-1)} title="Monter la section">↑</button>
        <button className="mini-button" disabled={sectionIndex === sectionCount - 1} onClick={() => onMoveSection(1)} title="Descendre la section">↓</button>
        <button className="mini-button danger" onClick={onDeleteSection} title="Supprimer la section">×</button>
      </div>
      {!section.collapsed && (
        <div className="block-stack">
          {blocks.length === 0 && <div className="empty-section">{section.kind === 'jingle' ? 'Configure ce jingle pour l’utiliser dans ton podcast.' : 'Cette section est vide. Ajoute une voix, une musique ou un autre élément.'}</div>}
          {blocks.map((block, index) => (
            <BlockCard
              key={block.id}
              block={block}
              assets={assets}
              active={block.id === activeBlockId}
              playbackStatus={playbackStatus}
              canMoveUp={index > 0}
              canMoveDown={index < blocks.length - 1}
              onPlay={() => onPlay(block)}
              onEdit={() => onEdit(block)}
              onDuplicate={() => onDuplicate(block)}
              onDelete={() => onDelete(block)}
              onMoveUp={() => onMove(block, -1)}
              onMoveDown={() => onMove(block, 1)}
              onDragStart={(event) => { setDraggedId(block.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', block.id); }}
              onDropBefore={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('text/plain') || draggedId; if (id && id !== block.id) onDropBlock(id, block.id); setDraggedId(null); }}
            />
          ))}
          {section.kind !== 'jingle' && <button className="add-inside-button" onClick={onAdd}>＋ Ajouter un élément dans cette section</button>}
        </div>
      )}
    </section>
  );
}

function BlockCard({ block, assets, active, playbackStatus, canMoveUp, canMoveDown, onPlay, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown, onDragStart, onDropBefore }: {
  block: PodcastBlock; assets: AudioAsset[]; active: boolean; playbackStatus: 'stopped' | 'loading' | 'playing' | 'paused'; canMoveUp: boolean; canMoveDown: boolean;
  onPlay: () => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
  onDragStart: (event: React.DragEvent) => void; onDropBefore: (event: React.DragEvent) => void;
}) {
  return (
    <article className={`block-card block-${block.type} ${active ? 'active' : ''}`} draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDropBefore}>
      <div className="drag-handle" title="Glisser pour déplacer">⋮⋮</div>
      <div className="block-icon" aria-hidden="true">{blockIcons[block.type]}</div>
      <div className="block-info"><span className="block-type-label">{blockLabels[block.type]}</span><strong>{block.title}</strong><small>{formatTime(getBlockDuration(block, assets))}{block.background ? ' · musique de fond' : ''}{block.voiceCues?.length ? ` · ${block.voiceCues.length} bruitage${block.voiceCues.length > 1 ? 's' : ''} synchronisé${block.voiceCues.length > 1 ? 's' : ''}` : ''}{block.voiceEffect !== 'none' ? ` · ${voiceEffectLabels[block.voiceEffect]}` : ''}</small></div>
      <button className="round-play" onClick={onPlay} aria-label={`Lire ${block.title}`} aria-busy={active && playbackStatus === 'loading'}>{active && playbackStatus === 'loading' ? <i className="preview-spinner" /> : active && playbackStatus === 'playing' ? 'Ⅱ' : '▶'}</button>
      <div className="block-actions">
        <button onClick={onEdit}>✎ <span>Modifier</span></button>
        {block.type !== 'jingle' && <button onClick={onDuplicate}>⧉ <span>Dupliquer</span></button>}
        <button className="danger" onClick={onDelete}>🗑 <span>Supprimer</span></button>
      </div>
      <div className="move-buttons"><button disabled={!canMoveUp} onClick={onMoveUp} aria-label="Monter">↑</button><button disabled={!canMoveDown} onClick={onMoveDown} aria-label="Descendre">↓</button></div>
    </article>
  );
}

function AddSectionModal({ onClose, onChoose }: { onClose: () => void; onChoose: (type: SectionGuideType) => void }) {
  const choices: SectionGuideType[] = ['intro-jingle', 'intermediate-jingle', 'final-jingle', 'introduction', 'part', 'conclusion'];
  return (
    <Modal title="Ajouter une section" onClose={onClose} wide>
      <p className="modal-lead">Choisis le rôle de cette nouvelle section. Tu pourras ensuite la renommer, la déplacer ou la supprimer.</p>
      <div className="section-type-grid">
        {choices.map((type) => {
          const content = sectionGuideContent[type];
          return <button key={type} className={`section-type-choice ${type.includes('jingle') ? 'jingle-choice' : ''}`} onClick={() => onChoose(type)}><span>{content.icon}</span><strong>{content.title}</strong><small>{content.summary}</small></button>;
        })}
      </div>
    </Modal>
  );
}

function SectionHelpModal({ section, onClose }: { section: PodcastSection; onClose: () => void }) {
  const guideType = section.guideType ?? (section.kind === 'jingle' ? 'intermediate-jingle' : 'part');
  const content = sectionGuideContent[guideType];
  return (
    <Modal title={`Aide · ${section.title}`} onClose={onClose}>
      <div className="section-help-content">
        <div className="section-help-intro"><span>{content.icon}</span><p>{content.summary}</p></div>
        <h3>Que dire dans cette partie ?</h3>
        <ul>{content.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>
        <h3>Phrases pour démarrer</h3>
        <div className="example-phrases">{content.examples.map((example) => <p key={example}>{example}</p>)}</div>
        <p className="section-help-note">Ces formulations sont des points de départ : adapte-les librement à ton sujet et à ton ton.</p>
      </div>
    </Modal>
  );
}

function BackgroundTimingControl({ label, checked, seconds, onChecked, onSeconds }: {
  label: string;
  checked: boolean;
  seconds: 1 | 2 | 3;
  onChecked: (checked: boolean) => void;
  onSeconds: (seconds: 1 | 2 | 3) => void;
}) {
  return (
    <div className={`background-timing ${checked ? 'enabled' : ''}`}>
      <label className="check-row"><input type="checkbox" checked={checked} onChange={(event) => onChecked(event.target.checked)} /> {label}</label>
      {checked && <div className="timing-buttons" aria-label={`${label} : durée`}>{([1, 2, 3] as const).map((value) => <button key={value} className={seconds === value ? 'selected' : ''} onClick={() => onSeconds(value)}>{value} s</button>)}</div>}
    </div>
  );
}

function AddBlockModal({ onClose, onChoose }: { onClose: () => void; onChoose: (type: BlockType) => void }) {
  const choices: { type: BlockType; title: string; description: string }[] = [
    { type: 'voice', title: 'Enregistrer ma voix', description: 'Microphone ou fichier audio' },
    { type: 'music', title: 'Ajouter une musique', description: 'Introduction, fond ou conclusion' },
    { type: 'sfx', title: 'Ajouter un bruitage', description: 'Ambiance, objet ou effet sonore' },
    { type: 'transition', title: 'Ajouter une transition', description: 'Whoosh, radio, cloche…' },
    { type: 'silence', title: 'Ajouter une pause', description: 'De 0,5 à 10 secondes' },
  ];
  return (
    <Modal title="Ajouter un élément" onClose={onClose} wide>
      <p className="modal-lead">Choisis ce que tu veux entendre ensuite.</p>
      <div className="add-choice-grid">
        {choices.map((choice) => <button key={choice.type} className={`add-choice block-${choice.type}`} onClick={() => onChoose(choice.type)}><span>{blockIcons[choice.type]}</span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}
      </div>
      <p className="privacy-note">🔒 Les enregistrements et fichiers importés restent sur cet appareil.</p>
    </Modal>
  );
}

function BlockEditorModal({ block: initialBlock, assets, isNew, onClose, onSave, onRegisterAsset, onPreview }: {
  block: PodcastBlock; assets: AudioAsset[]; isNew: boolean; onClose: () => void; onSave: (block: PodcastBlock) => void;
  onRegisterAsset: (blob: Blob, name: string, mimeType?: string, knownDuration?: number, metadata?: Pick<AudioAsset, 'source' | 'libraryId'>) => Promise<AudioAsset>;
  onPreview: (block: PodcastBlock) => Promise<PreviewSession>;
}) {
  type LibraryTarget = 'block' | 'background' | 'voiceCue' | 'musicAssetId' | 'openingAssetId' | 'closingAssetId';
  const [block, setBlock] = useState<PodcastBlock>(() => cloneBlock(initialBlock));
  const [error, setError] = useState('');
  const [libraryTarget, setLibraryTarget] = useState<LibraryTarget | null>(null);
  const [cueInsertTime, setCueInsertTime] = useState(0);
  const [showSfxRecorder, setShowSfxRecorder] = useState(false);
  const [transitionLoadingId, setTransitionLoadingId] = useState<string | null>(null);
  const selectedAsset = assets.find((asset) => asset.id === block.assetId);
  const requiresAsset = block.type === 'voice' || block.type === 'music' || block.type === 'sfx';
  const canSave = block.type === 'transition' ? Boolean(block.assetId && block.transitionPreset) : !requiresAsset || Boolean(block.assetId);

  const update = <K extends keyof PodcastBlock>(key: K, value: PodcastBlock[K]) => setBlock((current) => ({ ...current, [key]: value }));

  const importForBlock = async (file: File) => {
    setError('');
    try {
      const asset = await onRegisterAsset(file, file.name, file.type, undefined, { source: 'import' });
      setBlock((current) => ({ ...current, assetId: asset.id, duration: asset.duration, trimStart: 0, trimEnd: asset.duration, title: current.title.startsWith('Nou') ? file.name.replace(/\.[^.]+$/, '') : current.title }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ce fichier audio ne peut pas être utilisé.');
    }
  };

  const attachAsset = async (field: 'background' | 'musicAssetId' | 'voiceAssetId' | 'openingAssetId' | 'closingAssetId', file: File) => {
    setError('');
    try {
      const asset = await onRegisterAsset(file, file.name, file.type, undefined, { source: 'import' });
      setBlock((current) => {
        if (field === 'background') return { ...current, background: { assetId: asset.id, level: 'low', startBefore: true, startBeforeSeconds: 2, continueAfter: true, continueAfterSeconds: 2 } };
        return { ...current, jingle: { ...(current.jingle ?? { style: 'modern-radio', musicLevel: 'low' }), [field]: asset.id } };
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ce fichier audio ne peut pas être utilisé.');
    }
  };

  const addVoiceCueAsset = (asset: AudioAsset, at: number) => {
    setBlock((current) => {
      const voiceDuration = Math.max(0.2, (current.trimEnd - current.trimStart) || current.duration);
      const safeAt = Math.min(Math.max(0, at), Math.max(0, voiceDuration - 0.2));
      const remaining = Math.max(0.2, voiceDuration - safeAt);
      const duration = Math.max(0.2, Math.min(2, asset.duration || 2, remaining));
      const cue: VoiceSoundCue = { id: crypto.randomUUID(), assetId: asset.id, at: safeAt, duration, sourceStart: 0, sourceEnd: duration, level: 'low' };
      return { ...current, voiceCues: [...(current.voiceCues ?? []), cue].sort((left, right) => left.at - right.at) };
    });
  };

  const importVoiceCue = async (file: File, at: number) => {
    setError('');
    try {
      const asset = await onRegisterAsset(file, file.name, file.type, undefined, { source: 'import' });
      addVoiceCueAsset(asset, at);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Ce bruitage ne peut pas être utilisé.');
    }
  };

  const chooseLibraryPreset = async (preset: LibraryPreset) => {
    setError('');
    try {
      const existing = assets.find((asset) => asset.libraryId === preset.id);
      const asset = existing ?? await onRegisterAsset(
        await loadLibraryAudio(preset),
        preset.title,
        undefined,
        undefined,
        { source: 'library', libraryId: preset.id },
      );
      if (libraryTarget === 'voiceCue') {
        addVoiceCueAsset(asset, cueInsertTime);
        setLibraryTarget(null);
        return;
      }
      setBlock((current) => {
        if (libraryTarget === 'block') {
          const trimStart = Math.min(asset.duration, Math.max(0, preset.clipStart ?? 0));
          const suggestedDuration = preset.clipDuration ?? Math.max(0.05, asset.duration - trimStart);
          const trimEnd = Math.min(asset.duration, Math.max(trimStart + 0.05, trimStart + suggestedDuration));
          return {
            ...current,
            assetId: asset.id,
            duration: trimEnd - trimStart,
            trimStart,
            trimEnd,
            title: current.title.startsWith('Nou') ? preset.title : current.title,
          };
        }
        if (libraryTarget === 'background') {
          return { ...current, background: { assetId: asset.id, level: 'low', startBefore: true, startBeforeSeconds: 2, continueAfter: true, continueAfterSeconds: 2 } };
        }
        if (libraryTarget) {
          return { ...current, jingle: { ...(current.jingle ?? { style: 'modern-radio', musicLevel: 'low' }), [libraryTarget]: asset.id } };
        }
        return current;
      });
      setLibraryTarget(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de télécharger ce son.');
      throw reason;
    }
  };


  const chooseTransitionRecording = async (recording: TransitionRecording) => {
    requestExclusivePreview('transition-selection');
    setError('');
    setTransitionLoadingId(recording.libraryId);
    try {
      const preset = AUDIO_LIBRARY.find((candidate) => candidate.id === recording.libraryId && candidate.kind === 'sfx');
      if (!preset) throw new Error('Cet enregistrement de transition est introuvable.');
      const existing = assets.find((asset) => asset.libraryId === preset.id);
      const asset = existing ?? await onRegisterAsset(
        await loadLibraryAudio(preset),
        preset.title,
        undefined,
        undefined,
        { source: 'library', libraryId: preset.id },
      );
      const trimStart = Math.min(asset.duration, Math.max(0, preset.clipStart ?? 0));
      const clipDuration = Math.min(4, preset.clipDuration ?? preset.duration, Math.max(0.05, asset.duration - trimStart));
      setBlock((current) => ({
        ...current,
        transitionPreset: recording.preset,
        assetId: asset.id,
        title: current.title === 'Transition' || current.title.startsWith('Nouvelle') ? recording.label : current.title,
        duration: clipDuration,
        trimStart,
        trimEnd: trimStart + clipDuration,
        fadeIn: 'none',
        fadeOut: 'short',
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger cette transition.');
    } finally {
      setTransitionLoadingId(null);
    }
  };

  const libraryKind: LibraryKind = libraryTarget === 'voiceCue'
    ? 'sfx'
    : libraryTarget === 'block'
      ? (block.type === 'sfx' ? 'sfx' : 'music')
    : libraryTarget === 'openingAssetId' || libraryTarget === 'closingAssetId'
      ? 'sfx'
      : 'music';

  return (
    <>
      <Modal title={`${isNew ? 'Ajouter' : 'Modifier'} : ${blockLabels[block.type]}`} onClose={onClose} wide>
        <div className="editor-modal-body">
          <label className="field"><span>Nom de l’élément</span><input value={block.title} onChange={(event) => update('title', event.target.value)} /></label>

          {requiresAsset && (
            <div className="audio-source-panel">
              <h3>{block.type === 'voice' ? 'Ta voix' : block.type === 'music' ? 'Choisir une musique' : 'Choisir un bruitage'}</h3>
              {block.type === 'voice' && <Recorder onReady={async (blob, duration) => { const asset = await onRegisterAsset(blob, `Enregistrement ${new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`, blob.type, duration, { source: 'recording' }); setBlock((current) => ({ ...current, assetId: asset.id, duration: asset.duration, trimStart: 0, trimEnd: asset.duration })); }} />}
              <div className="source-actions">
                {block.type !== 'voice' && <button className="primary-button file-button" onClick={() => { requestExclusivePreview('window-change'); setLibraryTarget('block'); }}>{block.type === 'music' ? '🎼 Ouvrir la bibliothèque musicale' : '🔊 Ouvrir la bibliothèque de bruitages'}</button>}
                <FilePicker label={block.type === 'voice' ? 'Importer un enregistrement' : block.type === 'music' ? 'Importer ma propre musique' : 'Importer mon propre bruitage'} onFile={importForBlock} />
                {block.type === 'sfx' && <button className="record-sfx-button" onClick={() => setShowSfxRecorder((visible) => !visible)}>● Enregistrer mon propre bruitage</button>}
              </div>
              {block.type === 'sfx' && showSfxRecorder && <div className="inline-sfx-recorder"><Recorder onReady={async (blob, duration) => { const asset = await onRegisterAsset(blob, `Bruitage enregistré ${new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`, blob.type, duration, { source: 'recording' }); setBlock((current) => ({ ...current, assetId: asset.id, duration: asset.duration, trimStart: 0, trimEnd: asset.duration, title: current.title.startsWith('Nouveau') ? 'Mon bruitage enregistré' : current.title })); setShowSfxRecorder(false); }} /></div>}
              {selectedAsset ? <div className="selected-audio">✓ {selectedAsset.name} · {formatTime(selectedAsset.duration)}{selectedAsset.source === 'library' ? ' · bibliothèque intégrée' : ''}</div> : <div className="missing-audio">Aucun fichier sélectionné</div>}
              {block.type !== 'voice' && <p className="library-note">Les sons de la bibliothèque proviennent de sources libres ou sous licence. Ils sont téléchargés lors de leur premier ajout. Les sources et crédits sont indiqués pour chaque son.</p>}
            </div>
          )}

          {selectedAsset && block.type !== 'transition' && (
            <TrimControl asset={selectedAsset} start={block.trimStart} end={block.trimEnd || selectedAsset.duration} onChange={(start, end) => setBlock((current) => ({ ...current, trimStart: start, trimEnd: end, duration: end - start, voiceCues: current.voiceCues?.filter((cue) => cue.at < end - start) }))} />
          )}

          {block.type === 'voice' && selectedAsset && (
            <VoiceCueEditor
              asset={selectedAsset}
              trimStart={block.trimStart}
              trimEnd={block.trimEnd || selectedAsset.duration}
              cues={block.voiceCues ?? []}
              assets={assets}
              onCues={(voiceCues) => update('voiceCues', voiceCues)}
              onAddLibrary={(at) => { setCueInsertTime(at); setLibraryTarget('voiceCue'); }}
              onImport={(file, at) => importVoiceCue(file, at)}
            />
          )}

          {block.type === 'silence' && (
            <div className="setting-group"><h3>Durée de la pause</h3><div className="segmented-wrap">{[0.5, 1, 2, 3].map((value) => <button key={value} className={block.duration === value ? 'selected' : ''} onClick={() => update('duration', value)}>{value} s</button>)}</div><label className="field compact-field"><span>Durée personnalisée</span><input type="number" min="0.5" max="10" step="0.5" value={block.duration} onChange={(event) => update('duration', Math.min(10, Math.max(0.5, Number(event.target.value))))} /></label></div>
          )}

          {block.type === 'transition' && (
            <div className="setting-group transition-recordings-panel">
              <div className="setting-title-row"><div><h3>Enregistrement de transition</h3><p>Choisis un son réel, libre et reconnaissable. Chaque extrait dure au maximum 4 secondes.</p></div><span className="recording-badge">Enregistrements réels</span></div>
              <div className="transition-recording-grid">
                {TRANSITION_RECORDINGS.map((recording) => {
                  const preset = AUDIO_LIBRARY.find((candidate) => candidate.id === recording.libraryId);
                  const selected = block.transitionPreset === recording.preset && selectedAsset?.libraryId === recording.libraryId;
                  return (
                    <article key={recording.libraryId} className={`transition-recording-card ${selected ? 'selected' : ''}`}>
                      <button disabled={Boolean(transitionLoadingId)} onClick={() => void chooseTransitionRecording(recording)}>
                        <span>{recording.icon}</span><span><strong>{recording.label}</strong><small>{recording.description}</small></span>
                        <em>{transitionLoadingId === recording.libraryId ? <i className="preview-spinner" /> : selected ? '✓' : formatTime(Math.min(4, preset?.clipDuration ?? preset?.duration ?? 0))}</em>
                      </button>
                      {preset && <a href={preset.sourcePage} target="_blank" rel="noreferrer" title={`${preset.author} · ${preset.license}`}>ⓘ Source · {preset.license}</a>}
                    </article>
                  );
                })}
              </div>
              {selectedAsset ? <div className="selected-audio">✓ {selectedAsset.name} · extrait de {formatTime(block.duration)}</div> : <div className="missing-audio">Choisis un enregistrement pour activer l’aperçu et l’ajout.</div>}
              <ChoiceSetting title="Volume de la transition" value={block.transitionVolume ?? 'normal'} options={[["low", "Discret"], ["normal", "Normal"], ["high", "Fort"]]} onChange={(value) => update('transitionVolume', value as VolumeLevel)} />
            </div>
          )}

          {block.type === 'jingle' && (
            <JingleSettings block={block} assets={assets} onBlock={setBlock} onAttach={attachAsset} onOpenLibrary={setLibraryTarget} />
          )}

          {(block.type === 'voice' || block.type === 'music' || block.type === 'sfx') && (
            <div className="settings-columns">
              <ChoiceSetting title="Volume" value={block.volume} options={block.type === 'voice' ? [['low', 'Plus faible'], ['normal', 'Normal'], ['high', 'Plus fort']] : [['low', 'Discret'], ['normal', 'Normal'], ['high', 'Fort']]} onChange={(value) => update('volume', value as VolumeLevel)} />
              <ChoiceSetting title="Début" value={block.fadeIn} options={[["none", "Direct"], ["short", "Fondu court"], ["normal", "Fondu normal"]]} onChange={(value) => update('fadeIn', value as FadeLevel)} />
              <ChoiceSetting title="Fin" value={block.fadeOut} options={[["none", "Directe"], ["short", "Fondu court"], ["normal", "Fondu normal"]]} onChange={(value) => update('fadeOut', value as FadeLevel)} />
            </div>
          )}

          {block.type === 'voice' && (
            <>
              <div className="setting-group"><h3>Effet sur la voix</h3><div className="option-grid compact-options">{(Object.keys(voiceEffectLabels) as VoiceEffect[]).map((effect) => <button key={effect} className={block.voiceEffect === effect ? 'selected' : ''} onClick={() => update('voiceEffect', effect)}>{voiceEffectLabels[effect]}</button>)}</div></div>
              <div className="setting-group background-setting">
                <div className="setting-title-row"><div><h3>Musique de fond</h3><p>L’application baisse automatiquement la musique pendant la voix.</p></div>{block.background && <button className="danger-text" onClick={() => update('background', undefined)}>Retirer</button>}</div>
                {!block.background ? (
                  <div className="source-actions">
                    <button className="primary-button file-button" onClick={() => { requestExclusivePreview('window-change'); setLibraryTarget('background'); }}>🎼 Choisir dans la bibliothèque</button>
                    <FilePicker label="Importer une musique de fond" onFile={(file) => attachAsset('background', file)} />
                  </div>
                ) : (
                  <div className="background-controls">
                    <div className="selected-audio">✓ {assets.find((asset) => asset.id === block.background?.assetId)?.name ?? 'Musique choisie'}</div>
                    <ChoiceSetting title="Présence" value={block.background.level} options={[["very-low", "Très discrète"], ["low", "Discrète"], ["present", "Présente"]]} onChange={(value) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, level: value as 'very-low' | 'low' | 'present' } : undefined }))} />
                    <BackgroundTimingControl label="Commencer avant la voix" checked={block.background.startBefore} seconds={block.background.startBeforeSeconds ?? 2} onChecked={(checked) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, startBefore: checked, startBeforeSeconds: current.background.startBeforeSeconds ?? 2 } : undefined }))} onSeconds={(seconds) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, startBeforeSeconds: seconds } : undefined }))} />
                    <BackgroundTimingControl label="Continuer après la voix" checked={block.background.continueAfter} seconds={block.background.continueAfterSeconds ?? 2} onChecked={(checked) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, continueAfter: checked, continueAfterSeconds: current.background.continueAfterSeconds ?? 2 } : undefined }))} onSeconds={(seconds) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, continueAfterSeconds: seconds } : undefined }))} />
                    <button className="secondary-button compact" onClick={() => { requestExclusivePreview('window-change'); setLibraryTarget('background'); }}>Changer de musique</button>
                  </div>
                )}
              </div>
            </>
          )}

          {error && <div className="error-box">{error}</div>}
        </div>
        <div className="modal-footer">
          <TimedPreviewButton previewId={`block-editor-${block.id}`} onStart={() => onPreview(block)} disabled={!canSave} />
          <span className="footer-spacer" />
          <button className="ghost-button" onClick={onClose}>Annuler</button>
          <button className="primary-button" disabled={!canSave || !block.title.trim()} onClick={() => onSave(block)}>✓ {isNew ? 'Ajouter' : 'Enregistrer'}</button>
        </div>
      </Modal>
      {libraryTarget && <AudioLibraryModal kind={libraryKind} onClose={() => setLibraryTarget(null)} onChoose={chooseLibraryPreset} />}
    </>
  );
}

type BrowserAudioSessionType = 'auto' | 'playback' | 'play-and-record';

function setBrowserAudioSession(type: BrowserAudioSessionType): void {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: BrowserAudioSessionType } }).audioSession;
    if (session) session.type = type;
  } catch {
    // API expérimentale : ignorer sur les navigateurs qui ne la prennent pas en charge.
  }
}

function restoreBrowserAudioSession(): void {
  // WebKit recommande de quitter explicitement le mode capture après l’arrêt du micro.
  setBrowserAudioSession('playback');
  window.setTimeout(() => setBrowserAudioSession('auto'), 0);
}

function VoiceCueEditor({ asset, trimStart, trimEnd, cues, assets, onCues, onAddLibrary, onImport }: {
  asset: AudioAsset;
  trimStart: number;
  trimEnd: number;
  cues: VoiceSoundCue[];
  assets: AudioAsset[];
  onCues: (cues: VoiceSoundCue[]) => void;
  onAddLibrary: (at: number) => void;
  onImport: (file: File, at: number) => Promise<void> | void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const previewIdRef = useRef(`voice-cue-${crypto.randomUUID()}`);
  const duration = Math.max(0.2, trimEnd - trimStart || asset.duration);

  useEffect(() => {
    const url = URL.createObjectURL(asset.blob);
    setAudioUrl(url);
    setPosition(0);
    setPlaying(false);
    return () => URL.revokeObjectURL(url);
  }, [asset.blob]);

  const stopVoicePreview = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== previewIdRef.current) stopVoicePreview();
    };
    window.addEventListener(PREVIEW_STOP_EVENT, listener);
    return () => window.removeEventListener(PREVIEW_STOP_EVENT, listener);
  }, [stopVoicePreview]);

  const seek = (value: number) => {
    const safe = Math.min(duration, Math.max(0, value));
    setPosition(safe);
    const audio = audioRef.current;
    if (audio) audio.currentTime = trimStart + safe;
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused || loading) {
      stopVoicePreview();
      return;
    }
    requestExclusivePreview(previewIdRef.current);
    setBrowserAudioSession('playback');
    setLoading(audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
    if (audio.currentTime < trimStart || audio.currentTime >= trimEnd) audio.currentTime = trimStart + position;
    try { await audio.play(); setLoading(false); setPlaying(true); }
    catch { setLoading(false); setPlaying(false); }
  };

  const updateCue = (id: string, values: Partial<VoiceSoundCue>) => {
    onCues(cues.map((cue) => cue.id === id ? { ...cue, ...values } : cue).sort((left, right) => left.at - right.at));
  };

  return (
    <div className="voice-cue-editor">
      <div className="setting-title-row">
        <div><h3>Bruitages derrière la voix</h3><p>Écoute ta voix, mets en pause à l’endroit voulu, puis ajoute un bruitage exactement ici.</p></div>
        <span className="cue-count">{cues.length || 'Aucun'} repère{cues.length > 1 ? 's' : ''}</span>
      </div>
      <audio ref={audioRef} src={audioUrl} preload="auto" playsInline
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          const relative = Math.max(0, audio.currentTime - trimStart);
          if (relative >= duration) { audio.pause(); audio.currentTime = trimStart; setPosition(0); setPlaying(false); }
          else setPosition(relative);
        }}
        onWaiting={() => setLoading(true)} onCanPlay={() => setLoading(false)} onPause={() => setPlaying(false)} onPlay={() => { setLoading(false); setPlaying(true); }} />
      <div className="cue-player">
        <button className="cue-play-button" onClick={() => void toggle()} aria-busy={loading}>{loading ? <i className="preview-spinner" /> : playing ? 'Ⅱ' : '▶'}</button>
        <span className="cue-time">{position.toFixed(1)} s</span>
        <div className="cue-range-shell">
          <input type="range" min="0" max={duration} step="0.05" value={Math.min(position, duration)} onChange={(event) => { audioRef.current?.pause(); seek(Number(event.target.value)); }} />
          {cues.map((cue) => <button key={cue.id} className="cue-marker" style={{ left: `${Math.min(100, Math.max(0, cue.at / duration * 100))}%` }} onClick={() => seek(cue.at)} title={`Bruitage à ${cue.at.toFixed(1)} s`} />)}
        </div>
        <span className="cue-time">{duration.toFixed(1)} s</span>
      </div>
      <div className="cue-add-actions">
        <button className="primary-button compact" onClick={() => { audioRef.current?.pause(); onAddLibrary(position); }}>🔊 Ajouter un bruitage ici</button>
        <FilePicker label="Importer un bruitage ici" onFile={(file) => { audioRef.current?.pause(); void onImport(file, position); }} />
      </div>
      {cues.length > 0 && (
        <div className="cue-list">
          {cues.map((cue, index) => {
            const cueAsset = assets.find((candidate) => candidate.id === cue.assetId);
            const assetDuration = Math.max(0.05, cueAsset?.duration ?? cue.duration);
            const sourceStart = Math.min(Math.max(0, cue.sourceStart ?? 0), Math.max(0, assetDuration - 0.05));
            const legacyEnd = sourceStart + Math.max(0.05, cue.duration);
            const sourceEnd = Math.min(assetDuration, Math.max(sourceStart + 0.05, cue.sourceEnd ?? legacyEnd));
            const maxTimelineDuration = Math.max(0.05, duration - cue.at);
            const usedDuration = Math.min(sourceEnd - sourceStart, maxTimelineDuration);
            return (
              <div className="cue-row" key={cue.id}>
                <button className="cue-position" onClick={() => seek(cue.at)}>{cue.at.toFixed(1)} s</button>
                <div className="cue-name"><strong>{cueAsset?.name ?? `Bruitage ${index + 1}`}</strong><small>Extrait {sourceStart.toFixed(1)}–{sourceEnd.toFixed(1)} s · {usedDuration.toFixed(1)} s utilisé</small></div>
                <label><span>Niveau</span><select value={cue.level} onChange={(event) => updateCue(cue.id, { level: event.target.value as VoiceSoundCue['level'] })}><option value="low">Discret</option><option value="normal">Normal</option><option value="high">Fort</option></select></label>
                <div className="cue-source-range">
                  <strong>Plage du fichier</strong>
                  <label><span>Début · {sourceStart.toFixed(1)} s</span><input type="range" min="0" max={Math.max(0, sourceEnd - 0.05)} step="0.05" value={sourceStart} onChange={(event) => { const nextStart = Number(event.target.value); updateCue(cue.id, { sourceStart: nextStart, sourceEnd, duration: Math.min(sourceEnd - nextStart, maxTimelineDuration) }); }} /></label>
                  <label><span>Fin · {sourceEnd.toFixed(1)} s</span><input type="range" min={Math.min(assetDuration, sourceStart + 0.05)} max={assetDuration} step="0.05" value={sourceEnd} onChange={(event) => { const nextEnd = Number(event.target.value); updateCue(cue.id, { sourceStart, sourceEnd: nextEnd, duration: Math.min(nextEnd - sourceStart, maxTimelineDuration) }); }} /></label>
                </div>
                <button className="secondary-button compact" onClick={() => updateCue(cue.id, { at: Math.min(position, Math.max(0, duration - 0.2)) })}>Placer ici</button>
                <button className="mini-button danger" onClick={() => onCues(cues.filter((candidate) => candidate.id !== cue.id))} title="Supprimer ce bruitage">×</button>
              </div>
            );
          })}
        </div>
      )}
      <p className="cue-help">Choisis le début et la fin dans le fichier du bruitage. L’aperçu puis l’export utilisent exactement cette plage.</p>
    </div>
  );
}

function Recorder({ onReady }: { onReady: (blob: Blob, duration: number) => Promise<void> | void }) {
  const [state, setState] = useState<'idle' | 'countdown' | 'recording' | 'paused' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [countdown, setCountdown] = useState(true);
  const [count, setCount] = useState(3);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  const cleanup = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    restoreBrowserAudioSession();
  };
  useEffect(() => cleanup, []);

  const beginActualRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('L’enregistrement micro n’est pas pris en charge par ce navigateur.');
      // La catégorie playback est incompatible avec la capture sur iOS.
      setBrowserAudioSession('play-and-record');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        setState('processing');
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const duration = Math.max(0.2, elapsedRef.current);
        cleanup();
        try { await onReady(blob, duration); setState('idle'); setSeconds(0); elapsedRef.current = 0; } catch (reason) { setError(reason instanceof Error ? reason.message : 'Impossible de conserver l’enregistrement.'); setState('idle'); }
      };
      recorder.start(250);
      setSeconds(0);
      setState('recording');
      const started = performance.now();
      timerRef.current = window.setInterval(() => {
        const value = (performance.now() - started) / 1000;
        elapsedRef.current = value;
        setSeconds(value);
      }, 100);
    } catch (reason) {
      cleanup();
      setState('idle');
      setError(reason instanceof Error ? reason.message : 'Le microphone est inaccessible.');
    }
  };

  const start = async () => {
    setError('');
    if (countdown) {
      setState('countdown');
      for (let value = 3; value >= 1; value -= 1) {
        setCount(value);
        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
    }
    await beginActualRecording();
  };

  const pause = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (state === 'recording') { recorder.pause(); setState('paused'); if (timerRef.current !== null) window.clearInterval(timerRef.current); }
    else if (state === 'paused') {
      recorder.resume();
      setState('recording');
      const base = performance.now() - elapsedRef.current * 1000;
      timerRef.current = window.setInterval(() => {
        const value = (performance.now() - base) / 1000;
        elapsedRef.current = value;
        setSeconds(value);
      }, 100);
    }
  };

  return (
    <div className={`recorder recorder-${state}`}>
      <div className="recorder-display">
        <div className="mic-animation"><i /><i /><i /><i /><i /></div>
        <div><strong>{state === 'idle' ? 'Prêt à enregistrer' : state === 'countdown' ? `Départ dans ${count}` : state === 'processing' ? 'Traitement…' : state === 'paused' ? 'En pause' : 'Enregistrement en cours'}</strong><span>{formatTime(seconds)}</span></div>
      </div>
      <div className="recorder-actions">
        {state === 'idle' && <button className="record-button" onClick={() => void start()}>● Enregistrer</button>}
        {(state === 'recording' || state === 'paused') && <button className="secondary-button compact" onClick={pause}>{state === 'recording' ? 'Ⅱ Pause' : '▶ Reprendre'}</button>}
        {(state === 'recording' || state === 'paused') && <button className="primary-button compact" onClick={() => recorderRef.current?.stop()}>■ Terminer</button>}
        {state === 'idle' && <label className="check-row"><input type="checkbox" checked={countdown} onChange={(event) => setCountdown(event.target.checked)} /> Compte à rebours de 3 secondes</label>}
      </div>
      {error && <div className="error-box small">{error}</div>}
    </div>
  );
}

function FilePicker({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <><button className="secondary-button file-button" onClick={() => inputRef.current?.click()}>↑ {label}</button><input ref={inputRef} hidden type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ''; }} /></>;
}

function TrimControl({ asset, start, end, onChange }: { asset: AudioAsset; start: number; end: number; onChange: (start: number, end: number) => void }) {
  const safeEnd = Math.min(asset.duration, Math.max(start + 0.05, end));
  const left = asset.duration ? (start / asset.duration) * 100 : 0;
  const right = asset.duration ? (safeEnd / asset.duration) * 100 : 100;
  return (
    <div className="trim-panel">
      <div className="setting-title-row"><div><h3>Couper le début ou la fin</h3><p>Garde seulement la partie utile.</p></div><button className="ghost-button compact" onClick={() => onChange(0, asset.duration)}>Réinitialiser</button></div>
      <div className="trim-visual" style={{ '--trim-left': `${left}%`, '--trim-right': `${100 - right}%` } as React.CSSProperties}><span>début</span><span>partie conservée</span><span>fin</span></div>
      <div className="trim-sliders">
        <label><span>Début : {start.toFixed(1)} s</span><input type="range" min="0" max={Math.max(0, safeEnd - 0.05)} step="0.05" value={start} onChange={(event) => onChange(Number(event.target.value), safeEnd)} /></label>
        <label><span>Fin : {safeEnd.toFixed(1)} s</span><input type="range" min={Math.min(asset.duration, start + 0.05)} max={asset.duration} step="0.05" value={safeEnd} onChange={(event) => onChange(start, Number(event.target.value))} /></label>
      </div>
      <strong className="kept-duration">Durée conservée : {formatTime(safeEnd - start)}</strong>
    </div>
  );
}

function JingleSettings({ block, assets, onBlock, onAttach, onOpenLibrary }: {
  block: PodcastBlock; assets: AudioAsset[]; onBlock: React.Dispatch<React.SetStateAction<PodcastBlock>>;
  onAttach: (field: 'background' | 'musicAssetId' | 'voiceAssetId' | 'openingAssetId' | 'closingAssetId', file: File) => void;
  onOpenLibrary: (target: 'musicAssetId' | 'openingAssetId' | 'closingAssetId') => void;
}) {
  const jingle = block.jingle ?? { style: 'modern-radio' as const, musicLevel: 'low' as const };
  const updateJingle = (values: Partial<NonNullable<PodcastBlock['jingle']>>) => onBlock((current) => ({ ...current, jingle: { ...(current.jingle ?? jingle), ...values } }));
  const removeJingleAsset = (field: 'musicAssetId' | 'voiceAssetId' | 'openingAssetId' | 'closingAssetId') => onBlock((current) => {
    const nextJingle = { ...(current.jingle ?? jingle) };
    delete nextJingle[field];
    return { ...current, jingle: nextJingle };
  });
  const assetName = (id?: string) => assets.find((asset) => asset.id === id)?.name;
  const styleNames: Record<NonNullable<PodcastBlock['jingle']>['style'], string> = {
    dynamic: 'Dynamique', adventure: 'Aventure', mysterious: 'Mystérieux', serious: 'Sérieux', historical: 'Historique', 'modern-radio': 'Radio moderne',
  };
  const styleDescriptions: Record<NonNullable<PodcastBlock['jingle']>['style'], string> = {
    dynamic: 'Départ très rapide, musique énergique, voix en avant et impact grave.',
    adventure: 'Intro plus ample, montée héroïque et finale cinématographique.',
    mysterious: 'Entrée lente, musique plus feutrée et voix légèrement onirique.',
    serious: 'Niveaux retenus, voix claire et ponctuation sobre.',
    historical: 'Entrée solennelle, cloche et légère réverbération de la voix.',
    'modern-radio': 'Rythme court, voix filtrée façon studio radio et signature radio.',
  };
  const selected = (field: 'musicAssetId' | 'voiceAssetId' | 'openingAssetId' | 'closingAssetId', id?: string) => id ? <div className="jingle-selected"><small>✓ {assetName(id)}</small><button className="danger-text" onClick={() => removeJingleAsset(field)}>Retirer</button></div> : null;
  return (
    <div className="jingle-builder">
      <div className="jingle-step"><span>1</span><div><h3>Musique</h3><div className="source-actions"><button className="primary-button compact" onClick={() => { requestExclusivePreview('window-change'); onOpenLibrary('musicAssetId'); }}>🎼 Bibliothèque musicale</button><FilePicker label="Importer une musique" onFile={(file) => onAttach('musicAssetId', file)} /></div>{selected('musicAssetId', jingle.musicAssetId)}</div></div>
      <div className="jingle-step"><span>2</span><div><h3>Texte avec ta voix</h3><Recorder onReady={async (blob, duration) => { const file = new File([blob], 'voix-jingle.webm', { type: blob.type }); onAttach('voiceAssetId', file); void duration; }} /><FilePicker label="Ou importer une voix" onFile={(file) => onAttach('voiceAssetId', file)} />{selected('voiceAssetId', jingle.voiceAssetId)}</div></div>
      <div className="jingle-step"><span>3</span><div><h3>Bruits facultatifs</h3><div className="jingle-sound-grid"><div><strong>Ouverture</strong><div className="source-actions"><button className="secondary-button compact" onClick={() => { requestExclusivePreview('window-change'); onOpenLibrary('openingAssetId'); }}>🔊 Bibliothèque</button><FilePicker label="Importer" onFile={(file) => onAttach('openingAssetId', file)} /></div>{selected('openingAssetId', jingle.openingAssetId)}</div><div><strong>Fermeture</strong><div className="source-actions"><button className="secondary-button compact" onClick={() => { requestExclusivePreview('window-change'); onOpenLibrary('closingAssetId'); }}>🔊 Bibliothèque</button><FilePicker label="Importer" onFile={(file) => onAttach('closingAssetId', file)} /></div>{selected('closingAssetId', jingle.closingAssetId)}</div></div></div></div>
      <div className="settings-columns jingle-settings">
        <ChoiceSetting title="Style" value={jingle.style} options={[["dynamic", "Dynamique"], ["adventure", "Aventure"], ["mysterious", "Mystérieux"], ["serious", "Sérieux"], ["historical", "Historique"], ["modern-radio", "Radio moderne"]]} onChange={(value) => updateJingle({ style: value as NonNullable<PodcastBlock['jingle']>['style'] })} />
        <ChoiceSetting title="Musique sous la voix" value={jingle.musicLevel} options={[["very-low", "Très discrète"], ["low", "Discrète"], ["present", "Présente"]]} onChange={(value) => updateJingle({ musicLevel: value as 'very-low' | 'low' | 'present' })} />
      </div>
      <p className="jingle-style-description"><strong>{styleNames[jingle.style]} :</strong> {styleDescriptions[jingle.style]}</p>
    </div>
  );
}

function AudioLibraryModal({ kind, onClose, onChoose }: { kind: LibraryKind; onClose: () => void; onChoose: (preset: LibraryPreset) => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Toutes');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { requestExclusivePreview('audio-library-window'); }, []);

  const normalizedSearch = search.trim().toLocaleLowerCase('fr');
  const results = AUDIO_LIBRARY.filter((preset) => {
    if (preset.kind !== kind) return false;
    if (category !== 'Toutes' && preset.category !== category && !preset.secondaryCategories?.includes(category)) return false;
    if (!normalizedSearch) return true;
    return [preset.title, preset.description, preset.category, ...(preset.secondaryCategories ?? []), ...preset.tags].join(' ').toLocaleLowerCase('fr').includes(normalizedSearch);
  });

  const add = async (preset: LibraryPreset) => {
    requestExclusivePreview('library-add');
    setAddingId(preset.id);
    setError('');
    try {
      await onChoose(preset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’ajouter ce son.');
      setAddingId(null);
    }
  };

  return (
    <div className="modal-backdrop library-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal audio-library-modal" role="dialog" aria-modal="true" aria-label={kind === 'music' ? 'Bibliothèque musicale' : 'Bibliothèque de bruitages'}>
        <div className="modal-header"><div><h2>{kind === 'music' ? 'Bibliothèque musicale' : 'Bibliothèque de bruitages'}</h2><small>{AUDIO_LIBRARY.filter((item) => item.kind === kind).length} sons disponibles</small></div><button onClick={onClose} aria-label="Fermer">×</button></div>
        <div className="library-toolbar">
          <label className="library-search"><span>⌕</span><input autoFocus placeholder={kind === 'music' ? 'Rechercher : médiéval, épique, calme, forêt…' : 'Rechercher : cheval, bataille, pluie, gare…'} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="library-categories"><button className={category === 'Toutes' ? 'selected' : ''} onClick={() => setCategory('Toutes')}>Toutes</button>{LIBRARY_CATEGORIES[kind].map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        </div>
        <div className="library-results-heading"><strong>{results.length} résultat{results.length > 1 ? 's' : ''}</strong>{category !== 'Toutes' && <button onClick={() => setCategory('Toutes')}>Effacer le filtre</button>}</div>
        <div className="library-grid">
          {results.map((preset) => (
            <article className="library-card" key={preset.id}>
              <div className="library-card-icon">{preset.icon}</div>
              <div className="library-card-copy"><span>{preset.category}</span><h3>{preset.title}</h3><p>{preset.description}</p><small>{formatTime(preset.clipDuration ?? preset.duration)}{preset.clipDuration && preset.clipDuration < preset.duration ? ' · extrait conseillé' : ''} · {preset.tags.slice(0, 3).join(' · ')}</small><a className="library-source-link" href={preset.sourcePage} target="_blank" rel="noreferrer" title={`${preset.author} · ${preset.license}`}>ⓘ Source</a></div>
              <div className="library-card-actions"><TimedPreviewButton previewId={`library-${preset.id}`} onStart={() => createLibraryPreviewSession(preset)} disabled={Boolean(addingId)} compact /><button className="primary-button compact" disabled={Boolean(addingId)} onClick={() => void add(preset)}>{addingId === preset.id ? 'Ajout…' : '＋ Ajouter'}</button></div>
            </article>
          ))}
          {results.length === 0 && <div className="library-no-result"><span>🔎</span><strong>Aucun son trouvé</strong><p>Essaie un mot plus simple ou choisis une autre catégorie.</p></div>}
        </div>
        <div className="library-footer-note"><a href="./audio-credits.html" target="_blank" rel="noreferrer">Sources et licences de tous les sons</a><span>Les fichiers sont téléchargés au premier ajout puis conservés dans le projet.</span></div>
        {error && <div className="error-box library-error">{error}</div>}
      </div>
    </div>
  );
}

function ChoiceSetting({ title, value, options, onChange }: { title: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <div className="choice-setting"><h3>{title}</h3><div className="choice-buttons">{options.map(([key, label]) => <button key={key} className={value === key ? 'selected' : ''} onClick={() => onChange(key)}>{label}</button>)}</div></div>;
}

function GlobalPlayer({ status, elapsed, duration, seekable, activeTitle, onPlayPause, onStop, onSeek }: {
  status: 'stopped' | 'loading' | 'playing' | 'paused'; elapsed: number; duration: number; seekable: boolean; activeTitle?: string;
  onPlayPause: () => void; onStop: () => void; onSeek: (value: number) => void;
}) {
  return (
    <div className="global-player">
      <button className="player-main-button" disabled={duration <= 0 || status === 'loading'} onClick={onPlayPause} aria-busy={status === 'loading'}>{status === 'loading' ? <i className="preview-spinner" /> : status === 'playing' ? 'Ⅱ' : '▶'}</button>
      <button className="player-stop-button" disabled={status === 'stopped'} onClick={onStop}>■</button>
      <div className="player-track"><div className="player-title"><strong>{activeTitle || (duration > 0 ? 'Podcast complet' : 'Ajoute un premier élément')}</strong><span>{formatTime(elapsed)} / {formatTime(duration)}</span></div><input type="range" min="0" max={Math.max(0.01, duration)} step="0.05" value={Math.min(elapsed, duration)} disabled={duration <= 0 || !seekable} onChange={(event) => onSeek(Number(event.target.value))} /></div>
    </div>
  );
}

function ExportScreen({ project, duration, rendering, onBack, onListen, onExportWav, onExportProject }: {
  project: PodcastProject; duration: number; rendering: boolean; onBack: () => void; onListen: () => Promise<PreviewSession>; onExportWav: () => void; onExportProject: () => void;
}) {
  const warnings: string[] = [];
  if (!project.blocks.some((block) => block.type === 'voice' && block.assetId)) warnings.push('Le podcast ne contient encore aucun enregistrement vocal.');
  const empty = project.blocks.filter((block) => ['voice', 'music', 'sfx'].includes(block.type) && !block.assetId);
  if (empty.length) warnings.push(`${empty.length} élément${empty.length > 1 ? 's sont vides' : ' est vide'}.`);
  if (project.targetDuration && duration > project.targetDuration * 1.1) warnings.push(`Le podcast dépasse la durée cible de ${formatTime(project.targetDuration)}.`);
  if (project.targetDuration && duration < project.targetDuration * 0.7) warnings.push(`Le podcast est nettement plus court que la durée cible de ${formatTime(project.targetDuration)}.`);
  if (project.blocks.some((block) => block.type === 'music' && block.volume === 'high')) warnings.push('Une musique réglée sur « fort » peut fatiguer l’écoute.');
  if (project.blocks.some((block) => block.type === 'voice' && block.background?.level === 'present')) warnings.push('Une musique de fond « présente » peut masquer certains mots. Écoute le résultat avant l’export.');
  return (
    <div className="export-screen">
      <header className="simple-header"><button className="ghost-button" onClick={onBack}>← Retour au montage</button><div className="brand"><span className="brand-mark">PF</span><span>{APP_NAME}</span></div><span /></header>
      <main className="export-content">
        <div className="export-icon">🎧</div><h1>Ton podcast est prêt à être vérifié</h1><h2>{project.title}</h2>
        <div className="export-summary"><div><span>Durée totale</span><strong>{formatTime(duration)}</strong></div><div><span>Éléments</span><strong>{project.blocks.length}</strong></div><div><span>Sections</span><strong>{project.sections.length}</strong></div></div>
        <TimedPreviewButton previewId="export-full-podcast" onStart={onListen} disabled={duration <= 0} label="Écouter le podcast complet" />
        <section className="checks-panel"><h3>Vérifications</h3>{warnings.length === 0 ? <div className="check-success">✓ Aucun problème évident détecté.</div> : warnings.map((warning) => <div className="warning-row" key={warning}>⚠ {warning}</div>)}<p>Ces avertissements ne bloquent jamais l’export.</p></section>
        <section className="export-actions-panel"><div><h3>Exporter le fichier audio</h3><p>Format WAV, compatible avec la plupart des appareils et logiciels.</p></div><button className="primary-button large" disabled={rendering || duration <= 0} onClick={onExportWav}>{rendering ? 'Création…' : 'Télécharger le podcast (.wav)'}</button></section>
        <section className="export-actions-panel secondary"><div><h3>Garder une sauvegarde transférable</h3><p>Le fichier .podfacile contient le projet et ses fichiers audio.</p></div><button className="secondary-button" disabled={rendering} onClick={onExportProject}>Télécharger la sauvegarde</button></section>
      </main>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return <Modal title="Aide rapide" onClose={onClose}><div className="help-steps"><div><span>1</span><p><strong>Ajoute des éléments.</strong><br />Voix, musique, bruitage, jingle, transition ou pause.</p></div><div><span>2</span><p><strong>Mets-les dans l’ordre.</strong><br />Glisse les cartes ou utilise les flèches.</p></div><div><span>3</span><p><strong>Écoute et corrige.</strong><br />Les fondus et la baisse de musique sont automatiques.</p></div><div><span>4</span><p><strong>Exporte.</strong><br />Télécharge le podcast en WAV et une sauvegarde .podfacile.</p></div></div><div className="important-note"><strong>Important</strong><p>Les projets enregistrés uniquement dans le navigateur peuvent disparaître si ses données sont effacées. Télécharge régulièrement une sauvegarde .podfacile.</p></div></Modal>;
}

function Modal({ title, onClose, wide = false, children }: { title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => { requestExclusivePreview('modal-window'); }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button onClick={onClose} aria-label="Fermer">×</button></div>{children}</div></div>;
}

export default App;
