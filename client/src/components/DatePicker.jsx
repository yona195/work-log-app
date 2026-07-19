import { useEffect, useMemo, useRef, useState } from "react";
import {
  HEBREW_MONTHS,
  HEBREW_WEEKDAYS_SHORT,
  addMonths,
  buildMonthWeeks,
  isoRangeInclusive,
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

function MonthPanel({
  year,
  month,
  onPrev,
  onNext,
  isSelected,
  isInRange,
  onDayClick,
  onDayMouseDown,
  onDayMouseEnter,
  min,
  max,
}) {
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
        {weeks.map((week, weekIndex) =>
          week.map((cell, dayIndex) => {
            const disabled = (min && cell.iso < min) || (max && cell.iso > max);
            const selected = isSelected(cell.iso);
            const classes = ["date-picker-day"];
            if (!cell.inMonth) classes.push("is-outside");
            if (cell.iso === today) classes.push("is-today");
            if (selected) classes.push("is-selected");
            else if (isInRange(cell.iso)) classes.push("is-in-range");
            if (disabled) classes.push("is-disabled");

            // Merges consecutive selected days in the same week row into one
            // connected block instead of separate dots — a right-hand
            // neighbour (index - 1) is the chronologically previous day, a
            // left-hand one (index + 1) is the next day (RTL grid order).
            if (selected) {
              const prevCell = dayIndex > 0 ? week[dayIndex - 1] : null;
              const nextCell = dayIndex < week.length - 1 ? week[dayIndex + 1] : null;
              if (prevCell && isSelected(prevCell.iso)) classes.push("connects-prev");
              if (nextCell && isSelected(nextCell.iso)) classes.push("connects-next");
            }

            return (
              <button
                key={cell.iso}
                type="button"
                className={classes.join(" ")}
                disabled={disabled}
                onClick={() => onDayClick(cell.iso)}
                onMouseDown={() => onDayMouseDown(cell.iso)}
                onMouseEnter={() => onDayMouseEnter(cell.iso)}
              >
                {cell.day}
              </button>
            );
          })
        )}
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
 *  - "multi": value is an array of ISO strings. Two months shown. A plain
 *    click toggles that single date in/out. Dragging across days (mouse
 *    down on one day, up on another) adds the whole dragged span to the
 *    selection in one gesture — and can be repeated to add another,
 *    separate span without losing the first (e.g. two work weeks).
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

  // Multi-mode drag state. dragAnchorRef avoids stale closures in the
  // document-level mouseup listener; dragPreview is real state so the
  // in-progress span re-renders as the pointer moves.
  const dragAnchorRef = useRef(null);
  const [dragPreview, setDragPreview] = useState(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (mode !== "multi") return undefined;

    function commitDrag() {
      if (!dragAnchorRef.current) return;
      dragAnchorRef.current = null;
      setDragPreview((preview) => {
        if (!preview) return null;
        const current = new Set(Array.isArray(value) ? value : []);
        if (preview.start === preview.end) {
          // No real movement — a plain click just toggles that one day.
          if (current.has(preview.start)) current.delete(preview.start);
          else current.add(preview.start);
        } else {
          isoRangeInclusive(preview.start, preview.end).forEach((iso) =>
            current.add(iso)
          );
        }
        onChange(Array.from(current).sort());
        return null;
      });
    }

    document.addEventListener("mouseup", commitDrag);
    return () => document.removeEventListener("mouseup", commitDrag);
  }, [mode, value, onChange]);

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
    if (mode === "range" && value?.from && value?.to) {
      return iso > value.from && iso < value.to;
    }
    if (mode === "multi" && dragPreview) {
      return isoRangeInclusive(dragPreview.start, dragPreview.end).includes(iso);
    }
    return false;
  };

  const handleDayClick = (iso) => {
    // Multi mode is driven entirely by mousedown/mouseup (see below) so a
    // single click can be told apart from a drag; this handler no-ops there.
    if (mode === "multi") return;
    if (mode === "single") {
      onChange(iso);
      setOpen(false);
      return;
    }
    if (!value?.from || (value.from && value.to)) {
      onChange({ from: iso, to: "" });
    } else if (iso < value.from) {
      onChange({ from: iso, to: "" });
    } else {
      onChange({ from: value.from, to: iso });
    }
  };

  const handleDayMouseDown = (iso) => {
    if (mode !== "multi") return;
    dragAnchorRef.current = iso;
    setDragPreview({ start: iso, end: iso });
  };

  const handleDayMouseEnter = (iso) => {
    if (mode !== "multi" || !dragAnchorRef.current) return;
    setDragPreview({ start: dragAnchorRef.current, end: iso });
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
          {mode === "multi" && (
            <p className="date-picker-hint">
              גררו על פני כמה ימים כדי לבחור טווח שלם - אפשר לחזור על זה כמה פעמים.
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
                onDayMouseDown={handleDayMouseDown}
                onDayMouseEnter={handleDayMouseEnter}
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
