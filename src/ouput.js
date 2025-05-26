import { scalePolygon, reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon } from './geometry.js';

import { minifyPathData, pathDataToD } from './parsePath.js';


// output helper
export function getOutputData(polyArr, polyArrSimpl, outputFormat = 'points', meta = false, decimals = -1, toRelative = false,
    toShorthands = false, minifyString = false, scale = 1, translateX = 0, translateY = 0, alignToZero = false, scaleToWidth = 0, scaleToHeight = 0) {

    let outputObj = {
        data: [],
        //ptsOriginal: polyArr,
        ptsArr: [],
        countOriginal: 0,
        count: 0,
        areaOriginal: 0,
        areaptsSmp: 0,
        areaDiff: 0,
        isPolygon: []
    }


    /**
     * scale points
     * useful for tiny polygons
     */
    polyArrSimpl = scalePolygon(polyArrSimpl, scale, translateX, translateY, alignToZero, scaleToWidth, scaleToHeight);

    for (let i = 0, l = polyArrSimpl.length; i < l; i++) {

        // original points
        let pts = polyArr[i];

        //simplified points
        let ptsSmp = polyArrSimpl[i];

        // original vertices count
        let total = pts.length;
        outputObj.countOriginal += total

        // simplified vertices count
        let totalSmpl = ptsSmp.length;
        outputObj.count += totalSmpl


        outputObj.ptsArr.push(ptsSmp);

        let isPolygon = false;

        // check if closed
        if (meta) {

            let areaOriginal = getPolygonArea(pts, true);
            let areaptsSmp = getPolygonArea(ptsSmp, true);
            outputObj.areaOriginal = areaOriginal;
            outputObj.areaptsSmp = areaptsSmp;


            let ptsR = reducePoints(pts, 32);
            let { width, height } = getPolyBBox(ptsR);
            let dimAvg = Math.max(width, height);
            let closingThresh = (dimAvg / pts.length) ** 2

            let closingDist = getSquareDistance(pts[0], pts[pts.length - 1]);
            isPolygon = closingDist < closingThresh;
            outputObj.isPolygon.push(isPolygon);

            // area deviation in percent
            let areaDiff = meta ? +(100 / areaptsSmp * Math.abs(areaOriginal - areaptsSmp)).toFixed(3) : 0;
            outputObj.areaDiff += areaDiff
        }

    }



    /**
     * compile output
     */

    outputFormat = outputFormat.toLowerCase();
    //decimals=1;

    switch (outputFormat) {

        case 'points':
        case 'pointstring':
        case 'pointsnested':
        case 'json':

            // round coordinates
            outputObj.ptsArr = outputObj.ptsArr.map(pts => pts.map(pt => { return { x: +pt.x.toFixed(decimals), y: +pt.y.toFixed(decimals) } }
            ));

            if (outputFormat === 'pointstring') {
                outputObj.data = outputObj.ptsArr.map(pts => pts.map(pt => `${pt.x} ${pt.y}`).join(' '));
            }

            else if (outputFormat === 'points') {
                outputObj.data = outputObj.ptsArr
            }

            else if (outputFormat === 'pointsnested') {
                outputObj.data = outputObj.ptsArr.map(pts => pts.map(pt => [pt.x, pt.y]))
            }

            else if (outputFormat === 'json') {
                outputObj.data = JSON.stringify(outputObj.ptsArr)
            }

            break;


        case 'pathdata':
        case 'path':
            let pathDataCompound = [];
            outputObj.ptsArr.forEach((pts, i) => {
                let pathData = [
                    { type: 'M', values: [pts[0].x, pts[0].y] },
                    ...pts.slice(1).map(pt => { return { type: 'L', values: [pt.x, pt.y] } })
                ];

                // add close path
                if (outputObj.isPolygon[i]) {
                    pathData.push({ type: 'Z', values: [] })
                }

                pathDataCompound.push(...pathData);
            })

            // minify/optimize
            pathDataCompound = minifyPathData(pathDataCompound, decimals, toRelative, toShorthands);


            if (outputFormat === 'path') {
                outputObj.data = [pathDataToD(pathDataCompound, (minifyString ? 1 : 0))]
            } else {
                outputObj.data = pathDataCompound
            }

    }


    //console.log('outputObj', outputFormat, outputObj);


    return outputObj
}

