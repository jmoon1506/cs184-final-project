var camera, scene, raycaster, renderer, stats, controls, engine;
var bodies =[], meshes =[];
var showStats = false;
var nextObjectId = 0;
var frustumSize = 1000;
var mouse = new THREE.Vector2();

var floorVertexShader = 
'void main() {' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );' +
'}';

var floorFragmentShader = 
'void main() {'+
'  gl_FragColor = vec4(0.3, 0., 0., 1.);'+
'}';

init();
animate();

function init() {
  var aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, 0, 1 );
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
      console.log(o);
      var box = new THREE.Mesh( new THREE.PlaneGeometry( o.size.x, o.size.y ), material );
      scene.add(box);
      box.position.set(o.position.x, o.position.y, 0);
      box.rotation.z = o.rotation;
      meshes.push(box);
      // bodies.push( Matter.Bodies.rectangle(o.position.x, o.position.y, o.size.x, o.size.y), { isStatic: o.isStatic } );
    }
  }
  // Matter.World.add(engine.world, bodies);
  // console.log(objects);
  // // Lighting
  // bufferScene = new THREE.Scene();
  // var bufferTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter});

  // floorMaterial = new THREE.ShaderMaterial( {
  //   vertexShader: floorVertexShader,
  //   fragmentShader: floorFragmentShader
  // } );
  // floor = new THREE.Mesh( new THREE.PlaneGeometry( frustumSize * aspect, frustumSize ), floorMaterial );
  // scene.add(floor);
  // floor.position.set(0, 0, -1);
}

function removeObjects(ids) {
  // if (typeof ids == 'undefined')

  // scene.traverse( function( node ) {
  //   if ( node instanceof THREE.Mesh ) {
  //   }
  // }
}

////////////////////////////////////////////////////////////////////////////////
// Parallel Ray Bundling
////////////////////////////////////////////////////////////////////////////////

function generateSDF() {
  // scene.traverse( function( node ) {
  //   if ( node instanceof THREE.Mesh ) {
  //     if ( node.geometry instanceof THREE.PlaneGeometry ) {
  //       console.log(node.position);
  //     }
  //   }
  // } );
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
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(200, 50), 'size':new THREE.Vector2(200, 400), 
                           'rotation':0., 'color':"#009966", 'isStatic':true } ) );
  objectParams.push( new BoxParam( { 'position':new THREE.Vector2(-150, -100), 'size':new THREE.Vector2(300, 300), 
                           'rotation':0., 'color':"#009966", 'emission':"#ff0000", 'isStatic':true } ) );
  return objectParams;
}

////////////////////////////////////////////////////////////////////////////////
// Controls
////////////////////////////////////////////////////////////////////////////////

// document.mousemove = function(event) {
//   mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
//   mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
// }