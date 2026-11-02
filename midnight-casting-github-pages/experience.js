import { AXES, CHARACTERS, QUESTIONS, QUIZ_VERSION } from './quiz-data.js';
import { decodeAnswers, encodeAnswers, scoreAnswers, selectedClues, validateAnswers } from './scoring.js';
import { PORTRAITS } from './portraits.js';

const STORAGE_KEY = 'midnight-casting-progress';
const characterById = id => CHARACTERS.find(character => character.id === id);
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function blankState() { return {version: QUIZ_VERSION, index: 0, answers: Array(QUESTIONS.length).fill(null), view: 'home'}; }
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version !== QUIZ_VERSION || !Array.isArray(saved.answers) || saved.answers.length !== QUESTIONS.length || !saved.answers.every(a => a === null || /^[ABCD]$/.test(a))) return blankState();
    return {...saved, index: Math.max(0, Math.min(31, Number.isInteger(saved.index) ? saved.index : 0)), view: ['home', 'quiz', 'result'].includes(saved.view) ? saved.view : 'home'};
  } catch { return blankState(); }
}
function svgNode(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}
function coordinates(radius, i, centerX = 170, centerY = 166) {
  const angle = -Math.PI / 2 + Math.PI / 3 * i;
  return [centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius];
}
function radarChart(scores) {
  const svg = svgNode('svg', {viewBox: '0 0 340 340', role: 'img', 'aria-label': AXES.map((axis, i) => `${axis} ${scores[i]}`).join('，'), class: 'radar-svg'});
  const points = radius => AXES.map((_, i) => coordinates(radius, i).join(',')).join(' ');
  [20, 40, 60, 80, 100].forEach(value => svg.append(svgNode('polygon', {points: points(110 * value / 100), fill: 'none', stroke: '#4c3c32', 'stroke-width': .8})));
  AXES.forEach((axis, i) => {
    const [x, y] = coordinates(110, i);
    svg.append(svgNode('line', {x1: 170, y1: 166, x2: x, y2: y, stroke: '#4c3c32', 'stroke-width': .8}));
    const [labelX, labelY] = coordinates(139, i);
    const text = svgNode('text', {x: labelX, y: labelY, 'text-anchor': 'middle', fill: '#d3c4b1', 'font-size': 12});
    text.textContent = axis;
    const value = svgNode('tspan', {x: labelX, dy: 16, fill: '#a98b73', 'font-size': 10});
    value.textContent = String(scores[i]); text.append(value); svg.append(text);
  });
  const actual = scores.map((value, i) => coordinates(110 * value / 100, i));
  svg.append(svgNode('polygon', {points: actual.map(point => point.join(',')).join(' '), fill: '#b9584140', stroke: '#cc785d', 'stroke-width': 1.5, 'data-radar': scores.join(',')}));
  actual.forEach(([cx, cy]) => svg.append(svgNode('circle', {cx, cy, r: 2.7, fill: '#e3b69a'})));
  return svg;
}

export function mountExperience() {
  let state = loadState();
  let sharedAnswers = null;
  let activeAnswers = null;
  let activeResult = null;
  let lastFocused = null;
  let toastTimer;
  const main = document.querySelector('#main');
  const footer = document.querySelector('.site-footer');
  const homeSections = [...main.children];
  homeSections.forEach(section => { section.dataset.screen = 'home'; });
  const quiz = element('section', 'quiz-view');
  quiz.dataset.screen = 'quiz'; quiz.hidden = true;
  quiz.innerHTML = `
    <div class="screen-topline"><span>MIDNIGHT SCREENING</span><button type="button" class="quiet-button" id="leave-quiz">暂时离席 ↗</button></div>
    <div class="quiz-progress" role="progressbar" aria-label="放映进度" aria-valuemin="0" aria-valuemax="32" aria-valuenow="0"><span></span></div>
    <div class="scene-number"><span id="scene-count"></span><span id="scene-act"></span></div>
    <article class="scene-frame" aria-labelledby="scene-title"><span class="frame-corner" aria-hidden="true"></span><p class="scene-kicker" id="scene-kicker"></p><h2 id="scene-title" tabindex="-1"></h2><div id="scene-body" class="scene-body"></div></article>
    <fieldset class="scene-choices"><legend class="sr-only">选择你最接近的反应</legend><div id="choice-list"></div></fieldset>
    <div class="quiz-navigation"><button id="previous-scene" class="quiet-button" type="button">↙ 上一场</button><button id="next-scene" class="cream-button" type="button" disabled>下一场 <span aria-hidden="true">↗</span></button></div>
    <p class="progress-note" id="progress-note">随时可以回看，进度会留在当前浏览器。</p>`;
  const resultView = element('section', 'result-view'); resultView.dataset.screen = 'result'; resultView.hidden = true;
  resultView.innerHTML = `
    <div class="screen-topline"><span>THE FINAL CAST</span><button type="button" id="result-home" class="quiet-button">返回首页 ↗</button></div>
    <div id="shared-notice" class="shared-notice" hidden>你正在观看一份分享的选角结果。<button type="button" id="take-own-test">开始我的选角 ↗</button></div>
    <article class="casting-poster"><p class="section-eyebrow">MIDNIGHT CASTING / 本场选角</p><div class="poster-index" id="result-number" aria-hidden="true"></div><h2 id="result-name" tabindex="-1"></h2><p class="result-film" id="result-film"></p><blockquote id="result-quote" hidden></blockquote><div class="poster-bottom"><span>ONE SEAT. ONE ROLE.</span><span>00:00</span></div></article>
    <nav class="result-jumps" aria-label="结果页快捷跳转"><a href="#portrait-heading">人物主文 <span aria-hidden="true">↓</span></a><a href="#radar-heading">六维图 <span aria-hidden="true">↓</span></a><a href="#second-cast">第二选角 <span aria-hidden="true">↓</span></a></nav>
    <section class="portrait-section" aria-labelledby="portrait-heading"><p class="section-eyebrow" id="portrait-heading">CHARACTER PORTRAIT / 角色肖像</p><div class="portrait-text" id="portrait-text"></div></section>
    <section class="result-section" aria-labelledby="radar-heading"><p class="section-eyebrow">SIX DIMENSIONS / 你的六维</p><h3 id="radar-heading">银幕留下的轮廓。</h3><figure class="radar-figure"><div id="radar-chart"></div><figcaption>由这次的 32 个选择绘出。</figcaption></figure><dl id="axis-values" class="axis-values"></dl></section>
    <section class="result-section" id="casting-notes-section" hidden><p class="section-eyebrow">CASTING NOTES / 选角解读</p><div id="casting-notes" class="portrait-text"></div></section>
    <section class="result-section" aria-labelledby="clue-heading"><p class="section-eyebrow">YOUR CHOICES / 选角线索</p><h3 id="clue-heading"></h3><div id="result-clues"></div></section>
    <section class="second-cast result-section" id="second-cast"><p class="section-eyebrow">SECOND CAST / 第二选角</p><h3 id="second-name"></h3><p id="second-film"></p></section>
    <div class="result-actions"><button class="cream-button" id="copy-result" type="button">复制结果链接 <span aria-hidden="true">↗</span></button><button class="outline-button" id="save-card" type="button">保存选角卡 <span aria-hidden="true">↓</span></button><button class="quiet-button retake-button" id="retake-test" type="button">重新选角 ↻</button></div>
    <p class="result-footnote">角色解读仅供趣味探索。六维来自本次选择。</p>`;
  main.append(quiz, resultView);
  const toast = element('div', 'toast'); toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); toast.hidden = true; document.body.append(toast);
  const resetDialog = element('dialog', 'cinema-dialog reset-dialog');
  resetDialog.setAttribute('aria-labelledby', 'reset-heading');
  resetDialog.innerHTML = '<div class="dialog-content"><p class="section-eyebrow">ANOTHER SCREENING</p><h2 id="reset-heading">再看一场？</h2><p class="reset-copy">这会清除当前浏览器里的答题进度。</p><div class="reset-actions"><button class="outline-button" id="cancel-reset" type="button">保留这次</button><button class="cream-button" id="confirm-reset" type="button">重新入场 ↗</button></div></div>';
  document.body.append(resetDialog);
  const resumeTools = element('div', 'resume-tools');
  const resetHome = element('button', 'quiet-button', '重新开始'); resetHome.type = 'button'; resumeTools.append(resetHome); document.querySelector('.entry-block').append(resumeTools);
  const showToast = message => {
    clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  };
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { document.querySelector('#progress-note').textContent = '当前浏览器未允许保存进度，请保持此页打开。'; }
  }
  function homeStatus() {
    const count = state.answers.filter(Boolean).length;
    const label = document.querySelector('.ticket-label');
    label.textContent = count === 32 ? '查看我的选角' : count ? '继续选角' : '开始选角';
    document.querySelector('#entry-status').textContent = count ? `已留下 ${count} / 32 个选择` : '32 幕，一场午夜放映。';
    resumeTools.hidden = !count;
  }
  function showView(view, remember = true) {
    [...main.children].forEach(section => { section.hidden = section.dataset.screen !== view; });
    footer.hidden = view === 'quiz';
    document.body.dataset.view = view;
    if (remember) { state.view = view; persist(); }
    homeStatus(); window.scrollTo({top: 0, behavior: 'instant'});
  }
  function showHome() { sharedAnswers = null; showView('home'); document.querySelector('#main-title').setAttribute('tabindex', '-1'); document.querySelector('#main-title').focus({preventScroll: true}); }
  function start() {
    clearQuery();
    sharedAnswers = null;
    if (validateAnswers(state.answers)) { showResult(state.answers); return; }
    if (state.answers[state.index] && state.answers.some(answer => !answer)) state.index = state.answers.findIndex(answer => !answer);
    showView('quiz'); renderQuestion();
  }
  function renderQuestion() {
    const question = QUESTIONS[state.index];
    document.querySelector('#scene-count').textContent = `${String(state.index + 1).padStart(2, '0')} / 32`;
    document.querySelector('#scene-act').textContent = state.index < 19 ? 'FIRST REEL' : state.index === 19 ? 'INTERMISSION' : state.index < 30 ? 'SECOND REEL' : 'END CREDITS';
    document.querySelector('#scene-kicker').textContent = `SCENE ${String(question.number).padStart(2, '0')}`;
    document.querySelector('#scene-title').textContent = question.title;
    const paragraphs = question.text.split('\n').map(text => {
      const p = element('p', /^LOS ANGELES/.test(text) ? 'scene-subtitle' : '', text);
      return p;
    });
    document.querySelector('#scene-body').replaceChildren(...paragraphs);
    const list = document.querySelector('#choice-list'); list.replaceChildren();
    question.choices.forEach(choice => {
      const label = element('label', 'choice');
      const input = element('input'); input.type = 'radio'; input.name = question.id; input.value = choice.id; input.checked = state.answers[state.index] === choice.id;
      const letter = element('span', 'choice-letter', choice.id); letter.setAttribute('aria-hidden', 'true');
      const text = element('span', 'choice-text', choice.label);
      input.addEventListener('change', () => { state.answers[state.index] = choice.id; persist(); updateNavigation(); });
      label.append(input, letter, text); list.append(label);
    });
    const progress = document.querySelector('.quiz-progress');
    progress.setAttribute('aria-valuenow', String(state.index + 1));
    progress.querySelector('span').style.width = `${(state.index + 1) * 100 / 32}%`;
    document.querySelector('#previous-scene').disabled = state.index === 0;
    document.querySelector('#next-scene').innerHTML = state.index === 31 ? '查看选角 <span aria-hidden="true">↗</span>' : '下一场 <span aria-hidden="true">↗</span>';
    updateNavigation(); persist();
    window.scrollTo({top: 0, behavior: 'instant'}); document.querySelector('#scene-title').focus({preventScroll: true});
  }
  function updateNavigation() { document.querySelector('#next-scene').disabled = !state.answers[state.index]; }
  function appendParagraphs(target, paragraphs) { target.replaceChildren(...paragraphs.map(paragraph => element('p', '', paragraph))); }
  function showResult(answers, shared = false) {
    activeAnswers = [...answers]; activeResult = scoreAnswers(answers);
    const resultUrl = new URL(location.href);
    resultUrl.searchParams.set('r', encodeAnswers(answers));
    resultUrl.hash = '';
    history.replaceState(null, '', resultUrl.pathname + resultUrl.search);
    const result = activeResult;
    const character = characterById(result.primary);
    const secondary = characterById(result.secondary);
    const portrait = PORTRAITS[character.id];
    document.querySelector('#result-name').textContent = character.name;
    document.querySelector('#result-film').textContent = character.film;
    document.querySelector('#result-number').textContent = String(CHARACTERS.indexOf(character) + 1).padStart(2, '0');
    const quote = document.querySelector('#result-quote'); quote.textContent = portrait?.quote || ''; quote.hidden = !portrait?.quote;
    const body = document.querySelector('#portrait-text');
    if (portrait?.paragraphs?.length) {
      appendParagraphs(body, portrait.paragraphs); body.classList.remove('manuscript-pending');
    } else {
      appendParagraphs(body, ['角色肖像定稿待接入。']); body.classList.add('manuscript-pending');
    }
    document.querySelector('#radar-chart').replaceChildren(radarChart(result.radar));
    const values = document.querySelector('#axis-values'); values.replaceChildren();
    AXES.forEach((axis, index) => { const group = element('div', 'axis-value'); group.append(element('dt', '', axis), element('dd', '', String(result.radar[index]))); values.append(group); });
    const notes = [...(portrait?.castingNotes || [])];
    if (portrait?.relationship) notes.push(portrait.relationship);
    if (portrait?.blindSpot) notes.push(portrait.blindSpot);
    document.querySelector('#casting-notes-section').hidden = !notes.length;
    appendParagraphs(document.querySelector('#casting-notes'), notes);
    document.querySelector('#clue-heading').textContent = `${AXES[result.leadingAxes[0]]} · ${AXES[result.leadingAxes[1]]}`;
    const clues = selectedClues(answers, result).map(({question, choice}) => {
      const item = element('div', 'result-clue'); item.append(element('small', '', `SCENE ${String(question.number).padStart(2, '0')} / ${question.title}`), element('p', '', choice.label)); return item;
    });
    document.querySelector('#result-clues').replaceChildren(...clues);
    document.querySelector('#second-name').textContent = secondary.name;
    document.querySelector('#second-film').textContent = secondary.film;
    document.querySelector('#shared-notice').hidden = !shared;
    showView('result', !shared);
    document.querySelector('#result-name').focus({preventScroll:true});
  }
  function requestReset() { lastFocused = document.activeElement; document.body.classList.add('dialog-open'); resetDialog.showModal(); }
  function clearQuery() {
    const url = new URL(location.href); url.searchParams.delete('r'); history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  function reset() {
    resetDialog.close(); clearQuery(); sharedAnswers = null; state = blankState(); persist(); start();
  }
  document.querySelector('[data-action="start"]').addEventListener('click', start);
  document.querySelector('#leave-quiz').addEventListener('click', showHome);
  document.querySelector('#result-home').addEventListener('click', () => { clearQuery(); showHome(); });
  document.querySelector('.brand').addEventListener('click', event => { event.preventDefault(); clearQuery(); showHome(); });
  document.querySelector('#previous-scene').addEventListener('click', () => { if (state.index > 0) { state.index--; renderQuestion(); } });
  document.querySelector('#next-scene').addEventListener('click', () => {
    if (!state.answers[state.index]) return;
    if (state.index < 31) { state.index++; renderQuestion(); }
    else if (validateAnswers(state.answers)) showResult(state.answers);
  });
  document.querySelector('#retake-test').addEventListener('click', requestReset);
  resetHome.addEventListener('click', requestReset);
  document.querySelector('#cancel-reset').addEventListener('click', () => resetDialog.close());
  document.querySelector('#confirm-reset').addEventListener('click', reset);
  resetDialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); if (lastFocused?.isConnected) lastFocused.focus({preventScroll:true}); });
  document.querySelector('#take-own-test').addEventListener('click', () => { clearQuery(); sharedAnswers = null; if (state.answers.some(Boolean)) requestReset(); else start(); });
  document.querySelector('#copy-result').addEventListener('click', async () => {
    if (!activeAnswers) return;
    const url = new URL(location.pathname, location.origin); url.searchParams.set('r', encodeAnswers(activeAnswers));
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(url.href);
      else {
        const field = element('textarea'); field.value = url.href; field.setAttribute('readonly', ''); field.style.cssText = 'position:fixed;opacity:0;pointer-events:none'; document.body.append(field); field.select(); const ok = document.execCommand('copy'); field.remove(); if (!ok) throw new Error('Copy unavailable');
      }
      showToast('结果链接已复制。');
    } catch { showToast('浏览器没有允许复制，请使用浏览器的分享功能。'); }
  });
  document.querySelector('#save-card').addEventListener('click', async () => {
    if (!activeResult) return;
    const button = document.querySelector('#save-card'); button.disabled = true;
    try { await saveCard(characterById(activeResult.primary), activeResult.radar); showToast('选角卡已生成。'); }
    catch { showToast('暂时无法生成图片，可以先复制结果链接。'); }
    finally { button.disabled = false; }
  });
  let code;
  try { code = new URL(location.href).searchParams.get('r'); } catch { code = null; }
  sharedAnswers = decodeAnswers(code);
  if (sharedAnswers) showResult(sharedAnswers, !(validateAnswers(state.answers) && encodeAnswers(state.answers) === code));
  else if (state.view === 'result' && validateAnswers(state.answers)) showResult(state.answers);
  else if (state.view === 'quiz') { showView('quiz'); renderQuestion(); }
  else { showView('home'); if (code) showToast('这份结果链接不完整，可以重新开始选角。'); }
}

async function saveCard(character, scores) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1400;
  const c = canvas.getContext('2d'); if (!c) throw new Error('Canvas unavailable');
  c.fillStyle = '#17120f'; c.fillRect(0, 0, 900, 1400);
  c.strokeStyle = '#725440'; c.lineWidth = 2; c.strokeRect(42, 42, 816, 1316);
  c.textAlign = 'left'; c.fillStyle = '#ab8d73'; c.font = '18px sans-serif'; c.fillText('MIDNIGHT CASTING / 午夜选角', 85, 110);
  c.fillStyle = '#eee3d1'; let fontSize = 80; c.font = `${fontSize}px Georgia, serif`;
  while (c.measureText(character.name).width > 730 && fontSize > 35) { fontSize--; c.font = `${fontSize}px Georgia, serif`; }
  c.fillText(character.name, 85, 245);
  c.fillStyle = '#b6a18d'; c.font = '20px sans-serif';
  const filmLines = wrapText(c, character.film, 720); filmLines.forEach((line, index) => c.fillText(line, 85, 305 + index * 32));
  c.strokeStyle = '#4b382b'; c.beginPath(); c.moveTo(85, 390); c.lineTo(815, 390); c.stroke();
  const centerX = 450, centerY = 720, radius = 220;
  function point(r, index) { return coordinates(r, index, centerX, centerY); }
  for (const value of [20,40,60,80,100]) {
    c.beginPath(); AXES.forEach((_, i) => { const [x,y] = point(radius * value / 100, i); i ? c.lineTo(x,y) : c.moveTo(x,y); }); c.closePath(); c.strokeStyle = '#4b382b'; c.lineWidth = 1.4; c.stroke();
  }
  AXES.forEach((axis, i) => {
    const [x, y] = point(radius, i); c.beginPath(); c.moveTo(centerX, centerY); c.lineTo(x, y); c.stroke();
    const [tx, ty] = point(radius + 57, i); c.textAlign = 'center'; c.fillStyle = '#ddc8b1'; c.font = '25px sans-serif'; c.fillText(axis, tx, ty); c.fillStyle = '#b88d6e'; c.font = '21px sans-serif'; c.fillText(String(scores[i]), tx, ty + 32);
  });
  c.beginPath(); scores.forEach((value, i) => { const [x,y] = point(radius * value / 100, i); i ? c.lineTo(x,y) : c.moveTo(x,y); }); c.closePath(); c.fillStyle = '#b9584148'; c.fill(); c.strokeStyle = '#cc785d'; c.lineWidth = 3; c.stroke();
  c.textAlign = 'center'; c.fillStyle = '#a68d75'; c.font = '19px sans-serif'; c.fillText('32 个选择 / 你的午夜角色', 450, 1120);
  c.strokeStyle = '#4b382b'; c.beginPath(); c.moveTo(85, 1190); c.lineTo(815, 1190); c.stroke();
  c.fillStyle = '#d8c6af'; c.font = '27px serif'; c.fillText('午夜选角', 450, 1265);
  c.fillStyle = '#8f7863'; c.font = '15px sans-serif'; c.fillText('角色解读仅供趣味探索', 450, 1310);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); if (!blob) throw new Error('No image');
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `midnight-casting-${character.id}.png`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function wrapText(context, text, maxWidth) {
  const lines = []; let current = '';
  for (const char of text) { if (current && context.measureText(current + char).width > maxWidth) { lines.push(current); current = char; } else current += char; }
  if (current) lines.push(current); return lines;
}
