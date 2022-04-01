/* eslint-env jest */
import GridLayout from "../../lib/GridLayout";
import GridLayoutElement from "../../lib/GridLayoutElement";

describe("Grid layout tests", function () {
  let gridLayout;
  let gridLayoutElement;

  beforeAll(() => {
    customElements.define("grid-layout", GridLayout);
    customElements.define("grid-layout-element", GridLayoutElement);
  });

  beforeEach(() => {
    gridLayout = document.createElement("grid-layout");
    gridLayoutElement = document.createElement("grid-layout-element");
    document.body.appendChild(gridLayout);
    gridLayout.appendChild(gridLayoutElement);
  });

  afterEach(() => {
    document.body.removeChild(gridLayout);
  });

  it("Should be able to connect to the DOM multiple times", () => {
    const reconnectLayoutElement = () => {
      gridLayout.removeChild(gridLayoutElement);
      gridLayout.appendChild(gridLayoutElement);
    };

    expect(reconnectLayoutElement).not.toThrow();
  });
});
