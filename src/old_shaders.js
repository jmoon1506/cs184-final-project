
var meshBufVert = 
'attribute vec4 id_shape_rot;\n' +
'attribute vec4 pos_size;\n' +
'attribute vec4 emission;\n' +
'varying vec4 v_id_shape_rot;\n' +
'varying vec4 v_pos_size;\n' +
'varying vec4 v_emission;\n' +
'varying float v_index;\n' +
'void main() {\n' +
'  v_id_shape_rot = id_shape_rot;\n' +
'  v_pos_size = pos_size;\n' +
'  v_emission = emission;\n' +
'  v_index = position.x;\n' +
'  gl_PointSize = 1.;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n' +
'}';

var meshBufFrag = 
'varying vec4 v_id_shape_rot;\n' +
'varying vec4 v_pos_size;\n' +
'varying vec4 v_emission;\n' +
'varying float v_index;\n' +
'void main() {\n' +
'  if (v_index < 0.1) {\n' +
'    gl_FragColor = v_id_shape_rot;\n' +
'  } else if (v_index < 1.1) {\n' +
'    gl_FragColor = v_pos_size;\n' +
'  } else {\n' +
'    gl_FragColor = v_emission;\n' +
'  }\n' +
'}';

var isectBufVert = 
'varying vec2 v_uv;\n' +
'varying vec2 v_position;\n' +
'void main() {\n' +
'  v_uv = uv;\n' +
'  v_position = position.xy;\n' +
'  gl_PointSize = 1.;\n' +
'  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n' +
'}';

var isectBufFrag = 
'varying vec2 v_uv;\n' +
'varying vec2 v_position;\n' +
'uniform vec2 resolution;\n' +
'uniform sampler2D meshBuffer;\n' +
'void main() {\n' +
// '  gl_FragColor = vec4(1., 0., 0., 1.);' +
// '  gl_FragColor = texture2D(meshBuffer, vec2(0.51, 1.));' +
// '  gl_FragColor = texture2D(meshBuffer, v_position / resolution);' +
'  gl_FragColor = texture2D(meshBuffer, v_uv);' +
'}';

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