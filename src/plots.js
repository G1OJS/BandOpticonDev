import {myCall} from './config.js';
import {mhToLatLong} from './geo.js'
import {colours, view, setMainViewHeight, freeTiles} from './main.js'

export var charts = new Map();
export var activeModes = new Set();
export var callLocations = new Map();

let worldGeoJSON = null;

fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson')
  .then(resp => resp.json())
  .then(data => {
	console.log("GeoJSON loaded:", data);
    worldGeoJSON = data;
  });

export function resetData(){
	charts.forEach(chart => {chart.destroy()});
	for (const el of document.querySelectorAll('.bandTile')) el.classList.add('hidden');
	charts = new Map();
	activeModes = new Set();
	tileCanvases = Array.from(document.querySelectorAll('.bandCanvas'));
	freeCanvases = [...tileCanvases];
	callLocations = new Map(); 
	startRibbon();
}

export function hideUnwatchedModeLayers(mode) {
  charts.forEach(chart => {
    chart.data.datasets.forEach(ds => {
      chart.getDatasetMeta(chart.data.datasets.indexOf(ds)).hidden = ds.label.split("_")[0] != mode;
    });
  });
}

function getLocation(call, callSq){
	if(!callLocations.get(call)) {
		let ll = mhToLatLong(callSq);
		callLocations.set(call, {x:ll[1], y:ll[0]});
	}
	return callLocations.get(call);
}

export function addSpot(spot) {
	if(spot.md !="FT8") return;
	activeModes.add(spot.md);
	let tile = charts.get(spot.b+"-"+spot.md);
	if(!tile) tile = new BandModeTile(spot.b+"-"+spot.md);
	let isHl = (spot.sc == myCall || spot.rc == myCall);
	let s = {call:spot.sc, sq:spot.sl, txrx:'tx'};
	tile.updateCall(s, isHl);
	let r = {call:spot.rc, sq:spot.rl, txrx:'rx'};
	tile.updateCall(r, isHl);
	tile.updateConn(s,r, isHl);
	tile.redraw(2);
}

class BandModeTile {

  constructor(bandMode) {
	this.bandTile = freeTiles.pop();
	this.canvas = this.bandTile.querySelector('canvas');
	this.bandTile.dataset.band = bandMode;          
	this.bandTile.querySelector('.bandTileTitle').textContent = bandMode;	
    this.ctx = this.canvas.getContext('2d');
    this.bgCol = 'white';
    this.calls = new Map();
	this.drawMap();
	if (view == "Home") this.bandTile.classList.remove('hidden');
	charts.set(bandMode, this);
	console.log("Ceated chart for "+bandMode);
	this.flag=false;
  }
  px(ll){
    let x = (1200*(ll[1]+180)/360);
    let y = (600*(90-ll[0])/180);
    return [x,y];
  }
  updateCall(s, isHl){
      let cInfo = this.calls.get(s.call);
      if (!cInfo) {
        cInfo = {p:this.px(mhToLatLong(s.sq)), sq:s.sq, tx:s.txrx=='tx',rx:s.txrx=='rx', isHl:s.isHl};
        this.calls.set(s.call, cInfo);
      }
      cInfo.tx ||= s.txrx=='tx';
      cInfo.rx ||= s.txrx=='rx';
      let pcol = null;
      if(cInfo.isHl){
        pcol= (cInfo.tx && cInfo.rx)? colours.txrxhl: (cInfo.tx? colours.txhl: colours.rxhl);
      } else {
        pcol= (cInfo.tx && cInfo.rx)? colours.txrx: (cInfo.tx? colours.tx: colours.rx);
      }
      drawBlob(this.ctx,cInfo.p,8,pcol);
  }

  redraw(newScale){
	this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	this.drawMap();
    for (const cl of this.calls.keys()) {this.updateCall({call:cl, isHl:false})};
    this.showHighlights();	
  }
  
  showHighlights(){
    for (const cl of this.calls.keys()) { if(this.calls.get(cl).hl) this.updateCall({call:cl, isHl:true})}   
  }
  
  updateConn(s,r, isHl){
     let sInfo = this.calls.get(s.call);
     let rInfo = this.calls.get(r.call);
     let col = (isHl)? colours.connhl:colours.conn;
     drawLine(this.ctx, sInfo.p, rInfo.p, col)
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
  
  
}

function drawBlob(ctx,xy,sz,col){
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(xy[0],xy[1],sz/2,0,6.282);
  ctx.fill();
}

function drawLine(ctx,p0,p1,col){
    ctx.strokeStyle = col;
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(p0[0],p0[1]);
    ctx.lineTo(p1[0],p1[1]);
    ctx.stroke();
}





 