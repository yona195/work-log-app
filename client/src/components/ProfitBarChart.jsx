import { Bar } from "react-chartjs-2";
import { formatCurrency } from "../lib/format.js";
import { CATEGORICAL_COLORS, NEGATIVE_COLOR, buildBarChartOptions } from "../lib/charts.js";

// Single-series bar chart for "profit by <entity>" (site, customer, ...):
// categorical color per bar, automatically red when that entity is a loss.
export default function ProfitBarChart({ groups, label = "רווח" }) {
  return (
    <div className="chart-container">
      <Bar
        data={{
          labels: groups.map((g) => g.name),
          datasets: [
            {
              label,
              data: groups.map((g) => g.profit),
              backgroundColor: groups.map((g, index) =>
                g.profit < 0
                  ? NEGATIVE_COLOR
                  : CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]
              ),
              borderRadius: 4,
              maxBarThickness: 64,
            },
          ],
        }}
        options={buildBarChartOptions({
          tooltipLabel: (ctx) => `${label}: ${formatCurrency(ctx.raw)}`,
          yTickFormatter: (value) => formatCurrency(value),
        })}
      />
    </div>
  );
}
