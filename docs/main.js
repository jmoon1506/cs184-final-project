var camera, scene, raycaster, renderer, stats, controls, engine;
var meshes = {}; // { id : mesh }
var bodies = []; // physics rigidbodies
var isectBuffer, floor;
var showStats = true;
var frustumSize = 1000;
var mouse = new THREE.Vector2();
var lastTick = 0;

var Engine = Matter.Engine, World = Matter.World, Bodies = Matter.Bodies, Body = Matter.Body;

var dragControls = undefined;

var testMesh, testMat;

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
  engine.world.gravity.y = 0;

  addObjects(defaultObjectParams());

  // Drag and drop
  enableDrag();

/*  var gl = renderer.getContext();
  var vertexPosBuffer = gl.createBuffer();
  gl.bindBuffer(gl.UNIFORM_BUFFER, vertexPosBuffer);
  var vertices = new Float32Array([
      -0.3, -0.5,
       0.3, -0.5,
       0.0,  0.5
  ]);
  gl.bufferData(gl.UNIFORM_BUFFER, vertices, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.UNIFORM_BUFFER, null);*/

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
  var isectVizMat = new THREE.ShaderMaterial( {
    uniforms: { 
      uMeshArray: { type: "fv1", value: meshArray },
      isectBuffer: { type: "t", value: isectBuffer.target.texture },
      uResolution: { type: "v2", value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
    },
    vertexShader:    floorVert,
    fragmentShader:  isectBufViz,
    transparent:     false,
    premultipliedAlpha: false,
  } );
  floor = new THREE.Mesh( new THREE.PlaneGeometry( isectBufferWidth, isectBufferHeight ), isectVizMat );
  floor.position.set(600, 0, -1);
  scene.add(floor);

  // Setup floor
  var floorMat = new THREE.ShaderMaterial( {
    uniforms: { 
      uMeshArray: { type: "fv1", value: meshArray },
      isectBuffer: { type: "t", value: isectBuffer.target.texture },
      uResolution: { type: "v2", value: new THREE.Vector2(container.offsetWidth, container.offsetHeight) },
    },
    vertexShader:    floorVert,
    fragmentShader:  floorFrag,
    // depthTest:       false,
    transparent:     true,
    premultipliedAlpha: false,
  } );
  // floor = new THREE.Mesh( new THREE.PlaneGeometry( isectBufferWidth, isectBufferHeight ), floorMat );
  // floor.position.set(600, 0, -1);
  floor = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), floorMat );
  scene.add(floor);

  // addText('Intersect Buffer', 600, -isectBufferHeight/2-32);

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

function enableDrag() {
  if (dragControls != undefined) {
    dragControls.dispose();
  }

  var nonStaticMeshes = [];
  for (var meshId in meshes){
    var object = meshes[meshId];
    if (!object.isStatic) {
      nonStaticMeshes.push(object);
    }
  }

  dragControls = new THREE.DragControls( nonStaticMeshes, camera, renderer.domElement );
  dragControls.addEventListener( 'dragstart', dragStartCallback );
  dragControls.addEventListener( 'dragend', dragendCallback );
}

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

function addText(text, x, y) {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.textAlign = "center";
  ctx.textBaseline="middle";
  ctx.font = "32px Arial";
  ctx.fillStyle = "rgba(0,0,0,1.0)";
  ctx.fillText(text, canvas.width/2, canvas.height/2);
  var texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  var mesh = new THREE.Mesh( new THREE.PlaneGeometry(canvas.width, canvas.height), new THREE.MeshBasicMaterial({map:texture, transparent:true}) );
  mesh.position.set(x, y, 0);
  scene.add(mesh);
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
/*  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(400, 0), 'size':new THREE.Vector2(10, 810), 
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
                           'color':"#009966", 'emission':"#ff0000ff", 'isStatic':false } ) );*/
  objectParams.push( new CircleParam( { 'position':new THREE.Vector2(-200, -150), 'radius':150, 
                         'color':"#009966", 'emission':"#ff0000ff", 'isStatic':false } ) );
  objectParams.push( new CircleParam( { 'position':new THREE.Vector2(180, 150), 'radius':80, 
                       'color':"#009966", 'emission':"#00ff00ff", 'isStatic':false } ) );
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