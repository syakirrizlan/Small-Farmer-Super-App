import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";

const today = () => new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const stats = useLiveQuery(async () => {
    const [crops, animals, tasks, inventory, money] = await Promise.all([
      db.records("crops").toArray(),
      db.records("livestock").toArray(),
      db.records("tasks").toArray(),
      db.records("inventory").toArray(),
      db.records("finance").toArray(),
    ]);
    const openTasks = tasks.filter((t) => t.status !== "Done");
    const overdue = openTasks.filter((t) => t.due && String(t.due) < today());
    const lowStock = inventory.filter((i) => i.reorderAt !== "" && i.reorderAt != null && Number(i.quantity) < Number(i.reorderAt));
    const month = today().slice(0, 7);
    const sum = (type: string) => money
      .filter((f) => f.type === type && String(f.date ?? "").startsWith(month))
      .reduce((a, f) => a + Number(f.amount || 0), 0);
    return {
      growing: crops.filter((c) => c.status === "Growing").length,
      animals: animals.filter((a) => a.status !== "Sold" && a.status !== "Deceased").length,
      openTasks: openTasks.length,
      overdue,
      lowStock,
      income: sum("Income"),
      expense: sum("Expense"),
      upcoming: openTasks.filter((t) => t.due).sort((a, b) => String(a.due).localeCompare(String(b.due))).slice(0, 5),
    };
  });

  if (!stats) return null;
  const net = stats.income - stats.expense;

  return (
    <>
      <h1>Good day, farmer 👋</h1>
      <div className="stats">
        <Stat to="/track/crops" icon="🌱" label="Crops growing" value={stats.growing} color="#43a047" />
        <Stat to="/track/livestock" icon="🐄" label="Animals" value={stats.animals} color="#fb8c00" />
        <Stat to="/track/tasks" icon="✅" label="Open tasks" value={stats.openTasks} color="#1e88e5" />
        <Stat to="/track/finance" icon="💰" label="Net this month" value={net.toLocaleString()} color={net >= 0 ? "#2e7d32" : "#c62828"} />
      </div>

      {(stats.overdue.length > 0 || stats.lowStock.length > 0) && (
        <section className="card alert">
          <h3>Needs attention</h3>
          <ul>
            {stats.overdue.map((t) => <li key={`t${t.id}`}>⏰ Overdue: {String(t.title)}</li>)}
            {stats.lowStock.map((i) => <li key={`i${i.id}`}>📦 Low stock: {String(i.item)} ({String(i.quantity)} {String(i.unit ?? "")})</li>)}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>Coming up</h3>
        {stats.upcoming.length === 0 ? <p className="muted">No scheduled tasks.</p> : (
          <ul className="plain">
            {stats.upcoming.map((t) => <li key={t.id}><b>{String(t.due)}</b> — {String(t.title)}</li>)}
          </ul>
        )}
      </section>

      <Link to="/assistant" className="card cta">🤖 Ask the farm assistant about your data →</Link>
    </>
  );
}

function Stat({ to, icon, label, value, color }: { to: string; icon: string; label: string; value: number | string; color: string }) {
  return (
    <Link to={to} className="stat" style={{ borderTopColor: color }}>
      <span>{icon}</span>
      <strong style={{ color }}>{value}</strong>
      <small>{label}</small>
    </Link>
  );
}
