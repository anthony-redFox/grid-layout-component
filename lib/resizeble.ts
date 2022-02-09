import draggable from "./draggable";
import type { DraggableData } from "./draggable";

interface ResizeParametrs {
  minConstraints: [number, number];
  maxConstraints: [number, number];
  transformScale: number;
}

interface ResizeSize {
  width: number;
  height: number;
}

export type ResizeHandlerOptions = {
  size: ResizeSize;
  handle: ResizeOptions["handleAxis"];
};

interface ResizeOptions {
  start: () => Partial<ResizeParametrs> | undefined | false;
  resize: (e: MouseEvent | TouchEvent, options: ResizeHandlerOptions) => void;
  stop: (e: MouseEvent | TouchEvent, options: ResizeHandlerOptions) => void;
  handleAxis?: "s" | "w" | "e" | "n" | "sw" | "nw" | "se" | "ne";
  lockAspectRatio?: boolean;
  axis?: "both" | "x" | "y";
}

let lastHandleRect: DOMRect | null = null;
let slack: [number, number] | null = null;

function resizeHandler(
  {
    axis,
    handleAxis,
    lockAspectRatio
  }: Required<Pick<ResizeOptions, "handleAxis" | "axis" | "lockAspectRatio">>,
  resizeParams: ResizeSize & ResizeParametrs,
  { node, deltaX, deltaY }: DraggableData
): [number, number] | null {
  const { width: nodeWidth, height: nodeHieght, transformScale } = resizeParams;

  // Axis restrictions
  const canDragX =
    (axis === "both" || axis === "x") &&
    handleAxis !== "n" &&
    handleAxis !== "s";
  const canDragY =
    (axis === "both" || axis === "y") &&
    handleAxis !== "e" &&
    handleAxis !== "w";
  // No dragging possible.
  if (!canDragX && !canDragY) return null;

  // Decompose axis for later use
  const axisV = axis[0];
  const axisH = axis[axis.length - 1]; // intentionally not axis[1], so that this catches axis === 'w' for example

  // Track the element being dragged to account for changes in position.
  // If a handle's position is changed between callbacks, we need to factor this in to the next callback.
  // Failure to do so will cause the element to "skip" when resized upwards or leftwards.
  const handleRect = node.getBoundingClientRect();
  if (lastHandleRect != null) {
    // If the handle has repositioned on either axis since last render,
    // we need to increase our callback values by this much.
    // Only checking 'n', 'w' since resizing by 's', 'w' won't affect the overall position on page,
    if (axisH === "w") {
      const deltaLeftSinceLast = handleRect.left - lastHandleRect.left;
      deltaX += deltaLeftSinceLast;
    }
    if (axisV === "n") {
      const deltaTopSinceLast = handleRect.top - lastHandleRect.top;
      deltaY += deltaTopSinceLast;
    }
  }
  // Storage of last rect so we know how much it has really moved.
  lastHandleRect = handleRect;

  // Reverse delta if using top or left drag handles.
  if (axisH === "w") deltaX = -deltaX;
  if (axisV === "n") deltaY = -deltaY;

  // Update w/h by the deltas. Also factor in transformScale.
  let width = nodeWidth + (canDragX ? deltaX / transformScale : 0);
  let height = nodeHieght + (canDragY ? deltaY / transformScale : 0);

  // Run user-provided constraints.
  [width, height] = runConstraints(
    width,
    height,
    resizeParams,
    lockAspectRatio
  );

  const dimensionsChanged = width !== nodeWidth || height !== nodeHieght;

  if (dimensionsChanged) {
    return [width, height];
  }

  return null;
}

// Clamp width and height within provided constraints
function runConstraints(
  width: number,
  height: number,
  {
    minConstraints,
    maxConstraints,
    width: nodeWidth,
    height: nodeHieght
  }: ResizeSize & ResizeParametrs,
  lockAspectRatio: boolean
): [number, number] {
  // short circuit
  if (!minConstraints && !maxConstraints && !lockAspectRatio)
    return [width, height];

  // If constraining to min and max, we need to also fit width and height to aspect ratio.
  if (lockAspectRatio) {
    const ratio = nodeWidth / nodeHieght;
    const deltaW = width - nodeWidth;
    const deltaH = height - nodeHieght;

    // Find which coordinate was greater and should push the other toward it.
    // E.g.:
    // ratio = 1, deltaW = 10, deltaH = 5, deltaH should become 10.
    // ratio = 2, deltaW = 10, deltaH = 6, deltaW should become 12.
    if (Math.abs(deltaW) > Math.abs(deltaH * ratio)) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }

  const [oldW, oldH] = [width, height];

  // Add slack to the values used to calculate bound position. This will ensure that if
  // we start removing slack, the element won't react to it right away until it's been
  // completely removed.
  const [slackW, slackH] = slack || [0, 0];
  width += slackW;
  height += slackH;

  if (minConstraints) {
    width = Math.max(minConstraints[0], width);
    height = Math.max(minConstraints[1], height);
  }
  if (maxConstraints) {
    width = Math.min(maxConstraints[0], width);
    height = Math.min(maxConstraints[1], height);
  }

  // If the width or height changed, we must have introduced some slack. Record it for the next iteration.
  slack = [slackW + (oldW - width), slackH + (oldH - height)];

  return [width, height];
}

export default function resizable(
  node: HTMLElement,
  dragElement: HTMLElement,
  options: ResizeOptions
) {
  const {
    lockAspectRatio = false,
    handleAxis = "se",
    axis = "both",
    start,
    resize,
    stop
  } = options;
  const parametrs: ResizeSize & ResizeParametrs = {
    width: 0,
    height: 0,
    minConstraints: [20, 20],
    maxConstraints: [Infinity, Infinity],
    transformScale: 1
  };

  return draggable(dragElement, {
    onStop(e, data) {
      const newXY = resizeHandler(
        { handleAxis, axis, lockAspectRatio },
        parametrs,
        data
      ) || [parametrs.width, parametrs.height];
      const [width, height] = newXY;
      stop(e, { size: { width, height }, handle: handleAxis });
      lastHandleRect = null;
      slack = null;
    },
    onStart(e) {
      e.stopPropagation();
      parametrs.width = node.offsetWidth;
      parametrs.height = node.offsetHeight;
      const props = start();
      if (props) {
        Object.assign(parametrs, props);
      } else if (props === false) {
        return false;
      }

      lastHandleRect = null;
      slack = null;
      return;
    },
    onDrag(e, data) {
      const newXY = resizeHandler(
        { handleAxis, axis, lockAspectRatio },
        parametrs,
        data
      );
      if (newXY) {
        const [width, height] = newXY;
        parametrs.width = width;
        parametrs.height = height;
        resize(e, { size: { width, height }, handle: handleAxis });
      }
    }
  });
}
