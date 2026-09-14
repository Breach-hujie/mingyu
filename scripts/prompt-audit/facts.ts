/** 提示词审计资料只进入本地报告，不进入在线解读正文。 */
export interface PromptFactExpectation {
  id: string;
  owner: string;
  values: string[];
  scope?: { start: string; end?: string };
  unit?: 'line' | 'block';
  /** 柱位标题后的藏干行属于该柱，归属仍须出现在首行。 */
  includeNextLine?: boolean;
}

export interface PromptFactAudit {
  expected: number;
  present: number;
  missing: string[];
  repeated: Array<{ id: string; occurrences: number }>;
  facts: Array<{ id: string; owner: string; values: string[]; occurrences: number }>;
}

const normalize = (value: string) => value.replace(/[\s\u200b]/gu, '');

function selectScope(text: string, scope: PromptFactExpectation['scope']) {
  if (!scope) return text;
  const start = text.indexOf(scope.start);
  if (start < 0) return '';
  const contentStart = start + scope.start.length;
  const end = scope.end ? text.indexOf(scope.end, contentStart) : -1;
  // 声明了上下文终点时，终点缺失不能退化为整份正文搜索。
  if (scope.end && end < 0) return '';
  return text.slice(start, end < 0 ? undefined : end);
}

export function auditPromptFacts(
  prompt: string,
  expectations: PromptFactExpectation[],
): PromptFactAudit {
  const ids = new Set<string>();
  const facts = expectations.map((fact) => {
    if (!fact.id || ids.has(fact.id)) throw new Error(`审计事实标识为空或重复：${fact.id}`);
    ids.add(fact.id);
    if (
      !normalize(fact.owner) ||
      !fact.values.length ||
      fact.values.some((value) => !normalize(value))
    ) {
      throw new Error(`审计事实必须包含归属与具体值：${fact.id}`);
    }
    const scoped = selectScope(prompt, fact.scope);
    const lines = scoped.split(fact.unit === 'block' ? /\r?\n\s*\r?\n/u : /\r?\n/u).map(normalize);
    const units = fact.includeNextLine
      ? lines.flatMap((line, index) =>
          line.includes(normalize(fact.owner)) ? [line + (lines[index + 1] ?? '')] : [],
        )
      : lines;
    const values = [fact.owner, ...fact.values].map(normalize);
    const occurrences = units.filter((unit) =>
      values.every((value) => unit.includes(value)),
    ).length;
    return { id: fact.id, owner: fact.owner, values: fact.values, occurrences };
  });
  return {
    expected: facts.length,
    present: facts.filter((fact) => fact.occurrences > 0).length,
    missing: facts.filter((fact) => fact.occurrences === 0).map((fact) => fact.id),
    repeated: facts
      .filter((fact) => fact.occurrences > 1)
      .map(({ id, occurrences }) => ({ id, occurrences })),
    facts,
  };
}

export function assertPromptFactCoverage(
  samples: Array<{ name: string; prompt: string; facts: PromptFactExpectation[] }>,
) {
  const results = samples.map((sample) => ({
    name: sample.name,
    characters: sample.prompt.length,
    ...auditPromptFacts(sample.prompt, sample.facts),
  }));
  const failures = results.filter((result) => result.expected === 0 || result.missing.length);
  if (failures.length) {
    throw new Error(
      `提示词事实覆盖未通过：\n${failures.map((result) => `${result.name}：${result.expected === 0 ? '尚未定义事实清单' : result.missing.join('、')}`).join('\n')}`,
    );
  }
  return results;
}
