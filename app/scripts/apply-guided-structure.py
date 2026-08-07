from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / 'src' / 'App.tsx'
ENGINE_PATH = ROOT / 'src' / 'audio' / 'engine.ts'
TYPES_PATH = ROOT / 'src' / 'types.ts'
STYLES_PATH = ROOT / 'src' / 'styles.css'
MARKER = '// Guided structure and audio levels: 20260722-guided-structure-1'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: attendu 1 occurrence, trouvé {count}.')
    return text.replace(old, new, 1)


def replace_between(text: str, start_marker: str, end_marker: str, replacement: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f'{label}: début introuvable.')
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f'{label}: fin introuvable.')
    return text[:start] + replacement + text[end:]


def replace_once_or_present(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return replace_once(text, old, new, label)
    if new not in text:
        raise RuntimeError(f'{label}: ni la forme initiale ni la forme attendue ne sont présentes.')
    return text


types = TYPES_PATH.read_text(encoding='utf-8')
types = replace_once_or_present(
    types,
    "export type VoiceEffect = 'none' | 'phone' | 'echo' | 'distant' | 'deep' | 'high';",
    "export type VoiceEffect = 'none' | 'phone' | 'echo' | 'distant' | 'deep' | 'high' | 'very-high';",
    'niveaux de voix aiguë',
)
types = replace_once_or_present(
    types,
    "  startBefore: boolean;\n  continueAfter: boolean;",
    "  startBefore: boolean;\n  startBeforeSeconds?: 1 | 2 | 3;\n  continueAfter: boolean;\n  continueAfterSeconds?: 1 | 2 | 3;",
    'durées avant et après la voix',
)
types = replace_once_or_present(
    types,
    "    length: 'short' | 'normal' | 'long';",
    "    length?: 'short' | 'normal' | 'long';",
    'compatibilité des anciennes durées de jingle',
)
types = replace_once_or_present(
    types,
    "export interface PodcastSection {\n  id: string;\n  title: string;\n  collapsed: boolean;\n  kind?: 'standard' | 'jingle';\n}",
    "export type SectionGuideType = 'intro-jingle' | 'introduction' | 'part' | 'intermediate-jingle' | 'conclusion' | 'final-jingle';\n\nexport interface PodcastSection {\n  id: string;\n  title: string;\n  collapsed: boolean;\n  kind?: 'standard' | 'jingle';\n  guideType?: SectionGuideType;\n}",
    'type des sections guidées',
)
app = APP_PATH.read_text(encoding='utf-8')
if MARKER in app:
    raise RuntimeError('La passe guidée a déjà été appliquée à App.tsx.')
app = replace_once(app, "const APP_NAME = 'Podcast Facile';", f"{MARKER}\nconst APP_NAME = 'Podcast Facile';", 'marqueur de version')
app = replace_once(app, "  AudioAsset,\n  BlockType,", "  AudioAsset,\n  BackgroundAudio,\n  BlockType,", 'import du fond musical')
app = replace_once(app, "  Screen,\n  TransitionPreset,", "  Screen,\n  SectionGuideType,\n  TransitionPreset,", 'import du type de section')

old_voice_labels = '''const voiceEffectLabels: Record<VoiceEffect, string> = {
  none: 'Aucun effet',
  phone: 'Effet téléphone',
  echo: 'Rêve',
  distant: 'Voix lointaine (réverbération)',
  deep: 'Voix grave',
  high: 'Voix aiguë +',
};'''
new_voice_labels = '''const voiceEffectLabels: Record<VoiceEffect, string> = {
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
};'''
app = replace_once(app, old_voice_labels, new_voice_labels, 'libellés et aides')

app = replace_once(
    app,
    "function makeSection(title: string, kind: PodcastSection['kind'] = 'standard'): PodcastSection {\n  return { id: crypto.randomUUID(), title, collapsed: false, kind };\n}",
    "function makeSection(title: string, kind: PodcastSection['kind'] = 'standard', guideType?: SectionGuideType): PodcastSection {\n  return { id: crypto.randomUUID(), title, collapsed: false, kind, guideType };\n}",
    'création de section guidée',
)
app = replace_once(
    app,
    "    jingle: type === 'jingle' ? { style: 'modern-radio', length: 'normal', musicLevel: 'low' } : undefined,",
    "    jingle: type === 'jingle' ? { style: 'modern-radio', musicLevel: 'low' } : undefined,",
    'jingle sans limite choisie',
)

new_project_factory = '''function makeGuidedSection(guideType: SectionGuideType, existingSections: PodcastSection[]): { section: PodcastSection; block?: PodcastBlock } {
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
}'''
app = replace_between(app, 'function createProject(', '\n\nfunction App()', new_project_factory, 'structure initiale')

app = replace_once(
    app,
    "  const [helpOpen, setHelpOpen] = useState(false);\n  const [addSectionId, setAddSectionId] = useState<string | null>(null);",
    "  const [helpOpen, setHelpOpen] = useState(false);\n  const [sectionHelp, setSectionHelp] = useState<PodcastSection | null>(null);\n  const [addSectionOpen, setAddSectionOpen] = useState(false);\n  const [addSectionId, setAddSectionId] = useState<string | null>(null);",
    'états des fenêtres de section',
)

new_add_section = '''  const addGuidedSection = (guideType: SectionGuideType) => {
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
'''
app = replace_between(app, '  const addJingleSection = () => {', '\n\n  const closeBlockEditor', new_add_section, 'ajout de section unifié')

app = replace_once(app, "const duration = blocks.reduce((sum, block) => sum + getBlockDuration(block), 0);", "const duration = blocks.reduce((sum, block) => sum + getBlockDuration(block, project.assets), 0);", 'durée des sections')
app = replace_once(app, "              blocks={blocks}\n              duration={duration}", "              blocks={blocks}\n              assets={project.assets}\n              duration={duration}", 'ressources des cartes')
app = replace_once(app, "              onToggle={() => applyChange((draft) => { const item = draft.sections.find((candidate) => candidate.id === section.id); if (item) item.collapsed = !item.collapsed; })}\n              onAdd={() => setAddSectionId(section.id)}", "              onToggle={() => applyChange((draft) => { const item = draft.sections.find((candidate) => candidate.id === section.id); if (item) item.collapsed = !item.collapsed; })}\n              onHelp={() => setSectionHelp(section)}\n              onAdd={() => setAddSectionId(section.id)}", 'bouton aide de section')

old_delete_section = '''              onDeleteSection={() => {
                if (section.kind === 'jingle') {
                  if (!window.confirm(`Supprimer le jingle « ${section.title} » ?`)) return;
                  applyChange((draft) => {
                    draft.blocks = draft.blocks.filter((item) => item.sectionId !== section.id);
                    draft.sections = draft.sections.filter((item) => item.id !== section.id);
                  });
                  return;
                }
                if (blocks.length > 0) { setToast('Une section contenant des éléments ne peut pas être supprimée.'); return; }
                if (!window.confirm(`Supprimer la section « ${section.title} » ?`)) return;
                applyChange((draft) => { draft.sections = draft.sections.filter((item) => item.id !== section.id); });
              }}'''
new_delete_section = '''              onDeleteSection={() => {
                const contentWarning = blocks.length > 0 ? ' et tout son contenu' : '';
                if (!window.confirm(`Supprimer la section « ${section.title} »${contentWarning} ?`)) return;
                applyChange((draft) => {
                  draft.blocks = draft.blocks.filter((item) => item.sectionId !== section.id);
                  draft.sections = draft.sections.filter((item) => item.id !== section.id);
                });
              }}'''
app = replace_once(app, old_delete_section, new_delete_section, 'suppression libre des sections')

old_add_buttons = '''        <div className="section-add-actions">
          <button className="add-section-button" onClick={() => applyChange((draft) => { draft.sections.push(makeSection('Nouvelle section')); })}>＋ Ajouter une section</button>
          <button className="add-jingle-button" onClick={addJingleSection}>📻 Ajouter un jingle</button>
        </div>'''
new_add_buttons = '''        <div className="section-add-actions">
          <button className="add-section-button" onClick={() => setAddSectionOpen(true)}>＋ Ajouter une section</button>
        </div>'''
app = replace_once(app, old_add_buttons, new_add_buttons, 'bouton unique de section')

app = replace_once(
    app,
    "      {editingBlock && (",
    "      {addSectionOpen && <AddSectionModal onClose={() => setAddSectionOpen(false)} onChoose={addGuidedSection} />}\n\n      {editingBlock && (",
    'fenêtre de type de section',
)
app = replace_once(
    app,
    "      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}\n      {toast &&",
    "      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}\n      {sectionHelp && <SectionHelpModal section={sectionHelp} onClose={() => setSectionHelp(null)} />}\n      {toast &&",
    'fenêtre d’aide de section',
)

app = replace_once(
    app,
    "  section, sectionIndex, sectionCount, blocks, duration, activeBlockId,\n  onRename, onToggle, onAdd, onMoveSection, onDeleteSection, onPlay, onEdit, onDuplicate, onDelete, onMove, onDropBlock,",
    "  section, sectionIndex, sectionCount, blocks, assets, duration, activeBlockId,\n  onRename, onToggle, onHelp, onAdd, onMoveSection, onDeleteSection, onPlay, onEdit, onDuplicate, onDelete, onMove, onDropBlock,",
    'propriétés du panneau de section',
)
app = replace_once(
    app,
    "  section: PodcastSection; sectionIndex: number; sectionCount: number; blocks: PodcastBlock[]; duration: number; activeBlockId: string | null;\n  onRename: (title: string) => void; onToggle: () => void; onAdd: () => void;",
    "  section: PodcastSection; sectionIndex: number; sectionCount: number; blocks: PodcastBlock[]; assets: AudioAsset[]; duration: number; activeBlockId: string | null;\n  onRename: (title: string) => void; onToggle: () => void; onHelp: () => void; onAdd: () => void;",
    'types du panneau de section',
)
app = replace_once(
    app,
    "        <input className=\"section-title-input\" value={section.title} onChange={(event) => onRename(event.target.value)} aria-label=\"Nom de la section\" />\n        {section.kind === 'jingle'",
    "        <input className=\"section-title-input\" value={section.title} onChange={(event) => onRename(event.target.value)} aria-label=\"Nom de la section\" />\n        <button className=\"section-help-button\" onClick={onHelp} title=\"Conseils et exemples pour cette section\" aria-label={`Aide pour ${section.title}`}>?</button>\n        {section.kind === 'jingle'",
    'contrôle d’aide dans l’en-tête',
)
app = replace_once(app, "              block={block}\n              active={block.id", "              block={block}\n              assets={assets}\n              active={block.id", 'ressources de la carte')
app = replace_once(
    app,
    "function BlockCard({ block, active, canMoveUp, canMoveDown, onPlay, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown, onDragStart, onDropBefore }: {\n  block: PodcastBlock; active:",
    "function BlockCard({ block, assets, active, canMoveUp, canMoveDown, onPlay, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown, onDragStart, onDropBefore }: {\n  block: PodcastBlock; assets: AudioAsset[]; active:",
    'ressources de BlockCard',
)
app = replace_once(app, "{formatTime(getBlockDuration(block))}", "{formatTime(getBlockDuration(block, assets))}", 'durée naturelle du jingle affichée')

section_modals = r'''function AddSectionModal({ onClose, onChoose }: { onClose: () => void; onChoose: (type: SectionGuideType) => void }) {
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

'''
app = replace_once(app, 'function AddBlockModal(', section_modals + 'function AddBlockModal(', 'composants des sections guidées')

app = replace_once(
    app,
    "  const [cueInsertTime, setCueInsertTime] = useState(0);",
    "  const [cueInsertTime, setCueInsertTime] = useState(0);\n  const [showSfxRecorder, setShowSfxRecorder] = useState(false);",
    'état de l’enregistreur de bruitage',
)
app = app.replace(
    "background: { assetId: asset.id, level: 'low', startBefore: true, continueAfter: true }",
    "background: { assetId: asset.id, level: 'low', startBefore: true, startBeforeSeconds: 2, continueAfter: true, continueAfterSeconds: 2 }",
)
length_default_count = app.count("length: 'normal'")
if length_default_count != 3:
    raise RuntimeError(f"valeurs par défaut du jingle: attendu 3 occurrences, trouvé {length_default_count}")
app = app.replace("{ style: 'modern-radio', length: 'normal', musicLevel: 'low' }", "{ style: 'modern-radio', musicLevel: 'low' }")

old_source_actions = '''              <div className="source-actions">
                {block.type !== 'voice' && <button className="primary-button file-button" onClick={() => setLibraryTarget('block')}>{block.type === 'music' ? '🎼 Ouvrir la bibliothèque musicale' : '🔊 Ouvrir la bibliothèque de bruitages'}</button>}
                <FilePicker label={block.type === 'voice' ? 'Importer un enregistrement' : block.type === 'music' ? 'Importer ma propre musique' : 'Importer mon propre bruitage'} onFile={importForBlock} />
              </div>'''
new_source_actions = '''              <div className="source-actions">
                {block.type !== 'voice' && <button className="primary-button file-button" onClick={() => setLibraryTarget('block')}>{block.type === 'music' ? '🎼 Ouvrir la bibliothèque musicale' : '🔊 Ouvrir la bibliothèque de bruitages'}</button>}
                <FilePicker label={block.type === 'voice' ? 'Importer un enregistrement' : block.type === 'music' ? 'Importer ma propre musique' : 'Importer mon propre bruitage'} onFile={importForBlock} />
                {block.type === 'sfx' && <button className="record-sfx-button" onClick={() => setShowSfxRecorder((visible) => !visible)}>● Enregistrer mon propre bruitage</button>}
              </div>
              {block.type === 'sfx' && showSfxRecorder && <div className="inline-sfx-recorder"><Recorder onReady={async (blob, duration) => { const asset = await onRegisterAsset(blob, `Bruitage enregistré ${new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`, blob.type, duration, { source: 'recording' }); setBlock((current) => ({ ...current, assetId: asset.id, duration: asset.duration, trimStart: 0, trimEnd: asset.duration, title: current.title.startsWith('Nouveau') ? 'Mon bruitage enregistré' : current.title })); setShowSfxRecorder(false); }} /></div>}'''
app = replace_once(app, old_source_actions, new_source_actions, 'enregistreur de bruitage')

old_background_timing = '''                    <label className="check-row"><input type="checkbox" checked={block.background.startBefore} onChange={(event) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, startBefore: event.target.checked } : undefined }))} /> Commencer légèrement avant la voix</label>
                    <label className="check-row"><input type="checkbox" checked={block.background.continueAfter} onChange={(event) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, continueAfter: event.target.checked } : undefined }))} /> Continuer légèrement après la voix</label>'''
new_background_timing = '''                    <BackgroundTimingControl label="Commencer avant la voix" checked={block.background.startBefore} seconds={block.background.startBeforeSeconds ?? 2} onChecked={(checked) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, startBefore: checked, startBeforeSeconds: current.background.startBeforeSeconds ?? 2 } : undefined }))} onSeconds={(seconds) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, startBeforeSeconds: seconds } : undefined }))} />
                    <BackgroundTimingControl label="Continuer après la voix" checked={block.background.continueAfter} seconds={block.background.continueAfterSeconds ?? 2} onChecked={(checked) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, continueAfter: checked, continueAfterSeconds: current.background.continueAfterSeconds ?? 2 } : undefined }))} onSeconds={(seconds) => setBlock((current) => ({ ...current, background: current.background ? { ...current.background, continueAfterSeconds: seconds } : undefined }))} />'''
app = replace_once(app, old_background_timing, new_background_timing, 'durées de fond musical')

app = replace_once(
    app,
    "  const jingle = block.jingle ?? { style: 'modern-radio' as const, length: 'normal' as const, musicLevel: 'low' as const };",
    "  const jingle = block.jingle ?? { style: 'modern-radio' as const, musicLevel: 'low' as const };",
    'jingle sans choix de durée',
)
app = replace_once(app, '<div className="settings-columns">\n        <ChoiceSetting title="Style"', '<div className="settings-columns jingle-settings">\n        <ChoiceSetting title="Style"', 'grille des réglages de jingle')
app = replace_once(
    app,
    '        <ChoiceSetting title="Durée" value={jingle.length} options={[["short", "Courte · 6 s"], ["normal", "Normale · 10 s"], ["long", "Longue · 15 s"]]} onChange={(value) => updateJingle({ length: value as \'short\' | \'normal\' | \'long\' })} />\n',
    '',
    'suppression du paramètre durée du jingle',
)
engine = ENGINE_PATH.read_text(encoding='utf-8')
engine = replace_once(engine, "const PRE_ROLL = 0.75;\nconst POST_ROLL = 0.75;", "const DEFAULT_BACKGROUND_ROLL = 2;\n\nfunction backgroundLeadIn(background: PodcastBlock['background']): number {\n  if (!background?.startBefore) return 0;\n  return Math.min(3, Math.max(1, background.startBeforeSeconds ?? DEFAULT_BACKGROUND_ROLL));\n}\n\nfunction backgroundTail(background: PodcastBlock['background']): number {\n  if (!background?.continueAfter) return 0;\n  return Math.min(3, Math.max(1, background.continueAfterSeconds ?? DEFAULT_BACKGROUND_ROLL));\n}", 'durées variables du fond')
engine = replace_once(
    engine,
    "function voicePlaybackRate(effect: VoiceEffect): number {\n  return effect === 'deep' ? 0.9 : effect === 'high' ? 1.16 : 1;\n}",
    "function voicePlaybackRate(effect: VoiceEffect): number {\n  return effect === 'deep' ? 0.9 : effect === 'high' ? 1.12 : effect === 'very-high' ? 1.24 : 1;\n}\n\nconst JINGLE_VOICE_START: Record<NonNullable<PodcastBlock['jingle']>['style'], number> = {\n  dynamic: 0.65, adventure: 1.25, mysterious: 1.6, serious: 1, historical: 1.35, 'modern-radio': 0.8,\n};",
    'deux niveaux de voix aiguë',
)

old_get_duration = '''export function getBlockDuration(block: PodcastBlock): number {
  if (block.type === 'silence') return Math.max(0.1, block.duration);
  if (block.type === 'transition') return Math.min(3, Math.max(0.5, block.duration));
  if (block.type === 'jingle') {
    return block.jingle?.length === 'short' ? 6 : block.jingle?.length === 'long' ? 15 : 10;
  }
  const sourceDuration = Math.max(0, block.trimEnd - block.trimStart || block.duration);
  const rate = block.type === 'voice' ? voicePlaybackRate(block.voiceEffect) : 1;
  const coreDuration = sourceDuration / rate;
  if (block.type === 'voice' && block.background) {
    return coreDuration + (block.background.startBefore ? PRE_ROLL : 0) + (block.background.continueAfter ? POST_ROLL : 0);
  }
  return coreDuration;
}'''
new_get_duration = '''export function getBlockDuration(block: PodcastBlock, assets: AudioAsset[] = []): number {
  if (block.type === 'silence') return Math.max(0.1, block.duration);
  if (block.type === 'transition') return Math.min(3, Math.max(0.5, block.duration));
  if (block.type === 'jingle') {
    const legacyFallback = block.jingle?.length === 'short' ? 6 : block.jingle?.length === 'long' ? 15 : Math.max(2.5, block.duration || 10);
    const voice = assets.find((asset) => asset.id === block.jingle?.voiceAssetId);
    if (!voice) return legacyFallback;
    const style = block.jingle?.style ?? 'modern-radio';
    return Math.max(legacyFallback, JINGLE_VOICE_START[style] + voice.duration + 0.8);
  }
  const sourceDuration = Math.max(0, block.trimEnd - block.trimStart || block.duration);
  const rate = block.type === 'voice' ? voicePlaybackRate(block.voiceEffect) : 1;
  const coreDuration = sourceDuration / rate;
  if (block.type === 'voice' && block.background) {
    return coreDuration + backgroundLeadIn(block.background) + backgroundTail(block.background);
  }
  return coreDuration;
}'''
engine = replace_once(engine, old_get_duration, new_get_duration, 'durée naturelle des jingles')
engine = replace_once(engine, 'const duration = getBlockDuration(block);', 'const duration = getBlockDuration(block, project.assets);', 'durée de la timeline')
old_timeline = '''export function getTimeline(project: PodcastProject): TimelineEntry[] {
  let cursor = 0;
  return project.blocks.map((block) => {
    const duration = getBlockDuration(block, project.assets);
    const entry = { block, start: cursor, end: cursor + duration, duration };
    cursor += duration;
    return entry;
  });
}'''
new_timeline = '''function getBlocksInPlaybackOrder(project: PodcastProject): PodcastBlock[] {
  const knownSectionIds = new Set(project.sections.map((section) => section.id));
  const blocksBySection = new Map<string, PodcastBlock[]>();
  const orphanBlocks: PodcastBlock[] = [];

  for (const block of project.blocks) {
    if (!knownSectionIds.has(block.sectionId)) {
      orphanBlocks.push(block);
      continue;
    }
    const sectionBlocks = blocksBySection.get(block.sectionId) ?? [];
    sectionBlocks.push(block);
    blocksBySection.set(block.sectionId, sectionBlocks);
  }

  return project.sections.flatMap((section) => blocksBySection.get(section.id) ?? []).concat(orphanBlocks);
}

export function getTimeline(project: PodcastProject): TimelineEntry[] {
  let cursor = 0;
  return getBlocksInPlaybackOrder(project).map((block) => {
    const duration = getBlockDuration(block, project.assets);
    const entry = { block, start: cursor, end: cursor + duration, duration };
    cursor += duration;
    return entry;
  });
}'''
engine = replace_once(engine, old_timeline, new_timeline, 'ordre de lecture selon les sections')
engine = replace_once(
    engine,
    "function volumeValue(level: VolumeLevel): number {\n  return level === 'low' ? 0.62 : level === 'high' ? 1.22 : 0.92;\n}",
    "function volumeValue(level: VolumeLevel): number {\n  return level === 'low' ? 0.62 : level === 'high' ? 1.22 : 0.92;\n}\n\nfunction voiceVolumeValue(level: VolumeLevel): number {\n  return level === 'low' ? 0.62 : level === 'high' ? 1.38 : 0.92;\n}",
    'voix plus forte',
)
engine = replace_once(engine, "return level === 'very-low' ? 0.08 : level === 'present' ? 0.23 : 0.14;", "return level === 'very-low' ? 0.045 : level === 'present' ? 0.23 : 0.14;", 'musique très discrète')
engine = replace_once(engine, "return level === 'low' ? 0.24 : level === 'high' ? 0.78 : 0.48;", "return level === 'low' ? 0.14 : level === 'high' ? 1.0 : 0.48;", 'contraste des bruitages synchronisés')
engine = replace_once(engine, "return level === 'low' ? 0.2 : level === 'high' ? 0.52 : 0.34;", "return level === 'low' ? 0.11 : level === 'high' ? 0.7 : 0.34;", 'contraste des transitions')
engine = replace_once(engine, "  if (effect === 'high') source.playbackRate.value = 1.16;", "  if (effect === 'high') source.playbackRate.value = 1.12;\n  if (effect === 'very-high') source.playbackRate.value = 1.24;", 'lecture des voix aiguës')
engine = replace_once(engine, "  const pre = block.background?.startBefore ? PRE_ROLL : 0;\n  const post = block.background?.continueAfter ? POST_ROLL : 0;", "  const pre = backgroundLeadIn(block.background);\n  const post = backgroundTail(block.background);", 'planification avant et après')
engine = replace_once(engine, '      volumeValue(block.volume),\n      block.fadeIn ===', '      voiceVolumeValue(block.volume),\n      block.fadeIn ===', 'gain des voix')
if engine.count('const total = getBlockDuration(block);') != 2:
    raise RuntimeError(f"durées moteur: attendu 2 occurrences, trouvé {engine.count('const total = getBlockDuration(block);')}")
engine = engine.replace('const total = getBlockDuration(block);', 'const total = getBlockDuration(block, project.assets);')
styles = STYLES_PATH.read_text(encoding='utf-8')
styles += r'''

/* Structure guidée et réglages audio 20260722-guided-structure-1 */
.podcast-section-header { grid-template-columns: 35px minmax(120px, 1fr) 34px auto auto 34px 34px 34px; }
.section-help-button { width: 30px; height: 30px; padding: 0; border: 1px solid #b8c7e3; border-radius: 50%; background: #fff; color: var(--primary); font-weight: 900; }
.section-help-button:hover { background: var(--primary-soft); border-color: var(--primary); }
.section-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; padding: 0 20px 22px; }
.section-type-choice { min-height: 166px; display: flex; flex-direction: column; align-items: flex-start; gap: 9px; padding: 18px; text-align: left; border: 1px solid #d8e0ec; border-radius: 15px; background: white; color: var(--ink); }
.section-type-choice:hover { border-color: var(--primary); background: #f7f9ff; transform: translateY(-1px); }
.section-type-choice.jingle-choice { border-color: rgba(209,72,105,.3); background: #fff8fa; }
.section-type-choice.jingle-choice:hover { border-color: var(--jingle); }
.section-type-choice > span { font-size: 1.55rem; }
.section-type-choice strong { font-size: .96rem; }
.section-type-choice small { color: var(--muted); line-height: 1.42; }
.section-help-content { padding: 20px; }
.section-help-intro { display: grid; grid-template-columns: 48px 1fr; gap: 13px; align-items: center; padding: 15px; border-radius: 13px; background: var(--primary-soft); }
.section-help-intro > span { font-size: 1.65rem; text-align: center; }
.section-help-intro p { margin: 0; color: #33456a; }
.section-help-content h3 { margin: 22px 0 9px; font-size: .96rem; }
.section-help-content ul { margin: 0; padding-left: 22px; color: #46546b; line-height: 1.65; }
.example-phrases { display: grid; gap: 8px; }
.example-phrases p { margin: 0; padding: 11px 13px; border-left: 3px solid var(--primary); border-radius: 0 9px 9px 0; background: #f7f9fc; color: #3f4d64; }
.section-help-note { margin: 18px 0 0; font-size: .84rem; }
.background-timing { display: grid; gap: 8px; padding: 10px 12px; border: 1px solid #e0e5ee; border-radius: 11px; background: white; }
.background-timing.enabled { border-color: #b8c8e7; background: #f8faff; }
.timing-buttons { display: flex; gap: 7px; padding-left: 25px; }
.timing-buttons button { min-width: 54px; min-height: 34px; border: 1px solid #c8d2e2; border-radius: 9px; background: white; color: #4d5a70; font-weight: 800; }
.timing-buttons button.selected { border-color: var(--primary); background: var(--primary); color: white; }
.record-sfx-button { min-height: 39px; padding: 0 14px; border: 1px solid #df8ea0; border-radius: 10px; background: #fff4f6; color: #a82846; font-weight: 800; }
.record-sfx-button:hover { border-color: #c83f5e; background: #ffe7ed; }
.inline-sfx-recorder { margin-top: 12px; padding: 12px; border: 1px solid #e3ccd2; border-radius: 12px; background: #fff8fa; }
.inline-sfx-recorder .recorder { margin: 0; }
.jingle-settings { grid-template-columns: repeat(2, 1fr); }

@media (max-width: 760px) {
  .section-type-grid { grid-template-columns: 1fr 1fr; padding: 0 14px 18px; }
  .podcast-section-header { grid-template-columns: 31px minmax(90px, 1fr) 31px auto 31px 31px; }
  .podcast-section-header .section-kind-badge { display: none; }
  .podcast-section-header .section-duration { display: none; }
}

@media (max-width: 480px) {
  .section-type-grid { grid-template-columns: 1fr; }
  .section-type-choice { min-height: 132px; }
}
'''
TYPES_PATH.write_text(types, encoding='utf-8')
APP_PATH.write_text(app, encoding='utf-8')
ENGINE_PATH.write_text(engine, encoding='utf-8')
STYLES_PATH.write_text(styles, encoding='utf-8')
print('Structure guidée, nouveaux niveaux audio et enregistrement de bruitages appliqués.')
