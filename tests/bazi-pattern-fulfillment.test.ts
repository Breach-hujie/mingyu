import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePatternFulfillment } from '../packages/core/src/bazi/baziPatternFulfillment';
import { getTenGod } from '../packages/core/src/bazi/baziUtils';
import type { Pillars } from '../packages/core/src/bazi/baziTypes';

function pillars(values: [string, string, string, string]): Pillars {
  return Object.fromEntries(
    ['year', 'month', 'day', 'hour'].map((key, index) => [
      key,
      {
        gan: values[index][0],
        zhi: values[index][1],
        ganZhi: values[index],
      },
    ]),
  ) as unknown as Pillars;
}

test('正官见伤印财保留柱位与相碍条件，透印本身不判破而复成', () => {
  const chart = pillars(['壬申', '己酉', '甲子', '丁卯']);
  const result = evaluatePatternFulfillment(chart, '甲', '正官格', getTenGod);
  assert.equal(result.status, '未判定');
  assert.match(result.contradiction, /正官与伤官同见/);
  assert.ok(
    result.remedies.some(
      (item) => item.stem === '壬' && item.pillar === 'year' && item.placement === '透干',
    ),
  );
  assert.ok(result.remedies.some((item) => item.stem === '己' && item.tenGod === '正财'));
  assert.match(result.conditions!.join('；'), /财印.*各起作用/);
  assert.match(result.evidence!.join('；'), /月柱己酉.*月柱藏干辛（正官）/);
  assert.doesNotMatch(JSON.stringify(result), /紧贴克官|格局大成|仕途稳健|富贵自天来/);
  const changed = evaluatePatternFulfillment(
    pillars(['壬午', '己酉', '甲子', '丁卯']),
    '甲',
    '正官格',
    getTenGod,
  );
  assert.match(changed.evidence![0], /年柱壬午/);
  assert.doesNotMatch(changed.evidence![0], /藏干壬/);
  assert.notDeepEqual(changed.evidence, result.evidence);
});

test('食印并见的七杀格保留两条取用与印制食反证', () => {
  const result = evaluatePatternFulfillment(
    pillars(['丙午', '庚申', '甲寅', '壬申']),
    '甲',
    '七杀格',
    getTenGod,
  );
  assert.equal(result.status, '未判定');
  assert.ok(
    result.remedies.some(
      (item) => item.stem === '丙' && item.pillar === 'year' && item.effect.includes('食神制杀'),
    ),
  );
  assert.ok(
    result.remedies.some(
      (item) => item.stem === '壬' && item.pillar === 'hour' && item.effect.includes('杀印相生'),
    ),
  );
  assert.match(result.contradiction, /印制食.*制杀/);
  const withoutExposedYin = evaluatePatternFulfillment(
    pillars(['丙午', '庚申', '甲寅', '乙亥']),
    '甲',
    '七杀格',
    getTenGod,
  );
  assert.ok(
    withoutExposedYin.remedies.some((item) => item.stem === '壬' && item.placement === '藏干'),
  );
  assert.ok(
    !withoutExposedYin.remedies.some((item) => item.tenGod === '偏印' && item.placement === '透干'),
  );
});

test('财、食、印和禄劫取用保留实际候选，成败不由十神数量代替', () => {
  const cases = [
    {
      chart: ['甲子', '戊辰', '乙丑', '丙戌'],
      day: '乙',
      name: '正财格',
      path: '泄比生财',
      stem: '丙',
    },
    {
      chart: ['庚申', '甲申', '丙午', '戊子'],
      day: '丙',
      name: '食神格',
      path: '制枭护食',
      stem: '庚',
    },
    {
      chart: ['戊子', '癸亥', '甲寅', '庚申'],
      day: '甲',
      name: '正印格',
      path: '生印',
      stem: '庚',
    },
    {
      chart: ['甲寅', '丙寅', '甲戌', '乙卯'],
      day: '甲',
      name: '建禄格',
      path: '泄秀',
      stem: '丙',
    },
  ];
  for (const item of cases) {
    const result = evaluatePatternFulfillment(
      pillars(item.chart as [string, string, string, string]),
      item.day,
      item.name,
      getTenGod,
    );
    assert.equal(result.status, '未判定', item.name);
    assert.ok(
      result.remedies.some((r) => r.stem === item.stem && r.effect.includes(item.path)),
      item.name,
    );
    assert.ok(result.conditions!.length > 0);
  }
  const monthJie = evaluatePatternFulfillment(
    pillars(['甲寅', '乙卯', '甲戌', '乙亥']),
    '甲',
    '劫财格',
    getTenGod,
  );
  assert.match(monthJie.basis, /禄劫刃/);
  assert.doesNotMatch(monthJie.basis, /^财格/);
  const noCompanion = evaluatePatternFulfillment(
    pillars(['丙午', '戊戌', '乙酉', '辛巳']),
    '乙',
    '正财格',
    getTenGod,
  );
  assert.ok(noCompanion.remedies.some((item) => item.effect.includes('食伤生财')));
  assert.doesNotMatch(JSON.stringify(noCompanion.remedies), /泄比|制比/);
});

test('未见格神或未知格局时不生成其他格局的救应', () => {
  const chart = pillars(['甲子', '乙卯', '甲寅', '乙卯']);
  for (const name of ['正官格', '其他格局']) {
    const result = evaluatePatternFulfillment(chart, '甲', name, getTenGod);
    assert.equal(result.status, '未判定');
    assert.deepEqual(result.remedies, []);
    assert.equal(result.contradiction, '');
    assert.equal(result.evidence!.length, 4);
  }
  const yinDay = evaluatePatternFulfillment(
    pillars(['甲子', '辛未', '乙卯', '庚辰']),
    '乙',
    '正官格',
    getTenGod,
  );
  assert.match(yinDay.contradiction, /官杀同见/);
  assert.ok(!yinDay.remedies.some((item) => item.tenGod === '劫财'));
  const yangDay = evaluatePatternFulfillment(
    pillars(['乙丑', '庚辰', '甲寅', '辛未']),
    '甲',
    '正官格',
    getTenGod,
  );
  assert.ok(
    yangDay.remedies.some(
      (item) =>
        item.stem === '乙' && item.effect.includes('庚') && item.effect.includes('五合关系'),
    ),
  );
});
