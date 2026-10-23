import React from "react";
import { Menu, ChevronRight, ShieldCheck, CircleHelp } from "lucide-react";
import { navigation } from "../navigation.js";
import type { Section } from "../types.js";
export function Topbar({
  mobileOpen,
  section,
  onToggleNavigation,
  onHelp,
}: {
  mobileOpen: boolean;
  section: Section;
  onToggleNavigation: () => void;
  onHelp: () => void;
}): React.ReactElement {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          id="mobile-nav-toggle"
          className="icon-button mobile-menu"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={onToggleNavigation}
        >
          <Menu size={22} />
        </button>
        <span className="breadcrumb">
          My celebrations <ChevronRight size={13} />
          <strong>
            {navigation.find((item) => item.id === section)?.label}
          </strong>
        </span>
      </div>
      <div className="topbar-right">
        <span className="private-label">
          <ShieldCheck size={14} />
          Stored in this browser
        </span>
        <button
          className="topbar-help"
          aria-label="Planning help"
          onClick={onHelp}
        >
          <CircleHelp size={18} />
        </button>
        <span className="topbar-avatar" aria-hidden="true">
          Y
        </span>
      </div>
    </header>
  );
}
