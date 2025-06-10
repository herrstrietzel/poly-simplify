import { scalePolygon, reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon } from './geometry.js';

import { minifyPathData, pathDataToD } from './parsePath.js';


// output helper
export function getOutputData(polyArr, polyArrSimpl, outputFormat = 'points', meta = false, decimals = -1, toRelative = false,
    toShorthands = false, minifyString = false, scale = 1, translateX = 0, translateY = 0, alignToZero = false, scaleToWidth = 0, scaleToHeight = 0, isCompound=false) {

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
            let ptsR = reducePoints(pts, 32);
            let { width, height } = getPolyBBox(ptsR);
            let dimAvg = Math.max(width, height);
            let closingThresh = (dimAvg / pts.length) ** 2

            let closingDist = getSquareDistance(pts[0], pts[pts.length - 1]);
            isPolygon = closingDist < closingThresh;
            outputObj.isPolygon.push(isPolygon);
        }

    }


    /**
     * approximate minimum 
     * floating point precision
     * to prevent distortions
     */

    if(decimals>-1 && decimals<=3){

        //console.log('round', decimals);

        let polySimplFlat = polyArrSimpl.flat();
        let polyAppr = reducePoints(polySimplFlat, 24)

        let { width, height } = getPolyBBox(polyAppr)
        let dimAvg = (width + height) / 2;

        if(dimAvg>500) {
            decimals=0
        }else{
            let complexity = polySimplFlat.length/dimAvg;
            let ratLength = dimAvg / 1000;
            let decimalsMinLen = Math.ceil(1 / ratLength).toString().length;
            let decimalsMinCompl = Math.ceil(complexity).toString().length;
        
            let decimalsMin = Math.ceil((decimalsMinLen+decimalsMinCompl)/2)
            //console.log('decimalsMin', decimalsMinLen, 'complexity', complexity, decimalsMinCompl);
            decimals = decimals > -1 && decimals < decimalsMin ? decimalsMin : decimals;
        }
    }


    /**
     * compile output
     */

    outputFormat = outputFormat ? outputFormat.toLowerCase() : 'points';

    switch (outputFormat) {

        case 'points':
        case 'pointstring':
        case 'pointsnested':
        case 'json':

            // round coordinates
            if(decimals>-1){
                outputObj.ptsArr = outputObj.ptsArr.map(pts => pts.map(pt => { return { x: +pt.x.toFixed(decimals), y: +pt.y.toFixed(decimals) } }
                ));
            }

            if (outputFormat === 'pointstring') {
                outputObj.data = outputObj.ptsArr.map(pts => pts.map(pt => `${pt.x} ${pt.y}`).join(' '));
            }

            else if (outputFormat === 'points') {
                if(!isCompound) {
                    outputObj.ptsArr = outputObj.ptsArr[0]
                }

                outputObj.data = outputObj.ptsArr
            }

            else if (outputFormat === 'pointsnested') {
                outputObj.data = outputObj.ptsArr.map(pts => pts.map(pt => [pt.x, pt.y]))
                if(!isCompound) {
                    outputObj.data = outputObj.data[0]
                    outputObj.ptsArr = outputObj.ptsArr[0]
                }

            }

            else if (outputFormat === 'json') {
                if(!isCompound) outputObj.ptsArr = outputObj.ptsArr[0]
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
                if(!isCompound) outputObj.data = outputObj.data[0]
            } else {
                outputObj.data = pathDataCompound
            }

    }


    //console.log('outputObj', outputFormat, outputObj);


    return outputObj
}

