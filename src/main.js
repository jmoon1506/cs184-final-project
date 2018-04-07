var camera, scene, raycaster, renderer, stats, controls, engine;
var meshes = {}; // { id : mesh }
var bodies = []; // physics rigidbodies
var floor, floorMaterial;
var sdfTest, sdfMaterial;
var bufferScene, bufferTexture;
var showStats = true;
var nextObjectId = 0;
var frustumSize = 1000;
var mouse = new THREE.Vector2();

var floorVertexShader = 
'void main() {' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );' +
'}';

var floorFragmentShader = 
'void main() {' +
'  gl_FragColor = vec4(0.5, 0.1, 0.2, 1.);' +
'}';

var sdfFragmentShaderPart1 =
'#define PI 3.14159265359\n' +
'#define EPS 1.0\n' +
'uniform vec2 resolution;\n' +
'mat2 rotate(float angle) {\n' +
'  float c = cos(angle);\n' +
'  float s = sin(angle);\n' +
'  return mat2(c,-s,\n' +
'              s,c);\n' +
'}\n' +
'float box(vec2 pos, vec2 size, float angle) {\n' +
'  vec2 p = pos + resolution.xy;' +
'  vec2 v = gl_FragCoord.xy - p;\n' +
'  v = rotate( angle ) * v;\n' +
'  v = v + p;\n' +
'  vec2 b = size / 2.;\n' +
'  v = max( (p - b) - v,  v - (p + b) );\n' +
// '  v -= resolution.xy;\n' +
// '  return min(0., max(v.x, v.y));\n' +
'  return max(v.x, v.y);' +
'}\n' +
'float circle(vec2 pos, float size) {\n' +
'  return length(gl_FragCoord.xy - vec2(600., 100.)) - 100.;\n' +
'}\n' +
'void main() {';

var sdfCircle = function(position, size, color) { return '' +
'  if (circle(vec2(' + glslVector2(position) + '), ' + glslFloat(size) + ') < EPS) {' +
'    gl_FragColor = vec4(' + glslColor(color, 1) + '); }';
}

var sdfBox = function(position, size, angle, color) { return '' +
'  if (box(vec2(' + glslVector2(position) + '), vec2(' + glslVector2(size) + '), ' + glslFloat(angle) + ') < EPS) {' +
'    gl_FragColor = vec4(' + glslColor(color, 1) + '); }';
}

function makeSdfFragmentShader() {
  var sdfFragmentShaderPart2 = '';
  var prefix = '';
  var empty = true;
  for (var id in meshes) {
    var m = meshes[id]
    if (m == undefined) continue;
    if (m.shape === 'Box') {
      // console.log(m);
      sdfFragmentShaderPart2 += prefix + sdfBox(m.position, new THREE.Vector2(m.geometry.parameters.width, m.geometry.parameters.height), 
        m.rotation.z, m.material.color);
      prefix = ' else ';
      empty = false;
    }
  }
  if (empty) {
    return sdfFragmentShaderPart1 + ' gl_FragColor = vec4(0., 0., 0., 0.); }';
  } else {
    return sdfFragmentShaderPart1 + sdfFragmentShaderPart2 + ' else { gl_FragColor = vec4(0., 0., 0., 0.); } }';
  }
}

function glslFloat(val) {
  if (val % 1 == 0)
    return '' + val + '.';
  else
    return '' + val;
}

function glslVector2(vec) {
  return glslFloat(vec.x) + ',' + glslFloat(vec.y);
}

function glslColor(rgb, a) {
  return glslFloat(1) + ',' + glslFloat(0) + ',' + glslFloat(0) + ',' + glslFloat(a);
}

////////////////////////////////////////////////////////////////////////////////
// Main Program
////////////////////////////////////////////////////////////////////////////////

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

  // Objects and floor
  addObjects(defaultObjectParams());
  floorMaterial = new THREE.ShaderMaterial( {
    vertexShader: floorVertexShader,
    fragmentShader: floorFragmentShader
  } );
  floor = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), floorMaterial );
  scene.add(floor);
  floor.position.set(0, 0, -1);

  // Debug SDF surface
  sdfMaterial = new THREE.ShaderMaterial( {
    uniforms: { resolution: { type: "v2", value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) } },
    vertexShader: floorVertexShader,
    fragmentShader: makeSdfFragmentShader(),
    transparent: true,
  } );
  sdfTest = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), sdfMaterial );
  scene.add(sdfTest);
  sdfTest.position.set(0, 0, 1);

  // Ray bundling
  // var bufferScene = new THREE.Scene();
  // var bufferTexture = new THREE.WebGLRenderTarget( 1024, 30 * 360, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter});
  // var bufferMaterial = new THREE.MeshBasicMaterial({map:bufferTexture});
};

function animate() {
  requestAnimationFrame( animate );
  render();

  if (showStats) {
    stats.update();
  }
}
function render() {
  // renderer.render( bufferScene, camera, bufferTexture );
  renderer.render( scene, camera );
  sdfMaterial.fragmentShader = makeSdfFragmentShader();
  sdfMaterial.needsUpdate = true;
}

////////////////////////////////////////////////////////////////////////////////
// Objects
////////////////////////////////////////////////////////////////////////////////


function addObjects(objectParams) {
  for (var i = 0; i < objectParams.length; i++) {
    var o = objectParams[i];
    var material = new THREE.MeshBasicMaterial({color: o.color});
    if (o instanceof BoxParam) {
      var box = new THREE.Mesh( new THREE.PlaneGeometry( o.size.x, o.size.y ), material );
      scene.add(box);
      box.position.set(o.position.x, o.position.y, 0);
      box.rotation.z = o.rotation;
      box.isStatic = o.isStatic;
      box.isEmitter = o.isEmitter;
      box.emission = o.emission;
      box.shape = 'Box';

      meshes[o.id] = box;
      // bodies.push( Matter.Bodies.rectangle(o.position.x, o.position.y, o.size.x, o.size.y), { isStatic: o.isStatic } );
    }
  }
  // console.log(meshes);
  // Matter.World.add(engine.world, bodies);
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

////////////////////////////////////////////////////////////////////////////////
// Object Params
////////////////////////////////////////////////////////////////////////////////

function BoxParam(params) {
  this.id = nextObjectId++;
  this.position = params['position'];
  this.size = params['size'];
  this.rotation = params['rotation'];
  this.color = params['color'];
  if ( 'emission' in params ) {
    this.isEmitter = true;
    this.emission = params['emission'];
  } else {
    this.isEmitter = false;
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
                           'rotation':Math.PI/5., 'color':"#009966", 'isStatic':true } ) );
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(-150, -100), 'size':new THREE.Vector2(250, 250), 
                           'rotation':0., 'color':"#009966", 'emission':"#ff0000", 'isStatic':true } ) );
  return objectParams;
}