import React from "react";
import { Flower2, Leaf, Sparkles } from "lucide-react";
import type { StoredEvent } from "../../shared/schema.js";

export function IdeasView({
  event,
}: {
  event: StoredEvent;
}): React.ReactElement {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE DETAILS THAT FEEL LIKE YOU</p>
          <h2>A little inspiration</h2>
          <p>
            Thoughtful ideas shaped around your people, place, and priorities.
          </p>
        </div>
        <Flower2 className="section-flower" size={37} />
      </div>
      <div className="ideas-grid">
        {event.plan.ideas.map((idea, index) => (
          <article className={`card idea-card idea-${index % 3}`} key={idea.id}>
            <div className="idea-number">
              0{index + 1}
              <Sparkles size={18} />
            </div>
            <h3>{idea.title}</h3>
            <p>{idea.description}</p>
            <span className="idea-tag">
              Made for your{" "}
              {event.input.type === "community"
                ? "community event"
                : event.input.type}
            </span>
          </article>
        ))}
      </div>
      <article className="card preferences-card">
        <Leaf size={26} />
        <div>
          <h3>The thought behind the details</h3>
          <p>
            <strong>Your style:</strong>{" "}
            {event.input.vibe || "A celebration that feels like you"}
          </p>
          {event.input.priorities.length > 0 && (
            <p>
              <strong>Your priorities:</strong>{" "}
              {event.input.priorities.join(" · ")}
            </p>
          )}
          <p>
            <strong>Accessibility:</strong>{" "}
            {event.input.accessibility ||
              "Confirm access needs with guests and check venue routes."}
          </p>
          <p>
            <strong>Dietary needs:</strong>{" "}
            {event.input.dietary ||
              "Ask guests about allergies and food preferences before finalizing the menu."}
          </p>
        </div>
      </article>
    </>
  );
}
