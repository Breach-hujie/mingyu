import { HIDDEN_STEMS } from './baziDefinitions';
import { TIAN_GAN_HE } from '../ganzhi/relations';
import type { Pillars } from './baziTypes';

export interface PatternRemedy {
  stem: string;
  pillar: 'year' | 'month' | 'day' | 'hour';
  tenGod: string;
  effect: string;
  placement?: '透干' | '藏干';
}
export interface PatternFulfillmentResult {
  patternName: string;
  status: '成格' | '破格' | '破而复成' | '平常' | '未判定';
  basis: string;
  contradiction: string;
  remedies: PatternRemedy[];
  summary: string;
  evidence?: string[];
  conditions?: string[];
}
type GetTenGodFn = (gan: string, dayMaster: string) => string;
const PILLAR_NAMES = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' } as const;

/** 归集候选关系与待核条件，成败取决于完整命局的力量、位置与制化有效性。 */
export function evaluatePatternFulfillment(
  pillars: Pillars,
  dayMaster: string,
  patternName: string,
  getTenGod: GetTenGodFn,
): PatternFulfillmentResult {
  const positions = ['year', 'month', 'day', 'hour'] as const;
  const observed = positions.flatMap((pillar) => {
    const { gan, zhi } = pillars[pillar];
    return [
      ...(pillar === 'day' ? [] : [{ stem: gan, placement: '透干' as const }]),
      ...(HIDDEN_STEMS[zhi] ?? []).map((stem) => ({ stem, placement: '藏干' as const })),
    ].map((item) => ({ ...item, pillar, tenGod: getTenGod(item.stem, dayMaster) }));
  });
  const describe = (item: (typeof observed)[number]) =>
    `${PILLAR_NAMES[item.pillar]}${item.placement}${item.stem}（${item.tenGod}）`;
  const evidence = positions.map(
    (pillar) =>
      `${PILLAR_NAMES[pillar]}${pillars[pillar].gan}${pillars[pillar].zhi}：${observed
        .filter((item) => item.pillar === pillar)
        .map(describe)
        .join('、')}`,
  );
  const has = (...gods: string[]) => observed.some((item) => gods.includes(item.tenGod));
  const conflicts: string[] = [];
  const remedies: PatternRemedy[] = [];
  const conditions = [
    '先按月令、透干、根气与制化条件核对所取格局，再分别判断日主承受与格神力量。',
    '透干与藏干分别定位；制化须核对双方根气、距离、合绊及同局其他生克，救应以实际可用为条件。',
  ];
  const addCandidate = (gods: string[], effect: string) => {
    for (const item of observed.filter((entry) => gods.includes(entry.tenGod)))
      remedies.push({ ...item, effect: `${describe(item)}：可核对${effect}` });
  };
  const name = patternName.replace(/^杂气/, '');
  let basis = '以月令所取结构为起点，结合四柱位置、根气与全局制化判断成败。';
  if (name.includes('正官')) {
    basis = '正官取用比较财生、印护与伤官、七杀等关系，成败取决于官星及制化实际作用。';
    if (has('正官')) {
      if (has('伤官')) conflicts.push('正官与伤官同见，须核对伤官是否实际制官及制约程度。');
      if (has('七杀')) conflicts.push('官杀同见，分别核对显隐与取清条件。');
      addCandidate(['正印', '偏印'], '印星护官、生身；伤官同见时另核制伤条件');
      addCandidate(['正财', '偏财'], '财星生官；印星同见时另核财印位置与相碍条件');
      if (has('七杀')) {
        addCandidate(['食神'], '制杀取清，并核对对官星的实际影响');
        for (const item of observed.filter(
          (entry) => entry.tenGod === '劫财' && entry.placement === '透干',
        )) {
          const targets = observed.filter(
            (entry) =>
              entry.tenGod === '七杀' &&
              entry.placement === '透干' &&
              TIAN_GAN_HE[item.stem]?.partner === entry.stem,
          );
          if (targets.length)
            remedies.push({
              ...item,
              effect: `${describe(item)}与${targets.map(describe).join('、')}具五合关系；取清另核位置、争合与合绊条件`,
            });
        }
      }
    }
    conditions.push('官星以实际柱位和显隐为据；财印并见时核对两者能否各起作用。');
  } else if (name.includes('正财') || name.includes('偏财')) {
    basis = '财格结合财星、日主及比劫的力量，比较食伤生财与官星护财的适用条件。';
    if (has('正财', '偏财')) {
      if (has('比肩', '劫财')) conflicts.push('财与比劫同见，夺财取义须以双方力量和作用路径为据。');
      if (has('七杀')) conflicts.push('财与七杀同见，核对财生杀对日主及取用的影响。');
      addCandidate(
        ['食神', '伤官'],
        has('比肩', '劫财')
          ? '泄比生财，并核对食伤是否受印制'
          : '食伤生财，并核对日主承受及食伤是否受印制',
      );
      addCandidate(
        ['正官', '七杀'],
        has('比肩', '劫财')
          ? '制比护财，并比较官杀耗财及日主承受条件'
          : '财生官杀，并核对日主承受条件',
      );
    }
    conditions.push('分别核对财根、日主承财与比劫力量；财星出现本身只证明财星可见。');
  } else if (name.includes('印')) {
    basis = '印格先辨身印轻重，再比较财、官杀、比劫及食伤的实际作用。';
    if (has('正印', '偏印')) {
      if (has('正财', '偏财')) {
        conflicts.push('财印同见，财的作用随身印轻重及位置而定。');
        addCandidate(['比肩', '劫财'], '制财存印，并核对护印是否符合身印需要');
      }
      addCandidate(['正官', '七杀'], '官杀生印，并核对身印是否已重；财星同见时再比较财官印路径');
      addCandidate(['食神', '伤官'], '身印偏重时泄秀，并核对印食之间的制约');
    }
    conditions.push('先分印轻受财与身印偏重，再确定财、官杀或食伤的取用方向。');
  } else if (name.includes('食神')) {
    basis = '食神格比较生财、制杀与偏印制食的作用，取用随日主及食神力量而定。';
    if (has('食神')) {
      if (has('偏印')) conflicts.push('食神与偏印同见，枭夺食须核对位置、力量和食神用途。');
      addCandidate(['正财', '偏财'], '食神生财；偏印同见时另核制枭护食条件');
      if (has('七杀')) {
        addCandidate(['食神'], '食神制杀，并核对财生杀及印制食的牵制');
        addCandidate(['正印', '偏印'], '杀印相生的另一取用路径，并与食神制杀比较');
      }
    }
    conditions.push('生财与制杀分别比较条件；同局财、印对食杀关系的影响一并判断。');
  } else if (name.includes('七杀') || name.includes('偏官')) {
    basis = '七杀格分别比较食神制杀、印化杀与日主承受条件。';
    if (has('七杀')) {
      addCandidate(['食神'], '食神制杀，比较身、杀、食的力量与制伏是否适当');
      addCandidate(['正印', '偏印'], '杀印相生，核对印根与生身作用');
      if (has('食神') && has('正印', '偏印'))
        conflicts.push('食与印同见，两条制化路径并存，须核对印制食是否影响制杀。');
      if (has('正财', '偏财')) conflicts.push('财星可能生杀；与食印制化放在同一作用链比较。');
    }
    conditions.push('食神制杀与印化杀分别核对；取主用时交代其他路径的成立条件与牵制。');
  } else if (name.includes('伤官')) {
    basis = '伤官格按身、伤、印、财的力量与位置比较配印或生财条件。';
    if (has('伤官')) {
      if (has('正官')) conflicts.push('伤官与正官同见，核对格局、调候、位置及实际制化后判断。');
      addCandidate(['正印', '偏印'], '配印制伤，核对伤官旺衰、印根及日主需要');
      addCandidate(['正财', '偏财'], '伤官生财，核对承财、印财关系及官杀引动');
    }
    conditions.push('配印以伤印力量及日主需要为条件，生财另核财根及承受。');
  } else if (
    name.includes('刃') ||
    name.includes('劫财') ||
    name.includes('建禄') ||
    name.includes('比肩')
  ) {
    basis = '禄劫刃以月令和日主力量为背景，分别比较财官、食伤及制化取用。';
    addCandidate(['正官', '七杀'], '官杀制比劫，并核对官杀力量与食伤牵制');
    addCandidate(['食神', '伤官'], '泄秀或生财，并核对日主、食伤与财星的承接');
    if (has('正财', '偏财') && has('比肩', '劫财'))
      conflicts.push('财与比劫同见，须按月令、根气和实际生克辨分夺或承财。');
    conditions.push('建禄、月劫、阳刃依各自月令口径辨明，数量只作分布资料，力量另行判断。');
  }
  const exposed = observed.filter((item) => item.placement === '透干');
  return {
    patternName,
    status: '未判定',
    basis,
    contradiction: conflicts.join('；'),
    remedies,
    evidence,
    conditions,
    summary: `【${patternName}】透干所见：${exposed.map(describe).join('、')}。${remedies.length ? '已有候选取用路径，成败按各项作用条件逐一核对。' : '成败需结合月令、透干、根气与制化条件辨明。'}`,
  };
}
