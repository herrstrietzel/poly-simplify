(function (exports) {
    'use strict';

    function normalizePointInput(pts) {

        // convert to point object array helper
        const toPointArray = (pts) => {
            let ptArr = [];
            for (let i = 1, l = pts.length; i < l; i += 2) {
                ptArr.push({ x: pts[i - 1], y: pts[i] });
            }
            return ptArr;
        };

        /**
         * 1. check if input is already 
         * a point object array
         */
        let isPointArray = pts[0].x || false;

        // 1.1 check if point object array but tied to an API constructor e.g SVGPoint
        let type = isPointArray && typeof pts[0] === 'object' ? (pts[0].constructor.name ? pts[0].constructor.name : 'object') : null;

        // decouple from constructor object type - e.g SVGPoints
        if (isPointArray && type !== 'object') pts = [...pts].map(pt => { return { x: pt.x, y: pt.y } });

        // normalized return array
        if (isPointArray) return pts;

        /**
         * 2. input is string - 
         * e.g from polygon points attribute
         */

        let isString = typeof pts === "string";

        // 2.1 check if it's JSON
        let isJSON = isString ? pts.startsWith('[{"x":') : false;

        // 2.1.1: if JSON – parse data
        if (isJSON) {
            pts = JSON.parse(pts);
            return pts;
        }

        // 2.2: stringified poly notation – split to array
        if (isString) {
            pts = pts.trim().split(/,| /).filter(Boolean).map(Number);

            // 2.3: nonsense string input
            let hasNaN = pts.filter(pt => isNaN(pt)).length;
            if (hasNaN) {
                console.warn("input doesn't contain point data – please, check your input structure for syntax errors");
                return [];
            }
        }

        /**
         * 3. is array
         * either a flat or a nested one
         */
        let isArray = Array.isArray(pts);

        // 3.1: is nested array – x/y grouped in sub arrays
        let isNested = isArray && pts[0].length === 2;

        // convert to point array
        if (isNested){
            pts = pts.map((pt) => {
                return { x: pt[0], y: pt[1] };
            });
        }

        // 3.2: flat array – group x/y

        let isFlat = !Array.isArray(pts[0]) && !pts[0].hasOwnProperty('x');
        if (isFlat) pts = toPointArray(pts);

        return pts;
    }

    function getSquareDistance(p1, p2) {
        return (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
    }

    function detectRegularPolygon(pts){
        let lastDist=getSquareDistance(pts[0], pts[1]);
        let isRegular = true;

        for(let i=3,l=pts.length; i<l; i++){
            let pt1= pts[i-1];
            let pt2 = pts[i];
            let dist = getSquareDistance(pt1, pt2);
            let distDiff = 100/lastDist * Math.abs(lastDist-dist);

            if(distDiff>0.1) {
                return false;
            }

            lastDist = dist;
        }
        return isRegular;
    }

    /**
     * reduce polypoints
     * for sloppy dimension approximations
     */
    function reducePoints(points, maxPoints = 48) {
        if (!Array.isArray(points) || points.length <= maxPoints) return points;

        // Calculate how many points to skip between kept points
        let len = points.length;
        let step = len / maxPoints;
        let reduced = [];

        for (let i = 0; i < maxPoints; i++) {
            reduced.push(points[Math.floor(i * step)]);
        }

        let lenR = reduced.length;
        // Always include the last point to maintain path integrity
        if (reduced[lenR - 1] !== points[len - 1]) {
            reduced[lenR - 1] = points[len - 1];
        }

        return reduced;
    }

    function getPolygonArea(points, absolute = false) {
        let area = 0;
        for (let i = 0, len = points.length; len && i < len; i++) {
            let addX = points[i].x;
            let addY = points[i === points.length - 1 ? 0 : i + 1].y;
            let subX = points[i === points.length - 1 ? 0 : i + 1].x;
            let subY = points[i].y;
            area += addX * addY * 0.5 - subX * subY * 0.5;
        }
        return absolute ? Math.abs(area) : area;
    }

    function getPolyBBox(vertices) {
        let xArr = vertices.map(pt => pt.x);
        let yArr = vertices.map(pt => pt.y);
        let left = Math.min(...xArr);
        let right = Math.max(...xArr);
        let top = Math.min(...yArr);
        let bottom = Math.max(...yArr);
        let bb = {
            x: left,
            left: left,
            right: right,
            y: top,
            top: top,
            bottom: bottom,
            width: right - left,
            height: bottom - top
        };

        return bb;
    }

    function polySimplify_core
        (pts, {
            tolerance = 0.5,
            useRDP = false,
            decimals = -1,
            maxVertices = Infinity,
            useMax = false,
            output = 'points',
            meta = false
        } = {}) {

        // normalize
        pts = normalizePointInput(pts);

        // collect simplified point array
        let ptsSmp = [];

        // output helper
        const getOutputData = (ptsSmp, output = 'points', pts, getArea = false) => {
            let total = ptsSmp.length;

            let areaOriginal = getArea ? getPolygonArea(pts, true) : 0;
            let areaptsSmp = getArea ? getPolygonArea(ptsSmp, true) : 0;

            // area deviation in percent
            let areaDiff = getArea ? +(100 / areaptsSmp * Math.abs(areaOriginal - areaptsSmp)).toFixed(3) : 0;

            /**
             * "points" = point array 
             * "pointstring" = point string 
             * "path" = svg pathdata string 
             * "pathData" = svg pathdata array 
             * "json" = JSON string
             */
            if (output === 'pointstring' || output === 'string') ptsSmp = ptsSmp.map(pt => `${pt.x} ${pt.y}`).join(' ');
            if (output === 'path' || output === 'd') ptsSmp = 'M' + ptsSmp.map(pt => `${pt.x} ${pt.y}`).join(' ');
            if (output === 'pathData' || output === 'pathdata') {
                let pathData = [
                    { type: 'M', values: [ptsSmp[0].x, ptsSmp[0].y] },
                    ...ptsSmp.slice(1).map(pt => { return { type: 'L', values: [pt.x, pt.y] } })
                ];
                ptsSmp = pathData;
            }
            if (output.toLowerCase() === 'json') ptsSmp = JSON.stringify(ptsSmp);

            return { data: ptsSmp, count: total, original: pts.length, areaOriginal, areaptsSmp, areaDiff }
        };

        let data = getOutputData(pts, output, pts, meta);

        // line segments or no simplification
        if (pts.length <= 2 || tolerance === 0) {
            return meta ? data : data.data;
        }

        /**
         * 0. reduce vertices to 
         * maximum limit
         * brute force but very fast for huge 
         * point arrays
         */
        if( useMax && maxVertices<Infinity){
            ptsSmp = reducePoints(pts, maxVertices);
            data = getOutputData(ptsSmp, output, pts, meta);
            return data;
        }

        /**
         * 1. lossless simplification
         * only remove zero-length segments/coinciding points
         * or flat segments
         */

        ptsSmp = simplifyPolyLossless(pts);

        /**
         * check regular polygons
         * if it's regular:
         * we skip RDP simplification
         */

        let isRegular = detectRegularPolygon(ptsSmp);
        if(isRegular) useRDP=false;

        /**
         * 2. Ramer-Douglas-Peucker simplification
         */

        if (useRDP) {
            ptsSmp = simplifyPolyRDP(ptsSmp, tolerance);
        }

        if (decimals > -1) {
            ptsSmp = ptsSmp.map(pt => { return { x: +pt.x.toFixed(decimals), y: +pt.y.toFixed(decimals) } });
        }

        /**
         * "points" = point array 
         * "pointstring" = point string 
         * "path" = svg pathdata string 
         * "pathData" = svg pathdata array 
         * "json" = JSON string
         */

        data = getOutputData(ptsSmp, output, pts, meta);
        console.log('data', data);

        return meta ? data : data.data;
    }

    // Browser global
    if (typeof window !== 'undefined') {
        window.polySimplify = polySimplify_core;
    }

    /**
    * "lossless" simplification:
    * remove zero length or 
    * horizontal or vertical segments
    * geometry should be perfectly retained
    */

    function simplifyPolyLossless(pts) {

        let pt0 = pts[0];
        let ptsSmp = [pt0];

        for (let i = 2, l = pts.length; i < l; i++) {
            let pt1 = pts[i - 1];
            let pt2 = pts[i];
            let squareDistance = 0;

            // collinear segments
            if ((pt0.x === pt1.x && pt0.y !== pt1.y) || (pt0.x !== pt1.x && pt0.y === pt1.y)) {

                // not all segments are flat - add mid point
                if (!(pt2.x === pt1.x && pt2.y !== pt1.y) && !(pt2.x !== pt1.x && pt2.y === pt1.y)) {
                    ptsSmp.push(pt1);
                }
                pt0 = pt1;
                continue
            }

            // not zero length or vertical or horizontal
            if (!(pt0.x === pt1.x && pt0.y === pt1.y) &&
                !(pt0.x === pt1.x && pt0.y !== pt1.y) &&
                !(pt0.x !== pt1.x && pt0.y === pt1.y)) {

                // get current square distance
                squareDistance = getSquareDistance(pt1, pt2);

                // check area to detect flat segments
                let area = getPolygonArea([pt0, pt1, pt2], true);
                let areaThreshold = squareDistance * 0.01;
                let isFlat = !area ? true : (squareDistance ? area < areaThreshold : true);

                if (!isFlat) {
                    ptsSmp.push(pt1);
                }
            }

            pt0 = pt1;
        }

        return ptsSmp;
    }

    /**
     * Ramer-Douglas-Peucker-Algorithm
     * for polyline simplification
     * See also: 
     * https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
     * and https://karthaus.nl/rdp/
     */

    function simplifyPolyRDP(pts, tolerance = 0.5) {
        if (pts.length <= 2) return pts;

        /**
         * approximate dimensions
         * adjust tolerance for 
         * very small polygons e.g geodata
         */

        let polyS = reducePoints(pts, 32);
        let { width, height } = getPolyBBox(polyS);
        let dimMax = Math.max(width, height);

        let scale = 50000/dimMax**2;
        tolerance /= scale;

        console.log('scale', scale, tolerance);

        /*
        let area = getPolygonArea(polyS, true);
        let areaPointRatio = area/pts.length
        console.log('areaPointRatio', areaPointRatio);
        */

        // Square distance from point to segment
        const segmentSquareDistance = (p, p1, p2) => {
            let x = p1.x, y = p1.y;
            let dx = p2.x - x, dy = p2.y - y;

            if (dx !== 0 || dy !== 0) {
                let t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
                if (t > 1) {
                    x = p2.x;
                    y = p2.y;
                } else if (t > 0) {
                    x += dx * t;
                    y += dy * t;
                }
            }

            return (p.x - x) ** 2 + (p.y - y) ** 2;
        };

        // start collecting ptsSmp polyline
        let ptsSmp = [pts[0]];

        // create processing stack
        let stack = [];
        stack.push([0, pts.length - 1]);

        while (stack.length > 0) {
            let [first, last] = stack.pop();
            let maxDist = tolerance;
            let index = -1;

            // Find point with maximum distance
            for (let i = first + 1; i < last; i++) {
                let currentDist = segmentSquareDistance(pts[i], pts[first], pts[last]);
                if (currentDist > maxDist) {
                    index = i;
                    maxDist = currentDist;
                }
            }

            // If max distance > tolerance, split and process
            if (maxDist > tolerance) {
                stack.push([index, last]);
                stack.push([first, index]);
            } else {
                ptsSmp.push(pts[last]);
            }
        }

        /*
        let areaPointRatio2 = area/ptsSmp.length
        console.log('areaPointRatio2', areaPointRatio2);
        */

        return ptsSmp;
    }

    exports.polySimplify = polySimplify_core;
    exports.simplifyPolyLossless = simplifyPolyLossless;
    exports.simplifyPolyRDP = simplifyPolyRDP;

})(this["poly-simplify"] = this["poly-simplify"] || {});
