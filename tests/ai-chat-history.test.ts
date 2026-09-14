import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAiChatInitialPrompt,
  createAiChatSessionId,
  createAiChatTitle,
  extractPromptQuestion,
  normalizeAiChatHistory,
  getAiChatCompletionStatus,
  loadAiChatHistory,
  saveAiChatHistory,
  upsertAiChatSession,
} from '@/lib/ai/chat-history';
import type { AiChatSession } from '@/lib/ai/chat-history';

function createSession(id: string, updatedAt: string): AiChatSession {
  return {
    id,
    title: `对话 ${id}`,
    initialQuestion: '我的事业走势如何？',
    promptMode: 'context-question',
    turns: [{ role: 'assistant', content: '这是回复' }],
    createdAt: updatedAt,
    updatedAt,
  };
}

test('AI 对话历史应自动迁移旧版单条记录', () => {
  const state = normalizeAiChatHistory({
    turns: [{ role: 'assistant', content: '旧版回复' }],
    updatedAt: '2026-07-13T08:00:00.000Z',
  });

  assert.equal(state.sessions.length, 1);
  assert.equal(state.activeSessionId, 'legacy');
  assert.equal(state.sessions[0]?.title, '最近一次解析');
  assert.deepEqual(state.sessions[0]?.turns, [{ role: 'assistant', content: '旧版回复' }]);
});

test('AI 对话历史应修正失效的当前会话标识', () => {
  const first = createSession('first', '2026-07-13T08:00:00.000Z');
  const state = normalizeAiChatHistory({
    version: 2,
    sessions: [first],
    activeSessionId: 'missing',
  });

  assert.equal(state.activeSessionId, 'first');
  assert.deepEqual(state.sessions, [first]);
});

test('AI 对话标题与自动解析问题应保持简洁', () => {
  const prompt = `【当前时间】\n2026-07-13\n\n【问题】\n我未来三年的事业发展如何？\n\n【任务】\n请给出分析。`;

  assert.equal(extractPromptQuestion(prompt), '我未来三年的事业发展如何？');
  assert.equal(createAiChatTitle('  事业   和   财运  '), '事业 和 财运');
});

test('AI 对话问题提取应忽略任务正文中的行内问题引用', () => {
  const prompt = `【任务】
请依据六爻资料回答【问题】。先辨世应和用神，再判断发展趋势。

【问题】
这次合作是否适合继续推进？`;

  assert.equal(extractPromptQuestion(prompt), '这次合作是否适合继续推进？');
});

test('AI 对话标识应使用系统级安全随机且不重复', () => {
  const first = createAiChatSessionId();
  const second = createAiChatSessionId();

  assert.ok(first.length >= 32);
  assert.notEqual(first, second);
});

test('AI 历史会话恢复时应重建首轮完整提示词', () => {
  const session = createSession('career', '2026-07-13T08:00:00.000Z');
  assert.equal(
    buildAiChatInitialPrompt('【排盘资料】\n内容', session),
    '【排盘资料】\n内容\n\n我的事业走势如何？',
  );
});

test('AI 历史会话更新后应移到列表首位', () => {
  const first = createSession('first', '2026-07-13T08:00:00.000Z');
  const second = createSession('second', '2026-07-13T09:00:00.000Z');
  const updatedFirst = { ...first, updatedAt: '2026-07-13T10:00:00.000Z' };

  assert.deepEqual(
    upsertAiChatSession([second, first], updatedFirst).map((session) => session.id),
    ['first', 'second'],
  );
});

test('AI 历史应保留未完成回答标记和原主体快照', () => {
  const state = normalizeAiChatHistory({
    version: 2,
    sessions: [
      {
        id: 'partial',
        title: '旧命盘',
        initialQuestion: '旧问题',
        initialPrompt: '旧盘面提示词',
        completionStatus: 'partial',
        readingSubject: {
          id: 'subject-old',
          source: 'bazi',
          lockedInputs: { bazi: { year: 1990, month: 1, day: 2 } },
          allowedMethods: ['bazi'],
          range: { source: 'bazi' },
        },
        promptMode: 'context-question',
        turns: [
          { role: 'user', content: '旧问题' },
          { role: 'assistant', content: '截断回答', incomplete: true },
        ],
        createdAt: '2026-07-13T08:00:00.000Z',
        updatedAt: '2026-07-13T08:01:00.000Z',
      },
    ],
    activeSessionId: 'partial',
  });

  assert.equal(state.sessions[0]?.completionStatus, 'partial');
  assert.equal(state.sessions[0]?.turns[1]?.incomplete, true);
  assert.equal(state.sessions[0]?.readingSubject?.id, 'subject-old');
});

test('AI 历史应保留结构化资料指纹以隔离不同命盘', () => {
  const state = normalizeAiChatHistory({
    version: 2,
    sessions: [
      {
        id: 'structured',
        title: '完整紫微资料',
        initialQuestion: '问事业',
        initialPrompt: '阶段入口',
        readingResourceKey: 'ziwei-reading-full-primary-old',
        readingSubject: {
          id: 'subject-old',
          source: 'ziwei',
          lockedInputs: { ziwei: { year: 1990 } },
          allowedMethods: ['ziwei'],
          range: { ziweiScope: 'full' },
        },
        promptMode: 'context-question',
        turns: [],
        createdAt: '2026-07-13T08:00:00.000Z',
        updatedAt: '2026-07-13T08:01:00.000Z',
      },
    ],
    activeSessionId: 'structured',
  });

  assert.equal(state.sessions[0]?.readingResourceKey, 'ziwei-reading-full-primary-old');
});

test('历史状态只依据最新回答，旧的截断回答不覆盖后续完整回答', () => {
  const turns = [
    { role: 'assistant' as const, content: '旧截断', incomplete: true },
    { role: 'user' as const, content: '新的问题' },
    { role: 'assistant' as const, content: '新的完整回答' },
  ];
  const state = normalizeAiChatHistory({
    sessions: [{ id: 'one', turns }],
  });

  assert.notEqual(state.sessions[0]?.completionStatus, 'partial');
  assert.equal(getAiChatCompletionStatus('error', turns), 'error');
});

test('历史尾部新问题恢复为待完成状态', () => {
  const state = normalizeAiChatHistory({
    sessions: [
      {
        id: 'pending',
        turns: [
          { role: 'assistant', content: '旧回答' },
          { role: 'user', content: '刷新前的新问题' },
        ],
      },
    ],
  });

  assert.equal(state.sessions[0]?.completionStatus, 'pending');
});

test('历史会话保留独立的占卜术式字段', () => {
  const state = normalizeAiChatHistory({
    sessions: [{ id: 'taiyi', readingMethod: ' taiyi ', turns: [] }],
  });

  assert.equal(state.sessions[0]?.readingMethod, 'taiyi');
});

test('历史写入失败时保留原始存储内容', () => {
  const oldValue = '{"version":2,"sessions":[{"id":"old"}],"activeSessionId":"old"}';
  const storage = {
    getItem: () => oldValue,
    setItem: () => {
      throw new Error('quota');
    },
    removeItem: () => undefined,
  };
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });
  try {
    assert.equal(
      saveAiChatHistory('history-key', {
        sessions: [
          {
            id: 'new',
            title: '新对话',
            initialQuestion: '',
            promptMode: 'context',
            turns: [],
            createdAt: '',
            updatedAt: '',
          },
        ],
        activeSessionId: 'new',
      }),
      false,
    );
    assert.equal(storage.getItem(), oldValue);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      });
  }
});

test('最后一条历史删除失败时返回失败并保留刷新后记录', () => {
  const oldValue = JSON.stringify({
    version: 2,
    sessions: [
      {
        id: 'old',
        title: '旧对话',
        initialQuestion: '',
        promptMode: 'context',
        turns: [{ role: 'user', content: '旧问题' }],
        createdAt: '',
        updatedAt: '',
      },
    ],
    activeSessionId: 'old',
  });
  const storage = {
    getItem: () => oldValue,
    setItem: () => undefined,
    removeItem: () => {
      throw new Error('denied');
    },
  };
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });
  try {
    assert.equal(saveAiChatHistory('history-key', { sessions: [], activeSessionId: '' }), false);
    assert.equal(loadAiChatHistory('history-key').sessions[0]?.id, 'old');
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      });
  }
});
