import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getReadingGuide,
  runReadingWorkflow,
  type ReadingDependencies,
} from '../src/lib/ai/reading-workflow';
import workflow from '../skills/mingyu/references/reading-workflow.json';
import { PROMPT_METHOD_IDS } from '../packages/core/src/prompt/framework';

test('合法术式与别名获得对应专业指南，正文提到其他术数不改变身份', () => {
  const routes = {
    'wuyun-liuqi': '五运六气',
    'huangji-jingshi': '皇极经世',
    'qi-zheng': '七政四余',
    bazhai: workflow.methods.fengshui.label,
    xuankong: workflow.methods.fengshui.label,
    residential: workflow.methods.fengshui.label,
    zhuge: '签谱',
    kongming: '签谱',
    'name.zhugeDivination': '签谱',
    'name.kongmingDivination': '签谱',
    'name.generation': '姓名数理',
    'name.chineseAnalysis': '姓名数理',
    'name.characterQuery': '姓名数理',
    'name.numberEnergy': '姓名数理',
  };
  for (const [method, label] of Object.entries(routes)) {
    const guide = getReadingGuide('请比较八字、紫微、奇门与当前问题。', undefined, method);
    assert.ok(guide.includes(`${label}：`), method);
    assert.doesNotMatch(guide, /八字：|紫微斗数：|奇门遁甲：/, method);
  }

  const bazi = getReadingGuide('八字排盘：甲子日');
  assert.match(bazi, /透干、藏干、通根/);
  assert.doesNotMatch(bazi, /紫微斗数：|六爻：/);
});

test('显式双术合参保留两套专业推导，未知方法不会按正文猜成其他术式', () => {
  const combined = getReadingGuide('八字紫微合参');
  assert.match(combined, /八字：.*\n紫微斗数：/);
  const routedCombined = getReadingGuide('请围绕职业问题解读。', undefined, 'bazi-ziwei');
  assert.match(routedCombined, /八字：/);
  assert.match(routedCombined, /紫微斗数：/);
  const unknown = getReadingGuide('八字四柱与紫微命身宫', undefined, 'unknown-method');
  assert.doesNotMatch(unknown, /八字：|紫微斗数：/);
});

test('终身奇门使用具体指南，通用奇门指南不重复叠加', () => {
  const guide = getReadingGuide('奇门终身局，值符值使与本命阶段。');
  assert.match(guide, /奇门终身局：/);
  assert.doesNotMatch(guide, /奇门遁甲：/);
});

test('真实方法目录中的每个方法都有专业指南，单牌与时间工具同样可达', () => {
  for (const method of [...PROMPT_METHOD_IDS, 'tarot_single']) {
    const guide = getReadingGuide('请按当前方法解释。', undefined, method);
    assert.ok(
      Object.values(workflow.methods).some((profile) =>
        guide.includes(`${profile.label}：${profile.guide}`),
      ),
      method,
    );
  }
});

test('准备、正式解读及时间追问实际发送相应专业证据，普通解释追问复用资料', async () => {
  const sent: Parameters<ReadingDependencies['stream']>[0][] = [];
  const errors: string[] = [];
  const base = [
    {
      role: 'user' as const,
      content: '【盘面】年柱：庚午；月柱：辛巳；日柱：庚辰；时柱：甲申。\n【问题】请解释本命结构。',
    },
  ];
  const options = {
    readingMethod: 'bazi',
    memory: { resources: [] },
    onProgress: () => {},
    onNotice: () => {},
    onError: (error: string) => errors.push(error),
    onChunk: () => {},
    onDone: () => {},
  };
  const deps: ReadingDependencies = {
    stream: async (messages, callbacks) => {
      sent.push(messages);
      callbacks.onChunk(
        messages.at(-1)?.content.includes('准备解读资料')
          ? '{"actions":[]}'
          : '结合月令与根气解释本命结构。',
      );
      callbacks.onDone();
    },
    execute: async () => {
      throw new Error('本例已有足够资料');
    },
  };
  await runReadingWorkflow(base, options, deps);
  assert.deepEqual(errors, []);
  assert.equal(sent.length, 2);
  const preparation = sent[0].map((message) => message.content).join('\n');
  const writing = sent[1].map((message) => message.content).join('\n');
  assert.match(preparation, /八字取用范围：/);
  assert.match(preparation, /八字推导依据：/);
  assert.doesNotMatch(preparation, /八字结论核对：/);
  assert.match(writing, /八字成立条件：/);
  assert.match(writing, /八字结论核对：/);
  assert.doesNotMatch(writing, /八字取用范围：|八字时间层级：/);
  sent.length = 0;
  await runReadingWorkflow(
    [
      ...base,
      { role: 'assistant', content: '原盘结构说明。' },
      { role: 'user', content: '解释一下' },
    ],
    options,
    deps,
  );
  assert.equal(sent.length, 1);
  assert.match(sent[0].map((message) => message.content).join('\n'), /八字结论核对：/);
  sent.length = 0;
  await runReadingWorkflow(
    [
      ...base,
      { role: 'assistant', content: '原盘结构说明。' },
      { role: 'user', content: '2027年交运前后有什么区别？' },
    ],
    options,
    deps,
  );
  assert.equal(sent.length, 2);
  for (const messages of sent) {
    assert.match(messages.map((message) => message.content).join('\n'), /八字时间层级：/);
  }
});

test('已锁定西占伴侣时使用双盘专业指南，显式方法不能覆盖主体', () => {
  const guide = getReadingGuide(
    '八字命局',
    {
      id: '双盘',
      source: 'astrolabe',
      lockedInputs: { astrolabe: {}, astrolabePartner: {} },
      allowedMethods: ['astrolabe'],
      range: {},
    },
    'bazi',
  );
  const profile = workflow.methods['astrolabe-synastry' as keyof typeof workflow.methods];
  assert.ok(profile);
  assert.ok(guide.includes(`${profile.label}：${profile.guide}`));
  assert.doesNotMatch(guide, /八字：/);
});
