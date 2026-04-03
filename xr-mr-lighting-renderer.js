// Renderer-only module for MR lighting. It consumes shared light-layer buffers read-only.
const createMrLightingRenderer = function() {
	let gl = null;
	let program = null;
	let depthTexture2dProgram = null;
	let depthGpuArrayProgram = null;
	let positionLoc = null;
	let darkAlphaLoc = null;
	let visibleShareLoc = null;
	let maskCountLoc = null;
	let maskCentersLoc = null;
	let maskParamsLoc = null;
	let additiveColorLoc = null;
	let additiveStrengthLoc = null;
	let lightLayerCountLoc = null;
	let lightLayerCentersLoc = null;
	let lightLayerColorsLoc = null;
	let lightLayerEllipseParamsLoc = null;
	let lightLayerAlphaBlendStrengthsLoc = null;
	let lightLayerEffectParamsLoc = null;
	let lightLayerWorldCentersLoc = null;
	let lightLayerWorldBasisXLoc = null;
	let lightLayerWorldBasisYLoc = null;
	let lightLayerWorldEllipseParamsLoc = null;
	let lightLayerAdditiveScaleLoc = null;
	let lightLayerAlphaBlendScaleLoc = null;
	let buffer = null;
	let depthTexture2dLocs = null;
	let depthGpuArrayLocs = null;
	let cpuDepthTexture = null;
	let cpuUploadBuffer = null;
	const depthUvTransform = new Float32Array(16);
	const maskCenters = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const maskParams = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const additiveColor = new Float32Array(3);
	const overlayVertexSource = [
		"attribute vec2 position;",
		"varying vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");

	const fragmentSource = [
		"precision highp float;",
		"uniform float darkAlpha;",
		"uniform float visibleShare;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec3 additiveColor;",
		"uniform float additiveStrength;",
		"uniform float lightLayerCount;",
		"uniform vec4 lightLayerColors[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec2 lightLayerCenters[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEllipseParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAlphaBlendStrengths[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEffectParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAdditiveScale;",
		"uniform float lightLayerAlphaBlendScale;",
		"varying vec2 vScreenUv;",
		"float circleMask(vec2 uv, vec2 center, vec2 params){",
		"float radius=max(params.x,0.0001);",
		"float softness=max(params.y,0.0001);",
		"float inner=max(0.0,radius-softness);",
		"return 1.0-smoothstep(inner,radius,distance(uv,center));",
		"}",
		"float ellipseMask(vec2 uv, vec2 center, vec4 params){",
		"float radiusX=max(params.x,0.0001);",
		"float radiusY=max(params.y,0.0001);",
		"float softness=max(params.z,0.0001);",
		"float rotation=params.w;",
		"vec2 delta=uv-center;",
		"float cosAngle=cos(rotation);",
		"float sinAngle=sin(rotation);",
		"vec2 local=vec2(delta.x*cosAngle+delta.y*sinAngle,-delta.x*sinAngle+delta.y*cosAngle);",
		"float normalizedDistance=length(vec2(local.x/radiusX,local.y/radiusY));",
		"float edge=max(softness/max(radiusX,radiusY),0.0001);",
		"return 1.0-smoothstep(max(0.0,1.0-edge),1.0,normalizedDistance);",
		"}",
		fixtureEffectFragmentSource,
		"void main(){",
		"float alphaBlendOpen=visibleShare;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float localMask=circleMask(vScreenUv,maskCenters[i],maskParams[i]);",
		"alphaBlendOpen=1.0-(1.0-alphaBlendOpen)*(1.0-localMask);",
		"}",
		"vec3 color=additiveColor*additiveStrength*alphaBlendOpen;",
		"float localAlphaBlendOpen=0.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_LIGHT_LAYERS + ";i+=1){",
		"if(float(i)>=lightLayerCount){break;}",
		"float lightLayerMask=ellipseMask(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i]);",
		"vec2 effectMask=lightLayerEffect(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i],lightLayerEffectParams[i]);",
		"float lightLayerStrength=lightLayerColors[i].a*lightLayerMask*effectMask.x*alphaBlendOpen*lightLayerAdditiveScale;",
		"color+=lightLayerColors[i].rgb*lightLayerStrength;",
		"localAlphaBlendOpen=max(localAlphaBlendOpen,clamp(lightLayerColors[i].a*lightLayerMask*effectMask.y*lightLayerAlphaBlendStrengths[i]*1.65*alphaBlendOpen*lightLayerAlphaBlendScale,0.0,1.0));",
		"}",
		"gl_FragColor=vec4(color,darkAlpha*alphaBlendOpen*(1.0-localAlphaBlendOpen));",
		"}"
	].join("");

	const depthOverlayShaderChunk = [
		"float computeDepthMask(float depthMeters){",
		"if(depthMode<0.5){",
		"return depthFade<=0.0001?step(depthThreshold,depthMeters):smoothstep(max(0.0,depthThreshold-depthFade*0.5),depthThreshold+depthFade*0.5,depthMeters);",
		"}",
		"float wavelength=max(depthEchoWavelength,0.0001);",
		"float dutyCycle=clamp(depthEchoDutyCycle,0.0,1.0);",
		"float visibleWidth=wavelength*dutyCycle;",
		"if(visibleWidth<=0.0001){",
		"return 0.0;",
		"}",
		"if(visibleWidth>=wavelength-0.0001){",
		"return 1.0;",
		"}",
		"float halfPeriod=wavelength*0.5;",
		"float centeredPhase=mod(depthMeters-depthPhaseOffset+halfPeriod,wavelength)-halfPeriod;",
		"float distanceFromBandCenter=abs(centeredPhase);",
		"float hiddenWidth=wavelength-visibleWidth;",
		"float visibleHalfWidth=visibleWidth*0.5;",
		"float fadeHalfWidth=0.5*min(visibleWidth,hiddenWidth)*clamp(depthEchoFade,0.0,1.0);",
		"if(fadeHalfWidth<=0.0001){",
		"return step(distanceFromBandCenter,visibleHalfWidth);",
		"}",
		"float innerEdge=max(0.0,visibleHalfWidth-fadeHalfWidth);",
		"float outerEdge=visibleHalfWidth+fadeHalfWidth;",
		"return 1.0-smoothstep(innerEdge,outerEdge,distanceFromBandCenter);",
		"}",
		"float resolveDepthMetric(float depthMeters){",
		"if(depthMetricMode<0.5){",
		"return depthMeters;",
		"}",
		"vec2 compensatedScreenUv=clamp(vScreenUv+depthMotionCompensation,0.0,1.0);",
		"vec2 ndc=compensatedScreenUv*2.0-1.0;",
		"vec2 viewRay=vec2((ndc.x+depthProjectionParams.z)/depthProjectionParams.x,(ndc.y+depthProjectionParams.w)/depthProjectionParams.y);",
		"return depthMeters*sqrt(1.0+dot(viewRay,viewRay));",
		"}",
		"float computeDepthRetainShare(float baseVisibleShare){",
		"if(depthMrRetain<=0.0001){",
		"return baseVisibleShare;",
		"}",
		"vec2 compensatedScreenUv=clamp(vScreenUv+depthMotionCompensation,0.0,1.0);",
		"vec2 depthUv=(depthUvTransform*vec4(compensatedScreenUv,0.0,1.0)).xy;",
		"float rawDepth=sampleDepth(depthUv);",
		"float valid=step(0.001,rawDepth);",
		"float depthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"float mask=computeDepthMask(resolveDepthMetric(depthMeters));",
		"float localRetain=depthMrRetain*(1.0-mask)*valid;",
		"return max(baseVisibleShare,localRetain);",
		"}"
	].join("");
	const depthTexture2dFragmentSource = [
		"precision highp float;",
		"uniform float darkAlpha;",
		"uniform float visibleShare;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec3 additiveColor;",
		"uniform float additiveStrength;",
		"uniform float lightLayerCount;",
		"uniform vec4 lightLayerColors[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec2 lightLayerCenters[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEllipseParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAlphaBlendStrengths[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEffectParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec3 lightLayerWorldCenters[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec3 lightLayerWorldBasisX[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec3 lightLayerWorldBasisY[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerWorldEllipseParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAdditiveScale;",
		"uniform float lightLayerAlphaBlendScale;",
		"uniform sampler2D depthTexture;",
		"uniform float depthMode;",
		"uniform float depthThreshold;",
		"uniform float depthFade;",
		"uniform float depthEchoWavelength;",
		"uniform float depthEchoDutyCycle;",
		"uniform float depthEchoFade;",
		"uniform float depthPhaseOffset;",
		"uniform float depthMrRetain;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform float depthMetricMode;",
		"uniform vec2 depthMotionCompensation;",
		"uniform vec4 depthProjectionParams;",
		"uniform mat4 depthUvTransform;",
		"uniform mat4 worldFromView;",
		"varying vec2 vScreenUv;",
		"float circleMask(vec2 uv, vec2 center, vec2 params){float radius=max(params.x,0.0001);float softness=max(params.y,0.0001);float inner=max(0.0,radius-softness);return 1.0-smoothstep(inner,radius,distance(uv,center));}",
		"float ellipseMask(vec2 uv, vec2 center, vec4 params){float radiusX=max(params.x,0.0001);float radiusY=max(params.y,0.0001);float softness=max(params.z,0.0001);float rotation=params.w;vec2 delta=uv-center;float cosAngle=cos(rotation);float sinAngle=sin(rotation);vec2 local=vec2(delta.x*cosAngle+delta.y*sinAngle,-delta.x*sinAngle+delta.y*cosAngle);float normalizedDistance=length(vec2(local.x/radiusX,local.y/radiusY));float edge=max(softness/max(radiusX,radiusY),0.0001);return 1.0-smoothstep(max(0.0,1.0-edge),1.0,normalizedDistance);}",
		fixtureEffectFragmentSource,
		"float sampleDepth(vec2 depthUv){return texture2D(depthTexture,depthUv).r;}",
		depthOverlayShaderChunk,
		"vec3 getWorldDirection(vec2 screenUv){vec2 ndc=screenUv*2.0-1.0;vec2 viewRay=vec2((ndc.x+depthProjectionParams.z)/depthProjectionParams.x,(ndc.y+depthProjectionParams.w)/depthProjectionParams.y);vec3 viewDir=normalize(vec3(viewRay,-1.0));return normalize((worldFromView*vec4(viewDir,0.0)).xyz);}",
		"vec3 getWorldPointFromDepth(vec2 screenUv,float depthMeters){vec3 cameraWorld=(worldFromView*vec4(0.0,0.0,0.0,1.0)).xyz;return cameraWorld+getWorldDirection(screenUv)*depthMeters;}",
		"float worldEllipseMask(vec3 worldPoint,vec3 center,vec3 basisX,vec3 basisY,vec4 worldParams){float radiusX=max(worldParams.x,0.0001);float radiusY=max(worldParams.y,0.0001);float softness=max(worldParams.z,0.0001);float planeWidth=max(worldParams.w,0.0001);vec3 delta=worldPoint-center;vec3 tangentX=normalize(basisX);vec3 tangentY=normalize(basisY);vec3 normal=normalize(cross(tangentX,tangentY));float localX=dot(delta,tangentX);float localY=dot(delta,tangentY);float localZ=abs(dot(delta,normal));float normalizedDistance=length(vec2(localX/radiusX,localY/radiusY));float edge=max(softness/max(radiusX,radiusY),0.0001);float ellipse=1.0-smoothstep(max(0.0,1.0-edge),1.0,normalizedDistance);float plane=1.0-smoothstep(planeWidth,planeWidth+max(planeWidth*0.8,0.04),localZ);return ellipse*plane;}",
		"void main(){",
		"float alphaBlendOpen=computeDepthRetainShare(visibleShare);",
		"vec2 lightLayerDepthUv=(depthUvTransform*vec4(vScreenUv,0.0,1.0)).xy;",
		"float lightLayerRawDepth=sampleDepth(lightLayerDepthUv);",
		"float lightLayerDepthValid=step(0.001,lightLayerRawDepth);",
		"float lightLayerDepthMeters=depthNearZ>0.0?depthNearZ/max(1.0-lightLayerRawDepth,0.0001):lightLayerRawDepth*rawValueToMeters;",
		"vec3 lightLayerWorldPoint=getWorldPointFromDepth(vScreenUv,lightLayerDepthMeters);",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float localMask=circleMask(vScreenUv,maskCenters[i],maskParams[i]);",
		"alphaBlendOpen=1.0-(1.0-alphaBlendOpen)*(1.0-localMask);",
		"}",
		"vec3 color=additiveColor*additiveStrength*alphaBlendOpen;",
		"float localAlphaBlendOpen=0.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_LIGHT_LAYERS + ";i+=1){",
		"if(float(i)>=lightLayerCount){break;}",
		"float lightLayerMask=ellipseMask(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i]);",
		"if(lightLayerWorldEllipseParams[i].x>0.0001&&lightLayerDepthValid>0.5){lightLayerMask=worldEllipseMask(lightLayerWorldPoint,lightLayerWorldCenters[i],lightLayerWorldBasisX[i],lightLayerWorldBasisY[i],lightLayerWorldEllipseParams[i]);}",
		"vec2 effectMask=lightLayerEffect(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i],lightLayerEffectParams[i]);",
		"float lightLayerStrength=lightLayerColors[i].a*lightLayerMask*effectMask.x*alphaBlendOpen*lightLayerAdditiveScale;",
		"color+=lightLayerColors[i].rgb*lightLayerStrength;",
		"localAlphaBlendOpen=max(localAlphaBlendOpen,clamp(lightLayerColors[i].a*lightLayerMask*effectMask.y*lightLayerAlphaBlendStrengths[i]*1.65*alphaBlendOpen*lightLayerAlphaBlendScale,0.0,1.0));",
		"}",
		"gl_FragColor=vec4(color,darkAlpha*alphaBlendOpen*(1.0-localAlphaBlendOpen));",
		"}"
	].join("");
	const depthGpuArrayVertexSource = [
		"#version 300 es\n",
		"in vec2 position;",
		"out vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");
	const depthGpuArrayFragmentSource = [
		"#version 300 es\n",
		"precision highp float;",
		"precision mediump sampler2DArray;",
		"uniform float darkAlpha;",
		"uniform float visibleShare;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec3 additiveColor;",
		"uniform float additiveStrength;",
		"uniform float lightLayerCount;",
		"uniform vec4 lightLayerColors[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec2 lightLayerCenters[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEllipseParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAlphaBlendStrengths[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEffectParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec3 lightLayerWorldCenters[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec3 lightLayerWorldBasisX[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec3 lightLayerWorldBasisY[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerWorldEllipseParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAdditiveScale;",
		"uniform float lightLayerAlphaBlendScale;",
		"uniform sampler2DArray depthTexture;",
		"uniform int depthTextureLayer;",
		"uniform float depthMode;",
		"uniform float depthThreshold;",
		"uniform float depthFade;",
		"uniform float depthEchoWavelength;",
		"uniform float depthEchoDutyCycle;",
		"uniform float depthEchoFade;",
		"uniform float depthPhaseOffset;",
		"uniform float depthMrRetain;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform float depthMetricMode;",
		"uniform vec2 depthMotionCompensation;",
		"uniform vec4 depthProjectionParams;",
		"uniform mat4 depthUvTransform;",
		"uniform mat4 worldFromView;",
		"in vec2 vScreenUv;",
		"out vec4 fragColor;",
		"float circleMask(vec2 uv, vec2 center, vec2 params){float radius=max(params.x,0.0001);float softness=max(params.y,0.0001);float inner=max(0.0,radius-softness);return 1.0-smoothstep(inner,radius,distance(uv,center));}",
		"float ellipseMask(vec2 uv, vec2 center, vec4 params){float radiusX=max(params.x,0.0001);float radiusY=max(params.y,0.0001);float softness=max(params.z,0.0001);float rotation=params.w;vec2 delta=uv-center;float cosAngle=cos(rotation);float sinAngle=sin(rotation);vec2 local=vec2(delta.x*cosAngle+delta.y*sinAngle,-delta.x*sinAngle+delta.y*cosAngle);float normalizedDistance=length(vec2(local.x/radiusX,local.y/radiusY));float edge=max(softness/max(radiusX,radiusY),0.0001);return 1.0-smoothstep(max(0.0,1.0-edge),1.0,normalizedDistance);}",
		fixtureEffectFragmentSource,
		"float sampleDepth(vec2 depthUv){return texture(depthTexture,vec3(depthUv,float(depthTextureLayer))).r;}",
		depthOverlayShaderChunk,
		"vec3 getWorldDirection(vec2 screenUv){vec2 ndc=screenUv*2.0-1.0;vec2 viewRay=vec2((ndc.x+depthProjectionParams.z)/depthProjectionParams.x,(ndc.y+depthProjectionParams.w)/depthProjectionParams.y);vec3 viewDir=normalize(vec3(viewRay,-1.0));return normalize((worldFromView*vec4(viewDir,0.0)).xyz);}",
		"vec3 getWorldPointFromDepth(vec2 screenUv,float depthMeters){vec3 cameraWorld=(worldFromView*vec4(0.0,0.0,0.0,1.0)).xyz;return cameraWorld+getWorldDirection(screenUv)*depthMeters;}",
		"float worldEllipseMask(vec3 worldPoint,vec3 center,vec3 basisX,vec3 basisY,vec4 worldParams){float radiusX=max(worldParams.x,0.0001);float radiusY=max(worldParams.y,0.0001);float softness=max(worldParams.z,0.0001);float planeWidth=max(worldParams.w,0.0001);vec3 delta=worldPoint-center;vec3 tangentX=normalize(basisX);vec3 tangentY=normalize(basisY);vec3 normal=normalize(cross(tangentX,tangentY));float localX=dot(delta,tangentX);float localY=dot(delta,tangentY);float localZ=abs(dot(delta,normal));float normalizedDistance=length(vec2(localX/radiusX,localY/radiusY));float edge=max(softness/max(radiusX,radiusY),0.0001);float ellipse=1.0-smoothstep(max(0.0,1.0-edge),1.0,normalizedDistance);float plane=1.0-smoothstep(planeWidth,planeWidth+max(planeWidth*0.8,0.04),localZ);return ellipse*plane;}",
		"void main(){",
		"float alphaBlendOpen=computeDepthRetainShare(visibleShare);",
		"vec2 lightLayerDepthUv=(depthUvTransform*vec4(vScreenUv,0.0,1.0)).xy;",
		"float lightLayerRawDepth=sampleDepth(lightLayerDepthUv);",
		"float lightLayerDepthValid=step(0.001,lightLayerRawDepth);",
		"float lightLayerDepthMeters=depthNearZ>0.0?depthNearZ/max(1.0-lightLayerRawDepth,0.0001):lightLayerRawDepth*rawValueToMeters;",
		"vec3 lightLayerWorldPoint=getWorldPointFromDepth(vScreenUv,lightLayerDepthMeters);",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float localMask=circleMask(vScreenUv,maskCenters[i],maskParams[i]);",
		"alphaBlendOpen=1.0-(1.0-alphaBlendOpen)*(1.0-localMask);",
		"}",
		"vec3 color=additiveColor*additiveStrength*alphaBlendOpen;",
		"float localAlphaBlendOpen=0.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_LIGHT_LAYERS + ";i+=1){",
		"if(float(i)>=lightLayerCount){break;}",
		"float lightLayerMask=ellipseMask(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i]);",
		"if(lightLayerWorldEllipseParams[i].x>0.0001&&lightLayerDepthValid>0.5){lightLayerMask=worldEllipseMask(lightLayerWorldPoint,lightLayerWorldCenters[i],lightLayerWorldBasisX[i],lightLayerWorldBasisY[i],lightLayerWorldEllipseParams[i]);}",
		"vec2 effectMask=lightLayerEffect(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i],lightLayerEffectParams[i]);",
		"float lightLayerStrength=lightLayerColors[i].a*lightLayerMask*effectMask.x*alphaBlendOpen*lightLayerAdditiveScale;",
		"color+=lightLayerColors[i].rgb*lightLayerStrength;",
		"localAlphaBlendOpen=max(localAlphaBlendOpen,clamp(lightLayerColors[i].a*lightLayerMask*effectMask.y*lightLayerAlphaBlendStrengths[i]*1.65*alphaBlendOpen*lightLayerAlphaBlendScale,0.0,1.0));",
		"}",
		"fragColor=vec4(color,darkAlpha*alphaBlendOpen*(1.0-localAlphaBlendOpen));",
		"}"
	].join("");
	const buildOverlayLocs = function(targetProgram) {
		return {
			position: gl.getAttribLocation(targetProgram, "position"),
			darkAlpha: gl.getUniformLocation(targetProgram, "darkAlpha"),
			visibleShare: gl.getUniformLocation(targetProgram, "visibleShare"),
			maskCount: gl.getUniformLocation(targetProgram, "maskCount"),
			maskCenters: gl.getUniformLocation(targetProgram, "maskCenters"),
			maskParams: gl.getUniformLocation(targetProgram, "maskParams"),
			additiveColor: gl.getUniformLocation(targetProgram, "additiveColor"),
			additiveStrength: gl.getUniformLocation(targetProgram, "additiveStrength"),
			lightLayerCount: gl.getUniformLocation(targetProgram, "lightLayerCount"),
			lightLayerCenters: gl.getUniformLocation(targetProgram, "lightLayerCenters"),
			lightLayerColors: gl.getUniformLocation(targetProgram, "lightLayerColors"),
			lightLayerEllipseParams: gl.getUniformLocation(targetProgram, "lightLayerEllipseParams"),
			lightLayerAlphaBlendStrengths: gl.getUniformLocation(targetProgram, "lightLayerAlphaBlendStrengths"),
			lightLayerEffectParams: gl.getUniformLocation(targetProgram, "lightLayerEffectParams"),
			lightLayerWorldCenters: gl.getUniformLocation(targetProgram, "lightLayerWorldCenters"),
			lightLayerWorldBasisX: gl.getUniformLocation(targetProgram, "lightLayerWorldBasisX"),
			lightLayerWorldBasisY: gl.getUniformLocation(targetProgram, "lightLayerWorldBasisY"),
			lightLayerWorldEllipseParams: gl.getUniformLocation(targetProgram, "lightLayerWorldEllipseParams"),
			lightLayerAdditiveScale: gl.getUniformLocation(targetProgram, "lightLayerAdditiveScale"),
			lightLayerAlphaBlendScale: gl.getUniformLocation(targetProgram, "lightLayerAlphaBlendScale"),
			depthTexture: gl.getUniformLocation(targetProgram, "depthTexture"),
			depthTextureLayer: gl.getUniformLocation(targetProgram, "depthTextureLayer"),
			depthMode: gl.getUniformLocation(targetProgram, "depthMode"),
			depthThreshold: gl.getUniformLocation(targetProgram, "depthThreshold"),
			depthFade: gl.getUniformLocation(targetProgram, "depthFade"),
			depthEchoWavelength: gl.getUniformLocation(targetProgram, "depthEchoWavelength"),
			depthEchoDutyCycle: gl.getUniformLocation(targetProgram, "depthEchoDutyCycle"),
			depthEchoFade: gl.getUniformLocation(targetProgram, "depthEchoFade"),
			depthPhaseOffset: gl.getUniformLocation(targetProgram, "depthPhaseOffset"),
			depthMrRetain: gl.getUniformLocation(targetProgram, "depthMrRetain"),
			rawValueToMeters: gl.getUniformLocation(targetProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(targetProgram, "depthNearZ"),
			depthMetricMode: gl.getUniformLocation(targetProgram, "depthMetricMode"),
			depthMotionCompensation: gl.getUniformLocation(targetProgram, "depthMotionCompensation"),
			depthProjectionParams: gl.getUniformLocation(targetProgram, "depthProjectionParams"),
			depthUvTransform: gl.getUniformLocation(targetProgram, "depthUvTransform"),
			worldFromView: gl.getUniformLocation(targetProgram, "worldFromView")
		};
	};

	return {
		init: function(glContext) {
			gl = glContext;
			program = createProgram(gl, fullscreenVertexSource, fragmentSource, "Passthrough overlay");
			positionLoc = gl.getAttribLocation(program, "position");
			darkAlphaLoc = gl.getUniformLocation(program, "darkAlpha");
			visibleShareLoc = gl.getUniformLocation(program, "visibleShare");
			maskCountLoc = gl.getUniformLocation(program, "maskCount");
			maskCentersLoc = gl.getUniformLocation(program, "maskCenters");
			maskParamsLoc = gl.getUniformLocation(program, "maskParams");
			additiveColorLoc = gl.getUniformLocation(program, "additiveColor");
			additiveStrengthLoc = gl.getUniformLocation(program, "additiveStrength");
			lightLayerCountLoc = gl.getUniformLocation(program, "lightLayerCount");
			lightLayerCentersLoc = gl.getUniformLocation(program, "lightLayerCenters");
			lightLayerColorsLoc = gl.getUniformLocation(program, "lightLayerColors");
			lightLayerEllipseParamsLoc = gl.getUniformLocation(program, "lightLayerEllipseParams");
			lightLayerAlphaBlendStrengthsLoc = gl.getUniformLocation(program, "lightLayerAlphaBlendStrengths");
			lightLayerEffectParamsLoc = gl.getUniformLocation(program, "lightLayerEffectParams");
			lightLayerAdditiveScaleLoc = gl.getUniformLocation(program, "lightLayerAdditiveScale");
			lightLayerAlphaBlendScaleLoc = gl.getUniformLocation(program, "lightLayerAlphaBlendScale");
			depthTexture2dProgram = createProgram(gl, overlayVertexSource, depthTexture2dFragmentSource, "Passthrough overlay depth texture2d");
			depthTexture2dLocs = buildOverlayLocs(depthTexture2dProgram);
			if (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) {
				depthGpuArrayProgram = createProgram(gl, depthGpuArrayVertexSource, depthGpuArrayFragmentSource, "Passthrough overlay depth gpu-array");
				depthGpuArrayLocs = buildOverlayLocs(depthGpuArrayProgram);
			}
			buffer = createFullscreenTriangleBuffer(gl);
		},
		draw: function(renderState, depthInfo, depthFrameKind, webgl2Bool, depthProfile) {
			if (!renderState) {
				return;
			}
			const effectiveAlphaBlendOpen = renderState.visibleShare > 0.001 || renderState.maskCount > 0 || !!(renderState.depth && renderState.depth.depthMrRetain > 0.001);
			if (!effectiveAlphaBlendOpen) {
				return;
			}
			const lightLayers = renderState.lightLayers;
			if (!lightLayers) {
				return;
			}
			for (let i = 0; i < maskCenters.length; i += 1) {
				maskCenters[i] = 0;
				maskParams[i] = 0;
			}
			for (let i = 0; i < renderState.maskCount && i < PASSTHROUGH_MAX_FLASHLIGHTS; i += 1) {
				maskCenters[i * 2] = renderState.masks[i].x;
				maskCenters[i * 2 + 1] = renderState.masks[i].y;
				maskParams[i * 2] = renderState.masks[i].radius;
				maskParams[i * 2 + 1] = renderState.masks[i].softness;
			}
			additiveColor[0] = renderState.additiveColor[0];
			additiveColor[1] = renderState.additiveColor[1];
			additiveColor[2] = renderState.additiveColor[2];
			let activeProgram = program;
			let activeLocs = {
				position: positionLoc,
				darkAlpha: darkAlphaLoc,
				visibleShare: visibleShareLoc,
				maskCount: maskCountLoc,
				maskCenters: maskCentersLoc,
				maskParams: maskParamsLoc,
				additiveColor: additiveColorLoc,
				additiveStrength: additiveStrengthLoc,
				lightLayerCount: lightLayerCountLoc,
				lightLayerCenters: lightLayerCentersLoc,
				lightLayerColors: lightLayerColorsLoc,
				lightLayerEllipseParams: lightLayerEllipseParamsLoc,
				lightLayerAlphaBlendStrengths: lightLayerAlphaBlendStrengthsLoc,
				lightLayerEffectParams: lightLayerEffectParamsLoc,
				lightLayerAdditiveScale: lightLayerAdditiveScaleLoc,
				lightLayerAlphaBlendScale: lightLayerAlphaBlendScaleLoc
			};
			let cpuTextureBoundBool = false;
			const useDepthProgramBool = !!(depthInfo && (renderState.depth || lightLayers.surfaceDepthLayerCount > 0));
			if (useDepthProgramBool) {
				const profile = depthProfile || {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
				if (depthFrameKind === "cpu") {
					if (!depthInfo.data || !depthInfo.width || !depthInfo.height) {
						return;
					}
					if (!cpuDepthTexture) {
						cpuDepthTexture = gl.createTexture();
					}
					const pixelCount = depthInfo.width * depthInfo.height;
					if (!cpuUploadBuffer || cpuUploadBuffer.length < pixelCount) {
						cpuUploadBuffer = new Float32Array(pixelCount);
					}
					const src = new Uint16Array(depthInfo.data);
					for (let i = 0; i < pixelCount; i += 1) {
						cpuUploadBuffer[i] = src[i];
					}
					gl.activeTexture(gl.TEXTURE1);
					gl.bindTexture(gl.TEXTURE_2D, cpuDepthTexture);
					if (webgl2Bool) {
						gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, depthInfo.width, depthInfo.height, 0, gl.RED, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
					} else {
						gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, depthInfo.width, depthInfo.height, 0, gl.LUMINANCE, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
					}
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					cpuTextureBoundBool = true;
					activeProgram = depthTexture2dProgram;
					activeLocs = depthTexture2dLocs;
				} else if (depthFrameKind === "gpu-array" && webgl2Bool && depthGpuArrayProgram && depthInfo.texture) {
					activeProgram = depthGpuArrayProgram;
					activeLocs = depthGpuArrayLocs;
				} else if (depthInfo.texture) {
					activeProgram = depthTexture2dProgram;
					activeLocs = depthTexture2dLocs;
				} else {
					activeProgram = program;
				}
			}
			gl.enable(gl.BLEND);
			// Accumulate MR alpha additively so the global visualizer->MR crossfade does not
			// open an extra direct-passthrough gap between two already intentional layers.
			gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.useProgram(activeProgram);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(activeLocs.position);
			gl.vertexAttribPointer(activeLocs.position, 2, gl.FLOAT, false, 0, 0);
			gl.uniform1f(activeLocs.darkAlpha, renderState.darkAlpha);
			gl.uniform1f(activeLocs.visibleShare, renderState.visibleShare);
			gl.uniform1f(activeLocs.maskCount, renderState.maskCount);
			gl.uniform2fv(activeLocs.maskCenters, maskCenters);
			gl.uniform2fv(activeLocs.maskParams, maskParams);
			gl.uniform3fv(activeLocs.additiveColor, additiveColor);
			gl.uniform1f(activeLocs.additiveStrength, renderState.additiveStrength);
			gl.uniform1f(activeLocs.lightLayerCount, lightLayers.count);
			gl.uniform2fv(activeLocs.lightLayerCenters, lightLayers.centersUv);
			gl.uniform4fv(activeLocs.lightLayerColors, lightLayers.colors);
			gl.uniform4fv(activeLocs.lightLayerEllipseParams, lightLayers.ellipseParamsUv);
			gl.uniform1fv(activeLocs.lightLayerAlphaBlendStrengths, lightLayers.alphaBlendStrengths);
			gl.uniform4fv(activeLocs.lightLayerEffectParams, lightLayers.effectParams);
			gl.uniform1f(activeLocs.lightLayerAdditiveScale, renderState.lightLayerAdditiveScale == null ? 1 : renderState.lightLayerAdditiveScale);
			gl.uniform1f(activeLocs.lightLayerAlphaBlendScale, renderState.lightLayerAlphaBlendScale == null ? 1 : renderState.lightLayerAlphaBlendScale);
			if (useDepthProgramBool && activeLocs.depthTexture) {
				gl.uniform1f(activeLocs.depthMode, renderState.depth && renderState.depth.depthMode != null ? renderState.depth.depthMode : 0);
				gl.uniform1f(activeLocs.depthThreshold, renderState.depth ? renderState.depth.depthThreshold : 0);
				gl.uniform1f(activeLocs.depthFade, renderState.depth ? renderState.depth.depthFade : 0);
				gl.uniform1f(activeLocs.depthEchoWavelength, renderState.depth && renderState.depth.depthEchoWavelength != null ? renderState.depth.depthEchoWavelength : 1);
				gl.uniform1f(activeLocs.depthEchoDutyCycle, renderState.depth && renderState.depth.depthEchoDutyCycle != null ? renderState.depth.depthEchoDutyCycle : 0.5);
				gl.uniform1f(activeLocs.depthEchoFade, renderState.depth && renderState.depth.depthEchoFade != null ? renderState.depth.depthEchoFade : 0);
				gl.uniform1f(activeLocs.depthPhaseOffset, renderState.depth && renderState.depth.depthPhaseOffset != null ? renderState.depth.depthPhaseOffset : 0);
				gl.uniform1f(activeLocs.depthMrRetain, renderState.depth ? (renderState.depth.depthMrRetain || 0) : 0);
				gl.uniform1f(activeLocs.rawValueToMeters, depthProfile && depthInfo ? (depthProfile.linearScale != null ? depthProfile.linearScale : (depthInfo.rawValueToMeters || 0.001)) : (depthInfo && depthInfo.rawValueToMeters || 0.001));
				gl.uniform1f(activeLocs.depthNearZ, depthProfile && depthProfile.nearZ != null ? depthProfile.nearZ : 0);
				gl.uniform1f(activeLocs.depthMetricMode, renderState.depth && renderState.depth.depthRadialBool ? 1 : 0);
				gl.uniform2f(
					activeLocs.depthMotionCompensation,
					renderState.depth && renderState.depth.depthMotionCompensation ? renderState.depth.depthMotionCompensation.x : 0,
					renderState.depth && renderState.depth.depthMotionCompensation ? renderState.depth.depthMotionCompensation.y : 0
				);
				gl.uniform4f(
					activeLocs.depthProjectionParams,
					renderState.depthProjectionParams ? renderState.depthProjectionParams.xScale : 1,
					renderState.depthProjectionParams ? renderState.depthProjectionParams.yScale : 1,
					renderState.depthProjectionParams ? renderState.depthProjectionParams.xOffset : 0,
					renderState.depthProjectionParams ? renderState.depthProjectionParams.yOffset : 0
				);
				gl.uniform3fv(activeLocs.lightLayerWorldCenters, lightLayers.worldCenters);
				gl.uniform3fv(activeLocs.lightLayerWorldBasisX, lightLayers.worldBasisX);
				gl.uniform3fv(activeLocs.lightLayerWorldBasisY, lightLayers.worldBasisY);
				gl.uniform4fv(activeLocs.lightLayerWorldEllipseParams, lightLayers.worldEllipseParams);
				gl.uniformMatrix4fv(activeLocs.worldFromView, false, renderState.viewWorldMatrix || identityMatrix());
				gl.activeTexture(gl.TEXTURE1);
				if (cpuTextureBoundBool) {
					// already bound above
				} else if (depthFrameKind === "gpu-array" && webgl2Bool && depthGpuArrayProgram && depthInfo.texture && activeLocs.depthTextureLayer) {
					gl.bindTexture(gl.TEXTURE_2D_ARRAY, depthInfo.texture);
					gl.uniform1i(activeLocs.depthTextureLayer, depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0));
				} else if (depthInfo && depthInfo.texture) {
					gl.bindTexture(gl.TEXTURE_2D, depthInfo.texture);
				}
				gl.uniform1i(activeLocs.depthTexture, 1);
				if (depthInfo.normDepthBufferFromNormView && depthInfo.normDepthBufferFromNormView.matrix) {
					depthUvTransform.set(depthInfo.normDepthBufferFromNormView.matrix);
				} else if (depthInfo.normDepthBufferFromNormView) {
					depthUvTransform.set(depthInfo.normDepthBufferFromNormView);
				} else {
					depthUvTransform[0] = 1; depthUvTransform[1] = 0; depthUvTransform[2] = 0; depthUvTransform[3] = 0;
					depthUvTransform[4] = 0; depthUvTransform[5] = 1; depthUvTransform[6] = 0; depthUvTransform[7] = 0;
					depthUvTransform[8] = 0; depthUvTransform[9] = 0; depthUvTransform[10] = 1; depthUvTransform[11] = 0;
					depthUvTransform[12] = 0; depthUvTransform[13] = 0; depthUvTransform[14] = 0; depthUvTransform[15] = 1;
				}
				gl.uniformMatrix4fv(activeLocs.depthUvTransform, false, depthUvTransform);
			}
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.DEPTH_TEST);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		}
	};
};
