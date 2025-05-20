

export function getSquareDistance(p1, p2) {
    return (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
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


export function getPolygonArea(points, absolute = false) {
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