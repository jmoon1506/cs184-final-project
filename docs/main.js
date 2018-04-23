var camera, scene, raycaster, renderer, stats, controls, engine;
var meshes = {}; // { id : mesh }
var bodies = []; // physics rigidbodies
var isectBuffer, floor;
var showStats = true;
var frustumSize = 1000;
var mouse = new THREE.Vector2();
var lastTick = 0;

var shapeTypes = 2;
var sceneSize = 1024; // scale for pixel encoding, max raymarch distance
var maxMeshCount = 18;
var floatsPerMesh = 10;  // shape, rotation, x, y, w, h, r, g, b, a
var meshArraySize = floatsPerMesh * maxMeshCount;
var meshArray = new Array(meshArraySize).fill(0);
var isectBufferWidth = 200; // rays per angle
var isectDepth = 8;         // isects per ray
var isectAngles = 32;
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
sdfFunctions +
'  vec2 dim = vec2(ISECT_BUF_WIDTH, ISECT_BUF_HEIGHT);\n' +
'  vec2 pos = gl_FragCoord.xy;\n' +
'  bvec2 gt = greaterThan(pos, 0.1 * dim);\n' +
'  bvec2 lt = lessThan(pos, 0.9 * dim);\n' +
'  float inside = float(all(lt) && all(gt));\n' +
'  gl_FragColor = inside * vec4(1., 0., 0., 0.) + (1. - inside) * vec4(0., 1., 0., 0.);\n' +
'}';*/

var isectBufFrag = 
'#define MAX_MESH_COUNT ' + maxMeshCount + '\n' +
'#define FLOATS_PER_MESH ' + floatsPerMesh + '\n' +
'#define MESH_ARR_SIZE ' + meshArraySize + '\n' +
'#define ISECT_BUF_WIDTH ' + isectBufferWidth + '\n' +
'#define ISECT_BUF_HEIGHT ' + isectBufferHeight + '\n' +
'#define ISECT_DEPTH ' + isectDepth + '\n' +
'#define F_MAX_MESH_COUNT ' + glslFloat(maxMeshCount) + '\n' +
'#define F_FLOATS_PER_MESH ' + glslFloat(floatsPerMesh) + '\n' +
'#define F_ISECT_BUF_WIDTH ' + glslFloat(isectBufferWidth) + '\n' +
'#define F_ISECT_DEPTH ' + glslFloat(isectDepth) + '\n' +
'#define F_ISECT_ANGLES ' + glslFloat(isectAngles) + '\n' +
'#define SCENE_SIZE ' + glslFloat(sceneSize) + '\n' +
'#define HALF_SCENE_SIZE ' + glslFloat(sceneSize/2) + '\n' +
'#define PI 3.14159265359\n' +
'#define EPS 0.0001\n' +
'uniform float uMeshArray[' + meshArraySize + '];\n' +

'vec4 rotate(vec2 pos, float angle) {\n' +
'  float c = cos(angle);\n' +
'  float s = sin(angle);\n' +
'  float x = pos.x;\n' +
'  float y = pos.y;\n' +
'  return vec4(x*c-y*s, x*s+y*c, c, s);\n' +
'}\n' +
'vec2 isectRect(vec2 rayOrigin, float rayAngle, vec2 rectMin, vec2 rectMax, float rectAngle) {\n' +
'  vec4 adjRay = rotate(rayOrigin, rayAngle-rectAngle);\n' +
'  if (abs(adjRay.z) < EPS || abs(adjRay.w) < EPS) return vec2(-1.);\n' +
'  vec2 invDir = vec2(1.) / adjRay.zw;\n' +
'  float tx1 = (rectMin.x - adjRay.x)*invDir.x;\n' +
'  float tx2 = (rectMax.x - adjRay.x)*invDir.x;\n' +
'  float tmin = min(tx1, tx2);\n' +
'  float tmax = max(tx1, tx2);\n' +
'  float ty1 = (rectMin.y - adjRay.y)*invDir.y;\n' +
'  float ty2 = (rectMax.y - adjRay.y)*invDir.y;\n' +
'  tmin = max(tmin, min(ty1, ty2));\n' +
'  tmax = min(tmax, max(ty1, ty2));\n' +
'  return tmax < tmin ? vec2(-1.) : vec2(tmin, tmax);\n' +
'}\n' +
'vec2 isectCircle(vec2 rayOrigin, float rayAngle, vec2 circlePos, float circleRadius) {\n' +
'  vec4 ray = rotate(rayOrigin, rayAngle);\n' +
'  vec2 o = ray.xy;\n' +
'  vec2 d = ray.zw;\n' +
'  vec2 oc = o - circlePos;\n' +
'  float a = dot(d, d);\n' +
'  float b = dot(2.*oc,d);\n' +
'  float c = dot(oc, oc) - circleRadius*circleRadius;\n' +
'  float b2_4ac = max(0., b*b-4.*a*c);\n' +
'  float root = sqrt(b2_4ac);\n' +
'  return b2_4ac < EPS ? vec2(-1.) : vec2((-b-root)/(2.*a), (-b+root)/(2.*a));\n' +
'}\n' +

'vec2 getIntersect(float rayAngle, float rayOffset, int isectDepth) {\n' +
'  vec2 rayOrigin = vec2(-HALF_SCENE_SIZE, -HALF_SCENE_SIZE+rayOffset);\n' +
'  vec2 isects[ISECT_DEPTH];\n' +
'  for (int i = 0; i < MESH_ARR_SIZE; i+=FLOATS_PER_MESH) {\n' +
'    float shape = uMeshArray[i];\n' +
'    if (shape > 9.9) break;\n' +
'    if (shape < 0.1) continue;\n' +
'    float angle = uMeshArray[i+1];\n' +
'    vec2 pos = vec2(uMeshArray[i+2], uMeshArray[i+3]);\n' +
'    vec2 size = vec2(uMeshArray[i+4], uMeshArray[i+5]);\n' +
'    vec2 dists;\n' +
'    if (shape > 0.99 && shape < 1.01) {\n' +
'      vec2 halfsize = 0.5 * size;\n' +
'      dists = isectRect(rayOrigin, rayAngle, pos-halfsize, pos+halfsize, angle);\n' +
'    } else if (shape > 1.99 && shape < 2.01) {\n' +
'      dists = isectCircle(rayOrigin, rayAngle, pos, size.x);\n' +
'    }\n' +
'    float meshId = floor(float(i)/F_FLOATS_PER_MESH);\n' +
'    vec2 lo = vec2(meshId, min(dists.x, dists.y));\n' +
'    vec2 hi = vec2(meshId, max(dists.x, dists.y));\n' +
'    vec2 temp;\n' +

(function(){
  var i = isectDepth-1;
  var sortString = 
'    for (int j = 0; j < 2; j++) {\n' +
'      vec2 current = j == 0 ? lo : hi;\n' +
'      if (current.y < EPS || (current.y > isects['+i+'].y && isects['+i+'].x > EPS)) continue;\n' +
'      isects['+i+'] = current;\n';
  for (i = isectDepth-2; i >= 0; i--) {
    sortString += 
'      if (isects['+(i+1)+'].y > isects['+i+'].y && isects['+i+'].x > EPS) continue;\n' +
'      temp = isects['+i+'];\n' +
'      isects['+i+'] = isects['+(i+1)+'];\n' +
'      isects['+(i+1)+'] = temp;\n';
  }
  sortString += 
'    }\n';
  // console.log(sortString);
  return sortString;
})() +

'  }\n' +
'  vec2 intersect;\n' +

(function(){
  var getIsectString =
'  for (int j = 0; j < 1; j++) {\n';
  for (var i = 0; i < isectDepth; i++) {
    getIsectString += 
'    intersect = isects['+i+'];\n' +
'    if ('+(i+1)+' > isectDepth || intersect.x < EPS) break;\n';
  }
  getIsectString += 
'  }\n';
  // console.log(getIsectString);
  return getIsectString;
})() +

'  return intersect;\n' +
'}\n' +

'void main() {\n' +
'  vec2 pos = gl_FragCoord.xy;\n' +
'  float angle = PI * (floor(pos.y / F_ISECT_DEPTH) / F_ISECT_ANGLES);\n' + // TODO: replace division and mod with bitwise ops
'  float offset = SCENE_SIZE * (floor(pos.x) / F_ISECT_BUF_WIDTH);\n' +
'  int depth = int(mod(floor(pos.y), F_ISECT_DEPTH));\n' +
'  vec2 isectData = getIntersect(angle, offset, depth);\n' +
'  gl_FragColor = vec4(isectData.x / F_MAX_MESH_COUNT, isectData.y / SCENE_SIZE, 0., 1.);\n' +
'}';

var floorVert = 
'varying vec2 v_uv;\n' +
'void main() {\n' +
'  v_uv = uv;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n' +
'}';

var floorFrag = 
'#define MAX_MESH_COUNT ' + maxMeshCount + '\n' +
'#define FLOATS_PER_MESH ' + floatsPerMesh + '\n' +
'#define MESH_ARR_SIZE ' + meshArraySize + '\n' +
'#define ISECT_BUF_WIDTH ' + isectBufferWidth + '\n' +
'#define ISECT_BUF_HEIGHT ' + isectBufferHeight + '\n' +
'#define ISECT_DEPTH ' + isectDepth + '\n' +
'#define F_MAX_MESH_COUNT ' + glslFloat(maxMeshCount) + '\n' +
'#define F_FLOATS_PER_MESH ' + glslFloat(floatsPerMesh) + '\n' +
'#define F_ISECT_BUF_WIDTH ' + glslFloat(isectBufferWidth) + '\n' +
'#define F_ISECT_DEPTH ' + glslFloat(isectDepth) + '\n' +
'#define F_ISECT_ANGLES ' + glslFloat(isectAngles) + '\n' +
'#define SCENE_SIZE ' + glslFloat(sceneSize) + '\n' +
'#define HALF_SCENE_SIZE ' + glslFloat(sceneSize/2) + '\n' +

'#define ISECT_ANGLES ' + isectAngles + '\n' +
'#define F_ISECT_ANGLES ' + glslFloat(isectAngles) + '\n' +
'#define PI 3.14159265359\n' +
'#define EPS 0.0001\n' +
'uniform float uMeshArray[' + meshArraySize + '];\n' +
'uniform sampler2D isectBuffer;\n' +
'uniform vec2 uResolution;\n' +
'varying vec2 v_uv;\n' +

'vec4 getEmission(int meshId) {\n' +
'  vec4 emission;\n' +
(function(){
  var meshString =
'  for (int j = 0; j < 1; j++) {\n';
  for (var i = 0; i < maxMeshCount; i++) {
    var idx = i*floatsPerMesh;
    meshString += 
'    if (meshId < '+i+') break;\n' +
'    emission = vec4(uMeshArray['+(idx+6)+'], uMeshArray['+(idx+7)+'], uMeshArray['+(idx+8)+'], uMeshArray['+(idx+9)+']);\n';
  }
  meshString += 
'  }\n';
  // console.log(meshString);
  return meshString;
})() +
'  return emission;\n' +
'}\n' +

'vec2 getOffsetAndDist(vec2 pos, float angle) {\n' +
'  float c = cos(angle);\n' +
'  float s = sin(angle);\n' +
'  vec2 sceneOrigin = vec2(-HALF_SCENE_SIZE*c+HALF_SCENE_SIZE*s, -HALF_SCENE_SIZE*s-HALF_SCENE_SIZE*c);\n' +
'  vec2 p = pos-sceneOrigin;\n' +
'  return vec2(abs(s*p.x-c*p.y), abs(c*p.x+s*p.y));\n' +
'}\n' +

'vec4 getRayColor(vec2 pos, float angleIdx) {\n' +
'  float angle = PI * (angleIdx / F_ISECT_ANGLES);\n' +
'  vec2 offsetAndDist = getOffsetAndDist(pos, angle);\n' +
'  float offsetIdx = F_ISECT_BUF_WIDTH * (offsetAndDist.x / SCENE_SIZE);\n' +
'  float depthIdx = F_ISECT_DEPTH * angleIdx + 0.5;\n' +
'  for (int j = 0; j < ISECT_DEPTH; j++) {\n' +
'    vec4 pix = texture2D(isectBuffer, vec2(offsetIdx, depthIdx+float(j)));\n' +
// '    if (pix.y * SCENE_SIZE'
'  }\n' +
'  return vec4(0.);\n' +
'}\n' +

'void main() {\n' +
/*'  vec4 color;\n' +
'  float pos = gl_FragCoord.xy + (vec2(sceneSize, sceneSize) - uResolution) / 2.\n;' +
'  float angle;\n' +
'  float offset;\n' +
'  for (int i = 0; i < ISECT_ANGLES; i++) {\n' +
'    color += getRayColor(pos, float(i)) / F_ISECT_ANGLES;\n' +
'  }\n' +*/
'  gl_FragColor = texture2D(isectBuffer, v_uv);\n' +
// '  gl_FragColor = getEmission(2);\n' +
'}';

var meshBufTestFrag =
'#define MAX_MESH_COUNT ' + maxMeshCount + '\n' +
'#define FLOATS_PER_MESH ' + floatsPerMesh + '\n' +
'#define MESH_ARR_SIZE ' + meshArraySize + '\n' +
'#define TWO_PI 6.28318530718\n' +
'uniform float uMeshArray[' + meshArraySize + '];\n' +
'uniform vec2 uResolution;\n' +
'mat2 rotate(float angle) {\n' +
'  float c = cos(angle);\n' +
'  float s = sin(angle);\n' +
'  return mat2(c,-s,\n' +
'              s,c);\n' +
'}\n' +
'float rect(vec2 pos, vec2 rect_pos, vec2 rect_size, float rect_angle) {\n' +
'  vec2 p = rect_pos + uResolution.xy;\n' +
'  vec2 v = pos - p;\n' +
'  v = rotate( rect_angle ) * v;\n' +
'  v = v + p;\n' +
'  vec2 b = rect_size / 2.;\n' +
'  v = max( (p - b) - v,  v - (p + b) );\n' +
'  return max(v.x, v.y);' +
'}\n' +
'float circle(vec2 pos, vec2 circle_pos, float circle_radius) {\n' +
'  vec2 p = circle_pos + uResolution.xy;\n' +
'  return length(pos - p) - circle_radius;\n' +
'}\n' +
'void main() {\n' +
'  gl_FragColor = vec4(0.0);\n' +
'  for (int i = 0; i < MESH_ARR_SIZE; i+=FLOATS_PER_MESH) {\n' +
'    float shape = uMeshArray[i];\n' +
'    if (shape > 9.9) break;\n' +
'    if (shape < 0.1) continue;\n' +
'    float rotation = uMeshArray[i+1];\n' +
'    vec2 pos = vec2(uMeshArray[i+2], uMeshArray[i+3]);\n' +
'    vec2 size = vec2(uMeshArray[i+4], uMeshArray[i+5]);\n' +
'    if ( (shape > 0.99 && shape < 1.01 && rect(gl_FragCoord.xy, pos, size, rotation) < 0.0) ||\n' +
'         (shape > 1.99 && shape < 2.01 && circle(gl_FragCoord.xy, pos, size.x) < 0.0) ) {\n' +
'      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n' +
'      break;\n' +
'    }\n' +
'  }\n' +
'}';

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

  // Setup intersection buffer
  isectBuffer = setupBuffer(isectBufferWidth, isectBufferHeight);
  var isectBufMat = new THREE.ShaderMaterial( {
    uniforms: { 
      uMeshArray: { type: "fv1", value: meshArray },
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
  // scene.add(isectBuffer.mesh);

  // Setup floor
  var floorMat = new THREE.ShaderMaterial( {
    uniforms: { 
      uMeshArray: { type: "fv1", value: meshArray },
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
  floor.position.set(0, 0, -1);
  scene.add(floor);

/*  testMat = new THREE.ShaderMaterial( {
    uniforms: { 
      uMeshArray: { type: "fv1", value: meshArray },
      uResolution: { type: "v2", value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
    },
    fragmentShader: meshBufTestFrag,
    depthTest: false,
    transparent: true,
  } );
  testMesh = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), testMat );
  scene.add(testMesh);
  testMesh.position.set(0, 0, 1);*/

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
      // type: THREE.FloatType,
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
  renderer.render( isectBuffer.scene, isectBuffer.camera, isectBuffer.target );
  renderer.render( scene, camera );
}

function updateMeshArray() {
  meshArray.fill(0);
  var start = 0;
  for (var id in meshes) {
    var m = meshes[id];
    if (m == undefined) continue;
    var start = id * floatsPerMesh;
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
  }
  if (start+10 < meshArraySize) meshArray[start+10] = 10; // end flag
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
  for (var i = 1; i < maxMeshCount; i++) {
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
                           'rotation':0., 'color':"#009966", 'emission':"#ff0000ff", 'isStatic':true } ) );
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(-400, 0), 'size':new THREE.Vector2(10, 810), 
                           'rotation':0., 'color':"#009966", 'emission':"#ffff00ff", 'isStatic':true } ) );
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
  objectParams.push( new CircleParam( { 'position':new THREE.Vector2(180, 150), 'radius':50, 
                           'color':"#009966", 'emission':"#ff0000ff", 'isStatic':false } ) );
  objectParams.push( new CircleParam( { 'position':new THREE.Vector2(180, 150), 'radius':50, 
                           'color':"#009966", 'emission':"#ff0000ff", 'isStatic':false } ) );
  objectParams.push( new CircleParam( { 'position':new THREE.Vector2(180, 150), 'radius':50, 
                           'color':"#009966", 'emission':"#ff0000ff", 'isStatic':false } ) );
  objectParams.push( new CircleParam( { 'position':new THREE.Vector2(180, 150), 'radius':50, 
                           'color':"#009966", 'emission':"#ff0000ff", 'isStatic':false } ) );
  return objectParams;
}

function newSquareParams() {
  var objectParams = [];
  var width = document.getElementsByName("width")[0].value;
  var height = document.getElementsByName("height")[0].value;
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(0, 0), 'size':new THREE.Vector2(width, height), 
                           'rotation':0., 'color':"#009966", 'emission':"#ff0000ff", 'isStatic':false } ) );
  return objectParams;
}

function newCircleParams() {
  var objectParams = [];
  var radius = document.getElementsByName("radius")[0].value;
  objectParams.push( new CircleParam( { 'position':new THREE.Vector2(0, 0), 'radius':radius, 
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