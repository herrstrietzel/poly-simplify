# poly-simplify
Simplify/reduce polylines/polygon vertices in JS

This library is *obviously* heavily inspired by Volodymyr Agafonkin's brilliant [»simplify.js«](https://github.com/mourner/simplify-js) library which has become kind of a standard.  

## Key differences from »simplify.js«
where simplify.js is rather aiming at handling insanely huge geodata-like polygons (... from the creator of leaflet) in the most performant way poly-simplify focuses more on visualisation contexts:  
1. **Convenience** – you can pass multiple input types such as  
  1.1 point-object arrays – so `[{x:0, y:10}, {x:1, y:20]`  
  1.2 stringified point data (as provided by SVG `<polygon>` `point` attributes – `0 10 1 20`  
  1.3 node property data (e.g SVG polygons) – constructors like SVGPoint are normalized to get a "decoupled" point array  
  1.4 nested arrays like `[[0 10], [1 20]]`  
  1.5 JSON stringified presentations of point arrays like `[{"x":0,"y":10},{"x":1,"y":20}]`  
2. **»Lossless« simplification** and optional – more advanced **»Ramer-Douglas-Peucker«** simplification  
   In a design context you may rather encounter perfectly unnecessary points – most importantly **collinear points** and **zero-length segments** added by a graphic application after a processing step or from a data visualization library.
   Removing only these excessive points is sometimes preferable, as it accuratly retains the geometric integrity


## Usage


