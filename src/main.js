import {connectToFeed} from './mqtt.js';
import {loadConfig, updateMyCall, updateSquaresList} from './config.js';
import {tileInstances} from './plots.js'

document.getElementById('myCallInput').addEventListener('change', () => { updateMyCall(); resetData();});
document.getElementById('homeSquaresInput').addEventListener('change', () => {updateSquaresList();resetData();});

function actionOf(el) 	{return el.dataset.action || null;}

export var view = "Home";
var nColumns = 3;

function ceilingXbyY(x,y){
	return (x>y)? y:x;
}
function floorXbyY(x,y){
	return (x<y)? y:x;
}

export const colours =   {tx:'rgba(230, 30, 30, .3)', 	rx:		'rgba(30, 230, 30, .3)',	txrx:'rgba(20, 20, 250, .3)',
						  txhl:'rgba(255, 0, 0, 1)', 	rxhl:	'rgba(0, 255, 0, 1)',		txrxhl:'rgba(0, 0, 255, 1)',
					conn:'rgba(80, 180, 250, .2)' , connhl: 'rgba(50, 50, 250, .6)'
					};

document.getElementById('legendMarkerTx').style.background = colours.tx;
document.getElementById('legendMarkerRx').style.background = colours.rx;
document.getElementById('legendMarkerTxRx').style.background = colours.txrx;
document.getElementById('moreColumns').addEventListener("click", function (e) {addRemoveColumns('more')});
document.getElementById('fewerColumns').addEventListener("click", function (e) {addRemoveColumns('fewer')});

setInterval(() => sortTiles(), 1000);

const mainView = document.querySelector('#mainView');
const tilesGrid = document.querySelector('#tilesGrid');
const mainViewTray = document.querySelector('#mainViewTray');
document.addEventListener('click', e => {if(actionOf(e.target)=='home') restoreAll();}); 	// split here to remember columns and tray bands
tilesGrid.addEventListener('click', e => {if(actionOf(e.target)=='minimise') minimiseTile(e.target.closest('.tile'));});
mainViewTray.addEventListener('click', e => {if(e.target.classList?.contains('tileButton')) restoreTileFromButton(e.target);});
tilesGrid.addEventListener('click', e => {if(actionOf(e.target)=='setSingle') setSingle(e.target.closest('.tile'));});
mainViewTray.addEventListener("click", e => {if(actionOf(e.target)=='hideHeaderAndFooter') hideHeaderAndFooter(e.target)});
mainViewTray.addEventListener("click", e => {if(actionOf(e.target)=='restoreHeaderAndFooter') restoreHeaderAndFooter(e.target);}); // 

tilesGrid.addEventListener('click', e => {if(actionOf(e.target)=='zoom') {tileInstances.get(e.target.id).zoom(e);}});

function resetData(){
	for (const el of document.querySelectorAll('.tile')) el.classList.add('hidden');
	tileInstances = new Map();
}

function hideHeaderAndFooter(clicked){
	clicked.nextElementSibling.classList.remove('hidden');
	clicked.classList.add('hidden');
	for (const el of document.querySelectorAll('.hideForMaxView')) el.classList.add('hidden');
}
function restoreHeaderAndFooter(clicked){
	clicked.previousElementSibling.classList.remove('hidden');
	clicked.classList.add('hidden');
	for (const el of document.querySelectorAll('.hideForMaxView')) el.classList.remove('hidden');
}

function checkMinimisedTiles(){
	let homeButton = document.getElementById('home-button');
	let nHidden = mainViewTray.querySelectorAll('.tileButton').length;
	console.log("nHidden "+nHidden);
	if(nHidden > 2) {homeButton.classList.remove("inactive");} else {homeButton.classList.add("inactive");}
}

function minimiseTile(tileElement) {
  let tileName = tileElement.querySelector('canvas').id;
  console.log("minimise " + tileName)
  tileElement.classList.add('hidden');
  let btn = mainViewTray.querySelector('#btn'+tileName);
  if (!btn) {
    btn = document.createElement('button');
	btn.classList.add('control', 'windowBarButton', 'tileButton');
    btn.id = "btn"+tileName;
    btn.textContent = tileName;
    mainViewTray.appendChild(btn);
	checkMinimisedTiles();
  }
}
function restoreAll(){
	// split here to remember columns and tray bands
	console.log("Restore all");
	for (const tileElement of tilesGrid.querySelectorAll('.tile')) {restoreTile(tileElement);}
}
function restoreTile(tileElement) {
    tileElement.classList.remove('hidden');
	resetTileControls(tileElement);
	let tileName = tileElement.querySelector('canvas').id;
	let btn = mainViewTray.querySelector('#btn'+tileName);
    if(btn) btn.remove();
    view="Home";
	document.getElementById('moreColumns').classList.remove("inactive");
	document.getElementById('fewerColumns').classList.remove("inactive");
	nColumns = 3;
	tilesGrid.setAttribute("style", "grid-template-columns: 1fr 1fr 1fr;");
	sortTiles();
	checkMinimisedTiles();
}
function restoreTileFromButton(buttonElement){
	let canvasElement = tilesGrid.querySelector("#"+buttonElement.id.replace("btn",""));
	console.log(canvasElement.id);
	let tileElement = canvasElement.closest('.tile');
	restoreTile(tileElement);
	for (const tileElement of tilesGrid.querySelectorAll('.tile')) resetTileControls(tileElement);
}

function resetTileControls(tileElement){
	tileElement.querySelector('.home').classList.add('hidden'); 
	tileElement.querySelector('.maximise').classList.remove('hidden');
	tileElement.querySelector('.minimise').classList.remove('hidden');
	tileElement.querySelector('canvas').style = 'cursor:default;';
}
function setSingle(tileElement){
	if(view == "Single") return;
	view = "Single"
	const tileName = tileElement.querySelector('canvas').id;
	tileElement.querySelector('.home').classList.remove('hidden');
	tileElement.querySelector('.maximise').classList.add('hidden');
	tileElement.querySelector('.minimise').classList.add('hidden');
	console.log("minimise all but "+tileName);
	for (const cvs of tilesGrid.querySelectorAll('canvas')) {
		if(cvs.id !=tileName) minimiseTile(cvs.closest('.tile'));
	}
	document.getElementById('home-button').classList.remove("inactive");
	document.getElementById('moreColumns').classList.add("inactive");
	document.getElementById('fewerColumns').classList.add("inactive");
	tilesGrid.setAttribute("style", "grid-template-columns: 1fr;");	
	console.log("Set view single");
	checkMinimisedTiles();
}
export function setMainViewHeight(){
	let happ = document.getElementById('app').clientHeight;
	let h = happ-20;
	for (const elId of ['ribbon', 'mainViewTray', 'footer']){
		let el = document.getElementById(elId);
		h -= (el.clientHeight + 40);
	}
	h = ceilingXbyY(h, document.getElementById('app').clientWidth);
	let el = document.getElementById('scrollContainer')
	el.style.height = h+"px";
}

function addRemoveColumns(direction){
	if(view !="Home") return;
	if (direction == "more") nColumns += (nColumns <10);
	if (direction == "fewer") nColumns -= (nColumns >1);
	tilesGrid.setAttribute("style", "grid-template-columns: repeat("+nColumns+",1fr)");
	console.log(tilesGrid.elementStyle);
}

function sortTiles() {
    const tileInstancesOrdered = Array.from(tileInstances).sort((a, b) => b[1].wavelength - a[1].wavelength);
    for (const t of tileInstancesOrdered) tilesGrid.append(t[1].tileElement);
    setMainViewHeight();
}




loadConfig();
connectToFeed();