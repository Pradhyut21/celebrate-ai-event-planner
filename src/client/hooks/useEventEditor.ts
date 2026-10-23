import { useRef, useState } from 'react';
import { StoredEventSchema } from '../../shared/schema.js';
import type { EventInput, StoredEvent } from '../../shared/schema.js';
import { MAX_EVENTS } from '../lib/data.js';
import type { Notice } from '../types.js';
import type { GeneratePlan } from './usePlanningService.js';

type Editor = { mode: 'create' } | { mode: 'edit'; event: StoredEvent };
type EditorOptions = {
  eventCount: number;
  busy: boolean;
  generate: GeneratePlan;
  onSave: (event: StoredEvent, editing: boolean, notice: Notice) => void;
  onOpen: () => void;
  onNotice: (notice: Notice) => void;
};

/** Keep editor lifecycle and failures together so errors remain inside the active modal. */
export function useEventEditor(options: EditorOptions) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [submissionError, setSubmissionError] = useState('');
  const returnFocus = useRef<HTMLElement | null>(null);

  const open = (event?: StoredEvent) => {
    if (!event && options.eventCount >= MAX_EVENTS) {
      options.onNotice({
        text: `You can keep up to ${MAX_EVENTS} events. Export and remove an older event to make room.`,
        kind: 'error',
      });
      return;
    }
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSubmissionError('');
    setEditor(event ? { mode: 'edit', event } : { mode: 'create' });
    options.onOpen();
  };

  const close = () => {
    if (options.busy) return;
    setEditor(null);
    setSubmissionError('');
    returnFocus.current?.focus();
  };

  const submit = async (input: EventInput): Promise<void> => {
    if (!editor) return;
    setSubmissionError('');
    await options.generate(
      input,
      ({ plan, fallbackMessage }) => {
        const editing = editor.mode === 'edit';
        const event = StoredEventSchema.parse({
          id: editing ? editor.event.id : crypto.randomUUID(),
          input,
          plan,
          updatedAt: new Date().toISOString(),
        });
        const text = fallbackMessage
          ? `${fallbackMessage} Your local rules-based plan is ready.`
          : plan.generatedBy === 'openai'
            ? 'Your AI-assisted celebration plan is ready. Review the estimates before booking.'
            : 'Your rules-based celebration plan is ready. No AI provider was used.';
        options.onSave(event, editing, { kind: fallbackMessage ? 'info' : 'success', text });
        setEditor(null);
      },
      (notice) => setSubmissionError(notice.text),
    );
  };

  return {
    isOpen: editor !== null,
    editing: editor?.mode === 'edit' ? editor.event : undefined,
    submissionError,
    open,
    close,
    submit,
  };
}
