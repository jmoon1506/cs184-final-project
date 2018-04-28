var shapeTypes = 2;
var sceneSize = 2048; // scale for pixel encoding, max raymarch distance
var maxMeshCount = 20;
var floatsPerMesh = 10;  // shape, rotation, x, y, w, h, r, g, b, a
var meshArraySize = floatsPerMesh * maxMeshCount;
var meshArray = new Array(meshArraySize).fill(0);
var isectBufferWidth = 256; // rays per angle
var isectDepth = 12;         // isects per ray
var isectAngles = 16;
var isectBufferHeight = isectAngles * isectDepth;

function glslFloat(val) {
  if (val % 1 == 0)
    return '' + val + '.';
  else
    return '' + val;
}

function glslVector2(vec) {
  return glslFloat(vec.x) + ',' + glslFloat(vec.y);
}

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
'#define F_ISECT_BUF_HEIGHT ' + glslFloat(isectBufferHeight) + '\n' +
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
  for (var i = 1; i < maxMeshCount; i++) {
    var idx = i*floatsPerMesh;
    meshString += 
'    if (meshId < '+i+') break;\n' +
'    emission = vec4(uMeshArray['+(idx+6)+'], uMeshArray['+(idx+7)+'], uMeshArray['+(idx+8)+'], uMeshArray['+(idx+9)+']);\n';
  }
  meshString += 
'  }\n';
  return meshString;
})() +
'  return emission;\n' +
'}\n' +

'vec4 getIrradiance(float angleIdx, vec2 pos) {\n' +
'  float angle = PI * (angleIdx / F_ISECT_ANGLES);\n' +
'  float c = cos(angle);\n' +
'  float s = sin(angle);\n' +
'  vec2 sceneOrigin = vec2(-HALF_SCENE_SIZE*c+HALF_SCENE_SIZE*s, -HALF_SCENE_SIZE*s-HALF_SCENE_SIZE*c);\n' +
'  vec2 p = pos-sceneOrigin;\n' +
'  float offset = abs(s*p.x-c*p.y);\n' +
'  float dist = abs(c*p.x+s*p.y);\n' +
'  float isectStartIdx = F_ISECT_DEPTH * angleIdx + 0.5;\n' +
'  vec2 isect1;\n' +
'  vec2 isect2;\n' +
'  for (int j = 0; j < ISECT_DEPTH; j++) {\n' +
'    float curIdx = float(j);\n' +
'    vec4 pix = texture2D(isectBuffer, vec2(floor(offset+0.5)/SCENE_SIZE, (isectStartIdx+curIdx)/F_ISECT_BUF_HEIGHT));\n' +
'    float isectMeshId = F_MAX_MESH_COUNT * pix.x;\n' +
'    float isectDist = SCENE_SIZE * pix.y;\n' +
'    if (dist < isectDist + 0.1) {\n' +
'      isect2 = vec2(isectMeshId, isectDist);\n' +
'      if (abs(mod(curIdx, 2.)) > 0.9) return vec4(0.);\n' +
'      break;\n' +
'    } else {\n' +
'      isect1 = vec2(isectMeshId, isectDist);\n' +
'    }\n' +
'  }\n' +
'  float d1 = (1.0 + abs(isect1.y - dist)/300.);\n' + // 1 + d/r
'  float d2 = (1.0 + abs(isect2.y - dist)/300.);\n' + // 1 + d/r
'  vec4 color1 = getEmission(int(floor(isect1.x+0.5))) / (d1*d1);\n' +
'  vec4 color2 = getEmission(int(floor(isect2.x+0.5))) / (d2*d2);\n' +
'  return 0.5 * (color1 + color2);\n' +
'}\n' +

'void main() {\n' +
/*'  float angleIdx = 8.0;\n' +
'  vec2 pos = gl_FragCoord.xy - uResolution;\n' +
'  float angle = PI * (angleIdx / F_ISECT_ANGLES);\n' +
'  float c = cos(angle);\n' +
'  float s = sin(angle);\n' +
'  vec2 sceneOrigin = vec2(-HALF_SCENE_SIZE*c+HALF_SCENE_SIZE*s, -HALF_SCENE_SIZE*s-HALF_SCENE_SIZE*c);\n' +
'  vec2 p = pos-sceneOrigin;\n' +
'  float offset = abs(s*p.x-c*p.y);\n' +
'  float dist = abs(c*p.x+s*p.y);\n' +

'  float isectStartIdx = F_ISECT_DEPTH * angleIdx + 0.5;\n' +
'  vec2 isect1;\n' +
'  vec2 isect2;\n' +
'  float isectIdx;\n' +
'  for (int j = 0; j < ISECT_DEPTH; j++) {\n' +
'    float curIdx = float(j);\n' +
'    vec4 pix = texture2D(isectBuffer, vec2(floor(offset+0.5)/SCENE_SIZE, (isectStartIdx+curIdx)/F_ISECT_BUF_HEIGHT));\n' +
'    float isectMeshId = F_MAX_MESH_COUNT * pix.x;\n' +
'    float isectDist = SCENE_SIZE * pix.y;\n' +
'    if (dist < isectDist + 0.1) {\n' +
'      isect2 = vec2(isectMeshId, isectDist);\n' +
'      isectIdx = curIdx;\n' +
'      break;\n' +
'    } else {\n' +
'      isect1 = vec2(isectMeshId, isectDist);\n' +
'    }\n' +
'  }\n' +
'  float d1 = (1.0 + abs(isect1.y - dist)/60.);\n' + // 1 + d/r
'  float d2 = (1.0 + abs(isect2.y - dist)/60.);\n' + // 1 + d/r
'  vec4 color1 = getEmission(int(floor(isect1.x+0.5))) / (d1*d1);\n' +
'  vec4 color2 = getEmission(int(floor(isect2.x+0.5))) / (d2*d2);\n' +
'  vec4 color = 0.5 * (color1 + color2);\n' +*/
// '  vec4 color = abs(isect1.y - offsetAndDist.y) * getEmission(int(floor(isect1.x+0.5)));\n' +
// '  gl_FragColor = vec4(color.rgb, 0.5);\n' +
// '  if (abs(mod(isectIdx, 2.)) > 0.9) gl_FragColor = vec4(0., 0., 0., 0.);\n' +
// '  gl_FragColor = vec4(offsetAndDist.y / SCENE_SIZE, 0., 0., 0.5);\n' +
'  vec2 pos = gl_FragCoord.xy - uResolution;\n' +
'  for (int i = 0; i < ISECT_ANGLES; i++) {\n' +
'    gl_FragColor += getIrradiance(float(i), pos) / F_ISECT_ANGLES;\n' +
'  }\n' +
// '  gl_FragColor = color;\n' +
// '  gl_FragColor = texture2D(isectBuffer, v_uv);\n' +
// '  gl_FragColor = getEmission(6);\n' +
// '  gl_FragColor = vec4(pos.x > 0.0 ? 1.0 : 0.0, 0., 0., 0.5);\n' +
'}';

var isectBufViz = 
'uniform sampler2D isectBuffer;\n' +
'uniform vec2 uResolution;\n' +
'varying vec2 v_uv;\n' +
'void main() {\n' +
'  gl_FragColor = texture2D(isectBuffer, v_uv);\n' +
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