"use client";

import { App, Button, Popconfirm } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { describeBooking, toBookingError, useDeleteBookingMutation, type Booking } from "@/entities/booking";
import styles from "./DeleteBookingButton.module.scss";

type DeleteBookingButtonProps = {
  booking: Booking;
  /** Icon-only button for dense lists; a labelled one otherwise. */
  iconOnly?: boolean;
  /** Called when the booking is gone — deleted now or already deleted by someone else. */
  onDeleted?: (booking: Booking) => void;
};

export function DeleteBookingButton({ booking, iconOnly, onDeleted }: DeleteBookingButtonProps) {
  const { message } = App.useApp();
  const [deleteBooking, { isLoading }] = useDeleteBookingMutation();

  const handleConfirm = async () => {
    try {
      await deleteBooking(booking.id).unwrap();
      message.success("Бронь удалена");
      onDeleted?.(booking);
    } catch (error) {
      const { code, message: text } = toBookingError(error);
      // Someone else was faster: the goal is reached, and the 404 already triggered a refetch.
      if (code === "NOT_FOUND") {
        message.info("Эта бронь уже была удалена — расписание обновлено");
        onDeleted?.(booking);
      } else {
        message.error(text);
      }
    }
  };

  const label = `Удалить бронь ${describeBooking(booking)}`;

  return (
    <Popconfirm
      title="Удалить бронь?"
      description={<span className={styles.description}>{describeBooking(booking)}</span>}
      okText="Удалить"
      cancelText="Отмена"
      okButtonProps={{ danger: true }}
      // Returning a promise keeps the OK button in the loading state until the request ends.
      onConfirm={handleConfirm}
    >
      {iconOnly ? (
        <Button type="text" icon={<DeleteOutlined />} aria-label={label} title="Удалить" loading={isLoading} />
      ) : (
        <Button danger icon={<DeleteOutlined />} loading={isLoading}>
          Удалить
        </Button>
      )}
    </Popconfirm>
  );
}
