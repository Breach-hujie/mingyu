import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import workflow from '../skills/mingyu/references/reading-workflow.json';
import { getReadingGuide } from '../src/lib/ai/reading-workflow';

const skillRoot = join(process.cwd(), 'skills/mingyu');
const requiredMethods = [
  'bazi',
  'ziwei',
  'astrolabe',
  'astrolabe-synastry',
  'qizheng',
  'liuyao',
  'meihua',
  'qimen',
  'qimen-lifetime',
  'liuren',
  'jinkoujue',
  'xiaoliuren',
  'tarot',
  'lenormand',
  'ssgw',
  'almanac',
  'fengshui',
  'taiyi',
  'huangji',
  'wuyun',
  'name',
  'zodiac',
  'calendar',
] as const;
const profileFields = [
  'intent',
  'inputs',
  'scope',
  'evidence',
  'timing',
  'conditions',
  'review',
  'whenToRead',
  'guide',
] as const;

test('源技能入口链接的渐进披露资料均存在', () => {
  const skill = readFileSync(join(skillRoot, 'SKILL.md'), 'utf8');
  const links = [...skill.matchAll(/\]\((references\/[^)]+)\)/g)].map((match) => match[1]);
  assert.ok(links.length >= 10);
  for (const link of links) assert.equal(existsSync(join(skillRoot, link)), true, link);
});

test('方法目录覆盖全部规范身份并具备按需取用结构', () => {
  assert.equal(workflow.version, 2);
  for (const method of requiredMethods) {
    const profile = workflow.methods[method];
    assert.ok(profile, method);
    for (const field of profileFields) {
      assert.equal(typeof profile[field], 'string');
      assert.ok(profile[field].trim(), `${method}.${field}`);
    }
    assert.doesNotMatch(profile.guide, /(?:项目|仓库|接口|API|MCP|工程|内部字段)/u, method);
    assert.doesNotMatch(profile.guide, /(?:行动建议|风险提醒)/u, method);
  }
});

test('明确方法的自然问题能取得方法级证据与边界，而非只按标题匹配', () => {
  const scenarios = [
    {
      method: 'bazi',
      question: '出生时刻接近节气，想看未来十年的职业转折。',
      markers: ['透干', '藏干', '通根', '本盘日干', '完整干支'],
    },
    {
      method: 'ziwei',
      question: '我想知道某一年事业宫变化由谁发起、落到哪里。',
      markers: ['发出宫', '化星', '落宫', '节气月口径'],
    },
    {
      method: 'qimen',
      question: '这次谈判要比较双方方向和窗口。',
      markers: ['天盘地盘', '寄干', '甲时遁干', '原象'],
    },
    {
      method: 'qimen-lifetime',
      question: '交运当天发生一件工作大事，前后阶段如何分辨？',
      markers: ['十年干支大运', '交节起运', '精确起运时刻', '前后两运'],
    },
    {
      method: 'astrolabe-synastry',
      question: '未来一年两人的互动差异和共同转折如何判断？',
      markers: ['交互相位', '落宫', '双方共同可见'],
    },
    {
      method: 'calendar',
      question: '请核对出生地的钟表时间与节气时刻。',
      markers: ['当地钟表时间', '真太阳时', '节气'],
    },
    {
      method: 'ssgw',
      question: '请把这支签放回我问的婚事里解释。',
      markers: ['签号', '签题', '签诗', '典故'],
    },
  ] as const;
  for (const scenario of scenarios) {
    const guide = getReadingGuide(scenario.question, undefined, scenario.method, {
      question: scenario.question,
    });
    for (const marker of scenario.markers)
      assert.match(guide, new RegExp(marker), `${scenario.method}: ${marker}`);
  }
});

test('自然文本探测使用方法专属词，跨术式通词不会串入另一指南', () => {
  const liuyao = getReadingGuide('六爻卦象遇到空亡，判断这次面试的结果。');
  assert.match(liuyao, /六爻：/u);
  assert.doesNotMatch(liuyao, /小六壬：/u);

  const xiaoliuren = getReadingGuide('小六壬遇到空亡，判断这次消息的快慢。');
  assert.match(xiaoliuren, /小六壬：/u);
  assert.doesNotMatch(xiaoliuren, /六爻：/u);

  const bazi = getReadingGuide('八字命理结合节气和太岁，查看明年事业。');
  assert.match(bazi, /八字：/u);
  assert.doesNotMatch(bazi, /生肖：|历法与天文时间：/u);

  const baziCompatibility = getReadingGuide('八字合盘比较双方长期关系结构。');
  assert.match(baziCompatibility, /八字：/u);
  assert.doesNotMatch(baziCompatibility, /西占双盘：/u);

  const combined = getReadingGuide('八字紫微合参，比较长期职业结构。');
  assert.match(combined, /八字：/u);
  assert.match(combined, /紫微斗数：/u);
});
