import type { ReactNode } from "react";
import { Tag } from "antd";
import { cx } from "@/shared/lib/classnames";
import type { Booking, BookingStatus } from "../../model";
import { STATUS_LABEL, UNTITLED, describeBooking, formatBookingDuration } from "../../lib/format";
import styles from "./BookingListItem.module.scss";

type BookingListItemProps = {
  booking: Booking;
  status: BookingStatus;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: (booking: Booking) => void;
  /** Slot for actions owned by features (e.g. delete). */
  actions?: ReactNode;
};

export function BookingListItem({ booking, status, selected, highlighted, onClick, actions }: BookingListItemProps) {
  const statusLabel = STATUS_LABEL[status];

  return (
    <li className={cx(styles.item, styles[status], selected && styles.selected, highlighted && styles.highlighted)}>
      <button
        type="button"
        className={styles.main}
        aria-label={`${describeBooking(booking)}. ${status === "upcoming" ? "Изменить" : "Подробнее"}`}
        aria-pressed={selected}
        onClick={() => onClick?.(booking)}
      >
        <span className={styles.marker} aria-hidden />
        <span className={styles.when}>
          <span className={styles.time}>
            {booking.start}–{booking.end}
          </span>
          <span className={styles.duration}>{formatBookingDuration(booking)}</span>
        </span>
        <span className={styles.title}>{booking.title ?? UNTITLED}</span>
        {statusLabel && (
          <Tag className={styles.tag} color={status === "ongoing" ? "success" : "default"} variant="filled">
            {statusLabel}
          </Tag>
        )}
      </button>
      {actions && <div className={styles.actions}>{actions}</div>}
    </li>
  );
}
