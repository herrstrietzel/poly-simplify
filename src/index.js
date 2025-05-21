import { normalizePointInput } from './inputs.js';
import { reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon } from './geometry.js';

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
            ptsSmp = pathData
        }
        if (output.toLowerCase() === 'json') ptsSmp = JSON.stringify(ptsSmp)

        return { data: ptsSmp, count: total, original: pts.length, areaOriginal, areaptsSmp, areaDiff }
    }

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

export { polySimplify_core as polySimplify };


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

export function simplifyPolyLossless(pts) {

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

export function simplifyPolyRDP(pts, tolerance = 0.5) {
    if (pts.length <= 2) return pts;


    /**
     * approximate dimensions
     * adjust tolerance for 
     * very small polygons e.g geodata
     */

    let polyS = reducePoints(pts, 32)
    let { width, height } = getPolyBBox(polyS);
    let dimMax = Math.max(width, height);
    //let scale = dimAvg <= 10 ? 100000 / dimAvg : 1
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

    //console.log('simplifyPolyRDP', scans);

    /*
    let areaPointRatio2 = area/ptsSmp.length
    console.log('areaPointRatio2', areaPointRatio2);
    */


    return ptsSmp;
}


