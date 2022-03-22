/* eslint-env jest */
import GridLayout from "../../lib/GridLayout";

describe("Grid layout tests", function () {
  let gridLayout;

  beforeAll(() => {
    customElements.define("grid-layout", GridLayout);
  });

  beforeEach(() => {
    gridLayout = document.createElement("grid-layout");
    document.body.appendChild(gridLayout);
  });

  afterEach(() => {
    document.body.removeChild(gridLayout);
  });

  describe("Observed Attributes", () => {
    it("Should update the state when the resizable attribute is set", () => {
      gridLayout.setAttribute("resizable", "");

      expect(gridLayout.state).toHaveProperty("resizable", true);
    });

    it("Should update the state when the resizable attribute is removed", () => {
      gridLayout.setAttribute("resizable", "");
      gridLayout.removeAttribute("resizable");

      expect(gridLayout.state).toHaveProperty("resizable", false);
    });

    it("Should update the state when the drag attribute is changed", () => {
      gridLayout.setAttribute("drag", "");
      expect(gridLayout.state).toHaveProperty("drag", true);

      gridLayout.removeAttribute("drag");
      expect(gridLayout.state).toHaveProperty("drag", false);
    });
  });
});
