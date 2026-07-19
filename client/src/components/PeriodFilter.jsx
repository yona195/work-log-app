import { useMemo, useState } from "react";
import { getCurrentMonthRange, getLastThreeMonthsRange } from "../lib/entities.js";
import DatePicker from "./DatePicker.jsx";

// Shared by the report pages: a period preset (current month / last three
// months / a custom date range) that resolves to a concrete { from, to }.
export function useDateRangeFilter(defaultPeriod = "current-month") {
  const [period, setPeriod] = useState(defaultPeriod);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(() => {
    if (period === "current-month") return getCurrentMonthRange();
    if (period === "last-three-months") return getLastThreeMonthsRange();
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  return { period, setPeriod, customFrom, setCustomFrom, customTo, setCustomTo, from, to };
}

export default function PeriodFilter({
  period,
  onPeriodChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}) {
  return (
    <>
      <label>תקופה</label>
      <select value={period} onChange={(e) => onPeriodChange(e.target.value)}>
        <option value="current-month">החודש הנוכחי</option>
        <option value="last-three-months">שלושה חודשים אחרונים</option>
        <option value="custom">בחירת תאריך</option>
      </select>

      {period === "custom" && (
        <div>
          <label>טווח תאריכים</label>
          <DatePicker
            mode="range"
            value={{ from: customFrom, to: customTo }}
            onChange={({ from, to }) => {
              onCustomFromChange(from);
              onCustomToChange(to);
            }}
          />
        </div>
      )}
    </>
  );
}
