import {
  bottom,
  cloneLayout,
  cloneLayoutItem,
  compact,
  getAllCollisions,
  getLayoutItem,
  moveElement,
  withLayoutItem,
  correctBounds,
  sortLayoutItems
} from "./utils";
import {
  getBreakpointFromWidth,
  getColsFromBreakpoint
} from "./responsiveUtils";
import {
  calcGridColWidth,
  calcGridItemPosition,
  calcXY,
  calcWH,
  clamp,
  type PositionParams
} from "./calculateUtils";
import GridLayoutElement from "./GridLayoutElement";
import GridLayoutGroup from "./GridLayoutGroup";
import type {
  gridLayoutElementDragDetail,
  gridLayoutElementResizeDetail
} from "./GridLayoutElement";

function isEqual(arr: GridLayoutElementData[], arr2: GridLayoutElementData[]) {
  if (arr.length !== arr2.length) {
    return false;
  }
  return arr.every((l, index) => {
    const l2 = arr2[index];
    if (l2 === l) {
      return true;
    }
    const keys = Object.keys(l) as keysElementData[];
    const keys2 = Object.keys(l2) as keysElementData[];

    return (
      keys.length === keys2.length && keys.every((key) => l[key] === l2[key])
    );
  });
}

const css = new CSSStyleSheet();
// it is minify from gridLayoutStyles.css
css.replaceSync(
  ":host{display:block;position:relative;transition:height .2s ease}.grid-placeholder{background-color:red;position:absolute;opacity:.2;z-index:2;transition:none}.grid-placeholder_active{transition:transform .1s ease}"
);

const template = document.createElement("template");
template.innerHTML =
  '<div id="placeholder" class="grid-placeholder" style="display: none;"></div><slot></slot>';

export interface GridLayoutElementData {
  i: string;
  x: number;
  y: number;
  h: number;
  w: number;
  drag?: boolean;
  resizable?: boolean;
  bounded?: boolean;
  isGroup?: boolean;
  static?: boolean;
  moved?: boolean;
}

type syncData = "x" | "y" | "w" | "h";
type keysElementData = keyof GridLayoutElementData;

interface GridLayoutState {
  autoSize: boolean;
  responsive: boolean;
  layout?: Array<GridLayoutElementData>;
  columns: number;
  rowHeight: number;
  columnWidth: number;
  containerPadding: [number, number] | null;
  maxRows: number;
  margin: [number, number];
  compactType: "vertical" | "horizontal";
  allowOverlap: boolean;
  preventCollision: boolean;
  drag: boolean;
  resizable: boolean;
  activeDrag: { x: number; y: number; h: number; w: number } | null;
  oldDragItem: GridLayoutElementData | null;
  oldLayout?: Array<GridLayoutElementData>;
  oldResizeItem: GridLayoutElementData | null;
}

export default class GridLayout extends HTMLElement {
  declare shadow: ShadowRoot;
  declare placeholder: HTMLElement;
  template = template;
  sheet = new CSSStyleSheet();
  observer = new ResizeObserver(() => {
    this.calculateSize();
    this.render();
  });
  breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  colsAdaptation = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
  containerPadding = { lg: null, md: null, sm: null, xs: null, xxs: null };
  layout: Array<GridLayoutElementData> = [];
  maximaze = {
    overflow: "",
    top: 0
  };
  groupCollapsing: Map<string, GridLayoutElementData[]> = new Map();

  state: GridLayoutState = {
    autoSize: true,
    responsive: false,
    layout: undefined,
    columns: 12,
    rowHeight: 150,
    columnWidth: 0,
    containerPadding: null,
    maxRows: Infinity, // infinite vertical growth
    margin: [10, 10],
    compactType: "vertical",
    allowOverlap: false,
    preventCollision: false,
    drag: false,
    resizable: false,
    activeDrag: null,
    oldDragItem: null,
    oldLayout: undefined,
    oldResizeItem: null
  };

  dragHandler = (event: CustomEvent<gridLayoutElementDragDetail>) => {
    const { detail, target } = event;
    if (!(target instanceof HTMLElement) || target.parentElement !== this) {
      return;
    }

    if (!this.state.drag) {
      event.preventDefault();
      return;
    }

    if (detail.life === "start") {
      this.dragStart(detail);
    } else if (detail.life === "move") {
      this.drag(detail);
    } else if (detail.life === "end") {
      this.dragStop(detail);
    }
  };

  resizeHandler = (event: CustomEvent<gridLayoutElementResizeDetail>) => {
    const { detail, target } = event;
    if (
      !(target instanceof GridLayoutElement) ||
      target.parentElement !== this
    ) {
      return;
    }

    if (!this.state.resizable) {
      event.preventDefault();
      return;
    }

    if (detail.life === "start") {
      this.onResizeStart(detail);
    } else if (detail.life === "move") {
      this.onResize(detail, target);
    } else if (detail.life === "end") {
      this.onResizeStop();
    }
  };

  maximazeHandler = (event: CustomEvent<boolean>) => {
    const { detail, target } = event;
    if (!(target instanceof HTMLElement) || target.parentElement !== this) {
      return;
    }

    if (detail) {
      this.maximaze = {
        overflow: this.style.overflow,
        top: this.scrollTop
      };
      this.style.overflow = "hidden";
      this.scrollTop = 0;
    } else {
      this.style.overflow = this.maximaze.overflow;
      this.scrollTop = this.maximaze.top;
    }
  };

  collapsedHandler = (event: CustomEvent<string>) => {
    const { detail: key, target } = event;
    if (!(target instanceof HTMLElement) || target.parentElement !== this) {
      return;
    }
    const oldLayout = this._collectLayout();
    const { allowOverlap, columns } = this.state;
    const group = oldLayout.find(({ i }) => i === key);
    if (!group) {
      return;
    }
    const isCollapsed = target.hasAttribute("collapsed");

    let layout: GridLayoutElementData[];
    let set: Set<string>;
    if (isCollapsed) {
      const maxY = oldLayout.reduce(
        (gY, { isGroup, y }) => (isGroup && group.y < y ? Math.min(gY, y) : gY),
        Infinity
      );
      let collapsed: GridLayoutElementData[] = [];
      layout = oldLayout.filter((l) => {
        const isGrouped = l.y < maxY && l.y > group.y;
        if (isGrouped) {
          collapsed.push(l);
        }
        return !isGrouped;
      });
      collapsed = sortLayoutItems(collapsed, this.state.compactType);
      collapsed.forEach((l) => !l.static && (l.y = group.y));
      set = new Set(collapsed.map((l) => l.i));
      this.groupCollapsing.set(key, collapsed);
    } else {
      const collapsed = this.groupCollapsing.get(key) || [];
      set = new Set(collapsed.map((l) => l.i));
      layout = [...oldLayout, ...collapsed];
      this.groupCollapsing.delete(key);
    }
    for (const node of this.children) {
      if (!(node instanceof HTMLElement) || !set.has(node.dataset.id || "")) {
        continue;
      }
      node.style.visibility = isCollapsed ? "hidden" : "visible";
    }
    const newLayout = allowOverlap
      ? layout
      : compact(layout, this.state.compactType, columns);
    this.setState({ layout: newLayout });
    this.onLayoutMaybeChanged(layout, oldLayout);
  };

  setState(update: Partial<GridLayoutState>) {
    Object.assign(this.state, update);
    this.render();
  }

  dragStart({ key }: gridLayoutElementDragDetail) {
    const layout = this._collectLayout();
    const l = getLayoutItem(layout, key);
    if (!l) return;

    this.setState({
      oldDragItem: cloneLayoutItem(l),
      layout,
      oldLayout: layout
    });
  }

  /**
   * Each drag movement create a new dragelement and move the element to the dragged location
   * @param {String} i Id of the child
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} node The current dragging DOM element
   */
  drag({ key, top, left }: gridLayoutElementDragDetail) {
    let { layout = [] } = this.state;
    const { columns, allowOverlap, preventCollision } = this.state;
    const l = getLayoutItem(layout, key);
    if (!l) return;

    const { x, y } = calcXY(this.getPositionParams(), top, left, l.w, l.h);
    // Create placeholder (display only)
    const placeholder = {
      w: l.w,
      h: l.h,
      x: l.x,
      y: l.y,
      placeholder: true,
      i: key
    };

    // Move the element to the dragged location.
    const isUserAction = true;
    layout = moveElement(
      layout,
      l,
      x,
      y,
      isUserAction,
      preventCollision,
      this.state.compactType,
      columns,
      allowOverlap
    );

    this.setState({
      layout: allowOverlap
        ? layout
        : compact(layout, this.state.compactType, columns),
      activeDrag: placeholder
    });
  }

  /**
   * When dragging stops, figure out which position the element is closest to and update its x and y.
   * @param  {String} i Index of the child.
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} node The current dragging DOM element
   */
  dragStop({ key, top, left }: gridLayoutElementDragDetail) {
    let { layout = [] } = this.state;
    const { columns, preventCollision, allowOverlap } = this.state;
    const l = getLayoutItem(layout, key);
    if (!l) return;

    const { x, y } = calcXY(this.getPositionParams(), top, left, l.w, l.h);
    if (l.isGroup && this.groupCollapsing.has(key)) {
      this.groupCollapsing.get(key)?.forEach((l) => !l.static && (l.y = y));
    }
    // Move the element here
    const isUserAction = true;
    layout = moveElement(
      layout,
      l,
      x,
      y,
      isUserAction,
      preventCollision,
      this.state.compactType,
      columns,
      allowOverlap
    );

    // Set state
    const newLayout = allowOverlap
      ? layout
      : compact(layout, this.state.compactType, columns);
    const { oldLayout = [] } = this.state;
    this.setState({
      activeDrag: null,
      layout: newLayout,
      oldDragItem: null,
      oldLayout: undefined
    });

    this.onLayoutMaybeChanged(newLayout, oldLayout);
  }

  onResizeStart({ key }: gridLayoutElementResizeDetail) {
    const layout = this._collectLayout();
    const l = getLayoutItem(layout, key);
    if (!l) return;

    this.setState({
      oldResizeItem: cloneLayoutItem(l),
      layout,
      oldLayout: layout
    });
  }

  onResize(
    { key, width, height }: gridLayoutElementResizeDetail,
    item: GridLayoutElement
  ) {
    const { layout = [] } = this.state;
    const { columns, preventCollision, allowOverlap } = this.state;
    const la = getLayoutItem(layout, key);
    if (!la) {
      return;
    }

    // Get new XY
    let { w, h } = calcWH(this.getPositionParams(), width, height, la.x, la.y);

    // Min/max capping
    w = clamp(w, item.minW, Math.min(item.maxW, columns - la.x));
    h = clamp(h, item.minH, item.maxH);

    const [newLayout, l] = withLayoutItem(
      layout,
      key,
      (l: GridLayoutElementData) => {
        // Something like quad tree should be used
        // to find collisions faster
        let hasCollisions = false;
        if (preventCollision && !allowOverlap) {
          const collisions = getAllCollisions(layout, { ...l, w, h }).filter(
            (layoutItem: GridLayoutElementData) => layoutItem.i !== l.i
          );
          hasCollisions = collisions.length > 0;

          // If we're colliding, we need adjust the placeholder.
          if (hasCollisions) {
            // adjust w && h to maximum allowed space
            let leastX = Infinity,
              leastY = Infinity;
            collisions.forEach((layoutItem: GridLayoutElementData) => {
              if (layoutItem.x > l.x) leastX = Math.min(leastX, layoutItem.x);
              if (layoutItem.y > l.y) leastY = Math.min(leastY, layoutItem.y);
            });

            if (Number.isFinite(leastX)) l.w = leastX - l.x;
            if (Number.isFinite(leastY)) l.h = leastY - l.y;
          }
        }

        if (!hasCollisions) {
          // Set new width and height.
          l.w = w;
          l.h = h;
        }

        return l;
      }
    );

    // Shouldn't ever happen, but typechecking makes it necessary
    if (!l) return;

    // Create placeholder element (display only)
    const placeholder = {
      w: l.w,
      h: l.h,
      x: l.x,
      y: l.y,
      static: true,
      i: key
    };

    // Re-compact the newLayout and set the drag placeholder.
    this.setState({
      layout: allowOverlap
        ? newLayout
        : compact(newLayout, this.state.compactType, columns),
      activeDrag: placeholder
    });
  }

  onResizeStop() {
    const { layout = [] } = this.state;
    const { columns, allowOverlap } = this.state;

    // Set state
    const newLayout = allowOverlap
      ? layout
      : compact(layout, this.state.compactType, columns);
    const { oldLayout = [] } = this.state;
    this.setState({
      activeDrag: null,
      layout: newLayout,
      oldResizeItem: null,
      oldLayout: undefined
    });

    this.onLayoutMaybeChanged(newLayout, oldLayout);
  }

  onLayoutMaybeChanged(
    newLayout: Array<GridLayoutElementData>,
    oldLayout: Array<GridLayoutElementData>
  ) {
    if (!isEqual(oldLayout || [], newLayout)) {
      this.dispatchEvent(
        new CustomEvent("layoutChanged", {
          detail: {
            oldLayout: oldLayout,
            layout: newLayout
          }
        })
      );
    }
    this.setState({ layout: undefined });
  }

  getPositionParams(): PositionParams {
    return {
      cols: this.state.columns,
      columnWidth: this.state.columnWidth,
      containerPadding: this.state.containerPadding || this.state.margin,
      margin: this.state.margin,
      maxRows: this.state.maxRows,
      rowHeight: this.state.rowHeight
    };
  }

  calculateSize() {
    if (!this.isConnected) {
      return;
    }
    const { responsive, compactType } = this.state;
    let { columns, containerPadding: padding } = this.state;
    if (responsive) {
      const breakpoint = getBreakpointFromWidth(
        this.breakpoints,
        this.clientWidth
      );
      const newCols = getColsFromBreakpoint(breakpoint, this.colsAdaptation);
      if (newCols !== columns) {
        columns = this.state.columns = newCols;
        padding = this.state.containerPadding =
          // @ts-expect-error need to fix
          this.containerPadding[breakpoint] || null;
        this.state.layout = compact(
          correctBounds(cloneLayout(this.layout), { cols: columns }),
          compactType,
          columns
        );
      }
    }

    const { rowHeight, margin } = this.state;
    const containerPadding = padding || margin;
    this.state.columnWidth = calcGridColWidth(
      this.getPositionParams(),
      this.clientWidth
    );

    this.sheet.replaceSync(`:host {
        --grid-layout-cols: ${columns};
        --grid-element-width: ${this.state.columnWidth}px;
        --grid-element-height: ${rowHeight}px;
        --grid-element-margin-left: ${margin[0]}px;
        --grid-element-margin-top: ${margin[1]}px;
        --grid-layout-padding-top: ${containerPadding[0]}px;
        --grid-layout-padding-left: ${containerPadding[1]}px;
    }`);
  }

  connectedCallback() {
    if (this.shadow) {
      return;
    }

    this.addEventListener(
      "gridLayoutElementDrag",
      this.dragHandler as EventListener
    );
    this.addEventListener(
      "gridLayoutElementResize",
      this.resizeHandler as EventListener
    );
    this.addEventListener(
      "gridLayoutElementMaximaze",
      this.maximazeHandler as EventListener
    );
    this.addEventListener(
      "gridLayoutGroupCollapsed",
      this.collapsedHandler as EventListener
    );
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.adoptedStyleSheets = [css, this.sheet];
    this.shadow.appendChild(this.template.content.cloneNode(true));
    this.shadow.addEventListener("slotchange", (e: Event) => {
      const slot = e.target;
      if (!(slot instanceof HTMLSlotElement) || slot.name) {
        return;
      }

      const layout = this._collectLayout();
      this._calculateLayout(layout, layout);
    });
    const placeholder = this.shadow.getElementById("placeholder");
    if (placeholder) {
      this.placeholder = placeholder;
    }
    this.observer.observe(this);
    this.calculateSize();
    const style = window.getComputedStyle(this);
    if (style.overflow !== "visible" || style.height !== "auto") {
      this.state.autoSize = false;
    }
    this.render();
  }

  attributeChangedCallback(name: string, old: string, newValue: string | null) {
    switch (name) {
      case "row-height": {
        const rowHeight = Number.parseInt(
          newValue ?? `${this.state.rowHeight}`
        );
        if (!rowHeight) {
          break;
        }
        this.state.rowHeight = rowHeight;
        this.calculateSize();
        break;
      }
      case "resizable":
      case "drag": {
        this.setState({ [name]: newValue !== null });
        break;
      }
      case "responsive": {
        this.setState({ [name]: newValue !== null });
        this.calculateSize();
        break;
      }
      case "columns": {
        const cols = Number.parseInt(newValue ?? `${this.state.columns}`);
        if (!cols) {
          return;
        }

        const oldLayout = this._collectLayout();
        let layout = correctBounds(oldLayout, { cols });
        layout = this.state.allowOverlap
          ? layout
          : compact(layout, this.state.compactType, cols);
        this.setState({ layout });
        this.onLayoutMaybeChanged(layout, oldLayout);
        this.setState({ [name]: cols });
        this.calculateSize();
        return;
      }
    }
  }

  syncWithNode(
    layout: Record<string, GridLayoutElementData>,
    attrs: syncData[] = ["x", "y", "w", "h"]
  ) {
    for (const node of this.children) {
      if (
        !(node instanceof GridLayoutElement) ||
        !node.dataset.id ||
        !layout[node.dataset.id]
      ) {
        continue;
      }
      const l = layout[node.dataset.id];
      attrs.forEach(
        (key) =>
          node.state[key] !== l[key] && node.setAttribute(key, String(l[key]))
      );
    }
  }

  /**
   * Calculates a pixel value for the container.
   * @return {String} Container height in pixels.
   */
  containerHeight(): string {
    const layout = this._collectLayout();
    const nbRow = bottom(layout);
    const containerPaddingY = this.state.containerPadding
      ? this.state.containerPadding[1]
      : this.state.margin[1];
    return (
      nbRow * this.state.rowHeight +
      (nbRow - 1) * this.state.margin[1] +
      containerPaddingY * 2 +
      "px"
    );
  }

  render() {
    if (!this.isConnected) {
      return;
    }
    const layout = this.state.layout?.reduce(
      (acc: Record<GridLayoutElementData["i"], GridLayoutElementData>, l) => {
        acc[l.i] = l;
        return acc;
      },
      {}
    );

    const active = this.state.activeDrag;
    this.placeholder.classList.toggle(
      "grid-placeholder_active",
      !!active && this.placeholder.style.display !== "none"
    );
    this.placeholder.style.display = active ? "block" : "none";
    if (this.state.autoSize) {
      this.style.height = this.containerHeight();
    }

    if (this.state.oldDragItem || this.state.oldResizeItem) {
      if (layout) {
        this.syncWithNode(layout, ["x", "y"]);
      }
      const activeDrag = this.state.activeDrag;
      if (!activeDrag) {
        return;
      }
      const pos = calcGridItemPosition(
        this.getPositionParams(),
        activeDrag.x,
        activeDrag.y,
        activeDrag.w,
        activeDrag.h
      );

      this.placeholder.style.transform = `translate(${pos.left}px,${pos.top}px)`;
      this.placeholder.style.width = `${pos.width}px`;
      this.placeholder.style.height = `${pos.height}px`;
      return;
    }
    if (layout) {
      this.groupCollapsing.forEach((v) => v.forEach((l) => (layout[l.i] = l)));
      this.syncWithNode(layout);
    }
  }

  _collectLayout(): GridLayoutElementData[] {
    const layout: GridLayoutElementData[] = [];
    for (const child of this.children) {
      const isLayoutElement = child instanceof GridLayoutElement;
      const isGroup = child instanceof GridLayoutGroup;
      if ((!isLayoutElement && !isGroup) || !child.dataset.id) {
        continue;
      }

      const x = Number.parseInt(child.getAttribute("x") || "0");
      const y = Number.parseInt(child.getAttribute("y") || "0");
      const w = Number.parseInt(child.getAttribute("w") || "1");
      const h = Number.parseInt(child.getAttribute("h") || "1");

      const l: GridLayoutElementData = {
        i: child.dataset.id,
        static: child.hasAttribute("static"),
        drag: child.hasAttribute("drag"),
        resizable: child.hasAttribute("resizable"),
        bounded: child.hasAttribute("bounded"),
        x,
        y,
        w,
        h
      };
      layout.push(l);

      if (isGroup) {
        l.w = this.state.columns;
        l.isGroup = true;
      }
    }

    return layout;
  }

  _calculateLayout(
    layout: GridLayoutElementData[],
    oldLayout: GridLayoutElementData[]
  ) {
    const cols = this.state.columns;
    const correctedLayout = correctBounds(layout, { cols });
    layout = this.layout = this.state.allowOverlap
      ? correctedLayout
      : compact(correctedLayout, this.state.compactType, cols);
    this.setState({ layout });
    this.onLayoutMaybeChanged(layout, oldLayout);
    this.render();
  }

  /**
   * Applies changes to Grid Element with passed id
   * And then recalculates all positions of Grid Elements
   * @param  {String} id ID of the child.
   * @param  {Object} changes Changes to apply to child.
   */
  changeGridElement(id: string, changes: Partial<GridLayoutElementData>) {
    const layout = this._collectLayout();
    const oldLayout = cloneLayout(layout);
    const layoutItemIndex = layout.findIndex((item) => item.i === id);
    if (layoutItemIndex === -1) {
      return;
    }

    const layoutItem = layout[layoutItemIndex];
    layout[layoutItemIndex] = { ...layoutItem, ...changes };
    this._calculateLayout(layout, oldLayout);
  }

  static get observedAttributes() {
    return ["columns", "drag", "resizable", "responsive", "row-height"];
  }
}
