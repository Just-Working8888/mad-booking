"use client";

import { Button, DatePicker, Tooltip } from "antd";
import { CalendarOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { formatDayTitle, useBookingsPrefetch } from "@/entities/booking";
import { cx } from "@/shared/lib/classnames";
import { addDays, getWeekDates, type DateString } from "@/shared/lib/time";
import styles from "./DateNavigator.module.scss";

type DateNavigatorProps = {
  date: DateString;
  today: DateString;
  onChange: (date: DateString) => void;
};

const toDayjs = (date: DateString) => dayjs(date);
const fromDayjs = (value: Dayjs) => value.format("YYYY-MM-DD");

export function DateNavigator({ date, today, onChange }: DateNavigatorProps) {
  // Warm the cache for a day the user is about to open, so switching feels instant.
  const prefetch = useBookingsPrefetch("getBookings", { ifOlderThan: 30 });
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const prefetchProps = (target: DateString) => ({
    onMouseEnter: () => prefetch(target),
    onFocus: () => prefetch(target),
  });

  return (
    <nav className={styles.navigator} aria-label="Выбор даты">
      <div className={styles.top}>
        <div className={styles.heading}>
          <h2 className={styles.title} aria-live="polite">
            {formatDayTitle(date)}
          </h2>
          {date === today && <span className={styles.todayBadge}>Сегодня</span>}
        </div>

        <div className={styles.controls}>
          <Tooltip title="Предыдущий день">
            <Button icon={<LeftOutlined />} aria-label="Предыдущий день" onClick={() => onChange(prev)} {...prefetchProps(prev)} />
          </Tooltip>
          <Button onClick={() => onChange(today)} disabled={date === today} {...prefetchProps(today)}>
            Сегодня
          </Button>
          <Tooltip title="Следующий день">
            <Button icon={<RightOutlined />} aria-label="Следующий день" onClick={() => onChange(next)} {...prefetchProps(next)} />
          </Tooltip>
          <DatePicker
            className={styles.picker}
            value={toDayjs(date)}
            onChange={(value) => value && onChange(fromDayjs(value))}
            allowClear={false}
            inputReadOnly
            format="DD.MM.YYYY"
            suffixIcon={<CalendarOutlined />}
            aria-label="Выбрать дату в календаре"
          />
        </div>
      </div>

      <ul className={styles.week} aria-label="Дни недели">
        {getWeekDates(date).map((day) => {
          const value = toDayjs(day);
          const isSelected = day === date;
          return (
            <li key={day}>
              <button
                type="button"
                className={cx(styles.day, isSelected && styles.selected, day === today && styles.today, day < today && styles.past)}
                aria-pressed={isSelected}
                aria-current={day === today ? "date" : undefined}
                aria-label={formatDayTitle(day)}
                onClick={() => onChange(day)}
                {...prefetchProps(day)}
              >
                <span className={styles.weekday}>{value.format("dd")}</span>
                <span className={styles.dayNumber}>{value.format("D")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
