'use client';

import { useMemo, useState } from 'react';

type State = 'NSW' | 'VIC' | 'QLD';
type PropertyUse = 'owner' | 'investor';
type RepaymentType = 'principalInterest' | 'interestOnly';
type RepaymentFrequency = 'weekly' | 'fortnightly' | 'monthly';
type RightAxisMetric = 'lvr' | 'freeCashflow' | 'leveredNetYield' | 'leveredGrossYield';

const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0
});

const currencyWithCents = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function baseStampDuty(state: State, price: number): number {
  if (price <= 0) return 0;

  switch (state) {
    case 'NSW':
      if (price <= 14000) return price * 0.0125;
      if (price <= 30000) return 175 + (price - 14000) * 0.015;
      if (price <= 81000) return 415 + (price - 30000) * 0.0175;
      if (price <= 304000) return 1307 + (price - 81000) * 0.035;
      if (price <= 1013000) return 9112 + (price - 304000) * 0.045;
      return 41017 + (price - 1013000) * 0.055;
    case 'VIC':
      if (price <= 25000) return price * 0.014;
      if (price <= 130000) return 350 + (price - 25000) * 0.024;
      if (price <= 960000) return 2870 + (price - 130000) * 0.06;
      return price * 0.055;
    case 'QLD':
      if (price <= 5000) return 0;
      if (price <= 75000) return (price - 5000) * 0.015;
      if (price <= 540000) return 1050 + (price - 75000) * 0.035;
      if (price <= 1000000) return 17325 + (price - 540000) * 0.045;
      return 38025 + (price - 1000000) * 0.0575;
    default:
      return 0;
  }
}

function qldHomeConcessionDuty(price: number): number {
  if (price <= 0) return 0;

  // QLD transfer duty rates for principal place of residence (home concession).
  if (price <= 350000) return price * 0.01;
  if (price <= 540000) return 3500 + (price - 350000) * 0.035;
  if (price <= 1000000) return 10150 + (price - 540000) * 0.045;
  return 30850 + (price - 1000000) * 0.0575;
}

function ownerOccupierConcession(state: State, price: number, baseDuty: number): number {
  if (price <= 0) return 0;

  switch (state) {
    case 'QLD': {
      const homeDuty = qldHomeConcessionDuty(price);
      return Math.max(baseDuty - homeDuty, 0);
    }
    case 'NSW':
      return 0;
    case 'VIC':
      return 0;
    default:
      return 0;
  }
}

function stampDuty(state: State, price: number, propertyUse: PropertyUse): { final: number; concession: number } {
  const base = baseStampDuty(state, price);
  if (propertyUse === 'investor') {
    return { final: base, concession: 0 };
  }

  const concession = ownerOccupierConcession(state, price, base);
  return { final: Math.max(base - concession, 0), concession };
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function periodicPrincipalInterestRepayment(
  principal: number,
  annualRatePct: number,
  years: number,
  periodsPerYear: number
): number {
  const periods = years * periodsPerYear;
  const periodicRate = annualRatePct / 100 / periodsPerYear;
  if (principal <= 0 || periods <= 0) return 0;
  if (periodicRate === 0) return roundToCents(principal / periods);

  const payment = (principal * periodicRate) / (1 - Math.pow(1 + periodicRate, -periods));
  return roundToCents(payment);
}

function periodicInterestOnlyRepayment(principal: number, annualRatePct: number, periodsPerYear: number): number {
  if (principal <= 0) return 0;
  return roundToCents((principal * (annualRatePct / 100)) / periodsPerYear);
}

function periodicPrincipalInterestRepaymentExact(
  principal: number,
  annualRatePct: number,
  years: number,
  periodsPerYear: number
): number {
  const periods = years * periodsPerYear;
  const periodicRate = annualRatePct / 100 / periodsPerYear;
  if (principal <= 0 || periods <= 0) return 0;
  if (periodicRate === 0) return principal / periods;

  return (principal * periodicRate) / (1 - Math.pow(1 + periodicRate, -periods));
}

function balanceAfterPeriods(
  startingBalance: number,
  periodicRate: number,
  periodRepayment: number,
  periods: number
): number {
  let balance = Math.max(startingBalance, 0);

  for (let i = 0; i < periods; i += 1) {
    if (balance <= 0) return 0;
    const interest = balance * periodicRate;
    const principalPaid = Math.max(periodRepayment - interest, 0);
    balance = Math.max(balance - principalPaid, 0);
  }

  return balance;
}


function loanBalanceAtHorizon(
  initialLoan: number,
  repaymentType: RepaymentType,
  periodicRate: number,
  exactPeriodRepayment: number,
  periodsPerYear: number,
  loanTermYears: number,
  horizonYears: number
): number {
  if (initialLoan <= 0) return 0;
  if (repaymentType === 'interestOnly') return initialLoan;

  const totalPeriods = Math.max(Math.floor(loanTermYears * periodsPerYear), 0);
  const periodsToRun = Math.min(Math.floor(horizonYears * periodsPerYear), totalPeriods);
  return balanceAfterPeriods(initialLoan, periodicRate, exactPeriodRepayment, periodsToRun);
}

function calculateIrr(cashflows: number[]): number | null {
  if (cashflows.length < 2) return null;
  const hasPositive = cashflows.some((v) => v > 0);
  const hasNegative = cashflows.some((v) => v < 0);
  if (!hasPositive || ! hasNegative)
    return null;

  const npv = (rate: number): number =>
    cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);

  let low = -0.99;
  let high = 1.5;
  let npvLow = npv(low);
  let npvHigh = npv(high);

  let expand = 0;
  while (npvLow * npvHigh > 0 && expand < 30) {
    high += 1;
    npvHigh = npv(high);
    expand += 1;
  }

  if (npvLow * npvHigh > 0) return null;

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);

    if (Math.abs(npvMid) < 1e-7) return mid;

    if (npvLow * npvMid <= 0) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }

  return (low + high) / 2;
}


export default function HomePage() {
  const [purchasePrice, setPurchasePrice] = useState(850000);
  const [depositPct, setDepositPct] = useState(20);
  const [interestRate, setInterestRate] = useState(6.2);
  const [loanTermYears, setLoanTermYears] = useState(30);
  const [weeklyRent, setWeeklyRent] = useState(800);
  const [occupancyPct, setOccupancyPct] = useState(96);
  const [managementPct, setManagementPct] = useState(7);
  const [maintenanceAnnual, setMaintenanceAnnual] = useState(2800);
  const [councilAnnual, setCouncilAnnual] = useState(2200);
  const [insuranceAnnual, setInsuranceAnnual] = useState(1300);
  const [strataAnnual, setStrataAnnual] = useState(1600);
  const [otherBuyingCosts, setOtherBuyingCosts] = useState(3500);
  const [cpiAnnualGrowthPct, setCpiAnnualGrowthPct] = useState(3);
  const [rentAnnualGrowthPct, setRentAnnualGrowthPct] = useState(4);
  const [propertyValueAnnualGrowthPct, setPropertyValueAnnualGrowthPct] = useState(5);
  const [state, setState] = useState<State>('NSW');
  const [propertyUse, setPropertyUse] = useState<PropertyUse>('investor');
  const [repaymentType, setRepaymentType] = useState<RepaymentType>('principalInterest');
  const [repaymentFrequency, setRepaymentFrequency] = useState<RepaymentFrequency>('monthly');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [rightAxisMetric, setRightAxisMetric] = useState<RightAxisMetric>('lvr');

  const result = useMemo(() => {
    const deposit = purchasePrice * (depositPct / 100);
    const loan = Math.max(purchasePrice - deposit, 0);
    const stampResult = stampDuty(state, purchasePrice, propertyUse);
    const stamp = stampResult.final;
    const upfront = deposit + stamp + otherBuyingCosts;

    const grossRent = weeklyRent * 52 * (occupancyPct / 100);
    const managementFee = grossRent * (managementPct / 100);
    const totalExpenses = managementFee + maintenanceAnnual + councilAnnual + insuranceAnnual + strataAnnual;

    const periodsPerYear = repaymentFrequency === 'weekly' ? 52 : repaymentFrequency === 'fortnightly' ? 26 : 12;
    const exactPeriodRepayment =
      repaymentType === 'interestOnly'
        ? (loan * (interestRate / 100)) / periodsPerYear
        : periodicPrincipalInterestRepaymentExact(loan, interestRate, loanTermYears, periodsPerYear);
    const periodRepayment = roundToCents(exactPeriodRepayment);
    const annualMortgage = periodRepayment * periodsPerYear;
    const annualCashflow = grossRent - totalExpenses - annualMortgage;

    const nextYearPropertyValue = purchasePrice * (1 + propertyValueAnnualGrowthPct / 100);
    const nextYearRent = grossRent * (1 + rentAnnualGrowthPct / 100);
    const nextYearExpenses = totalExpenses * (1 + cpiAnnualGrowthPct / 100);
    const nextYearCashflow = nextYearRent - nextYearExpenses - annualMortgage;

    const projectionYears = 30;
    const growthFactor = 1 + propertyValueAnnualGrowthPct / 100;
    const periodicRate = interestRate / 100 / periodsPerYear;

    const chartData: Array<{
      year: number;
      propertyValue: number;
      lvr: number;
      freeCashflow: number;
      leveredGrossYield: number;
      leveredNetYield: number;
    }> = [];
    let runningPropertyValue = purchasePrice;
    let runningLoanBalance = loan;

    chartData.push({
      year: 0,
      propertyValue: runningPropertyValue,
      lvr: runningPropertyValue > 0 ? (runningLoanBalance / runningPropertyValue) * 100 : 0,
      freeCashflow: annualCashflow,
      leveredGrossYield: upfront > 0 ? (grossRent / upfront) * 100 : 0,
      leveredNetYield: upfront > 0 ? ((grossRent - totalExpenses) / upfront) * 100 : 0
    });

    for (let year = 1; year <= projectionYears; year += 1) {
      runningPropertyValue *= growthFactor;

      if (repaymentType === 'principalInterest') {
        runningLoanBalance = balanceAfterPeriods(runningLoanBalance, periodicRate, exactPeriodRepayment, periodsPerYear);
      }

      const yearRent = grossRent * Math.pow(1 + rentAnnualGrowthPct / 100, year);
      const yearExpenses = totalExpenses * Math.pow(1 + cpiAnnualGrowthPct / 100, year);
      const yearFreeCashflow = yearRent - yearExpenses - annualMortgage;
      const equity = Math.max(runningPropertyValue - runningLoanBalance, 0);

      chartData.push({
        year,
        propertyValue: runningPropertyValue,
        lvr: runningPropertyValue > 0 ? (runningLoanBalance / runningPropertyValue) * 100 : 0,
        freeCashflow: yearFreeCashflow,
        leveredGrossYield: equity > 0 ? (yearRent / equity) * 100 : 0,
        leveredNetYield: equity > 0 ? ((yearRent - yearExpenses) / equity) * 100 : 0
      });
    }

    const horizonYears = [10, 20, 30] as const;
    const irrByHorizon = horizonYears.map((years) => {
      const cashflows: number[] = [-upfront];

      for (let year = 1; year <= years; year += 1) {
        const rent = grossRent * Math.pow(1 + rentAnnualGrowthPct / 100, year);
        const expenses = totalExpenses * Math.pow(1 + cpiAnnualGrowthPct / 100, year);
        let yearlyCashflow = rent - expenses - annualMortgage;

        if (year === years) {
          const exitValue = purchasePrice * Math.pow(1 + propertyValueAnnualGrowthPct / 100, year);
          const remainingLoan = loanBalanceAtHorizon(
            loan,
            repaymentType,
            periodicRate,
            exactPeriodRepayment,
            periodsPerYear,
            loanTermYears,
            year
          );
          yearlyCashflow += exitValue - remainingLoan;
        }

        cashflows.push(yearlyCashflow);
      }

      const irr = calculateIrr(cashflows);
      return { years, irr };
    });

    const grossYieldPct = purchasePrice > 0 ? (grossRent / purchasePrice) * 100 : 0;
    const netYieldPct = purchasePrice > 0 ? ((grossRent - totalExpenses) / purchasePrice) * 100 : 0;
    const lvrPct = purchasePrice > 0 ? (loan / purchasePrice) * 100 : 0;

    return {
      deposit,
      loan,
      stamp,
      concession: stampResult.concession,
      upfront,
      grossRent,
      totalExpenses,
      annualMortgage,
      annualCashflow,
      grossYieldPct,
      netYieldPct,
      lvrPct,
      repaymentTypeLabel: repaymentType === 'interestOnly' ? '只还利息' : '等额本息',
      repaymentFrequencyLabel:
        repaymentFrequency === 'weekly' ? '每周' : repaymentFrequency === 'fortnightly' ? '每两周' : '每月',
      periodRepayment,
      nextYearPropertyValue,
      nextYearRent,
      nextYearExpenses,
      nextYearCashflow,
      chartData,
      irrByHorizon
    };
  }, [
    purchasePrice,
    depositPct,
    interestRate,
    loanTermYears,
    weeklyRent,
    occupancyPct,
    managementPct,
    maintenanceAnnual,
    councilAnnual,
    insuranceAnnual,
    strataAnnual,
    otherBuyingCosts,
    cpiAnnualGrowthPct,
    rentAnnualGrowthPct,
    propertyValueAnnualGrowthPct,
    state,
    propertyUse,
    repaymentType,
    repaymentFrequency
  ]);

  const chartWidth = 760;
  const chartHeight = 320;
  const padding = { top: 20, right: 56, bottom: 36, left: 70 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const maxPropertyValue = Math.max(...result.chartData.map((d) => d.propertyValue), 1);
  const rightMetricConfig: Record<
    RightAxisMetric,
    { label: string; value: (d: (typeof result.chartData)[number]) => number; format: (v: number) => string }
  > = {
    lvr: {
      label: 'LVR (%)',
      value: (d) => d.lvr,
      format: (v) => `${v.toFixed(1)}%`
    },
    freeCashflow: {
      label: '自由现金流 (AUD/年)',
      value: (d) => d.freeCashflow,
      format: (v) => currency.format(v)
    },
    leveredGrossYield: {
      label: '杠杆毛租金回报率 (%)',
      value: (d) => d.leveredGrossYield,
      format: (v) => `${v.toFixed(2)}%`
    },
    leveredNetYield: {
      label: '杠杆净租金回报率 (%)',
      value: (d) => d.leveredNetYield,
      format: (v) => `${v.toFixed(2)}%`
    }
  };

  const rightMetric = rightMetricConfig[rightAxisMetric];
  const rightValues = result.chartData.map((d) => rightMetric.value(d));
  const maxRightMetric = Math.max(...rightValues, 1);
  const minRightMetric = Math.min(...rightValues, 0);
  const rightRange = Math.max(maxRightMetric - minRightMetric, 1e-9);

  const propertyPoints = result.chartData
    .map((d, i) => {
      const x = padding.left + (i / Math.max(result.chartData.length - 1, 1)) * plotWidth;
      const y = padding.top + (1 - d.propertyValue / maxPropertyValue) * plotHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const rightPoints = result.chartData
    .map((d, i) => {
      const x = padding.left + (i / Math.max(result.chartData.length - 1, 1)) * plotWidth;
      const val = rightMetric.value(d);
      const y = padding.top + (1 - (val - minRightMetric) / rightRange) * plotHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const activeIndex = hoverIndex ?? result.chartData.length - 1;
  const activePoint = result.chartData[activeIndex];

  const xForIndex = (idx: number): number =>
    padding.left + (idx / Math.max(result.chartData.length - 1, 1)) * plotWidth;

  const activeX = xForIndex(activeIndex);
  const activePropertyY = padding.top + (1 - activePoint.propertyValue / maxPropertyValue) * plotHeight;
  const activeRightMetricValue = rightMetric.value(activePoint);
  const activeRightY = padding.top + (1 - (activeRightMetricValue - minRightMetric) / rightRange) * plotHeight;

  const clampY = (y: number): number => Math.min(Math.max(y, padding.top + 12), chartHeight - padding.bottom - 8);
  const activePropertyLabelY = clampY(activePropertyY);
  const activeRightLabelY = clampY(activeRightY);

  const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(e.clientX - rect.left - padding.left, 0), plotWidth);
    const idx = Math.round((relativeX / Math.max(plotWidth, 1)) * Math.max(result.chartData.length - 1, 1));
    setHoverIndex(idx);
  };

  return (
    <main className="container">
      <h1>澳洲房产投资计算器</h1>
      <p className="hint">适合快速评估住宅投资物业的贷款压力、租金回报和年度现金流。</p>

      <section className="grid">
        <label>
          所在州（用于印花税）
          <select value={state} onChange={(e) => setState(e.target.value as State)}>
            <option value="NSW">NSW</option>
            <option value="VIC">VIC</option>
            <option value="QLD">QLD</option>
          </select>
        </label>

        <label>
          购房用途
          <select value={propertyUse} onChange={(e) => setPropertyUse(e.target.value as PropertyUse)}>
            <option value="investor">投资</option>
            <option value="owner">自住</option>
          </select>
        </label>


        <label>
          还款方式
          <select value={repaymentType} onChange={(e) => setRepaymentType(e.target.value as RepaymentType)}>
            <option value="principalInterest">等额本息</option>
            <option value="interestOnly">只还利息</option>
          </select>
        </label>


        <label>
          还款频率
          <select value={repaymentFrequency} onChange={(e) => setRepaymentFrequency(e.target.value as RepaymentFrequency)}>
            <option value="weekly">每周还款</option>
            <option value="fortnightly">每两周还款</option>
            <option value="monthly">每月还款</option>
          </select>
        </label>

        <label>
          房价 (AUD)
          <input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value) || 0)} />
        </label>

        <label>
          首付比例 (%)
          <input type="number" value={depositPct} onChange={(e) => setDepositPct(Number(e.target.value) || 0)} />
        </label>

        <label>
          贷款利率 (%)
          <input type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value) || 0)} />
        </label>

        <label>
          贷款年限
          <input type="number" value={loanTermYears} onChange={(e) => setLoanTermYears(Number(e.target.value) || 0)} />
        </label>

        <label>
          每周租金 (AUD)
          <input type="number" value={weeklyRent} onChange={(e) => setWeeklyRent(Number(e.target.value) || 0)} />
        </label>

        <label>
          入住率 (%)
          <input type="number" value={occupancyPct} onChange={(e) => setOccupancyPct(Number(e.target.value) || 0)} />
        </label>

        <label>
          物业管理费 (%)
          <input type="number" value={managementPct} onChange={(e) => setManagementPct(Number(e.target.value) || 0)} />
        </label>

        <label>
          维护费/年 (AUD)
          <input type="number" value={maintenanceAnnual} onChange={(e) => setMaintenanceAnnual(Number(e.target.value) || 0)} />
        </label>

        <label>
          市政费/年 (AUD)
          <input type="number" value={councilAnnual} onChange={(e) => setCouncilAnnual(Number(e.target.value) || 0)} />
        </label>

        <label>
          保险费/年 (AUD)
          <input type="number" value={insuranceAnnual} onChange={(e) => setInsuranceAnnual(Number(e.target.value) || 0)} />
        </label>

        <label>
          Strata/年 (AUD)
          <input type="number" value={strataAnnual} onChange={(e) => setStrataAnnual(Number(e.target.value) || 0)} />
        </label>

        <label>
          其他购房成本 (AUD)
          <input type="number" value={otherBuyingCosts} onChange={(e) => setOtherBuyingCosts(Number(e.target.value) || 0)} />
        </label>

        <label>
          CPI 年涨幅 (%)
          <input type="number" step="0.01" value={cpiAnnualGrowthPct} onChange={(e) => setCpiAnnualGrowthPct(Number(e.target.value) || 0)} />
        </label>

        <label>
          租金年涨幅 (%)
          <input type="number" step="0.01" value={rentAnnualGrowthPct} onChange={(e) => setRentAnnualGrowthPct(Number(e.target.value) || 0)} />
        </label>

        <label>
          房产价值年涨幅 (%)
          <input type="number" step="0.01" value={propertyValueAnnualGrowthPct} onChange={(e) => setPropertyValueAnnualGrowthPct(Number(e.target.value) || 0)} />
        </label>
      </section>

      <section className="result">
        <h2>计算结果</h2>
        <ul>
          <li>贷款金额：{currency.format(result.loan)}</li>
          <li>LVR：{result.lvrPct.toFixed(1)}%</li>
          <li>印花税预估：{currency.format(result.stamp)}</li>
          {propertyUse === 'owner' && <li>自住优惠减免：-{currency.format(result.concession)}</li>}
          <li>前期总投入：{currency.format(result.upfront)}</li>
          <li>年租金收入（按入住率）：{currency.format(result.grossRent)}</li>
          <li>年度运营成本（不含贷款）：{currency.format(result.totalExpenses)}</li>
          <li>年度贷款还款（{result.repaymentTypeLabel}）：{currencyWithCents.format(result.annualMortgage)}</li>
          <li>{result.repaymentFrequencyLabel}还款额：{currencyWithCents.format(result.periodRepayment)}</li>
          <li>（按每期还款四舍五入到分后汇总年还款）</li>
          <li>年度现金流：<strong>{currency.format(result.annualCashflow)}</strong></li>
          <li>毛租金回报率：{result.grossYieldPct.toFixed(2)}%</li>
          <li>净租金回报率：{result.netYieldPct.toFixed(2)}%</li>
          <li>预计下一年房产价值：{currency.format(result.nextYearPropertyValue)}</li>
          <li>预计下一年租金收入：{currency.format(result.nextYearRent)}</li>
          <li>预计下一年运营成本：{currency.format(result.nextYearExpenses)}</li>
          <li>预计下一年现金流：<strong>{currency.format(result.nextYearCashflow)}</strong></li>
          {result.irrByHorizon.map((item) => (
            <li key={item.years}>
              {item.years}年期杠杆IRR：
              <strong>{item.irr === null ? 'N/A' : `${(item.irr * 100).toFixed(2)}%`}</strong>
            </li>
          ))}
        </ul>

        <div className="chartCard">
          <h3>房产价值与右轴指标走势（X轴：年份）</h3>
          <div className="tabs" role="tablist" aria-label="右Y轴指标切换">
            <button className={rightAxisMetric === 'lvr' ? 'tab active' : 'tab'} onClick={() => setRightAxisMetric('lvr')}>
              LVR
            </button>
            <button className={rightAxisMetric === 'freeCashflow' ? 'tab active' : 'tab'} onClick={() => setRightAxisMetric('freeCashflow')}>
              自由现金流
            </button>
            <button className={rightAxisMetric === 'leveredGrossYield' ? 'tab active' : 'tab'} onClick={() => setRightAxisMetric('leveredGrossYield')}>
              杠杆毛租金回报率
            </button>
            <button className={rightAxisMetric === 'leveredNetYield' ? 'tab active' : 'tab'} onClick={() => setRightAxisMetric('leveredNetYield')}>
              杠杆净租金回报率
            </button>
          </div>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="chart"
            role="img"
            aria-label="房产价值与LVR双轴图表"
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} className="axis" />
            <line x1={padding.left} y1={chartHeight - padding.bottom} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} className="axis" />
            <line x1={chartWidth - padding.right} y1={padding.top} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} className="axis" />

            <polyline points={propertyPoints} className="lineProperty" />
            <polyline points={rightPoints} className="lineLvr" />

            <text x={padding.left} y={padding.top - 6} className="labelProperty">左Y  房产价值 (AUD)</text>
            <text x={chartWidth - padding.right} y={padding.top - 6} textAnchor="end" className="labelLvr">右Y  {rightMetric.label}</text>

            <line x1={activeX} y1={padding.top} x2={activeX} y2={chartHeight - padding.bottom} className="guide" />
            <circle cx={activeX} cy={activePropertyY} r={4} className="markerProperty" />
            <circle cx={activeX} cy={activeRightY} r={4} className="markerLvr" />

            <text x={padding.left} y={chartHeight - 8} className="tick">0</text>
            <text x={chartWidth - padding.right} y={chartHeight - 8} textAnchor="end" className="tick">30 年</text>
            <text x={padding.left - 8} y={activePropertyLabelY} textAnchor="end" className="tick">
              {currency.format(activePoint.propertyValue)}
            </text>
            <text x={chartWidth - padding.right + 8} y={activeRightLabelY} className="tick">
              {rightMetric.format(activeRightMetricValue)}
            </text>
            <text x={activeX} y={padding.top + 16} textAnchor="middle" className="tick">第 {activePoint.year} 年</text>

            {result.chartData.map((d, i) => {
              if (i === 0 || i === result.chartData.length - 1 || i % 5 === 0) {
                const x = padding.left + (i / Math.max(result.chartData.length - 1, 1)) * plotWidth;
                return (
                  <text key={d.year} x={x} y={chartHeight - padding.bottom + 16} textAnchor="middle" className="tick">
                    {d.year}
                  </text>
                );
              }
              return null;
            })}
          </svg>
          <p className="hint">蓝线=房产价值（左轴），橙线=右轴选中指标。可通过选项卡切换右Y轴，并在悬停时查看动态轴值（固定30年）。</p>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          注：QLD 自住按 QRO home concession 档位估算；VIC {">"} 960,000 按 SRO 常见一般税率 5.5% 全额估算；NSW/VIC 未包含首置/特殊减免政策。
        </p>
      </section>
    </main>
  );
}
