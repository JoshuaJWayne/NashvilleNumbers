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
  const key        = randomKey();
  const lenSetting = document.getElementById('progLength').value;
  const prog       = randomProgression(lenSetting);
  const isSingle   = prog.length === 1;

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
    const verb = isSingle ? 'What chord is' : 'What chords are';
    return {
      direction,
      key,
      prog,
      question:      `${verb} <span class="numbers">${numberLabels.join(' – ')}</span> in the key of <span class="key-badge">${key}</span>?`,
      questionPlain: `${numberLabels.join(' – ')} in key of ${key}`,
      answer:        chordNames.join(' – '),
      hint:          `Roman: ${romanLabels.join(' – ')}`,
      wrongAnswers:  generateWrongAnswers(chordNames.join(' – '), prog, key, 'n2c'),
    };
  } else {
    const verb = isSingle ? 'What number is' : 'What numbers are';
    return {
      direction,
      key,
      prog,
      question:      `${verb} <span class="numbers">${chordNames.join(' – ')}</span> in the key of <span class="key-badge">${key}</span>?`,
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

  const isSingle = document.getElementById('progLength').value === '1';
  document.getElementById('qText').textContent =
    currentQ.direction === 'n2c'
      ? (isSingle ? 'What chord makes up this progression?' : 'What chords make up this progression?')
      : (isSingle ? 'What Nashville number represents this chord?' : 'What Nashville numbers represent these chords?');
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

// ─── Piano Keyboard Renderer ──────────────────────────────────────────────────

// Returns the set of chromatic note names (without octave) that are in the chord
function chordNoteNames(chordName) {
  let root, quality;
  if (chordName.endsWith('°')) {
    root = chordName.slice(0, -1); quality = 'dim';
  } else if (chordName.endsWith('m')) {
    root = chordName.slice(0, -1); quality = 'min';
  } else {
    root = chordName; quality = 'maj';
  }
  const rootIdx  = noteToIndex(root);
  if (rootIdx === -1) return new Set();
  const intervals = quality === 'maj' ? [0,4,7] : quality === 'min' ? [0,3,7] : [0,3,6];
  return new Set(intervals.map(i => CHROMATIC[(rootIdx + i) % 12]));
}

// Draws a 2-octave SVG piano keyboard with chord tones highlighted in gold.
// Starts from C4 through B5. Highlighted keys are clickable and play their note.
function buildPianoSVG(chordName) {
  const highlighted = chordNoteNames(chordName);

  // White key note names across 2 octaves — track octave per position
  const WHITE_NOTES = [
    {note:'C',oct:4},{note:'D',oct:4},{note:'E',oct:4},{note:'F',oct:4},{note:'G',oct:4},{note:'A',oct:4},{note:'B',oct:4},
    {note:'C',oct:5},{note:'D',oct:5},{note:'E',oct:5},{note:'F',oct:5},{note:'G',oct:5},{note:'A',oct:5},{note:'B',oct:5},
  ];

  const BLACK_PATTERN = [
    {pos:0,note:'C#'},{pos:1,note:'D#'},
    {pos:3,note:'F#'},{pos:4,note:'G#'},{pos:5,note:'A#'},
  ];
  const BLACK_KEYS = [
    ...BLACK_PATTERN.map(b => ({pos:b.pos,   note:b.note, oct:4})),
    ...BLACK_PATTERN.map(b => ({pos:b.pos+7, note:b.note, oct:5})),
  ];

  const W  = 28, WH = 90, BW = 18, BH = 56;
  const totalW = WHITE_NOTES.length * W;

  let svg = `<svg class="piano-svg" viewBox="0 0 ${totalW} ${WH}" xmlns="http://www.w3.org/2000/svg" style="cursor:default;">`;

  // White keys
  WHITE_NOTES.forEach(({note, oct}, i) => {
    const isLit  = highlighted.has(note);
    const fill   = isLit ? '#f5c842' : '#f0ede6';
    const cursor = isLit ? 'pointer' : 'default';
    const click  = isLit ? `onclick="playSingleNote('${note}${oct}')"` : '';
    const hover  = isLit ? `onmouseenter="this.setAttribute('fill','#ffd700')" onmouseleave="this.setAttribute('fill','#f5c842')"` : '';
    svg += `<rect x="${i*W}" y="0" width="${W-1}" height="${WH}"
      fill="${fill}" stroke="#555" stroke-width="1" rx="2"
      style="cursor:${cursor}" ${click} ${hover}/>`;
    if (isLit) {
      svg += `<text x="${i*W + W/2}" y="${WH-8}" text-anchor="middle"
        font-size="8" font-family="IBM Plex Mono, monospace" font-weight="600"
        fill="#000" style="pointer-events:none">${note}</text>`;
    }
  });

  // Black keys (drawn on top)
  BLACK_KEYS.forEach(({pos, note, oct}) => {
    const isLit  = highlighted.has(note);
    const fill   = isLit ? '#f5c842' : '#1a1a1a';
    const cursor = isLit ? 'pointer' : 'default';
    const click  = isLit ? `onclick="playSingleNote('${note}${oct}')"` : '';
    const hover  = isLit ? `onmouseenter="this.setAttribute('fill','#ffd700')" onmouseleave="this.setAttribute('fill','#f5c842')"` : '';
    const x      = pos * W + W - BW / 2;
    svg += `<rect x="${x}" y="0" width="${BW}" height="${BH}"
      fill="${fill}" stroke="#000" stroke-width="1" rx="2"
      style="cursor:${cursor}" ${click} ${hover}/>`;
    if (isLit) {
      svg += `<text x="${x+BW/2}" y="${BH-5}" text-anchor="middle"
        font-size="7" font-family="IBM Plex Mono, monospace" font-weight="600"
        fill="#000" style="pointer-events:none">${note}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

// Play a single note by its full pitch string e.g. "C#4", "G5"
async function playSingleNote(pitch) {
  await Tone.start();
  const piano = getSynth();
  piano.triggerAttackRelease(pitch, '4n');
}

// Track which chord panel is currently open (key_degree string)
let openChordPanel = null;

function toggleChordPanel(key, degree, chordName, btnEl) {
  const panelId = `cp-${key}-${degree}`;
  const rowId   = `cr-${key}-${degree}`;

  // If this panel is already open, close it
  if (openChordPanel === panelId) {
    document.getElementById(rowId).remove();
    openChordPanel = null;
    btnEl.classList.remove('active');
    return;
  }

  // Close any other open panel first
  if (openChordPanel) {
    const old = document.getElementById(openChordPanel.replace('cp-','cr-'));
    if (old) old.remove();
    document.querySelectorAll('.ref-piano-btn.active').forEach(b => b.classList.remove('active'));
  }

  openChordPanel = panelId;
  btnEl.classList.add('active');

  // Find the table row this button lives in and insert a new row after it
  const parentRow = btnEl.closest('tr');
  const colSpan   = 8; // Key col + 7 degree cols

  const newRow = document.createElement('tr');
  newRow.id = rowId;
  newRow.className = 'chord-panel-row';
  newRow.innerHTML = `
    <td colspan="${colSpan}">
      <div class="chord-panel" id="${panelId}">
        <div class="chord-panel-header">
          <span class="chord-panel-title">${chordName}</span>
          <span class="chord-panel-notes">${[...chordNoteNames(chordName)].join(' · ')}</span>
          <button class="chord-panel-close" onclick="toggleChordPanel('${key}',${degree},'${chordName}',document.querySelector('[data-panel=\\'${key}-${degree}\\']'))">✕</button>
        </div>
        <div class="chord-panel-keyboard">
          ${buildPianoSVG(chordName)}
        </div>
      </div>
    </td>`;

  parentRow.insertAdjacentElement('afterend', newRow);
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
    html += `<tr>`;
    html += `<td class="row-key">${k}</td>`;
    for (let d = 0; d < 7; d++) {
      const chord  = getChordName(k, d);
      const octave = octaveForDegree(k, d);
      html += `<td>
        <span class="ref-chord-name">${chord}</span>
        <div class="ref-btn-group">
          <button class="ref-play-btn"
            onclick="playChord('${chord}', this, ${octave})"
            title="Play ${chord}">♪</button>
          <button class="ref-piano-btn"
            data-panel="${k}-${d}"
            onclick="toggleChordPanel('${k}', ${d}, '${chord}', this)"
            title="Show chord on keyboard">🎹</button>
        </div>
      </td>`;
    }
    html += `</tr>`;
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
