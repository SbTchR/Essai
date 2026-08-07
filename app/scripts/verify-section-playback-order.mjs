import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const engineUrl = new URL('../src/audio/engine.ts', import.meta.url);
const source = await readFile(engineUrl, 'utf8');

const helperStart = source.indexOf('function getBlocksInPlaybackOrder(');
const helperEnd = source.indexOf('\n}\n\nexport function getTimeline', helperStart);
assert.notEqual(helperStart, -1, 'La fonction d’ordre de lecture est absente du moteur.');
assert.notEqual(helperEnd, -1, 'La fonction d’ordre de lecture est incomplète.');

const runnableHelper = source
  .slice(helperStart, helperEnd + 2)
  .replace('function getBlocksInPlaybackOrder(project: PodcastProject): PodcastBlock[]', 'function getBlocksInPlaybackOrder(project)')
  .replace('const blocksBySection = new Map<string, PodcastBlock[]>();', 'const blocksBySection = new Map();')
  .replace('const orphanBlocks: PodcastBlock[] = [];', 'const orphanBlocks = [];');
const getBlocksInPlaybackOrder = Function(`${runnableHelper}; return getBlocksInPlaybackOrder;`)();
assert.match(source, /return getBlocksInPlaybackOrder\(project\)\.map\(\(block\) => \{/);

const makeBlock = (id, sectionId, type = 'voice') => ({
  id,
  sectionId,
  type,
  title: id,
  duration: 1,
  trimStart: 0,
  trimEnd: 1,
  volume: 'normal',
  fadeIn: 'none',
  fadeOut: 'none',
  voiceEffect: 'none',
  ...(type === 'jingle' ? { jingle: { style: 'modern-radio', musicLevel: 'low' } } : {}),
});

const project = {
  id: 'order-regression',
  title: 'Ordre des parties',
  author: 'Test',
  templateId: 'guided',
  sections: [
    { id: 'intro', title: 'Jingle d’intro', collapsed: false, kind: 'jingle' },
    { id: 'part-1', title: 'Partie 1', collapsed: false },
    { id: 'middle', title: 'Jingle intermédiaire', collapsed: false, kind: 'jingle' },
    { id: 'part-2', title: 'Partie 2', collapsed: false },
    { id: 'final', title: 'Jingle final', collapsed: false, kind: 'jingle' },
  ],
  // Reproduit le défaut : les jingles sont créés avant les autres blocs.
  blocks: [
    makeBlock('intro-jingle', 'intro', 'jingle'),
    makeBlock('middle-jingle', 'middle', 'jingle'),
    makeBlock('final-jingle', 'final', 'jingle'),
    makeBlock('voice-1', 'part-1'),
    makeBlock('sfx-1', 'part-1', 'sfx'),
    makeBlock('voice-2', 'part-2'),
    makeBlock('legacy-orphan', 'missing-section', 'sfx'),
  ],
  assets: [],
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
};

const orderedBlocks = getBlocksInPlaybackOrder(project);
assert.deepEqual(
  orderedBlocks.map((block) => block.id),
  ['intro-jingle', 'voice-1', 'sfx-1', 'middle-jingle', 'voice-2', 'final-jingle', 'legacy-orphan'],
);

console.log('Ordre de lecture vérifié : jingles et parties suivent les sections du montage.');
