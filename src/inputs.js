import { pathDataToPoly, splitSubpaths, parsePathNorm } from './parsePath.js';


export function normalizePointInput(pts) {

    if (!pts || !pts.length) return [];

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
    let hasConstructor = isPointArray && pts.length > 0 && typeof pts[0] === 'object' && pts[0].constructor !== Object;

    const decoupleFromConstructor = (pts) => {
        let len = pts.length;
        let ptArr = new Array(len);
        for (let i = 0; i < len; i++) {
            ptArr[i] = { x: pts[i].x, y: pts[i].y };
        }
        return ptArr;
    }


    // decouple from constructor object type - e.g SVGPoints
    //hasConstructor=true;
    if (hasConstructor) decoupleFromConstructor(pts);

    // normalized return array
    if (isPointArray) {
        return pts;
    }


    /**
     * 2. input is string - 
     * e.g from polygon points attribute
     */

    let isString = typeof pts === "string";

    // is SVG path data
    let isPathData = isString ? (pts.startsWith('M') || pts.startsWith('m')) : false;
    let isCompound = false;

    if (isPathData) {
        // check if plugin is installed
        if (typeof pathDataToPoly !== 'function') {
            console.warn('path to point parser is not installed');
            return [{ x: 0, y: 0 }];
        }

        // check compoundPath
        let pathData = parsePathNorm(pts);
        let suPaths = splitSubpaths(pathData);
        isCompound = suPaths.length > 1;

        let ptArr = [];
        if (isCompound) {
            suPaths.forEach(pathData => {
                let ptsSub = pathDataToPoly(pathData);
                ptArr.push(ptsSub);

            });

        } else {
            ptArr = pathDataToPoly(pathData);
        }

        //console.log(isCompound,suPaths.length, ptArr);
        return ptArr
    }

    // 2.1 check if it's JSON
    let isJSON = isString ? pts.startsWith('{') || pts.startsWith('[') : false;

    function fixJsObjectString(str) {
        return str.replace(/([{,])\s*(\w+)\s*:/g, '$1"$2":');
    }

    // 2.1.1: if JSON – parse data
    if (isJSON) {
        try {
            pts = JSON.parse(pts);

        } catch {
            // convert to point array
            pts = JSON.parse(fixJsObjectString(pts));
        }
        isString = false;
        //return pts;
    }

    // 2.2: stringified poly notation – split to array
    if (isString) {
        pts = pts.trim().split(/,| /).filter(Boolean).map(Number);

        // 2.3: nonsense string input
        let hasNaN = pts.filter(pt => isNaN(pt)).length;
        if (hasNaN) {
            console.warn("input doesn't contain point data – please, check your input structure for syntax errors")
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

    // has su polys
    let isCompoundPoly = !isNested && isArray && Array.isArray(pts[0]);

    // grouped in x/y pairs
    let isCompoundPolyNested = isCompoundPoly && pts[0][0].length === 2;

    // flat point value array
    let isCompoundPolyFlat = isCompoundPoly && !isCompoundPolyNested && pts[0].length > 2 && !pts[0][0].hasOwnProperty('x');

    /*
    let isCompoundPolyObj = isCompoundPoly && !isCompoundPolyNested && pts[0].length>2 && pts[0][0].hasOwnProperty('x');

    console.log('isCompoundPolyObj', isCompoundPolyObj, 'isCompoundPolyFlat', isCompoundPolyFlat, 'isCompoundPolyNested', isCompoundPolyNested, isCompoundPoly, isNested);
    */


    if (isCompoundPolyFlat || isCompoundPolyNested) {
        let ptsN = []
        pts.forEach(sub => {
            let pts = isCompoundPolyFlat ? toPointArray(sub) : sub.map((pt) => { return { x: pt[0], y: pt[1] }; });
            ptsN.push(pts)
        });

        pts = ptsN;
    }

    // convert to point array
    else if (isNested) {
        pts = pts.map((pt) => {
            return { x: pt[0], y: pt[1] };
        });
    }

    // 3.2: flat array – group x/y
    //!Array.isArray(pts[0]
    let isFlat = !Array.isArray(pts[0]) && !pts[0].hasOwnProperty('x');
    if (isFlat) pts = toPointArray(pts);
    //console.log(isArray, pts);


    //console.log(pts);




    return pts;
}

