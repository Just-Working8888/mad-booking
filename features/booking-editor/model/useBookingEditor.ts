import { useEffect, useMemo, useState } from "react";
import {
  MIN_DURATION,
  WORKDAY_END,
  WORKDAY_START,
  canStartAt,
  conflictError,
  findConflict,
  getMaxEnd,
  toBookingError,
  toMinuteRange,
  useCreateBookingMutation,
  useUpdateBookingMutation,
  validateBooking,
  type Booking,
  type BookingError,
  type BookingInput,
  type MinuteRange,
} from "@/entities/booking";
import { formatTime, type DateString, type LocalDateTime } from "@/shared/lib/time";
import { moveStart, type EndChange } from "./moveStart";

export const DURATION_PRESETS = [30, 45, 60, 90, 120] as const;

export type DurationPreset = {
  minutes: number;
  disabled: boolean;
  /** Why the preset is disabled, shown as a tooltip. */
  reason?: string;
};

export type UseBookingEditorOptions = {
  date: DateString;
  /** Bookings of `date`, kept fresh by RTK Query (also after a 409). */
  bookings: readonly Booking[];
  now: LocalDateTime;
  /** Edit mode when present, create mode otherwise. */
  booking?: Booking;
  /** Initial time in create mode. */
  initialRange?: MinuteRange;
  simulateConflict?: boolean;
  /** Called once a request with `simulateConflict` was sent: the simulation is one-shot. */
  onSimulationUsed?: () => void;
  onSaved: (booking: Booking, kind: "created" | "updated") => void;
  /** The booking being edited no longer exists on the server. */
  onGone: () => void;
  onConflict?: (conflict: Booking) => void;
  /** Reports the time currently entered, for a live preview on the timeline. */
  onDraftChange?: (draft: MinuteRange | null) => void;
  /** Reports whether the form differs from its initial values, so the page can ask before discarding. */
  onDirtyChange?: (dirty: boolean) => void;
};



export function useBookingEditor({
  date,
  bookings,
  now,
  booking,
  initialRange,
  simulateConflict,
  onSimulationUsed,
  onSaved,
  onGone,
  onConflict,
  onDraftChange,
  onDirtyChange,
}: UseBookingEditorOptions) {
  const excludeId = booking?.id;
  const initial = booking ? toMinuteRange(booking) : initialRange;

  const [start, setStart] = useState<number | null>(initial?.start ?? null);
  const [end, setEnd] = useState<number | null>(initial?.end ?? null);
  const [title, setTitle] = useState(booking?.title ?? "");
  const [serverError, setServerError] = useState<BookingError | null>(null);
  // Shown until the user touches the time again.
  const [endChange, setEndChange] = useState<EndChange | null>(null);

  const [createBooking, createState] = useCreateBookingMutation();
  const [updateBooking, updateState] = useUpdateBookingMutation();
  const isSubmitting = createState.isLoading || updateState.isLoading;

  // Same rules as the server, so most problems are visible before submitting.
  const validationError = useMemo((): BookingError | null => {
    if (start === null) return { code: "INVALID_TIME", field: "start", message: "Укажите время начала" };
    if (end === null) return { code: "INVALID_TIME", field: "end", message: "Укажите время окончания" };

    const input: BookingInput = { date, start: formatTime(start), end: formatTime(end), title };
    const ruleError = validateBooking(input, now);
    if (ruleError) return ruleError;

    const conflict = findConflict(input, bookings, excludeId);
    return conflict ? conflictError(conflict) : null;
  }, [start, end, title, date, now, bookings, excludeId]);

  const draft = start !== null && end !== null && end > start ? { start, end } : null;
  const draftStart = draft?.start;
  const draftEnd = draft?.end;
  useEffect(() => {
    onDraftChange?.(draftStart !== undefined && draftEnd !== undefined ? { start: draftStart, end: draftEnd } : null);
  }, [draftStart, draftEnd, onDraftChange]);
  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);

  const initialTitle = booking?.title ?? "";
  const dirty = start !== (initial?.start ?? null) || end !== (initial?.end ?? null) || title.trim() !== initialTitle;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const maxEnd = start === null ? null : getMaxEnd(date, start, bookings, excludeId);

  const isStartAllowed = (minutes: number) => canStartAt(date, minutes, bookings, now, excludeId);
  const isEndAllowed = (minutes: number) =>
    start === null || maxEnd === null
      ? minutes >= WORKDAY_START + MIN_DURATION && minutes <= WORKDAY_END
      : minutes >= start + MIN_DURATION && minutes <= maxEnd;

  const presets: DurationPreset[] = DURATION_PRESETS.map((minutes) => {
    if (start === null || maxEnd === null) return { minutes, disabled: true, reason: "Сначала выберите начало" };
    if (start + minutes <= maxEnd) return { minutes, disabled: false };
    return {
      minutes,
      disabled: true,
      reason: start + minutes > WORKDAY_END ? "Рабочий день заканчивается в 18:00" : "Дальше занято",
    };
  });

  const resetFeedback = () => {
    setServerError(null);
    setEndChange(null);
  };

  const changeStart = (value: number | null) => {
    resetFeedback();
    if (value === null) {
      setStart(null);
      return;
    }
    // Start and end are updated together, so there is never a render with the end before the start.
    const { range, change } = moveStart({ date, current: { start, end }, nextStart: value, bookings, excludeId });
    setStart(range.start);
    setEnd(range.end);
    setEndChange(change);
  };

  const changeEnd = (value: number | null) => {
    resetFeedback();
    setEnd(value);
  };

  const changeDuration = (minutes: number) => {
    if (start === null) return;
    resetFeedback();
    setEnd(start + minutes);
  };

  const changeTitle = (value: string) => {
    setServerError(null);
    setTitle(value);
  };

  const submit = async () => {
    if (validationError || start === null || end === null || isSubmitting) return;
    setServerError(null);

    const startText = formatTime(start);
    const endText = formatTime(end);
    if (simulateConflict) onSimulationUsed?.();
    try {
      if (booking) {
        // An empty title is sent as "" so the server clears it.
        const saved = await updateBooking({
          id: booking.id,
          changes: { start: startText, end: endText, title: title.trim() },
          simulateConflict,
        }).unwrap();
        onSaved(saved, "updated");
      } else {
        const saved = await createBooking({
          input: { date, start: startText, end: endText, title: title.trim() || undefined },
          simulateConflict,
        }).unwrap();
        onSaved(saved, "created");
      }
    } catch (error) {
      const bookingError = toBookingError(error);
      if (bookingError.code === "NOT_FOUND") {
        onGone();
        return;
      }
      // The list is refetched by tag invalidation; the entered values stay untouched.
      if (bookingError.conflict) onConflict?.(bookingError.conflict);
      setServerError(bookingError);
    }
  };

  return {
    mode: booking ? ("edit" as const) : ("create" as const),
    start,
    end,
    title,
    draft,
    dirty,
    validationError,
    serverError,
    endChange,
    presets,
    isSubmitting,
    isStartAllowed,
    isEndAllowed,
    changeStart,
    changeEnd,
    changeDuration,
    changeTitle,
    dismissServerError: () => setServerError(null),
    submit,
  };
}
