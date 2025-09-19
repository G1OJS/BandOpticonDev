import {myCall} from './config.js';
import {mhToLatLong} from './geo.js'
import {colours, view, setMainViewHeight, tiles, freeTiles, callLocations} from './main.js'

let worldGeoJSON = null;

fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson')
  .then(resp => resp.json())
  .then(data => {
	console.log("GeoJSON loaded:", data);
    worldGeoJSON = data;
  });

export function zoom(e){
	let cvs = e.target;
	let tile = tiles.get(e.target.closest('.bandTile').dataset.band);
	let rect = cvs.getBoundingClientRect();
	let xnorm = (e.clientX - rect.left) / (rect.right-rect.left);
	let ynorm = (e.clientY - rect.top)  / (rect.bottom-rect.top);
	console.log(rect.left, e.clientX, rect.right);
	console.log(rect.top, e.clientY, rect.bottom);
	 
	let ll = [(-180*(ynorm-0.5) / tile.zoomParams.scale) + tile.zoomParams.lat0  , (360*(xnorm-0.5)/tile.zoomParams.scale) + tile.zoomParams.lon0 ];
	console.log(xnorm, ynorm);
	console.log(ll);
	tile.zoomParams.scale = tile.zoomParams.scale *1.2;
	tile.zoomParams.lat0 = ll[0];
	tile.zoomParams.lon0 = ll[1];
	console.log(tile.zoomParams);
	tile.clear();
	tile.drawMap();
	tile.redraw(true);
	tile.redraw(false) // redraws highlights only
}

export function addSpot(spot) {
	let tile = tiles.get(spot.b+"-"+spot.md);
	if(!tile) tile = new tileClass(spot.b+"-"+spot.md);
	let isHl = (spot.sc == myCall || spot.rc == myCall);
	let s = {call:spot.sc, sq:spot.sl, txrx:'tx', isHl:isHl};
	tile.updateCall(s, false);
	let r = {call:spot.rc, sq:spot.rl, txrx:'rx', isHl:isHl};
	tile.updateCall(r, false);
	tile.updateConn(s,r);
	tile.redraw(false) // redraws highlights only
}

class tileClass{
  constructor(tileDataSetName) {
	this.bandTile = freeTiles.pop(); // change this to use createelement & remove the loop from the top of main (still use template in HTML?)
	this.canvas = this.bandTile.querySelector('canvas');
	this.bandTile.dataset.band = tileDataSetName;          
	this.bandTile.querySelector('.bandTileTitle').textContent = tileDataSetName;	
    this.ctx = this.canvas.getContext('2d');
	this.canvasSize = {w:1200, h:600};
	this.zoomParams = {scale:1.2, lat0:0, lon0:0};
    this.bgCol = 'white';
    this.calls = new Map();
	this.connections = new Set();
	this.drawMap();
	if (view == "Home") this.bandTile.classList.remove('hidden');
	tiles.set(tileDataSetName, this);
	console.log("Ceated chart for "+tileDataSetName);
	this.flag=false;
  }
  px(ll){
    let z = this.zoomParams;
	let xnorm = 0.5 + z.scale*(ll[1] - z.lon0)/360;
    let ynorm = 0.5 + z.scale*(ll[0] - z.lat0)/180;
	let x = this.canvasSize.w*xnorm;
	let y = this.canvasSize.h*ynorm;
    return [x,this.canvasSize.h-y];
  }
  updateCall(s, redrawAll){
      let cInfo = this.calls.get(s.call);
      if (!cInfo) {
		let sq = s.sq;
        cInfo = {p:this.px(mhToLatLong(sq)), sq:sq, tx:s.txrx=='tx',rx:s.txrx=='rx', isHl:s.isHl};
        this.calls.set(s.call, cInfo);
      }
	  if(redrawAll) cInfo.p = this.px(mhToLatLong(cInfo.sq)); // if redrawing All, call will be in this.calls and we just update position for new zoom
	  cInfo.tx ||= s.txrx=='tx';
      cInfo.rx ||= s.txrx=='rx';
      let pcol = null;
      if(cInfo.isHl){
        pcol= (cInfo.tx && cInfo.rx)? colours.txrxhl: (cInfo.tx? colours.txhl: colours.rxhl);
      } else {
        pcol= (cInfo.tx && cInfo.rx)? colours.txrx: (cInfo.tx? colours.tx: colours.rx);
      }
      this.drawBlob(this.ctx,cInfo.p,12,pcol);
  }
  redraw(redrawAll){
    for (const cl of this.calls.keys()) { 
	    let cInfo = this.calls.get(cl);
		if(cInfo.hl || redrawAll) this.updateCall({call:cl}, redrawAll);
	}  
	for (const conn of this.connections){
		let sInfo = this.calls.get(conn.split("|")[0]);
		let rInfo = this.calls.get(conn.split("|")[1]);
		let isHl = sInfo.isHl || rInfo.isHl;
		if(isHl || redrawAll) this.drawLine(this.ctx, sInfo.p, rInfo.p, isHl? colours.connhl:colours.conn);
	}
  }
  updateConn(s,r){
	 let conn = s.call+"|"+r.call;
	 this.connections.add(conn);
	 let sInfo = this.calls.get(s.call);
     let rInfo = this.calls.get(r.call);
     let col = (sInfo.isHl || rInfo.isHl)? colours.connhl:colours.conn;
     this.drawLine(this.ctx, sInfo.p, rInfo.p, col)
  }
  
  drawMap(){
    this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    this.ctx.lineWidth = 2;
    worldGeoJSON?.features.forEach(feature => {
      const geom = feature.geometry;
      if (geom.type === 'Polygon') {
        this.drawPolygon(geom.coordinates, this.ctx);
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(polygon => this.drawPolygon(polygon));
      }
    });
  }
 
	drawPolygon(rings, ctx) {
	  rings.forEach(ring => {
		this.ctx.beginPath();
		ring.forEach(([lon, lat], i) => {
		  let p = this.px([lat, lon]);
		  i === 0 ? this.ctx.moveTo(p[0], p[1]) : this.ctx.lineTo(p[0], p[1]);
		});
		this.ctx.closePath();
		this.ctx.stroke();
	  });

	}
	
	drawBlob(ctx,xy,sz,col){
		ctx.fillStyle = col;
		ctx.beginPath();
		ctx.arc(xy[0],xy[1],sz/2,0,6.282);
		ctx.fill();
	}
	
	drawLine(ctx,p0,p1,col){
		ctx.strokeStyle = col;
		ctx.lineWidth=1;
		ctx.beginPath();
		ctx.moveTo(p0[0],p0[1]);
		ctx.lineTo(p1[0],p1[1]);
		ctx.stroke();
	}
  
    clear(){
	  this.ctx.clearRect(0,0, 2000,2000);
	}
}





 