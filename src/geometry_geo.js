import { reducePoints, getAngle, getPolyBBox, getPolygonArea, getSquareDistance, detectRegularPolygon, scalePolygon, sortPolygonLeftTopFirst, isClosedPolygon } from './geometry.js';


export function pointsToMercator(pts) {
  
    if(!isGeoData(pts)) return pts;
    
    const degToRad = (deg) => deg * (Math.PI / 180);
  
    const mercatorProject = (pt) => {
      let lat = Math.max(-85.05112878, Math.min(85.05112878, pt.y));
      let lon = pt.x
  
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
      ptsP.push(mercatorProject(pts[i]))
    }
    
    // scale and translate
    let bbO = getPolyBBox(pts)
    let bb = getPolyBBox(ptsP)
    let scale = bbO.width/bb.width
    let offsetX = (bb.x*scale-bbO.x)
    let offsetY = (bb.y*scale-bbO.y)
     //console.log('scale', scale, scaleM, 'scaleMY', scaleMY, 'offsets:', offsetX, translateX, offsetY, translateY)
  
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
  export function isGeoData(pts) {
    
    const isValidCoord = (lon, lat) =>{
      return (lon >= -180 && lon <= 180 &&
      lat >= -90 && lat <= 90);
    }
  
    let samplePoints = [
      pts[0],
      pts[Math.floor(pts.length / 2)],
      pts[pts.length - 1],
    ];
    
    return samplePoints.every(p => {
        return isValidCoord(p.x, p.y); 
    });
  }