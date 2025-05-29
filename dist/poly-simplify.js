(function (exports) {
    'use strict';

    /**
     * split compound paths into 
     * sub path data array
     */
    function splitSubpaths(pathData) {

        let subPathArr = [];

        try {
            let subPathIndices = pathData.map((com, i) => (com.type.toLowerCase() === 'm' ? i : -1)).filter(i => i !== -1);

        } catch {
            console.log('catch', pathData);
        }

        let subPathIndices = pathData.map((com, i) => (com.type.toLowerCase() === 'm' ? i : -1)).filter(i => i !== -1);

        // no compound path
        if (subPathIndices.length === 1) {
            return [pathData]
        }
        subPathIndices.forEach((index, i) => {
            subPathArr.push(pathData.slice(index, subPathIndices[i + 1]));
        });

        return subPathArr;
    }

    function parsePathNorm(d) {
        return pathDataToLonghands(pathDataToAbsolute(parse(d)));
    }

    function pathDataToPoly(pathData) {

        let pts = [{ x: pathData[0].values[0], y: pathData[0].values[1] }];

        for (let i = 1, l = pathData.length; i < l; i++) {
            let { values } = pathData[i];
            if (values.length) {
                let valsLast = values.slice(-2);
                pts.push({ x: valsLast[0], y: valsLast[1] });
            }
        }

        return pts;
    }

    /*
    export function pathDataToPoly(d) {

        let pathData = pathDataToLonghands(pathDataToAbsolute(parse(d)));
        let pts = [{ x: pathData[0].values[0], y: pathData[0].values[1] }];

        for (let i = 1, l = pathData.length; i < l; i++) {
            let { values } = pathData[i];
            if (values.length) {
                let valsLast = values.slice(-2);
                pts.push({ x: valsLast[0], y: valsLast[1] })
            }
        }

        return pts;
    }
    */

    function parse(path, debug = true) {

        const paramCounts = {
            // Move (absolute & relative)
            0x4D: 2, 0x6D: 2,

            // Arc
            0x41: 7, 0x61: 7,

            // Cubic Bézier
            0x43: 6, 0x63: 6,
            // Horizontal Line
            0x48: 1, 0x68: 1,

            // Line To
            0x4C: 2, 0x6C: 2,

            // Quadratic Bézier
            0x51: 4, 0x71: 4,

            // Smooth Cubic Bézier
            0x53: 4, 0x73: 4,

            // Smooth Quadratic Bézier
            0x54: 2, 0x74: 2,

            // Vertical Line
            0x56: 1, 0x76: 1,

            // Close Path
            0x5A: 0, 0x7A: 0
        };

        let commandSet = new Set([...Object.keys(paramCounts).map(Number)]);

        const SPECIAL_SPACES = new Set([
            0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
            0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF
        ]);

        function isSpace(ch) {
            return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029) || // Line terminators
                // White spaces or comma
                (ch === 0x002C) || (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) ||
                (ch >= 0x1680 && SPECIAL_SPACES.has(ch) >= 0);
        }

        function isCommandType(code) {
            return commandSet.has(code);
        }

        let i = 0, len = path.length;
        let lastCommand = "";
        let pathData = [];
        let itemCount = -1;
        let val = '';
        let wasE = false;
        let wasSpace = false;
        let floatCount = 0;
        let valueIndex = 0;
        let maxParams = 0;
        let needsNewSegment = false;

        let log = [];
        let feedback;

        const addSeg = () => {
            // Create new segment if needed before adding the minus sign
            if (needsNewSegment) {

                // sanitize implicit linetos
                if (lastCommand === 'M') lastCommand = 'L';
                else if (lastCommand === 'm') lastCommand = 'l';

                pathData.push({ type: lastCommand, values: [] });
                itemCount++;
                valueIndex = 0;
                needsNewSegment = false;

            }
        };

        const pushVal = (checkFloats = false) => {

            // regular value or float
            if (!checkFloats ? val !== '' : floatCount > 0) {

                // error: no first command
                if (debug && itemCount === -1) {

                    feedback = 'Pathdata must start with M command';
                    log.push(feedback);

                    // add M command to collect subsequent errors
                    lastCommand = 'M';
                    pathData.push({ type: lastCommand, values: [] });
                    maxParams = 2;
                    valueIndex = 0;
                    itemCount++;

                }

                if (lastCommand === 'A' || lastCommand === 'a') {
                    val = sanitizeArc();
                    pathData[itemCount].values.push(...val);

                } else {
                    // error: leading zeroes
                    if (debug && val[1] && val[1] !== '.' && val[0] === '0') {
                        feedback = 'Leading zeros not valid: ' + val;
                        log.push(feedback);
                    }

                    pathData[itemCount].values.push(+val);
                }

                valueIndex++;
                val = '';
                floatCount = 0;

                // Mark that a new segment is needed if maxParams is reached
                needsNewSegment = valueIndex >= maxParams;
            }

        };

        const sanitizeArc = () => {

            let valLen = val.length;
            let arcSucks = false;

            // large arc and sweep
            if (valueIndex === 3 && valLen === 2) {

                val = [+val[0], +val[1]];
                arcSucks = true;
                valueIndex++;
            }

            // sweep and final
            else if (valueIndex === 4 && valLen > 1) {

                val = [+val[0], +val[1]];
                arcSucks = true;
                valueIndex++;
            }

            // large arc, sweep and final pt combined
            else if (valueIndex === 3 && valLen >= 3) {

                val = [+val[0], +val[1], +val.substring(2)];
                arcSucks = true;
                valueIndex += 2;
            }

            return !arcSucks ? [+val] : val;

        };

        const validateCommand = () => {
            if (debug) {
                let lastCom = itemCount > 0 ? pathData[itemCount] : 0;
                let valLen = lastCom ? lastCom.values.length : 0;

                if ((valLen && valLen < maxParams) || (valLen && valLen > maxParams) || ((lastCommand === 'z' || lastCommand === 'Z') && valLen > 0)) {
                    let diff = maxParams - valLen;
                    feedback = `Pathdata commands in "${lastCommand}" (segment index: ${itemCount}) don't match allowed number of values: ${diff}/${maxParams}`;
                    log.push(feedback);
                }
            }
        };

        while (i < len) {
            let char = path[i];
            let charCode = path.charCodeAt(i);

            // New command
            if (isCommandType(charCode)) {

                // command is concatenated without whitespace
                if (val !== '') {
                    pathData[itemCount].values.push(+val);
                    valueIndex++;
                    val = '';
                }

                // check if previous command was correctly closed
                validateCommand();

                // new command type
                lastCommand = char;
                maxParams = paramCounts[charCode];
                let isM = lastCommand === 'M' || lastCommand === 'm';
                let wasClosePath = itemCount > 0 && (pathData[itemCount].type === 'z' || pathData[itemCount].type === 'Z');

                // add omitted M command after Z
                if (wasClosePath && !isM) {
                    pathData.push({ type: 'm', values: [0, 0] });
                    itemCount++;
                }

                pathData.push({ type: lastCommand, values: [] });
                itemCount++;

                // reset counters
                wasSpace = false;
                floatCount = 0;
                valueIndex = 0;
                needsNewSegment = false;

                i++;
                continue;
            }

            // Separated by White space 
            if (isSpace(charCode)) {

                // push value
                pushVal();

                wasSpace = true;
                wasE = false;
                i++;
                continue;
            }

            // if last
            else if (i === len - 1) {

                val += char;

                // push value
                pushVal();
                wasSpace = false;
                wasE = false;

                validateCommand();
                break;
            }

            // minus or float separated
            if ((!wasE && !wasSpace && charCode === 0x2D) ||
                (!wasE && charCode === 0x2E)
            ) {

                // checkFloats changes condition for value adding
                let checkFloats = charCode === 0x2E;

                // new val
                pushVal(checkFloats);

                // new segment
                addSeg();

                // concatenated floats
                if (checkFloats) {
                    floatCount++;
                }
            }

            // regular splitting
            else {
                addSeg();
            }

            val += char;

            // e/scientific notation in value
            wasE = (charCode === 0x45 || charCode === 0x65);
            wasSpace = false;
            i++;
        }

        validateCommand();

        pathData[0].type = 'M';

        // return error log
        if (debug && log.length) {
            feedback = 'Invalid path data:\n' + log.join('\n');
            if (debug === 'log') {
                console.warn(feedback);
            } else {
                throw new Error(feedback)
            }
        }

        return pathData

    }

    /**
     * convert pathData to 
     * This is just a port of Dmitry Baranovskiy's 
     * pathToRelative/Absolute methods used in snap.svg
     * https://github.com/adobe-webplatform/Snap.svg/
     */

    function pathDataToAbsoluteOrRelative(pathData, toRelative = false) {

        let M = pathData[0].values;
        let x = M[0],
            y = M[1],
            mx = x,
            my = y;

        for (let i = 1, len = pathData.length; i < len; i++) {
            let com = pathData[i];
            let { type, values } = com;
            let newType = toRelative ? type.toLowerCase() : type.toUpperCase();

            if (type !== newType) {
                type = newType;
                com.type = type;

                switch (type) {
                    case "a":
                    case "A":
                        values[5] = toRelative ? values[5] - x : values[5] + x;
                        values[6] = toRelative ? values[6] - y : values[6] + y;
                        break;
                    case "v":
                    case "V":
                        values[0] = toRelative ? values[0] - y : values[0] + y;
                        break;
                    case "h":
                    case "H":
                        values[0] = toRelative ? values[0] - x : values[0] + x;
                        break;
                    case "m":
                    case "M":
                        if (toRelative) {
                            values[0] -= x;
                            values[1] -= y;
                        } else {
                            values[0] += x;
                            values[1] += y;
                        }
                        mx = toRelative ? values[0] + x : values[0];
                        my = toRelative ? values[1] + y : values[1];
                        break;
                    default:
                        if (values.length) {
                            for (let v = 0; v < values.length; v++) {
                                values[v] = toRelative
                                    ? values[v] - (v % 2 ? y : x)
                                    : values[v] + (v % 2 ? y : x);
                            }
                        }
                }
            }

            let vLen = values.length;
            switch (type) {
                case "z":
                case "Z":
                    x = mx;
                    y = my;
                    break;
                case "h":
                case "H":
                    x = toRelative ? x + values[0] : values[0];
                    break;
                case "v":
                case "V":
                    y = toRelative ? y + values[0] : values[0];
                    break;
                case "m":
                case "M":
                    mx = values[vLen - 2] + (toRelative ? x : 0);
                    my = values[vLen - 1] + (toRelative ? y : 0);
                default:
                    x = values[vLen - 2] + (toRelative ? x : 0);
                    y = values[vLen - 1] + (toRelative ? y : 0);
            }
        }

        pathData[0].type = 'M';

        return pathData;
    }

    function pathDataToRelative(pathData) {
        return pathDataToAbsoluteOrRelative(pathData, true)
    }

    function pathDataToAbsolute(pathData) {
        return pathDataToAbsoluteOrRelative(pathData, false)
    }

    /**
     * decompose/convert shorthands to "longhand" commands:
     * H, V, S, T => L, L, C, Q
     * reversed method: pathDataToShorthands()
     */

    function pathDataToLonghands(pathData) {

        let pathDataLonghand = [{ type: "M", values: pathData[0].values }];
        let comPrev = pathDataLonghand[0];

        for (let i = 1, len = pathData.length; i < len; i++) {
            let com = pathData[i];
            let { type, values } = com;
            let valuesL = values.length;
            let valuesPrev = comPrev.values;
            let valuesPrevL = valuesPrev.length;
            let [x, y] = [values[valuesL - 2], values[valuesL - 1]];
            let [prevX, prevY] = [
                valuesPrev[valuesPrevL - 2],
                valuesPrev[valuesPrevL - 1]
            ];
            switch (type) {
                case "H":
                    comPrev = {
                        type: "L",
                        values: [values[0], prevY]
                    };
                    break;
                case "V":
                    comPrev = {
                        type: "L",
                        values: [prevX, values[0]]
                    };
                    break;
                case "z":
                case "Z":
                    comPrev = {
                        type: "Z",
                        values: []
                    };
                    break;

                case "M":
                    comPrev = {
                        type: "M",
                        values: [values[0], values[1]]
                    };
                    break;

                default:
                    comPrev = {
                        type: 'L',
                        values: [x, y]
                    };
            }
            pathDataLonghand.push(comPrev);
        }
        return pathDataLonghand;
    }

    // round pathData
    function minifyPathData(pathData, decimals = -1, toRelative = false,
        toShorthands = false) {
        if (toShorthands) pathData = pathDataToShorthands(pathData);
        if (toRelative) pathData = pathDataToRelative(pathData);
        if (decimals > -1) {
            pathData = pathData.map(com => {

                return { type: com.type, values: com.values.map(val => +val.toFixed(decimals)) }
            });
        }

        return pathData;
    }

    /**
     * Serialize pathData array to a minified "d" attribute string.
     */
    function pathDataToD(pathData, optimize = 1) {

        pathData = JSON.parse(JSON.stringify(pathData));

        let beautify = optimize > 1;
        let minify = beautify ? false : true;

        // Convert first "M" to "m" if followed by "l" (when minified)
        if (pathData[1].type === "l" && minify) {
            pathData[0].type = "m";
        }

        let d = '';
        if (beautify) {
            d = `${pathData[0].type} ${pathData[0].values.join(" ")}\n`;
        } else {
            d = `${pathData[0].type}${pathData[0].values.join(" ")}`;
        }

        for (let i = 1, len = pathData.length; i < len; i++) {
            let com0 = pathData[i - 1];
            let com = pathData[i];
            let { type, values } = com;

            // Minify Arc commands (A/a) – actually sucks!
            if (minify && (type === 'A' || type === 'a')) {
                values = [
                    values[0], values[1], values[2],
                    `${values[3]}${values[4]}${values[5]}`,
                    values[6]
                ];
            }

            // Omit type for repeated commands
            type = (com0.type === com.type && com.type.toLowerCase() !== 'm' && minify)
                ? " "
                : (
                    (com0.type === "m" && com.type === "l") ||
                    (com0.type === "M" && com.type === "l") ||
                    (com0.type === "M" && com.type === "L")
                ) && minify
                    ? " "
                    : com.type;

            // concatenate subsequent floating point values
            if (minify) {

                let valsString = '';
                let prevWasFloat = false;

                for (let v = 0, l = values.length; v < l; v++) {
                    let val = values[v];
                    let valStr = val.toString();
                    let isFloat = valStr.includes('.');
                    let isSmallFloat = isFloat && Math.abs(val) < 1;

                    // Remove leading zero from small floats *only* if the previous was also a float
                    if (isSmallFloat && prevWasFloat) {
                        valStr = valStr.replace(/^0\./, '.');
                    }

                    // Add space unless this is the first value OR previous was a small float
                    if (v > 0 && !(prevWasFloat && isSmallFloat)) {
                        valsString += ' ';
                    }

                    valsString += valStr;

                    prevWasFloat = isSmallFloat;
                }

                d += `${type}${valsString}`;

            }
            // regular non-minified output
            else {
                if (beautify) {
                    d += `${type} ${values.join(' ')}\n`;
                } else {
                    d += `${type}${values.join(' ')}`;
                }
            }
        }

        if (minify) {
            d = d
                // Space before small decimals
                .replace(/ 0\./g, " .")
                // Remove space before negatives
                .replace(/ -/g, "-")
                // Remove leading zero from negative decimals
                .replace(/-0\./g, "-.")
                // Convert uppercase 'Z' to lowercase
                .replace(/Z/g, "z");
        }

        return d;
    }

    /**
     * apply shorthand commands if possible
     * L, L, C, Q => H, V, S, T
     * reversed method: pathDataToLonghands()
     */
    function pathDataToShorthands(pathData) {

        let pathDataShorts = [{ type: "M", values: pathData[0].values }];
        let comShort = pathDataShorts[0];

        let p0 = { x: pathData[0].values[0], y: pathData[0].values[1] };
        let p;
        let tolerance = 0.01;

        for (let i = 1, len = pathData.length; i < len; i++) {

            let com = pathData[i];
            let { type, values } = com;
            let valuesLast = values.length ? values.slice(-2) : [];

            p = { x: valuesLast[0], y: valuesLast[1] };

            let w = Math.abs(p.x - p0.x);
            let h = Math.abs(p.y - p0.y);
            let thresh = (w + h) / 2 * tolerance;

            switch (type) {
                case "L":
                    // H
                    if (h === 0 || (h < thresh && w > thresh)) {
                        comShort = {type: "H",values: [values[0]]};
                    }

                    // V
                    else if (w === 0 || (h > thresh && w < thresh)) {
                        comShort = {type: "V",values: [values[1]]};
                    } else {
                        comShort = com;
                    }

                    break;

                case 'M':
                case 'Z':
                case 'z':
                    comShort = {type ,values: valuesLast};
                    break;

                default:
                    comShort = {
                        type: 'L',
                        values: valuesLast
                    };
            }

            p0 = { x: valuesLast[0], y: valuesLast[1] };
            pathDataShorts.push(comShort);
        }
        return pathDataShorts;
    }

    function normalizePointInput(pts) {

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
        };

        // decouple from constructor object type - e.g SVGPoints

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
            isCompound = suPaths.length>1;

            let ptArr = [];
            if(isCompound){
                suPaths.forEach(pathData=>{

                    let ptsSub = pathDataToPoly(pathData);

                    ptArr.push(ptsSub);

                });

            }else {
                ptArr = pathDataToPoly(pathData);
            }

            return ptArr
        }

        // 2.1 check if it's JSON
        let isJSON = isString ? pts.startsWith('{') || pts.startsWith('[') : false;

        // 2.1.1: if JSON – parse data
        if (isJSON) {
            pts = JSON.parse(pts);
            isString = false;

        }

        // 2.2: stringified poly notation – split to array
        if (isString) {
            pts = pts.trim().split(/,| /).filter(Boolean).map(Number);

            // 2.3: nonsense string input
            let hasNaN = pts.filter(pt => isNaN(pt)).length;
            if (hasNaN) {
                console.warn("input doesn't contain point data – please, check your input structure for syntax errors");
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
        if (isNested) {
            pts = pts.map((pt) => {
                return { x: pt[0], y: pt[1] };
            });
        }

        // 3.2: flat array – group x/y

        let isFlat = !Array.isArray(pts[0]) && !pts[0].hasOwnProperty('x');
        if (isFlat) pts = toPointArray(pts);

        return pts;
    }

    function getSquareDistance(p1, p2) {
        return (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
    }

    function detectRegularPolygon(pts) {
        let lastDist = getSquareDistance(pts[0], pts[1]);
        let isRegular = true;

        for (let i = 3, l = pts.length; i < l; i++) {
            let pt1 = pts[i - 1];
            let pt2 = pts[i];
            let dist = getSquareDistance(pt1, pt2);
            let distDiff = 100 / lastDist * Math.abs(lastDist - dist);

            if (distDiff > 0.1) {
                return false;
            }

            lastDist = dist;
        }
        return isRegular;
    }

    /**
     * reduce polypoints
     * for sloppy dimension approximations
     */
    function reducePoints(points, maxPoints = 48) {
        if (!Array.isArray(points) || points.length <= maxPoints) return points;

        // Calculate how many points to skip between kept points
        let len = points.length;
        let step = len / maxPoints;
        let reduced = [];

        for (let i = 0; i < maxPoints; i++) {
            reduced.push(points[Math.floor(i * step)]);
        }

        let lenR = reduced.length;
        // Always include the last point to maintain path integrity
        if (reduced[lenR - 1] !== points[len - 1]) {
            reduced[lenR - 1] = points[len - 1];
        }

        return reduced;
    }

    function getPolygonArea(points, absolute = false) {
        let area = 0;
        for (let i = 0, len = points.length; len && i < len; i++) {
            let addX = points[i].x;
            let addY = points[i === points.length - 1 ? 0 : i + 1].y;
            let subX = points[i === points.length - 1 ? 0 : i + 1].x;
            let subY = points[i].y;
            area += addX * addY * 0.5 - subX * subY * 0.5;
        }
        return absolute ? Math.abs(area) : area;
    }

    function getPolyBBox(vertices) {
        let xArr = vertices.map(pt => pt.x);
        let yArr = vertices.map(pt => pt.y);
        let left = Math.min(...xArr);
        let right = Math.max(...xArr);
        let top = Math.min(...yArr);
        let bottom = Math.max(...yArr);
        let bb = {
            x: left,
            left: left,
            right: right,
            y: top,
            top: top,
            bottom: bottom,
            width: right - left,
            height: bottom - top
        };

        return bb;
    }

    function scalePolygon(pts, scale = 1, translateX = 0, translateY = 0, alignToZero = false, scaleToWidth = 0, scaleToHeight = 0) {

        if (scale === 1 && scaleToWidth === 0 && scaleToHeight === 0 && translateX === 0 && translateY === 0 && alignToZero === false) return pts;

        let x, y, width, height;

        let isCompound = Array.isArray(pts[0]);

        let ptsArr = isCompound ? pts : [pts];
        let ptsFlat = isCompound ? pts.flat() : pts;

        ({ x, y, width, height } = getPolyBBox(ptsFlat));

        ptsArr.forEach((pts,p) => {
            scale = scaleToWidth ? scaleToWidth / width : (scaleToHeight ? scaleToHeight / height : scale);

            // if both are defined - adjust to fit in box max dimension
            if (scaleToHeight) {
                if (height * scale > scaleToHeight) {
                    scale = scaleToHeight / height;
                }
            }

            if (alignToZero) {
                translateX = -x;
                translateY = -y;
            }

            for (let i = 0, l = pts.length; i < l; i++) {
                let pt = pts[i];
                ptsArr[p][i] = { x: (pt.x + translateX) * scale, y: (pt.y + translateY) * scale };
            }
        });

        return ptsArr ;
    }

    // output helper
    function getOutputData(polyArr, polyArrSimpl, outputFormat = 'points', meta = false, decimals = -1, toRelative = false,
        toShorthands = false, minifyString = false, scale = 1, translateX = 0, translateY = 0, alignToZero = false, scaleToWidth = 0, scaleToHeight = 0) {

        let outputObj = {
            data: [],

            ptsArr: [],
            countOriginal: 0,
            count: 0,
            areaOriginal: 0,
            areaptsSmp: 0,
            areaDiff: 0,
            isPolygon: []
        };

        /**
         * scale points
         * useful for tiny polygons
         */
        polyArrSimpl = scalePolygon(polyArrSimpl, scale, translateX, translateY, alignToZero, scaleToWidth, scaleToHeight);

        for (let i = 0, l = polyArrSimpl.length; i < l; i++) {

            // original points
            let pts = polyArr[i];

            let ptsSmp = polyArrSimpl[i];

            // original vertices count
            let total = pts.length;
            outputObj.countOriginal += total;

            // simplified vertices count
            let totalSmpl = ptsSmp.length;
            outputObj.count += totalSmpl;

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
                let closingThresh = (dimAvg / pts.length) ** 2;

                let closingDist = getSquareDistance(pts[0], pts[pts.length - 1]);
                isPolygon = closingDist < closingThresh;
                outputObj.isPolygon.push(isPolygon);

                // area deviation in percent
                let areaDiff = meta ? +(100 / areaptsSmp * Math.abs(areaOriginal - areaptsSmp)).toFixed(3) : 0;
                outputObj.areaDiff += areaDiff;
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
                    outputObj.data = outputObj.ptsArr;
                }

                else if (outputFormat === 'pointsnested') {
                    outputObj.data = outputObj.ptsArr.map(pts => pts.map(pt => [pt.x, pt.y]));
                }

                else if (outputFormat === 'json') {
                    outputObj.data = JSON.stringify(outputObj.ptsArr);
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
                        pathData.push({ type: 'Z', values: [] });
                    }

                    pathDataCompound.push(...pathData);
                });

                // minify/optimize
                pathDataCompound = minifyPathData(pathDataCompound, decimals, toRelative, toShorthands);

                if (outputFormat === 'path') {
                    outputObj.data = [pathDataToD(pathDataCompound, (minifyString ? 1 : 0))];
                } else {
                    outputObj.data = pathDataCompound;
                }

        }

        return outputObj
    }

    function polySimplify_core
        (pts, {
            tolerance = 0.9,

            // simplifification algorithms
            removeColinear = true,
            useRDP = true,
            radialDistance = false,

            detectRegular = false,
            decimals = -1,
            maxVertices = Infinity,
            toMaxVertices = false,
            outputFormat = 'points',
            scale = 1,
            alignToZero = false,
            translateX = 0,
            translateY = 0,
            scaleToWidth = 0,
            scaleToHeight = 0,
            meta = false,
            // options for pathData output
            toRelative = false,
            toShorthands = false,
            minifyString = false
        } = {}) {

        // normalize
        try{
            pts = normalizePointInput(pts);
        }catch{
            console.warn('invalid input');
            pts = [{x:0, y:0}];
            return pts;
        }

        // if is compound
        let isCompound = pts[0].length > 1;

        /**
         * normalize to array for 
         * compound polygons or paths
         */

        let polyArr = isCompound ? pts : [pts];

        let polyArrSimpl = [];

        for (let i = 0, l = polyArr.length; i < l; i++) {

            let pts = polyArr[i];

            // regular polygon detection
            let isRegular = false;

            // no points - exit
            if (!pts.length) return [];

            // collect simplified point array
            let ptsSmp = pts;

            // line segments or no simplification
            if (pts.length <= 2 || tolerance === 1) {
                polyArrSimpl.push(ptsSmp);
                continue;
            }

            /**
             * 0. reduce vertices to 
             * maximum limit
             * brute force but very fast for huge 
             * point arrays
             */
            if (toMaxVertices && maxVertices < Infinity) {

                ptsSmp = reducePoints(pts, maxVertices);
                polyArrSimpl.push(ptsSmp);
                continue
            }

            /**
             * 1. lossless simplification
             * only remove zero-length segments/coinciding points
             * or flat segments
             */

            ptsSmp = removeColinear ? simplifyRemoveColinear(ptsSmp) : ptsSmp;

            /** 
             * 1.1 radial distance
             * sloppy but fast
             */

            ptsSmp = radialDistance ? simplifyPolyRadialDistance(ptsSmp, tolerance) : ptsSmp;

            /**
             * check regular polygons
             * if it's regular:
             * we skip RDP simplification
             */

            if (detectRegular) {

                isRegular = detectRegularPolygon(ptsSmp);
                if (isRegular) useRDP = false;
            }

            /**
             * 2. Ramer-Douglas-Peucker simplification
             */
            if (useRDP && tolerance<1) {

                ptsSmp = simplifyPolyRDP(ptsSmp, tolerance);
            }

            // add to final pts array
            polyArrSimpl.push(ptsSmp);

        }

        let out = getOutputData(polyArr, polyArrSimpl, outputFormat, meta, decimals, toRelative, toShorthands, minifyString, scale, translateX, translateY, alignToZero, scaleToWidth, scaleToHeight);

        // return either sub poly array or single data item
        return meta ? out : (!isCompound ? out.data[0] : out.data);
    }

    // Browser global
    if (typeof window !== 'undefined') {
        window.polySimplify = polySimplify_core;
    }

    /**
    * "lossless" simplification:
    * remove zero length or 
    * horizontal or vertical segments
    * geometry should be perfectly retained
    */

    function simplifyRemoveColinear(pts) {

        let pt0 = pts[0];
        let ptsSmp = [pt0];

        for (let i = 2, l = pts.length; i < l; i++) {
            let pt1 = pts[i - 1];
            let pt2 = pts[i];
            let squareDistance = 0;

            // collinear segments
            if ((pt0.x === pt1.x && pt0.y !== pt1.y) || (pt0.x !== pt1.x && pt0.y === pt1.y)) {

                // not all segments are flat - add mid point
                if (!(pt2.x === pt1.x && pt2.y !== pt1.y) && !(pt2.x !== pt1.x && pt2.y === pt1.y)) {
                    ptsSmp.push(pt1);
                }
                pt0 = pt1;
                continue
            }

            // not zero length or vertical or horizontal
            if (!(pt0.x === pt1.x && pt0.y === pt1.y) &&
                !(pt0.x === pt1.x && pt0.y !== pt1.y) &&
                !(pt0.x !== pt1.x && pt0.y === pt1.y)) {

                // get current square distance
                squareDistance = getSquareDistance(pt1, pt2);

                // check area to detect flat segments
                let area = getPolygonArea([pt0, pt1, pt2], true);
                let areaThreshold = squareDistance * 0.01;
                let isFlat = !area ? true : (squareDistance ? area < areaThreshold : true);

                if (!isFlat) {
                    ptsSmp.push(pt1);
                }
            }

            pt0 = pt1;

            // add last vertice
            if (i === l - 1) {
                ptsSmp.push(pts[pts.length - 1]);
            }
        }

        return ptsSmp;
    }

    /**
     * radialDistance simplification
     * sloppy but fast
     */

    function simplifyPolyRadialDistance(pts, quality = 0.9){

        let p0 = pts[0];
        let ptLast = pts[pts.length-1];
        let pt;
        let ptsSmp = [p0];

        /**
         * approximate dimensions
         * adjust tolerance for 
         * very small polygons e.g geodata
         */

        let polyS = reducePoints(pts, 12);
        let { width, height } = getPolyBBox(polyS);

        // average side lengths
        let dimAvg= (width+height)/2;
        let scale = dimAvg/25;

        // convert quality to squaredistance tolerance
        let tolerance = 1-quality;
        let toleranceNew = tolerance * (scale);
        tolerance = toleranceNew**2;

        for (let i = 1, l = pts.length-1; i < l; i++) {
            pt = pts[i];
            let dist = getSquareDistance(p0, pt);

            if (dist > tolerance) {
                ptsSmp.push(pt);
                p0 = pt;
            }
        }

        // add last point - if not coinciding with first point
        if (p0.x !== ptLast.x && p0.y !== ptLast.y ) {

            ptsSmp.push(pt);
        }

        return ptsSmp;

    }

    /**
     * Ramer-Douglas-Peucker-Algorithm
     * for polyline simplification
     * See also: 
     * https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
     * and https://karthaus.nl/rdp/
     */

    function simplifyPolyRDP(pts, quality = 0.9) {

        if (pts.length <= 2 || quality>=1) return pts;

        // convert quality to squaredistance tolerance
        let tolerance = 1-quality;

        /**
         * approximate dimensions
         * adjust tolerance for 
         * very small polygons e.g geodata
         */

        let polyS = reducePoints(pts, 32);
        let { width, height } = getPolyBBox(polyS);

        // average side lengths
        let dimAvg= (width+height)/2;
        let scale = dimAvg/100;

        let toleranceNew = tolerance * (scale);
        tolerance = toleranceNew**2;

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

    exports.minifyPathData = minifyPathData;
    exports.normalizePointInput = normalizePointInput;
    exports.pathDataToD = pathDataToD;
    exports.polySimplify = polySimplify_core;
    exports.simplifyPolyRDP = simplifyPolyRDP;
    exports.simplifyPolyRadialDistance = simplifyPolyRadialDistance;
    exports.simplifyRemoveColinear = simplifyRemoveColinear;

})(this["poly-simplify"] = this["poly-simplify"] || {});
