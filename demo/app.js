// init poly simplify
import { polySimplify, normalizePointInput, simplifyRC, simplifyRDP, pathDataToD } from '../dist/poly-simplify.esm.js';

//import{ simplifyRC} from '..dist/'


let localStorageName = 'settings_polysimplify';
let settingsChangeEventName = 'settingsChange';
let settingsChangeEvent = new Event(settingsChangeEventName);

let settings

(async () => {

    /**
     * build UI
     * input and output options
     */
    let settingsCache = getSettingsCache(localStorageName);
    let hasSettings = Object.keys(settingsCache).length;

    settings = hasSettings ? settingsCache : {};
    //console.log('settings from cache', settings);

    // left group: simplification settings
    await generateFilterInputs(fieldsInput, settings);
    appendInputs(fieldsInput, [], optionsWrpInput, localStorageName);

    // right group: output settings
    await generateFilterInputs(fieldsOutput, settings);
    appendInputs(fieldsOutput, [], optionsWrpOutput, localStorageName);

    //get all settings from inputs
    settings = !hasSettings ? getSettingsFromInputs() : settings;
    //settings = getSettingsFromInputs();

    // init settings cache
    cacheSettings(settings, settingsChangeEventName, localStorageName)
    //console.log('getSettingsFromInputs', hasSettings, settings);

    // add EventListeners
    bindInputs('.input', settings, settingsChangeEvent);


    // init
    update(settings)

    /**
     * override relative quality with 
     * absolute tolerance
     */
    let inpQ = document.querySelector('.input-quality');
    let inpT = document.querySelector('.input-tolerance');
    inpQ.addEventListener('input', (e) => {
        inpT.value = '';
        settings.tolerance = '';
        //update(settings)
    })

    document.addEventListener(settingsChangeEventName, () => {
        update(settings)
    });






})();






function update(settings) {

    //console.log(settings);

    let { RC, RDP, VW, RD, skipPoints, maxPoints, decimals, inputPoly, quality, tolerance, outputFormat, toRelative,
        toShorthands, minifyString, scale, alignToZero, translateX, translateY, scaleToWidth, scaleToHeight, showFill, showMarkers, optimizeStartingPoint, overrideQuality } = settings;

    let options = {
        quality,

        //simplifications
        RC,
        RDP,
        RD,
        VW,
        skipPoints,
        maxPoints,

        // rounding
        decimals,

        optimizeStartingPoint,
        overrideQuality,

        outputFormat,
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

    if (tolerance) {
        options.quality = tolerance
    }
    //options.quality = tolerance+'px';
    //console.log(options);

    // simplify
    let simplified = polySimplify(inputPoly, options);
    //if(!simplified.length) return false;
    //console.log('inputPoly', inputPoly);


    let { data, ptsArr, isPolygon, count, countOriginal } = simplified;


    if (!ptsArr) {
        console.warn('No points to simplify - please check your input data');
        return false;
    }

    let dAtt = '', pointsAtt, el = 'polygon';

    // show point savings
    pointCount.textContent = `${count}/${countOriginal}`;

    //outputFormat = outputFormat.toLowerCase();
    outputFormat = outputFormat ? outputFormat.toLowerCase() : 'points';

    isPolygon = isPolygon[0];

    let dataOut = data;

    //|| outputFormat=='json' 
    if (outputFormat === 'points' || outputFormat === 'pointsnested' || outputFormat === 'pathdata') {
        dataOut = JSON.stringify(data).replaceAll('"', '')
        //.replaceAll('[[', '\n[\n[').replaceAll(']]', '\n]\n]');
    }

    pointOutput.value = dataOut;


    /**
     * adjust data for preview
     * rendering
     */



    if (outputFormat === 'points' || outputFormat === 'pointstring' || outputFormat === 'pointsnested') {


        // not compound wrap
        if (data[0].length === 2 || !Array.isArray(data[0])) {
            data = [data]
            //console.log('not compound', data);
        }

        if (outputFormat === 'pointsnested') {
            //console.log('pointsnested', simplified.data);
            pointsAtt = simplified.data.flat().join(' ');
            //data = JSON.stringify(data);
            //console.log(pointsAtt);
        } else {
            //data = outputFormat === 'points' ? JSON.stringify(data).replaceAll('"', '') : data;
            pointsAtt = outputFormat === 'points' ? data.flat().map(pt => `${pt.x} ${pt.y}`).join(' ') : data;
        }

        el = isPolygon ? 'polygon' : 'polyline';


        if (data.length > 1) {

            data.forEach(pts => {
                dAtt += outputFormat === 'points' ? `M ${pts.map(pt => { return `${pt.x} ${pt.y}` }).join(' ')}` :
                    (outputFormat === 'pointstring' ? `M ${pts}` : `M ${pts.map(pt => { return `${pt[0]} ${pt[1]}` }).join(' ')}`)
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
        if (!Array.isArray(ptsArr[0])) {
            ptsArr = [ptsArr];
        }
        ptsArr.forEach(pts => {
            let closePath = '';
            if (isPolygon) closePath = 'Z';
            dAtt += 'M' + pts.map(pt => `${pt.x} ${pt.y}`).join(' ') + closePath;
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
    let svgOut = ''

    if (el === 'path') {
        pathPreview.setAttribute('d', dAtt)
        svgOut += `<path d="${dAtt}"/>`;
    }
    else if (el === 'polyline') {
        polylinePreview.setAttribute('points', pointsAtt)
        pathPreview.setAttribute('d', '')
        polygonPreview.setAttribute('points', '')
        svgOut += `<polyline points="${pointsAtt}"/>`;
    }
    else if (el === 'polygon') {
        polygonPreview.setAttribute('points', pointsAtt)
        pathPreview.setAttribute('d', '')
        polylinePreview.setAttribute('points', '')
        svgOut += `<polygon points="${pointsAtt}"/>`;
    }


    let padding = 0;
    adjustViewBox(svgPreview, padding)

    // create clean copy for svg out
    let [x, y, width, height] = svgPreview.getAttribute('viewBox').split(/,| /).map(Number);
    [x, y, width, height] = [x, y, width, height].map(val => +val.toFixed(2))
    //console.log(settings);

    if (showFill) {
        svgPreview.classList.add('showFill');
    } else {
        svgPreview.classList.remove('showFill');
    }


    //console.log('showMarkers', showMarkers);
    if (showMarkers) {
        svgPreview.classList.add('showMarkers');
    } else {
        svgPreview.classList.remove('showMarkers');
    }

    svgOut = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${[x, y, width, height].join(' ')}">
    ${svgOut}
    </svg>`;
    svgOutput.value = svgOut


    /**
     * show sample config
     */
    if (settings.tolerance) {
        settings.quality = settings.tolerance;
    }

    let keys = Object.keys(settings);
    let values = Object.values(settings);

    let exclude = ['selectSamples', 'showFill', 'showMarkers', 'inputPoly', 'tolerance'];


    let sampleConfig = `import {polySimplify} from 'https://cdn.jsdelivr.net/npm/poly-simplify@latest/dist/poly-simplify.esm.js';\n\nlet options={\n`

    let lines = [];
    for (let i = 0, l = values.length; i < l; i++) {
        let prop = keys[i];

        if (exclude.includes(prop)) continue;
        let val = isNaN(values[i]) ? `\`${values[i]}\`` : values[i];
        lines.push(`\t${prop}: ${val}`);

    }

    sampleConfig += `${lines.join(',\n')}\n}\n\nlet inputPoly = \`${settings.inputPoly}\`;\nlet ptsSimplified = polySimplify(inputPoly, options);\n\nconsole.log(ptsSimplified);`;

    configOut.value = sampleConfig;


}


function adjustViewBox(svg, padding = 0, decimals = 3) {
    let bb = svg.getBBox();
    let [x, y, width, height] = [bb.x, bb.y, bb.width, bb.height];
    let dimAV = (width + height) / 2;

    // avoid zero height or width
    width = width ? width : dimAV;
    height = height ? height : dimAV;

    if (padding) {
        let dimMax = Math.max(width + padding, height + padding)
        x -= (dimMax - width) / 2
        y -= (dimMax - height) / 2
        width = dimMax
        height = dimMax
    }

    svg.setAttribute("viewBox", [x, y, width, height].map(val => { return +val.toFixed(decimals) }).join(" "));
}
