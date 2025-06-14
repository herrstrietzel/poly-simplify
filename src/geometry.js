

export function getSquareDistance(p1, p2) {
    return (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
}


export function detectRegularPolygon(pts) {
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

export function sortPolygonLeftTopFirst(pts, isPolygon=null) {
    //return pts;
    if (pts.length === 0) return pts;
    
    isPolygon = isPolygon===null ? isClosedPolygon(pts) : isPolygon;

    if(!isPolygon) return pts;
    
    let firstIndex = 0;
    for (let i = 1,l=pts.length; i < l; i++) {
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
export function isClosedPolygon(pts, reduce=24){

    let ptsR = reducePoints(pts, reduce);
    let { width, height } = getPolyBBox(ptsR);
    let dimAvg = Math.max(width, height);
    let closingThresh = (dimAvg / pts.length) ** 2
    let closingDist = getSquareDistance(pts[0], pts[pts.length - 1]);

    return closingDist < closingThresh;
}



/**
 * reduce polypoints
 * for sloppy dimension approximations
 */
export function reducePoints(points, maxPoints = 48) {
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


export function getPolygonArea(points, absolute = true) {
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


export function getAngle(p1, p2, normalize = false) {
    let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    // normalize negative angles
    if (normalize && angle < 0) angle += Math.PI * 2
    return angle
}


export function getPolyBBox(vertices) {
    let xArr = vertices.map(pt => pt.x);
    let yArr = vertices.map(pt => pt.y);
    let left = Math.min(...xArr)
    let right = Math.max(...xArr)
    let top = Math.min(...yArr)
    let bottom = Math.max(...yArr)
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

export function scalePolygon(pts, scale = 1, translateX = 0, translateY = 0, alignToZero = false, scaleToWidth = 0, scaleToHeight = 0) {

    if (scale === 1 && scaleToWidth === 0 && scaleToHeight === 0 && translateX === 0 && translateY === 0 && alignToZero === false) return pts;

    let x, y, width, height;
    //calculate scaling factor
    let isCompound = Array.isArray(pts[0]);

    let ptsArr = isCompound ? pts : [pts];
    let ptsFlat = isCompound ? pts.flat() : pts;

    ({ x, y, width, height } = getPolyBBox(ptsFlat));


    ptsArr.forEach((pts,p) => {
        scale = scaleToWidth ? scaleToWidth / width : (scaleToHeight ? scaleToHeight / height : scale);

        // if both are defined - adjust to fit in box max dimension
        if (scaleToWidth, scaleToHeight) {
            if (height * scale > scaleToHeight) {
                scale = scaleToHeight / height;
            }
        }

        if (alignToZero) {
            translateX = -x
            translateY = -y
        }

        //console.log('scale:', scale, width, scaleToWidth, 'scaleToHeight', scaleToHeight, 'translate', translateX, translateY);

        for (let i = 0, l = pts.length; i < l; i++) {
            let pt = pts[i];
            ptsArr[p][i] = { x: (pt.x + translateX) * scale, y: (pt.y + translateY) * scale }
        }
    })

    return ptsArr ;
}