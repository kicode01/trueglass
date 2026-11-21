const SVG_NS = "http://www.w3.org/2000/svg";

let sharedDefs: SVGDefsElement | undefined;

export function svgEl(name: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

/** Returns the singleton hidden `<defs>` container where every SVG glass filter lives. */
export function svgContainer(): SVGDefsElement {
  if (sharedDefs?.isConnected) return sharedDefs;
  const root = svgEl("svg", { width: 0, height: 0, "aria-hidden": "true" });
  root.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none";
  sharedDefs = svgEl("defs", {}) as SVGDefsElement;
  root.append(sharedDefs);
  (document.body || document.documentElement).append(root);
  return sharedDefs;
}
