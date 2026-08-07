export type Screen = 'home' | 'setup' | 'editor' | 'export';
export type BlockType = 'voice' | 'music' | 'sfx' | 'silence' | 'jingle' | 'transition';
export type VolumeLevel = 'low' | 'normal' | 'high';
export type FadeLevel = 'none' | 'short' | 'normal';
export type VoiceEffect = 'none' | 'phone' | 'echo' | 'deep' | 'high';
export type TransitionPreset = 'fade' | 'whoosh' | 'bell' | 'radio' | 'page' | 'percussion' | 'rise' | 'mystery';

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
  continueAfter: boolean;
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
  transitionPreset?: TransitionPreset;
  jingle?: {
    musicAssetId?: string;
    voiceAssetId?: string;
    openingAssetId?: string;
    closingAssetId?: string;
    style: 'dynamic' | 'adventure' | 'mysterious' | 'serious' | 'historical' | 'modern-radio';
    length: 'short' | 'normal' | 'long';
    musicLevel: 'very-low' | 'low' | 'present';
  };
}

export interface PodcastSection {
  id: string;
  title: string;
  collapsed: boolean;
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
