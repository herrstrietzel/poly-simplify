import { normalizePointInput } from './inputs.js';
import { reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon, scalePolygon } from './geometry.js';

import { pathDataToPoly, minifyPathData, pathDataToD } from './parsePath.js';
//import { scalePolygon } from './scale.js';
import {getOutputData} from './ouput.js';


function polySimplify_core
    (pts, {
        tolerance = 0.1,
        removeColinear = true,
        useRDP = true,
        detectRegular = false,
        decimals = -1,
        maxVertices = Infinity,
        toMaxVertices = false,
        outputFormat = 'points',
        scale = 1,
        alignToZero = false,
        translateX = 0,
        translateY = 0,
        scaleToWidth = 0,
        scaleToHeight = 0,
        meta = false,
        // options for pathData output
        toRelative = false,
        toShorthands = false,
        minifyString = false
    } = {}) {


    // normalize
    pts = normalizePointInput(pts);
    //return pts;

    // if is compound
    let isCompound = pts[0].length > 1;


    /**
     * normalize to array for 
     * compound polygons or paths
     */

    let polyArr = isCompound ? pts : [pts];
    //console.log('polyArr', polyArr);

    let polyArrSimpl = [];

    for(let i=0,l=polyArr.length; i<l; i++ ){

        let pts = polyArr[i];

        // regular polygon detection
        let isRegular = false;

        // no points - exit
        if (!pts.length) return [];

        // collect simplified point array
        let ptsSmp = pts;

        // line segments or no simplification
        if (pts.length <= 2 || tolerance === 0) {
            polyArrSimpl.push(ptsSmp);
            continue;
        }


        /**
         * 0. reduce vertices to 
         * maximum limit
         * brute force but very fast for huge 
         * point arrays
         */
        if (toMaxVertices && maxVertices < Infinity) {
            //console.log('toMaxVertices', toMaxVertices);
            ptsSmp = reducePoints(pts, maxVertices);
            polyArrSimpl.push(ptsSmp);
            continue
        }


        /**
         * 1. lossless simplification
         * only remove zero-length segments/coinciding points
         * or flat segments
         */

        ptsSmp = removeColinear ? simplifyRemoveColinear(ptsSmp, isCompound) : ptsSmp;

        /**
         * check regular polygons
         * if it's regular:
         * we skip RDP simplification
         */

        if (detectRegular) {
            //console.log('detectRegular', detectRegular);
            isRegular = detectRegularPolygon(ptsSmp);
            if (isRegular) useRDP = false;
        }

        /**
         * 2. Ramer-Douglas-Peucker simplification
         */
        if (useRDP) {
            //console.log('useRDP', useRDP);
            ptsSmp = simplifyPolyRDP(ptsSmp, tolerance, isCompound);
        }

        // add to final pts array
        polyArrSimpl.push(ptsSmp);

    }


    let data = getOutputData(polyArr, polyArrSimpl, outputFormat, meta, decimals, toRelative, toShorthands, minifyString, scale, translateX, translateY, alignToZero, scaleToWidth, scaleToHeight);

    //dataArr.push(data);
    //console.log('data', data);

    // return either sub poly array or single data item
    return meta ? data : data.data;
}

export { polySimplify_core as polySimplify };
export { normalizePointInput, minifyPathData, pathDataToD };


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

export function simplifyRemoveColinear(pts, isCompound = false) {

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

        // add last vertice
        if (i === l - 1) {
            ptsSmp.push(pts[pts.length - 1]);
        }
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

export function simplifyPolyRDP(pts, tolerance = 0.1, isCompound = false) {
    if (pts.length <= 2) return pts;

    /**
     * approximate dimensions
     * adjust tolerance for 
     * very small polygons e.g geodata
     */

    let polyS = reducePoints(pts, 32)
    let { width, height } = getPolyBBox(polyS);
    let dimMax = Math.max(width, height);
    let scale = dimMax <= 10 ? 100000 / dimMax : 1
    tolerance /= scale;


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


