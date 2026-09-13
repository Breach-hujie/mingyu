import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILL_SCENARIOS } from './fixtures/skill/scenarios.js';
import { evaluateScenario } from '../scripts/evaluate-skill.js';

test('通用算命 Skill 必须通过 12 类场景 24 个样本的 L0—L5 实战评审契约', () => {
  assert.ok(SKILL_SCENARIOS.length >= 24, '场景样本库应至少包含 24 个样本');

  // 必须覆盖 12 大类
  const categories = new Set(SKILL_SCENARIOS.map((s) => s.category));
  assert.equal(categories.size, 12, '必须完整覆盖全部 12 类用户诉求场景');

  // 验证每个场景在支持的 Provider 模式下都能通过评审
  for (const scenario of SKILL_SCENARIOS) {
    for (const mode of scenario.providerModes) {
      const result = evaluateScenario(scenario, mode);
      assert.ok(
        result.passed,
        `场景 ${scenario.id} (${mode}) 未通过评测: ${result.errors.join('; ')}`,
      );
      assert.ok(result.scoreLevels.l0Intake.passed, `[${scenario.id}] L0 检查失败`);
      assert.ok(result.scoreLevels.l1Routing.passed, `[${scenario.id}] L1 检查失败`);
      assert.ok(result.scoreLevels.l2Evidence.passed, `[${scenario.id}] L2 检查失败`);
      assert.ok(result.scoreLevels.l3DynamicSynthesis.passed, `[${scenario.id}] L3 检查失败`);
      assert.ok(result.scoreLevels.l4OutputPrompt.passed, `[${scenario.id}] L4 检查失败`);
      assert.ok(result.scoreLevels.l5SafetyPrivacy.passed, `[${scenario.id}] L5 检查失败`);
    }
  }
});
