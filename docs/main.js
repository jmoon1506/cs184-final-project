var camera, scene, raycaster, renderer, stats, controls, engine;
var meshes = {}; // { id : mesh }
var bodies = []; // physics rigidbodies
var isectBuffer, floor;
var showStats = true;
var frustumSize = 1000;
var mouse = new THREE.Vector2();
var lastTick = 0;

var shapeTypes = 2;
var sceneWidth = 2048;
var sceneHeight = 2048;
var maxMeshCount = 60;
var floatsPerMesh = 10;
var meshArraySize = floatsPerMesh * maxMeshCount;
var meshArray = new Array(meshArraySize).fill(0);
var isectBufferWidth = 200; // rays per angle
var isectDepth = 8;         // isects per ray
var isectAngles = 30;
var isectBufferHeight = isectAngles * isectDepth;

var Engine = Matter.Engine, World = Matter.World, Bodies = Matter.Bodies, Body = Matter.Body;

var testMesh, testMat;

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

var sdfFragmentShaderPart1 =
'uniform vec2 uResolution;\n' +
'mat2 rotate(float angle) {\n' +
'  float c = cos(angle);\n' +
'  float s = sin(angle);\n' +
'  return mat2(c,-s,\n' +
'              s,c);\n' +
'}\n' +
'float box(vec2 pos, vec2 size, float angle) {\n' +
'  vec2 p = pos + uResolution.xy;\n' +
'  vec2 v = gl_FragCoord.xy - p;\n' +
'  v = rotate( angle ) * v;\n' +
'  v = v + p;\n' +
'  vec2 b = size / 2.;\n' +
'  v = max( (p - b) - v,  v - (p + b) );\n' +
'  return max(v.x, v.y);' +
'}\n' +
'float circle(vec2 pos, float size) {\n' +
'  vec2 p = pos + uResolution.xy;\n' +
'  return length(gl_FragCoord.xy - p) - size;\n' +
'}\n' +
'void main() {';

/*var meshBufVert = 
'#define TWO_PI 6.28318530718\n' +
'#define ANGLE_FACTOR 0.15915494309\n' + // 1/TWOPI
'#define SHAPE_FACTOR ' + glslFloat(1 / shapeTypes) + '\n' +
'#define WIDTH_FACTOR ' + glslFloat(1 / sceneWidth) + '\n' +
'#define HEIGHT_FACTOR ' + glslFloat(1 / sceneHeight) + '\n' +
'attribute vec3 meshData;\n' +
'varying vec3 v_color;\n' +
'void main() {\n' +
'  if (position.x < 0.6) {\n' +
'    float shape = SHAPE_FACTOR * meshData.x;\n' +
'    float x = WIDTH_FACTOR * meshData.y + 0.5;\n' +
'    float y = HEIGHT_FACTOR * meshData.z + 0.5;\n' +
'    v_color = vec3(shape, x, y);\n' +
'  } else if (position.x < 1.6) {\n' +
'    float rotation = meshData.x - TWO_PI * floor(ANGLE_FACTOR * meshData.x);\n' +
'    float w = WIDTH_FACTOR * meshData.y + 0.5;\n' +
'    float h = HEIGHT_FACTOR * meshData.z + 0.5;\n' +
'    v_color = vec3(rotation * ANGLE_FACTOR, w, h);\n' +
'  } else if (position.x < 2.6) {\n' +
'    v_color = meshData;\n' +
'  } else {\n' +
'    v_color = meshData;\n' +
'  }\n' +
'  gl_PointSize = 0.5;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position.xy, 0.0, 1.0 );\n' +
'}';

var meshBufFrag = 
'varying vec3 v_color;\n' +
'void main() {\n' +
'  gl_FragColor = vec4(v_color, 1.);\n' +
'}';

var isectBufFrag = 
// '#define MESH_BUF_WIDTH ' + meshArrayWidth + '\n' +
// '#define MESH_BUF_HEIGHT ' + meshArrayHeight + '\n' +
'#define ISECT_BUF_WIDTH ' + isectBufferWidth + '\n' +
'#define ISECT_BUF_HEIGHT ' + isectBufferHeight + '\n' +
'#define ISECT_DEPTH ' + isectDepth + '\n' +
'#define ISECT_ANGLES ' + isectAngles + '\n' +
// '#define SHAPES ' + glslFloat(shapeTypes) + '\n' +
'#define SCENE_WIDTH ' + glslFloat(sceneWidth) + '\n' +
'#define SCENE_HEIGHT ' + glslFloat(sceneHeight) + '\n' +
'#define TWO_PI 6.28318530718\n' +
'uniform sampler2D meshArray;\n' +
sdfFragmentShaderPart1 +
'  vec2 dim = vec2(ISECT_BUF_WIDTH, ISECT_BUF_HEIGHT);\n' +
'  vec2 pos = gl_FragCoord.xy;\n' +
'  bvec2 gt = greaterThan(pos, 0.1 * dim);\n' +
'  bvec2 lt = lessThan(pos, 0.9 * dim);\n' +
'  float inside = float(all(lt) && all(gt));\n' +
'  gl_FragColor = inside * vec4(1., 0., 0., 0.) + (1. - inside) * vec4(0., 1., 0., 0.);\n' +
'}';*/

var floorVert = 
'varying vec2 v_uv;\n' +
'void main() {\n' +
'  v_uv = uv;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n' +
'}';

var floorFrag = 
'uniform sampler2D isectBuffer;\n' +
'varying vec2 v_uv;\n' +
'void main() {\n' +
'  gl_FragColor = texture2D(isectBuffer, v_uv);\n' +
'}';

var meshBufTestFrag =
'#define MAX_MESH_COUNT ' + maxMeshCount + '\n' +
'#define FLOATS_PER_MESH ' + floatsPerMesh + '\n' +
'#define MESH_BUF_SIZE ' + meshArraySize + '\n' +
'#define TWO_PI 6.28318530718\n' +
'uniform float uMeshArray[' + meshArraySize + '];\n' +
sdfFragmentShaderPart1 +
'  gl_FragColor = vec4(0.0);\n' +
'  for (int i = 0; i < MESH_BUF_SIZE; i+=FLOATS_PER_MESH) {\n' +
'    float shape = uMeshArray[i];\n' +
'    if (shape < 0.1) break;\n' +
'    float rotation = uMeshArray[i+1];\n' +
'    vec2 pos = vec2(uMeshArray[i+2], uMeshArray[i+3]);\n' +
'    vec2 size = vec2(uMeshArray[i+4], uMeshArray[i+5]);\n' +
'    if ( (shape > 0.99 && shape < 1.01 && box(pos, size, rotation) < 0.0) ||\n' +
'         (shape > 1.99 && shape < 2.01 && circle(pos, size.x) < 0.0) ) {\n' +
'      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n' +
'      break;\n' +
'    }\n' +
'  }\n' +
'}';

var sdfCircle = function(position, size, color) { return '' +
'  if (circle(vec2(' + glslVector2(position) + '), ' + glslFloat(size) + ') < 1.0) {' +
'    gl_FragColor = vec4(' + glslColor(color, 1) + '); }';
}

var sdfBox = function(position, size, angle, color) { return '' +
'  if (box(vec2(' + glslVector2(position) + '), vec2(' + glslVector2(size) + '), ' + glslFloat(angle) + ') < 1.0) {' +
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
  engine = Engine.create({render: {visible: false}});
  engine.world.gravity.y = -1;

  addObjects(defaultObjectParams());


  // Drag and drop
  var nonStaticMeshes = [];
  for (var meshId in meshes){
    var object = meshes[meshId];
    if (!object.isStatic) {
      nonStaticMeshes.push(object);
    }
  }

  var controls = new THREE.DragControls( nonStaticMeshes, camera, renderer.domElement );
  controls.addEventListener( 'dragstart', dragStartCallback );
  controls.addEventListener( 'dragend', dragendCallback );

/*  // Setup mesh buffer
  meshArray = setupBuffer(meshArrayWidth, meshArrayHeight);
  var positions = new Float32Array( meshArrayWidth * meshArrayHeight * 3 );
  for ( var j = 0; j < meshArrayHeight; j++ ) {
    for ( var i = 0; i < meshArrayWidth; i++ ) {
      positions[3 * (meshArrayWidth*j+i)] = i + 0.5; // x
      positions[3 * (meshArrayWidth*j+i) + 1] = j + 0.5; // y
    }
  }
  var meshBufGeom = new THREE.BufferGeometry();
  meshBufGeom.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  meshBufGeom.addAttribute( 'meshData', new THREE.BufferAttribute( new Float32Array( meshArrayWidth * meshArrayHeight * 3 ), 3 ) );
  var meshBufMat = new THREE.ShaderMaterial( {
    vertexShader:    meshBufVert,
    fragmentShader:  meshBufFrag,
    depthTest:       false,
    transparent:     false,
    premultipliedAlpha: false,
  } );
  meshArray.mesh = new THREE.Points( meshBufGeom, meshBufMat );
  meshArray.scene.add(meshArray.mesh);
  // scene.add(meshArray.mesh);*/

/*  // Setup intersection buffer
  isectBuffer = setupBuffer(isectBufferWidth, isectBufferHeight);
  var isectBufMat = new THREE.ShaderMaterial( {
    uniforms: { 
      meshArray: { type: "t", value: meshArray.target.texture },
      uResolution: { type: "v2", value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
    },
    fragmentShader:  isectBufFrag,
    depthTest:       false,
    transparent:     false,
    premultipliedAlpha: false,
  } );
  isectBuffer.mesh = new THREE.Mesh( new THREE.PlaneGeometry( isectBufferWidth, isectBufferHeight ), isectBufMat );
  isectBuffer.mesh.position.set( isectBufferWidth / 2, isectBufferHeight / 2, 1);
  isectBuffer.scene.add(isectBuffer.mesh);
  // scene.add(isectBuffer.mesh);*/

/*  // Setup floor
  var floorMat = new THREE.ShaderMaterial( {
    uniforms: { 
      isectBuffer: { type: "t", value: isectBuffer.target.texture },
      uResolution: { type: "v2", value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
    },
    vertexShader:    floorVert,
    fragmentShader:  floorFrag,
    depthTest:       false,
    transparent:     false,
    premultipliedAlpha: false,
  } );
  floor = new THREE.Mesh( new THREE.PlaneGeometry( isectBufferWidth, isectBufferHeight ), floorMat );
  // floor = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), floorMat );
  scene.add(floor);
  floor.position.set(0, 0, 1);*/

  testMat = new THREE.ShaderMaterial( {
    uniforms: { 
      // meshArray: { type: "t", value: meshArray.target.texture },
      uMeshArray: { type: "fv1", value: meshArray },
      uResolution: { type: "v2", value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
    },
    fragmentShader: meshBufTestFrag,
    // fragmentShader: makeSdfFragmentShader(),
    depthTest: false,
    transparent: true,
  } );
  testMesh = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), testMat );
  scene.add(testMesh);
  testMesh.position.set(0, 0, 1);

  Engine.run(engine);
};

function dragStartCallback(event) {
  event.object.isBeingDragged = true;
}

function dragendCallback(event) {
  event.object.isBeingDragged = false;
}

function setupBuffer(width, height) {
  var buffer = {};
  buffer.camera = new THREE.OrthographicCamera( 0, width, height, 0, -1, 1 );
  buffer.scene = new THREE.Scene();
  buffer.target = new THREE.WebGLRenderTarget( width, height,
    { format: THREE.RGBFormat, 
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, 
      stencilBuffer: false,
      depthBuffer: false,
      type: THREE.FloatType,
      transparent: false,
    } );
  return buffer;
}

function animate(tick) {
  requestAnimationFrame( animate );
  for (var j = 0; j < engine.world.bodies.length; j++) {
    var body = engine.world.bodies[j];
    var position = body.position;
    var m = meshes[body.meshId];

    if (m.isBeingDragged) {
      Body.setPosition(body, { x: m.position.x, y: m.position.y });
    }

    if (!m.isStatic) {
      m.rotation.z = body.angle;
      m.position.set(position.x, position.y, 0);
    }
  }
/*  if(!lastTick || tick - lastTick >= 500) {
    lastTick = tick;
    updateMeshArray();
  }*/
  updateMeshArray();
  render();

  if (showStats) {
    stats.update();
  }
}
function render() {
  // renderer.render( meshArray.scene, meshArray.camera, meshArray.target );
  // renderer.render( isectBuffer.scene, isectBuffer.camera, isectBuffer.target );
  renderer.render( scene, camera );
  // testMat.fragmentShader = makeSdfFragmentShader();
  // testMat.needsUpdate = true;
}

function updateMeshArray() {
  meshArray.fill(0);
  var k = 0;
  for (var id in meshes) {
    var m = meshes[id];
    if (m == undefined) continue;
    var start = k * floatsPerMesh;
    meshArray[start] = m.shape;
    meshArray[start+1] = m.rotation.z;
    meshArray[start+2] = m.position.x;
    meshArray[start+3] = m.position.y;
    meshArray[start+4] = m.size.x;
    meshArray[start+5] = m.size.y;
    meshArray[start+6] = m.emission.r;
    meshArray[start+7] = m.emission.g;
    meshArray[start+8] = m.emission.b;
    meshArray[start+9] = m.emission.a;
    k++;
  }
}

/*function updateMeshArray() {
  var meshData = meshArray.mesh.geometry.attributes.meshData;
  meshData.array.fill(0);
  var h;
  for (var j = 0; j < meshArrayHeight; j++) {
    var m = meshes[j];
    if (m == undefined) continue;
    h = 3 * meshArrayWidth * j;
    meshData.array[h] = m.shape;
    meshData.array[h+1] = m.position.x;
    meshData.array[h+2] = m.position.y;
    meshData.array[h+3] = m.rotation.z;
    meshData.array[h+4] = m.size.x;
    meshData.array[h+5] = m.size.y;
    meshData.array[h+6] = 0;
    meshData.array[h+7] = 0;
    meshData.array[h+8] = 0;
    meshData.array[h+9] = 0;
    meshData.array[h+10] = 0;
    meshData.array[h+11] = 0;
  }
  meshData.array[h+11] = 1; // flag last object so shader can exit early
  meshData.needsUpdate = true;
}*/

////////////////////////////////////////////////////////////////////////////////
// Objects
////////////////////////////////////////////////////////////////////////////////

function addObjects(objectParams) {
  var physicsBodies = [];
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
      mesh.shape = 1; // custom type id
      mesh.physicsBody = Bodies.rectangle(
          o.position.x,
          o.position.y,
          o.size.x,
          o.size.y,
          {
            isStatic: o.isStatic,
            meshId: meshId,
            friction: 0.00001,
            restitution: 0.5,
            density: 0.001
          }
        );
      Matter.Body.rotate(mesh.physicsBody, o.rotation);
      physicsBodies.push(mesh.physicsBody);
    } else if (o instanceof CircleParam) {
      mesh = new THREE.Mesh(new THREE.CircleGeometry(o.radius, 64), material); // set #segments to 64 just by default
      mesh.size = new THREE.Vector2(o.radius, o.radius); // standardize for mesh buffer
      mesh.rotation.z = 0;
      mesh.emission = hexToRGBA(o.emission);
      mesh.shape = 2; // custom type id
      mesh.physicsBody = Bodies.circle(
          o.position.x,
          o.position.y,
          o.radius,
          {
            isStatic: o.isStatic,
            meshId: meshId,
            friction: 0.00001,
            restitution: 0.5,
            density: 0.001
          },
          64 // set # sides to match # segments from above
      );
      physicsBodies.push(mesh.physicsBody);
    }
    scene.add(mesh);
    mesh.isStatic = o.isStatic;
    mesh.position.set(o.position.x, o.position.y, 0);
    mesh.meshId = meshId;
    meshes[mesh.meshId] = mesh;
  }
  World.add(engine.world, physicsBodies);
}

function removeObjects(ids) {
  if (typeof ids == 'undefined') {
    ids = meshes;
  }
  for (var id in ids) {
    if (meshes[id] == undefined) continue;
    if (meshes[id].physicsBody != undefined)
      Matter.Composite.remove(engine.world, meshes[id].physicsBody);
    meshes[id].geometry.dispose();
    meshes[id].material.dispose();
    scene.remove( meshes[id] );
    delete meshes[id];
  }
}

function getNextMeshId() {
  for (var i = 0; i < maxMeshCount; i++) {
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
  objectParams.push( new CircleParam( { 'position':new THREE.Vector2(180, 150), 'radius':50, 
                           'color':"#009966", 'emission':"#ff0000ff", 'isStatic':false } ) );
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