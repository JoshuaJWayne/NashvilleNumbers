// ─── Note Data ────────────────────────────────────────────────────────────────

const NATURAL_NOTES = ['C','D','E','F','G','A','B'];
const SHARP_NOTES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ALL_NOTES     = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const NOTE_DISPLAY = {
  'C':'C', 'C#':'C# / Db', 'D':'D', 'D#':'D# / Eb',
  'E':'E', 'F':'F', 'F#':'F# / Gb', 'G':'G',
  'G#':'G# / Ab', 'A':'A', 'A#':'A# / Bb', 'B':'B',
};

const BLACK_KEY_NOTES = new Set(['C#','D#','F#','G#','A#']);
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

// Reference note counts per difficulty in sequence mode
const SEQ_REF_COUNT = { natural: 5, sharps: 3, all: 1 };

// ─── State ────────────────────────────────────────────────────────────────────

let ptScore    = 0, ptTotal = 0, ptStreak = 0, ptQNum = 0;
let ptAnswered = false;
let currentNote      = null;
let currentOctave    = 4;
let currentDiff      = 'natural';
let currentAnsMode   = 'multiple';
let currentTrainMode = 'single';
let pitchSynth       = null;

// Sequence mode state
let seqRootNote  = 'C';
let seqRefNotes  = [];
let seqIsPlaying = false;

// ─── Synth ────────────────────────────────────────────────────────────────────

function getPitchSynth() {
  if (!pitchSynth) {
    pitchSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 1.4, sustain: 0.0, release: 1.8 },
      volume: -4,
    }).toDestination();
  }
  return pitchSynth;
}

async function playNote(note, octave) {
  await Tone.start();
  getPitchSynth().triggerAttackRelease(note + octave, '2n');
}

async function playSequenceNotes(notes, gap = 0.9) {
  await Tone.start();
  seqIsPlaying = true;
  setReplaySeqBtn(true);

  const synth = getPitchSynth();
  const now   = Tone.now();

  notes.forEach(({ note, octave }, i) => {
    synth.triggerAttackRelease(note + octave, '4n', now + i * gap);
    setTimeout(() => highlightSeqBubble(i), i * gap * 1000);
  });

  const totalMs = (notes.length - 1) * gap * 1000 + 900;
  return new Promise(resolve => {
    setTimeout(() => {
      seqIsPlaying = false;
      setReplaySeqBtn(false);
      document.querySelectorAll('.seq-note-bubble:not(.mystery-played)').forEach(b => b.classList.remove('playing'));
      resolve();
    }, totalMs);
  });
}

function highlightSeqBubble(index) {
  document.querySelectorAll('.seq-note-bubble').forEach(b => b.classList.remove('playing'));
  const bubbles = document.querySelectorAll('.seq-note-bubble');
  if (bubbles[index]) bubbles[index].classList.add('playing');
}

function setReplaySeqBtn(disabled) {
  const btn = document.getElementById('replaySeqBtn');
  if (btn) btn.disabled = disabled;
}

// ─── Training Mode ────────────────────────────────────────────────────────────

function setTrainMode(mode) {
  currentTrainMode = mode;
  document.getElementById('tmtSingle').classList.toggle('active', mode === 'single');
  document.getElementById('tmtSequence').classList.toggle('active', mode === 'sequence');
  newPitchQuestion();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const DIFF_HINTS = {
  natural: 'Natural notes only · 5 reference notes in context mode',
  sharps:  'Natural + sharps/flats · 3 reference notes in context mode',
  all:     'All 12 chromatic notes · 1 reference note in context mode',
};

function setDifficulty(diff, btn) {
  currentDiff = diff;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const hint = document.getElementById('diffHint');
  if (hint) hint.textContent = DIFF_HINTS[diff] || '';
  newPitchQuestion();
}

function setAnswerMode(mode) {
  currentAnsMode = mode;
  document.getElementById('amtMultiple').classList.toggle('active', mode === 'multiple');
  document.getElementById('amtType').classList.toggle('active', mode === 'type');
  newPitchQuestion();
}

function getNotePool() {
  if (currentDiff === 'natural') return NATURAL_NOTES;
  if (currentDiff === 'sharps')  return SHARP_NOTES;
  return ALL_NOTES;
}

function getOctavePool() {
  const val = document.getElementById('octaveRange').value;
  if (val === '4')   return [4];
  if (val === '45')  return [4, 5];
  if (val === '345') return [3, 4, 5];
  return [4];
}

// ─── Scale & Sequence Helpers ─────────────────────────────────────────────────

const CHROMATIC  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENHARMONIC = { 'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B' };

function noteToIdx(note) {
  return CHROMATIC.indexOf(ENHARMONIC[note] || note);
}

function buildScaleRefs(rootNote, rootOctave, refCount) {
  const rootIdx = noteToIdx(rootNote);
  return MAJOR_SCALE_INTERVALS.slice(0, refCount).map(semitones => {
    const noteIdx = (rootIdx + semitones) % 12;
    const octave  = rootOctave + Math.floor((rootIdx + semitones) / 12);
    return { note: CHROMATIC[noteIdx], octave, label: CHROMATIC[noteIdx] };
  });
}

// Pick the mystery note directly from the reference notes that were played,
// avoiding the very last one (since it's still fresh in memory).
function pickMysteryFromRefs(refs) {
  if (refs.length === 1) return refs[0];
  const candidates = refs.slice(0, -1); // exclude last ref note
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ─── Question Generation ──────────────────────────────────────────────────────

function newPitchQuestion() {
  if (seqIsPlaying) return;
  ptAnswered = false;
  const isFirstQuestion = ptQNum === 0;
  ptQNum++;

  const pool    = getNotePool().map(n => ENHARMONIC[n] || n);
  const octaves = getOctavePool();

  currentNote   = pool[Math.floor(Math.random() * pool.length)];
  currentOctave = octaves[Math.floor(Math.random() * octaves.length)];

  // Reset UI
  document.getElementById('ptQCount').textContent      = `Q ${ptQNum}`;
  document.getElementById('ptFeedback').className      = 'feedback';
  document.getElementById('ptNextBtn').className       = 'next-btn';
  document.getElementById('ptCard').className          = 'quiz-card';
  document.getElementById('resultPianoWrap').className = 'result-piano-wrap';
  document.getElementById('resultPianoSVG').innerHTML  = '';

  // Reset top Next button to dimmed/disabled state
  const topNext = document.getElementById('ptNextBtnTop');
  if (topNext) { topNext.style.opacity = '0.35'; topNext.style.pointerEvents = 'none'; }

  const pct = Math.min((ptScore / Math.max(ptTotal, 1)) * 100, 100);
  document.getElementById('ptProgressBar').style.width = pct + '%';

  const area = document.getElementById('ptAnswerArea');
  area.innerHTML = '';

  if (currentTrainMode === 'single') {
    document.getElementById('ptQType').textContent       = 'IDENTIFY THE NOTE';
    document.getElementById('playNoteBtn').style.display = '';
    document.getElementById('playSeqBtn').style.display  = 'none';
    document.getElementById('seqDisplayWrap').style.display = 'none';

    const playBtn = document.getElementById('playNoteBtn');
    playBtn.classList.remove('playing');
    document.getElementById('playBtnLabel').textContent = 'Play Note';

    if (currentAnsMode === 'multiple') buildPitchMultipleChoice(area);
    else buildPitchTypeInput(area);

    if (!isFirstQuestion) setTimeout(() => replayNote(), 400);

  } else {
    document.getElementById('ptQType').textContent       = 'NOTE IN CONTEXT';
    document.getElementById('playNoteBtn').style.display = 'none';
    document.getElementById('playSeqBtn').style.display  = '';
    document.getElementById('seqDisplayWrap').style.display = 'block';

    const seqBtn = document.getElementById('playSeqBtn');
    seqBtn.classList.remove('playing');
    document.getElementById('playSeqBtnLabel').textContent = 'Play Sequence';

    const refCount   = SEQ_REF_COUNT[currentDiff] ?? 3;
    const baseOctave = octaves[0] || 4;

    seqRootNote = NATURAL_NOTES[Math.floor(Math.random() * NATURAL_NOTES.length)];
    seqRefNotes = buildScaleRefs(seqRootNote, baseOctave, refCount);

    const mystery  = pickMysteryFromRefs(seqRefNotes);
    currentNote    = mystery.note;
    currentOctave  = mystery.octave;

    document.getElementById('refsCountBadge').innerHTML =
      `<span>${refCount}</span> reference note${refCount !== 1 ? 's' : ''} from <span>${seqRootNote} major</span> · then guess the mystery note`;

    renderSeqDisplay(refCount);

    if (currentAnsMode === 'multiple') buildPitchMultipleChoice(area);
    else buildPitchTypeInput(area);

    if (!isFirstQuestion) setTimeout(() => replaySequence(), 400);
  }

  document.getElementById('ptCard').classList.add('pop');
  setTimeout(() => document.getElementById('ptCard').classList.remove('pop'), 300);
}

// ─── Sequence Display ─────────────────────────────────────────────────────────

function renderSeqDisplay(refCount) {
  const display = document.getElementById('seqDisplay');
  display.innerHTML = '';

  seqRefNotes.forEach((ref, i) => {
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className   = 'seq-arrow';
      arrow.textContent = '›';
      display.appendChild(arrow);
    }
    const wrap   = document.createElement('div');
    wrap.className = 'seq-note';

    const bubble = document.createElement('div');
    bubble.className   = 'seq-note-bubble';
    bubble.id          = `seq-bubble-${i}`;
    bubble.textContent = ref.label;

    const lbl = document.createElement('div');
    lbl.className   = 'seq-note-label';
    lbl.textContent = `note ${i + 1}`;

    wrap.appendChild(bubble);
    wrap.appendChild(lbl);
    display.appendChild(wrap);
  });

  // Arrow + mystery note
  const arrow = document.createElement('span');
  arrow.className   = 'seq-arrow';
  arrow.textContent = '›';
  display.appendChild(arrow);

  const mystWrap   = document.createElement('div');
  mystWrap.className = 'seq-note';

  const mystBubble = document.createElement('div');
  mystBubble.className   = 'seq-note-bubble mystery';
  mystBubble.id          = `seq-bubble-${refCount}`;
  mystBubble.textContent = '?';

  const mystLbl = document.createElement('div');
  mystLbl.className   = 'seq-note-label';
  mystLbl.style.color = 'var(--accent)';
  mystLbl.textContent = 'guess this';

  mystWrap.appendChild(mystBubble);
  mystWrap.appendChild(mystLbl);
  display.appendChild(mystWrap);
}

// ─── Replay ───────────────────────────────────────────────────────────────────

async function replayNote() {
  const playBtn = document.getElementById('playNoteBtn');
  playBtn.classList.add('playing');
  document.getElementById('playBtnLabel').textContent = 'Playing…';
  await playNote(currentNote, currentOctave);
  setTimeout(() => {
    playBtn.classList.remove('playing');
    document.getElementById('playBtnLabel').textContent = 'Replay Note';
  }, 1600);
}

async function replaySequence() {
  if (seqIsPlaying) return;
  const seqBtn = document.getElementById('playSeqBtn');
  seqBtn.classList.add('playing');
  document.getElementById('playSeqBtnLabel').textContent = 'Playing…';
  const fullSeq = [
    ...seqRefNotes.map(r => ({ note: r.note, octave: r.octave })),
    { note: currentNote, octave: currentOctave },
  ];
  await playSequenceNotes(fullSeq, 0.9);
  seqBtn.classList.remove('playing');
  document.getElementById('playSeqBtnLabel').textContent = 'Replay Sequence';
}

// ─── Multiple Choice ──────────────────────────────────────────────────────────

function buildPitchMultipleChoice(area) {
  const pool  = getNotePool().map(n => ENHARMONIC[n] || n);
  const wrong = shuffle(pool.filter(n => n !== currentNote)).slice(0, 5);
  let options = shuffle([currentNote, ...wrong]).slice(0, 6);
  if (!options.includes(currentNote)) { options[0] = currentNote; options = shuffle(options); }

  const grid = document.createElement('div');
  grid.className = 'pitch-choices';

  options.forEach(note => {
    const btn = document.createElement('button');
    btn.className   = 'pitch-choice-btn';
    btn.textContent = NOTE_DISPLAY[note] || note;
    btn.onclick     = () => checkPitchAnswer(note, btn, grid);
    grid.appendChild(btn);
  });

  area.appendChild(grid);
}

// ─── Type Input ───────────────────────────────────────────────────────────────

function buildPitchTypeInput(area) {
  const row = document.createElement('div');
  row.className = 'type-input-row';

  const inp = document.createElement('input');
  inp.type         = 'text';
  inp.className    = 'type-input';
  inp.id           = 'ptTypeInput';
  inp.placeholder  = 'e.g.  C  or  F#  or  Bb';
  inp.autocomplete = 'off';
  inp.onkeydown    = e => { if (e.key === 'Enter') checkPitchType(); };

  const btn = document.createElement('button');
  btn.className   = 'submit-btn';
  btn.textContent = 'CHECK';
  btn.onclick     = checkPitchType;

  row.appendChild(inp);
  row.appendChild(btn);
  area.appendChild(row);

  if (currentDiff !== 'natural') {
    const toolbar = document.createElement('div');
    toolbar.className = 'symbol-toolbar';
    const lbl = document.createElement('span');
    lbl.className = 'symbol-toolbar-label';
    lbl.textContent = 'Insert:';
    toolbar.appendChild(lbl);
    [{ char:'#', label:'Sharp' }, { char:'b', label:'Flat (♭)' }].forEach(({ char, label }) => {
      const s = document.createElement('button');
      s.className = 'sym-btn';
      s.type      = 'button';
      s.innerHTML = `${char}<span class="sym-tooltip">${label}</span>`;
      s.onclick   = () => {
        inp.focus();
        const start = inp.selectionStart, end = inp.selectionEnd;
        inp.value = inp.value.slice(0, start) + char + inp.value.slice(end);
        inp.setSelectionRange(start + 1, start + 1);
      };
      toolbar.appendChild(s);
    });
    area.appendChild(toolbar);
  }

  setTimeout(() => inp.focus(), 50);
}

// ─── Answer Checking ──────────────────────────────────────────────────────────

function checkPitchAnswer(chosen, btn, grid) {
  if (ptAnswered) return;
  ptAnswered = true;
  ptTotal++;

  const isCorrect = chosen === currentNote;

  if (isCorrect) {
    ptScore++; ptStreak++;
    btn.classList.add('correct');
    document.getElementById('ptCard').className = 'quiz-card correct';
  } else {
    ptStreak = 0;
    btn.classList.add('wrong');
    document.getElementById('ptCard').className = 'quiz-card wrong';
    document.getElementById('ptCard').classList.add('shake');
    setTimeout(() => document.getElementById('ptCard').classList.remove('shake'), 400);
    grid.querySelectorAll('.pitch-choice-btn').forEach(b => {
      if ((NOTE_DISPLAY[currentNote] || currentNote) === b.textContent.trim()) b.classList.add('correct');
    });
  }

  grid.querySelectorAll('.pitch-choice-btn').forEach(b => b.disabled = true);
  finishQuestion(isCorrect);
}

function checkPitchType() {
  if (ptAnswered) return;
  const inp = document.getElementById('ptTypeInput');
  const val = inp.value.trim();
  if (!val) return;

  ptAnswered = true;
  ptTotal++;

  const isCorrect = normalizePitchAnswer(val) === normalizePitchAnswer(currentNote);
  inp.classList.add(isCorrect ? 'correct' : 'wrong');
  inp.disabled = true;

  if (isCorrect) {
    ptScore++; ptStreak++;
    document.getElementById('ptCard').className = 'quiz-card correct';
  } else {
    ptStreak = 0;
    document.getElementById('ptCard').className = 'quiz-card wrong';
    document.getElementById('ptCard').classList.add('shake');
    setTimeout(() => document.getElementById('ptCard').classList.remove('shake'), 400);
  }

  finishQuestion(isCorrect);
}

function finishQuestion(isCorrect) {
  showPitchFeedback(isCorrect);
  updatePitchScore();
  showResultPiano();
  if (currentTrainMode === 'sequence') revealMysteryBubble();
  document.getElementById('ptNextBtn').className = 'next-btn show';
  // Enable the top Next button if present
  const topNext = document.getElementById('ptNextBtnTop');
  if (topNext) { topNext.style.opacity = '1'; topNext.style.pointerEvents = 'auto'; }
  // Scroll smoothly to the bottom so piano + Next Note button are visible
  setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 150);
}

function revealMysteryBubble() {
  const bubble = document.getElementById(`seq-bubble-${seqRefNotes.length}`);
  if (!bubble) return;
  bubble.textContent = NOTE_DISPLAY[currentNote] || currentNote;
  bubble.classList.remove('mystery');
  bubble.classList.add('mystery-played');
  Object.assign(bubble.style, {
    background: 'var(--accent)', borderColor: 'var(--accent)',
    color: '#000', borderStyle: 'solid',
  });
}

// ─── Feedback / Score / Piano ─────────────────────────────────────────────────

function normalizePitchAnswer(str) {
  const F2S = { 'db':'C#','eb':'D#','fb':'E','gb':'F#','ab':'G#','bb':'A#','cb':'B' };
  const c = str.trim().toLowerCase().replace(/\s/g, '');
  return F2S[c] ? F2S[c] : c;
}

function showPitchFeedback(correct) {
  const fb = document.getElementById('ptFeedback');
  fb.className = 'feedback show ' + (correct ? 'correct' : 'wrong');
  const display = NOTE_DISPLAY[currentNote] || currentNote;
  document.getElementById('ptFeedbackAnswer').textContent =
    correct ? `✓ Correct! The note was ${display}` : `✗ The note was ${display}`;
  let expl = `Octave ${currentOctave}  ·  ${BLACK_KEY_NOTES.has(currentNote) ? 'Black key' : 'White key'}`;
  if (currentTrainMode === 'sequence') expl += `  ·  ${seqRootNote} major scale`;
  document.getElementById('ptFeedbackExpl').textContent = expl;
}

function showResultPiano() {
  document.getElementById('resultPianoWrap').className = 'result-piano-wrap show';
  document.getElementById('resultPianoSVG').innerHTML  = buildPitchPianoSVG(currentNote);
}

function updatePitchScore() {
  document.getElementById('ptScoreVal').textContent  = ptScore;
  document.getElementById('ptTotalVal').textContent  = ptTotal;
  document.getElementById('ptStreakVal').textContent = ptStreak;
  document.getElementById('ptAccVal').textContent    =
    ptTotal > 0 ? Math.round((ptScore / ptTotal) * 100) + '%' : '—';
}

function buildPitchPianoSVG(highlightNote) {
  const WHITE_NOTES = ['C','D','E','F','G','A','B','C','D','E','F','G','A','B'];
  const WHITE_OCTAVES = [4,4,4,4,4,4,4,5,5,5,5,5,5,5];
  const BLACK_KEYS  = [
    {pos:0,note:'C#',oct:4},{pos:1,note:'D#',oct:4},{pos:3,note:'F#',oct:4},{pos:4,note:'G#',oct:4},{pos:5,note:'A#',oct:4},
    {pos:7,note:'C#',oct:5},{pos:8,note:'D#',oct:5},{pos:10,note:'F#',oct:5},{pos:11,note:'G#',oct:5},{pos:12,note:'A#',oct:5},
  ];
  const F2S = { 'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B' };
  const norm = F2S[highlightNote] || highlightNote;
  const W = 28, WH = 90, BW = 18, BH = 56, totalW = WHITE_NOTES.length * W;
  let svg = `<svg class="pitch-piano-svg" viewBox="0 0 ${totalW} ${WH}" xmlns="http://www.w3.org/2000/svg" style="cursor:pointer;">`;

  // White keys
  WHITE_NOTES.forEach((note, i) => {
    const lit = note === norm;
    const oct = WHITE_OCTAVES[i];
    const hover = `onmouseenter="this.setAttribute('fill','${lit ? '#ffd700' : '#ddd8cf'}')" onmouseleave="this.setAttribute('fill','${lit ? '#f5c842' : '#f0ede6'}')"`;
    svg += `<rect x="${i*W}" y="0" width="${W-1}" height="${WH}"
      fill="${lit ? '#f5c842' : '#f0ede6'}" stroke="#555" stroke-width="1" rx="2"
      style="cursor:pointer" onclick="pitchPianoPlayNote('${note}',${oct})" ${hover}/>`;
    if (lit) svg += `<text x="${i*W+W/2}" y="${WH-8}" text-anchor="middle"
      font-size="8" font-family="IBM Plex Mono,monospace" font-weight="600" fill="#000"
      style="pointer-events:none">${note}</text>`;
  });

  // Black keys
  BLACK_KEYS.forEach(({pos, note, oct}) => {
    const lit = note === norm;
    const x   = pos * W + W - BW / 2;
    const hover = `onmouseenter="this.setAttribute('fill','${lit ? '#ffd700' : '#333'}')" onmouseleave="this.setAttribute('fill','${lit ? '#f5c842' : '#1a1a1a'}')"`;
    svg += `<rect x="${x}" y="0" width="${BW}" height="${BH}"
      fill="${lit ? '#f5c842' : '#1a1a1a'}" stroke="#000" stroke-width="1" rx="2"
      style="cursor:pointer" onclick="pitchPianoPlayNote('${note}',${oct})" ${hover}/>`;
    if (lit) svg += `<text x="${x+BW/2}" y="${BH-5}" text-anchor="middle"
      font-size="7" font-family="IBM Plex Mono,monospace" font-weight="600" fill="#000"
      style="pointer-events:none">${note}</text>`;
  });

  svg += '</svg>';
  return svg;
}

// Called by onclick on SVG piano keys in the result piano
async function pitchPianoPlayNote(note, octave) {
  await Tone.start();
  getPitchSynth().triggerAttackRelease(note + octave, '4n');
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

newPitchQuestion();
