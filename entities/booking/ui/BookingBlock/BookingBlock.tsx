import type { CSSProperties } from "react";
import { cx } from "@/shared/lib/classnames";
import { toMinuteRange, type Booking, type BookingStatus } from "../../model";
import { STATUS_LABEL, UNTITLED, describeBooking } from "../../lib/format";
import styles from "./BookingBlock.module.scss";

/** Below this duration the block is too low for two lines, so title and time share one. */
const COMPACT_BELOW_MINUTES = 50;

type BookingBlockProps = {
  booking: Booking;
  status: BookingStatus;
  /** Absolute position inside the timeline track, computed by the timeline. */
  style: CSSProperties;
  selected?: boolean;
  /** Briefly draws attention: just saved, or the reason for a conflict. */
  highlighted?: boolean;
  onClick?: (booking: Booking) => void;
};

export function BookingBlock({ booking, status, style, selected, highlighted, onClick }: BookingBlockProps) {
  const range = toMinuteRange(booking);
  const compact = range !== null && range.end - range.start < COMPACT_BELOW_MINUTES;
  const statusLabel = STATUS_LABEL[status];
  const action = status === "upcoming" ? "изменить" : "подробнее";

  return (
    <button
      type="button"
      className={cx(
        styles.block,
        styles[status],
        compact && styles.compact,
        selected && styles.selected,
        highlighted && styles.highlighted,
      )}
      style={style}
      aria-label={`${describeBooking(booking)}${statusLabel ? `, ${statusLabel.toLowerCase()}` : ""}. ${action}`}
      aria-pressed={selected}
      onClick={() => onClick?.(booking)}
    >
      <span className={styles.title}>{booking.title ?? UNTITLED}</span>
      <span className={styles.time}>
        {booking.start}–{booking.end}
      </span>
    </button>
  );
}
