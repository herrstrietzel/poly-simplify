import { reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon, scalePolygon, sortPolygonLeftTopFirst, isClosedPolygon } from './geometry.js';

/**
* "lossless" simplification:
* remove zero length or 
* horizontal or vertical segments
* geometry should be perfectly retained
*/


export function simplifyRC(pts) {

    //console.log('simplifyRC');
    if (pts.length < 3) return pts;

    let ptsSmp = [pts[0]];
    let pt0 = pts[0];
    let pt1, pt2;
    let ptL = pts[pts.length-1];
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
    if(pt0.x===ptL.x && pt0.y===ptL.y){
        pts.pop();
    }

    return ptsSmp;
}


