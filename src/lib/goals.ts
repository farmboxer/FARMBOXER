export type GoalInputs = {
  currentSalesRmb: number;
  targetSalesRmb: number;
  targetYears: number;
  marginFloorPercent: number;
};

export type YearMilestone = {
  year: number;
  salesRmb: number;
  minProfitRmb: number;
};

export type GoalPath = {
  currentSalesRmb: number;
  targetSalesRmb: number;
  targetYears: number;
  multiple: number;
  cagr: number;
  milestones: YearMilestone[];
  honestNote: string;
  ambitious: boolean;
};

export function computeGoalPath(input: GoalInputs): GoalPath {
  const years = Math.max(1, Math.round(input.targetYears));
  const current = Math.max(1, input.currentSalesRmb);
  const target = Math.max(current, input.targetSalesRmb);
  const multiple = target / current;
  const cagr = Math.pow(multiple, 1 / years) - 1;
  const milestones: YearMilestone[] = [];
  for (let y = 0; y <= years; y++) {
    const sales = current * Math.pow(1 + cagr, y);
    milestones.push({
      year: y,
      salesRmb: sales,
      minProfitRmb: sales * (input.marginFloorPercent / 100),
    });
  }
  const ambitious = cagr >= 0.4;
  const honestNote = ambitious
    ? `从 ${current.toLocaleString("zh-CN")} 到 ${target.toLocaleString("zh-CN")} 人民币，${years} 年需年复合增长约 ${(cagr * 100).toFixed(1)}%（约 ${multiple.toFixed(1)} 倍）。这是激进目标：看板只做路径数学，不假装已经完成。毛利底线 ${input.marginFloorPercent}% 是硬约束，放量不得靠亏本报价。`
    : `按 ${(cagr * 100).toFixed(1)}% 年复合增长，${years} 年后达到目标。所有报价仍须满足毛利 ≥ ${input.marginFloorPercent}%。`;

  return {
    currentSalesRmb: current,
    targetSalesRmb: target,
    targetYears: years,
    multiple,
    cagr,
    milestones,
    honestNote,
    ambitious,
  };
}
