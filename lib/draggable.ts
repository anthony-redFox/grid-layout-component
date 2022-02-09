import { getTouchIdentifier, getControlPosition } from "./domFns";

// Simple abstraction for dragging events names.
const eventsFor = {
  touch: {
    start: "touchstart",
    move: "touchmove",
    stop: "touchend"
  },
  mouse: {
    start: "mousedown",
    move: "mousemove",
    stop: "mouseup"
  }
} as const;

// Default to mouse events.
let dragEventFor: typeof eventsFor.touch | typeof eventsFor.mouse =
  eventsFor.mouse;

type DraggableCoreState = {
  lastX: number;
  lastY: number;
  touchIdentifier?: number;
};

export type DraggableData = {
  node: HTMLElement;
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  lastX: number;
  lastY: number;
};

export type DraggableEventHandler = (
  e: MouseEvent | TouchEvent,
  data: DraggableData
) => void | false;

export type ControlPosition = { x: number; y: number };
export type PositionOffsetControlPosition = {
  x: number | string;
  y: number | string;
};

interface DraggableCoreDefaultProps {
  /**
   * `allowAnyClick` allows dragging using any mouse button.
   * By default, we only accept the left button.
   *
   * Defaults to `false`.
   */
  allowAnyClick: boolean;
  /**
   * `disabled`, if true, stops the <Draggable> from dragging. All handlers,
   * with the exception of `onMouseDown`, will not fire.
   */
  disabled: boolean;
  /**
   * Called when dragging starts.
   * If this function returns the boolean false, dragging will be canceled.
   */
  onStart: DraggableEventHandler;
  /**
   * Called while dragging.
   * If this function returns the boolean false, dragging will be canceled.
   */
  onDrag: DraggableEventHandler;
  /**
   * Called when dragging stops.
   * If this function returns the boolean false, the drag will remain active.
   */
  onStop: DraggableEventHandler;
  /**
   * `scale`, if set, applies scaling while dragging an element
   */
  scale: number;
}

function isNum(num: unknown): boolean {
  return typeof num === "number" && !isNaN(num);
}

// Create an data object exposed by <DraggableCore>'s events
function createCoreData(
  node: HTMLElement,
  state: DraggableCoreState,
  x: number,
  y: number
) {
  const isStart = !isNum(state.lastX);

  if (isStart) {
    // If this is our first move, use the x and y as last coords.
    return {
      node,
      deltaX: 0,
      deltaY: 0,
      lastX: x,
      lastY: y,
      x,
      y
    };
  }
  // Otherwise calculate proper values.
  return {
    node,
    deltaX: x - state.lastX,
    deltaY: y - state.lastY,
    lastX: state.lastX,
    lastY: state.lastY,
    x,
    y
  };
}

const defaultProps: DraggableCoreDefaultProps = {
  allowAnyClick: false, // by default only accept left click
  disabled: false,
  onStart: function () {},
  onDrag: function () {},
  onStop: function () {},
  scale: 1
};

//
// Define <DraggableCore>.
//
// <DraggableCore> is for advanced usage of <Draggable>. It maintains minimal internal state so it can
// work well with libraries that require more control over the element.
//

export default function draggable(
  node: HTMLElement,
  options: Partial<DraggableCoreDefaultProps>
) {
  const handleDragStart = (e: MouseEvent | TouchEvent) => {
    // Only accept left-clicks.
    if (
      (!props.allowAnyClick && "button" in e && e.button !== 0) ||
      props.disabled
    ) {
      return;
    }

    // Prevent scrolling on mobile devices, like ipad/iphone.
    // Important that this is after handle/cancel.
    if (e.type === "touchstart") e.preventDefault();

    // Set touch identifier in component state if this is a touch event. This allows us to
    // distinguish between individual touches on multitouch screens by identifying which
    // touchpoint was set to this element.
    const touchIdentifier = getTouchIdentifier(e);
    state.touchIdentifier = touchIdentifier;

    // Get the current drag point from the event. This is used as the offset.
    const position = getControlPosition(e, node, props.scale, touchIdentifier);
    if (position == null) return; // not possible but satisfies flow
    const { x, y } = position;

    // Create an event object with all the data parents need to make a decision here.
    const coreEvent = createCoreData(node, state, x, y);

    // Call event handler. If it returns explicit false, cancel.
    const shouldUpdate = props.onStart(e, coreEvent);
    if (shouldUpdate === false) return;

    // Initiate dragging. Set the current x and y as offsets
    // so we know how much we've moved during the drag. This allows us
    // to drag elements around even if they have been moved, without issue.
    state.lastX = x;
    state.lastY = y;

    // Add events to the document directly so we catch when the user's mouse/touch moves outside of
    // this element. We use different events depending on whether or not we have detected that this
    // is a touch-capable device.
    document.addEventListener(dragEventFor.move, handleDrag);
    document.addEventListener(dragEventFor.stop, handleDragStop);
  };

  const handleDrag = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    // Get the current drag point from the event. This is used as the offset.
    const position = getControlPosition(
      e,
      node,
      props.scale,
      state.touchIdentifier
    );
    if (position == null) return;
    const { x, y } = position;

    const coreEvent = createCoreData(node, state, x, y);

    // Call event handler. If it returns explicit false, trigger end.
    const shouldUpdate = props.onDrag(e, coreEvent);
    if (shouldUpdate === false) {
      handleDragStop(new MouseEvent("mouseup"));
      return;
    }

    state.lastX = x;
    state.lastY = y;
  };

  const handleDragStop = (e: MouseEvent | TouchEvent) => {
    const position = getControlPosition(
      e,
      node,
      props.scale,
      state.touchIdentifier
    );
    if (position == null) return;
    const { x, y } = position;
    const coreEvent = createCoreData(node, state, x, y);

    // Call event handler
    const shouldContinue = props.onStop(e, coreEvent);
    if (shouldContinue === false) return false;

    state.lastX = NaN;
    state.lastY = NaN;

    document.removeEventListener(dragEventFor.move, handleDrag);
    document.removeEventListener(dragEventFor.stop, handleDragStop);
  };

  const onMouseDown = (e: MouseEvent) => {
    dragEventFor = eventsFor.mouse; // on touchscreen laptops we could switch back to mouse
    return handleDragStart(e);
  };

  // Same as onMouseDown (start drag), but now consider this a touch device.
  const onTouchStart = (e: TouchEvent) => {
    // We're on a touch device now, so change the event handlers
    dragEventFor = eventsFor.touch;
    return handleDragStart(e);
  };

  const state: DraggableCoreState = {
    // Used while dragging to determine deltas.
    lastX: NaN,
    lastY: NaN,
    touchIdentifier: undefined
  };

  const props = { ...defaultProps, ...options };
  node.addEventListener(eventsFor.touch.start, onTouchStart, {
    passive: false
  });
  node.addEventListener(eventsFor.mouse.start, onMouseDown);

  return function () {
    // Remove any leftover event handlers. Remove both touch and mouse handlers in case
    // some browser quirk caused a touch event to fire during a mouse move, or vice versa.
    document.removeEventListener(eventsFor.mouse.move, handleDrag);
    document.removeEventListener(eventsFor.touch.move, handleDrag);
    document.removeEventListener(eventsFor.mouse.stop, handleDragStop);
    document.removeEventListener(eventsFor.touch.stop, handleDragStop);
    node.removeEventListener(eventsFor.touch.start, onTouchStart);
    node.removeEventListener(eventsFor.mouse.start, onMouseDown);
  };
}
