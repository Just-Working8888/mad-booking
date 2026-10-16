"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Button } from "antd";
import {
  BookingBlock,
  WORKDAY_END,
  WORKDAY_START,
  findConflict,
  formatDayTitle,
  formatRange,
  getBookableFrom,
  getBookingStatus,
  getFreeIntervals,
  suggestSlot,
  toMinuteRange,
  type Booking,
  type FreeInterval,
  type MinuteRange,
} from "@/entities/booking";
import { cx } from "@/shared/lib/classnames";
import { formatTime, type DateString, type LocalDateTime } from "@/shared/lib/time";
import styles from "./DayTimeline.module.scss";

const DAY_LENGTH = WORKDAY_END - WORKDAY_START;
const HOUR_MARKS = Array.from({ length: DAY_LENGTH / 60 + 1 }, (_, i) => WORKDAY_START + i * 60);
/** Free gaps at least this long get a visible "Свободно" caption. */
const CAPTION_MIN_MINUTES = 45;

const percent = (minutes: number) => `${((minutes - WORKDAY_START) / DAY_LENGTH) * 100}%`;
const position = ({ start, end }: MinuteRange): CSSProperties => ({
  top: percent(start),
  height: `${((end - start) / DAY_LENGTH) * 100}%`,
});

type DayTimelineProps = {
  date: DateString;
  now: LocalDateTime;
  /** `undefined` while the day is loading. */
  bookings: readonly Booking[] | undefined;
  isError?: boolean;
  onRetry?: () => void;
  /** Time entered in the open form; drawn as a dashed preview. */
  draft?: MinuteRange | null;
  /** The booking being edited: excluded from the preview's conflict check. */
  editingId?: string;
  highlightedId?: string | null;
  onCreate: (range: MinuteRange) => void;
  onOpenBooking: (booking: Booking) => void;
};

export function DayTimeline({
  date,
  now,
  bookings,
  isError,
  onRetry,
  draft,
  editingId,
  highlightedId,
  onCreate,
  onOpenBooking,
}: DayTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const nowLineRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<MinuteRange | null>(null);

  const isToday = date === now.date;
  const pastUntil = Math.max(getBookableFrom(date, now), WORKDAY_START);
  const showNowLine = isToday && now.minutes >= WORKDAY_START && now.minutes <= WORKDAY_END;
  const freeIntervals = useMemo(
    () => (bookings ? getFreeIntervals(date, bookings, now) : []),
    [bookings, date, now],
  );
  const draftConflict =
    draft && bookings
      ? findConflict({ date, start: formatTime(draft.start), end: formatTime(draft.end) }, bookings, editingId)
      : undefined;

  // Today: bring the current time into view once per opened day.
  useEffect(() => {
    nowLineRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [date]);

  /** Minute under the pointer, from the track's geometry. */
  const minuteAt = (clientY: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return WORKDAY_START;
    return Math.round(WORKDAY_START + ((clientY - rect.top) / rect.height) * DAY_LENGTH);
  };

  const suggestionAt = (interval: FreeInterval, event: MouseEvent) =>
    // `detail === 0` means keyboard activation: no pointer, start at the beginning of the gap.
    suggestSlot(date, bookings ?? [], now, event.detail === 0 ? interval.start : minuteAt(event.clientY));

  return (
    <section className={styles.timeline} aria-label={`Расписание на ${formatDayTitle(date)}`}>
      <div className={styles.scale} aria-hidden>
        {HOUR_MARKS.map((minutes) => (
          <span key={minutes} className={styles.hour} style={{ top: percent(minutes) }}>
            {formatTime(minutes)}
          </span>
        ))}
      </div>

      <div ref={trackRef} className={styles.track} onMouseLeave={() => setHover(null)}>
        <div className={styles.grid} aria-hidden />

        {pastUntil > WORKDAY_START && (
          <div className={styles.past} style={position({ start: WORKDAY_START, end: pastUntil })} aria-hidden />
        )}

        {freeIntervals.map((interval) =>
          interval.bookable ? (
            <button
              key={interval.start}
              type="button"
              className={styles.free}
              style={position(interval)}
              aria-label={`Свободно ${formatRange(interval)}. Создать бронь`}
              onMouseMove={(event) => setHover(suggestionAt(interval, event))}
              onClick={(event) => {
                const slot = suggestionAt(interval, event);
                if (slot) onCreate(slot);
              }}
            >
              {interval.end - interval.start >= CAPTION_MIN_MINUTES && (
                <span className={styles.freeCaption}>Свободно {formatRange(interval)}</span>
              )}
            </button>
          ) : (
            <div
              key={interval.start}
              className={styles.tooShort}
              style={position(interval)}
              title="Меньше 30 минут — забронировать нельзя"
              aria-hidden
            />
          ),
        )}

        {hover && !draft && (
          <div className={styles.ghost} style={position(hover)} aria-hidden>
            + {formatRange(hover)}
          </div>
        )}

        {bookings?.map((booking) => {
          const range = toMinuteRange(booking);
          // While a booking is being edited, the draft takes its place instead of overlapping it.
          const replacedByDraft = draft && booking.id === editingId;
          return (
            range &&
            !replacedByDraft && (
              <BookingBlock
                key={booking.id}
                booking={booking}
                status={getBookingStatus(booking, now)}
                style={position(range)}
                selected={booking.id === editingId}
                highlighted={booking.id === highlightedId}
                onClick={onOpenBooking}
              />
            )
          );
        })}

        {draft && (
          <div className={cx(styles.draft, draftConflict && styles.draftConflict)} style={position(draft)} aria-hidden>
            <span>{formatRange(draft)}</span>
            {draftConflict && <span>пересекается с {draftConflict.start}–{draftConflict.end}</span>}
          </div>
        )}

        {showNowLine && (
          <div ref={nowLineRef} className={styles.now} style={{ top: percent(now.minutes) }} aria-hidden>
            <span className={styles.nowLabel}>{formatTime(now.minutes)}</span>
          </div>
        )}

        {!bookings && !isError && (
          <div className={styles.loading} aria-busy="true" aria-label="Загрузка расписания">
            <span style={position({ start: 600, end: 660 })} />
            <span style={position({ start: 750, end: 840 })} />
            <span style={position({ start: 930, end: 960 })} />
          </div>
        )}

        {isError && (
          <div className={styles.error} role="alert">
            <p>Не удалось загрузить расписание</p>
            <Button onClick={onRetry}>Повторить</Button>
          </div>
        )}
      </div>
    </section>
  );
}

