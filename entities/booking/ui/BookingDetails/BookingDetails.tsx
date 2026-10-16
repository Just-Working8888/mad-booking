import { Alert } from "antd";
import type { Booking, BookingStatus } from "../../model";
import { UNTITLED, formatBookingDuration, formatDayTitle } from "../../lib/format";
import styles from "./BookingDetails.module.scss";

type BookingDetailsProps = {
  booking: Booking;
  status: BookingStatus;
  /** Hide the built-in "can't edit" note when the caller explains it in its own words. */
  showReadOnlyReason?: boolean;
};

const READ_ONLY_REASON: Record<BookingStatus, string | null> = {
  upcoming: null,
  ongoing: "Бронь уже началась, поэтому изменить её нельзя. Удалить можно.",
  past: "Бронь уже завершилась, поэтому изменить её нельзя. Удалить можно.",
};

/** Read-only view of a booking that can no longer be edited. */
export function BookingDetails({ booking, status, showReadOnlyReason = true }: BookingDetailsProps) {
  const reason = showReadOnlyReason ? READ_ONLY_REASON[status] : null;

  return (
    <div className={styles.details}>
      <dl className={styles.list}>
        <dt>Название</dt>
        <dd>{booking.title ?? UNTITLED}</dd>
        <dt>Дата</dt>
        <dd>{formatDayTitle(booking.date)}</dd>
        <dt>Время</dt>
        <dd>
          {booking.start}–{booking.end} <span className={styles.muted}>· {formatBookingDuration(booking)}</span>
        </dd>
      </dl>
      {reason && <Alert type="info" showIcon title={reason} />}
    </div>
  );
}
