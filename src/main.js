var camera, scene, raycaster, renderer, stats, controls, engine;
var meshes = {}; // { id : mesh }
var bodies = []; // physics rigidbodies
var meshBuffer = {};
var intersectBuffer = {};
var showStats = true;
var frustumSize = 1000;
var mouse = new THREE.Vector2();
var lastTick = 0;
// var stripes = new THREE.TextureLoader().load( "../src/img/stripes.png" );
// var pattern = new THREE.TextureLoader().load( "../src/img/pattern.jpg" );

var sceneWidth = 1024;
var sceneHeight = 800;
var meshBufferWidth = 3;     // data pixels per object
var meshBufferHeight = 300;  // max object count
var isectBufferWidth = 1024; // rays per angle
var isectDepth = 30;         // isects per ray
var isectBufferHeight = 180 * isectDepth;

var testMesh, testMat;

var meshBufVert = 
'attribute vec4 meshData;\n' +
'varying vec4 v_meshData;\n' +
'varying float v_index;\n' +
'void main() {\n' +
'  v_meshData = meshData;\n' +
'  v_index = position.x;\n' +
'  gl_PointSize = 1.0;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n' +
'}';

var meshBufFrag = 
'#define SHAPE_TYPES 2.0\n' +
'#define TWO_PI 6.28318530718\n' +
'#define SCENE_SIZE vec2(' + sceneWidth + ',' + sceneHeight +')\n' +
'varying vec4 v_meshData;\n' +
'varying float v_index;\n' +
'void main() {\n' +
'  if (v_index < 0.1) {\n' +
// '    gl_FragColor = vec4(1., 0., 0., 1.);' +
'    float shape = v_meshData.x / SHAPE_TYPES;\n' +
'    float rotation = v_meshData.y - TWO_PI * floor(v_meshData.y / TWO_PI);\n' +
'    gl_FragColor = vec4(shape, rotation / TWO_PI, 0.0, 1.0);\n' +
'  } else if (v_index < 1.1) {\n' +
// '    gl_FragColor = vec4(1., 0., 0., 1.);' +
'    gl_FragColor = (v_meshData + (SCENE_SIZE/2.0).xyxy) / SCENE_SIZE.xyxy;\n' +
'  } else {\n' +
// '    gl_FragColor = vec4(0., 0., 1., 1.);' +
'    gl_FragColor = v_meshData;\n' +
'  }\n' +
'}';

var meshBufTestFrag =
'#define MESH_BUF_HEIGHT ' + meshBufferHeight + '\n' +
'#define SHAPE_TYPES 2.0\n' +
'#define TWO_PI 6.28318530718\n' +
'#define SCENE_SIZE vec2(' + sceneWidth + ',' + sceneHeight +')\n' +
'#define EPS 1.0\n' +
'uniform vec2 resolution;\n' +
'uniform sampler2D meshBuffer;\n' +
'mat2 rotate(float angle) {\n' +
'  float c = cos(angle);\n' +
'  float s = sin(angle);\n' +
'  return mat2(c,-s,\n' +
'              s,c);\n' +
'}\n' +
'float box(vec2 pos, vec2 size, float angle) {\n' +
'  vec2 p = pos + resolution.xy;\n' +
'  vec2 v = gl_FragCoord.xy - p;\n' +
'  v = rotate( angle ) * v;\n' +
'  v = v + p;\n' +
'  vec2 b = size / 2.;\n' +
'  v = max( (p - b) - v,  v - (p + b) );\n' +
'  return max(v.x, v.y);' +
'}\n' +
'void main() {\n' +
'  gl_FragColor = vec4(0.0);\n' +
'  float col0 = 0.0;\n' +
'  float col1 = 1.0 / resolution.x;\n' +
'  float col2 = 2.0 / resolution.x;\n' +
'  for (int j = 0; j < MESH_BUF_HEIGHT; j++) {\n' +
'    float row = float(j) / resolution.y;\n' +
'    vec4 pix0 = texture2D(meshBuffer, vec2(row, col0));\n' +
'    float shape = pix0.r * SHAPE_TYPES;\n' +
'    if (shape < 0.1) continue;\n' +
'    float rotation = pix0.g * TWO_PI;\n' +
'    vec4 pix1 = texture2D(meshBuffer, vec2(row, col1));\n' +
'    vec4 pix2 = texture2D(meshBuffer, vec2(row, col2));\n' +
'    vec4 pos_size = pix1 * SCENE_SIZE.xyxy - (SCENE_SIZE/2.0).xyxy;\n' +
'    if (shape < 1.1) {\n' +
'      if (box(pos_size.xy, pos_size.zw, rotation) < EPS) {\n' +
'        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n' +
'        break;\n' +
'      }\n' +
'    }\n' +
'  }\n' +
'}';

var isectBufVert = 
'varying vec2 v_position;\n' +
'void main() {\n' +
'  v_position = position.xy;\n' +
'  gl_PointSize = 1.;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n' +
'}';

var isectBufFrag = 
'varying vec2 v_position;\n' +
'uniform vec2 resolution;\n' +
'uniform sampler2D meshBuffer;\n' +
'void main() {\n' +
// '  gl_FragColor = vec4(1., 0., 0., 1.);' +
'  gl_FragColor = texture2D(meshBuffer, v_position / resolution);' +
// '  gl_FragColor = texture2D(meshBuffer, v_uv);' +
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
    if (m.shape < 0.1) continue;
    else if (m.shape < 1.1) {
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
  // console.log(window.devicePixelRatio);
  renderer.setSize( container.offsetWidth, container.offsetHeight );
  if (showStats) {
    stats = new Stats();
    container.appendChild( stats.dom );
  }

  addObjects(defaultObjectParams());

  meshBuffer.camera = new THREE.OrthographicCamera( 0, meshBufferWidth, meshBufferHeight, 0, -1, 1 );
  meshBuffer.scene = new THREE.Scene();
  meshBuffer.target = new THREE.WebGLRenderTarget( meshBufferWidth, meshBufferHeight,
    { format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });

  meshBuffer.mesh = setupBuffer(meshBufferWidth, meshBufferHeight, meshBufVert, meshBufFrag);
  meshBuffer.mesh.geometry.addAttribute( 'meshData', new THREE.BufferAttribute( new Float32Array( meshBufferWidth * meshBufferHeight * 4 ), 4 ) );
  // meshBuffer.mesh.geometry.addAttribute( 'shape_rot', new THREE.BufferAttribute( new Float32Array( meshBufferWidth * meshBufferHeight * 4 ), 4 ) );
  // meshBuffer.mesh.geometry.addAttribute( 'pos_size', new THREE.BufferAttribute( new Float32Array( meshBufferWidth * meshBufferHeight * 4 ), 4 ) );
  // meshBuffer.mesh.geometry.addAttribute( 'emission', new THREE.BufferAttribute( new Float32Array( meshBufferWidth * meshBufferHeight * 4 ), 4 ) );
  meshBuffer.scene.add(meshBuffer.mesh);
  // scene.add(meshBuffer.mesh);


  testMat = new THREE.ShaderMaterial( {
    uniforms: { 
      meshBuffer: { type: "t", value: meshBuffer.target.texture },
      resolution: { type: "v2", value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) } 
    },
    fragmentShader: meshBufTestFrag,
    // fragmentShader: makeSdfFragmentShader(),
    transparent: true,
  } );
  testMesh = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), testMat );
  scene.add(testMesh);
  testMesh.position.set(0, 0, 1);

/*  intersectBuffer.mesh = setupBuffer(meshBufferWidth, meshBufferHeight, isectBufVert, isectBufFrag);
  intersectBuffer.mesh.material.uniforms = {
    meshBuffer: { type: "t", value: meshBuffer.target.texture },
    resolution: { type: "v2", value: new THREE.Vector2( meshBufferWidth, meshBufferHeight ) },
  };
  scene.add(intersectBuffer.mesh);*/
};

function setupBuffer(width, height, vertexShader, fragmentShader) {
  var positions = new Float32Array( width * height * 3 );
  for ( var j = 0; j < height; j++ ) {
    for ( var i = 0; i < width; i++ ) {
      positions[3 * (width*j+i)] = i; // x
      positions[3 * (width*j+i) + 1] = j; // y
    }
  }
  var geometry = new THREE.BufferGeometry();
  geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  var material = new THREE.ShaderMaterial( {
    vertexShader:    vertexShader,
    fragmentShader:  fragmentShader,
    depthTest:       false,
    transparent:     true,
  } );
  return new THREE.Points( geometry, material );
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
    updateMeshBuffer();
    // updateTestPoints();
  }
  render();

  if (showStats) {
    stats.update();
  }
}
function render() {
  renderer.render( meshBuffer.scene, meshBuffer.camera, meshBuffer.target );
  renderer.render( scene, camera );
  // testMat.fragmentShader = makeSdfFragmentShader();
  // testMat.needsUpdate = true;
}

function updateMeshBuffer() {
  var meshData = meshBuffer.mesh.geometry.attributes.meshData;
  meshData.array.fill(0);

  for (var j in meshes) {
    var m = meshes[j];
    if (m == undefined) continue;
    var h = 4 * meshBufferWidth * j;
    meshData.array[h] = m.shape;
    meshData.array[h+1] = m.rotation.z;
    meshData.array[h+4] = m.position.x;
    meshData.array[h+5] = m.position.y;
    meshData.array[h+6] = m.size.x;
    meshData.array[h+7] = m.size.y;
    meshData.array[h+8] = m.emission.r;
    meshData.array[h+9] = m.emission.g;
    meshData.array[h+10] = m.emission.b;
    meshData.array[h+11] = m.emission.a;
  }
  meshData.needsUpdate = true;
}

function updateTestPoints() {
  var shape_rot = meshBuffer.mesh.geometry.attributes.shape_rot;
  var pos_size = meshBuffer.mesh.geometry.attributes.pos_size;
  var emission = meshBuffer.mesh.geometry.attributes.emission;
  for (var i = 0; i < meshBufferWidth * meshBufferHeight * 4; i++) {
    if (i % 4 == 0) {               // red
      shape_rot.array[i] = 1;
      pos_size.array[i] = 0;
      emission.array[i] = 0;
    } else if (i % 4 == 1) {        // green
      shape_rot.array[i] = 0;
      pos_size.array[i] = 1;
      emission.array[i] = 0;
    } else if (i % 4 == 2) {        // blue
      shape_rot.array[i] = 0;
      pos_size.array[i] = 0;
      emission.array[i] = 1;
    } else {                        // alpha
      shape_rot.array[i] = 1;
      pos_size.array[i] = 1;
      emission.array[i] = 1;
    }
/*    shape_rot.array[i] = Math.random();
    pos_size.array[i] = Math.random();
    emission.array[i] = Math.random();*/
  }
  shape_rot.needsUpdate = true;
  pos_size.needsUpdate = true;
  emission.needsUpdate = true;

  // meshBuffer.target.texture.needsUpdate = true;
  // intersectBuffer.mesh.material.uniforms.meshBuffer.value.needsUpdate = true;
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
      mesh.emission = hexToRGBA(o.emission);
      mesh.shape = 1;
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
  for (var i = 1; i < meshBufferHeight; i++) {
    if (meshes[i] == undefined) return i;
  }
  throw "Could not find an empty index in the mesh buffer!";
}

////////////////////////////////////////////////////////////////////////////////
// Object Params
////////////////////////////////////////////////////////////////////////////////

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
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
      a: parseInt(result[4], 16) / 255
  } : null;
}