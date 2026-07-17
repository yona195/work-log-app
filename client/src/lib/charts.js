// Register the Chart.js pieces used by the dashboard once, on import.
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export { ChartJS };

// Fixed categorical hue order, cycled only once every 8 distinct entities are
// exhausted. Shared so charts on different pages stay visually consistent.
export const CATEGORICAL_COLORS = [
  "rgba(37, 99, 235, 0.8)",
  "rgba(34, 197, 94, 0.8)",
  "rgba(245, 158, 11, 0.8)",
  "rgba(168, 85, 247, 0.8)",
  "rgba(239, 68, 68, 0.8)",
  "rgba(14, 165, 233, 0.8)",
  "rgba(236, 72, 153, 0.8)",
  "rgba(100, 116, 139, 0.8)",
];

export const NEGATIVE_COLOR = "rgba(239, 68, 68, 0.8)";
export const REVENUE_COLOR = "rgba(37, 99, 235, 0.75)";
export const COST_COLOR = "rgba(239, 68, 68, 0.75)";

// Shared typography so axis/legend/tooltip text reads clearly across every
// bar chart in the app — bump this once here instead of per-chart.
const AXIS_TICK_FONT = { size: 13, weight: "600" };
const LEGEND_FONT = { size: 13, weight: "600" };
const TOOLTIP_BODY_FONT = { size: 13, weight: "600" };
const TOOLTIP_TITLE_FONT = { size: 13, weight: "700" };

/**
 * Shared Chart.js options for the app's bar charts: legible bold ticks,
 * a bottom legend with round swatches (only for multi-series charts),
 * bold tooltips, and recessive gridlines that don't compete with the bars.
 *
 * `legend`: show the legend (only meaningful with 2+ datasets).
 * `tooltipLabel(ctx)`: Chart.js tooltip label callback.
 * `yTickFormatter(value)`: y-axis tick formatter (e.g. currency).
 * `grouped`: true for multi-series bars — hovers show every series at once.
 */
export function buildBarChartOptions({
  legend = false,
  tooltipLabel,
  yTickFormatter,
  grouped = false,
} = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: grouped ? { mode: "index", intersect: false } : undefined,
    plugins: {
      legend: legend
        ? {
            position: "bottom",
            labels: {
              font: LEGEND_FONT,
              usePointStyle: true,
              pointStyle: "circle",
              padding: 16,
            },
          }
        : { display: false },
      tooltip: {
        titleFont: TOOLTIP_TITLE_FONT,
        bodyFont: TOOLTIP_BODY_FONT,
        padding: 10,
        callbacks: tooltipLabel ? { label: tooltipLabel } : undefined,
      },
    },
    scales: {
      x: {
        ticks: { font: AXIS_TICK_FONT },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { font: AXIS_TICK_FONT, callback: yTickFormatter },
        grid: { color: "rgba(15, 23, 42, 0.06)" },
      },
    },
  };
}
