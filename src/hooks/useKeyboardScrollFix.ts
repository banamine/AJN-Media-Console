import { useEffect } from 'react';

export function useKeyboardScrollFix() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      const scrollContainer = document.getElementById('nav-content-area') || document.querySelector('.custom-scrollbar') as HTMLElement;
      if (!scrollContainer) return;

      const scrollAmount = 100; // Pixels per arrow key press

      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(e.key)) {
        if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
          e.preventDefault();
          scrollContainer.scrollBy({
            top: e.key === 'ArrowDown' ? scrollAmount : -scrollAmount,
            behavior: 'smooth'
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
