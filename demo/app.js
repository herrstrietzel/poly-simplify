// init poly simplify
import { polySimplify, normalizePointInput, simplifyRemoveColinear, simplifyPolyRDP, minifyPathData, pathDataToD } from '../dist/poly-simplify.esm.js';


let localStorageName = 'settings_polysimplify';
let settings

(async () => {

    /**
     * build UI
     * input and output options
     */


    settings = await generateFilterInputs(fieldsInput, {}, localStorageName);
    appendInputs(fieldsInput, [], optionsWrpInput, localStorageName);

    settings = await generateFilterInputs(fieldsOutput, settings, localStorageName);
    appendInputs(fieldsOutput, [], optionsWrpOutput, localStorageName);

    

    // init
    update(settings)


    document.addEventListener('settingsChange', () => {
        console.log('Data changed:', settings);
        update(settings)
    });

})();





function update(settings) {

    //console.log(settings);

    let { removeColinear, useRDP, toMaxVertices, maxVertices, decimals, inputPoly, tolerance, outputFormat, toRelative,
        toShorthands, minifyString, scale, alignToZero, translateX, translateY, scaleToWidth, scaleToHeight, showFill, showMarkers } = settings;

    //console.log('settings', settings );
    //console.log('inputPoly', inputPoly);

    let options = {
        tolerance,
        removeColinear,
        useRDP,
        decimals,
        outputFormat,
        maxVertices,
        toMaxVertices,
        maxVertices,
        scale,
        alignToZero,
        translateX,
        translateY,
        scaleToWidth,
        scaleToHeight,

        meta: true,
        toRelative,
        toShorthands,
        minifyString
    }

    // simplify
    let simplified = polySimplify(inputPoly, options);
    //if(!simplified.length) return false;


    let { data, ptsArr, isPolygon, count,  countOriginal} = simplified;
    let dAtt='', pointsAtt, el = 'polygon';

    // show point savings
    pointCount.textContent = `${count}/${countOriginal}`;

    outputFormat = outputFormat.toLowerCase();
    isPolygon = isPolygon[0];

    let dataOut = data;

    //|| outputFormat=='json' 
    if (outputFormat === 'points' || outputFormat === 'pointsnested' || outputFormat === 'pathdata' ) {
        dataOut = JSON.stringify(data).replaceAll('"', '')
        //.replaceAll('[[', '\n[\n[').replaceAll(']]', '\n]\n]');
    }

    pointOutput.value = dataOut;


    /**
     * adjust data for preview
     * rendering
     */


    if (outputFormat === 'points' || outputFormat === 'pointstring' || outputFormat === 'pointsnested') {

        if(outputFormat === 'pointsnested'){
            //console.log('pointsnested', simplified.data);
            pointsAtt = simplified.data[0].join(' ');
            //data = JSON.stringify(data);
        }else{
            //data = outputFormat === 'points' ? JSON.stringify(data).replaceAll('"', '') : data;
            pointsAtt = outputFormat === 'points' ? data[0].map(pt => `${pt.x} ${pt.y}`).join(' ') : data;
        }

        el = isPolygon ? 'polygon' : 'polyline';


        if(data.length>1) {
            data.forEach(pts=>{
                dAtt += outputFormat === 'points' ? `M ${pts.map(pt=>{return `${pt.x} ${pt.y}`}).join(' ')}` :
                 ( outputFormat === 'pointstring' ? `M ${pts}` : `M ${pts.map(pt=>{return `${pt[0]} ${pt[1]}`}).join(' ')}` )
            })
            outputFormat = 'path';
            el = 'path'
        }

    }

    else if (outputFormat === 'pathdata' || outputFormat === 'path') {
        dAtt = outputFormat === 'pathdata' ? pathDataToD(data, (minifyString ? 1 : 0)) : data;
        el = 'path';
    } 

    // is JSON
    else {
        dAtt = '';
        ptsArr.forEach(pts=>{
            let closePath ='';
            if(isPolygon) closePath ='Z';
            dAtt += 'M' + pts.map(pt => `${pt.x} ${pt.y}`).join(' ')+closePath;
        })

        el = 'path';
    }



    /**
     * render preview
     */

    // reset previous
    pathPreview.setAttribute('d', '');
    polylinePreview.setAttribute('points', '');
    polygonPreview.setAttribute('points', '');



    /**
     * create standalone 
     * SVG output
     * and preview
     */
    let svgOut =''
       
    if (el === 'path') {
        pathPreview.setAttribute('d', dAtt)
        svgOut +=`<path d="${dAtt}"/>`;
    }
    else if (el === 'polyline') {
        polylinePreview.setAttribute('points', pointsAtt)
        pathPreview.setAttribute('d', '')
        polygonPreview.setAttribute('points', '')
        svgOut +=`<polyline points="${pointsAtt}"/>`;
    }
    else if (el === 'polygon') {
        polygonPreview.setAttribute('points', pointsAtt)
        pathPreview.setAttribute('d', '')
        polylinePreview.setAttribute('points', '')
        svgOut +=`<polygon points="${pointsAtt}"/>`;
    }


    let padding = 0;
    adjustViewBox(svgPreview, padding)

    // create clean copy for svg out
    let [x, y, width, height ] = svgPreview.getAttribute('viewBox').split(/,| /).map(Number);
    [x, y, width, height ] = [x, y, width, height ].map(val=>+val.toFixed(2))


    if(showFill){
        svgPreview.classList.add('showFill');
    }else{
        svgPreview.classList.remove('showFill');
    }

    if(showMarkers){
        svgPreview.classList.add('showMarkers');
    }else{
        svgPreview.classList.remove('showMarkers');
    }

    svgOut = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${[x, y, width, height].join(' ')}">
    ${svgOut}
    </svg>`;
    svgOutput.value = svgOut

}


function adjustViewBox(svg, padding = 0, decimals = 3) {
    let bb = svg.getBBox();
    let [x, y, width, height] = [bb.x, bb.y, bb.width, bb.height];

    if (padding) {
        let dimMax = Math.max(width + padding, height + padding)
        x -= (dimMax - width) / 2
        y -= (dimMax - height) / 2
        width = dimMax
        height = dimMax
    }

    svg.setAttribute("viewBox", [x, y, width, height].map(val => { return +val.toFixed(decimals) }).join(" "));
}
