import { reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon, scalePolygon, sortPolygonLeftTopFirst, isClosedPolygon } from './geometry.js';

/**
* "lossless" simplification:
* remove zero length or 
* horizontal or vertical segments
* geometry should be perfectly retained
*/


export function simplifyRC(pts, quality = 1, shiftStart = true) {

    //console.log('simplifyRC');
    if (pts.length < 3) return pts;

    let l = pts.length;

    // starting point
    let M = pts[0];

    // last point
    let Z = pts[l - 1];

    // remove unnecessary closing point
    if (M.x === Z.x && M.y === Z.y) {
        //console.log('remove last point');
        pts.pop();
        l--
        Z = pts[l - 1];
    }

    // init new point array
    let ptsSmp = [M];
    let pt0 = M;
    let pt1, pt2;


    // approximate dimensions for relative threshold
    let ptsR = reducePoints(pts, 32)
    let polyBB = getPolyBBox(ptsR);
    //let area0 = getPolygonArea(ptsR);
    //let areaThresh = area0 / 2000

    let { width, height } = polyBB;
    let dimAvg = (width + height) / 2;

    // adjust tolerance based on points-per-dimension ratio
    let div = quality ? l * 5 * quality : 250
    let tolerance = dimAvg / div;
    let tolerance2 = tolerance * 2.5

    //console.log(tolerance, div);
    //let lastrat = 1

    let dx0 = null;
    let dy0 = null;

    /*
    // get average square distance
    let dists = []
    let distAV = 0

    //let ptS = pt0;
    let maxPoints = 24;
    let step = Math.floor(l / maxPoints) || 1;
    console.log('step', step);
    */


    /*
    for (let i = 1; i < l; i+=step) {
        pt0 = pts[i - 1];
        pt1 = pts[i];
        let dist = getSquareDistance(pt0, pt1)
        distAV+=dist
        dists.push(dist)
        //ptS = pt1
    }
    distAV = distAV/(maxPoints+1)
    //console.log('dists', dists, distAV, tolerance);

    tolerance = distAV*0.01
    console.log(tolerance);
    */


    // loop through vertices by triangles
    for (let i = 2; i < l; i++) {
        pt1 = pts[i - 1];
        pt2 = pts[i];
        let isLast = i === l - 1;


        /**
         * 1. Skip zero-length segments
         */
        if ((pt1.x === pt0.x && pt1.y === pt0.y) || (pt1.x === pt2.x && pt1.y === pt2.y)) {
            //console.log('zero');
            continue;
        }

        /**
         * 2. Check for perfectly flat
         * vertical/horizontal segments
         */
        let isVertical = (pt0.x === pt1.x);
        let isHorizontal = (pt0.y === pt1.y);


        if (isVertical || isHorizontal) {

            let isVertical2 = (pt1.x === pt2.x);
            let isHorizontal2 = (pt1.y === pt2.y);

            if (((isVertical && isVertical2) || (isHorizontal && isHorizontal2))) {
                //console.log('skip vertical or horizontal', isLast);

                // perfectly flat segment - skip
                if (!isLast) continue;

                // flat but last – add last and skip colinearity check
                if (isLast && M.x !== pt2.x && M.y !== pt2.y) {
                    //console.log('add last', M, pt2);

                    //if(pt2.x!==)
                    ptsSmp.push(pt2)
                    continue
                }

            }
        }

        /**
         * 3. Check colinear segments 
         * via cross product check for colinearity
         * e.g on diagonals
         */

        if (!dx0 && !dy0) {
        }
        dx0 = pt1.x - pt0.x;
        dy0 = pt1.y - pt0.y;


        //let rat0 = dx0 / dy0 || 1;

        let dx1 = pt2.x - pt1.x;
        let dy1 = pt2.y - pt1.y;
        //let dx1 = pt2.x - pt0.x;
        //let dy1 = pt2.y - pt0.y;


        let cross = Math.abs(dx0 * dy1 - dy0 * dx1);


        // 1. adjust tolerance - increase precision for detailed
        /*
        if (cross < tolerance * 0.95) {
            let dist = getSquareDistance(pt0, pt1)
            let tolerance2 = dist / 250
            console.log('adjust1');


            if (cross > tolerance2) {
                //tolerance = tolerance2
                console.log('adjust1 tol');

                cross = Infinity
            }else{
                console.log('keep');
            }
        }
            */

        // 2. adjust tolerance - decrease precision for simple polys
     if (cross > tolerance && cross < tolerance2) {

            let area = getPolygonArea([pt0, pt1, pt2]);
            if (area < tolerance) {
                cross = 0
                //console.log('adjust2');
            }

        }


        if (!isVertical && !isHorizontal && (cross < tolerance)) {
            //console.log('colinear', cross, tolerance);

            if (!isLast) continue;
            //ptsSmp.push(pt1)

            // check if last point is colinear with first point
            if (isLast && M.x !== pt2.x && M.y !== pt2.y) {

                let dxM = pt2.x - M.x;
                let dyM = pt2.y - M.y;
                let crossM = Math.abs(dxM * dy1 - dyM * dx1);
                //console.log('crossM', crossM);

                if (crossM > tolerance) {
                    //console.log('add last', M, pt2);
                    ptsSmp.push(pt2)
                }
                continue
            }


        } else {

            // no simplification - add mid pt 
            ptsSmp.push(pt1)

            // add last point if not first
            if (isLast && M.x !== pt2.x && M.y !== pt2.y) {
                // console.log('add last', M, pt2);
                ptsSmp.push(pt2)
            }
        }

        // update previous point
        pt0 = pt1;

    }

    /**
     * check if starting point is in
     * colinear segment 
     * shift starting point
     * exclude flat horizontal or vertical lines
     */

    // remove last horizontal or vertical
    if (ptsSmp.length > 2 && ((M.x === Z.x && M.y !== Z.y) || (M.x !== Z.x && M.y === Z.y))) {
        // ptsSmp.pop();
    }

    else if (shiftStart && M.x !== Z.x && M.y !== Z.y) {

        pt2 = ptsSmp[1];
        let dxZ = pt2.x - Z.x;
        let dyZ = pt2.y - Z.y;
        let dxM = pt2.x - M.x;
        let dyM = pt2.y - M.y;
        let crossZ = Math.abs(dxZ * dyM - dyZ * dxM);

        if (crossZ < tolerance) {
            //console.log('shift starting point');
            ptsSmp.shift();
        }
    }


    return ptsSmp;
}








export function simplifyRC_cp(pts) {
    if (pts.length < 3) return pts;

    // Initialize with first point
    let ptsSmp = [pts[0]];
    let pt0 = pts[0];
    let ptL = pts[pts.length - 1];

    // Adaptive tolerance based on bounding box size
    let minX = pt0.x, maxX = pt0.x, minY = pt0.y, maxY = pt0.y;
    for (let pt of pts) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
    }
    let boundingSize = Math.max(maxX - minX, maxY - minY);
    let BASE_TOLERANCE = 1e-10;
    let tolerance = boundingSize * BASE_TOLERANCE;


    let polyBB = getPolyBBox(reducePoints(pts, 48));
    let { width, height } = polyBB;
    let dimAvg = (width + height) / 2;
    tolerance = dimAvg / 100;


    // Process points
    for (let i = 1; i < pts.length - 1; i++) {
        let pt1 = pts[i];
        let pt2 = pts[i + 1];

        // Skip zero-length segments
        if ((pt1.x === pt0.x && pt1.y === pt0.y) || (pt1.x === pt2.x && pt1.y === pt2.y)) {
            console.log('zero');
            continue;
        }

        // Calculate slope ratios to detect collinearity
        let dx1 = pt1.x - pt0.x;
        let dy1 = pt1.y - pt0.y;
        let dx2 = pt2.x - pt1.x;
        let dy2 = pt2.y - pt1.y;

        // Special case for vertical/horizontal lines
        let isVertical1 = Math.abs(dx1) < tolerance;
        let isHorizontal1 = Math.abs(dy1) < tolerance;
        let isVertical2 = Math.abs(dx2) < tolerance;
        let isHorizontal2 = Math.abs(dy2) < tolerance;

        if ((isVertical1 && isVertical2) || (isHorizontal1 && isHorizontal2)) {
            continue; // Skip collinear point
        }

        // For non-vertical/horizontal segments, check slope ratio
        if (!isVertical1 && !isHorizontal1 && !isVertical2 && !isHorizontal2) {
            let slope1 = dy1 / dx1;
            let slope2 = dy2 / dx2;
            let slopeDiff = Math.abs(slope1 - slope2);

            if (slopeDiff < tolerance) {
                continue; // Collinear based on slope comparison
            }
        }

        ptsSmp.push(pt1);
        pt0 = pt1;
    }

    // Add last point if it's not identical to first point
    if (ptL.x !== pts[0].x || ptL.y !== pts[0].y) {
        ptsSmp.push(ptL);
    }

    return ptsSmp;
}



export function simplifyRC_b(pts) {

    //console.log('simplifyRC');
    if (pts.length < 3) return pts;

    let ptsSmp = [pts[0]];
    let M = pts[0];
    let pt0 = pts[0];
    let pt1, pt2;
    let ptL = pts[pts.length - 1];
    let tolerance = 1;

    let polyBB = getPolyBBox(reducePoints(pts, 48));
    let { width, height } = polyBB;
    let dimAvg = (width + height) / 2;
    tolerance = dimAvg / 1000;


    // First pass: Remove colinear points and collect triangle areas
    for (let i = 2, l = pts.length; i < l; i++) {
        pt1 = pts[i - 1];
        pt2 = pts[i];

        //console.log(pts, pt1, pt2);


        // Skip zero-length segments
        if ((pt1.x === pt0.x && pt1.y === pt0.y) || (pt1.x === pt2.x && pt1.y === pt2.y)) {
            console.log('zero');
            continue;
        }

        // Check for vertical/horizontal segments
        let isVertical = (pt0.x === pt1.x);
        let isHorizontal = (pt0.y === pt1.y);

        if (isVertical || isHorizontal) {

            console.log('vertical or horizontal');
            let nextVertical = (pt1.x === pt2.x);
            let nextHorizontal = (pt1.y === pt2.y);

            if (!(nextVertical && isVertical) && !(nextHorizontal && isHorizontal)) {
                ptsSmp.push(pt1);
            }
            // add last point if not vertical or horizontal to starting point
            if (i === l - 1 && (M.x !== pt2.x && M.y !== pt2.y)) {
                ptsSmp.push(pt2);
            }
            pt0 = pt1;
            continue;
        }

        // Cross product check for colinearity
        let dx0 = pt0.x - pt2.x;
        let dy0 = pt0.y - pt2.y;
        let dx1 = pt0.x - pt1.x;
        let dy1 = pt0.y - pt1.y;
        let cross = Math.abs(dx0 * dy1 - dy0 * dx1);

        // Dynamic tolerance based on segment length
        let squareDistance = getSquareDistance(pt1, pt2);
        tolerance = squareDistance / 50;

        console.log('cross', cross, tolerance);

        if (cross > tolerance) {

            ptsSmp.push(pt1);

            // add last point
            if (i === l - 1 && (M.x !== pt2.x && M.y !== pt2.y)) {
                ptsSmp.push(pt2);
            }

        } else {
            //ptsSmp.push(pt1);
        }
        pt0 = pt1;
    }


    // first and last points coincide
    pt0 = ptsSmp[0];
    ptL = ptsSmp[ptsSmp.length - 1];
    if ((pt0.x === ptL.x && pt0.y === ptL.y)) {
        ptsSmp.pop();
    }


    console.log('ptsSmp col', ptsSmp);

    return ptsSmp;
}


export function simplifyRC0(pts) {

    //console.log('simplifyRC');
    if (pts.length < 3) return pts;

    let ptsSmp = [pts[0]];
    let pt0 = pts[0];
    let pt1, pt2;
    let ptL = pts[pts.length - 1];
    let tolerance = 1;

    // First pass: Remove colinear points and collect triangle areas
    for (let i = 2, l = pts.length; i < l; i++) {
        pt1 = pts[i - 1];
        pt2 = pts[i];

        // Skip zero-length segments
        if (pt1.x === pt2.x && pt1.y === pt2.y) continue;

        // Check for vertical/horizontal segments
        let isVertical = (pt0.x === pt1.x);
        let isHorizontal = (pt0.y === pt1.y);

        if (isVertical || isHorizontal) {
            let nextVertical = (pt1.x === pt2.x);
            let nextHorizontal = (pt1.y === pt2.y);

            if (!(nextVertical && isVertical) && !(nextHorizontal && isHorizontal)) {
                ptsSmp.push(pt1);
            }
            // add last point
            if (i === l - 1) {
                ptsSmp.push(pt2);
            }
            pt0 = pt1;
            continue;
        }

        // Cross product check for colinearity
        let dx0 = pt0.x - pt2.x;
        let dy0 = pt0.y - pt2.y;
        let dx1 = pt0.x - pt1.x;
        let dy1 = pt0.y - pt1.y;
        let cross = Math.abs(dx0 * dy1 - dy0 * dx1);

        // Dynamic tolerance based on segment length
        let squareDistance = getSquareDistance(pt1, pt2);
        tolerance = squareDistance / 50;

        if (cross > tolerance) {
            if (i === l - 1) {
                // last point
                ptsSmp.push(pt1, pt2);
            } else {
                ptsSmp.push(pt1);
            }
        }
        pt0 = pt1;
    }


    // first and last points coincide
    pt0 = ptsSmp[0];
    ptL = ptsSmp[ptsSmp.length - 1];
    if (pt0.x === ptL.x && pt0.y === ptL.y) {
        ptsSmp.pop();
    }
    return ptsSmp;
}













export function simplifyRC_gpt(pts) {
    if (pts.length < 3) return pts;

    const ptsSmp = [pts[0]];

    const isZeroLength = (a, b) => a.x === b.x && a.y === b.y;
    const isVertical = (a, b) => a.x === b.x;
    const isHorizontal = (a, b) => a.y === b.y;

    const isColinear = (a, b, c, tol = 5) => {


        let dx1 = c.x - a.x;
        let dy1 = c.y - a.y;

        let dx2 = c.x - b.x;
        let dy2 = c.y - b.y;

        /*
        let dx1 = c.x-a.x;
        let dx2 = c.x - b.x;

        let dy1 = c.y-a.y;
        let dy2 = c.y - b.y;

        let rat1 = dx1/dy1;
        let rat2 = dx2/dy2;

        let ratDiff = Math.abs(rat1-rat2) || 0
        console.log('ratDiff', ratDiff, 'rats:', rat1, rat2, 'deltas', dx1, dx2, dy1, dy2);
        */

        //return ratDiff<tol;

        let cross = Math.abs(dx1 * dy2 - dy1 * dx2);
        console.log('cross', cross, tol);


        return cross < tol;
    };

    for (let i = 1; i < pts.length - 1; i++) {
        const prev = ptsSmp[ptsSmp.length - 1];
        const curr = pts[i];
        const next = pts[i + 1];

        // Skip zero-length segments
        if (isZeroLength(prev, curr)) continue;

        // Check for horizontal or vertical colinearity
        const sameOrientation = (isVertical(prev, curr) && isVertical(curr, next)) ||
            (isHorizontal(prev, curr) && isHorizontal(curr, next));

        if (sameOrientation || isColinear(prev, curr, next)) {
            continue; // middle point is redundant
        }

        ptsSmp.push(curr);
    }

    // Always include the last point if it's not a duplicate
    const last = pts[pts.length - 1];
    if (!isZeroLength(ptsSmp[ptsSmp.length - 1], last)) {
        ptsSmp.push(last);
    }

    // Remove closing point if same as first
    if (isZeroLength(ptsSmp[0], ptsSmp[ptsSmp.length - 1])) {
        ptsSmp.pop();
    }

    return ptsSmp;
}