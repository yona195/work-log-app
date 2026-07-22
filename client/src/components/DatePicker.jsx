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
 *  - "multi-range": value is an array of { start, end } ranges. Two months
 *    shown. First click starts a range, second click completes it (blue
 *    dots on start/end, light band between — same visual language as
 *    "range"); the next click after that starts a brand new range without
 *    touching the ones already completed. Clicking any day that's already
 *    part of a completed range removes that whole range.
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

  // multi-range only: the start of a range that's been clicked but not yet
  // completed with a second click.
  const [pendingStart, setPendingStart] = useState(null);

  const seedISO =
    (mode === "single"
      ? value
      : mode === "range"
        ? value?.from
        : value?.[0]?.start) || todayISO();
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

  // Reopening always starts from a clean slate — no half-picked range left
  // over from last time — without touching the already-completed ranges,
  // which live in the caller's state (value) and persist across opens.
  useEffect(() => {
    if (open) setPendingStart(null);
  }, [open]);

  const monthCount = mode === "single" ? 1 : 2;
  const monthsToShow = useMemo(() => {
    if (monthCount === 1) return [anchor];
    return [anchor, addMonths(anchor.year, anchor.month, 1)];
  }, [anchor, monthCount]);

  const goPrev = () => setAnchor((a) => addMonths(a.year, a.month, -1));
  const goNext = () => setAnchor((a) => addMonths(a.year, a.month, 1));

  const ranges = mode === "multi-range" && Array.isArray(value) ? value : [];

  const isSelected = (iso) => {
    if (mode === "single") return iso === value;
    if (mode === "range") return iso === value?.from || iso === value?.to;
    return ranges.some((r) => iso === r.start || iso === r.end);
  };

  const isInRange = (iso) => {
    if (mode === "range" && value?.from && value?.to) {
      return iso > value.from && iso < value.to;
    }
    if (mode === "multi-range") {
      return ranges.some((r) => iso > r.start && iso < r.end);
    }
    return false;
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

    // multi-range. A date clicked with no pending pick is selected
    // immediately as its own single-day range — no second click needed —
    // and stays "pending" only in the sense that the very next click can
    // still turn it into a real range: clicking a *different* date extends
    // it (chronologically normalized), while clicking that *same* date
    // again cancels it. Once either happens, pendingStart clears, so a
    // third click always starts a fresh, independent pick — never appends
    // to what was just completed.
    if (pendingStart !== null) {
      const withoutPending = ranges.filter(
        (r) => !(r.start === pendingStart && r.end === pendingStart)
      );
      if (iso === pendingStart) {
        onChange(withoutPending);
      } else {
        const start = pendingStart <= iso ? pendingStart : iso;
        const end = pendingStart <= iso ? iso : pendingStart;
        onChange([...withoutPending, { start, end }]);
      }
      setPendingStart(null);
      return;
    }

    const existingIndex = ranges.findIndex((r) => iso >= r.start && iso <= r.end);
    if (existingIndex !== -1) {
      const next = ranges.slice();
      next.splice(existingIndex, 1);
      onChange(next);
      return;
    }

    onChange([...ranges, { start: iso, end: iso }]);
    setPendingStart(iso);
  };

  const displayText = useMemo(() => {
    if (mode === "single") return value ? formatDisplay(value) : "";
    if (mode === "range") {
      if (value?.from && value?.to) {
        return `${formatDisplay(value.from)} - ${formatDisplay(value.to)}`;
      }
      return value?.from ? formatDisplay(value.from) : "";
    }
    if (ranges.length === 0) return "";
    if (ranges.length === 1) {
      const r = ranges[0];
      return r.start === r.end
        ? formatDisplay(r.start)
        : `${formatDisplay(r.start)} - ${formatDisplay(r.end)}`;
    }
    return `${ranges.length} טווחי תאריכים נבחרו`;
  }, [mode, value, ranges]);

  return (
    <div className="date-picker" ref={containerRef}>
      <button
        type="button"
        className="date-picker-trigger"
        onClick={() => setOpen((prev) => !prev)}
        title={
          mode === "multi-range"
            ? "לחיצה על תאריך בוחרת אותו מיד; לחיצה על תאריך נוסף הופכת אותו לטווח. לחיצה על תאריך/טווח קיים מוחקת אותו."
            : undefined
        }
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
          {mode === "multi-range" && pendingStart && (
            <p className="date-picker-hint">
              התאריך נבחר. אפשר ללחוץ על תאריך נוסף כדי ליצור טווח, או ללחוץ עליו שוב לביטול.
            </p>
          )}
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
              {mode === "multi-range" && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    onChange([]);
                    setPendingStart(null);
                  }}
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
