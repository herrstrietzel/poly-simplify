
import { reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon, scalePolygon, sortPolygonLeftTopFirst, isClosedPolygon } from './geometry.js';


/**
 * Ramer-Douglas-Peucker-Algorithm
 * for polyline simplification
 * See also: 
 * https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
 * and https://karthaus.nl/rdp/
 */



export function simplifyRDP(pts, quality = 0.9, width = 0, height = 0) {

    /**
     * switch between absolute or 
     * quality based relative thresholds
     */
    let isAbsolute = false;

    if (typeof quality === 'string') {
        isAbsolute = true;
        quality = parseFloat(quality);
    }

    if (pts.length < 4 || (!isAbsolute && quality) >= 1) return pts;

    // convert quality to squaredistance tolerance
    let tolerance = quality;
    //console.log('simplifyRDP', tolerance);

    if (!isAbsolute) {
        
        tolerance = 1 - quality;

        // adjust for higher qualities
        if (quality > 0.5) tolerance /= 2;

        /**
         * approximate dimensions
         * adjust tolerance for 
         * very small polygons e.g geodata
         */
        if (!width && !height) {
            let polyS = reducePoints(pts, 12);
            ({ width, height } = getPolyBBox(polyS));
        }

        // average side lengths
        let dimAvg = (width + height) / 2;
        let scale = dimAvg / 100;
        tolerance = (tolerance * (scale)) ** 2
    }


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

    return ptsSmp;
}