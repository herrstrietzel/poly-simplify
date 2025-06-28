

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

export function sortPolygonLeftTopFirst(pts, isPolygon = null) {
  //return pts;
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
export function isClosedPolygon(pts, reduce = 24) {

  let ptsR = reducePoints(pts, reduce);
  let { width, height } = getPolyBBox(ptsR);
  //let dimAvg = Math.max(width, height);
  let dimAvg = (width + height) / 2;
  //let closingThresh = (dimAvg / pts.length) ** 2
  let closingThresh = (dimAvg) ** 2
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


export function getPolygonArea(pts, absolute = true) {
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


  ptsArr.forEach((pts, p) => {
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

  return ptsArr;
}


/**
 * unite self intersecting polygons
 * based on J. Holmes's answer
 * https://stackoverflow.com/a/10673515/15015675
 */

export function unitePolygon(poly) {
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
    //let { pt0, pt1 } = segment;

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

