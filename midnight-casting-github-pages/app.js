import { mountExperience } from './experience.js';

(() => {
  'use strict';
  const characters = {
    pearl: { name: 'Pearl', film: '《珀尔》 PEARL · 2022', tags: ['被看见', '舞台梦想', '不甘'], paragraphs: ['困在偏远农场的珀尔，向往着银幕里闪耀的生活。对她而言，舞台意味着离开原有的生活，也意味着终于有人愿意看见她。', '她为本场带来的问题是：当现实迟迟没有回应你的渴望，你会怎样安放自己的野心？'] },
    sue: { name: 'Sue', film: '《某种物质》 THE SUBSTANCE · 2024', tags: ['理想自我', '外界目光', '完美形象'], paragraphs: ['Sue 与 Elisabeth 是同一部影片中彼此关联的自我形象。她所承接的年轻、完美与被注视，也让“更好的自己”成为一个需要不断维持的标准。', '她为本场带来的问题是：当你得到一直渴望的目光，怎样的自己才算足够？'] },
    lizzie: { name: 'Lizzie Borden', film: '《怪物：丽兹·玻顿的故事》', tags: ['束缚', '自由', '隐秘反抗'], paragraphs: ['在家庭与社会规则中，她的生活、表达和选择不断受到限制。', '她为本场带来的问题是：当别人已经替你安排好一生，你会怎样拿回决定自己的权利？'] },
    nikki: { name: 'Nikki', film: '《痴迷》 OBSESSION · 2026', tags: ['自主', '关系边界', '愿望的代价'], paragraphs: ['《痴迷》里的愿望改变了 Nikki 的处境和意志。理解她，需要看见被强加的情感，以及一个人对自身生活的选择权。', '她为本场带来的问题是：在亲密关系之中，你需要怎样的空间，才能继续成为你自己？'] },
    anna: { name: 'Anna', film: '《着魔》 POSSESSION · 1981', tags: ['关系撕裂', '自我边界', '理想投射'], paragraphs: ['Anna 身处一段正在分崩离析的婚姻。影片通过亲密关系的崩解、身份和欲望的冲突，呈现那些难以调和的需要。', '她为本场带来的问题是：当靠近与离开同时发生在心里，你会怎样辨认真正属于自己的声音？'] },
    dani: { name: 'Dani Ardor', film: '《仲夏夜惊魂》 MIDSOMMAR · 2019', tags: ['归属', '情感回应', '群体影响'], paragraphs: ['经历家庭变故的 Dani，在一段岌岌可危的关系中寻找支持。远方共同体带来的情感回应，也让接纳与群体影响交织在一起。', '她为本场带来的问题是：当一个地方终于接住你的情绪，你会用什么方式确认自己的归属？'] },
    jennifer: { name: 'Jennifer Check', film: '《詹妮弗的肉体》 JENNIFER’S BODY · 2009', tags: ['外在形象', '掌控', '友谊与竞争'], paragraphs: ['Jennifer 与 Needy 的友谊连接着不同的自我形象、亲密与竞争。她的故事让目光、地位和关系中的权力变得格外鲜明。', '她为本场带来的问题是：在一段熟悉的关系里，你最想守住的，究竟是对方的位置还是自己的位置？'] },
    carrie: { name: 'Carrie White', film: '《魔女嘉莉》 CARRIE · 1976 电影版', tags: ['接纳', '羞辱', '压抑与反抗'], paragraphs: ['嘉莉在严苛的家庭环境和同龄人的排斥之间，渴望一段普通的、被接纳的生活。理解她，需要同时看见敏感、希望，以及她所承受的对待。', '她为本场带来的问题是：当善意与伤害变得难以分辨，你会怎样保护那个仍然希望被接纳的自己？'] }
  };
  const dialog = document.querySelector('#info-dialog');
  const title = document.querySelector('#dialog-title');
  const kicker = document.querySelector('#dialog-kicker');
  const film = document.querySelector('#dialog-film');
  const tags = document.querySelector('#dialog-tags');
  const body = document.querySelector('#dialog-body');
  const note = document.querySelector('#dialog-note');
  const primary = document.querySelector('#dialog-primary');
  let trigger = null;

  const close = () => { if (dialog.open) dialog.close(); };
  function openModal(data, target) {
    trigger = target;
    title.textContent = data.title;
    kicker.textContent = data.kicker || 'MIDNIGHT CASTING';
    film.hidden = !data.film;
    film.textContent = data.film || '';
    tags.replaceChildren(...(data.tags || []).map(text => { const el = document.createElement('span'); el.textContent = text; return el; }));
    body.replaceChildren(...data.paragraphs.map(text => { const el = document.createElement('p'); el.textContent = text; return el; }));
    note.textContent = data.note || '';
    primary.replaceChildren(document.createTextNode(data.button || '回到放映厅 '));
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗'; primary.append(arrow);
    document.body.classList.add('dialog-open');
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.open === 'about') {
      openModal({ title: '每个人，都有另一种登场方式。', kicker: 'ABOUT THE SCREENING / 关于本场', paragraphs: ['《午夜选角》是一场以恐怖影视人物为线索的趣味自我探索。我们关注她们如何渴望、靠近、反抗与选择。', '你会坐进一场午夜放映，跟随银幕上的故事作出选择。无需提前认识所有人物，也没有标准答案。'], note: '含心理压迫与简短暴力情节。角色解读仅供趣味探索。答题进度只保存在当前浏览器。' }, button);
    }
  }));
  document.querySelectorAll('[data-character]').forEach(button => button.addEventListener('click', () => {
    const data = characters[button.dataset.character];
    if (!data) return;
    openModal({ title: data.name, film: data.film, tags: data.tags, paragraphs: data.paragraphs, kicker: 'THE CAST / 人物片段', note: '以上为影视人物的初步创作解读，不含关键结局剧透。' }, button);
  }));
  document.querySelector('.dialog-close').addEventListener('click', close);
  primary.addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
  });
})();

mountExperience();
