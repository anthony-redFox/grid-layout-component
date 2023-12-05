import GridLayoutElement from "./GridLayoutElement";

const template = document.createElement("template");
template.innerHTML = "<slot></slot><button>collapse</button>";
const css = new CSSStyleSheet();
// it is minify from gridLayoutGroupStyles.css
css.replaceSync(
  ":host{width:calc(var(--grid-element-width) * var(--grid-layout-cols,1) + (var(--grid-layout-cols,1) - 1) * var(--grid-element-margin-left));height:calc(var(--grid-element-height) * var(--element-h,1) + (var(--element-h,1) - 1) * var(--grid-element-margin-top));transform:translate(var(--grid-layout-padding-left),calc((var(--grid-element-height) + var(--grid-element-margin-top)) * var(--element-y,0) + var(--grid-layout-padding-top)))}"
);

export default class GridLayoutGroup extends GridLayoutElement {
  template = template;

  attributeChangedCallback(
    name: string,
    old: string | null,
    newValue: string | null
  ) {
    if (name === "collapsed" && (old === null || newValue === null)) {
      this.dispatchEvent(
        new CustomEvent("gridLayoutGroupCollapsed", {
          bubbles: true,
          detail: this.dataset.id
        })
      );
      return;
    }
    if (["x", "h", "w", "maximized"].includes(name) && newValue !== null) {
      this.removeAttribute(name);
      return;
    }
    super.attributeChangedCallback(name, old, newValue);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.shadow.adoptedStyleSheets = [...this.shadow.adoptedStyleSheets, css];
    const button = this.shadow.querySelector<HTMLElement>("button");
    if (!button) {
      return;
    }
    button.onclick = () =>
      this.hasAttribute("collapsed")
        ? this.removeAttribute("collapsed")
        : this.setAttribute("collapsed", "");
  }

  static get observedAttributes() {
    return ["x", "y", "h", "w", "maximized", "collapsed"];
  }
}
