import { reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon, scalePolygon, sortPolygonLeftTopFirst, isClosedPolygon } from './geometry.js';


/**
 * radialDistance simplification
 * sloppy but fast
 */

export function simplifyRD(pts, quality = 0.9, width = 0, height = 0) {


    /**
     * switch between absolute or 
     * quality based relative thresholds
     */
    let isAbsolute = false;

    if (typeof quality === 'string') {
        let value = parseFloat(quality);
        isAbsolute = true;
        quality = value;
    }

    // nothing to do - exit
    if (pts.length < 4 || (!isAbsolute && quality) >= 1) return pts;

    let p0 = pts[0];
    let pt;
    let ptsSmp = [p0];

    // convert quality to squaredistance tolerance
    let tolerance = quality;

    if (!isAbsolute) {

        // quality to tolerance
        tolerance = 1 - quality;


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
        let scale = dimAvg / 25;
        tolerance = (tolerance * (scale)) ** 2

        if (quality > 0.5) tolerance /= 10

    }

    //console.log('simplifyRD', tolerance);


    for (let i = 1, l = pts.length; i < l; i++) {
        pt = pts[i];
        let dist = getSquareDistance(p0, pt)

        if (dist > tolerance) {
            ptsSmp.push(pt);
            p0 = pt;
        }
    }

    // add last point - if not coinciding with first point
    if (p0.x !== pt.x && p0.y !== pt.y) {
        ptsSmp.push(pt);
    }

    return ptsSmp;

}