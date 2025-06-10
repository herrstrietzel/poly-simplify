


function simplify(poly, limit) {
    if (poly.length < 3) {
        return poly;
    }

    if (limit < 3) {
        return [poly[0], poly[poly.length - 1]];
    }


    if (poly.length <= limit) {
        return poly;
    }

    var ts = calculate(poly);

    console.log('ts', ts);
    eliminate(ts, limit - 1); // limit is in points, and we are counting triangles 
    return collect(ts.first);
}



function swap(heap, p, q) {
    var t = heap[p];
    heap[p] = heap[q];
    heap[q] = t;
}


function up(heap, smaller, index) {
    if (index <= 1) {
        return;
    }

    var parent = Math.floor(index / 2);
    if (smaller(index, parent)) {
        swap(heap, parent, index);
        up(heap, smaller, parent);
    }
}

function down(heap, smaller, index) {
    var left = 2 * index,
        right = left + 1,
        next = index;

    if (left < heap.length && smaller(left, next)) {
        next = left;
    }
    if (right < heap.length && smaller(right, next)) {
        next = right;
    }
    if (next !== index) {
        swap(heap, index, next);
        down(heap, smaller, next);
    }
}

function heap(compare) {
    var self, data = [null]; // 1-index 

    compare = compare || function (a, b) { return a - b; };

    function smaller(p, q) {
        return compare(data[p], data[q]) < 0;
    }

    function push(item) {
        data.push(item);
        up(data, smaller, data.length - 1);
    }

    function pop() {
        if (data.length === 1) {
            return;
        }
        var root = data[1];
        if (data.length === 2) {
            data.length = 1;
        } else {
            data[1] = data.pop();
            down(data, smaller, 1);
        }
        return root;
    }

    function size() {
        return data.length - 1;
    }

    function get() {
        return data.slice(1);
    }

    function remove(item) {
        var fn, index = data.indexOf(item);

        if (index < 0) {
            return;
        }
        if (index === data.length - 1) {
            data.pop();
            return;
        }

        fn = smaller(data.length - 1, index) ? up : down;
        data[index] = data.pop();
        fn(data, smaller, index);
    }

    function rebuild(initData) {
        var i;

        if (Array.isArray(initData)) {
            data = [null].concat(initData);
            rebuild();
        }

        for (i = Math.floor(data.length / 2); i > 0; i--) {
            down(data, smaller, i);
        }

        return self;
    }

    self = {
        push: push,
        pop: pop,
        size: size,
        rebuild: rebuild,
        remove: remove,
        get: get
    };

    return self;
}


function area(t) {
    return Math.abs(
        (t[0][0] - t[2][0]) * (t[1][1] - t[0][1]) -
        (t[0][0] - t[1][0]) * (t[2][1] - t[0][1])
    );
}


function areaCompare(p, q) {
    return p.area - q.area;
}


function calculate(poly) {
    var i, triangle, ts = {
        heap: heap(areaCompare),
        list: []
    };

    // calculate areas 
    for (i = 1; i < poly.length - 1; i++) {
        triangle = poly.slice(i - 1, i + 2);
        triangle.area = area(triangle);
        if (triangle.area) {
            ts.list.push(triangle);
        }
    }

    // create a heap 
    ts.heap.rebuild(ts.list);

    // link list 
    for (i = 0; i < ts.list.length; i++) {
        triangle = ts.list[i];
        triangle.prev = ts.list[i - 1];
        triangle.next = ts.list[i + 1];
    }

    console.log(ts);

    ts.first = ts.list[0];

    return ts;
}


function eliminate(ts, limit) {
    var triangle;

    while (ts.heap.size() > limit) {
        triangle = ts.heap.pop();

        // recalculate neighbors 
        if (triangle.prev) {
            triangle.prev.next = triangle.next;
            triangle.prev[2] = triangle[2];
            triangle.prev.area = area(triangle.prev);
        } else {
            ts.first = triangle.next;
        }
        if (triangle.next) {
            triangle.next.prev = triangle.prev;
            triangle.next[0] = triangle[0];
            triangle.next.area = area(triangle.next);
        }
        // some areas have changed - need to adjust the heap 
        ts.heap.rebuild();
    }
}


function collect(triangle) {
    console.log('triangle', triangle);

    var poly = [triangle[0], triangle[1]];


    /* jshint -W084 */ // assignment below OK 
    while (triangle = triangle.next) {
        poly.push(triangle[2]);
    }
    /* jshint +W084 */

    return poly;
}

