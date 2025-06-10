

  
/*
 * Visvalingam Whyatt line simplification algorithm
 *
 * @author Evgeniy Kuznetsov
 * @date 12 april 2018
 */


/*
 * @param {Number[][]} polyline Unsimplified polyline
 * @param {Number} percentage Percentage of points left, must be within [0, 1]
 * @returns {Number[][]} Simplified polyline
 */
function visvalingamWhyattSimplification(polyline, percentage) {
    console.log('vivi');
  return eliminatePoints(
    polyline, computePolylinePointEntries(polyline), percentage);
}



function getPolygonArea(points, absolute = true) {
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



/*
 * @returns {Object}
 */
function createPointEntry(area, index, leftIndex, rightIndex) {
  return {
    area: area,
    index: index,
    left: leftIndex,
    right: rightIndex
  }
}

/*
 * @returns {Number}
 */
function computePolylineAreaByPointEntry(polyline, entry) {
  let triangle = [
    polyline[entry.index],
    polyline[entry.left],
    polyline[entry.right]
  ];

  console.log(triangle);

  return  getPolygonArea(triangle);
}

/* Make two given PointEntries neighbors
 * @returns {undefined}
 */
function linkPointEntries(left, right) {
  left.right = right.index;
  right.left = left.index;
}

/*
 * @returns {Boolean} True means area can be computed and updated,
 *  false otherwise
 */
function updatePointEntryArea(polyline, entry) {
  if (entry.left != null && entry.right != null) {
    entry.area = computePolylineAreaByPointEntry(polyline, entry);
    return true;
  } else {
    return false;
  }
}

/*
 * @returns {Number[][]} Array of PointEntries for each point
 *   in the given polyline
 */
function computePolylinePointEntries(polyline) {
  return polyline
    .map((coord, i) => {
      let isFirst = i == 0;
      let isLast = i == (polyline.length - 1);
      let left = isFirst ? null : i - 1;
      let right = isLast ? null : i + 1;

      let area;
      if (isFirst || isLast) {
        area = Infinity;
      } else {
        area =  getPolygonArea([polyline[left], coord, polyline[right]]);
      }

      return createPointEntry(area, i, left, right);
    });
}

/*
 * @param {Number} percentage Number of points in the result polyline
 *   given as a percentage of polyline points
 * @returns {Number[][]} polyline
 */
function eliminatePoints(polyline, pointEntries, percentage) {
  let deleted = {};
  const l = pointEntries.length;
  // We always leave two points
  let howManyDelete = Math.min(l - 2, l - Math.floor(l * percentage));

  let heap =  MinHeap((a, b) => a.area - b.area);
  for (let entry of pointEntries) {
    heap.push(entry);
  }

  while(howManyDelete-- > 0) {
    let entry = heap.pop();
    let leftEntry = pointEntries[entry.left];
    let rightEntry = pointEntries[entry.right];

    linkPointEntries(leftEntry, rightEntry);
    if (updatePointEntryArea(polyline, leftEntry)) { heap.updateItem(leftEntry); }
    if (updatePointEntryArea(polyline, rightEntry)) { heap.updateItem(rightEntry); }

    deleted[entry.index] = true;
  }

  return polyline
    .filter((coord, i) => !deleted[i]);
}


function MinHeap(compare) {
    let heap = [];
  
    function swap(i, j) {
      [heap[i], heap[j]] = [heap[j], heap[i]];
      heap[i]._heapIndex = i;
      heap[j]._heapIndex = j;
    }
  
    function bubbleUp(i) {
      while (i > 0) {
        let p = Math.floor((i - 1) / 2);
        if (compare(heap[i], heap[p]) < 0) {
          swap(i, p);
          i = p;
        } else break;
      }
    }
  
    function bubbleDown(i) {
      let l = heap.length;
      while (true) {
        let left = 2 * i + 1;
        let right = 2 * i + 2;
        let smallest = i;
  
        if (left < l && compare(heap[left], heap[smallest]) < 0) smallest = left;
        if (right < l && compare(heap[right], heap[smallest]) < 0) smallest = right;
  
        if (smallest !== i) {
          swap(i, smallest);
          i = smallest;
        } else break;
      }
    }
  
    return {
      push(item) {
        item._heapIndex = heap.length;
        heap.push(item);
        bubbleUp(item._heapIndex);
      },
      pop() {
        if (heap.length === 0) return null;
        let top = heap[0];
        let end = heap.pop();
        if (heap.length > 0) {
          heap[0] = end;
          end._heapIndex = 0;
          bubbleDown(0);
        }
        delete top._heapIndex;
        return top;
      },
      updateItem(item) {
        let i = item._heapIndex;
        if (i != null) {
          bubbleUp(i);
          bubbleDown(i);
        }
      },
      size() {
        return heap.length;
      }
    };
  }