const pad = (n) => String(n).padStart(2, "0");

// Build a continuous, gap-free chart series for the selected period so the
// Sales Overview never shows a broken line or a huge blank area. Shared by the
// restaurant and salon dashboards.
export function buildChartSeries(rows, period) {
  const map = {};
  rows.forEach((r) => {
    map[normaliseKey(r.label)] = Number(r.sales) || 0;
  });

  const isHourly = period === "today" || period === "yesterday";
  const out = [];

  if (isHourly) {
    for (let h = 0; h < 24; h++) {
      const key = String(h);
      out.push({
        label: `${pad(h)}:00`,
        sales: map[key] || 0
      });
    }
    return out;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const points = [];

  if (period === "week") {
    // Week runs Sunday..Saturday. getDay(): 0=Sun..6=Sat, so subtract getDay()
    // to land on this week's Sunday.
    const sun = new Date(today);
    sun.setDate(today.getDate() - today.getDay());
    for (let d = new Date(sun); d <= today; d.setDate(d.getDate() + 1)) {
      points.push(new Date(d));
    }
  } else {
    for (let d = 1; d <= today.getDate(); d++) {
      points.push(new Date(today.getFullYear(), today.getMonth(), d));
    }
  }

  points.forEach((d) => {
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    out.push({
      label: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      sales: map[key] || 0
    });
  });

  return out;
}

function normaliseKey(raw) {
  if (raw == null) return "";
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s.trim();
}
