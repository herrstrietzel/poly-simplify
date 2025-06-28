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

    pathData = pathData.map(com=>{return {type:com.type, values:com.values.map(val=>+val.toFixed(9))} });

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
    let minify = beautify || optimize===0 ? false : true;

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
        let ptsN = [];
        pts.forEach(sub => {
            let pts = isCompoundPolyFlat ? toPointArray(sub) : sub.map((pt) => { return { x: pt[0], y: pt[1] }; });
            ptsN.push(pts);
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
 * reorder vertices to
 * avoid mid points on colinear segments
 */

function sortPolygonLeftTopFirst(pts, isPolygon = null) {

  if (pts.length === 0) return pts;

  isPolygon = isPolygon === null ? isClosedPolygon(pts) : isPolygon;

  if (!isPolygon) return pts;

  let firstIndex = 0;
  for (let i = 1, l = pts.length; i < l; i++) {
    let current = pts[i];
    let first = pts[firstIndex];
    if (current.x < first.x || (current.x === first.x && current.y < first.y)) {
      firstIndex = i;
    }
  }

  let ptsN = pts.slice(firstIndex).concat(pts.slice(0, firstIndex));
  return ptsN;
}

/**
 * check whether a polygon is likely 
 * to be closed 
 * or an open polyline 
 */
function isClosedPolygon(pts, reduce = 24) {

  let ptsR = reducePoints$1(pts, reduce);
  let { width, height } = getPolyBBox$1(ptsR);

  let dimAvg = (width + height) / 2;

  let closingThresh = (dimAvg) ** 2;
  let closingDist = getSquareDistance(pts[0], pts[pts.length - 1]);

  return closingDist < closingThresh;
}

/**
 * reduce polypoints
 * for sloppy dimension approximations
 */
function reducePoints$1(points, maxPoints = 48) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;

  // Calculate how many points to skip between kept points
  let len = points.length;
  let step = len / maxPoints;
  let reduced = [points[0]];

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

function getPolygonArea(pts, absolute = true) {
  let area = 0;
  for (let i = 0, len = pts.length; len && i < len; i++) {
    let ptN = pts[i === len - 1 ? 0 : i + 1];
    let addX = pts[i].x;
    let addY = ptN.y;
    let subX = ptN.x;
    let subY = pts[i].y;
    area += addX * addY * 0.5 - subX * subY * 0.5;
  }
  return absolute ? Math.abs(area) : area;
}

function getPolyBBox$1(vertices) {
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

  ({ x, y, width, height } = getPolyBBox$1(ptsFlat));

  ptsArr.forEach((pts, p) => {
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

  return ptsArr;
}

/**
 * unite self intersecting polygons
 * based on J. Holmes's answer
 * https://stackoverflow.com/a/10673515/15015675
 */

function unitePolygon(poly) {
  const getSelfIntersections = (pts, pt0, pt1) => {
    const getLineIntersection = (pt0, pt1, pt2, pt3) => {
      let [x1, x2, x3, x4] = [pt0.x, pt1.x, pt2.x, pt3.x];
      let [y1, y2, y3, y4] = [pt0.y, pt1.y, pt2.y, pt3.y];

      // get x/y deltas
      let [dx1, dx2] = [x1 - x2, x3 - x4];
      let [dy1, dy2] = [y1 - y2, y3 - y4];

      // Calculate the denominator of the intersection point formula (cross product)
      let denominator = dx1 * dy2 - dy1 * dx2;

      // denominator === 0: lines are parallel - no intersection
      if (denominator === 0) return null;

      // Cross products of the endpoints
      let cross1 = x1 * y2 - y1 * x2;
      let cross2 = x3 * y4 - y3 * x4;

      let x = (cross1 * dx2 - dx1 * cross2) / denominator;
      let y = (cross1 * dy2 - dy1 * cross2) / denominator;

      // Check if the x and y coordinates are within both lines boundaries
      if (
        x < Math.min(x1, x2) ||
        x > Math.max(x1, x2) ||
        x < Math.min(x3, x4) ||
        x > Math.max(x3, x4) ||
        y < Math.min(y1, y2) ||
        y > Math.max(y1, y2) ||
        y < Math.min(y3, y4) ||
        y > Math.max(y3, y4)
      ) {
        return null;
      }

      return { x, y };
    };

    const squaredDist = (p1, p2) => {
      return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
    };

    const len = pts.length;

    // collect intersections
    let intersections = [];

    let segLenSq = squaredDist(pt0, pt1);
    let thresh = segLenSq / 1000;

    for (let i = 0; i < len; i++) {
      let pt2 = pts[i];
      let pt3 = pts[(i + 1) % len];

      // Skip if this is the segment itself
      if (pt3 === pt1) continue;

      let intersectionPoint = getLineIntersection(pt0, pt1, pt2, pt3);

      if (intersectionPoint) {
        const lengthSq = squaredDist(pt0, intersectionPoint);

        if (lengthSq > thresh && lengthSq < segLenSq) {
          intersections.push({
            pt0,
            pt1,
            startPoint: pt2,
            intersectionPoint,
            endPoint: pt3,
            lengthSq
          });
        }
      }
    }

    intersections.sort((a, b) => a.lengthSq - b.lengthSq);
    return intersections;
  };

  const len = poly.length;
  if (len < 3) return poly;

  // Set up next indices once
  for (let i = 0; i < len; i++) {
    poly[i].next = (i + 1) % len;
  }

  const newPoly = [];
  let currentPoint = poly[0];
  let nextPoint = poly[currentPoint.next];
  newPoly.push(currentPoint);

  for (let i = 0; i < len * 2; i++) {
    const intersections = getSelfIntersections(poly, currentPoint, nextPoint);

    if (intersections.length === 0) {
      newPoly.push(nextPoint);
      currentPoint = nextPoint;
      nextPoint = poly[nextPoint.next];
    } else {
      const closest = intersections[0];
      currentPoint = closest.intersectionPoint;
      nextPoint = closest.endPoint;
      newPoly.push(currentPoint);
    }

    // Closed loop detection — same position, not necessarily same object
    if (
      newPoly.length > 2 &&
      currentPoint.x === newPoly[0].x &&
      currentPoint.y === newPoly[0].y
    ) {
      break;
    }
  }

  // Remove closing duplicate point if present
  const first = newPoly[0];
  const last = newPoly[newPoly.length - 1];
  if (first.x === last.x && first.y === last.y) {
    newPoly.pop();
  }

  return newPoly;
}

function pointsToMercator(pts) {
  
    if(!isGeoData(pts)) return pts;
    
    const degToRad = (deg) => deg * (Math.PI / 180);
  
    const mercatorProject = (pt) => {
      let lat = Math.max(-85.05112878, Math.min(85.05112878, pt.y));
      let lon = pt.x;
  
      return {
        x:  (degToRad(lon) + Math.PI) / (2 * Math.PI),
        y:  (Math.PI - Math.log(Math.tan(Math.PI / 4 + degToRad(lat) / 2))) / (2 * Math.PI),
      };
    };
    
  
    let len = pts.length;
    
    /**
    * get all projected points
    */
    let ptsP = [];
    for(let i=0; i<len; i++){
      ptsP.push(mercatorProject(pts[i]));
    }
    
    // scale and translate
    let bbO = getPolyBBox$1(pts);
    let bb = getPolyBBox$1(ptsP);
    let scale = bbO.width/bb.width;
    let offsetX = (bb.x*scale-bbO.x);
    let offsetY = (bb.y*scale-bbO.y);

  
    for(let i=0; i<len; i++){
      ptsP[i].x = ptsP[i].x * scale -offsetX; 
      ptsP[i].y = ptsP[i].y * scale -offsetY;
    }
    
    return ptsP;
  }
  
  
  /**
  * check if data input
  * is geodata based
  */
  function isGeoData(pts) {
    
    const isValidCoord = (lon, lat) =>{
      return (lon >= -180 && lon <= 180 &&
      lat >= -90 && lat <= 90);
    };
  
    let samplePoints = [
      pts[0],
      pts[Math.floor(pts.length / 2)],
      pts[pts.length - 1],
    ];
    
    return samplePoints.every(p => {
        return isValidCoord(p.x, p.y); 
    });
  }

// output helper
function getOutputData(polyArr, polyArrSimpl, outputFormat = 'points', meta = false, decimals = -1, toRelative = false,
    toShorthands = false, minifyString = false, scale = 1, translateX = 0, translateY = 0, alignToZero = false, scaleToWidth = 0, scaleToHeight = 0, isCompound=false) {

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
            let ptsR = reducePoints$1(pts, 32);
            let { width, height } = getPolyBBox$1(ptsR);
            let dimAvg = Math.max(width, height);
            let closingThresh = (dimAvg / pts.length) ** 2;

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

        let polySimplFlat = polyArrSimpl.flat();
        let polyAppr = reducePoints$1(polySimplFlat, 24);

        let { width, height } = getPolyBBox$1(polyAppr);
        let dimAvg = (width + height) / 2;

        if(dimAvg>500) {
            decimals=0;
        }else {
            let complexity = polySimplFlat.length/dimAvg;
            let ratLength = dimAvg / 1000;
            let decimalsMinLen = Math.ceil(1 / ratLength).toString().length;
            let decimalsMinCompl = Math.ceil(complexity).toString().length;
        
            let decimalsMin = Math.ceil((decimalsMinLen+decimalsMinCompl)/2);

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
                    outputObj.ptsArr = outputObj.ptsArr[0];
                }

                outputObj.data = outputObj.ptsArr;
            }

            else if (outputFormat === 'pointsnested') {
                outputObj.data = outputObj.ptsArr.map(pts => pts.map(pt => [pt.x, pt.y]));
                if(!isCompound) {
                    outputObj.data = outputObj.data[0];
                    outputObj.ptsArr = outputObj.ptsArr[0];
                }

            }

            else if (outputFormat === 'json') {
                if(!isCompound) outputObj.ptsArr = outputObj.ptsArr[0];
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
                if(!isCompound) outputObj.data = outputObj.data[0];
            } else {
                outputObj.data = pathDataCompound;
            }

    }

    return outputObj
}

/**
* "lossless" simplification:
* remove zero length or 
* horizontal or vertical segments
* geometry should be perfectly retained
*/

function simplifyRC(pts, quality = 1, shiftStart = true) {

    if (pts.length < 3) return pts;

    let l = pts.length;

    // starting point
    let M = pts[0];

    // last point
    let Z = pts[l - 1];

    // remove unnecessary closing point
    if (M.x === Z.x && M.y === Z.y) {

        pts.pop();
        l--;
        Z = pts[l - 1];
    }

    // init new point array
    let ptsSmp = [M];
    let pt0 = M;
    let pt1, pt2;

    // approximate dimensions for relative threshold
    let ptsR = reducePoints$1(pts, 32);
    let polyBB = getPolyBBox$1(ptsR);

    let { width, height } = polyBB;
    let dimAvg = (width + height) / 2;

    // adjust tolerance based on points-per-dimension ratio
    let div = quality ? l * 5 * quality : 250;
    let tolerance = dimAvg / div;
    let tolerance2 = tolerance * 2.5;

    let dx0 = null;
    let dy0 = null;

    /*
    // get average square distance
    let dists = []
    let distAV = 0

    let maxPoints = 24;
    let step = Math.floor(l / maxPoints) || 1;
    console.log('step', step);
    */

    /*
    for (let i = 1; i < l; i+=step) {
        pt0 = pts[i - 1];
        pt1 = pts[i];
        let dist = getSquareDistance(pt0, pt1)
        distAV+=dist
        dists.push(dist)

    }
    distAV = distAV/(maxPoints+1)

    tolerance = distAV*0.01
    console.log(tolerance);
    */

    // loop through vertices by triangles
    for (let i = 2; i < l; i++) {
        pt1 = pts[i - 1];
        pt2 = pts[i];
        let isLast = i === l - 1;

        /**
         * 1. Skip zero-length segments
         */
        if ((pt1.x === pt0.x && pt1.y === pt0.y) || (pt1.x === pt2.x && pt1.y === pt2.y)) {

            continue;
        }

        /**
         * 2. Check for perfectly flat
         * vertical/horizontal segments
         */
        let isVertical = (pt0.x === pt1.x);
        let isHorizontal = (pt0.y === pt1.y);

        if (isVertical || isHorizontal) {

            let isVertical2 = (pt1.x === pt2.x);
            let isHorizontal2 = (pt1.y === pt2.y);

            if (((isVertical && isVertical2) || (isHorizontal && isHorizontal2))) {

                // perfectly flat segment - skip
                if (!isLast) continue;

                // flat but last – add last and skip colinearity check
                if (isLast && M.x !== pt2.x && M.y !== pt2.y) {

                    ptsSmp.push(pt2);
                    continue
                }

            }
        }
        dx0 = pt1.x - pt0.x;
        dy0 = pt1.y - pt0.y;

        let dx1 = pt2.x - pt1.x;
        let dy1 = pt2.y - pt1.y;

        let cross = Math.abs(dx0 * dy1 - dy0 * dx1);

        // 1. adjust tolerance - increase precision for detailed
        /*
        if (cross < tolerance * 0.95) {
            let dist = getSquareDistance(pt0, pt1)
            let tolerance2 = dist / 250
            console.log('adjust1');

            if (cross > tolerance2) {

                console.log('adjust1 tol');

                cross = Infinity
            }else{
                console.log('keep');
            }
        }
            */

        // 2. adjust tolerance - decrease precision for simple polys
     if (cross > tolerance && cross < tolerance2) {

            let area = getPolygonArea([pt0, pt1, pt2]);
            if (area < tolerance) {
                cross = 0;

            }

        }

        if (!isVertical && !isHorizontal && (cross < tolerance)) {

            if (!isLast) continue;

            // check if last point is colinear with first point
            if (isLast && M.x !== pt2.x && M.y !== pt2.y) {

                let dxM = pt2.x - M.x;
                let dyM = pt2.y - M.y;
                let crossM = Math.abs(dxM * dy1 - dyM * dx1);

                if (crossM > tolerance) {

                    ptsSmp.push(pt2);
                }
                continue
            }

        } else {

            // no simplification - add mid pt 
            ptsSmp.push(pt1);

            // add last point if not first
            if (isLast && M.x !== pt2.x && M.y !== pt2.y) {
                // console.log('add last', M, pt2);
                ptsSmp.push(pt2);
            }
        }

        // update previous point
        pt0 = pt1;

    }

    /**
     * check if starting point is in
     * colinear segment 
     * shift starting point
     * exclude flat horizontal or vertical lines
     */

    // remove last horizontal or vertical
    if (ptsSmp.length > 2 && ((M.x === Z.x && M.y !== Z.y) || (M.x !== Z.x && M.y === Z.y))) ;

    else if (shiftStart && M.x !== Z.x && M.y !== Z.y) {

        pt2 = ptsSmp[1];
        let dxZ = pt2.x - Z.x;
        let dyZ = pt2.y - Z.y;
        let dxM = pt2.x - M.x;
        let dyM = pt2.y - M.y;
        let crossZ = Math.abs(dxZ * dyM - dyZ * dxM);

        if (crossZ < tolerance) {

            ptsSmp.shift();
        }
    }

    return ptsSmp;
}

/**
 * radialDistance simplification
 * sloppy but fast
 */

function simplifyRD(pts, quality = 0.9, width = 0, height = 0) {

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
            let polyS = reducePoints$1(pts, 12);
            ({ width, height } = getPolyBBox$1(polyS));
        }
        // average side lengths
        let dimAvg = (width + height) / 2;
        let scale = dimAvg / 25;
        tolerance = (tolerance * (scale)) ** 2;

        if (quality > 0.5) tolerance /= 10;

    }

    for (let i = 1, l = pts.length; i < l; i++) {
        pt = pts[i];
        let dist = getSquareDistance(p0, pt);

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

/**
 * Ramer-Douglas-Peucker-Algorithm
 * for polyline simplification
 * See also: 
 * https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
 * and https://karthaus.nl/rdp/
 */

function simplifyRDP(pts, quality = 0.9, width = 0, height = 0) {

    /**
     * switch between absolute or 
     * quality based relative thresholds
     */
    let isAbsolute = false;

    if (typeof quality === 'string') {
        isAbsolute = true;
        quality = parseFloat(quality);
    }

    if (pts.length < 4 || (!isAbsolute && quality) >= 1) return pts;

    // convert quality to squaredistance tolerance
    let tolerance = quality;

    if (!isAbsolute) {
        
        tolerance = 1 - quality;

        // adjust for higher qualities
        if (quality > 0.5) tolerance /= 2;

        /**
         * approximate dimensions
         * adjust tolerance for 
         * very small polygons e.g geodata
         */
        if (!width && !height) {
            let polyS = reducePoints$1(pts, 12);
            ({ width, height } = getPolyBBox$1(polyS));
        }

        // average side lengths
        let dimAvg = (width + height) / 2;
        let scale = dimAvg / 100;
        tolerance = (tolerance * (scale)) ** 2;
    }

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

/**
 * Visvalingam-Whyatt 
 * simplification
 */
function simplifyVW(pts, quality = 1, width = 0, height = 0) {

    /**
     * switch between absolute or 
     * quality based relative thresholds
     */
    let isAbsolute = false;

    if (typeof quality === 'string') {
        isAbsolute = true;
        quality = parseFloat(quality);
    }

    if (pts.length < 4 || (!isAbsolute && quality) >= 1) return pts;

    // no heap data - calculate
    let heap = initHeap(pts);

    if (!width && !height) {
        let polyS = reducePoints(pts, 12);
        ({ width, height } = getPolyBBox(polyS));
    }

    let tolerance = quality;

    if (!isAbsolute) {
        // average side lengths
        let dimAvg = (width + height) / 2;
        let scale = dimAvg / 100;
        tolerance = ((1 - quality) * (scale)) ** 2;
    }

    const updateArea = (pts, index, heap) => {
        let pt = pts[index];
        if (pt.prev === null || pt.next === null) return;

        let tri = [pts[pt.prev], pt, pts[pt.next]];
        let area = getPolygonArea(tri);
        pt.area = area;

        if (pt.heapIndex !== undefined) {
            heap.update(pt.heapIndex, area);
        } else {
            pt.heapIndex = heap.push(area, index);
        }
    };

    let maxArea = 0;
    let len = pts.length;

    while (heap.size() > 0) {
        const { area, index } = heap.pop();
        const pt = pts[index];

        if (area && area < maxArea) {
            pt.area = maxArea;

        } else {
            maxArea = area;
        }

        if (index !== 0) {
            pts[pt.prev].next = pt.next;
            updateArea(pts, pt.prev, heap);
        }

        if (index !== len - 1) {
            pts[pt.next].prev = pt.prev;
            updateArea(pts, pt.next, heap);
        }

    }

    let ptsS = [];
    for (let i = 0, l = pts.length; i < l; i++) {
        let pt = pts[i];
        if (!pt.area || i === 0 || i === l - 1 || pt.area >= tolerance) {
            ptsS.push(pt);
        }
    }

    return ptsS

}

/**
 * get area data
 * for heap
 */

function initHeap(pts) {

    const heap = new MinHeap();

    for (let i = 0, len = pts.length; i < len; i++) {
        // prev, current, next
        let i0 = i === 0 ? len - 1 : i - 1;
        let i1 = i;
        let i2 = i === len - 1 ? 0 : i + 1;

        let pt0 = pts[i0];
        let pt1 = pts[i1];
        let pt2 = pts[i2];

        let area = i > 0 || i === len - 1 ?
            (pt1.area ? pt1.area : getPolygonArea([pt0, pt1, pt2])) :
            Infinity;

        pt1.prev = i0;
        pt1.index = i1;
        pt1.next = i2;
        pt1.area = area;
        pt1.heapIndex = i > 0 ? heap.push(area, i1) : 0;
    }

    return heap;
}

/**
 * minheap
 */

class MinHeap {
    constructor() {
        this.heap = [];
        this.indexMap = new Map();
    }

    push(area, index) {
        const node = { area, index };
        this.heap.push(node);
        const heapIndex = this.heap.length - 1;
        this.indexMap.set(index, heapIndex);
        this.bubbleUp(heapIndex);
        return heapIndex;
    }

    pop() {
        if (this.heap.length === 0) return null;
        const min = this.heap[0];
        const last = this.heap.pop();

        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.indexMap.set(last.index, 0);
            this.bubbleDown(0);
        }

        this.indexMap.delete(min.index);
        return min;
    }

    update(heapIndex, newArea) {
        if (
            typeof heapIndex !== 'number' ||
            heapIndex < 0 ||
            heapIndex >= this.heap.length
        ) return;

        const oldArea = this.heap[heapIndex].area;
        this.heap[heapIndex].area = newArea;

        if (newArea < oldArea) {
            this.bubbleUp(heapIndex);
        } else {
            this.bubbleDown(heapIndex);
        }
    }

    size() {
        return this.heap.length;
    }

    bubbleUp(index) {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.heap[parent].area <= this.heap[index].area) break;

            this.swap(index, parent);
            index = parent;
        }
    }

    bubbleDown(index) {
        while (true) {
            const left = 2 * index + 1;
            const right = 2 * index + 2;
            let smallest = index;

            if (
                left < this.heap.length &&
                this.heap[left].area < this.heap[smallest].area
            ) {
                smallest = left;
            }

            if (
                right < this.heap.length &&
                this.heap[right].area < this.heap[smallest].area
            ) {
                smallest = right;
            }

            if (smallest === index) break;

            this.swap(index, smallest);
            index = smallest;
        }
    }

    swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
        this.indexMap.set(this.heap[i].index, i);
        this.indexMap.set(this.heap[j].index, j);
    }
}

/*
export function renderPoint(
    svg,
    coords,
    fill = "red",
    r = "1%",
    opacity = "1",
    title = '',
    render = true,
    id = "",
    className = ""
) {
    if (Array.isArray(coords)) {
        coords = {
            x: coords[0],
            y: coords[1]
        };
    }
    let marker = `<circle class="${className}" opacity="${opacity}" id="${id}" cx="${coords.x}" cy="${coords.y}" r="${r}" fill="${fill}">
  <title>${title}</title></circle>`;

    if (render) {
        svg.insertAdjacentHTML("beforeend", marker);
    } else {
        return marker;
    }
}
*/

function simplifyToMax(pts, maxVertices = 0) {
    if (pts.length <= 3 || !maxVertices || pts.length<=maxVertices) return pts;

    function getTriangles(pts) {
        let triangles = [];
        // Build triangle areas, skipping first and last
        for (let i = 0; i < pts.length; i++) {

            let i0 = i === 0 ? pts.length - 1 : i - 1;
            let i1 = i;
            let i2 = i === pts.length - 1 ? 0 : i + 1;

            let pt0 = pts[i0];
            let pt1 = pts[i1];
            let pt2 = pts[i2];

            let area = getPolygonArea([pt0, pt1, pt2]);
            let prev = i0;
            let next = i2;

            triangles.push({ index: i, area, prev, next });
        }
        return triangles;
    }

    let ptsSmpl = pts;
    let passes = Math.ceil(pts.length / maxVertices);

    // 1. remove only segments with very small mid areas

    let lastLen = ptsSmpl.length;

    for (let i = 0; ptsSmpl.length > maxVertices && i < passes; i++) {
        let limit = 0.5;

        let removeSmallArea = false;

        ptsSmpl = simplyfyByArea(ptsSmpl, maxVertices, limit, true, removeSmallArea);

        // no optimization possible - exit
        if (lastLen === ptsSmpl.length) {
            break;
        }
        lastLen = ptsSmpl.length;
    }

    // final removal
    if (ptsSmpl.length > maxVertices) {
        ptsSmpl = simplyfyByArea(ptsSmpl, maxVertices, 1);
    }

    function simplyfyByArea(ptsSmpl, maxVertices = 0, limit = 0.5, sort = true, removeSmallArea=false) {

        let triangles = getTriangles(ptsSmpl);
        let len = triangles.length;
        let simplified = [];
        let areaAvg;

        if(removeSmallArea){
            let trianglesSmall = triangles;
            areaAvg = trianglesSmall.map(val => val.area).reduce((partialSum, a) => partialSum + a, 0)/len * 0.25;
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

            let trianglePrev = triangles[prev];
            let triangleNext = triangles[next];
            let [areaPrev, areaNext] = [trianglePrev.area, triangleNext.area];

            if(removeSmallArea){

                if (index > 0 && area < areaAvg && lastIndex < index  ) {

                    toRemove.add(index);
                    lastIndex = next;
                }

            }

            else if ((limit === 1 || (area < areaPrev && area < areaNext))) {
                lastIndex = index;

                if (index > 0) {
                    toRemove.add(index);
                    lastIndex = index;
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

function polySimplify_core(pts, {
    quality = 1,

    // simplifification algorithms
    RC = true,
    RDP = true,
    VW = false,
    RD = true,

    mercator=false,
    unite=false,

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

    if (typeof quality === 'string') {
        qualityNum = parseFloat(quality);
        unit = quality.replace(qualityNum.toString(), '').trim();

        if (unit) {
            if (unit === 'v') {
                maxPoints = qualityNum;
                toMaxPoints = true;
                quality = 0.8;
            } else {
                isAbsolute = true;
            }

        } else {
            quality = qualityNum <= 1 ? qualityNum : 0.8;

        }
    }

    // adjust quality to match vertices difference
    if (maxPoints) {

        const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

        let rat = +(pts.length / maxPoints / 100).toFixed(1);
        quality = Math.abs(1 - rat);
        quality = clamp(quality, 0.4, 0.8);

        quality = quality > 0 && quality < 1 ? quality : 0.8;
    }

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

        let polyApprox = reducePoints$1(pts, 64);
        bboxArr.push(getPolyBBox$1(polyApprox));
        let area = getPolygonArea(polyApprox);
        areaTotal += area;
        areaArr.push(area);
    }

    for (let i = 0, l = polyArr.length; i < l; i++) {

        let pts = polyArr[i];

        // split/adjust max point according to subpath area
        let rat = areaArr[i]/areaTotal;
        let maxPointsSub = toMaxPoints ? Math.ceil(maxPoints * rat) : 0;

        // no points - exit
        if (!pts.length) return [];

        // collect simplified point array
        let ptsSmp = pts;

        // line segments 

        if (pts.length < 3) {
            polyArrSimpl.push(ptsSmp);
            continue;
        }

        // apply mercator projection
        if(mercator){
            ptsSmp = pointsToMercator(ptsSmp);
        }

        /**
         * 0. reduce vertices to 
         * maximum limit
         * brute force but very fast for huge 
         * point arrays
         */

        
        if (skipPoints && !RDP && !VW && !RD && toMaxPoints) {

            ptsSmp = reducePoints$1(pts, maxPointsSub);
            polyArrSimpl.push(ptsSmp);
            continue
        }

        /**
         * override settings due to 
         * quality
         */

        if (!overrideQuality) {
            if (quality >= 1) RDP = false;
            if (quality >= 0.75) RD = false;
            if (quality < 0.5) {
                RD = true;

            }
        }

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
            ptsSmp = simplifyRC(ptsSmp);

        }

        /**
         * unite self intersecting 
         * polygons
         */

        if(unite){
            ptsSmp = unitePolygon(ptsSmp);
        }

        /**
         * check regular polygons
         * for simple regular polys
         * if it's regular:
         * we skip RDP simplification
         */

        if (RC) {
            let isRegular = detectRegularPolygon(ptsSmp);

            if (isRegular) {
                VW = false;
                RDP = false;
            }
        }

        /**
         * approximate dimensions 
         * for relative threshold calculations
         */

        let { width, height } = bboxArr[i];

        // average side lengths

        /** 
         * 1. radial distance
         * sloppy but fast
         */

        if (RD && ptsSmp.length > maxPointsSub) {

            ptsSmp = simplifyRD(ptsSmp, quality, width, height);
        }

        /**
         * 2. Ramer-Douglas-Peucker simplification
         */
        //
        if (RDP && ptsSmp.length > maxPointsSub) {

            ptsSmp = simplifyRDP(ptsSmp, quality, width, height);
        }

        /**
         * 3. Apply Visvalingam-Whyatt 
         * simplification for huge geodata polygons
         */

        if (VW && ptsSmp.length > maxPointsSub  ) {

            ptsSmp = simplifyVW(ptsSmp, quality, width, height);
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

            let diff = (ptsSmp.length - maxPointsSub)/ptsSmp.length;

            
            if (diff > 0.25) {
                ptsSmp = simplifyRD(ptsSmp, quality, width, height);

            }

            // final reduction
            ptsSmp = simplifyToMax(ptsSmp, maxPointsSub);
        }

        // add to final pts array
        polyArrSimpl.push(ptsSmp);

    }

    let out = getOutputData(polyArr, polyArrSimpl, outputFormat, meta, decimals, toRelative, toShorthands, minifyString, scale, translateX, translateY, alignToZero, scaleToWidth, scaleToHeight, isCompound);

    return meta ? out : out.data;
}

// Browser global
if (typeof window !== 'undefined') {
    window.polySimplify = polySimplify_core;
    window.normalizePointInput = normalizePointInput;
}

export { normalizePointInput, pathDataToD, polySimplify_core as polySimplify, simplifyRC, simplifyRD, simplifyRDP };
