export function normalizePointInput(pts) {

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
    let type = isPointArray && typeof pts[0] === 'object' ? (pts[0].constructor.name ? pts[0].constructor.name : 'object') : null

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

    // convert to point array
    if (isNested){
        pts = pts.map((pt) => {
            return { x: pt[0], y: pt[1] };
        });
    }

    // 3.2: flat array – group x/y
    //!Array.isArray(pts[0]
    let isFlat = !Array.isArray(pts[0]) && !pts[0].hasOwnProperty('x');
    if (isFlat) pts = toPointArray(pts);


    return pts;
}

