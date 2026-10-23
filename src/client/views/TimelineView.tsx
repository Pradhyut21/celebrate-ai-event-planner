import React, { useState } from "react";
import { CheckCheck } from "lucide-react";
import type { StoredEvent } from "../../shared/schema.js";
import { TaskRow } from "../components/TaskRow.js";

export function TimelineView({
  event,
  toggleTask,
}: {
  event: StoredEvent;
  toggleTask: (id: string) => void;
}): React.ReactElement {
  const [filter, setFilter] = useState("all");
  const tasks = event.plan.tasks.filter(
    (task) =>
      filter === "all" ||
      (filter === "done" ? task.completed : !task.completed),
  );
  const completed = event.plan.tasks.filter((task) => task.completed).length;
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">ONE STEP AT A TIME</p>
          <h2>A little less last-minute</h2>
          <p>Your dates, your priorities, and a clear path to the big day.</p>
        </div>
        <span className="badge green">
          {completed} of {event.plan.tasks.length} complete
        </span>
      </div>
      <article className="card">
        <div className="card-heading">
          <h3>Your planning timeline</h3>
          <label className="filter-label">
            Show tasks
            <select
              aria-label="Show tasks"
              value={filter}
              onChange={(changeEvent) => setFilter(changeEvent.target.value)}
            >
              <option value="all">All tasks</option>
              <option value="open">To do</option>
              <option value="done">Completed</option>
            </select>
          </label>
        </div>
        <progress
          className="timeline-progress"
          max={Math.max(1, event.plan.tasks.length)}
          value={completed}
          aria-label="Planning task completion"
        />
        {tasks.length ? (
          <div className="task-list">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onChange={() => toggleTask(task.id)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            <CheckCheck size={30} />
            <h3>
              {filter === "open" ? "All caught up!" : "No tasks here yet"}
            </h3>
            <p>
              {filter === "open"
                ? "Take a breath and enjoy the anticipation."
                : "Completed tasks will appear here as you make progress."}
            </p>
          </div>
        )}
      </article>
    </>
  );
}
