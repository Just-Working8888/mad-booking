"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, App, Drawer, Grid, Segmented, Skeleton, Switch, Tooltip } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { BookingEditor } from "@/features/booking-editor";
import { DeleteBookingButton } from "@/features/delete-booking";
import { DateNavigator, useSelectedDate } from "@/features/select-date";
import { DayAgenda } from "@/widgets/day-agenda";
import { DayTimeline } from "@/widgets/day-timeline";
import {
  BookingDetails,
  MIN_DURATION,
  WORKDAY_END,
  formatRange,
  getBookingStatus,
  isPastDate,
  suggestSlot,
  toMinuteRange,
  useGetBookingsQuery,
  useRoomNow,
  type Booking,
  type BookingStatus,
  type MinuteRange,
} from "@/entities/booking";
import { API_MODE } from "@/shared/config";
import { cx } from "@/shared/lib/classnames";
import type { DateString, LocalDateTime } from "@/shared/lib/time";
import { PanelHeader } from "./PanelHeader";
import styles from "./BookingPage.module.scss";

/** What the side panel (desktop) or bottom sheet (mobile) shows. */
type Panel = { type: "create"; range: MinuteRange; key: number } | { type: "booking"; id: string };

/** Identity of a panel: a new key means a fresh form. */
const panelKey = (panel: Panel) => (panel.type === "create" ? `create-${panel.key}` : `booking-${panel.id}`);

type MobileView = "timeline" | "list";

const HIGHLIGHT_MS = 3000;

export function BookingPage() {
  const now = useRoomNow();
  const { date, setDate } = useSelectedDate(now?.date);

  // "Now" is only known on the client; until then show the page skeleton.
  if (!now || !date) return <PageSkeleton />;
  return <BookingSchedule now={now} date={date} onDateChange={setDate} />;
}

type BookingScheduleProps = {
  now: LocalDateTime;
  date: DateString;
  onDateChange: (date: DateString) => void;
};

function BookingSchedule({ now, date, onDateChange }: BookingScheduleProps) {
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  // Breakpoints are unknown for a moment after mount; assume desktop until measured.
  const isDesktop = screens.lg !== false;

  const {
    currentData: bookings,
    isError,
    refetch,
  } = useGetBookingsQuery(date, { refetchOnFocus: true, refetchOnReconnect: true });
  // A failed background refetch must not hide data we already have.
  const loadFailed = isError && !bookings;

  const [panel, setPanel] = useState<Panel | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [draft, setDraft] = useState<MinuteRange | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("timeline");
  const [simulateConflict, setSimulateConflict] = useState(false);

  // Any change of the day (navigator, Back/Forward, midnight) closes the panel for good,
  // so coming back to the previous day never resurrects a stale form.
  const [panelDate, setPanelDate] = useState(date);
  const dateChanged = panelDate !== date;
  if (dateChanged) {
    setPanelDate(date);
    setPanel(null);
  }

  // Where focus was before the panel opened; it returns there when the panel closes (keyboard users).
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (panel !== null) return;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }, [panel]);

  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  const selectedBooking =
    panel?.type === "booking" ? bookings?.find((booking) => booking.id === panel.id) : undefined;
  const selectedStatus = selectedBooking && getBookingStatus(selectedBooking, now);

  // A booking that starts while its form is open turns read-only (editing started bookings is not
  // allowed). Catch that transition during render so the user is told why the form went away.
  const [watched, setWatched] = useState<{ id: string; status: BookingStatus } | null>(null);
  const [startedWhileOpen, setStartedWhileOpen] = useState<{ id: string; hadChanges: boolean } | null>(null);
  const current = selectedBooking && selectedStatus ? { id: selectedBooking.id, status: selectedStatus } : null;
  if (current?.id !== watched?.id || current?.status !== watched?.status) {
    setWatched(current);
    if (current && watched?.id === current.id && watched.status === "upcoming" && current.status !== "upcoming") {
      setStartedWhileOpen({ id: current.id, hadChanges: isDirty });
    }
  }

  // The open booking disappeared from a fresh list: someone else deleted it. Close the panel
  // right away (during render, like the date reset) and tell the user once.
  const [vanishedId, setVanishedId] = useState<string | null>(null);
  // (Skipped on the render where the day changed: the panel is being reset and `bookings` is another day.)
  if (!dateChanged && panel?.type === "booking" && bookings !== undefined && !selectedBooking) {
    setVanishedId(panel.id);
    setPanel(null);
  }
  useEffect(() => {
    if (vanishedId) message.warning("Эту бронь удалили, пока она была открыта. Изменения не сохранены");
  }, [vanishedId, message]);

  const pastDate = isPastDate(date, now);
  const defaultSlot = bookings ? suggestSlot(date, bookings, now) : null;
  const createDisabledReason = pastDate
    ? "Нельзя бронировать прошедшие даты"
    : defaultSlot
      ? null
      : date === now.date && now.minutes > WORKDAY_END - MIN_DURATION
        ? "Рабочий день закончился — выберите другую дату"
        : "Свободного времени не осталось — выберите другую дату";

  const showPanel = (next: Panel) => {
    if (!panel) returnFocusRef.current = document.activeElement as HTMLElement | null;
    setStartedWhileOpen(null);
    setPanel(next);
  };

  const closePanel = () => {
    setStartedWhileOpen(null);
    setPanel(null);
  };

  /** Closes the panel only if it is still the one that started an async action (e.g. a save). */
  const closePanelIfCurrent = (key: string) =>
    setPanel((current) => (current && panelKey(current) === key ? null : current));

  /** Runs `action` right away, or after confirmation if the open form has unsaved changes. */
  const confirmDiscard = (action: () => void) => {
    if (!isDirty) {
      action();
      return;
    }
    modal.confirm({
      title: "Не сохранять изменения?",
      content: "Введённые в форме данные будут потеряны.",
      okText: "Не сохранять",
      okButtonProps: { danger: true },
      cancelText: "Вернуться к форме",
      onOk: action,
    });
  };

  const openCreate = (range: MinuteRange) =>
    confirmDiscard(() => showPanel({ type: "create", range, key: Date.now() }));

  const openBooking = (booking: Booking) => {
    if (panel?.type === "booking" && panel.id === booking.id) return;
    confirmDiscard(() => showPanel({ type: "booking", id: booking.id }));
  };

  const changeDate = (next: DateString) => confirmDiscard(() => onDateChange(next));

  const handleDeleted = (booking: Booking) => {
    if (panel?.type === "booking" && panel.id === booking.id) closePanel();
  };

  const editorPropsFor = (key: string) => ({
    date,
    now,
    bookings: bookings ?? [],
    simulateConflict,
    onSimulationUsed: () => setSimulateConflict(false),
    onSaved: (booking: Booking, kind: "created" | "updated") => {
      const range = toMinuteRange(booking);
      message.success(
        kind === "created" ? `Забронировано${range ? `: ${formatRange(range)}` : ""}` : "Изменения сохранены",
      );
      setHighlightedId(booking.id);
      closePanelIfCurrent(key);
    },
    onGone: () => {
      message.warning("Эту бронь уже удалили — расписание обновлено");
      closePanelIfCurrent(key);
    },
    onConflict: (conflict: Booking) => setHighlightedId(conflict.id),
    onDraftChange: setDraft,
    onDirtyChange: setIsDirty,
    onCancel: closePanel,
  });

  let panelContent: ReactNode = null;
  if (panel?.type === "create") {
    const key = panelKey(panel);
    panelContent = <BookingEditor key={key} initialRange={panel.range} {...editorPropsFor(key)} />;
  } else if (panel && selectedBooking && selectedStatus === "upcoming") {
    const key = panelKey(panel);
    panelContent = (
      <BookingEditor
        key={key}
        booking={selectedBooking}
        extraActions={<DeleteBookingButton booking={selectedBooking} onDeleted={handleDeleted} />}
        {...editorPropsFor(key)}
      />
    );
  } else if (selectedBooking && selectedStatus) {
    const lockedNow = startedWhileOpen?.id === selectedBooking.id ? startedWhileOpen : null;
    panelContent = (
      <>
        <PanelHeader title="Бронь" onClose={closePanel} />
        {lockedNow && (
          <Alert
            className={styles.lockedNotice}
            type="warning"
            showIcon
            role="alert"
            title="Редактирование больше недоступно"
            description={
              lockedNow.hadChanges
                ? `Бронь началась в ${selectedBooking.start}, пока вы её редактировали, а начавшиеся брони менять нельзя. Несохранённые изменения не применены — бронь осталась прежней.`
                : `Бронь началась в ${selectedBooking.start}, а начавшиеся брони менять нельзя. Удалить её можно.`
            }
          />
        )}
        <BookingDetails booking={selectedBooking} status={selectedStatus} showReadOnlyReason={!lockedNow} />
        <div className={styles.detailsActions}>
          <DeleteBookingButton booking={selectedBooking} onDeleted={handleDeleted} />
        </div>
      </>
    );
  }

  const agenda = (
    <DayAgenda
      date={date}
      now={now}
      bookings={bookings}
      isError={loadFailed}
      onRetry={refetch}
      createDisabledReason={createDisabledReason}
      onCreate={() => defaultSlot && openCreate(defaultSlot)}
      onOpenBooking={openBooking}
      selectedId={selectedBooking?.id}
      highlightedId={highlightedId}
      onDeleted={handleDeleted}
    />
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.topBar}>
          <div className={styles.brand}>
            <h1 className={styles.appTitle}>Переговорная</h1>
            <span className={styles.workday}>09:00–18:00 · время Бишкека</span>
            {API_MODE === "browser" && (
              <Tooltip title="Публичное демо: API эмулируется в браузере, брони хранятся в localStorage этого браузера и видны только вам.">
                <span className={styles.demoBadge} tabIndex={0}>
                  Демо · данные в этом браузере
                </span>
              </Tooltip>
            )}
          </div>
          <label className={styles.demo}>
            <Switch size="small" checked={simulateConflict} onChange={setSimulateConflict} />
            <span>Имитировать конфликт</span>
            <Tooltip title="Демо: при следующем сохранении API ответит 409, как будто другой пользователь занял это время на мгновение раньше. Срабатывает один раз и ничего не записывает.">
              <QuestionCircleOutlined className={styles.demoHelp} aria-label="Что это?" tabIndex={0} />
            </Tooltip>
          </label>
        </div>
        <DateNavigator date={date} today={now.date} onChange={changeDate} />
      </header>

      {pastDate && (
        <Alert className={styles.notice} type="info" showIcon title="Прошедшая дата — доступен только просмотр" />
      )}

      <div className={styles.mobileTabs}>
        <Segmented<MobileView>
          block
          value={mobileView}
          onChange={setMobileView}
          options={[
            { label: "Расписание", value: "timeline" },
            { label: bookings ? `Список · ${bookings.length}` : "Список", value: "list" },
          ]}
        />
      </div>

      <main className={styles.content}>
        <div className={cx(styles.timelinePane, mobileView !== "timeline" && styles.hiddenOnMobile)}>
          <DayTimeline
            date={date}
            now={now}
            bookings={bookings}
            isError={loadFailed}
            onRetry={refetch}
            draft={draft}
            editingId={selectedBooking?.id}
            highlightedId={highlightedId}
            onCreate={openCreate}
            onOpenBooking={openBooking}
          />
          {bookings && !pastDate && (
            <p className={styles.timelineHint}>
              {createDisabledReason ??
                "Нажмите на свободное время, чтобы забронировать. Время можно уточнить до минуты."}
            </p>
          )}
        </div>

        <aside className={cx(styles.aside, mobileView !== "list" && styles.hiddenOnMobile)}>
          <div className={styles.panel}>{isDesktop && panelContent ? panelContent : agenda}</div>
        </aside>
      </main>

      {!isDesktop && (
        <Drawer
          open={panelContent !== null}
          // Tap outside or Escape: easy to do by accident, so unsaved changes are confirmed first.
          onClose={() => confirmDiscard(closePanel)}
          placement="bottom"
          size="auto"
          closable={false}
          destroyOnHidden
          classNames={{ section: styles.sheet, body: styles.sheetBody }}
        >
          {panelContent}
        </Drawer>
      )}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Загрузка">
      <Skeleton active title={{ width: 240 }} paragraph={{ rows: 2 }} />
      <div className={styles.content}>
        <Skeleton.Node active className={styles.skeletonTimeline} />
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    </div>
  );
}
