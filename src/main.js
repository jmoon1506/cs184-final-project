var camera, scene, raycaster, renderer, stats, controls, engine;
var meshes = {}; // { id : mesh }
var bodies = []; // physics rigidbodies
var floor, floorMaterial;
var sdfTest;
var showStats = false;
var nextObjectId = 0;
var frustumSize = 1000;
var mouse = new THREE.Vector2();

var floorVertexShader = 
'void main() {' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );' +
'}';

var floorFragmentShader = 
'void main() {' +
'  gl_FragColor = vec4(0.3, 0., 0., 1.);' +
'}';

var sdfFragmentShader =
'#define PI 3.14159265359\n' +
'mat2 rotate(float angle) {' +
'  float c = cos(angle);' +
'  float s = sin(angle);' +
'  return mat2(c,-s,' +
'              s,c);' +
'}' +
'float box(vec2 pos, vec2 size, float angle) {' +
'  vec2 v = gl_FragCoord.xy - pos;' +
'  v = rotate( angle ) * v;' +
'  v = v + pos;' +
'  vec2 b = size / 2.;' +
'  v = max( (pos - b) - v,  v - (pos + b) );' +
'  return min(0., max(v.x, v.y));' +
'}' +
'float circle(vec2 pos, float size) {' +
'  return length(gl_FragCoord.xy - vec2(600., 100.)) - 100.;' +
'}' +
'void main() {' +
'  if (box(vec2(150., 200.), vec2(100., 200.), PI / 5.) < 0.) {' +
'    gl_FragColor = vec4(0., 0.3, 0., 1.);' +
'  } else if (circle(vec2(600., 100.), 100.) < 0.) {' +
'    gl_FragColor = vec4(0., 0., 0.3, 1.);' +
'  } else {' +
'    gl_FragColor = vec4(0., 0., 0., 0.);' +
'  }' +
'}';

var sdfFragmentShaderPart2 =
'';

var sdfCircle = function(position, size, color) { return
'  if (d1 < 0.) {' +
'    gl_FragColor = vec4(0., 0.3, 0., 1.);';
}

var sdfBox = function(position, size, rotation, color) { return
'  if (d1 < 0.) {' +
'    gl_FragColor = vec4(0., 0.3, 0., 1.);';
}

init();
animate();

function init() {
  var aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, -1, 1 );
  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xf0f0f0 );
  raycaster = new THREE.Raycaster();
  renderer = new THREE.WebGLRenderer();
  var container = document.getElementById('container');
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( container.offsetWidth, container.offsetHeight );
  container.appendChild(renderer.domElement);
  if (showStats) {
    stats = new Stats();
    container.appendChild( stats.dom );
  }
  // engine = Matter.Engine.create({render: {visible: false}});

  addObjects(defaultObjectParams());

  floorMaterial = new THREE.ShaderMaterial( {
    vertexShader: floorVertexShader,
    fragmentShader: floorFragmentShader
  } );
  floor = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), floorMaterial );
  scene.add(floor);
  floor.position.set(0, 0, -1);

  sdfTest = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), new THREE.ShaderMaterial( {
    vertexShader: floorVertexShader,
    fragmentShader: sdfFragmentShader,
    transparent: true,
  } ) );
  scene.add(sdfTest);
  sdfTest.position.set(0, 0, 1);

  // Matter.Engine.run(engine);
};

function animate() {
  requestAnimationFrame( animate );
  render();

  if (showStats) {
    stats.update();
  }
}
function render() {
  renderer.render( scene, camera );
}

function addObjects(objectParams) {
  for (var i = 0; i < objectParams.length; i++) {
    var o = objectParams[i];
    var material = new THREE.MeshBasicMaterial({color: o.color});
    if (o instanceof BoxParam) {
      // console.log(o);
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
  generateSDF();
  console.log(meshes);
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

  generateSDF();
}

////////////////////////////////////////////////////////////////////////////////
// Parallel Ray Bundling
////////////////////////////////////////////////////////////////////////////////

function generateSDF() {
  for (var id in meshes) {
    if (meshes[id].valueOf() == 'Box') {

    }
  }
}

function makeRayBundleShader() {
  // material = new THREE.ShaderMaterial( {
  //     uniforms: uniforms,
  //     vertexShader: document.getElementById( 'vertexShader' ).textContent,
  //     fragmentShader: document.getElementById( 'fragmentShader' ).textContent
  //   });
}

////////////////////////////////////////////////////////////////////////////////
// Shapes
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

////////////////////////////////////////////////////////////////////////////////
// Scene Presets
////////////////////////////////////////////////////////////////////////////////

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

// document.mousemove = function(event) {
//   mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
//   mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
// }