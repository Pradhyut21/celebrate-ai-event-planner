import React from 'react';
import type { Plan } from '../../shared/schema.js';
import { localDate, formatDate } from '../lib/format.js';

export function TaskRow({
  task,
  onChange,
  compact = false,
}: {
  task: Plan['tasks'][number];
  onChange: () => void;
  compact?: boolean;
}): React.ReactElement {
  const overdue = !task.completed && task.dueDate < localDate();
  return (
    <div className={`task-row ${task.completed ? 'task-complete' : ''}`}>
      <label className="task-check">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={onChange}
          aria-label={task.title}
        />
        <span>
          <strong>{task.title}</strong>
          <small>{task.category}</small>
        </span>
      </label>
      <span className={`due-tag ${overdue ? 'overdue' : ''}`}>
        {task.completed
          ? 'Complete'
          : `${overdue ? 'Overdue · ' : ''}${formatDate(task.dueDate, compact)}`}
      </span>
    </div>
  );
}
