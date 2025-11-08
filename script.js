// Multi-question Would You Rather UI built from JavaScript
// Loads questions from `questions.json` if available and merges with user-added questions stored in localStorage.

const DEFAULT_QUESTIONS = [
  { title: 'WOULD YOU RATHER', left: 'Always use 17-in-1 shampoo', right: 'Never use shampoo again' },
  { title: 'WOULD YOU RATHER', left: 'Only shower in motor oil permanently', right: 'Never shower again' },
  { title: 'WOULD YOU RATHER', left: 'Only shower in the morning', right: 'Only shower at night' },
  { title: 'WOULD YOU RATHER', left: 'Forced to shower less than 5 minutes a day', right: 'Forced to shower more than an hour a day' },
  { title: 'WOULD YOU RATHER', left: 'Never use conditioner again', right: 'Never use body wash again' },
  { title: 'WOULD YOU RATHER', left: 'Never sing in the shower again', right: 'Every time you sing everyone in the house can hear you' },
];

const CUSTOM_KEY = 'wyr_custom_questions_v1';
const DEFAULTS_KEY = 'wyr_defaults_v1';

function loadSavedDefaults() {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch (e) { return []; }
}

function saveSavedDefaults(arr) {
  try {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(arr));
  } catch (e) {}
}

function createNode(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('aria-')) el.setAttribute(k, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el[k] = v;
  });
  children.flat().forEach(ch => {
    if (ch == null) return;
    if (typeof ch === 'string') el.appendChild(document.createTextNode(ch));
    else el.appendChild(ch);
  });
  return el;
}

async function fetchExternalQuestions() {
  try {
    const res = await fetch('questions.json');
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter(q => q && (q.left || q.right));
  } catch (e) {
    return [];
  }
}

function loadCustomQuestions() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch (e) {
    return [];
  }
}

function saveCustomQuestion(q) {
  const arr = loadCustomQuestions();
  arr.push(q);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr));
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeApp(root, questions) {
  // elements
  const titleEl = createNode('h1', { class: 'title' }, '');

  const leftBtn = createNode('button', { class: 'choice left', 'aria-pressed': 'false', tabindex: 0, dataset: { choice: 'left' } },
    createNode('div', { class: 'choice-inner' }, createNode('span', { class: 'choice-text' }, ''))
  );

  const rightBtn = createNode('button', { class: 'choice right', 'aria-pressed': 'false', tabindex: 0, dataset: { choice: 'right' } },
    createNode('div', { class: 'choice-inner' }, createNode('span', { class: 'choice-text' }, ''))
  );

  const orBubble = createNode('div', { class: 'or-bubble', 'aria-hidden': 'true' }, 'OR');
  const card = createNode('section', { class: 'wyr-card', role: 'group', 'aria-label': 'Would you rather choices' }, leftBtn, orBubble, rightBtn);
  const info = createNode('div', { class: 'info', 'aria-live': 'polite' });

  // controls: randomize (starts a 3-round game)
  const controls = createNode('div', { class: 'controls' });
  const randomBtn = createNode('button', { class: 'btn random' }, 'Random');
  controls.appendChild(randomBtn);

  root.appendChild(titleEl);
  root.appendChild(card);
  root.appendChild(controls);
  root.appendChild(info);

  // add checkmark elements
  [leftBtn, rightBtn].forEach(btn => {
    const chk = createNode('div', { class: 'check' }, '✓');
    btn.appendChild(chk);
  });

  // state
  let allQuestions = questions.slice();
  const choices = [leftBtn, rightBtn];
  let currentQuestion = null;
  let inGame = false;
  const roundsTotal = 3;
  let roundsPlayed = 0;
  const stats = { left: 0, right: 0 };
  let availableQuestions = [];
  function pickAndRemoveRandom(arr) {
    if (!arr || arr.length === 0) return null;
    const i = Math.floor(Math.random() * arr.length);
    return arr.splice(i, 1)[0];
  }
  let roundsHistory = [];

  function renderQuestion(q) {
    if (!q) return;
    currentQuestion = q;
    titleEl.textContent = q.title || 'WOULD YOU RATHER';
    leftBtn.querySelector('.choice-text').textContent = q.left || '';
    rightBtn.querySelector('.choice-text').textContent = q.right || '';
    clearSelected();
  }

  function clearSelected() {
    choices.forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-pressed', 'false');
    });
    info.textContent = '';
  }

  function select(btn) {
    const already = btn.classList.contains('selected');
    clearSelected();
    if (!already) {
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      const text = btn.querySelector('.choice-text').textContent.trim();
      info.textContent = `You selected: "${text}"`;

      // if in a game, record the choice and advance
      if (inGame) {
  const side = btn.classList.contains('left') ? 'left' : 'right';
  stats[side]++;
  roundsPlayed++;
  // record the choice for the summary
  const chosenText = side === 'left' ? (currentQuestion.left || '') : (currentQuestion.right || '');
  roundsHistory.push({ question: currentQuestion, side, text: chosenText });
        // update button label to show progress
        randomBtn.textContent = `Round ${roundsPlayed} / ${roundsTotal}`;
        // advance after short delay
        if (roundsPlayed < roundsTotal) {
          setTimeout(() => {
            // pick from availableQuestions (no repeats within game)
            let nextQ = pickAndRemoveRandom(availableQuestions);
            if (!nextQ) {
              // refill availableQuestions if empty (avoid immediate repeat)
              availableQuestions = allQuestions.slice();
              // remove currentQuestion if present
              const idxCur = availableQuestions.findIndex(q => q === currentQuestion);
              if (idxCur !== -1) availableQuestions.splice(idxCur, 1);
              nextQ = pickAndRemoveRandom(availableQuestions) || pickRandom(allQuestions);
            }
            renderQuestion(nextQ);
            randomBtn.textContent = `Round ${roundsPlayed + 1} / ${roundsTotal}`;
          }, 700);
        } else {
          // finish game
          setTimeout(() => finishGame(), 700);
        }
      }
    }
  }

  choices.forEach(btn => {
    btn.addEventListener('click', () => select(btn));
    btn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(btn);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    const focused = document.activeElement;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const idx = choices.indexOf(focused);
      if (idx === -1) return;
      const next = e.key === 'ArrowLeft' ? Math.max(0, idx - 1) : Math.min(choices.length - 1, idx + 1);
      choices[next].focus();
    } else if (e.key === 'Escape') {
      clearSelected();
    }
  });

  // randomize / start game behavior: start a 3-round session
  function startGame() {
    if (!allQuestions.length) return;
    if (inGame) return; // ignore while playing
    // reset stats and start
    inGame = true;
    roundsPlayed = 0;
    stats.left = 0; stats.right = 0;
    roundsHistory = [];
    randomBtn.disabled = true; // prevent double clicks while setting up
    // prepare availableQuestions (avoid repeats within a game)
    availableQuestions = allQuestions.slice();
    const first = pickAndRemoveRandom(availableQuestions) || pickRandom(allQuestions);
    renderQuestion(first);
    roundsPlayed = 0;
    randomBtn.textContent = `Round 1 / ${roundsTotal}`;
    randomBtn.disabled = false;
  }

  randomBtn.addEventListener('click', startGame);

  
  // (add-new UI removed) — game flow handled via Random and rounds

  // finish game helper
  function finishGame() {
    inGame = false;
    // show summary and reset button text
    const lines = [];
    lines.push(`<strong>Game over — Results: Left: ${stats.left}, Right: ${stats.right}</strong>`);
    lines.push('<div class="summary"><p>You chose:</p><ol>');
    roundsHistory.forEach((r) => {
      const label = r.side === 'left' ? 'Left' : 'Right';
      lines.push(`<li>${escapeHtml(r.text)} <small>(${label})</small></li>`);
    });
    lines.push('</ol></div>');
    info.innerHTML = lines.join('\n');
    randomBtn.textContent = 'Random';
  }

  // start a single 3-round game on load (no Random click required)
  startGame();

  return {
    renderQuestion,
    addQuestion(q) { allQuestions.push(q); }
  };
}

// initialize
const root = document.getElementById('app-root');
async function init() {
  // Use only the embedded DEFAULT_QUESTIONS (ignore questions.json and any saved/custom lists)
  const combined = DEFAULT_QUESTIONS.slice();
  makeApp(root, combined);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
