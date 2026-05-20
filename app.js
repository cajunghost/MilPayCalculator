let data = window.MILPAY_DATA || {
  ...(window.MILPAY_PAY_DATA || { grades: [], payTable: {} }),
  bahLocalities: []
};

const state = {
  view: "plan",
  mode: "command",
  strategy: "avalanche",
  profile: {
    grade: "",
    years: "",
    zip: "",
    dependents: "",
    specialPays: "",
    deductions: "",
    tspRate: "",
    protectedBah: "",
    startingTsp: "",
    returnRate: ""
  },
  tax: {
    preset: "0",
    federal: 0,
    state: 0,
    fica: 0,
    other: 0
  },
  extraIncome: [],
  scenario: {
    grade: "",
    yearsDelta: 0,
    zip: "",
    dependents: "",
    specialPayDelta: 0,
    deductionsDelta: 0,
    tspDelta: 0,
    expenseDelta: 0
  }
};

const categories = [
  "Housing / Mortgage",
  "Utilities",
  "Groceries",
  "Transportation / Fuel",
  "Insurance",
  "Debt Payments",
  "Subscriptions",
  "Childcare / Family",
  "Savings / Investing",
  "Healthcare",
  "Education",
  "Taxes / Fees",
  "Miscellaneous"
];

const debtTypes = ["Credit Card", "Vehicle Loan", "Student Loan", "Mortgage", "Personal Loan", "Medical Debt", "HELOC", "Other Debt"];

const budgetLines = [];

const debts = [];

const fallbackZipToMha = {
  "36112": "AL005",
  "92101": "CA038",
  "80913": "CO046",
  "20001": "DC053",
  "78234": "TX285",
  "23511": "VA298"
};
let zipToMha = window.ZIP_TO_MHA || fallbackZipToMha;

const usafAveragePromotionTracks = {
  enlisted: [["E1", 0], ["E2", 1], ["E3", 2], ["E4", 3], ["E5", 5], ["E6", 11], ["E7", 16], ["E8", 20], ["E9", 23]],
  warrant: [["W1", 0], ["W2", 2], ["W3", 8], ["W4", 14], ["W5", 20]],
  officer: [["O1", 0], ["O2", 2], ["O3", 4], ["O4", 10], ["O5", 16], ["O6", 21], ["O7", 25], ["O8", 28], ["O9", 31], ["O10", 34]],
  priorOfficer: [["O1E", 0], ["O2E", 2], ["O3E", 4], ["O4", 10], ["O5", 16], ["O6", 21], ["O7", 25], ["O8", 28], ["O9", 31], ["O10", 34]]
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

function currency(value) {
  return money.format(Number.isFinite(value) ? value : 0);
}

function ratePercent(value) {
  return value === "" ? "" : Math.round(Number(value || 0) * 100);
}

function profileReady(profile = state.profile) {
  return Boolean(profile.grade && profile.years !== "" && profile.dependents && resolvedMha(profile));
}

function gradeLabel(value) {
  return data.grades.find((grade) => grade.value === value)?.label || "Select grade";
}

function localityByMha(mha) {
  return data.bahLocalities.find((item) => item.mha === mha);
}

async function loadReferenceData() {
  const needsBah = !data.bahLocalities?.length;
  const needsZip = zipToMha === fallbackZipToMha;
  if (!needsBah && !needsZip) return;

  const [zipResponse, bahResponse] = await Promise.all([
    needsZip ? fetch("https://milmultiplier.com/ziptomha.json") : Promise.resolve(null),
    needsBah ? fetch("https://milmultiplier.com/bahbymha.json") : Promise.resolve(null)
  ]);

  if (zipResponse) zipToMha = await zipResponse.json();
  if (bahResponse) {
    const ratesByMha = await bahResponse.json();
    const namesByMha = Object.fromEntries((window.MILPAY_BAH_NAMES || []).map((item) => [item.mha, item.name]));
    data = {
      ...data,
      bahLocalities: Object.entries(ratesByMha).map(([mha, rates]) => {
        const normalized = { with: {}, without: {} };
        Object.entries(rates).forEach(([grade, values]) => {
          const key = grade.replaceAll("-", "");
          normalized.with[key] = values.with;
          normalized.without[key] = values.without;
        });
        return { mha, name: namesByMha[mha] || mha, rates: normalized };
      })
    };
  }
}

function normalizeZip(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 5);
}

function mhaForZip(zip) {
  return zipToMha[normalizeZip(zip)] || "";
}

function resolvedMha(profile = state.profile) {
  return mhaForZip(profile.zip);
}

function selectedLocality() {
  return localityByMha(resolvedMha(state.profile));
}

function lookupPay(profile = state.profile) {
  if (!profile.grade || profile.years === "") return 0;
  const rows = data.payTable[profile.grade] || [];
  const years = Number(profile.years);
  return rows.filter((row) => row.years <= years).sort((a, b) => b.years - a.years)[0]?.monthly ?? 0;
}

function lookupBah(profile = state.profile) {
  const mha = resolvedMha(profile);
  if (!profile.grade || !profile.dependents || !mha) return Number(profile.protectedBah) || 0;
  const loc = localityByMha(mha);
  const dependencyKey = profile.dependents === "with" ? "with" : "without";
  const rawRate = loc?.rates?.[dependencyKey]?.[profile.grade] ?? 0;
  return Math.max(rawRate, Number(profile.protectedBah) || 0);
}

function bas(profile = state.profile) {
  if (!profile.grade) return 0;
  return profile.grade.startsWith("O") ? 328.48 : 476.95;
}

function taxableExtraIncome() {
  return state.extraIncome.reduce((sum, item) => sum + (item.taxable ? item.monthly : 0), 0);
}

function extraIncomeGross() {
  return state.extraIncome.reduce((sum, item) => sum + item.monthly, 0);
}

function combinedTaxRate() {
  return Number(state.tax.federal || 0) + Number(state.tax.state || 0) + Number(state.tax.fica || 0) + Number(state.tax.other || 0);
}

function taxablePay(profile = state.profile) {
  return lookupPay(profile) + Number(profile.specialPays || 0) + taxableExtraIncome();
}

function compensation(profile = state.profile) {
  const basicPay = lookupPay(profile);
  const bah = lookupBah(profile);
  const monthlyBas = bas(profile);
  const specialPays = Number(profile.specialPays || 0);
  const tsp = basicPay * Number(profile.tspRate || 0);
  const grossMilitary = basicPay + bah + monthlyBas + specialPays;
  const estimatedTax = taxablePay(profile) * combinedTaxRate();
  const net = grossMilitary + extraIncomeGross() - estimatedTax - tsp - Number(profile.deductions || 0);
  return { basicPay, bah, bas: monthlyBas, specialPays, tsp, grossMilitary, extraGross: extraIncomeGross(), estimatedTax, net };
}

function plannedSpend() {
  return budgetLines.reduce((sum, line) => sum + Number(line.planned || 0), 0);
}

function actualSpend() {
  return budgetLines.reduce((sum, line) => sum + Number(line.actual || 0), 0);
}

function trackForGrade(grade) {
  if (!grade) return [];
  if (grade.startsWith("E")) return usafAveragePromotionTracks.enlisted;
  if (grade.startsWith("W")) return usafAveragePromotionTracks.warrant;
  if (grade.endsWith("E")) return usafAveragePromotionTracks.priorOfficer;
  return usafAveragePromotionTracks.officer;
}

function projectedGrade(years, grade = state.profile.grade) {
  if (!grade) return "";
  const track = trackForGrade(grade);
  return track.filter(([, threshold]) => threshold <= years).at(-1)?.[0] ?? grade;
}

function projectedGradeFromSelected(startGrade, startYears, projectedYears) {
  if (!startGrade) return "";
  const track = trackForGrade(startGrade);
  const startIndex = track.findIndex(([grade]) => grade === startGrade);
  if (startIndex < 0) return startGrade;
  const selectedAverageTis = track[startIndex][1];
  const elapsed = projectedYears - startYears;
  const equivalentAverageTis = selectedAverageTis + elapsed;
  return track
    .slice(startIndex)
    .filter(([, threshold]) => threshold <= equivalentAverageTis)
    .at(-1)?.[0] ?? startGrade;
}

function nextGrade(profile = state.profile) {
  if (!profile.grade) return "";
  const track = trackForGrade(profile.grade);
  const index = track.findIndex(([grade]) => grade === profile.grade);
  return track[Math.min(index + 1, track.length - 1)]?.[0] || profile.grade;
}

function nextPromotionInfo(profile = state.profile) {
  if (!profile.grade || profile.years === "") {
    return { nextGrade: "", yearsUntil: null, threshold: null };
  }
  const track = trackForGrade(profile.grade);
  const currentIndex = track.findIndex(([grade]) => grade === profile.grade);
  if (currentIndex < 0 || currentIndex >= track.length - 1) {
    return { nextGrade: profile.grade, yearsUntil: null, threshold: null };
  }
  const currentAverageTis = track[currentIndex][1];
  const next = track[currentIndex + 1];
  const yearsUntil = Math.max(0, next[1] - currentAverageTis);
  return { nextGrade: next[0], yearsUntil, threshold: next[1] };
}

function retirementProjection() {
  if (!state.profile.grade || state.profile.years === "") return [];
  let balance = Number(state.profile.startingTsp || 0);
  const startYear = new Date().getFullYear();
  const startingYears = Number(state.profile.years || 0);
  const projectionYears = Math.max(1, 51 - Math.min(startingYears, 50));
  const monthlyReturnRate = Math.pow(1 + Number(state.profile.returnRate || 0), 1 / 12) - 1;
  return Array.from({ length: projectionYears }, (_, index) => {
    const years = startingYears + index;
    const grade = index === 0
      ? state.profile.grade
      : projectedGradeFromSelected(state.profile.grade, startingYears, years);
    const projectedProfile = { ...state.profile, grade, years };
    const pay = lookupPay(projectedProfile);
    const match = pay * 0.05;
    const memberContribution = pay * Number(state.profile.tspRate || 0);
    const monthlyTsp = match + memberContribution;
    const startingBalance = balance;
    for (let month = 0; month < 12; month += 1) {
      balance = (balance + monthlyTsp) * (1 + monthlyReturnRate);
    }
    return { year: startYear + index, years, grade, pay, memberContribution, match, monthlyTsp, startingBalance, balance };
  });
}

function scenarioProfile() {
  const profile = { ...state.profile };
  profile.grade = state.scenario.grade || profile.grade;
  profile.years = Number(profile.years || 0) + Number(state.scenario.yearsDelta || 0);
  profile.zip = normalizeZip(state.scenario.zip) || profile.zip;
  profile.dependents = state.scenario.dependents || profile.dependents;
  profile.specialPays = Number(profile.specialPays || 0) + Number(state.scenario.specialPayDelta || 0);
  profile.deductions = Math.max(0, Number(profile.deductions || 0) + Number(state.scenario.deductionsDelta || 0));
  profile.tspRate = Math.max(0, Number(profile.tspRate || 0) + Number(state.scenario.tspDelta || 0));
  return profile;
}

function metric(label, value, className = "") {
  return `<div class="metric"><span>${label}</span><strong class="${className}">${value}</strong></div>`;
}

function optionList(options, selected) {
  return options.map((option) => `<option value="${option}" ${option === selected ? "selected" : ""}>${option}</option>`).join("");
}

function inputValue(value) {
  return value === "" ? "" : value;
}

function percentInputValue(value) {
  return Number(value || 0) === 0 ? "" : ratePercent(value);
}

function renderDataPairingNotice() {
  const loc = selectedLocality();
  const zip = normalizeZip(state.profile.zip);
  const parts = [
    `Pay grade: ${gradeLabel(state.profile.grade)}`,
    `YOS bracket: ${state.profile.years === "" ? "Select years" : `${state.profile.years} years`}`,
    `Duty ZIP: ${zip || "Enter ZIP"}`,
    `BAH locality: ${loc ? `${loc.mha} / ${loc.name}` : "ZIP not mapped"}`,
    `Taxable pay base: ${currency(taxablePay())}`
  ];
  return `<div class="notice">${parts.join(" | ")}</div>`;
}

function localityTextForProfile(profile, emptyText = "Enter duty ZIP") {
  const zip = normalizeZip(profile.zip);
  if (!zip) return emptyText;
  if (zip.length < 5) return "Enter 5-digit ZIP";
  const mha = resolvedMha(profile);
  const loc = localityByMha(mha);
  if (!mha) return "ZIP not found in BAH locality data";
  if (!loc) return `${mha} / locality not in workbook rate table`;
  return `${mha} / ${loc.name}`;
}

function renderResolvedLocalities() {
  document.querySelector("#resolved-locality").textContent = localityTextForProfile(state.profile);
  document.querySelector("#scenario-resolved-locality").textContent = localityTextForProfile(scenarioProfile(), "Uses Plan ZIP");
}

function renderKpis() {
  const c = compensation();
  const remaining = c.net - plannedSpend();
  const ready = profileReady();
  return `
    <div class="kpi-grid">
      <div class="kpi"><span>Basic pay</span><strong>${currency(c.basicPay)}</strong></div>
      <div class="kpi"><span>BAH</span><strong>${currency(c.bah)}</strong></div>
      <div class="kpi"><span>Withholding</span><strong>${currency(c.estimatedTax)}</strong></div>
      <div class="kpi"><span>Planned surplus</span><strong class="${ready && remaining >= 0 ? "positive" : ready ? "negative" : ""}">${ready ? currency(remaining) : "Complete profile"}</strong></div>
    </div>`;
}

function renderModePanel() {
  const c = compensation();
  const remaining = c.net - plannedSpend();
  const fill = c.net > 0 ? Math.min(100, plannedSpend() / c.net * 100) : 0;
  const panel = document.querySelector("#mode-panel");
  if (state.mode === "command") {
    panel.innerHTML = `
      <div class="panel-heading"><div><span class="heading-kicker">Executive summary</span><h3>Compensation Overview</h3></div><span>${pct.format(combinedTaxRate())} withholding</span></div>
      ${renderDataPairingNotice()}
      ${renderKpis()}
      <div class="cash-bar" aria-label="planned spend share"><span style="--fill:${fill}%"></span></div>
      <div class="metric-list">
        ${metric("Gross military", currency(c.grossMilitary))}
        ${metric("Net income after tax", currency(c.net))}
        ${metric("Planned spending", currency(plannedSpend()))}
        ${metric("Remaining", currency(remaining), remaining >= 0 ? "positive" : "negative")}
      </div>`;
  }
  if (state.mode === "ledger") {
    panel.innerHTML = `
      <div class="panel-heading"><div><span class="heading-kicker">Detailed pay lines</span><h3>Monthly Pay Ledger</h3></div><span>Taxable and non-taxable</span></div>
      ${renderDataPairingNotice()}
      <div class="metric-list">
        ${metric("Basic pay", currency(c.basicPay))}
        ${metric("BAH", currency(c.bah))}
        ${metric("BAS", currency(c.bas))}
        ${metric("Special pays", currency(c.specialPays))}
        ${metric("Extra income", currency(c.extraGross))}
        ${metric("TSP", `-${currency(c.tsp)}`)}
        ${metric("Deductions", `-${currency(state.profile.deductions)}`)}
        ${metric("Estimated withholding", `-${currency(c.estimatedTax)}`)}
        ${metric("Net income", currency(c.net), c.net >= 0 ? "positive" : "negative")}
      </div>`;
  }
  if (state.mode === "brief") {
    const ready = profileReady();
    const promo = nextPromotionInfo();
    const projected = scenarioProfile();
    const projectedComp = compensation(projected);
    const tspRows = retirementProjection();
    const fiveYearTsp = tspRows[Math.min(4, Math.max(0, tspRows.length - 1))]?.balance ?? 0;
    const nextGradeLabel = promo.nextGrade ? gradeLabel(promo.nextGrade) : "Select grade";
    const promotionTiming = promo.yearsUntil === null ? "Top or unknown track" : `${promo.yearsUntil} avg years`;
    const promotionDelta = promo.nextGrade && promo.nextGrade !== state.profile.grade
      ? compensation({ ...state.profile, grade: promo.nextGrade, years: Number(state.profile.years || 0) + promo.yearsUntil }).basicPay - c.basicPay
      : 0;
    panel.innerHTML = `
      <div class="panel-heading"><div><span class="heading-kicker">Career planning brief</span><h3>${ready ? (remaining >= 0 ? "Plan is funded" : "Plan needs attention") : "Fill in your profile"}</h3></div><span>Promotions and levers</span></div>
      ${renderDataPairingNotice()}
      <p class="brief-copy">A planning snapshot that combines pay, promotion timing, housing allowance, TSP momentum, and cash flow signals.</p>
      ${renderKpis()}
      <div class="insight-grid">
        <div class="insight-card"><span>Next promotion</span><strong>${nextGradeLabel}</strong><p>${promotionTiming}</p></div>
        <div class="insight-card"><span>Basic pay lift</span><strong>${currency(promotionDelta)}</strong><p>Estimated monthly increase at next grade</p></div>
        <div class="insight-card"><span>Five-year TSP</span><strong>${currency(fiveYearTsp)}</strong><p>Monthly contributions with compounding</p></div>
        <div class="insight-card"><span>Scenario net</span><strong>${currency(projectedComp.net - c.net)}</strong><p>Current scenario monthly change</p></div>
      </div>
      <div class="recommendation-list">
        <p><strong>Promotion watch:</strong> compare next-grade basic pay against PCS or housing changes before locking in a long-term budget.</p>
        <p><strong>BAH sensitivity:</strong> use Scenarios to test a new duty ZIP and dependent setting before a move.</p>
        <p><strong>TSP lever:</strong> raising the Plan TSP rate changes net pay now and compounds in the TSP tab.</p>
      </div>`;
  }
}

function renderBudgetSummary() {
  const c = compensation();
  const rows = [
    ["Net income after tax", c.net],
    ["Planned expenses", plannedSpend()],
    ["Actual expenses", actualSpend()],
    ["Remaining planned", c.net - plannedSpend()]
  ];
  document.querySelector("#budget-summary").innerHTML = rows.map(([label, value]) => `
    <div class="summary-card"><span>${label}</span><strong class="${value >= 0 ? "" : "negative"}">${currency(value)}</strong></div>
  `).join("");
}

function renderBudget() {
  const c = compensation();
  renderBudgetSummary();

  document.querySelector("#budget-table").innerHTML = budgetLines.length ? budgetLines.map((line, index) => {
    const review = c.net > 0 && line.planned > c.net * 0.15 && line.planned > 0;
    return `
      <tr>
        <td><input class="inline-input" data-budget="${index}" data-field="name" value="${line.name}"></td>
        <td><select class="inline-input" data-budget="${index}" data-field="category">${optionList(categories, line.category)}</select></td>
        <td class="money"><input class="money-input" type="number" min="0" step="25" data-budget="${index}" data-field="planned" value="${line.planned}"></td>
        <td class="money"><input class="money-input" type="number" min="0" step="25" data-budget="${index}" data-field="actual" value="${line.actual}"></td>
        <td><span class="status-pill ${review ? "review" : ""}">${review ? "Review" : "OK"}</span></td>
        <td><button class="icon-button" data-delete-budget="${index}" type="button" title="Delete row">X</button></td>
      </tr>`;
  }).join("") : `<tr><td colspan="6">Add an expense row to start building the budget.</td></tr>`;
  bindBudgetInputs();
}

function bindBudgetInputs() {
  document.querySelectorAll("[data-budget]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.budget);
      const field = event.target.dataset.field;
      budgetLines[index][field] = ["name", "category"].includes(field) ? event.target.value : Number(event.target.value || 0);
      renderModePanel();
      renderBudgetSummary();
      renderScenario();
    });
  });
  document.querySelectorAll("[data-delete-budget]").forEach((button) => {
    button.addEventListener("click", () => {
      budgetLines.splice(Number(button.dataset.deleteBudget), 1);
      render();
    });
  });
}

function renderDebt() {
  const ordered = [...debts].map((debt, originalIndex) => ({ ...debt, originalIndex })).sort((a, b) => {
    if (state.strategy === "avalanche") return b.apr - a.apr;
    if (state.strategy === "snowball") return a.balance - b.balance;
    return a.priority - b.priority;
  });
  document.querySelector("#debt-list").innerHTML = `
    <div class="debt-grid debt-header" aria-hidden="true">
      <span>Order</span>
      <span>Debt name</span>
      <span>Type</span>
      <span>Balance</span>
      <span>APR %</span>
      <span>Payment</span>
      <span></span>
    </div>
    ${ordered.length ? ordered.map((debt, index) => `
      <div class="debt-grid debt-edit-row">
        <div class="debt-index">${index + 1}</div>
        <input class="inline-input" data-debt="${debt.originalIndex}" data-field="name" value="${debt.name}" aria-label="Debt name">
        <select class="inline-input" data-debt="${debt.originalIndex}" data-field="type" aria-label="Debt type">${optionList(debtTypes, debt.type)}</select>
        <input class="money-input" type="number" min="0" step="100" data-debt="${debt.originalIndex}" data-field="balance" value="${debt.balance}" aria-label="Balance">
        <input class="money-input" type="number" min="0" step="0.1" data-debt="${debt.originalIndex}" data-field="aprPercent" value="${percentInputValue(debt.apr)}" aria-label="APR percent">
        <input class="money-input" type="number" min="0" step="25" data-debt="${debt.originalIndex}" data-field="payment" value="${debt.payment}" aria-label="Payment">
        <button class="icon-button" data-delete-debt="${debt.originalIndex}" type="button" title="Delete debt">X</button>
      </div>
    `).join("") : `<div class="empty-state compact-empty">Add a debt account to start payoff planning.</div>`}`;
  bindDebtInputs();
}

function bindDebtInputs() {
  document.querySelectorAll("[data-debt]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.debt);
      const field = event.target.dataset.field;
      if (field === "aprPercent") debts[index].apr = Number(event.target.value || 0) / 100;
      else debts[index][field] = ["name", "type"].includes(field) ? event.target.value : Number(event.target.value || 0);
    });
  });
  document.querySelectorAll("[data-delete-debt]").forEach((button) => {
    button.addEventListener("click", () => {
      debts.splice(Number(button.dataset.deleteDebt), 1);
      renderDebt();
    });
  });
}

function renderTsp() {
  const rows = retirementProjection();
  const max = Math.max(...rows.map((row) => row.balance), 1);
  const loc = selectedLocality();
  const ready = state.profile.grade && state.profile.years !== "";
  document.querySelector("#tsp-profile-summary").textContent = ready
    ? `${gradeLabel(state.profile.grade)} / ${state.profile.years} YOS / ${loc ? loc.name : "No mapped BAH locality"} / TSP ${ratePercent(state.profile.tspRate)}% / Projection to 50 YOS`
    : "Select grade and years of service on the Plan tab to build the TSP projection.";
  document.querySelector("#tsp-chart").innerHTML = ready ? rows.map((row) => {
    const height = Math.max(8, row.balance / max * 100);
    return `<div class="bar" title="${row.year}: ${currency(row.balance)}" style="--h:${height}%"></div>`;
  }).join("") : `<div class="empty-state">No projection yet</div>`;
  document.querySelector("#tsp-table").innerHTML = ready ? rows.map((row) => `
    <tr>
      <td>${row.year}</td>
      <td>${row.years}</td>
      <td>${gradeLabel(row.grade)}</td>
      <td class="money tsp-money">${currency(row.memberContribution)}</td>
      <td class="money tsp-money">${currency(row.match)}</td>
      <td class="money tsp-money">${currency(row.monthlyTsp)}</td>
      <td class="money tsp-money">${currency(row.balance)}</td>
    </tr>
  `).join("") : `<tr><td colspan="7">Select grade and years of service on the Plan tab.</td></tr>`;
}

function renderScenario() {
  const current = compensation();
  const projected = compensation(scenarioProfile());
  const projectedExpenses = Math.max(0, plannedSpend() + Number(state.scenario.expenseDelta || 0));
  const rows = [
    ["Basic pay", current.basicPay, projected.basicPay],
    ["BAH", current.bah, projected.bah],
    ["Net monthly", current.net, projected.net],
    ["Expenses", plannedSpend(), projectedExpenses],
    ["Surplus", current.net - plannedSpend(), projected.net - projectedExpenses]
  ];
  document.querySelector("#scenario-grid").innerHTML = rows.map(([label, currentValue, projectedValue]) => {
    const delta = projectedValue - currentValue;
    return `
      <div class="scenario-card">
        <span>${label}</span>
        <strong class="${delta >= 0 ? "positive" : "negative"}">${currency(delta)}</strong>
        <p>${currency(currentValue)} -> ${currency(projectedValue)}</p>
      </div>`;
  }).join("");
}

function syncInputs() {
  document.querySelector("#grade").value = state.profile.grade;
  document.querySelector("#years").value = state.profile.years;
  document.querySelector("#zip").value = state.profile.zip;
  document.querySelector("#dependents").value = state.profile.dependents;
  document.querySelector("#specialPays").value = state.profile.specialPays;
  document.querySelector("#deductions").value = state.profile.deductions;
  document.querySelector("#tspRate").value = ratePercent(state.profile.tspRate);
  document.querySelector("#protectedBah").value = state.profile.protectedBah;
  document.querySelector("#withholdingPreset").value = state.tax.preset;
  document.querySelector("#federalRate").value = percentInputValue(state.tax.federal);
  document.querySelector("#stateRate").value = percentInputValue(state.tax.state);
  document.querySelector("#ficaRate").value = percentInputValue(state.tax.fica);
  document.querySelector("#otherRate").value = percentInputValue(state.tax.other);
  document.querySelector("#startingTsp").value = state.profile.startingTsp;
  document.querySelector("#returnRate").value = ratePercent(state.profile.returnRate);
  document.querySelector("#scenarioGrade").value = state.scenario.grade;
  document.querySelector("#scenarioYearsDelta").value = state.scenario.yearsDelta;
  document.querySelector("#scenarioZip").value = state.scenario.zip;
  document.querySelector("#scenarioDependents").value = state.scenario.dependents;
  document.querySelector("#scenarioSpecialPayDelta").value = state.scenario.specialPayDelta;
  document.querySelector("#scenarioDeductionsDelta").value = state.scenario.deductionsDelta;
  document.querySelector("#scenarioTspDelta").value = percentInputValue(state.scenario.tspDelta);
  document.querySelector("#scenarioExpenseDelta").value = state.scenario.expenseDelta;
}

function render() {
  syncInputs();
  renderResolvedLocalities();
  renderModePanel();
  renderBudget();
  renderDebt();
  renderTsp();
  renderScenario();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active", element.id === `${view}-view`));
  document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelector("#view-title").textContent = document.querySelector(`[data-view="${view}"] span:last-child`).textContent;
}

function fillSelects() {
  const gradeOptions = `<option value="">No change / select grade</option>` + data.grades.map((grade) => `<option value="${grade.value}">${grade.label}</option>`).join("");
  document.querySelector("#grade").innerHTML = gradeOptions.replace("No change / ", "");
  document.querySelector("#scenarioGrade").innerHTML = gradeOptions;
}

function applyWithholdingPreset(value) {
  state.tax.preset = value;
  const rate = Number(value || 0);
  state.tax.federal = rate;
  state.tax.state = 0;
  state.tax.fica = 0;
  state.tax.other = 0;
}

function bind() {
  fillSelects();

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll(".mode-button").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });
  document.querySelectorAll(".strategy-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.strategy = button.dataset.strategy;
      document.querySelectorAll(".strategy-button").forEach((item) => item.classList.toggle("active", item === button));
      renderDebt();
    });
  });

  document.querySelector("#add-budget-row").addEventListener("click", () => {
    budgetLines.push({ name: "", category: "Miscellaneous", planned: "", actual: "" });
    renderBudget();
  });
  document.querySelector("#add-debt-row").addEventListener("click", () => {
    debts.push({ name: "", type: "Other Debt", balance: "", apr: 0, payment: "", priority: debts.length + 1 });
    renderDebt();
  });

  ["grade", "years", "zip", "dependents", "specialPays", "deductions", "tspRate", "protectedBah", "startingTsp", "returnRate"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      const value = event.target.value;
      if (["grade", "dependents"].includes(id)) state.profile[id] = value;
      else if (id === "zip") state.profile.zip = normalizeZip(value);
      else if (["tspRate", "returnRate"].includes(id)) state.profile[id] = value === "" ? "" : Number(value) / 100;
      else state.profile[id] = value === "" ? "" : Number(value);
      render();
    });
  });

  document.querySelector("#withholdingPreset").addEventListener("input", (event) => {
    applyWithholdingPreset(event.target.value);
    render();
  });
  ["federalRate", "stateRate", "ficaRate", "otherRate"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      state.tax.preset = "0";
      const key = id.replace("Rate", "");
      state.tax[key] = Number(event.target.value || 0) / 100;
      render();
    });
  });

  ["scenarioGrade", "scenarioDependents"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      state.scenario[id.replace("scenario", "").replace(/^./, (c) => c.toLowerCase())] = event.target.value;
      renderScenario();
    });
  });
  document.querySelector("#scenarioZip").addEventListener("input", (event) => {
    state.scenario.zip = normalizeZip(event.target.value);
    renderResolvedLocalities();
    renderScenario();
  });
  ["scenarioYearsDelta", "scenarioSpecialPayDelta", "scenarioDeductionsDelta", "scenarioExpenseDelta"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      state.scenario[id.replace("scenario", "").replace(/^./, (c) => c.toLowerCase())] = Number(event.target.value || 0);
      renderScenario();
    });
  });
  document.querySelector("#scenarioTspDelta").addEventListener("input", (event) => {
    state.scenario.tspDelta = Number(event.target.value || 0) / 100;
    renderScenario();
  });
}

loadReferenceData()
  .then(() => {
    bind();
    render();
  })
  .catch((error) => {
    console.error("Unable to load public BAH reference data", error);
    bind();
    render();
  });

window.MilPayBudgetDebug = {
  state,
  render,
  retirementProjection
};
