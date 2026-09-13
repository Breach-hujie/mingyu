import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const publicApiDocs = readFileSync('docs/api.md', 'utf8');
const publicSkill = readFileSync('public/skills/aov-mingyu-api/SKILL.md', 'utf8');
const aovProviderRef = readFileSync(
  'public/skills/aov-mingyu-api/references/providers/aov-mingyu.md',
  'utf8',
);
const sourceProviderRef = readFileSync('skills/mingyu/references/providers/aov-mingyu.md', 'utf8');
const publicMingyuProviderRef = readFileSync(
  'public/skills/mingyu/references/providers/aov-mingyu.md',
  'utf8',
);
const skillProviderRefs = [sourceProviderRef, publicMingyuProviderRef, aovProviderRef];

test('Provider 源手册与发布副本应保持同一神煞和轻量输出口径', () => {
  assert.equal(publicMingyuProviderRef, sourceProviderRef);
  for (const content of [...skillProviderRefs, publicApiDocs]) {
    assert.match(content, /空亡.*日柱.*年柱.*旬空/);
    assert.match(content, /驿马、桃花.*年支.*日支/);
    assert.match(content, /detailMode: "compact".*(?:保留|包含).*逐柱神煞命中/);
  }
});

test('所有 AOV Provider 手册必须使用当前 REST 端点和 OpenAPI 包装层', () => {
  for (const content of skillProviderRefs) {
    assert.doesNotMatch(content, /\/bazi\/chart|\/ziwei\/chart/);
    assert.match(content, /\/bazi\/calculate/);
    assert.match(content, /\/calendar\/true-solar-birth/);
    assert.match(content, /spec\["data"\]\["paths"\]/);
    assert.match(content, /AOV REST 响应封装/);
    assert.match(content, /MCP 成功响应与 Envelope 契约/);
  }
});

test('公开 API 文档必须同步出生真太阳时端点与 OpenAPI 包装层', () => {
  assert.match(publicApiDocs, /POST \/calendar\/true-solar-birth/);
  assert.match(publicApiDocs, /POST \/bazi\/calculate/);
  assert.match(publicApiDocs, /spec\["data"\]\["paths"\]/);
});

test('AOV Provider 手册必须说明真太阳时出生参数和 timezone 单位', () => {
  for (const content of skillProviderRefs) {
    assert.match(content, /timezone.*单位为小时/);
    assert.match(content, /-12.*14/);
    assert.match(content, /useTrueSolarTime.*birthHour.*birthMinute.*birthLongitude/);
    assert.match(content, /可省略 `timeIndex`/);
    assert.match(content, /timeZoneId.*Asia\/Shanghai/);
    assert.match(content, /detailMode: \"full\".*完整证据链/);
    assert.match(content, /curl -X POST https:\/\/aov\.cc\/api\/v1\/bazi\/calculate/);
  }

  assert.match(publicApiDocs, /timezone.*单位为小时/);
  assert.match(publicApiDocs, /useTrueSolarTime.*birthHour.*birthMinute.*birthLongitude/);
  assert.match(publicApiDocs, /timeZoneId.*Asia\/Shanghai/);
  assert.match(publicApiDocs, /detailMode: \"full\".*完整证据链/);
});

test('公开 API 文档和 provider 适配层应写明 AI 接口', () => {
  for (const content of [publicApiDocs, aovProviderRef]) {
    assert.match(content, /POST \/ai\/analyze/);
    assert.match(content, /POST \/ai\/models/);
    assert.match(content, /text\/event-stream/);
    assert.match(content, /aiConfig/);
  }
});

test('公开 API 文档和 provider 适配层应覆盖完整塔罗牌阵参数', () => {
  for (const spreadType of [
    'single',
    'three',
    'love',
    'career',
    'decision',
    'celtic',
    'chakra',
    'year',
    'mindBodySpirit',
    'horseshoe',
    'holyTriangle',
    'universal',
    'fourElements',
    'hexagram',
    'relationship',
    'wealth',
    'problemSolving',
    'twelveHouses',
  ]) {
    assert.match(publicApiDocs, new RegExp(spreadType));
    assert.match(aovProviderRef, new RegExp(spreadType));
  }
});

test('公开 API 文档和 provider 适配层应覆盖完整雷诺曼牌阵与金口诀指定地分', () => {
  for (const content of [publicApiDocs, aovProviderRef]) {
    for (const spreadType of [
      'single',
      'three',
      'five',
      'relationship',
      'decision',
      'nine',
      'element',
      'grandTableau',
    ]) {
      assert.match(content, new RegExp(spreadType));
    }
    assert.match(content, /POST \/divination\/jinkoujue/);
    assert.match(content, /jinkoujueMethod.*branch/);
    assert.match(content, /jinkoujueBranch/);
    assert.match(content, /指定地分/);
  }
});

test('公开 API 文档和 provider 适配层应覆盖五运六气与皇极经世的关键输入口径', () => {
  for (const content of [publicApiDocs, aovProviderRef]) {
    assert.match(content, /POST \/metaphysics\/wuyun-liuqi\/calculate/);
    assert.match(content, /POST \/metaphysics\/wuyun-liuqi\/prompt/);
    assert.match(content, /year.*yearGanZhi|yearGanZhi.*year/);
    assert.match(content, /天符.*岁会/);
    assert.match(content, /sourceReconciliation/);
    assert.match(content, /26 年|26年/);
    assert.match(content, /二十八年/);
    assert.match(content, /POST \/metaphysics\/huangji-jingshi\/calculate/);
    assert.match(content, /POST \/metaphysics\/huangji-jingshi\/prompt/);
    assert.match(content, /customDate.*年月日时|年月日时.*customDate/);
    assert.match(content, /年度研究.*year|year.*年度盘|公元 `year`/);
    assert.match(content, /值年卦/);
    assert.match(content, /1984 年鼎卦|1984年鼎卦/);
    assert.match(content, /epochYear/);
    assert.match(content, /year.*elapsedYears|elapsedYears.*year/);
    assert.match(content, /自定义纪元/);
  }
});

test('公开 API 文档和 provider 适配层应说明统一多派合参与排盘口径边界', () => {
  for (const content of [publicApiDocs, aovProviderRef]) {
    assert.match(content, /`schools`/);
    assert.match(content, /规划内确有合理差异/);
    assert.match(content, /一至三个/);
    assert.match(content, /共同结论|共识/);
    assert.match(content, /ziping.*mangpai.*xinpai/);
    assert.match(content, /huozhulin.*bushizhengzong.*zengshanbuyi/);
    assert.match(content, /modern.*traditional.*timing/);
    assert.match(content, /yuanhui.*guaqi/);
    assert.match(content, /转盘.*飞盘.*实际(?:排)?盘/);
    assert.match(content, /三山国王灵签.*不附加派系.*不接受 `schools`/);
  }
});

test('通用算命 Skill 应具备完整的方法论参考文件与架构引用', () => {
  const referenceFiles = [
    'public/skills/aov-mingyu-api/references/intake.md',
    'public/skills/aov-mingyu-api/references/routing.md',
    'public/skills/aov-mingyu-api/references/evidence.md',
    'public/skills/aov-mingyu-api/references/interpretation.md',
    'public/skills/aov-mingyu-api/references/timing.md',
    'public/skills/aov-mingyu-api/references/synthesis.md',
    'public/skills/aov-mingyu-api/references/output.md',
    'public/skills/aov-mingyu-api/references/safety.md',
    'public/skills/aov-mingyu-api/references/providers.md',
    'public/skills/aov-mingyu-api/references/providers/aov-mingyu.md',
  ];

  for (const file of referenceFiles) {
    assert.ok(existsSync(file), `参考文件 ${file} 应存在`);
    const content = readFileSync(file, 'utf8');
    assert.ok(content.length > 200, `参考文件 ${file} 内容应充实`);
  }

  // 验证主 SKILL.md 引用了核心方法论参考体系与提供方适配层
  assert.match(publicSkill, /references\/intake\.md/);
  assert.match(publicSkill, /references\/routing\.md/);
  assert.match(publicSkill, /references\/evidence\.md/);
  assert.match(publicSkill, /references\/interpretation\.md/);
  assert.match(publicSkill, /references\/timing\.md/);
  assert.match(publicSkill, /references\/synthesis\.md/);
  assert.match(publicSkill, /references\/output\.md/);
  assert.match(publicSkill, /references\/safety\.md/);
  assert.match(publicSkill, /references\/providers\.md/);
  assert.match(publicSkill, /references\/providers\/aov-mingyu\.md/);
});

test('主 Skill 入口应与底层数据提供方解耦，聚焦方法论工作流', () => {
  // 以当前工作流的实际步骤和按需读取契约校验入口，避免绑定已升级的旧标题。
  assert.match(publicSkill, /统一工作顺序/);
  assert.match(publicSkill, /建立问题卡.*锁定时空与口径.*选择路线.*建立证据账/s);
  assert.match(publicSkill, /独立解读.*处理动态与应期.*合参与复核.*组织输出/s);
  assert.match(publicSkill, /按需读取 `reading-workflow\.json`/);
  assert.match(publicSkill, /规范方法身份固定为/);
  assert.match(publicSkill, /自包含.*完整.*任务书/);
  assert.match(publicSkill, /特殊情境/);

  // 主入口已解耦：不应堆砌 50+ 个完整端点表，而是委托给 provider 适配层
  assert.ok(!publicSkill.includes('POST /calendar/astronomical-time'));
  assert.ok(!publicSkill.includes('POST /foundation/shensha'));
  assert.ok(!publicSkill.includes('POST /divination/tarot/prompt'));
});

test('通用算命 Skill 必须覆盖十类核心业务场景的行为与降级契约', () => {
  const intake = readFileSync('public/skills/aov-mingyu-api/references/intake.md', 'utf8');
  const routing = readFileSync('public/skills/aov-mingyu-api/references/routing.md', 'utf8');
  const evidence = readFileSync('public/skills/aov-mingyu-api/references/evidence.md', 'utf8');
  const interpretation = readFileSync(
    'public/skills/aov-mingyu-api/references/interpretation.md',
    'utf8',
  );
  const timing = readFileSync('public/skills/aov-mingyu-api/references/timing.md', 'utf8');
  const synthesis = readFileSync('public/skills/aov-mingyu-api/references/synthesis.md', 'utf8');
  const safety = readFileSync('public/skills/aov-mingyu-api/references/safety.md', 'utf8');
  const providers = readFileSync('public/skills/aov-mingyu-api/references/providers.md', 'utf8');

  // 1. 长期创业选择：分层合参，按主辅职责与共同事实落到核验
  assert.match(synthesis, /多术式合参与分歧处理/);
  assert.match(synthesis, /六步流程/);
  assert.match(synthesis, /独立取证.*对齐尺度.*提取共同事实.*展开差异.*落到核验/s);
  assert.match(synthesis, /主法负责回答该子问题.*辅法只填补约定维度/s);
  assert.match(synthesis, /方法数量、符号强度或多数意见不构成独立证据/);

  // 2. 缺出生时辰：保留可用层级，并把细层改为条件表达
  assert.match(intake, /八字有年月日而时辰待考，可谈前三柱和阶段大势/);
  assert.match(intake, /资料达到 B 级时先形成可用结论和条件分支，达到 A 级后再补细层/);
  assert.match(interpretation, /缺时辰时保留前三柱结论并标出时柱影响/);
  assert.match(interpretation, /出生时刻不足时保留行星与相位，宫位、轴点和精确时刻改为条件分支/);

  // 3. 一事一问：六爻承载事件与应期所需的主证据
  assert.match(routing, /六爻.*单一事件/);
  const liuyaoIntake = intake
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .find((cells) => cells[1] === '六爻');
  assert.equal(liuyaoIntake?.[2], '起卦时间、卦象、动爻、具体一事');
  assert.match(routing, /六爻负责当前成败与应期/);

  // 4. 方位谈判：时家奇门固定主体、主客动静和方位证据
  assert.match(routing, /时家奇门当前事件/);
  assert.match(interpretation, /固定日干\/时干、用神宫、主客动静/);
  assert.match(interpretation, /行动主体、方向、门星神证据和现实条件/);

  // 5. 复杂人事博弈：大六壬四课三传
  assert.match(routing, /大六壬/);
  assert.match(routing, /四课.*三传/s);

  // 6. 动态周期与应期阶段
  assert.match(timing, /每个窗口同时写出粒度、起点、终点、所属上层和触发证据/);
  assert.match(timing, /何时具备条件.*何时发生转折.*何时结果落地/s);
  assert.match(timing, /多阶段事件使用事件簇.*多个阶段索引/s);
  assert.match(timing, /一个窗口至少带一项可观察节点/);

  // 7. 空间住宅风水：形势、八宅与玄空分层合参
  assert.match(routing, /八宅、玄空、住宅环境合参/);
  assert.match(interpretation, /形势层描述采光、通风、动线和外部环境/);
  assert.match(interpretation, /八宅层看命卦、宅卦、门主灶与九星.*玄空层看三元九运/s);
  assert.match(interpretation, /住宅合参把居者适配、宅运理气、形势现实和目标房间分开取证/);

  // 8. 象征探索：牌阵、事件语法、签谱材料各自分层
  assert.match(routing, /塔罗提供牌阵叙事，雷诺曼提供事件语法，灵签提供签谱与典故/);
  assert.match(interpretation, /牌面象征与现实资料分层/);

  // 9. 高风险领域：术数叙事与医疗、法律、投资、人身安全事实分层
  assert.match(safety, /现实事实.*术数材料.*术数判断与现实判断分成两层/s);
  assert.match(safety, /医疗诊断、处方、急症处理和治疗效果属于临床资料/);
  assert.match(safety, /证据、合同、诉讼策略和法律结论依据执业律师/);
  assert.match(safety, /资金规模、产品条款、流动性、估值和监管资料属于现实判断/);
  assert.match(safety, /人身安全先依据现实环境、可信联系人和专业支持/);

  // 10. Provider 故障与降级：保留上下文，区分操作事实与术数判断
  assert.match(providers, /取得失败时保留问题卡、已确认输入和已有盘面/);
  assert.match(providers, /明确可用层级和补采项/);
  assert.match(providers, /异常本身属于操作事实，与术数吉凶分开/);
});
