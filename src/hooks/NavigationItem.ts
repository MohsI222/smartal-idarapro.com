import { useRef, useCallback, useEffect } from "react";

interface NavigationItem {
  element: HTMLElement;
  index: number;
  group: string;
  rect: DOMRect;
}
interface GlobalNavigationState {
  currentIndex: number;
  items: NavigationItem[];
  currentGroup: string;
}

export function useGlobalKeyboardNavigation() {
  const stateRef = useRef<GlobalNavigationState>({
    currentIndex: 0,
    items: [],
    currentGroup: "",
  });

  const updateNavigationItems = useCallback(() => {
    const focusableElements = document.querySelectorAll(
      '[data-nav-index]:not([disabled]):not([aria-disabled="true"])'
    );
    const items: NavigationItem[] = [];

    focusableElements.forEach((element) => {
      const navIndex = element.getAttribute('data-nav-index');
      const group = element.getAttribute('data-nav-group') || 'default';
      if (navIndex) {
        const htmlElement = element as HTMLElement;
        items.push({
          element: htmlElement,
          index: parseInt(navIndex, 10),
          group,
          rect: htmlElement.getBoundingClientRect(),
        });
      }
    });

    items.sort((a, b) => a.index - b.index);
    stateRef.current.items = items;
  }, []);

  const focusElement = useCallback((element: HTMLElement) => {
    element.focus();
    element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    // Add visual focus indicator
    element.classList.add('nav-focused');
    setTimeout(() => {
      element.classList.remove('nav-focused');
    }, 200);
  }, []);

  const navigateToIndex = useCallback((index: number) => {
    const { items } = stateRef.current;
    if (items.length === 0) return;

    const validIndex = Math.max(0, Math.min(index, items.length - 1));
    stateRef.current.currentIndex = validIndex;
    focusElement(items[validIndex].element);
  }, [focusElement]);

  const findNearestElementInDirection = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const { items, currentIndex } = stateRef.current;
    if (items.length === 0) return null;

    const currentItem = items[currentIndex];
    if (!currentItem) return null;

    const currentRect = currentItem.rect;
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;

    let bestCandidate: NavigationItem | null = null;
    let bestDistance = Infinity;

    for (let i = 0; i < items.length; i++) {
      if (i === currentIndex) continue;

      const candidate = items[i];
      const candidateRect = candidate.rect;
      const candidateCenterX = candidateRect.left + candidateRect.width / 2;
      const candidateCenterY = candidateRect.top + candidateRect.height / 2;

      let isCandidateInDirection = false;
      let distance = 0;

      switch (direction) {
        case 'up':
          // العنصر يجب أن يكون فوق العنصر الحالي
          isCandidateInDirection = candidateCenterY < currentRect.top;
          distance = Math.sqrt(
            Math.pow(candidateCenterX - currentCenterX, 2) +
            Math.pow(candidateCenterY - currentCenterY, 2)
          );
          break;
        case 'down':
          // العنصر يجب أن يكون تحت العنصر الحالي
          isCandidateInDirection = candidateCenterY > currentRect.bottom;
          distance = Math.sqrt(
            Math.pow(candidateCenterX - currentCenterX, 2) +
            Math.pow(candidateCenterY - currentCenterY, 2)
          );
          break;
        case 'left':
          // العنصر يجب أن يكون يسار العنصر الحالي
          isCandidateInDirection = candidateCenterX < currentRect.left;
          distance = Math.sqrt(
            Math.pow(candidateCenterX - currentCenterX, 2) +
            Math.pow(candidateCenterY - currentCenterY, 2)
          );
          break;
        case 'right':
          // العنصر يجب أن يكون يمين العنصر الحالي
          isCandidateInDirection = candidateCenterX > currentRect.right;
          distance = Math.sqrt(
            Math.pow(candidateCenterX - currentCenterX, 2) +
            Math.pow(candidateCenterY - currentCenterY, 2)
          );
          break;
      }

      if (isCandidateInDirection && distance < bestDistance) {
        bestDistance = distance;
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;

    // Don't interfere with input fields
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    const { items, currentIndex } = stateRef.current;
    if (items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nearest = findNearestElementInDirection('down');
        if (nearest) {
          const newIndex = items.indexOf(nearest);
          stateRef.current.currentIndex = newIndex;
          focusElement(nearest.element);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const nearest = findNearestElementInDirection('up');
        if (nearest) {
          const newIndex = items.indexOf(nearest);
          stateRef.current.currentIndex = newIndex;
          focusElement(nearest.element);
        }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        const nearest = findNearestElementInDirection('right');
        if (nearest) {
          const newIndex = items.indexOf(nearest);
          stateRef.current.currentIndex = newIndex;
          focusElement(nearest.element);
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const nearest = findNearestElementInDirection('left');
        if (nearest) {
          const newIndex = items.indexOf(nearest);
          stateRef.current.currentIndex = newIndex;
          focusElement(nearest.element);
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const currentItem = items[currentIndex];
        if (currentItem?.element) {
          currentItem.element.click();
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        // Try to close modals, dropdowns, etc.
        const activeModal = document.querySelector('[role="dialog"]');
        if (activeModal) {
          const closeButton = activeModal.querySelector('[aria-label="Close"], button[aria-label*="إغلاق"], button[aria-label*="close"]');
          if (closeButton) {
            (closeButton as HTMLElement).click();
          }
        }
        break;
      }
      case 'Home': {
        e.preventDefault();
        navigateToIndex(0);
        break;
      }
      case 'End': {
        e.preventDefault();
        navigateToIndex(items.length - 1);
        break;
      }
    }
  }, [navigateToIndex, findNearestElementInDirection, focusElement]);

  useEffect(() => {
    updateNavigationItems();
    window.addEventListener('keydown', handleKeyDown);

    // Update navigation items when DOM changes
    const observer = new MutationObserver(() => {
      updateNavigationItems();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();
    };
  }, [handleKeyDown, updateNavigationItems]);

  return {
    updateNavigationItems,
    navigateToIndex,
  };
}
