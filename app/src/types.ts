export type Screen = 'home' | 'setup' | 'editor' | 'export';
export type BlockType = 'voice' | 'music' | 'sfx' | 'silence' | 'jingle' | 'transition';
export type VolumeLevel = 'low' | 'normal' | 'high';
export type FadeLevel = 'none' | 'short' | 'normal';
export type VoiceEffect = 'none' | 'phone' | 'echo' | 'distant' | 'deep' | 'high' | 'very-high';
export type TransitionPreset = 'fade' | 'whoosh' | 'bell' | 'radio' | 'page' | 'percussion' | 'rise' | 'mystery' | 'impact' | 'sparkle' | 'heartbeat' | 'rewind' | 'drop' | 'question' | 'failure' | 'surprise' | 'portal' | 'cinematic';
export type VoiceCueLevel = 'low' | 'normal' | 'high';

export interface VoiceSoundCue {
  id: string;
  assetId: string;
  at: number;
  duration: number;
  sourceStart?: number;
  sourceEnd?: number;
  level: VoiceCueLevel;
}

export interface AudioAsset {
  id: string;
  name: string;
  mimeType: string;
  duration: number;
  blob: Blob;
  source?: 'recording' | 'import' | 'library';
  libraryId?: string;
}

export interface BackgroundAudio {
  assetId: string;
  level: 'very-low' | 'low' | 'present';
  startBefore: boolean;
  startBeforeSeconds?: 1 | 2 | 3;
  continueAfter: boolean;
  continueAfterSeconds?: 1 | 2 | 3;
}

export interface PodcastBlock {
  id: string;
  sectionId: string;
  type: BlockType;
  title: string;
  assetId?: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  volume: VolumeLevel;
  fadeIn: FadeLevel;
  fadeOut: FadeLevel;
  voiceEffect: VoiceEffect;
  background?: BackgroundAudio;
  voiceCues?: VoiceSoundCue[];
  transitionPreset?: TransitionPreset;
  transitionVolume?: VolumeLevel;
  jingle?: {
    musicAssetId?: string;
    voiceAssetId?: string;
    openingAssetId?: string;
    closingAssetId?: string;
    style: 'dynamic' | 'adventure' | 'mysterious' | 'serious' | 'historical' | 'modern-radio';
    length?: 'short' | 'normal' | 'long';
    musicLevel: 'very-low' | 'low' | 'present';
  };
}

export type SectionGuideType = 'intro-jingle' | 'introduction' | 'part' | 'intermediate-jingle' | 'conclusion' | 'final-jingle';

export interface PodcastSection {
  id: string;
  title: string;
  collapsed: boolean;
  kind?: 'standard' | 'jingle';
  guideType?: SectionGuideType;
}

export interface PodcastProject {
  id: string;
  title: string;
  author: string;
  targetDuration?: number;
  templateId: string;
  sections: PodcastSection[];
  blocks: PodcastBlock[];
  assets: AudioAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  author: string;
  updatedAt: string;
  duration: number;
}

export interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  sections: string[];
}
