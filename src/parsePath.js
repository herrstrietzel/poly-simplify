

/**
 * split compound paths into 
 * sub path data array
 */
export function splitSubpaths(pathData) {

    let subPathArr = [];

    //split segments after M command

    try {
        let subPathIndices = pathData.map((com, i) => (com.type.toLowerCase() === 'm' ? i : -1)).filter(i => i !== -1);

    } catch {
        console.log('catch', pathData);
    }


    let subPathIndices = pathData.map((com, i) => (com.type.toLowerCase() === 'm' ? i : -1)).filter(i => i !== -1);
    //let subPathIndices = pathData.map((com, i) => (com.type === 'M' ? i : -1)).filter(i => i !== -1);

    // no compound path
    if (subPathIndices.length === 1) {
        return [pathData]
    }
    subPathIndices.forEach((index, i) => {
        subPathArr.push(pathData.slice(index, subPathIndices[i + 1]));
    });

    return subPathArr;
}


export function parsePathNorm(d) {
    return pathDataToLonghands(pathDataToAbsolute(parse(d)));
}


export function pathDataToPoly(pathData) {

    //normalize to absolute and longhands
    //let pathData = pathDataToLonghands(pathDataToAbsolute(parse(d)));
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

/*
export function pathDataToPoly(d) {

    //normalize to absolute and longhands
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


export function parse(path, debug = true) {

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

    //collect errors 
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
    }

    const pushVal = (checkFloats = false) => {

        // regular value or float
        if (!checkFloats ? val !== '' : floatCount > 0) {

            // error: no first command
            if (debug && itemCount === -1) {

                feedback = 'Pathdata must start with M command'
                log.push(feedback)

                // add M command to collect subsequent errors
                lastCommand = 'M'
                pathData.push({ type: lastCommand, values: [] });
                maxParams = 2;
                valueIndex = 0
                itemCount++

            }

            if (lastCommand === 'A' || lastCommand === 'a') {
                val = sanitizeArc()
                pathData[itemCount].values.push(...val);

            } else {
                // error: leading zeroes
                if (debug && val[1] && val[1] !== '.' && val[0] === '0') {
                    feedback = 'Leading zeros not valid: ' + val
                    log.push(feedback)
                }

                pathData[itemCount].values.push(+val);
            }

            valueIndex++;
            val = '';
            floatCount = 0;

            // Mark that a new segment is needed if maxParams is reached
            needsNewSegment = valueIndex >= maxParams;
        }

    }


    const sanitizeArc = () => {

        let valLen = val.length;
        let arcSucks = false;

        // large arc and sweep
        if (valueIndex === 3 && valLen === 2) {
            //console.log('large arc sweep combined', val, +val[0], +val[1]);
            val = [+val[0], +val[1]];
            arcSucks = true
            valueIndex++
        }

        // sweep and final
        else if (valueIndex === 4 && valLen > 1) {
            //console.log('sweep and final', val, val[0], val[1]);
            val = [+val[0], +val[1]];
            arcSucks = true
            valueIndex++
        }

        // large arc, sweep and final pt combined
        else if (valueIndex === 3 && valLen >= 3) {
            //console.log('large arc, sweep and final pt combined', val);
            val = [+val[0], +val[1], +val.substring(2)];
            arcSucks = true
            valueIndex += 2
        }

        //console.log('val arc', val);
        return !arcSucks ? [+val] : val;

    }

    const validateCommand = () => {
        if (debug) {
            let lastCom = itemCount > 0 ? pathData[itemCount] : 0
            let valLen = lastCom ? lastCom.values.length : 0;

            if ((valLen && valLen < maxParams) || (valLen && valLen > maxParams) || ((lastCommand === 'z' || lastCommand === 'Z') && valLen > 0)) {
                let diff = maxParams - valLen
                feedback = `Pathdata commands in "${lastCommand}" (segment index: ${itemCount}) don't match allowed number of values: ${diff}/${maxParams}`;
                log.push(feedback)
            }
        }
    }


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
            validateCommand()


            // new command type
            lastCommand = char;
            maxParams = paramCounts[charCode];
            let isM = lastCommand === 'M' || lastCommand === 'm'
            let wasClosePath = itemCount > 0 && (pathData[itemCount].type === 'z' || pathData[itemCount].type === 'Z')

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
            pushVal()

            wasSpace = true;
            wasE = false;
            i++;
            continue;
        }


        // if last
        else if (i === len - 1) {

            val += char;
            //console.log('last', val, char);

            // push value
            pushVal()
            wasSpace = false;
            wasE = false;

            validateCommand()
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
            addSeg()

            // concatenated floats
            if (checkFloats) {
                floatCount++;
            }
        }


        // regular splitting
        else {
            addSeg()
        }

        val += char;

        // e/scientific notation in value
        wasE = (charCode === 0x45 || charCode === 0x65);
        wasSpace = false;
        i++;
    }

    //validate final
    validateCommand()

    pathData[0].type = 'M'

    // return error log
    if (debug && log.length) {
        feedback = 'Invalid path data:\n' + log.join('\n')
        if (debug === 'log') {
            console.warn(feedback);
        } else {
            throw new Error(feedback)
        }
    }

    //console.log('pathData', pathData);
    return pathData

}



/**
 * convert pathData to 
 * This is just a port of Dmitry Baranovskiy's 
 * pathToRelative/Absolute methods used in snap.svg
 * https://github.com/adobe-webplatform/Snap.svg/
 */

export function pathDataToAbsoluteOrRelative(pathData, toRelative = false) {

    //pathData[0].type='M';

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
    //console.log('pathData rel', pathData[0], pathData);
    return pathData;
}


export function pathDataToRelative(pathData) {
    return pathDataToAbsoluteOrRelative(pathData, true)
}

export function pathDataToAbsolute(pathData) {
    return pathDataToAbsoluteOrRelative(pathData, false)
}


/**
 * decompose/convert shorthands to "longhand" commands:
 * H, V, S, T => L, L, C, Q
 * reversed method: pathDataToShorthands()
 */

export function pathDataToLonghands(pathData) {

    let pathDataLonghand = [{ type: "M", values: pathData[0].values }];
    let comPrev = pathDataLonghand[0]

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
export function minifyPathData(pathData, decimals = -1, toRelative = false,
    toShorthands = false) {
    if (toShorthands) pathData = pathDataToShorthands(pathData);
    if (toRelative) pathData = pathDataToRelative(pathData);
    if (decimals > -1) {
        pathData = pathData.map(com => {
            //console.log('com.type', com.type);
            return { type: com.type, values: com.values.map(val => +val.toFixed(decimals)) }
        });
    }

    //console.log('pathData min', pathData);
    return pathData;
}

/**
 * Serialize pathData array to a minified "d" attribute string.
 */
export function pathDataToD(pathData, optimize = 1) {

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

                valsString += valStr
                //.replace(/-0./g, '-.').replace(/ -./g, '-.')
                prevWasFloat = isSmallFloat;
            }

            //console.log('minify', valsString);
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
export function pathDataToShorthands(pathData) {

    let pathDataShorts = [{ type: "M", values: pathData[0].values }];
    let comShort = pathDataShorts[0]

    let p0 = { x: pathData[0].values[0], y: pathData[0].values[1] };
    let p;
    let tolerance = 0.01

    for (let i = 1, len = pathData.length; i < len; i++) {

        let com = pathData[i];
        let { type, values } = com;
        let valuesLast = values.length ? values.slice(-2) : [];

        //last on-path point
        p = { x: valuesLast[0], y: valuesLast[1] };

        //calculate threshold based on command dimensions
        let w = Math.abs(p.x - p0.x)
        let h = Math.abs(p.y - p0.y)
        let thresh = (w + h) / 2 * tolerance

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
