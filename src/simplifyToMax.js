import { getPolygonArea } from "./geometry";

export function simplifyToMax(pts, maxVertices = 0) {
    if (pts.length <= 3 || !maxVertices || pts.length<=maxVertices) return pts;
    //console.log('simplifyToMax', pts.length, maxVertices);

    function getTriangles(pts) {
        let triangles = []
        // Build triangle areas, skipping first and last
        for (let i = 0; i < pts.length; i++) {
            //let triangle = 
            let i0 = i === 0 ? pts.length - 1 : i - 1;
            let i1 = i;
            let i2 = i === pts.length - 1 ? 0 : i + 1;

            let pt0 = pts[i0]
            let pt1 = pts[i1]
            let pt2 = pts[i2]

            let area = getPolygonArea([pt0, pt1, pt2]);
            let prev = i0
            let next = i2;

            triangles.push({ index: i, area, prev, next });
        }
        return triangles;
    }


    let ptsSmpl = pts;
    let passes = Math.ceil(pts.length / maxVertices);
    let scans = 0;

    // 1. remove only segments with very small mid areas
    //let removeSmallArea=true;
    //ptsSmpl = simplyfyByArea(ptsSmpl, maxVertices, 0.5, true, removeSmallArea);
    //scans++


    let lastLen = ptsSmpl.length;
    //let midPass = Math.floor(passes/4);

    for (let i = 0; ptsSmpl.length > maxVertices && i < passes; i++) {
        let limit = 0.5;
        //let removeAdjacent = i < 2 ? false : true;
        let removeSmallArea = false;
        //console.log();
        ptsSmpl = simplyfyByArea(ptsSmpl, maxVertices, limit, true, removeSmallArea);
        scans++


        // no optimization possible - exit
        if (lastLen === ptsSmpl.length) {
            break;
        }
        lastLen = ptsSmpl.length;
    }

    // final removal
    if (ptsSmpl.length > maxVertices) {
        ptsSmpl = simplyfyByArea(ptsSmpl, maxVertices, 1);
        scans++
    }

    //console.log('simpl', ptsSmpl.length, passes, scans);


    function simplyfyByArea(ptsSmpl, maxVertices = 0, limit = 0.5, sort = true, removeSmallArea=false) {
        //console.log(ptsSmpl.length);
        let triangles = getTriangles(ptsSmpl);
        let len = triangles.length;
        let simplified = [];
        let areaAvg;

        if(removeSmallArea){
            let trianglesSmall = triangles
            areaAvg = trianglesSmall.map(val => val.area).reduce((partialSum, a) => partialSum + a, 0)/len * 0.25
            sort = false;
        }

        // Sort by area ascending
        if (sort) triangles.sort((a, b) => a.area - b.area);

        // Determine number of points to keep
        let toRemoveCount = ptsSmpl.length - maxVertices;

        let toRemove = new Set();
        toRemoveCount = Math.floor(toRemoveCount * limit) + 1;

        let lastIndex = 0;
        for (let i = 0; i < toRemoveCount; i++) {
            let triangle = triangles[i];
            let { index, area, prev, next } = triangle;

            let trianglePrev = triangles[prev]
            let triangleNext = triangles[next];
            let [areaPrev, areaNext] = [trianglePrev.area, triangleNext.area];

            //index>0 &&
            if(removeSmallArea){

                //&& lastIndex < index
                if (index > 0 && area < areaAvg && lastIndex < index  ) {
                    //console.log('remove small area', area, areaAvg);
                    toRemove.add(index);
                    lastIndex = next
                }

            }


            else if ((limit === 1 || (area < areaPrev && area < areaNext))) {
                lastIndex = index
                //console.log(area, areaPrev, areaNext);
                if (index > 0) {
                    toRemove.add(index);
                    lastIndex = index
                }
            }
        }

        for (let i = 0; i < ptsSmpl.length; i++) {
            if (!toRemove.has(i)) simplified.push(ptsSmpl[i]);
        }

        return simplified;
    }


    return ptsSmpl;


}
