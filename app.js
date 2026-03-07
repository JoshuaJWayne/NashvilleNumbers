// ─── Data ────────────────────────────────────────────────────────────────────

const ALL_KEYS = ['C','C#/Db','D','Eb','E','F','F#/Gb','G','Ab','A','Bb','B'];

const MAJOR_SCALE = {
  'C':  ['C','D','E','F','G','A','B'],
  'C#': ['C#','D#','F','F#','G#','A#','C'],
  'Db': ['Db','Eb','F','Gb','Ab','Bb','C'],
  'D':  ['D','E','F#','G','A','B','C#'],
  'Eb': ['Eb','F','G','Ab','Bb','C','D'],
  'E':  ['E','F#','G#','A','B','C#','D#'],
  'F':  ['F','G','A','Bb','C','D','E'],
  'F#': ['F#','G#','A#','B','C#','D#','F'],
  'Gb': ['Gb','Ab','Bb','Cb','Db','Eb','F'],
  'G':  ['G','A','B','C','D','E','F#'],
  'Ab': ['Ab','Bb','C','Db','Eb','F','G'],
  'A':  ['A','B','C#','D','E','F#','G#'],
  'Bb': ['Bb','C','D','Eb','F','G','A'],
  'B':  ['B','C#','D#','E','F#','G#','A#'],
};

// Chord quality per scale degree (major key)
const CHORD_QUALITY  = ['maj','min','min','maj','maj','min','dim'];
const NUMERAL_LABELS = ['1','2','3','4','5','6','7'];
const NUMERAL_ROMAN  = ['I','ii','iii','IV','V','vi','vii°'];

function getKeyNotes(key) {
  const base = key.split('/')[0];
  return MAJOR_SCALE[base] || MAJOR_SCALE[key];
}

function getChordName(key, degreeIndex) {
  const notes = getKeyNotes(key);
  if (!notes) return '?';
  const note = notes[degreeIndex];
  const q    = CHORD_QUALITY[degreeIndex];
  if (q === 'maj') return note;
  if (q === 'min') return note + 'm';
  if (q === 'dim') return note + '°';
}

// ─── State ───────────────────────────────────────────────────────────────────

let score = 0, total = 0, streak = 0, qNum = 0;
let currentAnswer = '';
let answered = false;
let activeMode = 'numbers-to-chords';
let activeKeys = ['C','D','G','A','E','F'];
let currentQ   = null;

// ─── Init ────────────────────────────────────────────────────────────────────

function buildKeyToggles() {
  const wrap = document.getElementById('keyToggles');
  wrap.innerHTML = '';
  ALL_KEYS.forEach(k => {
    const base = k.split('/')[0];
    const btn  = document.createElement('button');
    btn.className = 'key-toggle' + (activeKeys.includes(base) ? ' active' : '');
    btn.textContent = base;
    btn.onclick = () => {
      if (activeKeys.includes(base)) {
        if (activeKeys.length > 1) {
          activeKeys = activeKeys.filter(x => x !== base);
          btn.classList.remove('active');
        }
      } else {
        activeKeys.push(base);
        btn.classList.add('active');
      }
      newQuestion();
    };
    wrap.appendChild(btn);
  });
}

function setMode(m) {
  activeMode = m;
  ['n2c','c2n','mixed'].forEach(id => document.getElementById('tab-' + id).classList.remove('active'));
  const map = { 'numbers-to-chords': 'n2c', 'chords-to-numbers': 'c2n', 'mixed': 'mixed' };
  document.getElementById('tab-' + map[m]).classList.add('active');
  newQuestion();
}

// ─── Question Generation ──────────────────────────────────────────────────────

function randomKey() {
  return activeKeys[Math.floor(Math.random() * activeKeys.length)];
}

function randomProgression(length) {
  const len = length === 'random'
    ? [1,2,3,4][Math.floor(Math.random() * 4)]
    : parseInt(length);
  const prog = [];
  for (let i = 0; i < len; i++) {
    prog.push(Math.floor(Math.random() * 7));
  }
  return prog;
}

function generateQuestion() {
  const key      = randomKey();
  const lenSetting = document.getElementById('progLength').value;
  const prog     = randomProgression(lenSetting);

  let direction;
  if (activeMode === 'mixed') {
    direction = Math.random() < 0.5 ? 'n2c' : 'c2n';
  } else if (activeMode === 'numbers-to-chords') {
    direction = 'n2c';
  } else {
    direction = 'c2n';
  }

  const numberLabels = prog.map(i => NUMERAL_LABELS[i]);
  const chordNames   = prog.map(i => getChordName(key, i));
  const romanLabels  = prog.map(i => NUMERAL_ROMAN[i]);

  if (direction === 'n2c') {
    return {
      direction,
      key,
      prog,
      question:      `What chords are <span class="numbers">${numberLabels.join(' – ')}</span> in the key of <span class="key-badge">${key}</span>?`,
      questionPlain: `${numberLabels.join(' – ')} in key of ${key}`,
      answer:        chordNames.join(' – '),
      hint:          `Roman: ${romanLabels.join(' – ')}`,
      wrongAnswers:  generateWrongAnswers(chordNames.join(' – '), prog, key, 'n2c'),
    };
  } else {
    return {
      direction,
      key,
      prog,
      question:      `What numbers are <span class="numbers">${chordNames.join(' – ')}</span> in the key of <span class="key-badge">${key}</span>?`,
      questionPlain: `${chordNames.join(' – ')} in key of ${key}`,
      answer:        numberLabels.join(' – '),
      hint:          `Roman: ${romanLabels.join(' – ')}`,
      wrongAnswers:  generateWrongAnswers(numberLabels.join(' – '), prog, key, 'c2n'),
    };
  }
}

function generateWrongAnswers(correctAnswer, prog, key, direction) {
  const wrong    = new Set();
  const attempts = 50;

  for (let i = 0; i < attempts && wrong.size < 3; i++) {
    const fakeProg = prog.map(d => {
      const offset = (Math.random() < 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1);
      return Math.max(0, Math.min(6, d + offset));
    });
    let ans;
    if (direction === 'n2c') {
      ans = fakeProg.map(i => getChordName(key, i)).join(' – ');
    } else {
      ans = fakeProg.map(i => NUMERAL_LABELS[i]).join(' – ');
    }
    if (ans !== correctAnswer) wrong.add(ans);
  }

  const allKeysList = Object.keys(MAJOR_SCALE);
  while (wrong.size < 3) {
    const rk = allKeysList[Math.floor(Math.random() * allKeysList.length)];
    let ans;
    if (direction === 'n2c') {
      ans = prog.map(i => getChordName(rk, i)).join(' – ');
    } else {
      const fakeProg2 = prog.map(d => Math.max(0, Math.min(6, d + Math.floor(Math.random() * 3) + 1)));
      ans = fakeProg2.map(i => NUMERAL_LABELS[i]).join(' – ');
    }
    if (ans !== correctAnswer) wrong.add(ans);
  }

  return [...wrong].slice(0, 3);
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function newQuestion() {
  answered = false;
  qNum++;
  currentQ      = generateQuestion();
  currentAnswer = currentQ.answer;

  document.getElementById('qType').textContent =
    currentQ.direction === 'n2c' ? 'NUMBERS → CHORDS' : 'CHORDS → NUMBERS';
  document.getElementById('qCount').textContent = `Q ${qNum}`;

  document.getElementById('qText').textContent =
    currentQ.direction === 'n2c'
      ? 'What chords make up this progression?'
      : 'What Nashville numbers represent these chords?';
  document.getElementById('qMain').innerHTML = currentQ.question;
  document.getElementById('hintRow').textContent = '';

  document.getElementById('feedback').className = 'feedback';
  document.getElementById('nextBtn').className   = 'next-btn';
  document.getElementById('quizCard').className  = 'quiz-card';

  const style = document.getElementById('answerStyle').value;
  const area  = document.getElementById('answerArea');
  area.innerHTML = '';

  if (style === 'multiple') {
    buildMultipleChoice(area);
  } else {
    buildTypeInput(area);
  }

  const pct = Math.min((score / Math.max(total, 1)) * 100, 100);
  document.getElementById('progressBar').style.width = pct + '%';

  document.getElementById('quizCard').classList.add('pop');
  setTimeout(() => document.getElementById('quizCard').classList.remove('pop'), 300);
}

function buildMultipleChoice(area) {
  const all  = shuffle([currentQ.answer, ...currentQ.wrongAnswers]);
  const grid = document.createElement('div');
  grid.className = 'choices-grid';
  const letters = ['A','B','C','D'];
  all.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span class="choice-letter">${letters[idx]}</span>${opt}`;
    btn.onclick   = () => checkMultiple(opt, btn, grid);
    grid.appendChild(btn);
  });
  area.appendChild(grid);
}

function checkMultiple(chosen, btn, grid) {
  if (answered) return;
  answered = true;
  total++;

  const isCorrect = chosen === currentQ.answer;
  if (isCorrect) {
    score++;
    streak++;
    btn.classList.add('correct');
    document.getElementById('quizCard').className = 'quiz-card correct';
    showFeedback(true, currentQ.answer, currentQ.hint);
  } else {
    streak = 0;
    btn.classList.add('wrong');
    document.getElementById('quizCard').className = 'quiz-card wrong';
    document.getElementById('quizCard').classList.add('shake');
    setTimeout(() => document.getElementById('quizCard').classList.remove('shake'), 400);
    grid.querySelectorAll('.choice-btn').forEach(b => {
      if (b.textContent.slice(1).trim() === currentQ.answer) {
        b.classList.add('correct');
      }
    });
    showFeedback(false, currentQ.answer, currentQ.hint);
  }

  grid.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
  updateScore();
  document.getElementById('nextBtn').className = 'next-btn show';
}

function buildTypeInput(area) {
  const row = document.createElement('div');
  row.className = 'type-input-row';

  const inp = document.createElement('input');
  inp.type        = 'text';
  inp.className   = 'type-input';
  inp.id          = 'typeInput';
  inp.placeholder = currentQ.direction === 'n2c' ? 'e.g.  C – Am – F – G' : 'e.g.  1 – 6 – 4 – 5';
  inp.autocomplete = 'off';
  inp.onkeydown   = e => { if (e.key === 'Enter') checkType(); };

  const btn = document.createElement('button');
  btn.className   = 'submit-btn';
  btn.textContent = 'CHECK';
  btn.onclick     = checkType;

  row.appendChild(inp);
  row.appendChild(btn);
  area.appendChild(row);

  // Symbol toolbar — only for chords direction
  if (currentQ.direction === 'n2c') {
    const symbols = [
      { char: '°',   label: 'Diminished', highlight: true },
      { char: 'm',   label: 'Minor' },
      { char: '#',   label: 'Sharp' },
      { char: 'b',   label: 'Flat (♭)' },
      { char: ' – ', label: 'Separator' },
    ];

    const toolbar = document.createElement('div');
    toolbar.className = 'symbol-toolbar';

    const lbl = document.createElement('span');
    lbl.className   = 'symbol-toolbar-label';
    lbl.textContent = 'Insert:';
    toolbar.appendChild(lbl);

    symbols.forEach(({ char, label, highlight }) => {
      const s = document.createElement('button');
      s.className = 'sym-btn' + (highlight ? ' sym-highlight' : '');
      s.innerHTML = `${char === ' – ' ? '–' : char}<span class="sym-tooltip">${label}</span>`;
      s.type      = 'button';
      s.onclick   = () => insertAtCursor(inp, char);
      toolbar.appendChild(s);
    });

    area.appendChild(toolbar);
  }

  const hint = document.createElement('div');
  hint.className = 'hint-row';
  hint.innerHTML = '<span style="color:var(--accent);cursor:pointer;" onclick="showHint()">💡 Show hint</span>';
  area.appendChild(hint);

  setTimeout(() => inp.focus(), 50);
}

function insertAtCursor(input, text) {
  input.focus();
  const start   = input.selectionStart;
  const end     = input.selectionEnd;
  const current = input.value;
  input.value   = current.slice(0, start) + text + current.slice(end);
  const newPos  = start + text.length;
  input.setSelectionRange(newPos, newPos);
}

function showHint() {
  document.getElementById('hintRow').textContent = currentQ.hint;
}

function normalizeAnswer(str) {
  return str.toLowerCase()
    .replace(/maj/g, '')
    .replace(/major/g, '')
    .replace(/minor/g, 'm')
    .trim()
    .replace(/\s*[–\-,/]+\s*/g, '|')  // dashes, commas, slashes → |
    .replace(/\s+/g, '|')              // remaining spaces → |
    .replace(/\|+/g, '|')              // collapse any double separators
    .replace(/^\||\|$/g, '');          // trim leading/trailing |
}

function checkType() {
  if (answered) return;
  const inp = document.getElementById('typeInput');
  const val = inp.value.trim();
  if (!val) return;

  answered = true;
  total++;

  const normVal   = normalizeAnswer(val);
  const normAns   = normalizeAnswer(currentQ.answer);
  const isCorrect = normVal === normAns;

  inp.classList.add(isCorrect ? 'correct' : 'wrong');
  inp.disabled = true;

  if (isCorrect) {
    score++;
    streak++;
    document.getElementById('quizCard').className = 'quiz-card correct';
    showFeedback(true, currentQ.answer, currentQ.hint);
  } else {
    streak = 0;
    document.getElementById('quizCard').className = 'quiz-card wrong';
    document.getElementById('quizCard').classList.add('shake');
    setTimeout(() => document.getElementById('quizCard').classList.remove('shake'), 400);
    showFeedback(false, currentQ.answer, currentQ.hint);
  }

  updateScore();
  document.getElementById('nextBtn').className = 'next-btn show';
}

function showFeedback(correct, answer, hint) {
  const fb = document.getElementById('feedback');
  fb.className = 'feedback show ' + (correct ? 'correct' : 'wrong');
  document.getElementById('feedbackAnswer').textContent =
    correct ? '✓ Correct! ' + answer : '✗ Correct answer: ' + answer;
  document.getElementById('feedbackExpl').textContent = hint;
}

function updateScore() {
  document.getElementById('scoreVal').textContent   = score;
  document.getElementById('totalVal').textContent   = total;
  document.getElementById('streakVal').textContent  = streak;
  const acc = total > 0 ? Math.round((score / total) * 100) + '%' : '—';
  document.getElementById('accuracyVal').textContent = acc;
}

// ─── Audio Engine ─────────────────────────────────────────────────────────────

const CHROMATIC  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENHARMONIC = {
  'Db':'C#', 'Eb':'D#', 'Fb':'E',
  'Gb':'F#', 'Ab':'G#', 'Bb':'A#', 'Cb':'B'
};

function noteToIndex(note) {
  return CHROMATIC.indexOf(ENHARMONIC[note] || note);
}

// Build notes for a chord, rooted at the given baseOctave.
// baseOctave rises across the scale so degree 1 is lowest, degree 7 is highest.
function chordToNotes(chordName, baseOctave = 4) {
  let root, quality;
  if (chordName.endsWith('°')) {
    root = chordName.slice(0, -1); quality = 'dim';
  } else if (chordName.endsWith('m')) {
    root = chordName.slice(0, -1); quality = 'min';
  } else {
    root = chordName; quality = 'maj';
  }

  const rootIdx = noteToIndex(root);
  if (rootIdx === -1) return [];

  // semitone intervals per quality
  const intervals = quality === 'maj' ? [0, 4, 7]
                  : quality === 'min' ? [0, 3, 7]
                  :                     [0, 3, 6];

  return intervals.map(interval => {
    const semitone = rootIdx + interval;
    const noteIdx  = semitone % 12;
    const octave   = baseOctave + Math.floor(semitone / 12);
    return CHROMATIC[noteIdx] + octave;
  });
}

// Calculate which octave a scale degree should be rooted in so that
// degrees 1–7 always ascend in pitch within the key.
// Strategy: start key root at octave 4; each degree that is chromatically
// lower than the key root gets bumped up one octave.
function octaveForDegree(keyRoot, degreeIndex) {
  const keyRootIdx    = noteToIndex(keyRoot);
  const degreeRootRaw = getKeyNotes(keyRoot)[degreeIndex];
  const degreeRootIdx = noteToIndex(degreeRootRaw);

  // If the degree note sits below the key root on the chromatic scale
  // it has "wrapped around" and must live in the next octave
  return degreeRootIdx < keyRootIdx ? 5 : 4;
}

// Lazily created synth — only instantiated after first user gesture
let synth = null;

function getSynth() {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack:  0.005,  // instant strike like a piano hammer
        decay:   1.2,    // long natural decay
        sustain: 0.0,    // no sustain — pure decay like a real piano
        release: 1.5,    // tail after note ends
      },
      volume: -6,
    }).toDestination();
  }
  return synth;
}

// chordName: e.g. "Em", "F#", "B°"
// btn: the ♪ button element for visual feedback (optional)
// baseOctave: pass explicitly from buildRefChart for correct low→high order
async function playChord(chordName, btn, baseOctave = 4) {
  await Tone.start();
  const notes = chordToNotes(chordName, baseOctave);
  if (!notes.length) return;

  if (btn) {
    btn.classList.add('playing');
    setTimeout(() => btn.classList.remove('playing'), 1500);
  }

  const piano = getSynth();
  piano.triggerAttackRelease(notes, '2n');
}

// ─── Reference Chart ──────────────────────────────────────────────────────────

function buildRefChart() {
  const keys = ['C','D','E','F','G','A','B','Bb','Eb','Ab','Db','F#'];
  let html = '<table class="ref-table"><thead><tr><th>Key</th>';
  for (let d = 0; d < 7; d++) {
    html += `<th>${NUMERAL_LABELS[d]} (${NUMERAL_ROMAN[d]})</th>`;
  }
  html += '</tr></thead><tbody>';

  keys.forEach(k => {
    html += `<tr><td class="row-key">${k}</td>`;
    for (let d = 0; d < 7; d++) {
      const chord  = getChordName(k, d);
      const octave = octaveForDegree(k, d);
      // Pass the octave as a data attribute so the inline onclick can use it
      html += `<td>
        <span class="ref-chord-name">${chord}</span>
        <button class="ref-play-btn"
          onclick="playChord('${chord}', this, ${octave})"
          title="Play ${chord}">♪</button>
      </td>`;
    }
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById('refTable').innerHTML = html;
}

function toggleRef() {
  document.getElementById('refTable').classList.toggle('show');
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

buildKeyToggles();
buildRefChart();
newQuestion();
