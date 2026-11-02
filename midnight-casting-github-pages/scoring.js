import { AXES, CHARACTERS, QUESTIONS, QUIZ_VERSION } from './quiz-data.js';

export const AXIS_MAXIMUMS = AXES.map((_, axis) => QUESTIONS.reduce((sum, question) => sum + Math.max(...question.choices.map(choice => choice.points[axis])), 0));

export function validateAnswers(answers) {
  return Array.isArray(answers) && answers.length === QUESTIONS.length && answers.every(answer => typeof answer === 'string' && /^[ABCD]$/.test(answer));
}

// Compare the direction of the same six measured scores. Character templates
// describe relative emphasis, and are never substituted for the visitor's radar.
function cosine(left, right) {
  const dot = left.reduce((sum, value, axis) => sum + value * right[axis], 0);
  return dot / (Math.hypot(...left) * Math.hypot(...right));
}

export function scoreAnswers(answers) {
  if (!validateAnswers(answers)) throw new TypeError('Complete all 32 scenes with A, B, C, or D.');
  const raw = AXES.map(() => 0);
  answers.forEach((answer, index) => QUESTIONS[index].choices['ABCD'.indexOf(answer)].points.forEach((points, axis) => { raw[axis] += points; }));
  const exact = raw.map((value, axis) => value * 100 / AXIS_MAXIMUMS[axis]);
  const ranked = CHARACTERS.map((character, index) => ({
    character, index, similarity: cosine(exact, character.profile),
    coreScore: exact[character.core[0]] * 2 + exact[character.core[1]]
  })).sort((a, b) => {
    const delta = b.similarity - a.similarity;
    if (Math.abs(delta) > 1e-12) return delta;
    return b.coreScore - a.coreScore || a.index - b.index;
  });
  const leadingAxes = exact.map((value, index) => ({ index, value })).sort((a, b) => b.value - a.value || a.index - b.index).slice(0, 2).map(axis => axis.index);
  return {
    version: QUIZ_VERSION, raw, exact, radar: exact.map(value => Math.round(value)),
    primary: ranked[0].character.id, secondary: ranked[1].character.id,
    ranking: ranked.map(entry => entry.character.id), leadingAxes
  };
}

export function encodeAnswers(answers) {
  if (!validateAnswers(answers)) throw new TypeError('Invalid answers.');
  return answers.join('');
}

export function decodeAnswers(code) {
  if (typeof code !== 'string' || !/^[ABCD]{32}$/.test(code)) return null;
  return code.split('');
}

export function selectedClues(answers, result) {
  const wanted = new Set(result.leadingAxes);
  const candidates = QUESTIONS.map((question, index) => {
    const choice = question.choices['ABCD'.indexOf(answers[index])];
    return { question, choice, index, strength: choice.points.reduce((sum, point, axis) => sum + (wanted.has(axis) ? point : 0), 0) };
  }).sort((a, b) => b.strength - a.strength || a.index - b.index);
  return candidates.slice(0, 3).sort((a, b) => a.index - b.index);
}
