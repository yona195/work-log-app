import { Line } from "react-chartjs-2";
import { formatCurrency } from "../lib/format.js";
import {
  CATEGORICAL_COLORS,
  REVENUE_COLOR,
  COST_COLOR,
  buildLineChartOptions,
} from "../lib/charts.js";

const PROFIT_COLOR = CATEGORICAL_COLORS[2];

// Monthly trend, one combined line chart: revenue, cost and profit all on
// the same y-axis so their relative movement over the year reads at a
// glance — the profit line is dashed to set it apart from the two solid
// revenue/cost lines it's derived from.
export default function MonthlyTrendChart({ data }) {
  return (
    <div className="chart-container">
      <Line
        data={{
          labels: data.map((m) => m.month),
          datasets: [
            {
              label: "הכנסות",
              data: data.map((m) => m.revenue),
              borderColor: REVENUE_COLOR,
              backgroundColor: REVENUE_COLOR,
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
              fill: false,
            },
            {
              label: "הוצאות",
              data: data.map((m) => m.cost),
              borderColor: COST_COLOR,
              backgroundColor: COST_COLOR,
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
              fill: false,
            },
            {
              label: "רווח",
              data: data.map((m) => m.profit),
              borderColor: PROFIT_COLOR,
              backgroundColor: PROFIT_COLOR,
              borderDash: [6, 4],
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
              fill: false,
            },
          ],
        }}
        options={buildLineChartOptions({
          legend: true,
          grouped: true,
          tooltipLabel: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          yTickFormatter: (value) => formatCurrency(value),
        })}
      />
    </div>
  );
}
