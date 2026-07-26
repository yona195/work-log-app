import { Bar } from "react-chartjs-2";
import { formatCurrency } from "../lib/format.js";
import {
  CATEGORICAL_COLORS,
  NEGATIVE_COLOR,
  REVENUE_COLOR,
  COST_COLOR,
  buildBarChartOptions,
} from "../lib/charts.js";

// Monthly version of ProfitBarChart/RevenueCostBarChart — same bar-per-
// entity patterns, just with each month standing in for the entity.
export default function MonthlyTrendChart({ mode, data }) {
  if (mode === "revenue-cost") {
    return (
      <div className="chart-container">
        <Bar
          data={{
            labels: data.map((m) => m.month),
            datasets: [
              {
                label: "הכנסות",
                data: data.map((m) => m.revenue),
                backgroundColor: REVENUE_COLOR,
                borderRadius: 4,
                maxBarThickness: 48,
              },
              {
                label: "הוצאות",
                data: data.map((m) => m.cost),
                backgroundColor: COST_COLOR,
                borderRadius: 4,
                maxBarThickness: 48,
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

  return (
    <div className="chart-container">
      <Bar
        data={{
          labels: data.map((m) => m.month),
          datasets: [
            {
              label: "רווח",
              data: data.map((m) => m.profit),
              backgroundColor: data.map((m, index) =>
                m.profit < 0 ? NEGATIVE_COLOR : CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]
              ),
              borderRadius: 4,
              maxBarThickness: 48,
            },
          ],
        }}
        options={buildBarChartOptions({
          tooltipLabel: (ctx) => `רווח: ${formatCurrency(ctx.raw)}`,
          yTickFormatter: (value) => formatCurrency(value),
        })}
      />
    </div>
  );
}
