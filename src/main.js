var showStats = false;
var camera, scene, raycaster, renderer, stats;
var mouse = new THREE.Vector2(), INTERSECTED;
var radius = 500, theta = 0;
var frustumSize = 1000;
init();
animate();
function init() {


  // var info = document.createElement( 'div' );
  // info.style.position = 'absolute';
  // info.style.top = '10px';
  // info.style.width = '100%';
  // info.style.textAlign = 'center';
  // container.appendChild( info );
  var aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera( frustumSize * aspect / - 2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / - 2, -10, 1000 );
  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xf0f0f0 );
  // var light = new THREE.DirectionalLight( 0xffffff, 1 );
  // light.position.set( 1, 1, 1 ).normalize();
  // scene.add( light );
  // var geometry = new THREE.BoxBufferGeometry( 20, 20, 20 );
  // for ( var i = 0; i < 30; i ++ ) {
  //   var object = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: Math.random() * 0xffffff } ) );
  //   object.position.x = Math.random() * 800 - 400;
  //   object.position.y = Math.random() * 800 - 400;
  //   object.position.z = Math.random() * 800 - 400;
  //   object.rotation.x = Math.random() * 2 * Math.PI;
  //   object.rotation.y = Math.random() * 2 * Math.PI;
  //   object.rotation.z = Math.random() * 2 * Math.PI;
  //   object.scale.x = Math.random() + 0.5;
  //   object.scale.y = Math.random() + 0.5;
  //   object.scale.z = Math.random() + 0.5;
  //   scene.add( object );
  // }
  var material = new THREE.MeshBasicMaterial( { color: "#cc1212" } );
  var left_wall = new THREE.Mesh( new THREE.PlaneGeometry( 10, 400 ), material );
  scene.add(left_wall);
  left_wall.position.set(-200, 0, 0);

  var right_wall = new THREE.Mesh( new THREE.PlaneGeometry( 10, 400 ), material );
  scene.add(right_wall);
  right_wall.position.set(200, 0, 0);

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
  document.addEventListener( 'mousemove', onDocumentMouseMove, false );
  window.addEventListener( 'resize', onWindowResize, false );
}
function onWindowResize() {
  var aspect = window.innerWidth / window.innerHeight;
  camera.left   = - frustumSize * aspect / 2;
  camera.right  =   frustumSize * aspect / 2;
  camera.top    =   frustumSize / 2;
  camera.bottom = - frustumSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}
function onDocumentMouseMove( event ) {
  event.preventDefault();
  mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}
//
function animate() {
  requestAnimationFrame( animate );
  render();
  if (showStats) {
    stats.update();
  }
}
function render() {
  // theta += 0.1;
  // camera.position.x = radius * Math.sin( THREE.Math.degToRad( theta ) );
  // camera.position.y = radius * Math.sin( THREE.Math.degToRad( theta ) );
  // camera.position.z = radius * Math.cos( THREE.Math.degToRad( theta ) );
  // camera.lookAt( scene.position );
  // camera.updateMatrixWorld();
  // // find intersections
  // raycaster.setFromCamera( mouse, camera );
  // var intersects = raycaster.intersectObjects( scene.children );
  // if ( intersects.length > 0 ) {
  //   if ( INTERSECTED != intersects[ 0 ].object ) {
  //     if ( INTERSECTED ) INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );
  //     INTERSECTED = intersects[ 0 ].object;
  //     INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
  //     INTERSECTED.material.emissive.setHex( 0xff0000 );
  //   }
  // } else {
  //   if ( INTERSECTED ) INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );
  //   INTERSECTED = null;
  // }
  renderer.render( scene, camera );
}

/*// ------------------------------------------------
// BASIC SETUP
// ------------------------------------------------

// Create an empty scene
var scene = new THREE.Scene();

// Create a basic perspective camera
camera = new THREE.OrthographicCamera(-50, 50, 50, -50, -10, 100);
camera.position.z = 10;

// Create a renderer with Antialiasing
var renderer = new THREE.WebGLRenderer({antialias:true});

// Configure renderer clear color
renderer.setClearColor("#000000");

// Configure renderer size
// renderer.setSize( window.innerWidth, window.innerHeight );

// Append Renderer to DOM
var container = document.getElementById('container');
var w = container.offsetWidth;
var h = container.offsetHeight;
renderer.setSize(w, h);
container.appendChild(renderer.domElement);

// ------------------------------------------------
// FUN STARTS HERE
// ------------------------------------------------

// Create a Box Mesh with basic material
var material = new THREE.MeshBasicMaterial( { color: "#cc1212" } );
var left_wall = new THREE.Mesh( new THREE.PlaneGeometry( 50, 50 ), material );
scene.add(left_wall);
left_wall.position.set(-20, 20, 0);

// Add box to Scene

// Render Loop
var render = function () {
  var width = renderer.domElement.clientWidth;
  var height = renderer.domElement.clientHeight;
  if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
    var updateCSSStyle = false;
    renderer.setSize( width, height, updateCSSStyle );
  }

  requestAnimationFrame( render );

  // box.rotation.x += 0.01;
  // box.rotation.y += 0.01;

  // Render the scene
  renderer.render(scene, camera);
};

render();*/