import draggable from "./draggable";
import resizable from "./resizeble";
import { calcGridItemWHPx, clamp } from "./calculateUtils";

import type { DraggableData } from "./draggable";
import type { ResizeHandlerOptions } from "./resizeble";

const template = document.createElement("template");
template.innerHTML =
  '<slot></slot><div class="resizable-handle resizable-handle-se"></div>';

const css = new CSSStyleSheet();
// it is minify from gridLayoutElementStyles.css
// @ts-expect-error global
css.replaceSync(
  ':host{display:block;width:calc(var(--grid-element-width) * var(--element-w,1) + (var(--element-w,1) - 1) * var(--grid-element-margin-left));height:calc(var(--grid-element-height) * var(--element-h,1) + (var(--element-h,1) - 1) * var(--grid-element-margin-top));transform:translate(calc((var(--grid-element-width) + var(--grid-element-margin-left)) * var(--element-x,0) + var(--grid-layout-padding-left)),calc((var(--grid-element-height) + var(--grid-element-margin-top)) * var(--element-y,0) + var(--grid-layout-padding-top)));position:absolute;box-sizing:border-box;transition:transform .2s ease,visibility .1s linear}:host([maximize]){position:sticky;width:calc(100% - var(--grid-layout-padding-left) * 2);height:calc(100% - var(--grid-layout-padding-top) * 2);transform:translate(var(--grid-layout-padding-left),var(--grid-layout-padding-top));transition:width .2s ease,height .2s ease;z-index:3}:host([resizable]) .resizable-handle{position:absolute;width:20px;height:20px}:host([resizable=active]){z-index:1;will-change:width,height}:host([drag=active]){transition:none;z-index:3;will-change:transform}:host([resizable]) .resizable-handle:before{content:"";position:absolute;right:3px;bottom:3px;width:5px;height:5px;border-right:2px solid rgba(0,0,0,.4);border-bottom:2px solid rgba(0,0,0,.4)}:host([resizable]) .resizable-handle.resizable-handle-se{bottom:0;right:0;cursor:se-resize}'
);

interface GridLayoutElementState {
  h: number;
  w: number;
  x: number;
  y: number;
  dragging?: {
    top: number;
    left: number;
    bottomBoundary?: number;
    rightBoundary?: number;
  };
}

export interface gridLayoutElementDragDetail {
  key: string;
  life: "start" | "move" | "end";
  top: number;
  left: number;
}

export interface gridLayoutElementResizeDetail {
  key: string;
  life: "start" | "move" | "end";
  width: number;
  height: number;
}

export default class GridLayoutElement extends HTMLElement {
  declare shadow: ShadowRoot;
  template = template;
  sheet = new CSSStyleSheet();
  transformScale = 1;
  minW = 1;
  maxW = Infinity;
  minH = 1;
  maxH = Infinity;
  state: GridLayoutElementState = { h: 1, w: 1, x: 0, y: 0 };

  setState(update: Partial<GridLayoutElementState>) {
    Object.assign(this.state, update);
  }

  /**
   * onDragStart event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node, delta and position information
   */
  onDragStart() {
    if (
      this.hasAttribute("static") ||
      this.hasAttribute("maximize") ||
      this.getAttribute("drag") === "false"
    ) {
      return false;
    }
    const transformScale = this.transformScale;
    const newPosition: GridLayoutElementState["dragging"] = { top: 0, left: 0 };

    // TODO: this wont work on nested parents
    const { offsetParent } = this;
    if (!offsetParent) return;
    const parentRect = offsetParent.getBoundingClientRect();
    const clientRect = this.getBoundingClientRect();
    const cLeft = clientRect.left / transformScale;
    const pLeft = parentRect.left / transformScale;
    const cTop = clientRect.top / transformScale;
    const pTop = parentRect.top / transformScale;
    newPosition.left = cLeft - pLeft + offsetParent.scrollLeft;
    newPosition.top = cTop - pTop + offsetParent.scrollTop;

    if (this.hasAttribute("bounded")) {
      const style = window.getComputedStyle(this);
      const rowHeight = Number.parseInt(
        style.getPropertyValue("--grid-element-height")
      );
      const colWidth = Number.parseInt(
        style.getPropertyValue("--grid-element-width")
      );
      const marginLeft = Number.parseInt(
        style.getPropertyValue("--grid-element-margin-left")
      );
      const marginTop = Number.parseInt(
        style.getPropertyValue("--grid-element-margin-top")
      );
      const { w, h } = this.state;

      newPosition.bottomBoundary =
        offsetParent.clientHeight - calcGridItemWHPx(h, rowHeight, marginTop);
      newPosition.rightBoundary =
        offsetParent.clientWidth - calcGridItemWHPx(w, colWidth, marginLeft);
    }

    const event = new CustomEvent("gridLayoutElementDrag", {
      bubbles: true,
      cancelable: true,
      detail: {
        key: this.dataset.id,
        life: "start"
      }
    });
    this.dispatchEvent(event);

    if (event.defaultPrevented) {
      return false;
    }

    this.setState({ dragging: newPosition });
    this.setAttribute("drag", "active");
  }

  /**
   * onDrag event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node, delta and position information
   */
  onDrag(e: MouseEvent | TouchEvent, { deltaX, deltaY }: DraggableData) {
    const dragging = this.state.dragging;
    if (!dragging) {
      return;
    }

    let top = dragging.top + deltaY;
    let left = dragging.left + deltaX;

    // Boundary calculations; keeps items within the grid
    if (dragging.bottomBoundary && dragging.rightBoundary) {
      const { bottomBoundary, rightBoundary } = dragging;
      top = clamp(top, 0, bottomBoundary);
      left = clamp(left, 0, rightBoundary);
    }
    this.setState({ dragging: { ...dragging, top, left } });
    this.style.transform = `translate(${Math.round(left)}px,${Math.round(
      top
    )}px)`;

    this.dispatchEvent(
      new CustomEvent("gridLayoutElementDrag", {
        bubbles: true,
        detail: {
          key: this.dataset.id,
          life: "move",
          top,
          left
        }
      })
    );
  }

  /**
   * onDragStop event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node, delta and position information
   */
  onDragStop() {
    if (!this.state.dragging) {
      return;
    }
    const { left, top } = this.state.dragging;
    this.setState({ dragging: undefined });
    this.removeAttribute("style");
    this.setAttribute("drag", "");

    this.dispatchEvent(
      new CustomEvent("gridLayoutElementDrag", {
        bubbles: true,
        detail: {
          key: this.dataset.id,
          life: "end",
          top,
          left
        }
      })
    );
  }

  /**
   * onResizeStop event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node and size information
   */
  onResizeStop() {
    this.removeAttribute("style");
    this.setAttribute("resizable", "");
    this.dispatchEvent(
      new CustomEvent("gridLayoutElementResize", {
        bubbles: true,
        detail: {
          key: this.dataset.id,
          life: "end"
        }
      })
    );
  }

  /**
   * onResizeStart event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node and size information
   */
  onResizeStart():
    | false
    | {
        minConstraints: [number, number];
        maxConstraints: [number, number];
        transformScale: number;
      } {
    if (
      this.hasAttribute("static") ||
      this.hasAttribute("maximize") ||
      this.getAttribute("resizable") === "false"
    ) {
      return false;
    }

    const event = new CustomEvent("gridLayoutElementResize", {
      bubbles: true,
      detail: {
        key: this.dataset.id,
        life: "start"
      }
    });
    this.dispatchEvent(event);
    if (event.defaultPrevented) {
      return false;
    }

    this.setAttribute("resizable", "active");

    const style = window.getComputedStyle(this);
    const rowHeight = Number.parseInt(
      style.getPropertyValue("--grid-element-height")
    );
    const colWidth = Number.parseInt(
      style.getPropertyValue("--grid-element-width")
    );
    const marginLeft = Number.parseInt(
      style.getPropertyValue("--grid-element-margin-left")
    );
    const marginTop = Number.parseInt(
      style.getPropertyValue("--grid-element-margin-top")
    );
    const cols = Number.parseInt(style.getPropertyValue("--grid-layout-cols"));

    const { x } = this.state;
    const minWidth = calcGridItemWHPx(this.minW, colWidth, marginLeft);
    const minHeight = calcGridItemWHPx(this.minH, rowHeight, marginTop);
    const maxWidth = calcGridItemWHPx(
      Math.min(this.maxW, cols - x),
      colWidth,
      marginLeft
    );
    const maxHeight = calcGridItemWHPx(this.maxH, rowHeight, marginTop);

    return {
      minConstraints: [minWidth, minHeight],
      maxConstraints: [maxWidth, maxHeight],
      transformScale: this.transformScale
    };
  }

  /**
   * onResize event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node and size information
   */
  onResize(e: MouseEvent | TouchEvent, callbackData: ResizeHandlerOptions) {
    const { size } = callbackData;
    this.style.width = `${size.width}px`;
    this.style.height = `${size.height}px`;

    this.dispatchEvent(
      new CustomEvent("gridLayoutElementResize", {
        bubbles: true,
        detail: {
          key: this.dataset.id,
          life: "move",
          width: size.width,
          height: size.height
        }
      })
    );
  }

  makeDraggable() {
    draggable(this, {
      onStart: () => this.onDragStart(),
      onDrag: (e, data) => this.onDrag(e, data),
      onStop: () => this.onDragStop(),
      scale: this.transformScale
    });
  }

  makeResizable() {
    const element = this.shadow.querySelector<HTMLElement>(".resizable-handle");
    if (!element) {
      return;
    }
    resizable(this, element, {
      stop: () => this.onResizeStop(),
      start: () => this.onResizeStart(),
      resize: (...arg) => this.onResize(...arg)
    });
  }

  connectedCallback() {
    this.shadow = this.attachShadow({ mode: "open" });
    this.shadow.appendChild(this.template.content.cloneNode(true));
    // @ts-expect-error global
    this.shadow.adoptedStyleSheets = [css, this.sheet];
    this.makeDraggable();
    this.makeResizable();
  }

  attributeChangedCallback(
    name: string,
    old: string | null,
    newValue: string | null
  ) {
    if ("x" === name || "y" === name || "h" === name || "w" === name) {
      this.state[name] = Number.parseInt(newValue || "");
      this.setVaribles();
    } else if (name === "maximize") {
      this.dispatchEvent(
        new CustomEvent("gridLayoutElementMaximaze", {
          bubbles: true,
          detail: newValue !== null
        })
      );
    }
  }

  setVaribles() {
    // @ts-expect-error global
    this.sheet.replaceSync(
      `:host{--element-x: ${this.state.x};--element-y: ${this.state.y};--element-h: ${this.state.h};--element-w: ${this.state.w};}`
    );
  }

  static get observedAttributes() {
    return ["x", "y", "h", "w", "maximize"];
  }
}
