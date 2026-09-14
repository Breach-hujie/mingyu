import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBaziCompatibility, baziCalculator } from '../packages/core/src/bazi/index.ts';
import { buildBaziCompatibilityPrompt } from '../packages/core/src/prompt/bazi.ts';
import { buildZiweiChartInput, calculateZiweiChart } from '../packages/core/src/ziwei/runtime.ts';
import { buildZiweiPrompt } from '../packages/core/src/prompt/ziwei.ts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts.ts';
import {
  extractBaziCompatibilityFacts,
  extractZiweiFacts,
} from '../scripts/prompt-audit/natal-facts.ts';

const currentTime = new Date('2026-09-13T12:00:00+08:00');

function auditOriginal(prompt: string, facts: Parameters<typeof auditPromptFacts>[1]) {
  const result = auditPromptFacts(prompt, facts);
  assert.equal(result.present, result.expected);
  assert.deepEqual(result.missing, []);
  return result;
}

function swapAll(text: string, first: string, second: string) {
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(`${escapeRegExp(first)}|${escapeRegExp(second)}`, 'gu'),
    (value) => (value === first ? second : first),
  );
}

function swapBaziSubjectsYearPillars(
  prompt: string,
  firstYearPillar: string,
  secondYearPillar: string,
) {
  const firstStart = prompt.indexOf('【第一人排盘信息】');
  const secondStart = prompt.indexOf('【第二人排盘信息】');
  const relationStart = prompt.indexOf('【双盘关系资料】');
  assert.ok(firstStart >= 0 && secondStart > firstStart && relationStart > secondStart);
  const firstSection = prompt
    .slice(firstStart, secondStart)
    .replace(`年柱: ${firstYearPillar}`, `年柱: ${secondYearPillar}`);
  const secondSection = prompt
    .slice(secondStart, relationStart)
    .replace(`年柱: ${secondYearPillar}`, `年柱: ${firstYearPillar}`);
  return prompt.slice(0, firstStart) + firstSection + secondSection + prompt.slice(relationStart);
}

test('真实八字双盘交换主体年柱后，相同柱名仍能检出归属错绑', () => {
  const first = baziCalculator.calculateBazi({
    gender: 'female',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const second = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1991,
    month: 7,
    day: 20,
    timeIndex: 7,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const relation = analyzeBaziCompatibility(first, second, {
    person1Name: '甲',
    person2Name: '乙',
  });
  const prompt = buildBaziCompatibilityPrompt({
    result1: first,
    result2: second,
    person1Name: '甲',
    person2Name: '乙',
    question: '请分析双方关系。',
    currentTime,
  });
  const facts = extractBaziCompatibilityFacts(first, second, relation);
  auditOriginal(prompt, facts);

  const swapped = swapBaziSubjectsYearPillars(
    prompt,
    first.pillars.year.ganZhi,
    second.pillars.year.ganZhi,
  );
  const result = auditPromptFacts(swapped, facts);
  assert.ok(result.missing.includes('bazi.compatibility.person1.natal.year.pillar'));
  assert.ok(result.missing.includes('bazi.compatibility.person2.natal.year.pillar'));
  const hiddenLine = (key: 'year' | 'month') =>
    `藏干: ${first.hiddenStems[key].map((stem, index) => `${stem}[${first.hiddenTenGods[key][index]}]`).join('')}`;
  const yearHidden = hiddenLine('year');
  const monthHidden = hiddenLine('month');
  assert.notEqual(yearHidden, monthHidden);
  const swappedHidden = swapAll(prompt, yearHidden, monthHidden);
  assert.ok(swappedHidden.includes(yearHidden) && swappedHidden.includes(monthHidden));
  const hiddenResult = auditPromptFacts(swappedHidden, facts);
  assert.ok(hiddenResult.missing.includes('bazi.compatibility.person1.natal.year.hidden-stems'));
  assert.ok(hiddenResult.missing.includes('bazi.compatibility.person1.natal.month.hidden-stems'));
});

test('真实紫微宫位交换后，相同宫名仍能检出宫干支错绑', async () => {
  const input = buildZiweiChartInput({
    name: '审计样本',
    gender: 'female',
    dateType: 'solar',
    year: 1992,
    month: 8,
    day: 21,
    timeIndex: 4,
    isLeapMonth: false,
  });
  const runtime = await calculateZiweiChart(input, {
    scopes: ['decadal'],
    horoscopeContext: { dateStr: '2026-09-13', hourIndex: 4 },
  });
  const payload = runtime.payloadByScope.decadal;
  const prompt = buildZiweiPrompt({
    runtime,
    scope: 'decadal',
    question: '请分析当前运限。',
    currentTime,
  });
  const facts = extractZiweiFacts(payload, {
    scope: { start: '【紫微盘面资料】', end: '【任务】' },
    payloadScopes: ['decadal'],
    includeActiveFacts: false,
    palaceValueStyle: 'public',
    starValuePrefix: false,
  });
  auditOriginal(prompt, facts);

  const [firstPalace, secondPalace] = payload.palaces;
  const swapped = swapAll(
    prompt,
    `宫干支${firstPalace.heavenly_stem}${firstPalace.earthly_branch}`,
    `宫干支${secondPalace.heavenly_stem}${secondPalace.earthly_branch}`,
  );
  const result = auditPromptFacts(swapped, facts);
  assert.ok(result.missing.includes('ziwei.decadal.0.palace'));
  assert.ok(result.missing.includes('ziwei.decadal.1.palace'));
});

test('真实紫微当前四化交换落宫后应保留星曜关键词并检出配对错绑', async () => {
  const input = buildZiweiChartInput({
    name: '四化审计样本',
    gender: 'female',
    dateType: 'solar',
    year: 1992,
    month: 8,
    day: 21,
    timeIndex: 4,
    isLeapMonth: false,
  });
  const runtime = await calculateZiweiChart(input, {
    scopes: ['decadal'],
    horoscopeContext: { dateStr: '2026-09-13', hourIndex: 4 },
  });
  const payload = runtime.payloadByScope.decadal;
  const prompt = buildZiweiPrompt({
    runtime,
    scope: 'decadal',
    question: '请分析当前四化。',
    currentTime,
  });
  const facts = extractZiweiFacts(payload, {
    scope: { start: '【紫微盘面资料】', end: '【任务】' },
    payloadScopes: ['decadal'],
    includeActiveFacts: false,
    palaceValueStyle: 'public',
    starValuePrefix: false,
  });
  auditOriginal(prompt, facts);

  const [first, second] = payload.active_scope.mutagen_map;
  assert.ok(first && second && first.dynamic_palace_name && second.dynamic_palace_name);
  const palaceName = (value: string | undefined) => value?.replace(/宫$/u, '') ?? '';
  const firstText = `${first.star}化${first.mutagen}入${palaceName(first.palace_name)}宫（动态${palaceName(first.dynamic_palace_name)}）`;
  const secondText = `${second.star}化${second.mutagen}入${palaceName(second.palace_name)}宫（动态${palaceName(second.dynamic_palace_name)}）`;
  assert.ok(prompt.includes(firstText) && prompt.includes(secondText));
  assert.deepEqual(auditPromptFacts(swapAll(prompt, firstText, secondText), facts).missing, []);
  const firstTarget = firstText.slice(firstText.indexOf('入'));
  const secondTarget = secondText.slice(secondText.indexOf('入'));
  const swapped = prompt
    .replace(firstText, firstText.replace(firstTarget, secondTarget))
    .replace(secondText, secondText.replace(secondTarget, firstTarget));
  assert.ok(swapped.includes(`${first.star}化${first.mutagen}`));
  assert.ok(swapped.includes(`${second.star}化${second.mutagen}`));
  assert.ok(swapped.includes(firstTarget) && swapped.includes(secondTarget));
  const result = auditPromptFacts(swapped, facts);
  assert.ok(
    result.missing.includes('ziwei.decadal.mutagens'),
    '交换当前四化落宫后应检出星曜与落宫的配对错绑',
  );
});
