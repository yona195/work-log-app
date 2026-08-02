// Register the Chart.js pieces used by the dashboard once, on import.
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

// Draws the doughnut's net total in the middle of the ring — only ever
// meaningful for a doughnut (a bar/line chart has no "middle"), so it's a
// no-op for every other chart type even though it's registered globally.
// The value is supplied per-chart via options.plugins.centerText, since the
// plugin itself has no way to know which dataset value is the "real" signed
// total (PieChart's own slice data is unsigned, for slice sizing).
export const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart) {
    const config = chart.options.plugins?.centerText;
    if (!config || chart.config.type !== "doughnut") return;

    const { ctx, chartArea } = chart;
    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "#1e2433"; // matches --color-text
    ctx.font = "700 20px Assistant, Rubik, Arial, sans-serif";
    ctx.fillText(config.value, centerX, centerY - 10);

    ctx.fillStyle = "#6b7280"; // matches --color-muted
    ctx.font = "400 12px Assistant, Rubik, Arial, sans-serif";
    ctx.fillText("סה״כ", centerX, centerY + 12);

    ctx.restore();
  },
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  centerTextPlugin
);

export { ChartJS };

// Fixed categorical hue order, cycled only once every 8 distinct entities are
// exhausted. Shared so charts on different pages stay visually consistent.
// No red — red is reserved for NEGATIVE_COLOR (loss) and never cycles back
// into the categorical rotation.
export const CATEGORICAL_COLORS = [
  "rgba(55, 138, 221, 0.85)",
  "rgba(29, 158, 117, 0.85)",
  "rgba(186, 117, 23, 0.85)",
  "rgba(127, 119, 221, 0.85)",
  "rgba(212, 83, 126, 0.85)",
  "rgba(216, 90, 48, 0.85)",
  "rgba(99, 153, 34, 0.85)",
  "rgba(136, 135, 128, 0.85)",
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

// Line charts use the exact same Cartesian options shape (plugins/scales)
// as the bar charts above — same function, just under the name that makes
// sense at the call site.
export const buildLineChartOptions = buildBarChartOptions;
