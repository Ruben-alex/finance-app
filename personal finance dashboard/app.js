const STORAGE_KEY = "pf_dashboard_transactions_v1";
const DEFAULT_CURRENCY = "INR";

const els = {
  balanceValue: document.getElementById("balanceValue"),
  balanceHint: document.getElementById("balanceHint"),
  incomeValue: document.getElementById("incomeValue"),
  expenseValue: document.getElementById("expenseValue"),

  form: document.getElementById("txForm"),
  submitBtn: document.getElementById("submitBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  formMessage: document.getElementById("formMessage"),

  type: document.getElementById("type"),
  amount: document.getElementById("amount"),
  category: document.getElementById("category"),
  date: document.getElementById("date"),
  note: document.getElementById("note"),

  txTbody: document.getElementById("txTbody"),
  emptyState: document.getElementById("emptyState"),

  search: document.getElementById("search"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  resetBtn: document.getElementById("resetBtn"),
};

/** @type {{ filter: "all" | "income" | "expense", query: string, editingId: string | null }} */
const uiState = {
  filter: "all",
  query: "",
  editingId: null,
};

/** @type {Array<{id: string, type: "income"|"expense", amount: number, category: string, note: string, date: string, createdAt: number}>} */
let transactions = [];

function formatMoney(amount, currency = DEFAULT_CURRENCY) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const fixed = Number(amount).toFixed(2);
    return `₹${fixed}`;
  }
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        id: String(t.id ?? crypto.randomUUID()),
        type: t.type === "income" ? "income" : "expense",
        amount: Number(t.amount) || 0,
        category: String(t.category ?? ""),
        note: String(t.note ?? ""),
        date: String(t.date ?? todayISO()),
        createdAt: Number(t.createdAt) || Date.now(),
      }));
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function computeTotals() {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  const balance = income - expense;
  return { income, expense, balance };
}

function setMessage(text) {
  els.formMessage.textContent = text || "";
}

function setEditing(id) {
  uiState.editingId = id;
  const isEditing = Boolean(id);
  els.submitBtn.textContent = isEditing ? "Save changes" : "Add transaction";
  els.cancelEditBtn.hidden = !isEditing;
}

function fillForm(t) {
  els.type.value = t.type;
  els.amount.value = String(t.amount);
  els.category.value = t.category || "";
  els.date.value = t.date || todayISO();
  els.note.value = t.note || "";
}

function resetForm() {
  els.form.reset();
  els.type.value = "expense";
  els.date.value = todayISO();
  setEditing(null);
  setMessage("");
  els.amount.focus();
}

function matchesQuery(t, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (t.category || "").toLowerCase().includes(q) ||
    (t.note || "").toLowerCase().includes(q) ||
    t.type.toLowerCase().includes(q) ||
    t.date.toLowerCase().includes(q)
  );
}

function getVisibleTransactions() {
  let list = transactions.slice();

  if (uiState.filter !== "all") {
    list = list.filter((t) => t.type === uiState.filter);
  }
  if (uiState.query) {
    list = list.filter((t) => matchesQuery(t, uiState.query));
  }

  list.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt - a.createdAt;
  });
  return list;
}

function renderSummary() {
  const { income, expense, balance } = computeTotals();
  els.incomeValue.textContent = formatMoney(income);
  els.expenseValue.textContent = formatMoney(expense);
  els.balanceValue.textContent = formatMoney(balance);

  if (transactions.length === 0) {
    els.balanceHint.textContent = "Add transactions to see your balance.";
  } else if (balance > 0) {
    els.balanceHint.textContent = "You’re positive. Nice work keeping expenses under control.";
  } else if (balance < 0) {
    els.balanceHint.textContent = "You’re negative. Consider reducing expenses or adding income.";
  } else {
    els.balanceHint.textContent = "You’re exactly at zero.";
  }
}

function pill(type) {
  const label = type === "income" ? "Income" : "Expense";
  const cls = type === "income" ? "pill pill--income" : "pill pill--expense";
  return `<span class="${cls}"><span class="dot" aria-hidden="true"></span>${label}</span>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderTable() {
  const visible = getVisibleTransactions();
  els.txTbody.innerHTML = visible
    .map((t) => {
      const amountClass = t.type === "income" ? "amount--income" : "amount--expense";
      const sign = t.type === "income" ? "+" : "-";
      const category = t.category ? escapeHtml(t.category) : "<span style=\"color: rgba(255,255,255,.45)\">—</span>";
      const note = t.note ? escapeHtml(t.note) : "<span style=\"color: rgba(255,255,255,.45)\">—</span>";

      return `
        <tr>
          <td>${escapeHtml(t.date)}</td>
          <td>${pill(t.type)}</td>
          <td>${category}</td>
          <td>${note}</td>
          <td class="table__right ${amountClass}">${sign}${escapeHtml(formatMoney(t.amount))}</td>
          <td class="table__right">
            <div class="rowActions">
              <button class="linkBtn" type="button" data-action="edit" data-id="${escapeHtml(t.id)}">Edit</button>
              <button class="linkBtn linkBtn--danger" type="button" data-action="delete" data-id="${escapeHtml(
                t.id
              )}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const showEmpty = visible.length === 0;
  els.emptyState.hidden = !showEmpty;
}

function upsertTransaction(next) {
  const idx = transactions.findIndex((t) => t.id === next.id);
  if (idx >= 0) transactions[idx] = next;
  else transactions.push(next);
}

function removeTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
}

function renderAll() {
  renderSummary();
  renderTable();
}

function setFilter(filter) {
  uiState.filter = filter;
  document.querySelectorAll(".segmented__btn").forEach((btn) => {
    const selected = btn.getAttribute("data-filter") === filter;
    btn.setAttribute("aria-selected", selected ? "true" : "false");
  });
  renderTable();
}

function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    currency: DEFAULT_CURRENCY,
    transactions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `personal-finance-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    setMessage("Import failed: file is not valid JSON.");
    return;
  }

  const list = Array.isArray(parsed) ? parsed : parsed?.transactions;
  if (!Array.isArray(list)) {
    setMessage("Import failed: could not find transactions array.");
    return;
  }

  const next = list
    .filter((t) => t && typeof t === "object")
    .map((t) => ({
      id: String(t.id ?? crypto.randomUUID()),
      type: t.type === "income" ? "income" : "expense",
      amount: Math.max(0, Number(t.amount) || 0),
      category: String(t.category ?? ""),
      note: String(t.note ?? ""),
      date: String(t.date ?? todayISO()),
      createdAt: Number(t.createdAt) || Date.now(),
    }))
    .filter((t) => t.amount > 0);

  transactions = next;
  save();
  resetForm();
  renderAll();
  setMessage(`Imported ${transactions.length} transaction(s).`);
}

// ---- Events ----
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  setMessage("");

  const type = els.type.value === "income" ? "income" : "expense";
  const amount = Number(els.amount.value);
  const category = els.category.value.trim();
  const note = els.note.value.trim();
  const date = els.date.value;

  if (!Number.isFinite(amount) || amount <= 0) {
    setMessage("Please enter an amount greater than 0.");
    els.amount.focus();
    return;
  }
  if (!date) {
    setMessage("Please choose a date.");
    els.date.focus();
    return;
  }

  const now = Date.now();
  const id = uiState.editingId ?? crypto.randomUUID();
  const existing = transactions.find((t) => t.id === id);
  const createdAt = existing?.createdAt ?? now;

  upsertTransaction({
    id,
    type,
    amount: Math.round(amount * 100) / 100,
    category,
    note,
    date,
    createdAt,
  });

  save();
  renderAll();

  if (uiState.editingId) {
    setMessage("Saved changes.");
  } else {
    setMessage("Added.");
  }
  resetForm();
});

els.cancelEditBtn.addEventListener("click", () => {
  resetForm();
  setMessage("Edit cancelled.");
});

els.txTbody.addEventListener("click", (e) => {
  const target = /** @type {HTMLElement | null} */ (e.target);
  if (!target) return;
  const btn = target.closest("button");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  if (!action || !id) return;

  if (action === "edit") {
    const t = transactions.find((x) => x.id === id);
    if (!t) return;
    fillForm(t);
    setEditing(t.id);
    setMessage("Editing transaction — make changes and click “Save changes”.");
    els.amount.focus();
    return;
  }

  if (action === "delete") {
    const t = transactions.find((x) => x.id === id);
    if (!t) return;
    const ok = confirm("Delete this transaction?");
    if (!ok) return;
    removeTransaction(id);
    save();
    if (uiState.editingId === id) resetForm();
    renderAll();
    setMessage("Deleted.");
  }
});

document.querySelectorAll(".segmented__btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const filter = btn.getAttribute("data-filter");
    if (filter === "income" || filter === "expense" || filter === "all") {
      setFilter(filter);
    }
  });
});

els.search.addEventListener("input", () => {
  uiState.query = els.search.value;
  renderTable();
});

els.exportBtn.addEventListener("click", () => exportData());

els.importInput.addEventListener("change", async () => {
  const file = els.importInput.files?.[0];
  els.importInput.value = "";
  if (!file) return;
  await importData(file);
});

els.resetBtn.addEventListener("click", () => {
  const ok = confirm("This will delete ALL transactions. Continue?");
  if (!ok) return;
  transactions = [];
  save();
  resetForm();
  renderAll();
  setMessage("All transactions cleared.");
});

// ---- Init ----
function init() {
  transactions = load();
  els.date.value = todayISO();
  renderAll();
}

init();

