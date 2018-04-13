var camera, scene, raycaster, renderer, stats, controls, engine;
var meshes = {}; // { id : mesh }
var bodies = []; // physics rigidbodies
var meshBuffer = {};
var intersectBuffer = {};
var showStats = true;
var frustumSize = 1000;
var mouse = new THREE.Vector2();
var lastTick = 0;

var shapeTypes = 2;
var sceneWidth = 1024;
var sceneHeight = 800;
var meshBufferWidth = 4;     // data pixels per object
var meshBufferHeight = 60;  // max object count
var isectBufferWidth = 1024; // rays per angle
var isectDepth = 30;         // isects per ray
var isectBufferHeight = 180 * isectDepth;

var Engine = Matter.Engine, World = Matter.World, Bodies = Matter.Bodies;

var testMesh, testMat;

var meshBufVert = 
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
// '    v_color = vec3(1., 0., 0.);\n' +
'  } else if (position.x < 1.6) {\n' +
'    float rotation = meshData.x - TWO_PI * floor(ANGLE_FACTOR * meshData.y);\n' +
'    float w = WIDTH_FACTOR * meshData.y + 0.5;\n' +
'    float h = HEIGHT_FACTOR * meshData.z + 0.5;\n' +
'    v_color = vec3(rotation, w, h);\n' +
// '    v_color = vec3(0., 1., 0.);\n' +
'  } else if (position.x < 2.6) {\n' +
'    v_color = meshData;\n' +
// '    v_color = vec3(0., 0., 1.);\n' +
'  } else {\n' +
'    v_color = meshData;\n' +
// '    v_color = vec3(1., 1., 1.);\n' +
'  }\n' +
'  gl_PointSize = 0.5;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position.xy, 0.0, 1.0 );\n' +
'}';

var meshBufFrag = 
'varying vec3 v_color;\n' +
'void main() {\n' +
'  gl_FragColor = vec4(v_color, 1.);\n' +
'}';

var sdfFragmentShaderPart1 =
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
'  return max(v.x, v.y);' +
'}\n' +
'float circle(vec2 pos, float size) {\n' +
'  return length(gl_FragCoord.xy - pos) - size;\n' +
'}\n' +
'void main() {';

var meshBufTestFrag =
'#define MESH_BUF_WIDTH ' + meshBufferWidth + '\n' +
'#define MESH_BUF_HEIGHT ' + meshBufferHeight + '\n' +
'#define SHAPES ' + glslFloat(shapeTypes) + '\n' +
'#define SCENE_WIDTH ' + glslFloat(sceneWidth) + '\n' +
'#define SCENE_HEIGHT ' + glslFloat(sceneHeight) + '\n' +
'#define TWO_PI 6.28318530718\n' +
'uniform sampler2D meshBuffer;\n' +
sdfFragmentShaderPart1 +
'  vec2 dim = vec2(SCENE_WIDTH, SCENE_HEIGHT);\n' +
'  gl_FragColor = vec4(0.0);\n' +
'  float col0 = 0.5 / float(MESH_BUF_WIDTH);\n' +
'  float col1 = 1.5 / float(MESH_BUF_WIDTH);\n' +
'  float col2 = 2.5 / float(MESH_BUF_WIDTH);\n' +
'  float col3 = 3.5 / float(MESH_BUF_WIDTH);\n' +
// '  float row = 0.0 / float(MESH_BUF_HEIGHT);\n' +
// '  vec4 meshData = vec4(0., 0., 200., 200.);\n' +
// '  vec4 v_color = (meshData + (dim / 2.0)) / dim;\n' +
// '  gl_FragColor = texture2D(meshBuffer, vec2(col1, row));\n' +
// '  vec4 newcol = texture2D(meshBuffer, vec2(col0, row));\n' +
// '  if (newcol.a > 1.1) gl_FragColor = vec4(1.0);\n' +
// '  gl_FragColor = vec4(0.5,0.5,0.695, 0.75);\n' +
// '  gl_FragColor = v_color;\n' +
'  for (int j = 0; j < MESH_BUF_HEIGHT; j++) {\n' +
'    float row = (float(j) + 0.5) / float(MESH_BUF_HEIGHT);\n' +
'    vec4 pix0 = texture2D(meshBuffer, vec2(col0, row));\n' +
'    float shape = pix0.x * SHAPES;\n' +
'    if (shape < 0.1) continue;\n' +
'    vec4 pix1 = texture2D(meshBuffer, vec2(col1, row));\n' +
'    vec2 pos = (pix0.yz - 0.5) * dim;\n' +
'    float rotation = pix1.x * TWO_PI;\n' +
'    vec2 size = (pix1.yz - 0.5) * dim;\n' +
// '    vec2 pos = vec2(0.,0.);\n' +
// '    float rotation = 0.;\n' +
// '    vec2 size = vec2(200.,200.);\n' +
'    if (shape < 1.1) {\n' +
'      if (box(pos, size, rotation) < 0.0) {\n' +
'        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n' +
'        break;\n' +
'      }\n' +
'    }\n' +
'  }\n' +
'}';

var meshBufTest2Vert = 
'varying vec2 v_position;\n' +
'void main() {\n' +
'  v_position = position.xy;\n' +
'  gl_PointSize = 1.;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n' +
'}';

var meshBufTest2Frag = 
'#define MESH_BUF_WIDTH ' + meshBufferWidth + '\n' +
'#define MESH_BUF_HEIGHT ' + meshBufferHeight + '\n' +
'varying vec2 v_position;\n' +
'uniform sampler2D meshBuffer;\n' +
'uniform vec2 meshBufSize;\n' +
'uniform vec2 resolution;\n' +
'void main() {\n' +
// '  gl_FragColor = texture2D(meshBuffer, v_position / resolution);' +
'  float col = 2.0 / float(MESH_BUF_WIDTH);\n' +
'  float row = 0.0 / float(MESH_BUF_HEIGHT);\n' +
'  gl_FragColor = texture2D(meshBuffer, vec2(col, row));\n' +
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
'  gl_FragColor = texture2D(meshBuffer, v_position / resolution);' +
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
  engine = Engine.create({render: {visible: false}});
  engine.world.gravity.y = -1;

  addObjects(defaultObjectParams());

  meshBuffer.camera = new THREE.OrthographicCamera( 0, meshBufferWidth, meshBufferHeight, 0, -1, 1 );
  meshBuffer.scene = new THREE.Scene();
  meshBuffer.target = new THREE.WebGLRenderTarget( meshBufferWidth, meshBufferHeight,
    { format: THREE.RGBFormat, 
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, 
      stencilBuffer: false,
      // type: THREE.HalfFloatType,
    } );
  // meshBuffer.target.texture.minFilter = THREE.NearestFilter;
  // meshBuffer.target.texture.magFilter = THREE.NearestFilter;

  meshBuffer.mesh = setupBuffer(meshBufferWidth, meshBufferHeight, meshBufVert, meshBufFrag);
  meshBuffer.mesh.geometry.addAttribute( 'meshData', new THREE.BufferAttribute( new Float32Array( meshBufferWidth * meshBufferHeight * 3 ), 3 ) );
  meshBuffer.scene.add(meshBuffer.mesh);
  // scene.add(meshBuffer.mesh);


  testMat = new THREE.ShaderMaterial( {
    uniforms: { 
      meshBuffer: { type: "t", value: meshBuffer.target.texture },
      resolution: { type: "v2", value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
      meshBufSize: { type: "v2", value: new THREE.Vector2( meshBufferWidth, meshBufferHeight ) },
    },
    // vertexShader: meshBufTest2Vert,
    fragmentShader: meshBufTestFrag,
    // fragmentShader: makeSdfFragmentShader(),
    depthTest: false,
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

  Engine.run(engine);
};

function setupBuffer(width, height, vertexShader, fragmentShader) {
  var positions = new Float32Array( width * height * 3 );
  for ( var j = 0; j < height; j++ ) {
    for ( var i = 0; i < width; i++ ) {
      positions[3 * (width*j+i)] = i + 0.5; // x
      positions[3 * (width*j+i) + 1] = j + 0.5; // y
    }
  }
  var geometry = new THREE.BufferGeometry();
  geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  var material = new THREE.ShaderMaterial( {
    vertexShader:    vertexShader,
    fragmentShader:  fragmentShader,
    depthTest:       false,
    transparent:     true,
    premultipliedAlpha: false,
  } );
  return new THREE.Points( geometry, material );
}

function animate(tick) {
  requestAnimationFrame( animate );
  for (var j = 0; j < engine.world.bodies.length; j++) {
    var body = engine.world.bodies[j];
    var position = body.position;
    var m = meshes[body.meshId];
    if (!m.isStatic) {
      m.rotation.z = body.angle;
      m.position.set(position.x, position.y, 0);
    }
  }
  if(!lastTick || tick - lastTick >= 500) {
    lastTick = tick;
    updateMeshBuffer();
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
  meshData.array[0] = 1; // shape
  meshData.array[1] = 0; // x
  meshData.array[2] = 0; // y
  meshData.array[3] = 0; // rotation
  meshData.array[4] = 300; // w
  meshData.array[5] = 200; // h
  meshData.array[6] = 0; // emission r
  meshData.array[7] = 0; // emission g
  meshData.array[8] = 0; // emission b
  meshData.array[9] = 0; // emission a
  meshData.array[10] = 0;
  meshData.array[11] = 0;

/*  for (var j = 0; j < meshBufferHeight; j++) {
    var m = meshes[j];
    if (m == undefined) continue;
    var h = 3 * meshBufferWidth * j;
    meshData.array[h] = m.shape;
    meshData.array[h+1] = m.rotation.z;
    meshData.array[h+2] = 0;
    meshData.array[h+3] = 0;
    meshData.array[h+4] = m.position.x;
    meshData.array[h+5] = m.position.y;
    meshData.array[h+6] = m.size.x;
    meshData.array[h+7] = m.size.y;
    meshData.array[h+8] = 0;
    meshData.array[h+9] = 0;
    meshData.array[h+10] = 0;
    meshData.array[h+11] = 0;
  }*/
  // console.log(meshData.array);
  meshData.needsUpdate = true;
}

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
      mesh.shape = 1;
      var body = Bodies.rectangle(
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
      Matter.Body.rotate(body, o.rotation);
      // body.angle = o.rotation;

      physicsBodies.push(
        body
      );
    } else if (o instanceof CircleParam) {

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
    meshes[id].geometry.dispose();
    meshes[id].material.dispose();
    scene.remove( meshes[id] );
    delete meshes[id];
  }
}

function getNextMeshId() {
  for (var i = 0; i < meshBufferHeight; i++) {
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