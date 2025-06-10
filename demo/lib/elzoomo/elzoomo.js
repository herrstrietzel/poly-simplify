window.addEventListener('load', e => {
    initZoomEls()
})


function initZoomEls() {
    let els = document.querySelectorAll('[data-zoom]');

    // add style
    let styleEl = document.getElementById('elzoomoStyle');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.textContent = `
        .elzoomo-wrp{
            position:relative;
            overflow:hidden;
        }
        `;
        document.head.append(styleEl);
    }



    els.forEach(el => {

        // wrap if necessary
        let container = el.closest('.elzoomo-wrp');


        if (!container) {
            container = document.createElement('div');
            el.parentNode.insertBefore(container, el);
            container.classList.add('elzoomo-wrp');
            container.append(el)
        }

        el.classList.add('elzoomo-el')
        let options = JSON.parse(el.dataset.zoom)
        initZoomEl(container, el, options);
    })
}



function initZoomEl(container, el, options) {

    const getCurrentTransforms = (el) => {
        return new DOMMatrix(el.style.transform)
    }

    const setTransforms = (el, mtx) => {
        el.style.transform = `matrix(${Object.values(mtx).join(', ')})`;
    }


    // initial scale 
    if (options.zoom != 1) {
        let mtx = { a: options.zoom, b: 0, c: 0, d: options.zoom, e: 0, f: 0 };
        setTransforms(el, mtx)
    }


    options = {
        ...{
            minScale: 1,
            maxScale: 10,
            zoom: 1,
            zoomStep: 1.001,
            scaleStroke:false,
            snapToOrigin: false
        },
        ...options
    };

    // get original strokeWidth
    let strokeWidth= parseFloat(window.getComputedStyle(el).strokeWidth);


    /**
     * Zoom:
     * update scale values
     */
    const updateScale = (mtx, e, newScale, minScale, maxScale, snapToOrigin = false) => {
        let clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        let scale = clamp(newScale, minScale || 1, maxScale || 10);
        let el = e.currentTarget.firstElementChild;

        let [prevScale, translateX, translateY] = [mtx.a, mtx.e, mtx.f];

        if (snapToOrigin && scale === 1) {
            return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        }

        if (scale === prevScale) return mtx;

        let scaleRatio = scale / prevScale - 1;
        let { left, top, width, height } = el.getBoundingClientRect();

        let cx = (e?.clientX || 0) - left - width / 2;
        let cy = (e?.clientY || 0) - top - height / 2;

        translateX = translateX - scaleRatio * cx;
        translateY = translateY - scaleRatio * cy;

        // update matrix
        mtx = { a: scale, b: 0, c: 0, d: scale, e: translateX, f: translateY };
        return mtx
    }


    /**
     * Pan:
     * update translate values
     */
    const updateTranslate = (mtx, dx, dy) => {
        let [scale, translateX, translateY] = [mtx.a, mtx.e, mtx.f];
        // update matrix
        mtx = { a: scale, b: 0, c: 0, d: scale, e: translateX - dx, f: translateY - dy };
        return mtx
    }


    /**
     * pan and 
     * zoom processing 
     */

    function pan(e) {
        let { dx, dy } = e.detail;
        let el = e.currentTarget.firstElementChild;
        let m = getCurrentTransforms(el);
        let mtxNew = updateTranslate(m, -dx, -dy);
        setTransforms(el, mtxNew);
    }


    function zoom(e) {
        let { zoomStep, minScale, maxScale, snapToOrigin, scaleStroke } = options;
        let zoomFactor = (zoomStep ** -e.deltaY) || 1;
        let el = e.currentTarget.firstElementChild;

        // get current matrix
        let m = getCurrentTransforms(el)

        let scaleNew = m.a * zoomFactor

        // update scaling
        let mtxNew = updateScale(m, e, scaleNew, minScale, maxScale, snapToOrigin);

        if(scaleStroke){
            el.style.strokeWidth = (strokeWidth * (1 / scaleNew))+'px';
        }

        // apply transforms
        setTransforms(el, mtxNew)
        e.preventDefault();
    }



    /**
     * custom events
     */
    function addDragInputListener(el) {
        function dispatchDragInput(type, originalEvent, data) {
            let dragEvent = new CustomEvent('dragInput', {
                bubbles: true,
                detail: {
                    type,
                    originalEvent,
                    ...data
                }
            });
            el.dispatchEvent(dragEvent);
        }

        function onStart(e) {
            e.preventDefault();
            if (e.type === 'touchstart' && e.touches.length > 1) return;


            let isTouch = e.type === 'touchstart';
            let pt = isTouch ? e.touches[0] : e;
            let lastX = pt.clientX;
            let lastY = pt.clientY;

            function onMove(ev) {
                if (isTouch && ev.touches.length > 1) return;
                let ptMove = isTouch ? ev.touches[0] : ev;
                let dx = ptMove.clientX - lastX;
                let dy = ptMove.clientY - lastY;

                dispatchDragInput('move', ev, {
                    clientX: ptMove.clientX,
                    clientY: ptMove.clientY,
                    dx,
                    dy
                });

                lastX = ptMove.clientX;
                lastY = ptMove.clientY;
            }

            function onEnd(ev) {
                dispatchDragInput('end', ev, {});
                window.removeEventListener(isTouch ? 'touchmove' : 'mousemove', onMove);
                window.removeEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);
            }

            window.addEventListener(isTouch ? 'touchmove' : 'mousemove', onMove, { passive: false });
            window.addEventListener(isTouch ? 'touchend' : 'mouseup', onEnd);

            dispatchDragInput('start', e, {
                clientX: pt.clientX,
                clientY: pt.clientY,
                dx: 0,
                dy: 0
            });
        }

        el.addEventListener('mousedown', onStart);
        el.addEventListener('touchstart', onStart, { passive: false });
    }


    // Enable normalized drag events
    addDragInputListener(container);



    // pinch zoom event
    function addPinchZoomListener(el) {
        let prevDistance = null;
        let lastCenter = { x: 0, y: 0 };

        function onTouchMove(e) {
            e.preventDefault();
            // prevent pinch
            if (e.touches.length !== 2) return;

            let touches = e.touches;
            let dx = touches[0].clientX - touches[1].clientX;
            let dy = touches[0].clientY - touches[1].clientY;
            let distance = Math.hypot(dx, dy);

            if (prevDistance !== null) {
                let scale = distance / prevDistance;
                let deltaY = -(scale - 1) * 1000;

                let zoomEvent = new CustomEvent('pinchZoom', {
                    bubbles: true,
                    detail: {
                        deltaY,
                        scale,
                        clientX: (touches[0].clientX + touches[1].clientX) / 2,
                        clientY: (touches[0].clientY + touches[1].clientY) / 2,
                        currentTarget: e.currentTarget,
                        originalEvent: e
                    }
                });

                el.dispatchEvent(zoomEvent);
            }

            prevDistance = distance;
            lastCenter = center;
        }

        function onTouchEnd() {
            prevDistance = null;
        }

        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('touchcancel', onTouchEnd);
    }

    addPinchZoomListener(container);



    /**
     * Event Listeners
     */

    // Handle pan logic
    container.addEventListener('dragInput', e => {
        if (e.detail.type === 'move') {
            pan(e);
        }
    });

    // pinch zoom
    container.addEventListener('pinchZoom', e => {
        zoom(e.detail);
    });

    // Wheel zoom
    container.addEventListener('wheel', (e) => {
        zoom(e)
    }, { passive: false });

}



