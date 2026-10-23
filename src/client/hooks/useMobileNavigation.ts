import { useEffect, useRef, useState } from 'react';

export function useMobileNavigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainShellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const focusContentOnClose = useRef(false);
  const closeNavigation = (focusContent = false) => {
    focusContentOnClose.current = focusContent;
    setMobileOpen(false);
    if (!mobileOpen && focusContent) contentRef.current?.focus();
  };
  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    const shell = mainShellRef.current;
    const content = contentRef.current;
    if (!sidebar || !shell) return;
    shell.inert = true;
    const controls = () =>
      Array.from(
        sidebar.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),select'),
      ).filter((element) => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        focusContentOnClose.current = false;
        setMobileOpen(false);
      }
      if (event.key === 'Tab') {
        const items = controls();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      shell.inert = false;
      document.removeEventListener('keydown', handleKey);
      if (focusContentOnClose.current) content?.focus();
      else document.getElementById('mobile-nav-toggle')?.focus();
      focusContentOnClose.current = false;
    };
  }, [mobileOpen]);
  return { mobileOpen, setMobileOpen, closeNavigation, sidebarRef, mainShellRef, contentRef };
}
