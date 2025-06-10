
[![npm version](https://img.shields.io/npm/v/poly-simplify)](https://www.npmjs.com/package/poly-simplify)
[![gzipped size](https://img.shields.io/bundlephobia/minzip/poly-simplify)](https://bundlephobia.com/result?p=poly-simplify)
[![minified size](https://img.shields.io/bundlephobia/min/poly-simplify)](https://bundlephobia.com/result?p=poly-simplify)
[![license](https://img.shields.io/npm/l/poly-simplify)](https://www.npmjs.com/package/poly-simplify)
[![CDN](https://img.shields.io/badge/CDN-jsDelivr-E84D3D?style=flat)](https://cdn.jsdelivr.net/npm/poly-simplify@latest/poly-simplify.min.js)

<p align="center" style="text-align:center">
<img width="100" height="100" style="display:inline-block" src="./favicon.svg">
</p> 

# poly-simplify
Simplify/reduce polylines/polygon vertices in JS

This library is *obviously* heavily inspired by Volodymyr Agafonkin's brilliant [»simplify.js«](https://github.com/mourner/simplify-js) library which has become kind of a standard.  


## Features
* **input normalisation:** you can pass pretty much any reasonable polygon notation such as: 
  * point-object arrays – so `[{x:0, y:10}, {x:1, y:20}]`  
  * stringified point data (as provided by SVG `<polygon>` `point` attributes – `0 10 1 20`  
  * **nested arrays** like `[[0 10], [1 20]]`  
  * **JSON** stringified presentations of point arrays like `[{"x":0,"y":10},{"x":1,"y":20}]`  
  * **SVG** pathdata: `M0 0 100 200z`

* **Relative Quality threshold:** simplification is controlled via a *relative* quality parameter similar to raster image compression logics – super tiny geodata polygons won't get distorted

* **SVG**
  * node property data (e.g SVG polygons) – constructors like SVGPoint are normalized to get a "decoupled" point array  

* **Supports compound shapes/paths** intersecting polygons interpreted as cut-out shapes

* **Dynamic decimal rounding** by default decimals are adjusted to match tiny polygon's dimensions 

* **scaling and alignment:** tiny polygons can be scaled to a reasonable size for demonstration purposes. You can also realign coordinates to zero origin


## Simplification methods
* "RC" - remove colinear: removes only colinear or zero-length segments. This method can be concidered "lossless" and is ideal for polygons with a lot of excessive point added by a graphic editor (e.g due too shape merging)
* "RD" - simplify by radial distance: removes short segments. Ideal for more aggressive simplifications
* "RDP" – Ramer-Douglas-Peucker algorithm
* "VW" – Visvalingam-Whyatt algorithm
* max vertice simplification: simply omitts vertices to get the desired point count




## 1. Usage

**1.1. IIFE**
```
<script src="https://cdn.jsdelivr.net/npm/poly-simplify@latest/dist/poly-simplify.min.js"></script>

<script>
  let pts = [{x:0, y:10}, {x:1, y:20}, {x:2, y:30}];
  let polyPtsSimplified = polySimplify(pts);
</script>
```

**1.2. ESM**
```
<script type="module">
  import {polySimplify} from 'https://cdn.jsdelivr.net/npm/poly-simplify@latest/+esm';

  let pts = [{x:0, y:10}, {x:1, y:20}, {x:2, y:30}];
  let polyPtsSimplified = polySimplify(pts)
</script>
```

### Options

| param | default | type | effect |
| -- | -- | -- | -- |
| quality | `0.5` | number/string | simplification tolerance: accepts numeric value from 0-1 for relative quality, absolute pixel thresholds adding px unit to string `1px` or maximum vertices specified via `v` unit like so `150v` |
| RDP | `true` | Boolean | Applies Ramer-Douglas-Peucker simplification |  
| VW | `true` |  Boolean | Visvalingam-Whyatt simplification |  
| RD | `true` | Boolean | Radial Distance simplification |  
| output | `points` | string | output result: 1. "points"= point object array  2. "path"= SVG path data string 3. "pathdata" = pathdata array 4. "json"= JSON string 5. "pointString" = flat point string (as used for polygon points attribute) |
| meta | `false`  | Boolean | return additional data like: vertices counts (original and simplified) – this option is mostly for debugging e.g for integrety checks  |
| skipPoints | `false`  | Boolean | simplify by reducing number of vertices to a max limit | 
| maxPoints | `0` | Number | Max points limit for `useMax` option |
| decimals | `-1` | Number | round coordinates to decimals |


###  Simplifier Webapp
You can easily test polySimplify using the [**webapp**](https://herrstrietzel.github.io/poly-simplify/)  

![Webapp](demo/img/app.png )

You can test all settings and generate sample SVG files for demo purposes:
* output object (point array, nested array, SVG or JSON)
* SVG snippet
* JS code snippet






