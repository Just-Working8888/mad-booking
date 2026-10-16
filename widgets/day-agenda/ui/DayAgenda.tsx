"use client";

import { Button, Empty, Result, Skeleton } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { DeleteBookingButton } from "@/features/delete-booking";
import { BookingListItem, getBookingStatus, getFreeMinutes, type Booking } from "@/entities/booking";
import { formatDuration, type DateString, type LocalDateTime } from "@/shared/lib/time";
import styles from "./DayAgenda.module.scss";

type DayAgendaProps = {
  date: DateString;
  now: LocalDateTime;
  /** `undefined` while the day is loading. */
  bookings: readonly Booking[] | undefined;
  isError?: boolean;
  onRetry?: () => void;
  /** Why a new booking can't be created right now; `null` when it can. */
  createDisabledReason: string | null;
  onCreate: () => void;
  onOpenBooking: (booking: Booking) => void;
  selectedId?: string;
  highlightedId?: string | null;
  onDeleted?: (booking: Booking) => void;
};

function pluralizeBookings(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} бронь`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} брони`;
  return `${count} броней`;
}

export function DayAgenda({
  date,
  now,
  bookings,
  isError,
  onRetry,
  createDisabledReason,
  onCreate,
  onOpenBooking,
  selectedId,
  highlightedId,
  onDeleted,
}: DayAgendaProps) {
  const freeMinutes = bookings ? getFreeMinutes(date, bookings, now) : 0;

  return (
    <section className={styles.agenda} aria-labelledby="agenda-heading" aria-busy={!bookings && !isError}>
      <header className={styles.header}>
        <h2 id="agenda-heading" className={styles.heading}>
          Брони на день
        </h2>
        {bookings && (
          <p className={styles.summary}>
            {bookings.length > 0 ? pluralizeBookings(bookings.length) : "Нет броней"}
            {" · "}
            {freeMinutes > 0 ? `свободно ${formatDuration(freeMinutes)}` : "свободного времени нет"}
          </p>
        )}
      </header>

      {isError ? (
        <Result
          className={styles.state}
          status="warning"
          title="Не удалось загрузить брони"
          subTitle="Проверьте подключение и попробуйте ещё раз"
          extra={<Button onClick={onRetry}>Повторить</Button>}
        />
      ) : !bookings ? (
        <Skeleton active title={false} paragraph={{ rows: 4 }} className={styles.state} />
      ) : bookings.length === 0 ? (
        <Empty
          className={styles.state}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            createDisabledReason === null
              ? "Броней нет. Выберите свободное время на шкале или создайте бронь"
              : "На этот день броней нет"
          }
        />
      ) : (
        <ul className={styles.list}>
          {bookings.map((booking) => (
            <BookingListItem
              key={booking.id}
              booking={booking}
              status={getBookingStatus(booking, now)}
              selected={booking.id === selectedId}
              highlighted={booking.id === highlightedId}
              onClick={onOpenBooking}
              actions={<DeleteBookingButton booking={booking} iconOnly onDeleted={onDeleted} />}
            />
          ))}
        </ul>
      )}

      {bookings && !isError && (
        <div className={styles.footer}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            size="large"
            disabled={createDisabledReason !== null}
            aria-describedby={createDisabledReason ? "agenda-create-hint" : undefined}
            onClick={onCreate}
          >
            Новая бронь
          </Button>
          {/* A visible hint instead of a tooltip: it also works on touch screens. */}
          {createDisabledReason && (
            <p id="agenda-create-hint" className={styles.hint}>
              {createDisabledReason}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
