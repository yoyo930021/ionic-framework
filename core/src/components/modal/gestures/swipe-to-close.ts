import { Animation } from '../../../interface';
import { getTimeGivenProgression } from '../../../utils/animation/cubic-bezier';
import { GestureDetail, createGesture } from '../../../utils/gesture';
import { clamp, getElementRoot } from '../../../utils/helpers';

// Defaults for the card swipe animation
export const SwipeToCloseDefaults = {
  MIN_PRESENTING_SCALE: 0.93,
};

export const createSwipeToCloseGesture = (
  el: HTMLIonModalElement,
  animation: Animation,
  onDismiss: () => void
) => {
  const contentEl = el.querySelector('ion-content');
  let contentScrollY = contentEl?.scrollY;

  const height = el.offsetHeight;
  let isOpen = false;
  let blockGesture = false;

  /**
   * Determines whether or not we should allow
   * the card modal to swipe to close when the
   * swipe gesture occurs on ion-content.
   * This is important as we may have scrollable
   * content inside this modal and users may want
   * to scroll the content rather than dismiss the modal.
   *
   * Swiping to close the card modal should
   * be allowed when either of the following are true:
   *
   * 1. The user is not swiping on ion-content.
   * 2. The user is swiping on ion-content, but
   * the scroll position is at the top and the user
   * is trying to swipe down.
   */
  const shouldAllowCardSwipe = (detail: GestureDetail): boolean => {
    const target = detail.event.target as HTMLElement | null;
    const swipingOnContent = target !== null && target.closest('ion-content') === contentEl;

    /**
     * If we are not swiping on the
     * content then we can allow the card
     * swipe to proceed.
     * Note: This will need to be adjusted when implementing https://github.com/ionic-team/ionic-framework/issues/22120.
     */
    if (!swipingOnContent) {
      return true;
    }

    /**
     * If the user is scrolling down on the content, then
     * we should let the scrolling proceed.
     */
    const isScrollingDown = detail.deltaY <= 0;
    if (isScrollingDown) return false;

    /**
     * Otherwise, if the user is scrolling up on the
     * content, we should only allow the card modal
     * to swipe to close if the scroll position of
     * the content is at the top. If the scroll
     * position is not at the top, then the user
     * likely wants to scroll up rather than
     * close the modal.
     */
    const root = getElementRoot(contentEl!);
    const scrollEl = root.querySelector('.inner-scroll');
    if (scrollEl !== null && scrollEl.scrollTop !== 0) { return false; }

    return true;
  }

  const canStart = (detail: GestureDetail) => {
    const target = detail.event.target as HTMLElement | null;
    if (target === null ||
       !(target as any).closest) {
      return true;
    }

    /**
     * Swiping should be disabled on the footer.
     */
    const footer = target.closest('ion-footer');
    if (footer !== null) {
      return false;
    }

    return true;
  };

  const onStart = (detail: GestureDetail) => {
    /**
     * Determine whether or not to block the gesture
     * based on how the user is swiping. Note that
     * we do this check in onStart rather than canStart
     * because we need to know which direction the
     * user is swiping before we proceed. canStart
     * is fired right when the first pointer event
     * is captured. onStart is fired after canStart
     * and after the threshold for the gesture
     * has been met.
     */
    if (!shouldAllowCardSwipe(detail)) {
      blockGesture = true;
      return;
    }

    /**
     * If swiping on the content
     * we should disable scrolling otherwise
     * the sheet will expand and the content will scroll.
     */
    if (contentEl) {
      contentScrollY = contentEl.scrollY;
      contentEl.scrollY = false;
    }

    animation.progressStart(true, (isOpen) ? 1 : 0);
  };

  const onMove = (detail: GestureDetail) => {
    if (blockGesture) return;

    const step = clamp(0.0001, detail.deltaY / height, 0.9999);

    animation.progressStep(step);
  };

  const onEnd = (detail: GestureDetail) => {
    if (blockGesture) {
      blockGesture = false;
      return;
    }

    const velocity = detail.velocityY;

    const step = clamp(0.0001, detail.deltaY / height, 0.9999);

    const threshold = (detail.deltaY + velocity * 1000) / height;

    const shouldComplete = threshold >= 0.5;
    let newStepValue = (shouldComplete) ? -0.001 : 0.001;

    if (!shouldComplete) {
      animation.easing('cubic-bezier(1, 0, 0.68, 0.28)');
      newStepValue += getTimeGivenProgression([0, 0], [1, 0], [0.68, 0.28], [1, 1], step)[0];
    } else {
      animation.easing('cubic-bezier(0.32, 0.72, 0, 1)');
      newStepValue += getTimeGivenProgression([0, 0], [0.32, 0.72], [0, 1], [1, 1], step)[0];
    }

    const duration = (shouldComplete) ? computeDuration(step * height, velocity) : computeDuration((1 - step) * height, velocity);
    isOpen = shouldComplete;

    gesture.enable(false);

    animation
      .onFinish(() => {
        if (!shouldComplete) {
          /**
           * If the modal is fully expanded, then
           * we can safely revert the content scrollY
           * prop to whatever it was before.
           */
          if (contentEl) {
            contentEl.scrollY = contentScrollY!;
          }
          gesture.enable(true);
        }
      })
      .progressEnd((shouldComplete) ? 1 : 0, newStepValue, duration);

    if (shouldComplete) {
      onDismiss();
    }
  };

  const gesture = createGesture({
    el,
    gestureName: 'modalSwipeToClose',
    gesturePriority: 40,
    direction: 'y',
    threshold: 10,
    canStart,
    onStart,
    onMove,
    onEnd
  });
  return gesture;
};

const computeDuration = (remaining: number, velocity: number) => {
  return clamp(400, remaining / Math.abs(velocity * 1.1), 500);
};
