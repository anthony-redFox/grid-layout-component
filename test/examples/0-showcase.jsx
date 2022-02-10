// @flow
import * as React from "react";
import _ from "lodash";
import GridLayout from '../../lib/GridLayout';
import GridLayoutElement from '../../lib/GridItem';

customElements.define("grid-layout-element", GridLayoutElement);
customElements.define("grid-layout", GridLayout);

export default class ShowcaseLayout extends React.Component {
  static defaultProps = {
    className: "layout",
    rowHeight: 30,
    onLayoutChange: function() {},
    cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  };

  state = {
    currentBreakpoint: "lg",
    compactType: "vertical",
    mounted: false,
    layouts: { lg: generateLayout() }
  };

  componentDidMount() {
    this.setState({ mounted: true });
    this.nv.addEventListener("layoutChanged", this.handle);
  }

  componentWillUnmount() {
    this.nv.removeEventListener("layoutChanged", this.handle);
  }

  handle = (event) => this.onLayoutChange(event.detail.layout);

  generateDOM() {
    return _.map(this.state.layouts.lg, function(l, i) {
      return (
        <grid-layout-element data-id={i} key={i} static={l.static ? '' : null}
          x={l.x || 0} y={l.y || 0} w={l.w || 1} h={l.h || 1}
        >
          {l.static ? (
            <span
              className="text"
              title="This item is static and cannot be removed or resized."
            >
              Static - {i}
            </span>
          ) : (
            <span className="text">{i}</span>
          )}
        </grid-layout-element>
      );
    });
  }

  onBreakpointChange = (breakpoint) => {
    this.setState({
      currentBreakpoint: breakpoint
    });
  };

  onCompactTypeChange = () => {
    const { compactType: oldCompactType } = this.state;
    const compactType =
      oldCompactType === "horizontal"
        ? "vertical"
        : oldCompactType === "vertical"
        ? null
        : "horizontal";
    this.setState({ compactType });
  };

  onLayoutChange = (layout, layouts) => {
    this.props.onLayoutChange(layout, layouts);
  };

  onNewLayout = () => {
    this.setState({
      layouts: { lg: generateLayout() }
    });
  };

  render() {
    // eslint-disable-next-line no-unused-vars
    return (
      <div>
        <div>
          Current Breakpoint: {this.state.currentBreakpoint} (
          {this.props.cols[this.state.currentBreakpoint]} columns)
        </div>
        <div>
          Compaction type:{" "}
          {_.capitalize(this.state.compactType) || "No Compaction"}
        </div>
        <button onClick={this.onNewLayout}>Generate New Layout</button>
        <button onClick={this.onCompactTypeChange}>
          Change Compaction Type
        </button>
        <grid-layout row-height={this.props.rowHeight} ref={elem => this.nv = elem}>
          {this.generateDOM()}
        </grid-layout>
      </div>
    );
  }
}

function generateLayout() {
  return _.map(_.range(0, 25), function(item, i) {
    var y = Math.ceil(Math.random() * 4) + 1;
    return {
      x: Math.round(Math.random() * 5) * 2,
      y: Math.floor(i / 6) * y,
      w: 2,
      h: y,
      i: i.toString(),
      static: Math.random() < 0.05
    };
  });
}

if (process.env.STATIC_EXAMPLES === true) {
  import("../test-hook.jsx").then(fn => fn.default(ShowcaseLayout));
}
