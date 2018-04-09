var camera, scene, raycaster, renderer, stats, controls, engine;
var meshes = {}; // { id : mesh }
var bodies = []; // physics rigidbodies
var floor, floorMaterial;
var testMesh;
var floorMesh, floorMaterial; // globally illuminated surface
var meshBufferSize = 1024; // max object count
var intersectBufferWidth = 1024;
var intersectBufferCollisions = 30; // max intersection count
var intersectBufferAngles = 180;
var showStats = true;
var nextObjectId = 0;
var frustumSize = 1000;
var mouse = new THREE.Vector2();
var lastTick = 0;

var getNextMeshId = function() {
  for (var i = 0; i < meshBufferSize; i++) {
    if (meshes[i] == undefined) return i;
  }
  throw "Could not find an empty index in the mesh buffer!";
}

var meshBufferVertexShader = 
'attribute vec4 test_color;\n' +
'attribute vec4 id_shape_rot;\n' +
'attribute vec4 pos_size;\n' +
// 'attribute vec4 emissions;\n' +
// 'varying vec4 v_id_shape_rot;\n' +
'varying vec4 v_pos_size;\n' +
// 'varying vec4 v_emissions;\n' +
'void main() {\n' +
'  gl_PointSize = 3.;\n' +
// '  gl_Position = projectionMatrix * modelViewMatrix * vec4( 3. * id_shape_rot.x + 1.5, 0.5, 0., 1.);\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );' +
'}\n';

var meshBufferFragmentShader = 
// 'varying vec4 v_id_shape_rot;\n' +
'varying vec4 v_pos_size;\n' +
// 'varying vec4 v_emissions;\n' +
'void main() {\n' +
'  gl_FragColor = vec4(1., 0., 0., 1.);\n' +
'}\n';

var testVertShader = 
'attribute float size;' +
'attribute vec3 customColor;' +
'varying vec3 vColor;' +
'void main() {' +
'  vColor = customColor;' +
'  gl_PointSize = size;' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );' +
'}';

var testFragShader = 
'uniform vec3 color;' +
'uniform sampler2D texture;' +
'varying vec3 vColor;' +
'void main() {' +
'  gl_FragColor = vec4( color * vColor, 1.0 );' +
'}';
// 'uniform vec2 resolution;' +
// 'vec3 colorA = vec3(0.149,0.141,0.912);' +
// 'vec3 colorB = vec3(1.000,0.833,0.224);' +
// 'void main() {' +
// '  gl_FragColor = vec4(1024./resolution.x, 0., 0., 1.);' +
// '}';

var sdfVertexShader = 
'varying vec2 fUv;\n' +
'void main() {\n' +
'  fUv = uv;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n' +
'}\n';

var sdfFragmentShader =
'#define PI 3.14159265359\n' +
'#define EPS 1.0\n' +
'uniform sampler2D meshBuffer;\n' +
'uniform vec2 resolution;\n' +
'varying vec2 fUv;\n' +
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
'  return max(v.x, v.y);' +
'}\n' +
'float circle(vec2 pos, float size) {\n' +
'  return length(gl_FragCoord.xy - vec2(600., 100.)) - 100.;\n' +
'}\n' +
'void main() {' +
// '  gl_FragColor = texture2D(meshBuffer, vec2(fUv.x, 0.));' +
'  if (gl_FragCoord.x < 1024. && gl_FragCoord.y < 100.) {' +
'    gl_FragColor = vec4(1.0, 0., 1.0, 0.5);' +
'  } else {' +
'    gl_FragColor = vec4(0.);' +
'  }' +
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

  addObjects(defaultObjectParams());

  floorMaterial = new THREE.ShaderMaterial( {
    fragmentShader: 'void main() { gl_FragColor = vec4(0.5, 0.1, 0.2, 0.1); }',
  } );
  floor = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), floorMaterial );
  scene.add(floor);
  floor.position.set(0, 0, -1);

  var positions = []
  var test_color = [];
  var id_shape_rot = [];
  var pos_size = [];
  var emissions = [];
  for (var i = 0; i < meshBufferSize; i++) {
    if (i in meshes) {
      var m = meshes[i];
      id_shape_rot.push(i, m.shape, m.rotation.z, 0);
      pos_size.push(m.position.x, m.position.y, m.size.x, m.size.y);
      var e = hexToRGBA(m.emission);
      emissions.push(e.r, e.g, e.b, e.a);
    } else {
      id_shape_rot.push(0, 0, 0, 0);
      pos_size.push(0, 0, 0, 0);
      emissions.push(0, 0, 0, 0);
    }
    var val = i / meshBufferSize;
    test_color.push(val, val, val, 1.0);
    positions.push(i, 0, 0, 0);
  }

  // console.log(positions);
  // console.log(pos_size);
  // console.log(emissions);

/*  meshBuffer.geometry = new THREE.BufferGeometry();
  meshBuffer.geometry.addAttribute( 'positions', new THREE.Float32BufferAttribute( positions, 4 ) );
  meshBuffer.geometry.addAttribute( 'test_color', new THREE.Float32BufferAttribute( test_color, 4 ) );
  meshBuffer.geometry.addAttribute( 'id_shape_rot', new THREE.Float32BufferAttribute( id_shape_rot, 4 ) );
  meshBuffer.geometry.addAttribute( 'pos_size', new THREE.Float32BufferAttribute( pos_size, 4 ) );
  meshBuffer.geometry.addAttribute( 'emissions', new THREE.Float32BufferAttribute( emissions, 4 ) );
  meshBuffer.material = new THREE.ShaderMaterial( { 'vertexShader': meshBufferVertexShader, 'fragmentShader': meshBufferFragmentShader } );
  meshBuffer.points = new THREE.Points( meshBuffer.geometry, meshBuffer.material );

  meshBuffer.scene = new THREE.Scene();
  meshBuffer.texture = new THREE.WebGLRenderTarget( meshBufferSize * 3, 100, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter});
  meshBuffer.mesh = new THREE.Mesh( new THREE.PlaneGeometry( meshBufferSize * 3, 100 ), meshBuffer.material );
  meshBuffer.scene.add(meshBuffer.mesh);
  meshBuffer.mesh.position.set(0, 0, 1);

  meshBuffer.testmesh = new THREE.Mesh( new THREE.PlaneGeometry( meshBufferSize * 3, 100 ), new THREE.MeshBasicMaterial({ color: "#ff0000" }) );
  meshBuffer.scene.add(meshBuffer.testmesh);
  meshBuffer.testmesh.position.set(0, 0, 1);*/

  // Debug mesh buffer
  // var sdfMaterial = new THREE.MeshBasicMaterial({map:meshBuffer.texture});
  // sdfTest = new THREE.Mesh( new THREE.PlaneGeometry( meshBufferSize * 3, 100 ), sdfMaterial );
  // scene.add(sdfTest);
  // sdfTest.position.set(0, 0, 1);
      // meshBuffer: { type: "t", value: meshBuffer.texture.texture },

  var vertex = new THREE.Vector3();
  var color = new THREE.Vector3();

  var positions = new Float32Array( 100 * 3 );
  var colors = new Float32Array( 100 * 3 );
  var sizes = new Float32Array( 100 );
  for ( var i = 0; i < 100; i ++ ) {
    vertex.x = ( Math.random() * 2 - 1 ) * 100;
    vertex.y = ( Math.random() * 2 - 1 ) * 100;
    vertex.z = 0;
    vertex.toArray( positions, i * 3 );
    color.x = Math.random();
    color.y = Math.random();
    color.z = Math.random();
    color.toArray( colors, i * 3 );
    sizes[ i ] = 10;
  }
  var geometry = new THREE.BufferGeometry();
  geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  geometry.addAttribute( 'customColor', new THREE.BufferAttribute( colors, 3 ) );
  geometry.addAttribute( 'size', new THREE.BufferAttribute( sizes, 1 ) );

  // Debug SDF surface
  var material = new THREE.ShaderMaterial( {
    uniforms: { 
      color:      { value: new THREE.Color( 0xffffff ) },
    },
    vertexShader: testVertShader,
    fragmentShader: testFragShader,
    blending:       THREE.AdditiveBlending,
    depthTest:      false,
    transparent:    true
  } );
  testMesh = new THREE.Points( geometry, material );
  scene.add(testMesh);
};

function animate(tick) {
  requestAnimationFrame( animate );
  for (var id in meshes) {
    var m = meshes[id];
    if (!m.isStatic) {
      m.position.set(m.position.x + 2.0 * Math.random() - 1.0, m.position.y + 2.0 * Math.random() - 1.0, 0);
      // console.log(m.position);
    }
  }
  if(!lastTick || tick - lastTick >= 500) {
    lastTick = tick;
    updateTestPoints();
  }
  render();

  if (showStats) {
    stats.update();
  }
}
function render() {
  // renderer.render( meshBuffer.scene, camera, meshBuffer.texture );
  renderer.render( scene, camera );
  // sdfMaterial.fragmentShader = makeSdfFragmentShader();
  // sdfMaterial.needsUpdate = true;
}

function updateTestPoints() {
  var attributes = testMesh.geometry.attributes;
  for (var i = 0; i < 100 * 3; i++) {
    attributes.customColor.array[i] = Math.random();
  }
  attributes.customColor.needsUpdate = true;
}

/*function updateMeshBuffer() {
  var positions = [];
  var meshProps = []; // type, position, size, rotation, emission (7 floats)
  var attributes = meshBuffer.geometry.attributes;
  for (var i = 0; i < meshBufferSize; i++) {
    positions.push(i);
  }
  for (var id in meshes) {
    var m = meshes[id];
    // attributes.position.array[id] = m.position;
    // attributes.size.array[id] = m.size;
    // attributes.rotation.array[id] = m.rotation.z;
    // attributes.emission.array[id] = m.emission;
  }
}*/

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
  // this.id = nextObjectId++;
  this.position = params['position'];
  this.size = params['size'];
  this.rotation = params['rotation'];
  this.color = params['color'];
  if ( 'emission' in params ) {
    // this.isEmitter = true;
    this.emission = params['emission'];
  } else {
    // this.isEmitter = false;
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
  // this.id = nextObjectId++;
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