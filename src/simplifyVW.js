import { getPolygonArea } from './geometry.js';

/**
 * Visvalingam-Whyatt 
 * simplification
 */
export function simplifyVW(pts, quality = 1, width = 0, height = 0) {


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
        tolerance = ((1 - quality) * (scale)) ** 2
    }

    //console.log('simplifyVW', quality, tolerance, isAbsolute);


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
    }

    let maxArea = 0;
    let len = pts.length;

    while (heap.size() > 0) {
        const { area, index } = heap.pop();
        const pt = pts[index];

        //&& maxArea<1 
        if (area && area < maxArea) {
            pt.area = maxArea;
            //console.log('area < maxArea', area, maxArea);
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
            ptsS.push(pt)
        }
    }

    return ptsS

}


/**
 * get area data
 * for heap
 */

export function initHeap(pts) {

    const heap = new MinHeap();

    for (let i = 0, len = pts.length; i < len; i++) {
        // prev, current, next
        let i0 = i === 0 ? len - 1 : i - 1;
        let i1 = i;
        let i2 = i === len - 1 ? 0 : i + 1;

        let pt0 = pts[i0]
        let pt1 = pts[i1]
        let pt2 = pts[i2]

        let area = i > 0 || i === len - 1 ?
            (pt1.area ? pt1.area : getPolygonArea([pt0, pt1, pt2])) :
            Infinity;

        pt1.prev = i0
        pt1.index = i1
        pt1.next = i2
        pt1.area = area
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
