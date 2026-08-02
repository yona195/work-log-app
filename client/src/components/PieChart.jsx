import { Doughnut } from "react-chartjs-2";
import { formatCurrency } from "../lib/format.js";
import { CATEGORICAL_COLORS, centerTextPlugin } from "../lib/charts.js";

// Generic doughnut for "share of <valueLabel> by <entity>" — a negative
// slice (e.g. a loss-making site's profit) is sized by its magnitude like
// every other slice, but its tooltip/legend still show the real signed
// value, so a loss doesn't silently read as a normal positive share.
export default function PieChart({ groups, valueLabel }) {
  const colors = groups.map((_, index) => CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]);
  const total = groups.reduce((sum, g) => sum + Math.abs(g.value), 0);
  // The real net total (unlike `total` above, not clamped to magnitude) —
  // what the center-text plugin shows, so a net loss still reads negative.
  const signedTotal = groups.reduce((sum, g) => sum + g.value, 0);

  return (
    <div className="dashboard-pie-chart">
      <div className="chart-container">
        <Doughnut
          data={{
            labels: groups.map((g) => g.name),
            datasets: [
              {
                label: valueLabel,
                data: groups.map((g) => Math.abs(g.value)),
                backgroundColor: colors,
                borderWidth: 0,
              },
            ],
          }}
          plugins={[centerTextPlugin]}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.label}: ${formatCurrency(groups[ctx.dataIndex].value)}`,
                },
              },
              centerText: { value: formatCurrency(signedTotal) },
            },
          }}
        />
      </div>
      <div className="dashboard-pie-legend">
        {groups.map((g, index) => (
          <div className="dashboard-pie-legend-item" key={g.name}>
            <span
              className="dashboard-pie-legend-swatch"
              style={{ backgroundColor: colors[index] }}
              aria-hidden="true"
            />
            <span className="dashboard-pie-legend-label">{g.name}</span>
            <span className="dashboard-pie-legend-percent">
              {total > 0 ? Math.round((Math.abs(g.value) / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
