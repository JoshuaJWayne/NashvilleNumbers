// ─── Note Data ────────────────────────────────────────────────────────────────

const NATURAL_NOTES = ['C','D','E','F','G','A','B'];
const SHARP_NOTES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ALL_NOTES     = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Display names — sharps shown as e.g. "C# / Db"
const NOTE_DISPLAY = {
  'C':'C', 'C#':'C# / Db', 'D':'D', 'D#':'D# / Eb',
  'E':'E', 'F':'F', 'F#':'F# / Gb', 'G':'G',
  'G#':'G# / Ab', 'A':'A', 'A#':'A# / Bb', 'B':'B',
};

// Which notes are "black keys"
const BLACK_KEY_NOTES = new Set(['C#','D#','F#','G#','A#']);

// ─── State ────────────────────────────────────────────────────────────────────

let ptScore    = 0;
let ptTotal    = 0;
let ptStreak   = 0;
let ptQNum     = 0;
let ptAnswered = false;
let currentNote     = null;   // e.g. 'C#'
let currentOctave   = 4;
let currentDiff     = 'natural';
let currentAnsMode  = 'multiple';
let pitchSynth      = null;

// ─── Synth ────────────────────────────────────────────────────────────────────

function getPitchSynth() {
  if (!pitchSynth) {
    pitchSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: {
        attack:  0.005,
        decay:   1.4,
        sustain: 0.0,
        release: 1.8,
      },
      volume: -4,
    }).toDestination();
  }
  return pitchSynth;
}

async function playNote(note, octave) {
  await Tone.start();
  const synth = getPitchSynth();
  synth.triggerAttackRelease(note + octave, '2n');
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function setDifficulty(diff, btn) {
  currentDiff = diff;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
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

// ─── Question Generation ──────────────────────────────────────────────────────

function newPitchQuestion() {
  ptAnswered = false;
  ptQNum++;

  const pool   = getNotePool();
  const octaves = getOctavePool();

  currentNote   = pool[Math.floor(Math.random() * pool.length)];
  currentOctave = octaves[Math.floor(Math.random() * octaves.length)];

  // Update meta
  document.getElementById('ptQCount').textContent = `Q ${ptQNum}`;
  document.getElementById('ptQType').textContent  = 'IDENTIFY THE NOTE';

  // Clear feedback & result piano
  document.getElementById('ptFeedback').className    = 'feedback';
  document.getElementById('ptNextBtn').className     = 'next-btn';
  document.getElementById('ptCard').className        = 'quiz-card';
  document.getElementById('resultPianoWrap').className = 'result-piano-wrap';
  document.getElementById('resultPianoSVG').innerHTML  = '';

  // Update progress bar
  const pct = Math.min((ptScore / Math.max(ptTotal, 1)) * 100, 100);
  document.getElementById('ptProgressBar').style.width = pct + '%';

  // Reset play button
  const playBtn = document.getElementById('playNoteBtn');
  playBtn.classList.remove('playing');
  document.getElementById('playBtnLabel').textContent = 'Play Note';

  // Build answer area
  const area = document.getElementById('ptAnswerArea');
  area.innerHTML = '';

  if (currentAnsMode === 'multiple') {
    buildPitchMultipleChoice(area);
  } else {
    buildPitchTypeInput(area);
  }

  // Auto-play the note after a short delay
  setTimeout(() => replayNote(), 400);

  // Pop animation
  document.getElementById('ptCard').classList.add('pop');
  setTimeout(() => document.getElementById('ptCard').classList.remove('pop'), 300);
}

// ─── Play / Replay ────────────────────────────────────────────────────────────

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

// ─── Multiple Choice ──────────────────────────────────────────────────────────

function buildPitchMultipleChoice(area) {
  const pool    = getNotePool();
  const wrong   = generateWrongNotes(currentNote, pool, 5);
  const options = shuffle([currentNote, ...wrong]).slice(0, 6);

  // Always include the correct answer
  if (!options.includes(currentNote)) {
    options[0] = currentNote;
    shuffle(options);
  }

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

function generateWrongNotes(correct, pool, count) {
  const others = pool.filter(n => n !== correct);
  return shuffle(others).slice(0, count);
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

  // Symbol helper for sharps/flats
  if (currentDiff !== 'natural') {
    const toolbar = document.createElement('div');
    toolbar.className = 'symbol-toolbar';

    const lbl = document.createElement('span');
    lbl.className   = 'symbol-toolbar-label';
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
    ptScore++;
    ptStreak++;
    btn.classList.add('correct');
    document.getElementById('ptCard').className = 'quiz-card correct';
    showPitchFeedback(true);
  } else {
    ptStreak = 0;
    btn.classList.add('wrong');
    document.getElementById('ptCard').className = 'quiz-card wrong';
    document.getElementById('ptCard').classList.add('shake');
    setTimeout(() => document.getElementById('ptCard').classList.remove('shake'), 400);
    // Highlight the correct answer
    grid.querySelectorAll('.pitch-choice-btn').forEach(b => {
      if ((NOTE_DISPLAY[currentNote] || currentNote) === b.textContent.trim()) {
        b.classList.add('correct');
      }
    });
    showPitchFeedback(false);
  }

  grid.querySelectorAll('.pitch-choice-btn').forEach(b => b.disabled = true);
  updatePitchScore();
  showResultPiano();
  document.getElementById('ptNextBtn').className = 'next-btn show';
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
    ptScore++;
    ptStreak++;
    document.getElementById('ptCard').className = 'quiz-card correct';
    showPitchFeedback(true);
  } else {
    ptStreak = 0;
    document.getElementById('ptCard').className = 'quiz-card wrong';
    document.getElementById('ptCard').classList.add('shake');
    setTimeout(() => document.getElementById('ptCard').classList.remove('shake'), 400);
    showPitchFeedback(false);
  }

  updatePitchScore();
  showResultPiano();
  document.getElementById('ptNextBtn').className = 'next-btn show';
}

// Normalize: uppercase, treat 'b' suffix as flat → map to sharp equivalent
function normalizePitchAnswer(str) {
  const FLAT_TO_SHARP = {
    'db':'C#','eb':'D#','fb':'E','gb':'F#','ab':'G#','bb':'A#','cb':'B'
  };
  const cleaned = str.trim().toLowerCase().replace(/\s/g, '');
  if (FLAT_TO_SHARP[cleaned]) return FLAT_TO_SHARP[cleaned].toLowerCase();
  return cleaned;
}

function showPitchFeedback(correct) {
  const fb = document.getElementById('ptFeedback');
  fb.className = 'feedback show ' + (correct ? 'correct' : 'wrong');
  const displayName = NOTE_DISPLAY[currentNote] || currentNote;
  document.getElementById('ptFeedbackAnswer').textContent =
    correct
      ? `✓ Correct! The note was ${displayName}`
      : `✗ The note was ${displayName}`;
  document.getElementById('ptFeedbackExpl').textContent =
    `Octave ${currentOctave}  ·  ${BLACK_KEY_NOTES.has(currentNote) ? 'Black key' : 'White key'}`;
}

// ─── Result Piano ─────────────────────────────────────────────────────────────

function showResultPiano() {
  const wrap = document.getElementById('resultPianoWrap');
  wrap.className = 'result-piano-wrap show';
  document.getElementById('resultPianoSVG').innerHTML = buildPitchPianoSVG(currentNote);
}

// 2-octave piano SVG highlighting a single note name across both octaves
function buildPitchPianoSVG(highlightNote) {
  const CHROMATIC   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const WHITE_NOTES = ['C','D','E','F','G','A','B','C','D','E','F','G','A','B'];
  const BLACK_KEYS  = [
    {pos:0,note:'C#'},{pos:1,note:'D#'},
    {pos:3,note:'F#'},{pos:4,note:'G#'},{pos:5,note:'A#'},
    {pos:7,note:'C#'},{pos:8,note:'D#'},
    {pos:10,note:'F#'},{pos:11,note:'G#'},{pos:12,note:'A#'},
  ];

  // Normalize highlight note to sharp name
  const FLAT_TO_SHARP = {
    'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B'
  };
  const normHighlight = FLAT_TO_SHARP[highlightNote] || highlightNote;

  const W  = 28, WH = 90, BW = 18, BH = 56;
  const totalW = WHITE_NOTES.length * W;

  let svg = `<svg class="pitch-piano-svg" viewBox="0 0 ${totalW} ${WH}" xmlns="http://www.w3.org/2000/svg">`;

  // White keys
  WHITE_NOTES.forEach((note, i) => {
    const isLit  = note === normHighlight;
    const fill   = isLit ? '#f5c842' : '#f0ede6';
    svg += `<rect x="${i*W}" y="0" width="${W-1}" height="${WH}"
      fill="${fill}" stroke="#555" stroke-width="1" rx="2"/>`;
    if (isLit) {
      svg += `<text x="${i*W + W/2}" y="${WH-8}" text-anchor="middle"
        font-size="8" font-family="IBM Plex Mono, monospace"
        font-weight="600" fill="#000">${note}</text>`;
    }
  });

  // Black keys
  BLACK_KEYS.forEach(({pos, note}) => {
    const isLit = note === normHighlight;
    const fill  = isLit ? '#f5c842' : '#1a1a1a';
    const x     = pos * W + W - BW / 2;
    svg += `<rect x="${x}" y="0" width="${BW}" height="${BH}"
      fill="${fill}" stroke="#000" stroke-width="1" rx="2"/>`;
    if (isLit) {
      svg += `<text x="${x + BW/2}" y="${BH-5}" text-anchor="middle"
        font-size="7" font-family="IBM Plex Mono, monospace"
        font-weight="600" fill="#000">${note}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

// ─── Score ────────────────────────────────────────────────────────────────────

function updatePitchScore() {
  document.getElementById('ptScoreVal').textContent  = ptScore;
  document.getElementById('ptTotalVal').textContent  = ptTotal;
  document.getElementById('ptStreakVal').textContent = ptStreak;
  const acc = ptTotal > 0 ? Math.round((ptScore / ptTotal) * 100) + '%' : '—';
  document.getElementById('ptAccVal').textContent    = acc;
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
