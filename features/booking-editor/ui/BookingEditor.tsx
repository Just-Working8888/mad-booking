"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Alert, Button, Form, Grid, Input, TimePicker, Tooltip } from "antd";
import { CloseOutlined, InfoCircleFilled } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { TITLE_MAX_LENGTH, formatDayTitle, formatRange } from "@/entities/booking";
import { cx } from "@/shared/lib/classnames";
import { formatDuration, formatTime } from "@/shared/lib/time";
import { useBookingEditor, type UseBookingEditorOptions } from "../model/useBookingEditor";
import styles from "./BookingEditor.module.scss";

type BookingEditorProps = UseBookingEditorOptions & {
  onCancel: () => void;
  /** Extra actions owned by other features, e.g. delete in edit mode. */
  extraActions?: ReactNode;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const toDayjs = (minutes: number | null) =>
  minutes === null ? null : dayjs().startOf("day").add(minutes, "minute");
const fromDayjs = (value: Dayjs | null) => (value ? value.hour() * 60 + value.minute() : null);

/** Feeds antd's TimePicker with the minutes that `isAllowed` rejects. */
const disabledTimeFor = (isAllowed: (minutes: number) => boolean) => () => ({
  disabledHours: () => HOURS.filter((h) => !MINUTES.some((m) => isAllowed(h * 60 + m))),
  disabledMinutes: (hour: number) => MINUTES.filter((m) => !isAllowed(hour * 60 + m)),
});

export function BookingEditor({ onCancel, extraActions, ...options }: BookingEditorProps) {
  const editor = useBookingEditor(options);
  const screens = Grid.useBreakpoint();
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus into the panel so keyboard and screen-reader users land in the form.
  useEffect(() => headingRef.current?.focus(), []);

  const { validationError, serverError, endChange } = editor;

  // While submitting, the disabled form drops focus to <body>. After a server error, bring it back
  // to what the user should act on: the time for a conflict, the submit button for a retry.
  const submitRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!serverError) return;
    if (serverError.code === "CONFLICT") document.getElementById(`${id}-start`)?.focus();
    else submitRef.current?.focus();
  }, [serverError, id]);
  const timeError = validationError && validationError.field !== "title" ? validationError : null;
  const titleError = validationError?.field === "title" ? validationError : null;
  const isConflict = serverError?.code === "CONFLICT";
  const currentDuration =
    editor.start !== null && editor.end !== null ? editor.end - editor.start : null;

  // Enter inside a time field only confirms the typed time; it must not submit the whole form.
  const preventSubmitFromPicker = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.target as HTMLElement).closest(".ant-picker")) event.preventDefault();
  };

  // Submitting an invalid form moves focus to the field with the problem instead of doing nothing.
  const handleFinish = () => {
    if (validationError) {
      const field = validationError.field === "title" ? "title" : validationError.field === "end" ? "end" : "start";
      document.getElementById(`${id}-${field}`)?.focus();
      return;
    }
    void editor.submit();
  };

  const pickerProps = {
    format: "HH:mm",
    needConfirm: false,
    showNow: false,
    allowClear: false,
    hideDisabledOptions: true,
    // On phones the column picker is easier than the on-screen keyboard.
    inputReadOnly: !screens.md,
    className: styles.picker,
  };

  return (
    <Form
      layout="vertical"
      className={styles.editor}
      onFinish={handleFinish}
      onKeyDown={preventSubmitFromPicker}
      disabled={editor.isSubmitting}
      aria-labelledby={`${id}-heading`}
    >
      <header className={styles.header}>
        <div>
          <h3 id={`${id}-heading`} ref={headingRef} tabIndex={-1} className={styles.heading}>
            {editor.mode === "edit" ? "Изменить бронь" : "Новая бронь"}
          </h3>
          <p className={styles.date}>{formatDayTitle(options.date)}</p>
        </div>
        <Button type="text" icon={<CloseOutlined />} aria-label="Закрыть" onClick={onCancel} disabled={false} />
      </header>

      {serverError && (
        <Alert
          className={styles.alert}
          type={isConflict ? "warning" : "error"}
          showIcon
          role="alert"
          title={isConflict ? "Это время только что заняли" : "Не удалось сохранить"}
          description={
            isConflict
              ? `${serverError.message}. Расписание обновлено — выберите другое время, введённые данные сохранены.`
              : serverError.message
          }
          closable={{ onClose: editor.dismissServerError, "aria-label": "Скрыть сообщение" }}
        />
      )}

      <fieldset className={styles.timeFieldset}>
        <legend className={styles.srOnly}>Время</legend>
        <div className={styles.timeRow}>
          <Form.Item label="Начало" htmlFor={`${id}-start`} className={styles.timeItem}>
            <TimePicker
              {...pickerProps}
              id={`${id}-start`}
              value={toDayjs(editor.start)}
              onChange={(value) => editor.changeStart(fromDayjs(value))}
              disabledTime={disabledTimeFor(editor.isStartAllowed)}
              status={timeError && timeError.field !== "end" ? "error" : undefined}
              aria-describedby={timeError ? `${id}-time-error` : undefined}
            />
          </Form.Item>
          <Form.Item label="Окончание" htmlFor={`${id}-end`} className={styles.timeItem}>
            <TimePicker
              {...pickerProps}
              id={`${id}-end`}
              value={toDayjs(editor.end)}
              onChange={(value) => editor.changeEnd(fromDayjs(value))}
              disabledTime={disabledTimeFor(editor.isEndAllowed)}
              status={
                timeError && timeError.field !== "start"
                  ? "error"
                  : endChange?.kind === "shortened"
                    ? "warning"
                    : undefined
              }
              aria-describedby={timeError ? `${id}-time-error` : endChange ? `${id}-end-change` : undefined}
            />
          </Form.Item>
        </div>

        <div aria-live="polite">
          {timeError && (
            <p id={`${id}-time-error`} className={styles.error}>
              {timeError.message}
            </p>
          )}
          {!timeError && endChange && (
            <p
              id={`${id}-end-change`}
              className={cx(styles.endChange, endChange.kind === "shortened" && styles.endChangeWarning)}
            >
              <InfoCircleFilled aria-hidden />
              {endChange.kind === "shortened" ? (
                <span>
                  Длительность сокращена: <s>{formatDuration(endChange.previousDuration)}</s> →{" "}
                  <strong>{formatDuration(endChange.duration)}</strong>, {endChange.reason}. Окончание —{" "}
                  <strong>{formatTime(endChange.end)}</strong>. Проверьте время перед сохранением.
                </span>
              ) : (
                <span>
                  Окончание сдвинуто: <s>{formatTime(endChange.previousEnd)}</s> →{" "}
                  <strong>{formatTime(endChange.end)}</strong>, чтобы сохранить длительность{" "}
                  {formatDuration(endChange.duration)}.
                </span>
              )}
            </p>
          )}
        </div>

        <div className={styles.presets} role="group" aria-label="Длительность">
          {editor.presets.map((preset) => {
            const active = currentDuration === preset.minutes;
            const button = (
              <Button
                key={preset.minutes}
                size="small"
                type={active ? "primary" : "default"}
                className={cx(styles.preset, active && styles.presetActive)}
                aria-pressed={active}
                disabled={preset.disabled}
                onClick={() => editor.changeDuration(preset.minutes)}
              >
                {formatDuration(preset.minutes)}
              </Button>
            );
            return preset.disabled ? (
              <Tooltip key={preset.minutes} title={preset.reason}>
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </div>
      </fieldset>

      <Form.Item
        label="Название"
        htmlFor={`${id}-title`}
        validateStatus={titleError ? "error" : undefined}
        help={titleError?.message}
        extra="Необязательно"
      >
        <Input
          id={`${id}-title`}
          value={editor.title}
          onChange={(event) => editor.changeTitle(event.target.value)}
          placeholder="Например, планирование спринта"
          maxLength={TITLE_MAX_LENGTH}
          showCount
          autoComplete="off"
        />
      </Form.Item>

      <footer className={styles.footer}>
        <p className={styles.summary}>
          {editor.draft ? (
            <>
              <strong>{formatRange(editor.draft)}</strong> · {formatDuration(editor.draft.end - editor.draft.start)}
            </>
          ) : (
            "Время не выбрано"
          )}
        </p>
        <div className={styles.actions}>
          {extraActions}
          <span className={styles.spacer} />
          <Button onClick={onCancel} disabled={false}>
            Отмена
          </Button>
          <Button ref={submitRef} type="primary" htmlType="submit" loading={editor.isSubmitting}>
            {editor.mode === "edit" ? "Сохранить" : "Забронировать"}
          </Button>
        </div>
      </footer>
    </Form>
  );
}
