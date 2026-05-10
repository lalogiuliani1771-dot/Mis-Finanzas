import { useState, useEffect, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TODAY = new Date();
const DEFAULT_CATS = ["Educación","Servicios","Alimentación","Transporte","Salud","Hogar","Varios"];
const DEFAULT_PWD = "cata2009";
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n) => String(n).padStart(2, "0");
const mkey = (y, m) => `${y}-${pad(m + 1)}`;
const fmt = (n) => Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ─── STORAGE ─────────────────────────────────────────────────────────────────
const SK = { months: "fin-months", funds: "fin-funds", settings: "fin-settings", cats: "fin-cats" };
async function load(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function save(key, val) { try { await window.storage.set(key, JSON.stringify(val)); } catch {} }

// ─── REUSABLE UI ─────────────────────────────────────────────────────────────
const Modal = ({ title, subtitle, onClose, children, maxW = 460 }) => (
  <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose?.()}>
    <div style={{ ...s.modal, maxWidth: maxW }}>
      <div style={s.mHead}>
        <div>
          <div style={s.mTitle}>{title}</div>
          {subtitle && <div style={s.mSub}>{subtitle}</div>}
        </div>
        {onClose && <button style={s.closeBtn} onClick={onClose}>✕</button>}
      </div>
      <div style={{ padding: "0 24px 24px" }}>{children}</div>
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <label style={s.fieldWrap}><span style={s.fieldLabel}>{label}</span>{children}</label>
);

const Input = (props) => <input style={s.input} {...props} />;
const Btn = ({ variant = "primary", ...props }) => <button style={variant === "primary" ? s.btnPrimary : variant === "danger" ? s.btnDanger : s.btnSec} {...props} />;
const Row = ({ gap = 12, children }) => <div style={{ display: "flex", gap, alignItems: "center" }}>{children}</div>;

// ─── EXPENSE FORM ─────────────────────────────────────────────────────────────
function ExpenseForm({ initial, categories, onSave, onAddCat, onCancel }) {
  const [f, setF] = useState(initial ?? { name: "", category: categories[0] ?? "Varios", amount: "", dueDay: "", paid: false, recurring: false, method: "Billetera", note: "" });
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!f.name.trim() || !f.amount) return;
    onSave({ ...f, amount: Number(f.amount), dueDay: f.dueDay ? Number(f.dueDay) : null });
  };

  const handleAddCat = () => {
    if (!newCat.trim()) return;
    onAddCat(newCat.trim());
    set("category", newCat.trim());
    setNewCat(""); setShowNewCat(false);
  };

  return (
    <div style={s.formGrid}>
      <Field label="Nombre del gasto">
        <Input value={f.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Cuota colegio" autoFocus />
      </Field>

      <Field label="Categoría">
        <Row gap={8}>
          <select style={{ ...s.input, flex: 1 }} value={f.category} onChange={e => set("category", e.target.value)}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          {!showNewCat && <button style={s.chipBtn} onClick={() => setShowNewCat(true)}>+ nueva</button>}
        </Row>
        {showNewCat && (
          <Row gap={8} style={{ marginTop: 8 }}>
            <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nueva categoría…" style={{ flex: 1 }} />
            <button style={s.chipBtn} onClick={handleAddCat}>OK</button>
            <button style={{ ...s.chipBtn, background: "#2d1b1b", color: "#f87171" }} onClick={() => setShowNewCat(false)}>✕</button>
          </Row>
        )}
      </Field>

      <Row gap={12}>
        <Field label="Monto $">
          <Input type="number" value={f.amount} onChange={e => set("amount", e.target.value)} placeholder="0" />
        </Field>
        <Field label="Día de vto.">
          <Input type="number" min={1} max={31} value={f.dueDay} onChange={e => set("dueDay", e.target.value)} placeholder="—" />
        </Field>
      </Row>

      <Field label="Medio de pago">
        <Row gap={0}>
          {["Billetera","Efectivo"].map(m => (
            <button key={m} onClick={() => set("method", m)}
              style={{ ...s.toggle, ...(f.method === m ? s.toggleActive : {}) }}>{m}</button>
          ))}
        </Row>
      </Field>

      <Field label="Nota opcional">
        <Input value={f.note} onChange={e => set("note", e.target.value)} placeholder="Ej: débito automático" />
      </Field>

      <Row gap={20}>
        <label style={s.checkLabel}>
          <input type="checkbox" checked={f.recurring} onChange={e => set("recurring", e.target.checked)} style={{ accentColor: "#c9a96e" }} />
          Gasto recurrente
        </label>
        <label style={s.checkLabel}>
          <input type="checkbox" checked={f.paid} onChange={e => set("paid", e.target.checked)} style={{ accentColor: "#4ade80" }} />
          Ya pagado
        </label>
      </Row>

      <Row gap={10} style={{ marginTop: 4 }}>
        <Btn onClick={handleSave} style={{ flex: 1 }}>Guardar</Btn>
        <Btn variant="sec" onClick={onCancel}>Cancelar</Btn>
      </Row>
    </div>
  );
}

// ─── TAB: MES EN CURSO ────────────────────────────────────────────────────────
function TabMes({ allMonths, setAllMonths, categories, setCategories }) {
  const [year, setYear] = useState(TODAY.getFullYear());
  const [month, setMonth] = useState(TODAY.getMonth());
  const [modal, setModal] = useState(null); // null | "addExp" | "editExp" | "income"
  const [editTarget, setEditTarget] = useState(null);
  const [incomeVal, setIncomeVal] = useState("");

  const key = mkey(year, month);
  const todayDay = (TODAY.getFullYear() === year && TODAY.getMonth() === month) ? TODAY.getDate() : null;

  // Ensure month exists
  const md = useCallback(() => allMonths[key] ?? { income: 0, expenses: [], extraIncome: [] }, [allMonths, key]);
  const { income, expenses, extraIncome } = md();

  const updateMonth = useCallback(async (patch) => {
    const base = md();
    const next = { ...allMonths, [key]: { ...base, ...patch } };
    setAllMonths(next);
    await save(SK.months, next);
  }, [allMonths, key, md]);

  const prevMonth = () => { if (month === 0) { setYear(y=>y-1); setMonth(11); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y=>y+1); setMonth(0); } else setMonth(m=>m+1); };

  const carryRecurring = async () => {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    const prev = allMonths[mkey(py, pm)];
    if (!prev?.expenses?.length) { return; }
    const recurring = prev.expenses.filter(e => e.recurring).map(e => ({ ...e, id: uid(), paid: false }));
    const cur = md();
    const existing = cur.expenses.map(e => e.name + e.category);
    const toAdd = recurring.filter(r => !existing.includes(r.name + r.category));
    if (!toAdd.length) return;
    await updateMonth({ expenses: [...cur.expenses, ...toAdd] });
  };

  const saveExpense = async (form) => {
    if (editTarget) {
      await updateMonth({ expenses: expenses.map(e => e.id === editTarget.id ? { ...e, ...form } : e) });
    } else {
      await updateMonth({ expenses: [...expenses, { ...form, id: uid() }] });
    }
    setModal(null); setEditTarget(null);
  };

  const addCat = async (name) => {
    const next = [...categories, name];
    setCategories(next);
    await save(SK.cats, next);
  };

  const togglePaid = async (id) => updateMonth({ expenses: expenses.map(e => e.id === id ? { ...e, paid: !e.paid } : e) });
  const deleteExp  = async (id) => { if (window.confirm("¿Eliminar este gasto?")) await updateMonth({ expenses: expenses.filter(e => e.id !== id) }); };

  const saveIncome = async () => { await updateMonth({ income: Number(incomeVal) || 0 }); setModal(null); };

  // Totals
  const totalExtra    = (extraIncome || []).reduce((s, x) => s + x.amount, 0);
  const totalIncome   = income + totalExtra;
  const totalGastos   = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalPagado   = expenses.filter(e => e.paid).reduce((s, e) => s + (e.amount || 0), 0);
  const totalPendiente= totalGastos - totalPagado;
  const balance       = totalIncome - totalGastos;
  const pctPagado     = totalGastos ? Math.round((totalPagado / totalGastos) * 100) : 0;

  // Upcoming (next 5 days, not paid)
  const upcoming = todayDay ? expenses.filter(e => !e.paid && e.dueDay >= todayDay && e.dueDay <= todayDay + 5) : [];
  const vencidos  = todayDay ? expenses.filter(e => !e.paid && e.dueDay && e.dueDay < todayDay) : [];

  // Group by category
  const byCat = {};
  expenses.forEach(e => { if (!byCat[e.category]) byCat[e.category] = []; byCat[e.category].push(e); });

  return (
    <div style={s.tabBody}>
      {/* Month nav */}
      <div style={s.monthNav}>
        <button style={s.navArrow} onClick={prevMonth}>‹</button>
        <span style={s.monthTitle}>{MONTHS_ES[month]} {year}</span>
        <button style={s.navArrow} onClick={nextMonth}>›</button>
      </div>

      {/* Alerts */}
      {vencidos.length > 0 && (
        <div style={{ ...s.alertBar, borderColor: "#7f1d1d", background: "rgba(239,68,68,.07)" }}>
          <span style={{ color: "#f87171", fontSize: 16 }}>⚠</span>
          <div>
            <div style={{ ...s.alertTitle, color: "#f87171" }}>Gastos vencidos sin pagar</div>
            <div style={s.chips}>{vencidos.map(e => <span key={e.id} style={{ ...s.chip, background: "rgba(239,68,68,.15)", color: "#fca5a5" }}>{e.name} · día {e.dueDay}</span>)}</div>
          </div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div style={s.alertBar}>
          <span style={{ color: "#fbbf24", fontSize: 16 }}>🔔</span>
          <div>
            <div style={s.alertTitle}>Próximos vencimientos (5 días)</div>
            <div style={s.chips}>{upcoming.map(e => <span key={e.id} style={s.chip}>{e.name} · día {e.dueDay} · ${fmt(e.amount)}</span>)}</div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={s.cardGrid}>
        <div style={{ ...s.card, cursor: "pointer" }} onClick={() => { setIncomeVal(String(income)); setModal("income"); }}>
          <div style={s.cardLabel}>Ingreso del mes</div>
          <div style={{ ...s.cardAmt, color: "#4ade80" }}>${fmt(income)}</div>
          {totalExtra > 0 && <div style={s.cardSub}>+ ${fmt(totalExtra)} retiros → total ${fmt(totalIncome)}</div>}
          <div style={s.cardHint}>toca para editar</div>
        </div>

        <div style={s.card}>
          <div style={s.cardLabel}>Total gastos</div>
          <div style={{ ...s.cardAmt, color: "#f87171" }}>${fmt(totalGastos)}</div>
          <div style={s.cardSub}>{expenses.length} ítem{expenses.length !== 1 ? "s" : ""}</div>
        </div>

        <div style={{ ...s.card, borderColor: balance >= 0 ? "#166534" : "#7f1d1d", background: balance >= 0 ? "rgba(74,222,128,.05)" : "rgba(248,113,113,.05)" }}>
          <div style={s.cardLabel}>Balance</div>
          <div style={{ ...s.cardAmt, color: balance >= 0 ? "#4ade80" : "#f87171" }}>{balance >= 0 ? "+" : ""}${fmt(Math.abs(balance))}</div>
          <div style={s.cardSub}>{balance >= 0 ? "Superávit ✓" : "Déficit ✗"}</div>
        </div>

        <div style={s.card}>
          <div style={s.cardLabel}>Pagado / Pendiente</div>
          <Row gap={6} style={{ marginTop: 8 }}>
            <span style={{ color: "#4ade80", fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700 }}>${fmt(totalPagado)}</span>
            <span style={{ color: "#334155" }}>/</span>
            <span style={{ color: "#fbbf24", fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700 }}>${fmt(totalPendiente)}</span>
          </Row>
          <div style={s.progressTrack}>
            <div style={{ ...s.progressFill, width: `${pctPagado}%` }} />
          </div>
          <div style={s.cardHint}>{pctPagado}% pagado</div>
        </div>
      </div>

      {/* Extra income from withdrawals */}
      {(extraIncome || []).length > 0 && (
        <div style={s.extraIncomeBox}>
          <div style={s.sectionTitle}>Ingresos extraordinarios (retiros de Fondos)</div>
          {extraIncome.map(x => (
            <div key={x.id} style={s.extraRow}>
              <span style={{ color: "#c9a96e" }}>↓ {x.source}</span>
              <span style={{ color: "#4ade80", fontWeight: 600 }}>${fmt(x.amount)}</span>
              <span style={{ color: "#475569", fontSize: 11 }}>{x.date}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={s.actions}>
        <Btn onClick={() => { setEditTarget(null); setModal("addExp"); }}>+ Agregar gasto</Btn>
        <Btn variant="sec" onClick={carryRecurring}>↻ Traer recurrentes</Btn>
      </div>

      {/* Expenses by category */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {Object.entries(byCat).map(([cat, items]) => {
          if (!items.length) return null;
          const catTotal = items.reduce((s, e) => s + (e.amount || 0), 0);
          return (
            <div key={cat}>
              <div style={s.catHeader}>
                <span style={s.catName}>{cat}</span>
                <span style={s.catTotal}>${fmt(catTotal)}</span>
              </div>
              {items.map(exp => {
                const isVencido = !exp.paid && todayDay && exp.dueDay && exp.dueDay < todayDay;
                const isProximo = !exp.paid && todayDay && exp.dueDay >= todayDay && exp.dueDay <= todayDay + 5;
                return (
                  <div key={exp.id} style={{
                    ...s.expRow,
                    borderLeftColor: exp.paid ? "#4ade80" : isVencido ? "#ef4444" : isProximo ? "#fbbf24" : "#1e293b",
                    background: exp.paid ? "rgba(74,222,128,.05)" : "rgba(255,255,255,.02)",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Row gap={8}>
                        <span style={{ ...s.expName, color: exp.paid ? "#4ade80" : "#e2e8f0" }}>{exp.name}</span>
                        {exp.recurring && <span style={s.badge}>↻ recurrente</span>}
                        <span style={{ ...s.badge, background: "#1e293b", color: "#475569" }}>{exp.method}</span>
                      </Row>
                      <div style={s.expMeta}>
                        {exp.dueDay ? `Vto. día ${exp.dueDay}` : "Sin vencimiento"}
                        {exp.note ? ` · ${exp.note}` : ""}
                        {isVencido ? " · VENCIDO" : ""}
                      </div>
                    </div>
                    <Row gap={8}>
                      <span style={s.expAmt}>${fmt(exp.amount)}</span>
                      <button style={{ ...s.iBtn, background: exp.paid ? "#166534" : "#1e293b", color: exp.paid ? "#4ade80" : "#64748b" }}
                        onClick={() => togglePaid(exp.id)} title={exp.paid ? "Desmarcar" : "Marcar pagado"}>{exp.paid ? "✓" : "○"}</button>
                      <button style={{ ...s.iBtn, background: "#1e293b" }} onClick={() => { setEditTarget(exp); setModal("editExp"); }} title="Editar">✎</button>
                      <button style={{ ...s.iBtn, background: "#1e293b", color: "#f87171" }} onClick={() => deleteExp(exp.id)} title="Eliminar">✕</button>
                    </Row>
                  </div>
                );
              })}
            </div>
          );
        })}
        {expenses.length === 0 && (
          <div style={s.emptyState}>Sin gastos este mes.<br/>Tocá "+ Agregar gasto" para empezar.</div>
        )}
      </div>

      {/* Modals */}
      {(modal === "addExp" || modal === "editExp") && (
        <Modal title={modal === "editExp" ? "Editar gasto" : "Nuevo gasto"} onClose={() => { setModal(null); setEditTarget(null); }}>
          <ExpenseForm initial={editTarget} categories={categories} onSave={saveExpense} onAddCat={addCat} onCancel={() => { setModal(null); setEditTarget(null); }} />
        </Modal>
      )}

      {modal === "income" && (
        <Modal title="Ingreso del mes" subtitle="Sueldo, honorarios o ingreso principal" onClose={() => setModal(null)}>
          <div style={s.formGrid}>
            <Field label="Monto en $"><Input type="number" value={incomeVal} onChange={e => setIncomeVal(e.target.value)} autoFocus /></Field>
            <Row gap={10}><Btn style={{ flex: 1 }} onClick={saveIncome}>Guardar</Btn><Btn variant="sec" onClick={() => setModal(null)}>Cancelar</Btn></Row>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TAB: FONDOS RESERVA (PROTECTED) ─────────────────────────────────────────
function TabFondos({ allMonths, setAllMonths, currentYear, currentMonth }) {
  const [unlocked, setUnlocked]     = useState(false);
  const [pwd, setPwd]               = useState("");
  const [pwdError, setPwdError]     = useState(false);
  const [settings, setSettings]     = useState({ password: DEFAULT_PWD });
  const [funds, setFunds]           = useState([]);
  const [modal, setModal]           = useState(null); // null|"addFund"|"editFund"|"withdraw"|"changePwd"
  const [target, setTarget]         = useState(null);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [newFundName, setNewFundName]   = useState("");
  const [newFundBal, setNewFundBal]     = useState("");
  const [changePwdForm, setChangePwdForm] = useState({ current: "", next: "", confirm: "" });
  const [pwdChangeErr, setPwdChangeErr]   = useState("");

  useEffect(() => {
    (async () => {
      const [f, st] = await Promise.all([load(SK.funds), load(SK.settings)]);
      if (f) setFunds(f);
      if (st) setSettings(st);
    })();
  }, []);

  const tryUnlock = () => {
    if (pwd === settings.password) { setUnlocked(true); setPwdError(false); setPwd(""); }
    else { setPwdError(true); setPwd(""); }
  };

  const saveFunds = async (next) => { setFunds(next); await save(SK.funds, next); };
  const saveSettings = async (next) => { setSettings(next); await save(SK.settings, next); };

  const addFund = async () => {
    if (!newFundName.trim()) return;
    await saveFunds([...funds, { id: uid(), name: newFundName.trim(), balance: Number(newFundBal) || 0, movements: [] }]);
    setNewFundName(""); setNewFundBal(""); setModal(null);
  };

  const doWithdraw = async () => {
    const amt = Number(withdrawAmt);
    if (!amt || amt <= 0 || amt > target.balance) return;
    const curKey = mkey(currentYear, currentMonth);
    const movement = { id: uid(), type: "retiro", amount: amt, date: TODAY.toLocaleDateString("es-AR"), note: withdrawNote, monthKey: curKey };
    const updatedFunds = funds.map(f => f.id === target.id
      ? { ...f, balance: f.balance - amt, movements: [...(f.movements || []), movement] }
      : f
    );
    await saveFunds(updatedFunds);

    // Add to current month extra income
    const base = allMonths[curKey] ?? { income: 0, expenses: [], extraIncome: [] };
    const extraEntry = { id: uid(), amount: amt, source: target.name, date: TODAY.toLocaleDateString("es-AR"), note: withdrawNote };
    const nextMonths = { ...allMonths, [curKey]: { ...base, extraIncome: [...(base.extraIncome || []), extraEntry] } };
    setAllMonths(nextMonths);
    await save(SK.months, nextMonths);

    setWithdrawAmt(""); setWithdrawNote(""); setModal(null); setTarget(null);
  };

  const changePwd = async () => {
    if (changePwdForm.current !== settings.password) { setPwdChangeErr("La contraseña actual es incorrecta."); return; }
    if (!changePwdForm.next.trim()) { setPwdChangeErr("La nueva contraseña no puede estar vacía."); return; }
    if (changePwdForm.next !== changePwdForm.confirm) { setPwdChangeErr("Las contraseñas no coinciden."); return; }
    await saveSettings({ ...settings, password: changePwdForm.next });
    setChangePwdForm({ current: "", next: "", confirm: "" }); setPwdChangeErr(""); setModal(null);
  };

  const deleteFund = async (id) => {
    if (!window.confirm("¿Eliminar este fondo? Se perderá su historial.")) return;
    await saveFunds(funds.filter(f => f.id !== id));
  };

  const totalFunds = funds.reduce((s, f) => s + f.balance, 0);

  // ── LOCK SCREEN ──
  if (!unlocked) return (
    <div style={s.tabBody}>
      <div style={s.lockWrap}>
        <div style={s.lockIcon}>🔒</div>
        <div style={s.lockTitle}>Fondos Reserva</div>
        <div style={s.lockSub}>Esta sección está protegida.<br/>Ingresá tu contraseña para continuar.</div>
        <input
          type="password" style={{ ...s.input, textAlign: "center", fontSize: 20, letterSpacing: 8, maxWidth: 260 }}
          value={pwd} onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === "Enter" && tryUnlock()}
          placeholder="••••••••" autoFocus
        />
        {pwdError && <div style={{ color: "#f87171", fontSize: 13, marginTop: -4 }}>Contraseña incorrecta</div>}
        <Btn onClick={tryUnlock} style={{ maxWidth: 200 }}>Ingresar</Btn>
      </div>
    </div>
  );

  // ── UNLOCKED ──
  return (
    <div style={s.tabBody}>
      {/* Header */}
      <div style={s.fondsHeader}>
        <div>
          <div style={s.fondsTitle}>Fondos Reserva</div>
          <div style={s.fondsSub}>Total disponible: <span style={{ color: "#c9a96e", fontWeight: 700 }}>${fmt(totalFunds)}</span></div>
        </div>
        <Row gap={8}>
          <Btn onClick={() => setModal("addFund")}>+ Nuevo fondo</Btn>
          <button style={{ ...s.iBtn, background: "#1e293b" }} onClick={() => { setChangePwdForm({ current: "", next: "", confirm: "" }); setModal("changePwd"); }} title="Cambiar contraseña">🔑</button>
        </Row>
      </div>

      {/* Funds list */}
      {funds.length === 0 && <div style={s.emptyState}>Sin fondos registrados.<br/>Tocá "+ Nuevo fondo" para agregar.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {funds.map(fund => (
          <div key={fund.id} style={s.fundCard}>
            <div style={s.fundTop}>
              <div>
                <div style={s.fundName}>{fund.name}</div>
                <div style={s.fundBal}>${fmt(fund.balance)}</div>
              </div>
              <Row gap={8}>
                <Btn onClick={() => { setTarget(fund); setWithdrawAmt(""); setWithdrawNote(""); setModal("withdraw"); }}>Retirar</Btn>
                <button style={{ ...s.iBtn, background: "#0f1929" }} onClick={() => deleteFund(fund.id)} title="Eliminar fondo">✕</button>
              </Row>
            </div>

            {/* Movement history */}
            {(fund.movements || []).length > 0 && (
              <div style={s.movList}>
                <div style={s.movTitle}>Historial de movimientos</div>
                {[...(fund.movements || [])].reverse().map(m => (
                  <div key={m.id} style={s.movRow}>
                    <span style={{ color: "#f87171" }}>↓ Retiro</span>
                    <span style={{ color: "#94a3b8", flex: 1, paddingLeft: 8 }}>{m.note || "—"}</span>
                    <span style={{ color: "#f87171", fontWeight: 600 }}>-${fmt(m.amount)}</span>
                    <span style={{ color: "#475569", fontSize: 11, minWidth: 70, textAlign: "right" }}>{m.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL: Nuevo fondo */}
      {modal === "addFund" && (
        <Modal title="Nuevo fondo" onClose={() => setModal(null)}>
          <div style={s.formGrid}>
            <Field label="Nombre del fondo"><Input value={newFundName} onChange={e => setNewFundName(e.target.value)} placeholder="Ej: Plazo fijo, Ahorros…" autoFocus /></Field>
            <Field label="Saldo inicial $"><Input type="number" value={newFundBal} onChange={e => setNewFundBal(e.target.value)} placeholder="0" /></Field>
            <Row gap={10}><Btn style={{ flex: 1 }} onClick={addFund}>Crear fondo</Btn><Btn variant="sec" onClick={() => setModal(null)}>Cancelar</Btn></Row>
          </div>
        </Modal>
      )}

      {/* MODAL: Retirar */}
      {modal === "withdraw" && target && (
        <Modal title={`Retirar de "${target.name}"`} subtitle={`Saldo disponible: $${fmt(target.balance)}`} onClose={() => setModal(null)}>
          <div style={s.formGrid}>
            <Field label="Monto a retirar $">
              <Input type="number" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} placeholder="0" autoFocus />
            </Field>
            <Field label="Destino / Nota">
              <Input value={withdrawNote} onChange={e => setWithdrawNote(e.target.value)} placeholder="Ej: pago impuesto inesperado" />
            </Field>
            <div style={s.withdrawInfo}>
              El monto se descontará del fondo y se sumará como ingreso extraordinario al mes actual ({MONTHS_ES[currentMonth]} {currentYear}).
            </div>
            {Number(withdrawAmt) > target.balance && <div style={{ color: "#f87171", fontSize: 13 }}>⚠ Monto mayor al saldo disponible</div>}
            <Row gap={10}><Btn style={{ flex: 1 }} onClick={doWithdraw} disabled={!withdrawAmt || Number(withdrawAmt) > target.balance}>Confirmar retiro</Btn><Btn variant="sec" onClick={() => setModal(null)}>Cancelar</Btn></Row>
          </div>
        </Modal>
      )}

      {/* MODAL: Cambiar contraseña */}
      {modal === "changePwd" && (
        <Modal title="Cambiar contraseña" onClose={() => setModal(null)}>
          <div style={s.formGrid}>
            <Field label="Contraseña actual"><input type="password" style={s.input} value={changePwdForm.current} onChange={e => setChangePwdForm(p => ({ ...p, current: e.target.value }))} autoFocus /></Field>
            <Field label="Nueva contraseña"><input type="password" style={s.input} value={changePwdForm.next} onChange={e => setChangePwdForm(p => ({ ...p, next: e.target.value }))} /></Field>
            <Field label="Confirmar contraseña"><input type="password" style={s.input} value={changePwdForm.confirm} onChange={e => setChangePwdForm(p => ({ ...p, confirm: e.target.value }))} /></Field>
            {pwdChangeErr && <div style={{ color: "#f87171", fontSize: 13 }}>{pwdChangeErr}</div>}
            <Row gap={10}><Btn style={{ flex: 1 }} onClick={changePwd}>Cambiar contraseña</Btn><Btn variant="sec" onClick={() => setModal(null)}>Cancelar</Btn></Row>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState("mes");
  const [allMonths, setAllMonths] = useState({});
  const [categories, setCats]   = useState(DEFAULT_CATS);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      const [m, c] = await Promise.all([load(SK.months), load(SK.cats)]);
      if (m) setAllMonths(m);
      if (c) setCats(c);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div style={{ ...s.root, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#475569", fontFamily: "'Cormorant Garamond',serif", fontSize: 22 }}>Cargando…</span>
    </div>
  );

  return (
    <div style={s.root}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap" rel="stylesheet" />

      {/* APP HEADER */}
      <header style={s.appHeader}>
        <div style={s.appBrand}>
          <div style={s.appLogo}>MF</div>
          <div>
            <div style={s.appName}>Mis Finanzas</div>
            <div style={s.appTagline}>economía personal</div>
          </div>
        </div>
        <nav style={s.tabNav}>
          <button style={{ ...s.tabBtn, ...(tab === "mes" ? s.tabActive : {}) }} onClick={() => setTab("mes")}>
            📅 Mes en curso
          </button>
          <button style={{ ...s.tabBtn, ...(tab === "fondos" ? s.tabActive : {}) }} onClick={() => setTab("fondos")}>
            🔒 Fondos Reserva
          </button>
        </nav>
      </header>

      {/* CONTENT */}
      {tab === "mes"
        ? <TabMes allMonths={allMonths} setAllMonths={setAllMonths} categories={categories} setCategories={setCats} />
        : <TabFondos allMonths={allMonths} setAllMonths={setAllMonths} currentYear={TODAY.getFullYear()} currentMonth={TODAY.getMonth()} />
      }
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = {
  root: { minHeight: "100vh", background: "#080d18", color: "#e2e8f0", fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 },

  appHeader: { background: "linear-gradient(180deg,#0c1526 0%,#080d18 100%)", borderBottom: "1px solid #1a2535", padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
  appBrand:  { display: "flex", alignItems: "center", gap: 14 },
  appLogo:   { width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#c9a96e,#a0784a)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 16, color: "#080d18" },
  appName:   { fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9", lineHeight: 1 },
  appTagline:{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" },

  tabNav:    { display: "flex", gap: 6, background: "#0c1526", borderRadius: 12, padding: 4, border: "1px solid #1a2535" },
  tabBtn:    { background: "none", border: "none", color: "#475569", padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans',sans-serif", transition: "all .2s" },
  tabActive: { background: "#1a2d4a", color: "#c9a96e", fontWeight: 600 },

  tabBody: { padding: "20px 20px 0", maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 },

  monthNav:  { display: "flex", alignItems: "center", justifyContent: "center", gap: 20 },
  navArrow:  { background: "#1a2535", border: "none", color: "#64748b", fontSize: 22, width: 38, height: 38, borderRadius: 10, cursor: "pointer" },
  monthTitle:{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: "#f1f5f9", minWidth: 200, textAlign: "center" },

  alertBar:  { display: "flex", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(251,191,36,.25)", background: "rgba(251,191,36,.06)", alignItems: "flex-start" },
  alertTitle:{ fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 },
  chips:     { display: "flex", flexWrap: "wrap", gap: 6 },
  chip:      { background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 20, padding: "2px 10px", fontSize: 12, color: "#fde68a" },

  cardGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 },
  card:      { background: "#0c1526", border: "1px solid #1a2535", borderRadius: 14, padding: "16px 18px" },
  cardLabel: { fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 },
  cardAmt:   { fontFamily: "'Cormorant Garamond',serif", fontSize: 30, fontWeight: 700, marginTop: 6 },
  cardSub:   { fontSize: 11, color: "#c9a96e", marginTop: 4 },
  cardHint:  { fontSize: 10, color: "#334155", marginTop: 6 },
  progressTrack: { background: "#1a2535", borderRadius: 4, height: 5, marginTop: 10, overflow: "hidden" },
  progressFill:  { height: "100%", background: "linear-gradient(90deg,#4ade80,#22c55e)", borderRadius: 4, transition: "width .5s ease" },

  extraIncomeBox:{ background: "#0c1526", border: "1px solid #1a3a1a", borderRadius: 12, padding: "14px 16px" },
  extraRow:      { display: "flex", alignItems: "center", gap: 10, padding: "4px 0", fontSize: 13 },

  actions: { display: "flex", gap: 10 },

  sectionTitle: { fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10 },
  catHeader:    { display: "flex", justifyContent: "space-between", padding: "6px 0 10px", borderBottom: "1px solid #1a2535", marginBottom: 4 },
  catName:      { fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 600, color: "#94a3b8" },
  catTotal:     { fontSize: 13, color: "#475569", fontWeight: 600 },

  expRow:   { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, marginBottom: 3, borderLeft: "3px solid #1e293b", transition: "background .3s, border-color .3s" },
  expName:  { fontSize: 14, fontWeight: 500 },
  expMeta:  { fontSize: 11, color: "#475569", marginTop: 2 },
  expAmt:   { fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 600, color: "#94a3b8", minWidth: 80, textAlign: "right" },
  badge:    { fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#1a2d4a", color: "#7dd3fc", fontWeight: 600, whiteSpace: "nowrap" },
  iBtn:     { border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14, color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" },

  emptyState: { textAlign: "center", color: "#334155", padding: "40px 0", lineHeight: 1.8, fontSize: 14 },

  // Lock
  lockWrap:  { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "60px 0" },
  lockIcon:  { fontSize: 48 },
  lockTitle: { fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: "#f1f5f9" },
  lockSub:   { color: "#475569", textAlign: "center", lineHeight: 1.6, fontSize: 14 },

  // Fondos
  fondsHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 },
  fondsTitle:  { fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: "#f1f5f9" },
  fondsSub:    { fontSize: 13, color: "#64748b", marginTop: 4 },

  fundCard: { background: "#0c1526", border: "1px solid #1a2535", borderRadius: 16, padding: "20px" },
  fundTop:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  fundName: { fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 },
  fundBal:  { fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 700, color: "#c9a96e", marginTop: 4 },
  movList:  { marginTop: 16, borderTop: "1px solid #1a2535", paddingTop: 14 },
  movTitle: { fontSize: 10, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 },
  movRow:   { display: "flex", gap: 8, alignItems: "center", padding: "5px 0", fontSize: 13, borderBottom: "1px solid #0f1929" },

  withdrawInfo: { background: "#0f1929", border: "1px solid #1a2535", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#64748b", lineHeight: 1.6 },

  // Form
  overlay:  { position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 },
  modal:    { background: "#0c1526", border: "1px solid #1a2535", borderRadius: 20, width: "100%", overflow: "hidden" },
  mHead:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "22px 24px 18px" },
  mTitle:   { fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" },
  mSub:     { fontSize: 12, color: "#475569", marginTop: 3 },
  closeBtn: { background: "#1a2535", border: "none", color: "#475569", fontSize: 15, width: 32, height: 32, borderRadius: 8, cursor: "pointer" },

  formGrid: { display: "flex", flexDirection: "column", gap: 16 },
  fieldWrap:{ display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel:{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.09em" },
  input:    { background: "#0f1929", border: "1px solid #1a2535", borderRadius: 10, padding: "11px 14px", color: "#e2e8f0", fontSize: 15, fontFamily: "'DM Sans',sans-serif", outline: "none", width: "100%", boxSizing: "border-box" },

  toggle:       { flex: 1, background: "#0f1929", border: "1px solid #1a2535", borderRadius: 0, padding: "9px", color: "#475569", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans',sans-serif" },
  toggleActive: { background: "#1a2d4a", color: "#c9a96e", borderColor: "#c9a96e55", fontWeight: 600 },

  checkLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#94a3b8", cursor: "pointer" },
  chipBtn:    { background: "#1a2d4a", border: "none", color: "#7dd3fc", borderRadius: 8, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", height: 42, fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" },

  btnPrimary: { background: "linear-gradient(135deg,#c9a96e,#a0784a)", color: "#080d18", border: "none", borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  btnSec:     { background: "#1a2535", color: "#64748b", border: "1px solid #1a2535", borderRadius: 10, padding: "11px 20px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
  btnDanger:  { background: "#2d1b1b", color: "#f87171", border: "1px solid #3d2020", borderRadius: 10, padding: "11px 20px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
};
