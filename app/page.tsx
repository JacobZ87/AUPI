'use client';

import { useMemo, useState } from 'react';

type State = 'NSW' | 'VIC' | 'QLD';
type PropertyUse = 'owner' | 'investor';

const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0
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

function annualRepayment(principal: number, annualRatePct: number, years: number): number {
  const months = years * 12;
  const monthlyRate = annualRatePct / 100 / 12;
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / years;
  const monthlyPayment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return monthlyPayment * 12;
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
  const [state, setState] = useState<State>('NSW');
  const [propertyUse, setPropertyUse] = useState<PropertyUse>('investor');

  const result = useMemo(() => {
    const deposit = purchasePrice * (depositPct / 100);
    const loan = Math.max(purchasePrice - deposit, 0);
    const stampResult = stampDuty(state, purchasePrice, propertyUse);
    const stamp = stampResult.final;
    const upfront = deposit + stamp + otherBuyingCosts;

    const grossRent = weeklyRent * 52 * (occupancyPct / 100);
    const managementFee = grossRent * (managementPct / 100);
    const totalExpenses = managementFee + maintenanceAnnual + councilAnnual + insuranceAnnual + strataAnnual;

    const annualMortgage = annualRepayment(loan, interestRate, loanTermYears);
    const annualCashflow = grossRent - totalExpenses - annualMortgage;

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
      lvrPct
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
    state,
    propertyUse
  ]);

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
          <li>年度贷款还款：{currency.format(result.annualMortgage)}</li>
          <li>年度现金流：<strong>{currency.format(result.annualCashflow)}</strong></li>
          <li>毛租金回报率：{result.grossYieldPct.toFixed(2)}%</li>
          <li>净租金回报率：{result.netYieldPct.toFixed(2)}%</li>
        </ul>
        <p className="hint" style={{ marginTop: 12 }}>
          注：QLD 自住按 QRO home concession 档位估算；VIC {">"} 960,000 按 SRO 常见一般税率 5.5% 全额估算；NSW/VIC 未包含首置/特殊减免政策。
        </p>
      </section>
    </main>
  );
}
