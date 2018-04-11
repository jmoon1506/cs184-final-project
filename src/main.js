var camera, scene, raycaster, renderer, stats;
var gpuCompute, idShapeRotVariable, posSizeVariable, emissionVariable;
var lastTick;
var meshes = {}; // { id : mesh }
var bodies = []; // physics rigidbodies
var gpuComputeSize = 512;
var showStats = true;
var frustumSize = 1000;
// var stripes = new THREE.TextureLoader().load( "../src/img/stripes.png" );
// var pattern = new THREE.TextureLoader().load( "../src/img/pattern.jpg" );

////////////////////////////////////////////////////////////////////////////////
// Main Program
////////////////////////////////////////////////////////////////////////////////

if (!Detector.webgl) Detector.addGetWebGLMessage();
init();
animate();

function init() {
  var container = document.getElementById('container');
  var aspect = container.offsetWidth / container.offsetHeight;
  camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, -1, 1 );
  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xf0f0f0 );
  raycaster = new THREE.Raycaster();
  renderer = new THREE.WebGLRenderer();
  container.appendChild(renderer.domElement);
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( container.offsetWidth, container.offsetHeight );
  if (showStats) {
    stats = new Stats();
    container.appendChild( stats.dom );
  }
  addObjects(defaultObjectParams());
}

function initComputeRenderer() {
  gpuCompute = new GPUComputationRenderer( meshBufferSize, meshBufferSize, renderer );

  var idShapeRot = gpuCompute.createTexture();
  var posSize = gpuCompute.createTexture();
  var emission = gpuCompute.createTexture();
  fillIdShapeRotTexture( idShapeRot );
  fillPosSizeTexture( posSize );
  fillEmissionTexture( emission );

  idShapeRotVariable = gpuCompute.addVariable( "textureIdShapeRot", document.getElementById( 'fragmentShaderVelocity' ).textContent, idShapeRot );
  posSizeVariable = gpuCompute.addVariable( "texturePosSize", document.getElementById( 'fragmentShaderPosition' ).textContent, posSizeVariable );
  emissionVariable = gpuCompute.addVariable( "textureEmission", document.getElementById( 'fragmentShaderPosition' ).textContent, emissionVariable );


  gpuCompute.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
  gpuCompute.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );

  positionUniforms = positionVariable.material.uniforms;
  velocityUniforms = velocityVariable.material.uniforms;

  positionUniforms.time = { value: 0.0 };
  positionUniforms.delta = { value: 0.0 };
  velocityUniforms.time = { value: 1.0 };
  velocityUniforms.delta = { value: 0.0 };
  velocityUniforms.testing = { value: 1.0 };
  velocityUniforms.seperationDistance = { value: 1.0 };
  velocityUniforms.alignmentDistance = { value: 1.0 };
  velocityUniforms.cohesionDistance = { value: 1.0 };
  velocityUniforms.freedomFactor = { value: 1.0 };
  velocityUniforms.predator = { value: new THREE.Vector3() };
  velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed( 2 );

  velocityVariable.wrapS = THREE.RepeatWrapping;
  velocityVariable.wrapT = THREE.RepeatWrapping;
  positionVariable.wrapS = THREE.RepeatWrapping;
  positionVariable.wrapT = THREE.RepeatWrapping;

  var error = gpuCompute.init();
  if ( error !== null ) {
      console.error( error );
  }
}

function fillPositionTexture( texture ) {

var theArray = texture.image.data;

for ( var k = 0, kl = theArray.length; k < kl; k += 4 ) {

var x = Math.random() * BOUNDS - BOUNDS_HALF;
var y = Math.random() * BOUNDS - BOUNDS_HALF;
var z = Math.random() * BOUNDS - BOUNDS_HALF;

theArray[ k + 0 ] = x;
theArray[ k + 1 ] = y;
theArray[ k + 2 ] = z;
theArray[ k + 3 ] = 1;

}

}

function fillVelocityTexture( texture ) {

var theArray = texture.image.data;

for ( var k = 0, kl = theArray.length; k < kl; k += 4 ) {

var x = Math.random() - 0.5;
var y = Math.random() - 0.5;
var z = Math.random() - 0.5;

theArray[ k + 0 ] = x * 10;
theArray[ k + 1 ] = y * 10;
theArray[ k + 2 ] = z * 10;
theArray[ k + 3 ] = 1;

}

}

function animate(tick) {
  requestAnimationFrame( animate );
  for (var id in meshes) {
    var m = meshes[id];
    if (!m.isStatic) {
      m.position.set(m.position.x + 2.0 * Math.random() - 1.0, m.position.y + 2.0 * Math.random() - 1.0, 0);
    }
  }
  if(!lastTick || tick - lastTick >= 500) {
    lastTick = tick;
  }
  render();

  if (showStats) {
    stats.update();
  }
}
function render() {
  renderer.render( scene, camera );
}

////////////////////////////////////////////////////////////////////////////////
// Objects
////////////////////////////////////////////////////////////////////////////////

function addObjects(objectParams) {
  for (var i = 0; i < objectParams.length; i++) {
    var o = objectParams[i];
    var meshId = getNextMeshId();
    var material = new THREE.MeshBasicMaterial({ color: o.color });
    var mesh;
    if (o instanceof BoxParam) {
      mesh = new THREE.Mesh( new THREE.PlaneGeometry( o.size.x, o.size.y ), material );
      mesh.size = o.size;
      mesh.rotation.z = o.rotation;
      mesh.emission = o.emission;
      mesh.shape = 0;
    } else if (o instanceof CircleParam) {

    }
    scene.add(mesh);
    mesh.isStatic = o.isStatic;
    mesh.position.set(o.position.x, o.position.y, 0);
    mesh.meshId = meshId;
    meshes[mesh.meshId] = mesh;
  }
}

function removeObjects(ids) {
  if (typeof ids == 'undefined') {
    ids = meshes;
  }
  for (var id in ids) {
    if (meshes[id] == undefined) continue;
    meshes[id].geometry.dispose();
    meshes[id].material.dispose();
    scene.remove( meshes[id] );
    delete meshes[id];
  }
}

function getNextMeshId() {
  for (var i = 0; i < 1024; i++) {
    if (meshes[i] == undefined) return i;
  }
  throw "Could not find an empty index in the mesh buffer!";
}

function BoxParam(params) {
  this.position = params['position'];
  this.size = params['size'];
  this.rotation = params['rotation'];
  this.color = params['color'];
  if ( 'emission' in params ) {
    this.emission = params['emission'];
  } else {
    this.emission = "#0000";
  }
  if ( 'isStatic' in params ) {
    this.isStatic = params['isStatic'];
  } else {
    this.isStatic = true;
  }
  if ( 'mass' in params ) {
    this.mass = params['mass'];
  }
}

function CircleParam(params) {
  this.position = params['position'];
  this.radius = params['radius'];
  this.color = params['color'];
  if ( 'emission' in params ) {
    this.emission = params['emission'];
  } else {
    this.emission = "#0000";
  }
  if ( 'isStatic' in params ) {
    this.isStatic = params['isStatic'];
  } else {
    this.isStatic = true;
  }
  if ( 'mass' in params ) {
    this.mass = params['mass'];
  }
}

function defaultObjectParams() {
  var objectParams = [];
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(400, 0), 'size':new THREE.Vector2(10, 810), 
                           'rotation':0., 'color':"#009966", 'isStatic':true } ) );
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(-400, 0), 'size':new THREE.Vector2(10, 810), 
                           'rotation':0., 'color':"#009966", 'isStatic':true } ) );
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(0, -400), 'size':new THREE.Vector2(10, 810), 
                           'rotation':Math.PI/2., 'color':"#009966", 'isStatic':true } ) );
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(0, 400), 'size':new THREE.Vector2(10, 810), 
                           'rotation':Math.PI/2., 'color':"#009966", 'isStatic':true } ) );
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(200, 150), 'size':new THREE.Vector2(100, 200), 
                           'rotation':Math.PI/5., 'color':"#009966", 'isStatic':false } ) );
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(-150, -100), 'size':new THREE.Vector2(250, 250), 
                           'rotation':0., 'color':"#009966", 'emission':"#ff0000ff", 'isStatic':false } ) );
  return objectParams;
}

function hexToRGBA(hex) {
  if (hex.length == 4) hex += 'f';
  else if (hex.length == 7) hex += 'ff';
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])([a-f\d])$/i; // Expand shorthand form (e.g. "03FF") to full form (e.g. "0033FFFF")
  hex = hex.replace(shorthandRegex, function(m, r, g, b, a) { return r + r + g + g + b + b + a + a; });
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: parseInt(result[4], 16)
  } : null;
}