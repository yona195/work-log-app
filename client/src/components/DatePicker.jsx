import { useEffect, useMemo, useRef, useState } from "react";
import {
  HEBREW_MONTHS,
  HEBREW_WEEKDAYS_SHORT,
  addMonths,
  buildMonthWeeks,
  parseISO,
  todayISO,
} from "../lib/calendar.js";

function formatDisplay(iso) {
  const parsed = parseISO(iso);
  if (!parsed) return "";
  const day = String(parsed.day).padStart(2, "0");
  const month = String(parsed.month + 1).padStart(2, "0");
  return `${day}/${month}/${parsed.year}`;
}

function MonthPanel({ year, month, onPrev, onNext, isSelected, isInRange, onDayClick, min, max }) {
  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month]);
  const today = todayISO();

  return (
    <div className="date-picker-month">
      <div className="date-picker-month-header">
        <button
          type="button"
          className="date-picker-nav"
          onClick={onPrev}
          aria-label="חודש קודם"
        >
          ‹
        </button>
        <span>
          {HEBREW_MONTHS[month]} {year}
        </span>
        <button
          type="button"
          className="date-picker-nav"
          onClick={onNext}
          aria-label="חודש הבא"
        >
          ›
        </button>
      </div>

      <div className="date-picker-weekdays">
        {HEBREW_WEEKDAYS_SHORT.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="date-picker-days">
        {weeks.flat().map((cell) => {
          const disabled = (min && cell.iso < min) || (max && cell.iso > max);
          const classes = ["date-picker-day"];
          if (!cell.inMonth) classes.push("is-outside");
          if (cell.iso === today) classes.push("is-today");
          if (isSelected(cell.iso)) classes.push("is-selected");
          else if (isInRange(cell.iso)) classes.push("is-in-range");
          if (disabled) classes.push("is-disabled");
          return (
            <button
              key={cell.iso}
              type="button"
              className={classes.join(" ")}
              disabled={disabled}
              onClick={() => onDayClick(cell.iso)}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Reusable calendar date picker. Replaces native <input type="date"> where a
 * nicer UI is wanted, in three modes:
 *  - "single": value is an ISO string ("" when empty). One month shown.
 *  - "range": value is { from, to } (either can be ""). Two months shown;
 *    first click sets "from", the next sets "to" (or restarts "from" if the
 *    click lands before the current "from").
 *  - "multi": value is an array of ISO strings. Two months shown; every
 *    click toggles that date in/out of the array, for picking several
 *    non-consecutive dates in one go (e.g. a shift on scattered days).
 */
export default function DatePicker({
  mode = "single",
  value,
  onChange,
  placeholder = "בחר תאריך",
  min,
  max,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const seedISO =
    (mode === "single" ? value : mode === "range" ? value?.from : value?.[0]) ||
    todayISO();
  const seed = parseISO(seedISO) || parseISO(todayISO());
  const [anchor, setAnchor] = useState({ year: seed.year, month: seed.month });

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const monthCount = mode === "single" ? 1 : 2;
  const monthsToShow = useMemo(() => {
    if (monthCount === 1) return [anchor];
    return [anchor, addMonths(anchor.year, anchor.month, 1)];
  }, [anchor, monthCount]);

  const goPrev = () => setAnchor((a) => addMonths(a.year, a.month, -1));
  const goNext = () => setAnchor((a) => addMonths(a.year, a.month, 1));

  const isSelected = (iso) => {
    if (mode === "single") return iso === value;
    if (mode === "range") return iso === value?.from || iso === value?.to;
    return Array.isArray(value) && value.includes(iso);
  };

  const isInRange = (iso) => {
    if (mode !== "range" || !value?.from || !value?.to) return false;
    return iso > value.from && iso < value.to;
  };

  const handleDayClick = (iso) => {
    if (mode === "single") {
      onChange(iso);
      setOpen(false);
      return;
    }
    if (mode === "range") {
      if (!value?.from || (value.from && value.to)) {
        onChange({ from: iso, to: "" });
      } else if (iso < value.from) {
        onChange({ from: iso, to: "" });
      } else {
        onChange({ from: value.from, to: iso });
      }
      return;
    }
    const current = new Set(Array.isArray(value) ? value : []);
    if (current.has(iso)) current.delete(iso);
    else current.add(iso);
    onChange(Array.from(current).sort());
  };

  const displayText = useMemo(() => {
    if (mode === "single") return value ? formatDisplay(value) : "";
    if (mode === "range") {
      if (value?.from && value?.to) {
        return `${formatDisplay(value.from)} - ${formatDisplay(value.to)}`;
      }
      return value?.from ? formatDisplay(value.from) : "";
    }
    const count = Array.isArray(value) ? value.length : 0;
    if (count === 0) return "";
    if (count === 1) return formatDisplay(value[0]);
    return `${count} תאריכים נבחרו`;
  }, [mode, value]);

  return (
    <div className="date-picker" ref={containerRef}>
      <button
        type="button"
        className="date-picker-trigger"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={displayText ? "" : "date-picker-placeholder"}>
          {displayText || placeholder}
        </span>
        <span className="date-picker-icon" aria-hidden="true">
          📅
        </span>
      </button>

      {open && (
        <div className="date-picker-popover">
          <div className="date-picker-months">
            {monthsToShow.map(({ year, month }) => (
              <MonthPanel
                key={`${year}-${month}`}
                year={year}
                month={month}
                onPrev={goPrev}
                onNext={goNext}
                isSelected={isSelected}
                isInRange={isInRange}
                onDayClick={handleDayClick}
                min={min}
                max={max}
              />
            ))}
          </div>

          {mode !== "single" && (
            <div className="date-picker-footer">
              {mode === "multi" && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => onChange([])}
                >
                  נקה הכל
                </button>
              )}
              <button
                type="button"
                className="primary-btn"
                onClick={() => setOpen(false)}
              >
                סיימתי
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
