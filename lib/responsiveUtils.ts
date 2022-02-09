/**
 * Given a width, find the highest breakpoint that matches is valid for it (width > breakpoint).
 *
 * @param  {Object} breakpoints Breakpoints object (e.g. {lg: 1200, md: 960, ...})
 * @param  {Number} width Screen width.
 * @return {String}       Highest breakpoint that is less than width.
 */
export function getBreakpointFromWidth(
  breakpoints: Record<string, number>,
  width: number
): string {
  const sorted = sortBreakpoints(breakpoints);
  let matching = sorted[0];
  for (let i = 1, len = sorted.length; i < len; i++) {
    const breakpointName = sorted[i];
    if (width > breakpoints[breakpointName]) matching = breakpointName;
  }
  return matching;
}

/**
 * Given a breakpoint, get the # of cols set for it.
 * @param  {String} breakpoint Breakpoint name.
 * @param  {Object} cols       Map of breakpoints to cols.
 * @return {Number}            Number of cols.
 */
export function getColsFromBreakpoint(
  breakpoint: string,
  cols: Record<string, number>
): number {
  if (!cols[breakpoint]) {
    throw new Error(
      "ResponsiveReactGridLayout: `cols` entry for breakpoint " +
        breakpoint +
        " is missing!"
    );
  }
  return cols[breakpoint];
}

/**
 * Given breakpoints, return an array of breakpoints sorted by width. This is usually
 * e.g. ['xxs', 'xs', 'sm', ...]
 *
 * @param  {Object} breakpoints Key/value pair of breakpoint names to widths.
 * @return {Array}              Sorted breakpoints.
 */
function sortBreakpoints(breakpoints: Record<string, number>): string[] {
  return Object.keys(breakpoints).sort(
    (a, b) => breakpoints[a] - breakpoints[b]
  );
}
