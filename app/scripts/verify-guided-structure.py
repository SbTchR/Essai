from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / 'src' / 'App.tsx').read_text(encoding='utf-8')
engine = (ROOT / 'src' / 'audio' / 'engine.ts').read_text(encoding='utf-8')
types = (ROOT / 'src' / 'types.ts').read_text(encoding='utf-8')
styles = (ROOT / 'src' / 'styles.css').read_text(encoding='utf-8')

assert '20260722-guided-structure-1' in app
assert "'very-high'" in types
assert "distant: 'Caverne'" in app
assert "high: 'Voix aiguë'" in app
assert "'very-high': 'Voix très aiguë'" in app
assert "effect === 'high' ? 1.12" in engine
assert "effect === 'very-high' ? 1.24" in engine

assert "backgroundMusicValue(block.background.volume, block.background.level)" in engine
assert "level === 'high' ? 1.38" in engine
assert "level === 'low' ? 0.14 : level === 'high' ? 1.0" in engine
assert "level === 'low' ? 0.11 : level === 'high' ? 0.7" in engine

assert 'startBeforeSeconds?: 1 | 2 | 3' in types
assert 'continueAfterSeconds?: 1 | 2 | 3' in types
assert 'backgroundLeadIn(block.background)' in engine
assert 'backgroundTail(block.background)' in engine
assert 'startBeforeSeconds: 2' in app
assert 'continueAfterSeconds: 2' in app
assert 'BackgroundTimingControl' in app

jingle_start = app.index('function JingleSettings(')
jingle_end = app.index('\n\nfunction AudioLibraryModal', jingle_start)
jingle_editor = app[jingle_start:jingle_end]
assert 'ChoiceSetting title="Durée"' not in jingle_editor
assert 'getBlockDuration(block, project.assets)' in engine
assert 'jingleLeadIn(block) + voice.duration + Math.max(jingleTail(block), closingTail)' in engine

assert 'Enregistrer mon propre bruitage' in app
assert 'inline-sfx-recorder' in app

expected_titles = [
    'Jingle d’intro', 'Introduction', 'Jingle intermédiaire', 'Conclusion', 'Jingle final',
]
for title in expected_titles:
    assert title in app
assert 'Partie ${partNumber}' in app
assert "['intro-jingle', 'introduction', 'part', 'part', 'intermediate-jingle', 'part', 'conclusion', 'final-jingle']" in app

assert "templateId: 'guided'" in app
assert 'SectionGuideType' in types
assert 'sectionGuideContent' in app
assert 'SectionHelpModal' in app
assert 'Conseils et exemples pour cette section' in app
assert 'AddSectionModal' in app
assert '＋ Ajouter une section' in app
assert '📻 Ajouter un jingle' not in app
assert "const contentWarning = blocks.length > 0 ? ' et tout son contenu' : '';" in app
assert 'Une section contenant des éléments ne peut pas être supprimée.' not in app
assert 'section-type-grid' in styles
assert 'section-help-content' in styles

print('Structure guidée et nouveaux réglages audio vérifiés.')
