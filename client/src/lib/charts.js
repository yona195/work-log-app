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
