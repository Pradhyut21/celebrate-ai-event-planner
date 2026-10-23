import React from "react";
import {
  ChevronDown,
  CircleHelp,
  Flower2,
  Heart,
  Plus,
  Settings2,
} from "lucide-react";
import type { StoredEvent } from "../../shared/schema.js";
import type { Section } from "../types.js";
import { navigation } from "../navigation.js";
type SidebarProps = {
  sidebarRef: React.RefObject<HTMLElement | null>;
  mobileOpen: boolean;
  current?: StoredEvent;
  events: StoredEvent[];
  section: Section;
  onSelectEvent: (id: string) => void;
  navigate: (section: Section) => void;
  openNew: () => void;
  onHelp: () => void;
  onSettings: () => void;
};
export function Sidebar({
  sidebarRef,
  mobileOpen,
  current,
  events,
  section,
  onSelectEvent,
  navigate,
  openNew,
  onHelp,
  onSettings,
}: SidebarProps): React.ReactElement {
  return (
    <aside
      ref={sidebarRef}
      className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
      aria-label="Event workspace"
    >
      <a
        className="brand"
        href="#main-content"
        onClick={() => navigate("overview")}
      >
        <span className="brand-mark">✳</span>
        <span>
          celebrate<span className="brand-ai">AI</span>
          <small>A LITTLE PLANNING. A LOT OF JOY.</small>
        </span>
      </a>
      <p className="sidebar-label">YOUR CELEBRATION</p>
      <div className="event-switch-wrap">
        <label className="sr-only" htmlFor="event-switch">
          Switch event
        </label>
        <select
          id="event-switch"
          value={current?.id ?? ""}
          onChange={(changeEvent) => onSelectEvent(changeEvent.target.value)}
        >
          <option value="" disabled>
            {events.length ? "Choose an event" : "No events yet"}
          </option>
          {events.map((event) => (
            <option value={event.id} key={event.id}>
              {event.input.name}
            </option>
          ))}
        </select>
        <ChevronDown size={15} aria-hidden="true" />
      </div>
      {current?.id === "sample-celebration" && (
        <span className="sample-label">Sample event · explore freely</span>
      )}
      <nav aria-label="Main navigation">
        <p className="sidebar-label planning-label">THE PLANNING SPACE</p>
        {navigation.map(({ id, label, Icon }) => (
          <button
            key={id}
            aria-current={section === id ? "page" : undefined}
            className={`nav-item ${section === id ? "active" : ""}`}
            onClick={() => navigate(id)}
          >
            <Icon size={19} strokeWidth={1.7} />
            <span>{label}</span>
            {section === id && <span className="nav-active-dot" />}
          </button>
        ))}
      </nav>
      <button className="new-event-button" onClick={openNew}>
        <Plus size={17} />
        New event
      </button>
      <div className="sidebar-note">
        <Flower2 size={29} strokeWidth={1.3} />
        <p>
          The best celebrations
          <br />
          feel like <em>you.</em>
        </p>
        <span>We’ll help with the rest.</span>
      </div>
      <div className="sidebar-bottom">
        <button onClick={onHelp}>
          <CircleHelp size={17} />A little help
        </button>
        <button aria-label="Open settings" onClick={onSettings}>
          <Settings2 size={17} />
          Settings & backups
        </button>
        <div className="workspace-person">
          <span className="avatar">
            <Heart size={17} />
          </span>
          <div>
            <strong>Your happy place</strong>
            <small>Personal planning workspace</small>
          </div>
          <span className="online-dot" />
        </div>
      </div>
    </aside>
  );
}
