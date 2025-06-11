
/**
 * define ui inputs
 */

let fieldsInput = [
    {
        // just a info box
        info: `<h1 class="h2"><img class="icn-svg icn-logo dsp-inl-blc" src="./favicon.svg">PolySimplify </h1>
        <p>Simplify/reduce polylines/polygon vertices in JS
        </p>
        <div class="input-group input-group-"><button class="btn btn-default input-button" id="btnReset"><svg viewBox="0 0 112 100" class="icn-svg icn-reload "><use href="#icn-reload"></use></svg> Reset settings</button></div>        
        `,
    },

    {
        label: 'Quality',
        info: 'Quality &gt;1 shows the original polygon',
        //type: 'details',
        ////open: true,
        fields: [

            {
                name: 'quality',
                label: 'quality',
                type: 'range',
                defaults: 0.9,
                atts: {
                    min: 0,
                    max: 1.1,
                    step: 0.01,
                }
            },
            {
                name: 'tolerance',
                label: 'Absolute tolerance',
                labelPosition: 'top',
                info: 'Absolute threshold: e.g 1px or 100v (reduce to 100 vertices). Gets reset by quality slider!',
                type: 'text',
                defaults: '',
                atts: {
                    placeholder:'e.g "1px" or "150v"'
                }

            },

            {
                name: 'RC',
                label: 'remove colinear',
                type: 'checkbox',
                defaults: true,
            },

            {
                name: 'RD',
                label: 'use radial distance simplification',
                type: 'checkbox',
                defaults: true,
            },

            {
                name: 'RDP',
                label: 'Ramer-Douglas-Peucker',
                type: 'checkbox',
                defaults: true,
            },

            {
                name: 'VW',
                label: 'Visvalingam',
                type: 'checkbox',
                defaults: false,
            },

            {
                name: 'optimizeStartingPoint',
                label: 'Optimize starting points',
                type: 'checkbox',
                defaults: true,
            },

            {
                name: 'overrideQuality',
                info: 'Allows custom simplification that would otherwise be adjusted by the quality value.',
                label: 'override quality',
                type: 'checkbox',
                defaults: true,
            },


            {
                name: 'skipPoints',
                label: 'skip points',
                info: 'Skips points to reduce polygon to desired point limit. Very <em>fast</em> but also <em>inaccurate!</em>',
                type: 'checkbox',
                //defaults: true,
            },

            {
                name: 'maxVertices',
                label: 'Max Vertices',
                labelPosition: 'right',
                type: 'number',
                defaults: 0,
                atts: {
                    min: 0,
                    max: 1024,
                    step: 1,
                }
            },


            {
                name: 'decimals',
                label: 'Round to decimals',
                labelPosition: 'right',
                type: 'number',
                defaults: 3,
                atts: {
                    min: -1,
                    max: 8,
                    step: 1
                }
            },

            {
                label: 'Path minification',
                name: 'pathMinification',
                type: 'checkbox',
                info: `Only affects pathdata outputs formats`,
                defaults: ['toRelative', 'toShorthands'],
                values: {
                    'toRelative': 'toRelative',
                    'toShorthands': 'toShorthands',
                    'minifyString': 'minifyString',
                }
            },

        ]
    },



    {
        label: 'Scaling and alignment',
        info: 'Useful for tiny poly data such as geodata polygons.',
        fields: [
            {
                name: 'scale',
                label: 'scale',
                labelPosition: 'right',
                type: 'number',
                defaults: 1,
                atts: {
                    value: 1,
                    min: 1,
                    step: 0.5
                }
            },


            {
                name: 'scaleTo',
                label: 'scale to width/height',
                labelPosition: 'top',
                type: 'number',
                defaults: 0,
                atts: {
                    min: 1,
                    step: 1
                },
                values: {
                    Width: 0,
                    Height: 0,
                }

            },

            {
                name: 'alignToZero',
                label: 'align to zero',
                labelPosition: 'right',
                type: 'checkbox'
            },

            {
                name: 'translate',
                label: 'Translate',
                labelPosition: 'top',
                type: 'number',
                //defaults: 0,
                atts: {
                    //class: 'inputTrans',
                    min: -1000,
                    step: 1
                },
                values: {
                    X: 0,
                    Y: 0,
                }
            },


            {
                label: 'Format',
                name: 'outputFormat',
                type: 'radio',
                defaults: ['json'],
                values: {
                    'Point Object Array': 'points',
                    'Nested Array': 'pointsNested',
                    'Point string': 'pointstring',
                    'JSON': 'json',
                    'SVG pathData': 'pathData',
                    'SVG path': 'path',
                }
            },


        ]
    },


];



let fieldsOutput = [
    {
        fields: [

            {
                label: 'Load Samples',
                name: 'selectSamples',
                type: 'select',
                values: [],
                sync: 'inputPoly',
                atts: {
                    // get selects from var
                    'data-source': 'demo/samples.json',
                    //readonly:true
                }
            },

            {
                info: 'Enter polygon point arrays, nested or flat coordinate arrays, point strings',
            },


            {
                label: 'Input',
                name: 'inputPoly',
                type: 'textarea',
                defaults: `27.46 82.29 27.46 82.29 25.611,76.6 23.763,70.91 21.914,65.221 20.065,59.531 18.217,53.842 16.368,48.152 14.52,42.463 12.67,36.773 17.51,33.257 22.35,29.74 27.189,26.224 32.029,22.707 36.869,19.19 41.709,15.674 46.549,12.158 51.389,8.642 56.229,12.158 61.068,15.674 65.908,19.19 70.749,22.707 75.59,26.224 80.43,29.74 85.27,33.257 90.109,36.773 88.261,42.463 86.412,48.152 84.563,53.842 82.715,59.531 80.866,65.221 79.018,70.91 77.168,76.6 75.319,82.29 70.695,82.29 66.072,82.29 61.449,82.29 56.826,82.29 52.203,82.29 47.58,82.29 42.957,82.29  38.333,82.29 36.975,82.29 35.615,82.29 34.256,82.29 32.896,82.29 31.537,82.29 30.178,82.29 28.819,82.29`,
                atts: {
                    accept: '.txt, .json, .js',
                    placeholder: 'Enter your input',
                    class: 'input-points code brd-non scrollbar scroll-content fnt-siz-0-75em',
                    'data-tools': 'size copy upload',
                }
            },



            {
                name: 'pointOutput',
                label: 'Output',
                type: 'textarea',
                readonly: true,
                atts: {
                    readonly: true,
                    id: 'pointOutput',
                    class: 'input-output code brd-non scrollbar scroll-content fnt-siz-0-75em',
                    'data-file': 'poly.txt',
                    'data-tools': 'size copy download'
                }
            },


            {
                label: 'Preview rendering',
                name: 'previewRendering',
                type: 'checkbox',
                defaults: ['showMarkers', 'showFill'],
                values: {
                    'showMarkers': 'showMarkers',
                    'showFill': 'showFill',
                }
            },


            {
                name: 'svgOutput',
                label: 'SVG',
                type: 'textarea',
                readonly: true,
                atts: {
                    readonly: true,
                    id: 'svgOutput',
                    class: 'input-output code brd-non scrollbar scroll-content fnt-siz-0-75em',
                    'data-file': 'poly.svg',
                    'data-tools': 'size copy download'
                }
            },

            {
                name: 'configOut',
                label: 'Sample JS',
                type: 'textarea',
                readonly: true,
                atts: {
                    readonly: true,
                    id: 'configOut',
                    class: 'input-output code brd-non scrollbar scroll-content fnt-siz-0-75em',
                    'data-file': 'polySimplifytest.js',
                    'data-tools': 'size copy download'
                }
            }


        ]
    }
];
