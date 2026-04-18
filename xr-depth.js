// Depth processing stays centralized here.
// One fixed pipeline: decode in reprojection, then finalize once.
// Reprojection keeps target-view points so depth metrics stay in sensor space.

const DEPTH_ENCODING_SOURCE_RAW = 0;
const DEPTH_ENCODING_LINEAR_VIEW_Z = 1;
const DEPTH_METRIC_MODE_PLANAR = "planar";
const DEPTH_METRIC_MODE_RADIAL = "radial";
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
	const identityMatrix4 = new Float32Array([
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	]);
	const sourceViewUvTransform = new Float32Array(16);

	let reprojectProgram = null;
	let reprojectLocs = null;
	let depthReprojectTexture = null;
	let depthReprojectFramebuffer = null;
	let depthReprojectDepthBuffer = null;
	let depthReprojectWidth = 0;
	let depthReprojectHeight = 0;
	let maskReprojectTexture = null;
	let maskReprojectFramebuffer = null;
	let maskReprojectDepthBuffer = null;
	let maskReprojectWidth = 0;
	let maskReprojectHeight = 0;

	let finalProgram = null;
	let finalLocs = null;
	let finalTexture = null;
	let finalFramebuffer = null;
	let finalWidth = 0;
	let finalHeight = 0;

	let maskProgram = null;
	let maskLocs = null;
	let maskTexture = null;
	let maskFramebuffer = null;
	let maskWidth = 0;
	let maskHeight = 0;

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

	const ensureReprojectResources = function(kindKey, width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		const depthTargetBool = kindKey !== "mask";
		let texture = depthTargetBool ? depthReprojectTexture : maskReprojectTexture;
		let framebuffer = depthTargetBool ? depthReprojectFramebuffer : maskReprojectFramebuffer;
		let depthBuffer = depthTargetBool ? depthReprojectDepthBuffer : maskReprojectDepthBuffer;
		let cachedWidth = depthTargetBool ? depthReprojectWidth : maskReprojectWidth;
		let cachedHeight = depthTargetBool ? depthReprojectHeight : maskReprojectHeight;
		if (texture && framebuffer && depthBuffer && cachedWidth === safeWidth && cachedHeight === safeHeight) {
			return true;
		}
		if (!texture) {
			texture = gl.createTexture();
		}
		if (!framebuffer) {
			framebuffer = gl.createFramebuffer();
		}
		if (!depthBuffer) {
			depthBuffer = gl.createRenderbuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, floatTargetConfig.internalFormat, safeWidth, safeHeight, 0, floatTargetConfig.format, floatTargetConfig.type, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, safeWidth, safeHeight);
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
		if (depthTargetBool) {
			depthReprojectTexture = texture;
			depthReprojectFramebuffer = framebuffer;
			depthReprojectDepthBuffer = depthBuffer;
			depthReprojectWidth = safeWidth;
			depthReprojectHeight = safeHeight;
		} else {
			maskReprojectTexture = texture;
			maskReprojectFramebuffer = framebuffer;
			maskReprojectDepthBuffer = depthBuffer;
			maskReprojectWidth = safeWidth;
			maskReprojectHeight = safeHeight;
		}
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};

	const ensureReprojectProgram = function() {
		if (reprojectProgram) {
			return;
		}
		reprojectProgram = createProgram(gl, [
			"#version 300 es\n",
			"precision highp float;",
			"precision highp sampler2D;",
			"precision mediump sampler2DArray;",
			"uniform sampler2D sourceTexture2D;",
			"uniform sampler2DArray sourceTextureArray;",
			"uniform float useArraySource;",
			"uniform int sourceLayer;",
			"uniform int sourceWidth;",
			"uniform int sourceHeight;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform float sourceEncodingMode;",
			"uniform float pointSize;",
			"uniform mat4 sourceViewUvTransform;",
			"uniform vec4 sourceProjectionParams;",
			"uniform mat4 sourceWorldFromView;",
			"uniform mat4 targetViewMatrix;",
			"uniform mat4 targetProjMatrix;",
			"flat out vec3 vTargetViewPoint;",
			"float sampleRawDepth(ivec2 texelCoord){",
			"if(useArraySource>0.5){return texelFetch(sourceTextureArray,ivec3(texelCoord,sourceLayer),0).r;}",
			"return texelFetch(sourceTexture2D,texelCoord,0).r;",
			"}",
			"float decodeDepth(float rawDepth){",
			"if(rawDepth<=0.0001){return 0.0;}",
			"if(sourceEncodingMode>0.5){return rawDepth;}",
			"if(depthNearZ>0.0){return depthNearZ/max(1.0-rawDepth,0.0001);}",
			"return rawDepth*rawValueToMeters;",
			"}",
			"void main(){",
			"int sourceX=gl_VertexID%sourceWidth;",
			"int sourceY=gl_VertexID/sourceWidth;",
			"ivec2 texelCoord=ivec2(sourceX,sourceY);",
			"float sourceDepth=decodeDepth(sampleRawDepth(texelCoord));",
			"if(sourceDepth<=0.0001){gl_Position=vec4(2.0,2.0,1.0,1.0);gl_PointSize=1.0;return;}",
			"vec2 depthUv=(vec2(float(sourceX),float(sourceY))+vec2(0.5))/vec2(float(sourceWidth),float(sourceHeight));",
			"vec2 viewUv=(sourceViewUvTransform*vec4(depthUv,0.0,1.0)).xy;",
			"if(viewUv.x<0.0||viewUv.x>1.0||viewUv.y<0.0||viewUv.y>1.0){gl_Position=vec4(2.0,2.0,1.0,1.0);gl_PointSize=1.0;return;}",
			"vec2 sourceNdc=viewUv*2.0-1.0;",
			"vec2 sourceRay=vec2((sourceNdc.x+sourceProjectionParams.z)/sourceProjectionParams.x,(sourceNdc.y+sourceProjectionParams.w)/sourceProjectionParams.y);",
			"vec3 sourceViewPoint=vec3(sourceRay*sourceDepth,-sourceDepth);",
			"vec4 worldPoint=sourceWorldFromView*vec4(sourceViewPoint,1.0);",
			"vec4 targetViewPoint=targetViewMatrix*worldPoint;",
			"if(-targetViewPoint.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){gl_Position=vec4(2.0,2.0,1.0,1.0);gl_PointSize=1.0;return;}",
			"vTargetViewPoint=targetViewPoint.xyz;",
			"gl_Position=targetProjMatrix*targetViewPoint;",
			"gl_PointSize=pointSize;",
			"}"
		].join(""), [
			"#version 300 es\n",
			"precision highp float;",
			"flat in vec3 vTargetViewPoint;",
			"out vec4 fragColor;",
			"void main(){",
			"vec2 pointUv=gl_PointCoord*2.0-1.0;",
			"float radiusSq=dot(pointUv,pointUv);",
			"if(radiusSq>1.0){discard;}",
			"fragColor=vec4(vTargetViewPoint,1.0);",
			"}"
		].join(""), "Depth reproject");
		reprojectLocs = {
			sourceTexture2D: gl.getUniformLocation(reprojectProgram, "sourceTexture2D"),
			sourceTextureArray: gl.getUniformLocation(reprojectProgram, "sourceTextureArray"),
			useArraySource: gl.getUniformLocation(reprojectProgram, "useArraySource"),
			sourceLayer: gl.getUniformLocation(reprojectProgram, "sourceLayer"),
			sourceWidth: gl.getUniformLocation(reprojectProgram, "sourceWidth"),
			sourceHeight: gl.getUniformLocation(reprojectProgram, "sourceHeight"),
			rawValueToMeters: gl.getUniformLocation(reprojectProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(reprojectProgram, "depthNearZ"),
			sourceEncodingMode: gl.getUniformLocation(reprojectProgram, "sourceEncodingMode"),
			pointSize: gl.getUniformLocation(reprojectProgram, "pointSize"),
			sourceViewUvTransform: gl.getUniformLocation(reprojectProgram, "sourceViewUvTransform"),
			sourceProjectionParams: gl.getUniformLocation(reprojectProgram, "sourceProjectionParams"),
			sourceWorldFromView: gl.getUniformLocation(reprojectProgram, "sourceWorldFromView"),
			targetViewMatrix: gl.getUniformLocation(reprojectProgram, "targetViewMatrix"),
			targetProjMatrix: gl.getUniformLocation(reprojectProgram, "targetProjMatrix")
		};
	};

	const reprojectDepth = function(kindKey, sourceTexture, useArraySourceBool, sourceLayer, sourceEncodingMode, depthProfile, depthInfo, sourceWidth, sourceHeight, targetWidth, targetHeight, reprojectionState, targetProjMatrix) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		const depthTargetBool = kindKey !== "mask";
		const basePointSize = Math.max(1, Math.min(3, Math.sqrt((Math.max(1, targetWidth | 0) * Math.max(1, targetHeight | 0)) / (Math.max(1, sourceWidth | 0) * Math.max(1, sourceHeight | 0)))));
		if (
			!sourceTexture ||
			!reprojectionState ||
			!reprojectionState.enabledBool ||
			!reprojectionState.sourceProjectionParams ||
			!reprojectionState.sourceWorldFromViewMatrix ||
			!reprojectionState.targetViewMatrix ||
			!targetProjMatrix ||
			!ensureReprojectResources(kindKey, targetWidth, targetHeight)
		) {
			return null;
		}
		ensureReprojectProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, depthTargetBool ? depthReprojectFramebuffer : maskReprojectFramebuffer);
		gl.viewport(0, 0, depthTargetBool ? depthReprojectWidth : maskReprojectWidth, depthTargetBool ? depthReprojectHeight : maskReprojectHeight);
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
		gl.uniform1i(reprojectLocs.sourceWidth, Math.max(1, sourceWidth | 0));
		gl.uniform1i(reprojectLocs.sourceHeight, Math.max(1, sourceHeight | 0));
		gl.uniform1f(reprojectLocs.rawValueToMeters, depthProfile && depthProfile.linearScale != null ? depthProfile.linearScale : 0.001);
		gl.uniform1f(reprojectLocs.depthNearZ, depthProfile && depthProfile.nearZ != null ? depthProfile.nearZ : 0);
		gl.uniform1f(reprojectLocs.sourceEncodingMode, sourceEncodingMode != null ? sourceEncodingMode : DEPTH_ENCODING_SOURCE_RAW);
		gl.uniform1f(reprojectLocs.pointSize, depthTargetBool ? basePointSize : Math.max(2, Math.min(3.5, basePointSize * 2)));
		sourceViewUvTransform.set(depthInfo && depthInfo.normViewFromNormDepthBufferMatrix ? depthInfo.normViewFromNormDepthBufferMatrix : identityMatrix4);
		gl.uniformMatrix4fv(reprojectLocs.sourceViewUvTransform, false, sourceViewUvTransform);
		gl.uniform4f(reprojectLocs.sourceProjectionParams, reprojectionState.sourceProjectionParams.xScale, reprojectionState.sourceProjectionParams.yScale, reprojectionState.sourceProjectionParams.xOffset, reprojectionState.sourceProjectionParams.yOffset);
		gl.uniformMatrix4fv(reprojectLocs.sourceWorldFromView, false, reprojectionState.sourceWorldFromViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.targetViewMatrix, false, reprojectionState.targetViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.targetProjMatrix, false, targetProjMatrix);
		gl.drawArrays(gl.POINTS, 0, Math.max(1, sourceWidth | 0) * Math.max(1, sourceHeight | 0));
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return depthTargetBool ? depthReprojectTexture : maskReprojectTexture;
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

	const ensureMaskResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (maskTexture && maskFramebuffer && maskWidth === safeWidth && maskHeight === safeHeight) {
			return true;
		}
		maskWidth = safeWidth;
		maskHeight = safeHeight;
		if (!maskTexture) {
			maskTexture = gl.createTexture();
		}
		if (!maskFramebuffer) {
			maskFramebuffer = gl.createFramebuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, maskTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, maskWidth, maskHeight, 0, gl.RED, gl.UNSIGNED_BYTE, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, maskFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, maskTexture, 0);
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

	const ensureMaskProgram = function() {
		if (maskProgram) {
			return;
		}
		maskProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D packedDepthTexture;",
			"uniform float depthMode;",
			"uniform float depthThreshold;",
			"uniform float depthFade;",
			"uniform float depthEchoWavelength;",
			"uniform float depthEchoDutyCycle;",
			"uniform float depthEchoFade;",
			"uniform float depthPhaseOffset;",
			"uniform float radialMetric;",
			"uniform float maskRadiusPx;",
			"out vec4 fragColor;",
			createDepthBandMaskShaderChunk("computeDepthMask"),
			"float sampleMetricDepth(vec3 viewPoint){",
			"float planarDepth=max(0.0,-viewPoint.z);",
			"return radialMetric>0.5?length(viewPoint):planarDepth;",
			"}",
			"void main(){",
			"ivec2 textureSizeI=textureSize(packedDepthTexture,0);",
			"ivec2 centerTexel=clamp(ivec2(gl_FragCoord.xy),ivec2(0),textureSizeI-ivec2(1));",
			"float visibility=0.0;",
			"float weightSum=0.0;",
			"float safeRadius=max(maskRadiusPx,1.0);",
			"float radiusSq=safeRadius*safeRadius;",
			"for(int iy=-3;iy<=3;iy+=1){",
			"for(int ix=-3;ix<=3;ix+=1){",
			"ivec2 sampleTexel=clamp(centerTexel+ivec2(ix,iy),ivec2(0),textureSizeI-ivec2(1));",
			"float distSq=float(ix*ix+iy*iy);",
			"if(distSq>radiusSq){continue;}",
			"vec4 packed=texelFetch(packedDepthTexture,sampleTexel,0);",
			"float sampleCoverage=packed.a;",
			"if(sampleCoverage<=0.0001){continue;}",
			"float depthMeters=sampleMetricDepth(packed.xyz);",
			"if(depthMeters<=0.0001){continue;}",
			"float weight=(sampleCoverage/(1.0+distSq));",
			"visibility+=computeDepthMask(depthMeters)*weight;",
			"weightSum+=weight;",
			"}",
			"}",
			"visibility=weightSum>0.0001?visibility/weightSum:0.0;",
			"visibility=smoothstep(0.18,0.82,visibility);",
			"fragColor=vec4(visibility,visibility,visibility,1.0);",
			"}"
		].join(""), "Depth mask");
		maskLocs = {
			position: gl.getAttribLocation(maskProgram, "position"),
			packedDepthTexture: gl.getUniformLocation(maskProgram, "packedDepthTexture"),
			depthMode: gl.getUniformLocation(maskProgram, "depthMode"),
			depthThreshold: gl.getUniformLocation(maskProgram, "depthThreshold"),
			depthFade: gl.getUniformLocation(maskProgram, "depthFade"),
			depthEchoWavelength: gl.getUniformLocation(maskProgram, "depthEchoWavelength"),
			depthEchoDutyCycle: gl.getUniformLocation(maskProgram, "depthEchoDutyCycle"),
			depthEchoFade: gl.getUniformLocation(maskProgram, "depthEchoFade"),
			depthPhaseOffset: gl.getUniformLocation(maskProgram, "depthPhaseOffset"),
			radialMetric: gl.getUniformLocation(maskProgram, "radialMetric"),
			maskRadiusPx: gl.getUniformLocation(maskProgram, "maskRadiusPx")
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
		gl.uniformMatrix4fv(finalLocs.targetWorldFromView, false, targetWorldFromViewMatrix || identityMatrix4);
		gl.uniform1f(finalLocs.radialMetric, getDepthMetricMode(processingConfig) === DEPTH_METRIC_MODE_RADIAL ? 1 : 0);
		bindFullscreenTriangle(finalLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return finalTexture;
	};

	const buildMaskField = function(packedDepthTexture, sourceWidth, sourceHeight, fieldWidth, fieldHeight, consumerWidth, consumerHeight, processingConfig) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (!packedDepthTexture || !ensureMaskResources(fieldWidth, fieldHeight)) {
			return null;
		}
		ensureMaskProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, maskFramebuffer);
		gl.viewport(0, 0, maskWidth, maskHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(maskProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, packedDepthTexture);
		gl.uniform1i(maskLocs.packedDepthTexture, 0);
		gl.uniform1f(maskLocs.depthMode, processingConfig && processingConfig.depthMode != null ? processingConfig.depthMode : 0);
		gl.uniform1f(maskLocs.depthThreshold, processingConfig && processingConfig.depthThreshold != null ? processingConfig.depthThreshold : 0);
		gl.uniform1f(maskLocs.depthFade, processingConfig && processingConfig.depthFade != null ? processingConfig.depthFade : 0);
		gl.uniform1f(maskLocs.depthEchoWavelength, processingConfig && processingConfig.depthEchoWavelength != null ? processingConfig.depthEchoWavelength : 1);
		gl.uniform1f(maskLocs.depthEchoDutyCycle, processingConfig && processingConfig.depthEchoDutyCycle != null ? processingConfig.depthEchoDutyCycle : 0.5);
		gl.uniform1f(maskLocs.depthEchoFade, processingConfig && processingConfig.depthEchoFade != null ? processingConfig.depthEchoFade : 0);
		gl.uniform1f(maskLocs.depthPhaseOffset, processingConfig && processingConfig.depthPhaseOffset != null ? processingConfig.depthPhaseOffset : 0);
		gl.uniform1f(maskLocs.radialMetric, getDepthMetricMode(processingConfig) === DEPTH_METRIC_MODE_RADIAL ? 1 : 0);
		gl.uniform1f(maskLocs.maskRadiusPx, Math.max(2, Math.min(3, Math.sqrt((Math.max(1, consumerWidth | 0) * Math.max(1, consumerHeight | 0)) / (Math.max(1, sourceWidth | 0) * Math.max(1, sourceHeight | 0))))));
		bindFullscreenTriangle(maskLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return maskTexture;
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

			const consumerSize = resolveViewportSize(args || null, depthInfo.width, depthInfo.height);
			const reprojectedTexture = reprojectDepth(
				"depth",
				sourceTexture,
				useArraySourceBool,
				depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0),
				sourceEncodingMode,
				depthProfile,
				depthInfo,
				depthInfo.width,
				depthInfo.height,
				consumerSize.width,
				consumerSize.height,
				reprojectionState,
				args && args.targetProjMatrix ? args.targetProjMatrix : null
			);
			if (!reprojectedTexture) {
				return null;
			}

			const finalDepthTexture = buildFinalDepth(
				reprojectedTexture,
				consumerSize.width,
				consumerSize.height,
				consumerSize.width,
				consumerSize.height,
				reprojectionState.targetWorldFromViewMatrix,
				args && args.processingConfig ? args.processingConfig : null
			);
			if (!finalDepthTexture) {
				return null;
			}
			const maskReprojectedTexture = reprojectDepth(
				"mask",
				sourceTexture,
				useArraySourceBool,
				depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0),
				sourceEncodingMode,
				depthProfile,
				depthInfo,
				depthInfo.width,
				depthInfo.height,
				depthInfo.width,
				depthInfo.height,
				reprojectionState,
				args && args.targetProjMatrix ? args.targetProjMatrix : null
			);
			if (!maskReprojectedTexture) {
				return null;
			}
			const finalMaskTexture = buildMaskField(
				maskReprojectedTexture,
				depthInfo.width,
				depthInfo.height,
				depthInfo.width,
				depthInfo.height,
				consumerSize.width,
				consumerSize.height,
				args && args.processingConfig ? args.processingConfig : null
			);

			return {
				texture: finalDepthTexture,
				maskTexture: finalMaskTexture,
				maskWidth: maskWidth,
				maskHeight: maskHeight,
				width: consumerSize.width,
				height: consumerSize.height,
				depthEncodingMode: DEPTH_ENCODING_LINEAR_VIEW_Z,
				worldPointAvailableBool: true
			};
		}
	};
};
