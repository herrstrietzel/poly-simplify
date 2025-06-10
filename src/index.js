import { normalizePointInput } from './inputs.js';
import { reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon, scalePolygon, sortPolygonLeftTopFirst, isClosedPolygon } from './geometry.js';

import { pathDataToPoly, minifyPathData, pathDataToD } from './parsePath.js';
//import { scalePolygon } from './scale.js';
import { getOutputData } from './ouput.js';

import { simplifyRC } from './simplifyRC.js';
import { simplifyRD } from './simplifyRD.js';
import { simplifyRDP } from './simplifyRDP.js';
import { simplifyVW, initHeap } from './simplifyVW.js';
import { simplifyToMax } from './simplifyToMax.js';



function polySimplify_core(pts, {
    quality = 1,

    // simplifification algorithms
    RC = true,
    RDP = true,
    VW = false,
    RD = true,

    // allow custom combinations
    overrideQuality = false,

    // handy for mid segment starting point
    optimizeStartingPoint = true,

    maxPoints = 0,

    // brute force simplification
    skipPoints = false,
    outputFormat = 'points',
    scale = 1,
    alignToZero = false,
    translateX = 0,
    translateY = 0,
    scaleToWidth = 0,
    scaleToHeight = 0,
    meta = false,

    // rounding
    decimals = -1,

    // options for pathData output
    toRelative = false,
    toShorthands = false,
    minifyString = false
} = {}) {


    // normalize
    try {
        pts = normalizePointInput(pts);
    } catch {
        console.warn('invalid input');
        pts = [{ x: 0, y: 0 }];
        return pts;
    }

    /**
     * switch between absolute or 
     * quality based relative thresholds
     */
    let unit;
    let qualityNum = quality;
    let isAbsolute = false;
    let toMaxPoints = false;
    //let qualityInput = quality;

    if (typeof quality === 'string') {
        qualityNum = parseFloat(quality);
        unit = quality.replace(qualityNum.toString(), '').trim();
        //console.log('no unit', value, unit);

        if (unit) {
            if (unit === 'v') {
                maxPoints = qualityNum;
                toMaxPoints = true;
                quality = 0.8;
            } else {
                isAbsolute = true;
            }
            //console.log('no unit', unit);
        } else {
            quality = qualityNum <= 1 ? qualityNum : 0.8;
            //quality = value.toString();
        }
    }

    //console.log('quality', quality, qualityNum, 'maxPoints:', maxPoints, 'isAbsolute:', isAbsolute);

    // adjust quality to match vertices difference
    if (maxPoints) {

        //RD = false;
        const clamp = (val, min, max) => Math.min(Math.max(val, min), max)

        let rat = +(pts.length / maxPoints / 100).toFixed(1);
        quality = Math.abs(1 - rat)
        quality = clamp(quality, 0.4, 0.8);

        //console.log('diffRel', diffRel, diffRel2, 'quality', quality, maxPoints, pts.length);
        quality = quality > 0 && quality < 1 ? quality : 0.8;
    }

    //console.log('from string:', unit, quality, maxPoints);

    // if is compound
    let isCompound = pts[0].length > 1;


    /**
     * normalize to array for 
     * compound polygons or paths
     */
    let polyArr = isCompound ? pts : [pts];
    let polyArrSimpl = [];

    /**
     * get area and bboxes
     * for subpath max limits
     */
    let areaArr = [];
    let areaTotal = 0;
    let bboxArr = [];

    for (let i = 0, l = polyArr.length; i < l; i++) {
        let pts = polyArr[i];
        //console.log(pts);
        let polyApprox = reducePoints(pts, 64);
        bboxArr.push(getPolyBBox(polyApprox));
        let area = getPolygonArea(polyApprox)
        areaTotal += area;
        areaArr.push(area)
    }

    //console.log(areaArr, bboxArr, areaTotal);

    for (let i = 0, l = polyArr.length; i < l; i++) {

        let pts = polyArr[i];

        // split/adjust max point according to subpath area
        let rat = areaArr[i]/areaTotal
        let maxPointsSub = toMaxPoints ? Math.ceil(maxPoints * rat) : 0;

        // no points - exit
        if (!pts.length) return [];

        // collect simplified point array
        let ptsSmp = pts;

        // line segments 
        //|| quality > 1
        if (pts.length < 3) {
            polyArrSimpl.push(ptsSmp);
            continue;
        }


        /**
         * 0. reduce vertices to 
         * maximum limit
         * brute force but very fast for huge 
         * point arrays
         */

        
        if (skipPoints && !RDP && !VW && !RD && toMaxPoints) {
            //console.log('!!!skipPoints', skipPoints);
            ptsSmp = reducePoints(pts, maxPointsSub);
            polyArrSimpl.push(ptsSmp);
            continue
        }



        /**
         * override settings due to 
         * quality
         */

        if (!overrideQuality) {
            if (quality >= 1) RDP = false
            if (quality >= 0.75) RD = false
            if (quality < 0.5) {
                RD = true
                //RC = false
            }
        }

        //console.log(RC, RD, RDP, VW);

        /**
         * 0. sort to left most
         * can reduce point count if starting point is 
         * in the middle 
         * of a colinear segment
         */
        ptsSmp = optimizeStartingPoint ? sortPolygonLeftTopFirst(ptsSmp) : ptsSmp;


        /**
         * RC= remove colinear
         * 1. lossless simplification
         * only remove zero-length segments/coinciding points
         * or colinear segments
         */

        if(RC){
            if(!isAbsolute && quality>1) {
                polyArrSimpl.push(ptsSmp);
                continue
            }
            ptsSmp = simplifyRC(ptsSmp)
        }



        /**
         * check regular polygons
         * for simple regular polys
         * if it's regular:
         * we skip RDP simplification
         */

        if (RC) {
            let isRegular = detectRegularPolygon(ptsSmp);
            //console.log('detectRegular', isRegular);
            if (isRegular) {
                VW = false;
                RDP = false;
            }
        }

        /**
         * approximate dimensions 
         * for relative threshold calculations
         */
        //let polyApprox = reducePoints(pts, 24);
        let { width, height } = bboxArr[i];

        // average side lengths
        //let isPolygon = isClosedPolygon(polyApprox);


        /** 
         * 1. radial distance
         * sloppy but fast
         */

        if (RD && ptsSmp.length > maxPointsSub) {
            //if( (maxPoints && ptsSmp.length > maxPoints) )
            ptsSmp = simplifyRD(ptsSmp, quality, width, height);
        }


        /**
         * 2. Ramer-Douglas-Peucker simplification
         */
        //
        if (RDP && ptsSmp.length > maxPointsSub) {
            //console.log('RDP', ptsSmp.length, maxPoints);
            ptsSmp = simplifyRDP(ptsSmp, quality, width, height);
        }

        /**
         * 3. Apply VW-Whyatt 
         * simplification for huge geodata polygons
         */

        if (VW && ptsSmp.length > maxPointsSub  ) {
            //console.log('simplifyVW :', quality, isAbsolute);
            ptsSmp = simplifyVW(ptsSmp, quality, width, height)
        }



        /**
         * 4. reduce to target 
         * vertices limit
         */


        if (toMaxPoints && ptsSmp.length > maxPointsSub) {

            /**
             * add radial simplification for better performance
             * if difference is > 20%
             */

            let diff = (ptsSmp.length - maxPointsSub)/ptsSmp.length
            //console.log('final opt', ptsSmp.length, maxPointsSub);
            
            if (diff > 0.25) {
                ptsSmp = simplifyRD(ptsSmp, quality, width, height)
                //console.log('final opt RD', quality, ptsSmp.length, maxPointsSub);

            }

            // final reduction
            ptsSmp = simplifyToMax(ptsSmp, maxPointsSub)
        }


        // add to final pts array
        polyArrSimpl.push(ptsSmp);

    }


    let out = getOutputData(polyArr, polyArrSimpl, outputFormat, meta, decimals, toRelative, toShorthands, minifyString, scale, translateX, translateY, alignToZero, scaleToWidth, scaleToHeight, isCompound);


    return meta ? out : out.data;
}

export { polySimplify_core as polySimplify };
export { normalizePointInput, pathDataToD, simplifyRC, simplifyRDP, simplifyRD };


// Browser global
if (typeof window !== 'undefined') {
    window.polySimplify = polySimplify_core;
    window.normalizePointInput = normalizePointInput;
}

