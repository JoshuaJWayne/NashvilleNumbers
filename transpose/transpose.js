// ─── Data ────────────────────────────────────────────────────────────────────

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

const CHORD_QUALITY  = ['maj','min','min','maj','maj','min','dim'];
const NUMERAL_LABELS = ['1','2','3','4','5','6','7'];
const NUMERAL_ROMAN  = ['I','ii','iii','IV','V','vi','vii°'];

const ALL_KEY_NAMES  = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
// Display labels (some keys have enharmonic aliases)
const KEY_DISPLAY    = {
  'C':'C','Db':'C#/Db','D':'D','Eb':'Eb','E':'E',
  'F':'F','F#':'F#/Gb','G':'G','Ab':'Ab','A':'A','Bb':'Bb','B':'B'
};

const CHROMATIC  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const ENHARMONIC = { 'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B' };

// All chromatic chords that can appear outside the diatonic scale
const CHROMATIC_CHORDS = [
  // Common borrowed / passing chords
  { label:'bVII', quality:'maj' },
  { label:'bIII', quality:'maj' },
  { label:'bVI',  quality:'maj' },
  { label:'II',   quality:'maj' },   // secondary dominant setup
  { label:'III',  quality:'maj' },
  { label:'VI',   quality:'maj' },
];

// ─── State ────────────────────────────────────────────────────────────────────

let sourceKey      = 'G';           // currently selected source key
let targetKey      = null;          // transposition target key
let progression    = [];            // array of { degreeIndex, chordName, isChromatic, chromaticNote }
let showChromatic  = false;
let dragSrcIndex   = null;
let synth          = null;
let isPlayingProg  = false;

// ─── Audio ────────────────────────────────────────────────────────────────────

function getSynth() {
  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 1.2, sustain: 0.0, release: 1.5 },
      volume: -6,
    }).toDestination();
  }
  return synth;
}

function noteToIndex(note) {
  return CHROMATIC.indexOf(ENHARMONIC[note] || note);
}

function chordToNotes(chordName, baseOctave = 4) {
  let root, quality;
  if (chordName.endsWith('°')) { root = chordName.slice(0,-1); quality = 'dim'; }
  else if (chordName.endsWith('m')) { root = chordName.slice(0,-1); quality = 'min'; }
  else { root = chordName; quality = 'maj'; }

  const rootIdx = noteToIndex(root);
  if (rootIdx === -1) return [];

  const intervals = quality === 'maj' ? [0,4,7] : quality === 'min' ? [0,3,7] : [0,3,6];
  return intervals.map(interval => {
    const semitone = rootIdx + interval;
    return CHROMATIC[semitone % 12] + (baseOctave + Math.floor(semitone / 12));
  });
}

function octaveForDegree(key, degreeIndex) {
  const keyRootIdx    = noteToIndex(key);
  const degreeNoteRaw = getKeyNotes(key)[degreeIndex];
  const degreeIdx     = noteToIndex(degreeNoteRaw);
  return degreeIdx < keyRootIdx ? 5 : 4;
}

async function playSingleChord(chordName, octave = 4, btn = null) {
  await Tone.start();
  const notes = chordToNotes(chordName, octave);
  if (!notes.length) return;
  if (btn) {
    btn.classList.add('playing');
    setTimeout(() => btn.classList.remove('playing'), 1500);
  }
  getSynth().triggerAttackRelease(notes, '2n');
}

async function playFullProgression() {
  if (isPlayingProg || !progression.length) return;
  await Tone.start();
  isPlayingProg = true;

  const btn = document.getElementById('playProgressionBtn');
  btn.classList.add('playing');
  btn.textContent = '♪ Playing…';

  const now    = Tone.now();
  const gap    = 1.0; // seconds between chords
  const piano  = getSynth();

  progression.forEach((item, i) => {
    const octave = item.isChromatic ? 4 : octaveForDegree(sourceKey, item.degreeIndex);
    const notes  = chordToNotes(item.chordName, octave);
    if (notes.length) {
      piano.triggerAttackRelease(notes, '2n', now + i * gap);
    }
  });

  const totalDuration = progression.length * gap * 1000 + 1200;
  setTimeout(() => {
    isPlayingProg = false;
    btn.classList.remove('playing');
    btn.textContent = '♪ Play Progression';
  }, totalDuration);
}

// ─── Key / Scale helpers ──────────────────────────────────────────────────────

function getKeyNotes(key) {
  return MAJOR_SCALE[key] || [];
}

function getChordName(key, degreeIndex) {
  const notes = getKeyNotes(key);
  if (!notes.length) return '?';
  const note = notes[degreeIndex];
  const q    = CHORD_QUALITY[degreeIndex];
  if (q === 'maj') return note;
  if (q === 'min') return note + 'm';
  return note + '°';
}

// Given a chord's degreeIndex and source key, return the chord name in targetKey
function transposeChord(item, toKey) {
  if (item.isChromatic) {
    // For chromatic chords, transpose the root note chromatically
    const srcRootIdx = noteToIndex(item.chromaticNote);
    const srcKeyIdx  = noteToIndex(ENHARMONIC[sourceKey] || sourceKey);
    const tgtKeyIdx  = noteToIndex(ENHARMONIC[toKey] || toKey);
    const interval   = (srcRootIdx - srcKeyIdx + 12) % 12;
    const newRootIdx = (tgtKeyIdx + interval) % 12;
    const newRoot    = CHROMATIC[newRootIdx];
    if (item.chordName.endsWith('m')) return newRoot + 'm';
    if (item.chordName.endsWith('°')) return newRoot + '°';
    return newRoot;
  }
  return getChordName(toKey, item.degreeIndex);
}

// ─── Palette Builder ──────────────────────────────────────────────────────────

function buildPalette() {
  const palette = document.getElementById('chordPalette');
  palette.innerHTML = '';

  // Diatonic chords
  const dLabel = document.createElement('div');
  dLabel.className   = 'palette-section-label';
  dLabel.textContent = 'Diatonic chords';
  palette.appendChild(dLabel);

  getKeyNotes(sourceKey).forEach((note, i) => {
    const chordName = getChordName(sourceKey, i);
    const btn = document.createElement('button');
    btn.className = 'palette-btn';
    btn.dataset.degree = i;
    btn.innerHTML = `
      <span class="pb-number">${NUMERAL_ROMAN[i]}</span>
      <span>${chordName}</span>
    `;
    btn.onclick = () => addChord({ degreeIndex: i, chordName, isChromatic: false });
    palette.appendChild(btn);
  });

  // Chromatic toggle button
  const showBtn = document.createElement('button');
  showBtn.className   = 'show-chromatic-btn';
  showBtn.id          = 'showChromaticBtn';
  showBtn.textContent = showChromatic ? '− Hide chromatic chords' : '+ Show chromatic chords';
  showBtn.onclick     = () => { showChromatic = !showChromatic; buildPalette(); };
  palette.appendChild(showBtn);

  if (showChromatic) {
    const cLabel = document.createElement('div');
    cLabel.className   = 'palette-section-label';
    cLabel.textContent = 'Chromatic / borrowed chords';
    palette.appendChild(cLabel);

    // Build chromatic chords relative to the current key
    const keyIdx = noteToIndex(ENHARMONIC[sourceKey] || sourceKey);
    const FLAT_INTERVALS = { 'bVII':10, 'bIII':3, 'bVI':8, 'II':2, 'III':4, 'VI':9 };
    Object.entries(FLAT_INTERVALS).forEach(([label, semitones]) => {
      const rootIdx   = (keyIdx + semitones) % 12;
      const rootName  = CHROMATIC[rootIdx];
      // Check it's not already a diatonic chord
      const diatonic  = getKeyNotes(sourceKey).some(n => (ENHARMONIC[n] || n) === rootName);
      if (diatonic) return;

      const chordName = rootName; // major by default for borrowed chords
      const btn = document.createElement('button');
      btn.className = 'palette-btn chromatic';
      btn.innerHTML = `
        <span class="pb-number">${label}</span>
        <span>${chordName}</span>
      `;
      btn.onclick = () => addChord({
        degreeIndex: -1,
        chordName,
        isChromatic: true,
        chromaticNote: rootName,
        chromaticLabel: label,
      });
      palette.appendChild(btn);
    });
  }
}

// ─── Progression Management ───────────────────────────────────────────────────

function addChord(item) {
  progression.push({ ...item, id: Date.now() + Math.random() });
  renderProgression();
  renderOutput();
}

function removeChord(id) {
  progression = progression.filter(p => p.id !== id);
  renderProgression();
  renderOutput();
}

function clearProgression() {
  progression = [];
  renderProgression();
  renderOutput();
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────────

function onDragStart(e, index) {
  dragSrcIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.target.classList.add('dragging'), 0);
}

function onDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.prog-slot').forEach(s => s.classList.remove('drag-over'));
}

function onDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.prog-slot').forEach(s => s.classList.remove('drag-over'));
  if (index !== dragSrcIndex) {
    document.querySelectorAll('.prog-slot')[index]?.classList.add('drag-over');
  }
}

function onDrop(e, index) {
  e.preventDefault();
  if (dragSrcIndex === null || dragSrcIndex === index) return;
  const moved = progression.splice(dragSrcIndex, 1)[0];
  progression.splice(index, 0, moved);
  dragSrcIndex = null;
  renderProgression();
  renderOutput();
}

// ─── Render Progression Slots ─────────────────────────────────────────────────

function renderProgression() {
  const wrap = document.getElementById('progressionSlots');
  const hint = document.getElementById('emptyHint');
  wrap.innerHTML = '';

  if (!progression.length) {
    wrap.appendChild(hint || (() => {
      const h = document.createElement('div');
      h.className = 'prog-empty-hint';
      h.id = 'emptyHint';
      h.textContent = 'No chords yet — click chords above to add them';
      return h;
    })());
    document.getElementById('playProgressionBtn').disabled = true;
    return;
  }

  document.getElementById('playProgressionBtn').disabled = false;

  progression.forEach((item, i) => {
    const slot = document.createElement('div');
    slot.className   = 'prog-slot';
    slot.draggable   = true;
    slot.ondragstart = e => onDragStart(e, i);
    slot.ondragend   = onDragEnd;
    slot.ondragover  = e => onDragOver(e, i);
    slot.ondrop      = e => onDrop(e, i);

    const numLabel = item.isChromatic
      ? (item.chromaticLabel || '?')
      : NUMERAL_ROMAN[item.degreeIndex];

    slot.innerHTML = `
      <button class="slot-remove" onclick="removeChord(${item.id})">✕</button>
      <span class="slot-number">${numLabel}</span>
      <span class="slot-chord">${item.chordName}</span>
      <button class="slot-play-btn" onclick="playSingleChord('${item.chordName}', ${item.isChromatic ? 4 : octaveForDegree(sourceKey, item.degreeIndex)}, this)">♪</button>
    `;

    wrap.appendChild(slot);
  });
}

// ─── Render Output ────────────────────────────────────────────────────────────

function renderOutput() {
  const output = document.getElementById('tpOutput');

  if (!progression.length) {
    output.classList.remove('show');
    return;
  }

  output.classList.add('show');

  // Source key & chords
  document.getElementById('outSourceKey').innerHTML =
    `<span class="ov-key">${sourceKey}</span>`;

  const chordsHTML = progression.map(item =>
    `<span>${item.chordName}</span><span class="ov-sep">–</span>`
  ).join('').replace(/<span class="ov-sep">–<\/span>$/, '');
  document.getElementById('outChords').innerHTML = chordsHTML;

  const numbersHTML = progression.map(item => {
    const num = item.isChromatic
      ? `<span style="color:var(--muted)">${item.chromaticLabel || '?'}</span>`
      : `<span class="ov-number">${NUMERAL_LABELS[item.degreeIndex]}</span>`;
    return num + '<span class="ov-sep">–</span>';
  }).join('').replace(/<span class="ov-sep">–<\/span>$/, '');
  document.getElementById('outNumbers').innerHTML = numbersHTML;

  // Chord diagrams for source key
  renderDiagrams('chordDiagramStrip', progression.map(item => ({
    label: item.chordName,
    chord: item.chordName,
  })));

  // Transposed output if a target key is selected
  if (targetKey) renderTransposed();
}

function renderDiagrams(containerId, items) {
  const strip = document.getElementById(containerId);
  strip.innerHTML = '';
  items.forEach(({ label, chord }) => {
    const wrap = document.createElement('div');
    wrap.className = 'chord-diagram-item';
    wrap.innerHTML = `
      <span class="chord-diagram-label">${label}</span>
      ${buildMiniPianoSVG(chord)}
    `;
    strip.appendChild(wrap);
  });
}

function renderTransposed() {
  if (!targetKey || !progression.length) return;

  document.getElementById('transposedOutput').style.display = 'block';
  document.getElementById('outTargetKey').innerHTML =
    `<span class="ov-key">${targetKey}</span>`;

  const transposedChords = progression.map(item => transposeChord(item, targetKey));
  const transHTML = transposedChords.map(c =>
    `<span>${c}</span><span class="ov-sep">–</span>`
  ).join('').replace(/<span class="ov-sep">–<\/span>$/, '');
  document.getElementById('outTransposedChords').innerHTML = transHTML;

  renderDiagrams('transposedDiagramStrip', transposedChords.map(c => ({ label: c, chord: c })));
}

// ─── Mini Piano SVG ───────────────────────────────────────────────────────────

function chordNoteNames(chordName) {
  let root, quality;
  if (chordName.endsWith('°')) { root = chordName.slice(0,-1); quality = 'dim'; }
  else if (chordName.endsWith('m')) { root = chordName.slice(0,-1); quality = 'min'; }
  else { root = chordName; quality = 'maj'; }
  const rootIdx = noteToIndex(root);
  if (rootIdx === -1) return new Set();
  const intervals = quality === 'maj' ? [0,4,7] : quality === 'min' ? [0,3,7] : [0,3,6];
  return new Set(intervals.map(i => CHROMATIC[(rootIdx + i) % 12]));
}

function buildMiniPianoSVG(chordName) {
  const highlighted = chordNoteNames(chordName);

  const WHITE_NOTES = ['C','D','E','F','G','A','B'];
  const BLACK_KEYS  = [
    {pos:0,note:'C#'},{pos:1,note:'D#'},
    {pos:3,note:'F#'},{pos:4,note:'G#'},{pos:5,note:'A#'},
  ];

  const W = 16, WH = 52, BW = 11, BH = 32;
  const totalW = WHITE_NOTES.length * W;

  let svg = `<svg class="chord-mini-svg" viewBox="0 0 ${totalW} ${WH}" xmlns="http://www.w3.org/2000/svg">`;

  WHITE_NOTES.forEach((note, i) => {
    const isLit = highlighted.has(note);
    svg += `<rect x="${i*W}" y="0" width="${W-1}" height="${WH}"
      fill="${isLit ? '#f5c842' : '#f0ede6'}" stroke="#555" stroke-width="1" rx="1"/>`;
    if (isLit) {
      svg += `<text x="${i*W + W/2}" y="${WH-5}" text-anchor="middle"
        font-size="6" font-family="IBM Plex Mono,monospace" font-weight="600" fill="#000">${note}</text>`;
    }
  });

  BLACK_KEYS.forEach(({pos, note}) => {
    const isLit = highlighted.has(note);
    const x = pos * W + W - BW / 2;
    svg += `<rect x="${x}" y="0" width="${BW}" height="${BH}"
      fill="${isLit ? '#f5c842' : '#1a1a1a'}" stroke="#000" stroke-width="1" rx="1"/>`;
    if (isLit) {
      svg += `<text x="${x + BW/2}" y="${BH-4}" text-anchor="middle"
        font-size="5" font-family="IBM Plex Mono,monospace" font-weight="600" fill="#000">${note.replace('#','♯')}</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

// ─── Key Grid Builder ─────────────────────────────────────────────────────────

function buildKeyGrid(containerId, activeKey, onSelect) {
  const grid = document.getElementById(containerId);
  grid.innerHTML = '';
  ALL_KEY_NAMES.forEach(k => {
    const btn = document.createElement('button');
    btn.className   = 'key-btn' + (k === activeKey ? ' active' : '');
    btn.textContent = KEY_DISPLAY[k] || k;
    btn.onclick     = () => {
      grid.querySelectorAll('.key-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(k);
    };
    grid.appendChild(btn);
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

function init() {
  // Source key grid
  buildKeyGrid('sourceKeyGrid', sourceKey, k => {
    sourceKey = k;
    targetKey = null;
    // Remap existing progression degrees to new key
    progression = progression.map(item => {
      if (item.isChromatic) return item;
      return { ...item, chordName: getChordName(k, item.degreeIndex) };
    });
    buildPalette();
    renderProgression();
    renderOutput();
    // Rebuild target key grid with new source
    buildKeyGrid('targetKeyGrid', null, k2 => {
      targetKey = k2;
      renderTransposed();
    });
    document.getElementById('transposedOutput').style.display = 'none';
  });

  buildPalette();
  renderProgression();

  // Target key grid (transpose section)
  buildKeyGrid('targetKeyGrid', null, k => {
    targetKey = k;
    renderTransposed();
  });
}

init();
