// Depth processing stays centralized here.
// One fixed pipeline: decode in reprojection, then finalize once.
// Reprojection keeps target-view points so depth metrics stay in sensor space.

const DEPTH_ENCODING_SOURCE_RAW = 0;
const DEPTH_ENCODING_LINEAR_VIEW_Z = 1;
const DEPTH_METRIC_MODE_PLANAR = "planar";
const DEPTH_METRIC_MODE_RADIAL = "radial";
const DEPTH_REPROJECTION_ACCEPT_TEXELS = 1.35;
const DEPTH_FINAL_DEPTH_SIGMA_SCALE = 0.08;
const DEPTH_FINAL_DEPTH_SIGMA_MIN = 0.06;
const DEPTH_FINAL_DEPTH_CUTOFF_SCALE = 2.0;

const getDepthMetricMode = function(processingConfig) {
	const modeKey = processingConfig && processingConfig.depthMetricMode ? String(processingConfig.depthMetricMode) : DEPTH_METRIC_MODE_RADIAL;
	return modeKey === DEPTH_METRIC_MODE_PLANAR ? DEPTH_METRIC_MODE_PLANAR : DEPTH_METRIC_MODE_RADIAL;
};

const createDepthProcessingRenderer = function(options) {
	options = options || {};
	const gl = options.gl;
	const webgl2Bool = !!options.webgl2Bool;

	let buffer = null;
	let floatTargetConfig = null;

	let cpuTexture = null;
	let cpuUploadBuffer = null;
	const sourceDepthUvTransform = new Float32Array(16);

	let reprojectProgram = null;
	let reprojectLocs = null;
	let reprojectTexture = null;
	let reprojectFramebuffer = null;
	let reprojectDepthBuffer = null;
	let reprojectWidth = 0;
	let reprojectHeight = 0;

	let finalProgram = null;
	let finalLocs = null;
	let finalTexture = null;
	let finalFramebuffer = null;
	let finalWidth = 0;
	let finalHeight = 0;

	const fullscreenVertexSource = [
		"#version 300 es\n",
		"precision highp float;",
		"in vec2 position;",
		"out vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");

	const bindFullscreenTriangle = function(positionLoc) {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(positionLoc);
		gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
	};

	const restoreFramebufferState = function(previousFramebuffer, previousViewport) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
		gl.viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);
	};

	const setSourceDepthUvTransform = function(depthInfo) {
		sourceDepthUvTransform.set([
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		]);
		if (!depthInfo || !depthInfo.normDepthBufferFromNormView) {
			return;
		}
		if (depthInfo.normDepthBufferFromNormView.matrix) {
			sourceDepthUvTransform.set(depthInfo.normDepthBufferFromNormView.matrix);
			return;
		}
		sourceDepthUvTransform.set(depthInfo.normDepthBufferFromNormView);
	};

	const resolveViewportSize = function(args, fallbackWidth, fallbackHeight) {
		const viewport = args && args.viewport ? args.viewport : null;
		return {
			width: viewport && viewport.width ? Math.max(1, viewport.width | 0) : Math.max(1, fallbackWidth | 0),
			height: viewport && viewport.height ? Math.max(1, viewport.height | 0) : Math.max(1, fallbackHeight | 0)
		};
	};

	const uploadCpuDepth = function(depthInfo, depthProfile) {
		const width = Math.max(1, depthInfo.width | 0);
		const height = Math.max(1, depthInfo.height | 0);
		const pixelCount = width * height;
		const sourceData = depthInfo.data instanceof Uint16Array ? depthInfo.data : new Uint16Array(depthInfo.data);
		const linearScale = depthProfile && depthProfile.linearScale != null ? depthProfile.linearScale : (depthInfo.rawValueToMeters || 0.001);
		if (!cpuTexture) {
			cpuTexture = gl.createTexture();
		}
		if (!cpuUploadBuffer || cpuUploadBuffer.length < pixelCount) {
			cpuUploadBuffer = new Float32Array(pixelCount);
		}
		for (let i = 0; i < pixelCount; i += 1) {
			cpuUploadBuffer[i] = sourceData[i] > 0 ? sourceData[i] * linearScale : 0;
		}
		gl.bindTexture(gl.TEXTURE_2D, cpuTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
		return cpuTexture;
	};

	const ensureReprojectResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (reprojectTexture && reprojectFramebuffer && reprojectDepthBuffer && reprojectWidth === safeWidth && reprojectHeight === safeHeight) {
			return true;
		}
		reprojectWidth = safeWidth;
		reprojectHeight = safeHeight;
		if (!reprojectTexture) {
			reprojectTexture = gl.createTexture();
		}
		if (!reprojectFramebuffer) {
			reprojectFramebuffer = gl.createFramebuffer();
		}
		if (!reprojectDepthBuffer) {
			reprojectDepthBuffer = gl.createRenderbuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, reprojectTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, floatTargetConfig.internalFormat, reprojectWidth, reprojectHeight, 0, floatTargetConfig.format, floatTargetConfig.type, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, reprojectDepthBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, reprojectWidth, reprojectHeight);
		gl.bindFramebuffer(gl.FRAMEBUFFER, reprojectFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, reprojectTexture, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, reprojectDepthBuffer);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};

	const ensureReprojectProgram = function() {
		if (reprojectProgram) {
			return;
		}
		reprojectProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"precision mediump sampler2DArray;",
			"uniform sampler2D sourceTexture2D;",
			"uniform sampler2DArray sourceTextureArray;",
			"uniform float useArraySource;",
			"uniform int sourceLayer;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform float sourceEncodingMode;",
			"uniform vec2 sourceTextureSize;",
			"uniform mat4 sourceDepthUvTransform;",
			"uniform vec4 sourceProjectionParams;",
			"uniform vec4 targetProjectionParams;",
			"uniform vec2 targetTexelSize;",
			"uniform mat4 sourceWorldFromView;",
			"uniform mat4 sourceViewMatrix;",
			"uniform mat4 targetWorldFromView;",
			"uniform mat4 targetViewMatrix;",
			"uniform mat4 targetProjMatrix;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			"float sampleRawDepthTexel(vec2 texelCoord){",
			"vec2 uv=(clamp(texelCoord,vec2(0.0),sourceTextureSize-vec2(1.0))+0.5)/sourceTextureSize;",
			"if(useArraySource>0.5){return texture(sourceTextureArray,vec3(uv,float(sourceLayer))).r;}",
			"return texture(sourceTexture2D,uv).r;",
			"}",
			"float decodeDepth(float rawDepth){",
			"if(rawDepth<=0.0001){return 0.0;}",
			"if(sourceEncodingMode>0.5){return rawDepth;}",
			"if(depthNearZ>0.0){return depthNearZ/max(1.0-rawDepth,0.0001);}",
			"return rawDepth*rawValueToMeters;",
			"}",
			"float sampleMetricDepth(vec2 uv){",
			"vec2 sourcePos=uv*sourceTextureSize-vec2(0.5);",
			"vec2 base=floor(sourcePos);",
			"vec2 frac=clamp(sourcePos-base,0.0,1.0);",
			"float d00=decodeDepth(sampleRawDepthTexel(base));",
			"float d10=decodeDepth(sampleRawDepthTexel(base+vec2(1.0,0.0)));",
			"float d01=decodeDepth(sampleRawDepthTexel(base+vec2(0.0,1.0)));",
			"float d11=decodeDepth(sampleRawDepthTexel(base+vec2(1.0,1.0)));",
			"float w00=(1.0-frac.x)*(1.0-frac.y);",
			"float w10=frac.x*(1.0-frac.y);",
			"float w01=(1.0-frac.x)*frac.y;",
			"float w11=frac.x*frac.y;",
			"float depthSum=0.0;",
			"float weightSum=0.0;",
			"if(d00>0.0001){depthSum+=d00*w00;weightSum+=w00;}",
			"if(d10>0.0001){depthSum+=d10*w10;weightSum+=w10;}",
			"if(d01>0.0001){depthSum+=d01*w01;weightSum+=w01;}",
			"if(d11>0.0001){depthSum+=d11*w11;weightSum+=w11;}",
			"return weightSum>0.0001?depthSum/weightSum:0.0;",
			"}",
			"vec2 projectViewPoint(vec3 viewPoint, vec4 projectionParams){",
			"float invZ=1.0/max(-viewPoint.z,0.0001);",
			"return vec2(viewPoint.x*invZ*projectionParams.x-projectionParams.z,viewPoint.y*invZ*projectionParams.y-projectionParams.w)*0.5+0.5;",
			"}",
			"void main(){",
			"vec2 targetNdc=vScreenUv*2.0-1.0;",
			"vec2 targetRay=vec2((targetNdc.x+targetProjectionParams.z)/targetProjectionParams.x,(targetNdc.y+targetProjectionParams.w)/targetProjectionParams.y);",
			"float guessDepth=1.5;",
			"vec4 worldPoint=vec4(0.0);",
			"vec4 renderPoint=vec4(0.0);",
			"for(int i=0;i<3;i+=1){",
			"vec3 guessViewPoint=vec3(targetRay*guessDepth,-guessDepth);",
			"vec4 guessWorldPoint=targetWorldFromView*vec4(guessViewPoint,1.0);",
			"vec4 sourceViewPoint=sourceViewMatrix*guessWorldPoint;",
			"if(-sourceViewPoint.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){discard;}",
			"vec2 sourceUv=(sourceDepthUvTransform*vec4(projectViewPoint(sourceViewPoint.xyz,sourceProjectionParams),0.0,1.0)).xy;",
			"if(sourceUv.x<0.0||sourceUv.x>1.0||sourceUv.y<0.0||sourceUv.y>1.0){discard;}",
			"float sourceDepth=sampleMetricDepth(sourceUv);",
			"if(sourceDepth<=0.0001){discard;}",
			"float invSourceZ=1.0/max(-sourceViewPoint.z,0.0001);",
			"vec3 sourceRay=vec3(sourceViewPoint.xy*invSourceZ,-1.0);",
			"worldPoint=sourceWorldFromView*vec4(sourceRay*sourceDepth,1.0);",
			"renderPoint=targetViewMatrix*worldPoint;",
			"guessDepth=max(-renderPoint.z," + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + ");",
			"}",
			"if(-renderPoint.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){discard;}",
			"vec4 clipPoint=targetProjMatrix*renderPoint;",
			"float clipW=max(clipPoint.w,0.0001);",
			"if(abs(clipPoint.x)>clipW*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "||abs(clipPoint.y)>clipW*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "){discard;}",
			"vec2 projectedUv=clipPoint.xy/clipW*0.5+0.5;",
			"vec2 reprojectionDelta=abs(projectedUv-vScreenUv);",
			"if(reprojectionDelta.x>targetTexelSize.x*" + DEPTH_REPROJECTION_ACCEPT_TEXELS.toFixed(2) + "||reprojectionDelta.y>targetTexelSize.y*" + DEPTH_REPROJECTION_ACCEPT_TEXELS.toFixed(2) + "){discard;}",
			"gl_FragDepth=clamp(clipPoint.z/clipW*0.5+0.5,0.0,1.0);",
			"fragColor=vec4(renderPoint.xyz,1.0);",
			"}"
		].join(""), "Depth reproject");
		reprojectLocs = {
			position: gl.getAttribLocation(reprojectProgram, "position"),
			sourceTexture2D: gl.getUniformLocation(reprojectProgram, "sourceTexture2D"),
			sourceTextureArray: gl.getUniformLocation(reprojectProgram, "sourceTextureArray"),
			useArraySource: gl.getUniformLocation(reprojectProgram, "useArraySource"),
			sourceLayer: gl.getUniformLocation(reprojectProgram, "sourceLayer"),
			rawValueToMeters: gl.getUniformLocation(reprojectProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(reprojectProgram, "depthNearZ"),
			sourceEncodingMode: gl.getUniformLocation(reprojectProgram, "sourceEncodingMode"),
			sourceTextureSize: gl.getUniformLocation(reprojectProgram, "sourceTextureSize"),
			sourceDepthUvTransform: gl.getUniformLocation(reprojectProgram, "sourceDepthUvTransform"),
			sourceProjectionParams: gl.getUniformLocation(reprojectProgram, "sourceProjectionParams"),
			targetProjectionParams: gl.getUniformLocation(reprojectProgram, "targetProjectionParams"),
			targetTexelSize: gl.getUniformLocation(reprojectProgram, "targetTexelSize"),
			sourceWorldFromView: gl.getUniformLocation(reprojectProgram, "sourceWorldFromView"),
			sourceViewMatrix: gl.getUniformLocation(reprojectProgram, "sourceViewMatrix"),
			targetWorldFromView: gl.getUniformLocation(reprojectProgram, "targetWorldFromView"),
			targetViewMatrix: gl.getUniformLocation(reprojectProgram, "targetViewMatrix"),
			targetProjMatrix: gl.getUniformLocation(reprojectProgram, "targetProjMatrix")
		};
	};

	const reprojectDepth = function(sourceTexture, useArraySourceBool, sourceLayer, sourceEncodingMode, depthProfile, depthInfo, sourceWidth, sourceHeight, reprojectionState, targetProjMatrix) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (
			!sourceTexture ||
			!reprojectionState ||
			!reprojectionState.enabledBool ||
			!reprojectionState.sourceProjectionParams ||
			!reprojectionState.sourceViewMatrix ||
			!reprojectionState.sourceWorldFromViewMatrix ||
			!reprojectionState.targetProjectionParams ||
			!reprojectionState.targetViewMatrix ||
			!reprojectionState.targetWorldFromViewMatrix ||
			!targetProjMatrix ||
			!ensureReprojectResources(sourceWidth, sourceHeight)
		) {
			return null;
		}
		ensureReprojectProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, reprojectFramebuffer);
		gl.viewport(0, 0, reprojectWidth, reprojectHeight);
		gl.clearColor(0, 0, 0, 0);
		gl.clearDepth(1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.depthMask(true);
		gl.depthFunc(gl.LEQUAL);
		gl.disable(gl.BLEND);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(reprojectProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, useArraySourceBool ? null : sourceTexture);
		gl.uniform1i(reprojectLocs.sourceTexture2D, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D_ARRAY, useArraySourceBool ? sourceTexture : null);
		gl.uniform1i(reprojectLocs.sourceTextureArray, 1);
		gl.uniform1f(reprojectLocs.useArraySource, useArraySourceBool ? 1 : 0);
		gl.uniform1i(reprojectLocs.sourceLayer, sourceLayer | 0);
		gl.uniform1f(reprojectLocs.rawValueToMeters, depthProfile && depthProfile.linearScale != null ? depthProfile.linearScale : 0.001);
		gl.uniform1f(reprojectLocs.depthNearZ, depthProfile && depthProfile.nearZ != null ? depthProfile.nearZ : 0);
		gl.uniform1f(reprojectLocs.sourceEncodingMode, sourceEncodingMode != null ? sourceEncodingMode : DEPTH_ENCODING_SOURCE_RAW);
		gl.uniform2f(reprojectLocs.sourceTextureSize, Math.max(1, sourceWidth | 0), Math.max(1, sourceHeight | 0));
		setSourceDepthUvTransform(depthInfo);
		gl.uniformMatrix4fv(reprojectLocs.sourceDepthUvTransform, false, sourceDepthUvTransform);
		gl.uniform4f(reprojectLocs.sourceProjectionParams, reprojectionState.sourceProjectionParams.xScale, reprojectionState.sourceProjectionParams.yScale, reprojectionState.sourceProjectionParams.xOffset, reprojectionState.sourceProjectionParams.yOffset);
		gl.uniform4f(reprojectLocs.targetProjectionParams, reprojectionState.targetProjectionParams.xScale, reprojectionState.targetProjectionParams.yScale, reprojectionState.targetProjectionParams.xOffset, reprojectionState.targetProjectionParams.yOffset);
		gl.uniform2f(reprojectLocs.targetTexelSize, 1 / Math.max(1, reprojectWidth), 1 / Math.max(1, reprojectHeight));
		gl.uniformMatrix4fv(reprojectLocs.sourceWorldFromView, false, reprojectionState.sourceWorldFromViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.sourceViewMatrix, false, reprojectionState.sourceViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.targetWorldFromView, false, reprojectionState.targetWorldFromViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.targetViewMatrix, false, reprojectionState.targetViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.targetProjMatrix, false, targetProjMatrix);
		bindFullscreenTriangle(reprojectLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return reprojectTexture;
	};

	const ensureFinalResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (finalTexture && finalFramebuffer && finalWidth === safeWidth && finalHeight === safeHeight) {
			return true;
		}
		finalWidth = safeWidth;
		finalHeight = safeHeight;
		if (!finalTexture) {
			finalTexture = gl.createTexture();
		}
		if (!finalFramebuffer) {
			finalFramebuffer = gl.createFramebuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, finalTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, floatTargetConfig.internalFormat, finalWidth, finalHeight, 0, floatTargetConfig.format, floatTargetConfig.type, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, finalFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, finalTexture, 0);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};

	const ensureFinalProgram = function() {
		if (finalProgram) {
			return;
		}
		finalProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D packedDepthTexture;",
			"uniform vec2 sourceTextureSize;",
			"uniform mat4 targetWorldFromView;",
			"uniform float radialMetric;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			"vec4 samplePacked(vec2 texelCoord){",
			"vec2 uv=(clamp(texelCoord,vec2(0.0),sourceTextureSize-vec2(1.0))+0.5)/sourceTextureSize;",
			"return texture(packedDepthTexture,uv);",
			"}",
			"float samplePlanarDepth(vec4 packed){",
			"return max(0.0,-packed.z);",
			"}",
			"float referenceDepth(vec2 baseTexel){",
			"float depth=samplePlanarDepth(samplePacked(baseTexel));",
			"if(depth>0.0001){return depth;}",
			"depth=samplePlanarDepth(samplePacked(baseTexel+vec2(1.0,0.0)));",
			"if(depth>0.0001){return depth;}",
			"depth=samplePlanarDepth(samplePacked(baseTexel+vec2(-1.0,0.0)));",
			"if(depth>0.0001){return depth;}",
			"depth=samplePlanarDepth(samplePacked(baseTexel+vec2(0.0,1.0)));",
			"if(depth>0.0001){return depth;}",
			"depth=samplePlanarDepth(samplePacked(baseTexel+vec2(0.0,-1.0)));",
			"return depth>0.0001?depth:0.0;",
			"}",
			"void main(){",
			"vec2 sourcePos=vScreenUv*sourceTextureSize-vec2(0.5);",
			"vec2 baseTexel=floor(sourcePos);",
			"vec2 blend=fract(sourcePos);",
			"float refDepth=referenceDepth(baseTexel);",
			"if(refDepth<=0.0001){fragColor=vec4(0.0);return;}",
			"float sigma=max(" + DEPTH_FINAL_DEPTH_SIGMA_MIN.toFixed(2) + ",refDepth*" + DEPTH_FINAL_DEPTH_SIGMA_SCALE.toFixed(2) + ");",
			"float cutoff=sigma*" + DEPTH_FINAL_DEPTH_CUTOFF_SCALE.toFixed(2) + ";",
			"float invTwoSigmaSq=1.0/(2.0*sigma*sigma);",
			"vec4 s00=samplePacked(baseTexel);",
			"vec4 s10=samplePacked(baseTexel+vec2(1.0,0.0));",
			"vec4 s01=samplePacked(baseTexel+vec2(0.0,1.0));",
			"vec4 s11=samplePacked(baseTexel+vec2(1.0,1.0));",
			"float d00=samplePlanarDepth(s00);",
			"float d10=samplePlanarDepth(s10);",
			"float d01=samplePlanarDepth(s01);",
			"float d11=samplePlanarDepth(s11);",
			"float w00=(1.0-blend.x)*(1.0-blend.y);",
			"float w10=blend.x*(1.0-blend.y);",
			"float w01=(1.0-blend.x)*blend.y;",
			"float w11=blend.x*blend.y;",
			"if(d00<=0.0001||abs(d00-refDepth)>cutoff){w00=0.0;}",
			"else{w00*=exp(-(d00-refDepth)*(d00-refDepth)*invTwoSigmaSq);}",
			"if(d10<=0.0001||abs(d10-refDepth)>cutoff){w10=0.0;}",
			"else{w10*=exp(-(d10-refDepth)*(d10-refDepth)*invTwoSigmaSq);}",
			"if(d01<=0.0001||abs(d01-refDepth)>cutoff){w01=0.0;}",
			"else{w01*=exp(-(d01-refDepth)*(d01-refDepth)*invTwoSigmaSq);}",
			"if(d11<=0.0001||abs(d11-refDepth)>cutoff){w11=0.0;}",
			"else{w11*=exp(-(d11-refDepth)*(d11-refDepth)*invTwoSigmaSq);}",
			"float weightSum=w00+w10+w01+w11;",
			"if(weightSum<=0.0001){fragColor=vec4(0.0);return;}",
			"vec3 filteredViewPoint=(s00.xyz*w00+s10.xyz*w10+s01.xyz*w01+s11.xyz*w11)/weightSum;",
			"float planarDepth=(d00*w00+d10*w10+d01*w01+d11*w11)/weightSum;",
			"float radialDepth=(",
			"length(s00.xyz)*w00+",
			"length(s10.xyz)*w10+",
			"length(s01.xyz)*w01+",
			"length(s11.xyz)*w11",
			")/weightSum;",
			"vec3 filteredWorldPoint=(targetWorldFromView*vec4(filteredViewPoint,1.0)).xyz;",
			"float finalDepth=radialMetric>0.5?radialDepth:planarDepth;",
			"fragColor=vec4(finalDepth,filteredWorldPoint);",
			"}"
		].join(""), "Depth finalize");
		finalLocs = {
			position: gl.getAttribLocation(finalProgram, "position"),
			packedDepthTexture: gl.getUniformLocation(finalProgram, "packedDepthTexture"),
			sourceTextureSize: gl.getUniformLocation(finalProgram, "sourceTextureSize"),
			targetWorldFromView: gl.getUniformLocation(finalProgram, "targetWorldFromView"),
			radialMetric: gl.getUniformLocation(finalProgram, "radialMetric")
		};
	};

	const buildFinalDepth = function(packedDepthTexture, sourceWidth, sourceHeight, targetWidth, targetHeight, targetWorldFromViewMatrix, processingConfig) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (!packedDepthTexture || !ensureFinalResources(targetWidth, targetHeight)) {
			return null;
		}
		ensureFinalProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, finalFramebuffer);
		gl.viewport(0, 0, finalWidth, finalHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(finalProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, packedDepthTexture);
		gl.uniform1i(finalLocs.packedDepthTexture, 0);
		gl.uniform2f(finalLocs.sourceTextureSize, Math.max(1, sourceWidth | 0), Math.max(1, sourceHeight | 0));
		gl.uniformMatrix4fv(finalLocs.targetWorldFromView, false, targetWorldFromViewMatrix || identityMatrix());
		gl.uniform1f(finalLocs.radialMetric, getDepthMetricMode(processingConfig) === DEPTH_METRIC_MODE_RADIAL ? 1 : 0);
		bindFullscreenTriangle(finalLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return finalTexture;
	};

	return {
		init: function() {
			buffer = createFullscreenTriangleBuffer(gl);
			if (!webgl2Bool || !gl.getExtension("EXT_color_buffer_float")) {
				floatTargetConfig = null;
				return;
			}
			floatTargetConfig = {
				internalFormat: gl.RGBA16F,
				format: gl.RGBA,
				type: gl.HALF_FLOAT
			};
		},
		process: function(args) {
			const depthInfo = args && args.depthInfo ? args.depthInfo : null;
			const reprojectionState = args && args.depthReprojectionState ? args.depthReprojectionState : null;
			const depthProfile = args && args.depthProfile ? args.depthProfile : null;
			let sourceTexture = null;
			let useArraySourceBool = false;
			let sourceEncodingMode = DEPTH_ENCODING_SOURCE_RAW;
			if (!floatTargetConfig || !depthInfo || depthInfo.isValid === false || !reprojectionState) {
				return null;
			}

			sourceTexture = depthInfo.texture || null;
			useArraySourceBool = depthInfo.textureType === "texture-array";
			sourceEncodingMode = depthInfo.depthEncodingMode != null ? depthInfo.depthEncodingMode : DEPTH_ENCODING_SOURCE_RAW;
			if (!sourceTexture && depthInfo.data && depthInfo.width && depthInfo.height) {
				sourceTexture = uploadCpuDepth(depthInfo, depthProfile);
				useArraySourceBool = false;
				sourceEncodingMode = DEPTH_ENCODING_LINEAR_VIEW_Z;
			}
			if (!sourceTexture || !depthInfo.width || !depthInfo.height) {
				return null;
			}

			const reprojectedTexture = reprojectDepth(
				sourceTexture,
				useArraySourceBool,
				depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0),
				sourceEncodingMode,
				depthProfile,
				depthInfo,
				depthInfo.width,
				depthInfo.height,
				reprojectionState,
				args && args.targetProjMatrix ? args.targetProjMatrix : null
			);
			if (!reprojectedTexture) {
				return null;
			}

			const consumerSize = resolveViewportSize(args || null, depthInfo.width, depthInfo.height);
			const finalDepthTexture = buildFinalDepth(
				reprojectedTexture,
				depthInfo.width,
				depthInfo.height,
				consumerSize.width,
				consumerSize.height,
				reprojectionState.targetWorldFromViewMatrix,
				args && args.processingConfig ? args.processingConfig : null
			);
			if (!finalDepthTexture) {
				return null;
			}

			return {
				texture: finalDepthTexture,
				width: consumerSize.width,
				height: consumerSize.height,
				depthEncodingMode: DEPTH_ENCODING_LINEAR_VIEW_Z,
				worldPointAvailableBool: true
			};
		}
	};
};
