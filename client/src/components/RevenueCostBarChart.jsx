import { Bar } from "react-chartjs-2";
import { formatCurrency } from "../lib/format.js";
import { REVENUE_COLOR, COST_COLOR, buildBarChartOptions } from "../lib/charts.js";

// Grouped bar chart for "revenue vs. cost by <entity>" (workforce, ...).
export default function RevenueCostBarChart({ groups }) {
  return (
    <div className="chart-container">
      <Bar
        data={{
          labels: groups.map((g) => g.name),
          datasets: [
            {
              label: "הכנסות",
              data: groups.map((g) => g.revenue),
              backgroundColor: REVENUE_COLOR,
              borderRadius: 4,
              maxBarThickness: 64,
            },
            {
              label: "הוצאות",
              data: groups.map((g) => g.cost),
              backgroundColor: COST_COLOR,
              borderRadius: 4,
              maxBarThickness: 64,
            },
          ],
        }}
        options={buildBarChartOptions({
          legend: true,
          grouped: true,
          tooltipLabel: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          yTickFormatter: (value) => formatCurrency(value),
        })}
      />
    </div>
  );
}
