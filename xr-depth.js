// Depth processing stays centralized here.
// The pipeline is fixed: canonicalize source depth, inverse reproject once, reconstruct once, then classify once.
// Consumers read one shared high-resolution field plus one centralized mask product derived from it.

const DEPTH_ENCODING_SOURCE_RAW = 0;
const DEPTH_ENCODING_LINEAR_VIEW_Z = 1;
const DEPTH_METRIC_MODE_PLANAR = "planar";
const DEPTH_METRIC_MODE_RADIAL = "radial";
const DEPTH_RECONSTRUCTION_SPATIAL_SIGMA = 1.35;
const DEPTH_RECONSTRUCTION_DEPTH_SIGMA_SCALE = 0.08;
const DEPTH_RECONSTRUCTION_DEPTH_SIGMA_MIN = 0.05;
const DEPTH_RECONSTRUCTION_DEPTH_CUTOFF_SCALE = 2.0;
const DEPTH_RECONSTRUCTION_KERNEL_RADIUS = 2;
const DEPTH_VISIBILITY_COVERAGE_THRESHOLD = 0.35;

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
	const sourceDepthUvTransform = new Float32Array(16);

	let canonicalProgram = null;
	let canonicalLocs = null;
	let canonicalTexture = null;
	let canonicalFramebuffer = null;
	let canonicalWidth = 0;
	let canonicalHeight = 0;

	let reprojectProgram = null;
	let reprojectLocs = null;
	let depthReprojectTexture = null;
	let depthReprojectFramebuffer = null;
	let depthReprojectDepthBuffer = null;
	let depthReprojectWidth = 0;
	let depthReprojectHeight = 0;

let finalProgram = null;
let finalLocs = null;
let finalTexture = null;
let finalCoverageTexture = null;
let finalFramebuffer = null;
let finalWidth = 0;
let finalHeight = 0;

let visibilityProgram = null;
let visibilityLocs = null;
let visibilityTexture = null;
let visibilityFramebuffer = null;
let visibilityWidth = 0;
let visibilityHeight = 0;

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

	const uploadCpuDepth = function(depthInfo, rawValueToMeters) {
		const width = Math.max(1, depthInfo.width | 0);
		const height = Math.max(1, depthInfo.height | 0);
		const pixelCount = width * height;
		const sourceData = depthInfo.data instanceof Uint16Array ? depthInfo.data : new Uint16Array(depthInfo.data);
		const linearScale = rawValueToMeters || depthInfo.rawValueToMeters || 0.001;
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

	const resolveDepthDecodeParams = function(depthSourcePacket, sourceEncodingMode) {
		if (sourceEncodingMode === DEPTH_ENCODING_LINEAR_VIEW_Z) {
			return {linearScale: 1, nearZ: 0};
		}
		const rawValueToMeters = depthSourcePacket && depthSourcePacket.rawValueToMeters ? depthSourcePacket.rawValueToMeters : 0.001;
		if (rawValueToMeters >= 1) {
			return {linearScale: 0, nearZ: 0.1};
		}
		if (depthSourcePacket && depthSourcePacket.depthDataFormat === "unsigned-short") {
			return {linearScale: rawValueToMeters * 65535, nearZ: 0};
		}
		return {linearScale: rawValueToMeters, nearZ: 0};
	};

	const ensureCanonicalResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (canonicalTexture && canonicalFramebuffer && canonicalWidth === safeWidth && canonicalHeight === safeHeight) {
			return true;
		}
		canonicalWidth = safeWidth;
		canonicalHeight = safeHeight;
		if (!canonicalTexture) {
			canonicalTexture = gl.createTexture();
		}
		if (!canonicalFramebuffer) {
			canonicalFramebuffer = gl.createFramebuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, canonicalTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, floatTargetConfig.internalFormat, safeWidth, safeHeight, 0, floatTargetConfig.format, floatTargetConfig.type, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, canonicalFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, canonicalTexture, 0);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};

	const ensureReprojectResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (depthReprojectTexture && depthReprojectFramebuffer && depthReprojectDepthBuffer && depthReprojectWidth === safeWidth && depthReprojectHeight === safeHeight) {
			return true;
		}
		depthReprojectWidth = safeWidth;
		depthReprojectHeight = safeHeight;
		if (!depthReprojectTexture) {
			depthReprojectTexture = gl.createTexture();
		}
		if (!depthReprojectFramebuffer) {
			depthReprojectFramebuffer = gl.createFramebuffer();
		}
		if (!depthReprojectDepthBuffer) {
			depthReprojectDepthBuffer = gl.createRenderbuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, depthReprojectTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, floatTargetConfig.internalFormat, safeWidth, safeHeight, 0, floatTargetConfig.format, floatTargetConfig.type, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, depthReprojectDepthBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, safeWidth, safeHeight);
		gl.bindFramebuffer(gl.FRAMEBUFFER, depthReprojectFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, depthReprojectTexture, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthReprojectDepthBuffer);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};

	const ensureFinalResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (finalTexture && finalCoverageTexture && finalFramebuffer && finalWidth === safeWidth && finalHeight === safeHeight) {
			return true;
		}
		finalWidth = safeWidth;
		finalHeight = safeHeight;
		if (!finalTexture) {
			finalTexture = gl.createTexture();
		}
		if (!finalCoverageTexture) {
			finalCoverageTexture = gl.createTexture();
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
		gl.bindTexture(gl.TEXTURE_2D, finalCoverageTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, floatTargetConfig.internalFormat, finalWidth, finalHeight, 0, floatTargetConfig.format, floatTargetConfig.type, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, finalFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, finalTexture, 0);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, finalCoverageTexture, 0);
		gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};

	const ensureVisibilityResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (visibilityTexture && visibilityFramebuffer && visibilityWidth === safeWidth && visibilityHeight === safeHeight) {
			return true;
		}
		visibilityWidth = safeWidth;
		visibilityHeight = safeHeight;
		if (!visibilityTexture) {
			visibilityTexture = gl.createTexture();
		}
		if (!visibilityFramebuffer) {
			visibilityFramebuffer = gl.createFramebuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, visibilityTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, visibilityWidth, visibilityHeight, 0, gl.RED, gl.UNSIGNED_BYTE, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, visibilityFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, visibilityTexture, 0);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};

	const ensureCanonicalProgram = function() {
		if (canonicalProgram) {
			return;
		}
		canonicalProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"precision highp sampler2D;",
			"precision mediump sampler2DArray;",
			"uniform sampler2D sourceTexture2D;",
			"uniform sampler2DArray sourceTextureArray;",
			"uniform float useArraySource;",
			"uniform int sourceLayer;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform float sourceEncodingMode;",
			"uniform mat4 sourceDepthUvTransform;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			"float sampleRawDepth(vec2 uv){",
			"if(useArraySource>0.5){return texture(sourceTextureArray,vec3(uv,float(sourceLayer))).r;}",
			"return texture(sourceTexture2D,uv).r;",
			"}",
			"float decodeDepth(float rawDepth){",
			"if(rawDepth<=0.0001){return 0.0;}",
			"if(sourceEncodingMode>0.5){return rawDepth;}",
			"if(depthNearZ>0.0){return depthNearZ/max(1.0-rawDepth,0.0001);}",
			"return rawDepth*rawValueToMeters;",
			"}",
			"void main(){",
			"vec2 sourceDepthUv=(sourceDepthUvTransform*vec4(vScreenUv,0.0,1.0)).xy;",
			"if(sourceDepthUv.x<0.0||sourceDepthUv.x>1.0||sourceDepthUv.y<0.0||sourceDepthUv.y>1.0){fragColor=vec4(0.0);return;}",
			"float depthMeters=decodeDepth(sampleRawDepth(sourceDepthUv));",
			"fragColor=vec4(depthMeters,0.0,0.0,1.0);",
			"}"
		].join(""), "Depth canonicalize");
		canonicalLocs = {
			position: gl.getAttribLocation(canonicalProgram, "position"),
			sourceTexture2D: gl.getUniformLocation(canonicalProgram, "sourceTexture2D"),
			sourceTextureArray: gl.getUniformLocation(canonicalProgram, "sourceTextureArray"),
			useArraySource: gl.getUniformLocation(canonicalProgram, "useArraySource"),
			sourceLayer: gl.getUniformLocation(canonicalProgram, "sourceLayer"),
			rawValueToMeters: gl.getUniformLocation(canonicalProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(canonicalProgram, "depthNearZ"),
			sourceEncodingMode: gl.getUniformLocation(canonicalProgram, "sourceEncodingMode"),
			sourceDepthUvTransform: gl.getUniformLocation(canonicalProgram, "sourceDepthUvTransform")
		};
	};

	const canonicalizeDepth = function(depthSourcePacket) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		const depthInfo = depthSourcePacket && depthSourcePacket.depthInfo ? depthSourcePacket.depthInfo : null;
		let sourceTexture = null;
		let useArraySourceBool = false;
		let sourceEncodingMode = DEPTH_ENCODING_SOURCE_RAW;
		if (!depthInfo || depthInfo.isValid === false || !depthInfo.width || !depthInfo.height) {
			return null;
		}
		sourceTexture = depthInfo.texture || null;
		useArraySourceBool = depthSourcePacket.textureType === "texture-array";
		sourceEncodingMode = depthInfo.depthEncodingMode != null ? depthInfo.depthEncodingMode : DEPTH_ENCODING_SOURCE_RAW;
		if (!sourceTexture && depthInfo.data && depthInfo.width && depthInfo.height) {
			sourceTexture = uploadCpuDepth(depthInfo, depthSourcePacket.rawValueToMeters);
			useArraySourceBool = false;
			sourceEncodingMode = DEPTH_ENCODING_LINEAR_VIEW_Z;
		}
		if (!sourceTexture || !ensureCanonicalResources(depthInfo.width, depthInfo.height)) {
			return null;
		}
		ensureCanonicalProgram();
		const decodeParams = resolveDepthDecodeParams(depthSourcePacket, sourceEncodingMode);
		gl.bindFramebuffer(gl.FRAMEBUFFER, canonicalFramebuffer);
		gl.viewport(0, 0, canonicalWidth, canonicalHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(canonicalProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, useArraySourceBool ? null : sourceTexture);
		gl.uniform1i(canonicalLocs.sourceTexture2D, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D_ARRAY, useArraySourceBool ? sourceTexture : null);
		gl.uniform1i(canonicalLocs.sourceTextureArray, 1);
		gl.uniform1f(canonicalLocs.useArraySource, useArraySourceBool ? 1 : 0);
		gl.uniform1i(canonicalLocs.sourceLayer, (depthSourcePacket.imageIndex != null ? depthSourcePacket.imageIndex : (depthSourcePacket.textureLayer || 0)) | 0);
		gl.uniform1f(canonicalLocs.rawValueToMeters, decodeParams.linearScale);
		gl.uniform1f(canonicalLocs.depthNearZ, decodeParams.nearZ);
		gl.uniform1f(canonicalLocs.sourceEncodingMode, sourceEncodingMode);
		sourceDepthUvTransform.set(depthSourcePacket.normDepthBufferFromNormView ? (depthSourcePacket.normDepthBufferFromNormView.matrix || depthSourcePacket.normDepthBufferFromNormView) : identityMatrix4);
		gl.uniformMatrix4fv(canonicalLocs.sourceDepthUvTransform, false, sourceDepthUvTransform);
		bindFullscreenTriangle(canonicalLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return {
			texture: canonicalTexture,
			width: canonicalWidth,
			height: canonicalHeight
		};
	};

	const ensureReprojectProgram = function() {
		if (reprojectProgram) {
			return;
		}
		reprojectProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"precision highp sampler2D;",
			"uniform sampler2D canonicalDepthTexture;",
			"uniform vec4 sourceProjectionParams;",
			"uniform vec4 targetProjectionParams;",
			"uniform mat4 sourceWorldFromView;",
			"uniform mat4 sourceViewMatrix;",
			"uniform mat4 targetWorldFromView;",
			"uniform mat4 targetViewMatrix;",
			"uniform mat4 targetProjMatrix;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			"void main(){",
			"vec2 renderNdc=vScreenUv*2.0-1.0;",
			"vec2 renderRay=vec2((renderNdc.x+targetProjectionParams.z)/targetProjectionParams.x,(renderNdc.y+targetProjectionParams.w)/targetProjectionParams.y);",
			"vec3 seedTargetViewPoint=vec3(renderRay*1.5,-1.5);",
			"vec4 seedWorldPoint=targetWorldFromView*vec4(seedTargetViewPoint,1.0);",
			"vec4 seedSourceViewPoint=sourceViewMatrix*seedWorldPoint;",
			"if(-seedSourceViewPoint.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){discard;}",
			"float invSourceZ=1.0/max(-seedSourceViewPoint.z,0.0001);",
			"vec2 sourceNdc=vec2(",
			"seedSourceViewPoint.x*invSourceZ*sourceProjectionParams.x-sourceProjectionParams.z,",
			"seedSourceViewPoint.y*invSourceZ*sourceProjectionParams.y-sourceProjectionParams.w);",
			"vec2 sourceViewUv=sourceNdc*0.5+0.5;",
			"if(sourceViewUv.x<0.0||sourceViewUv.x>1.0||sourceViewUv.y<0.0||sourceViewUv.y>1.0){discard;}",
			"float sourceDepth=texture(canonicalDepthTexture,sourceViewUv).r;",
			"if(sourceDepth<=0.0001){discard;}",
			"vec3 sourceRay=vec3(seedSourceViewPoint.xy*invSourceZ,-1.0);",
			"vec3 actualSourceViewPoint=sourceRay*sourceDepth;",
			"vec4 actualWorldPoint=sourceWorldFromView*vec4(actualSourceViewPoint,1.0);",
			"vec4 actualTargetViewPoint=targetViewMatrix*actualWorldPoint;",
			"if(-actualTargetViewPoint.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){discard;}",
			"vec4 clip=targetProjMatrix*actualTargetViewPoint;",
			"float clipW=max(clip.w,0.0001);",
			"if(abs(clip.x)>clipW*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "||abs(clip.y)>clipW*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "){discard;}",
			"gl_FragDepth=clamp(clip.z/clipW*0.5+0.5,0.0,1.0);",
			"fragColor=vec4(actualTargetViewPoint.xyz,1.0);",
			"}"
		].join(""), "Depth reproject");
		reprojectLocs = {
			position: gl.getAttribLocation(reprojectProgram, "position"),
			canonicalDepthTexture: gl.getUniformLocation(reprojectProgram, "canonicalDepthTexture"),
			sourceProjectionParams: gl.getUniformLocation(reprojectProgram, "sourceProjectionParams"),
			targetProjectionParams: gl.getUniformLocation(reprojectProgram, "targetProjectionParams"),
			sourceWorldFromView: gl.getUniformLocation(reprojectProgram, "sourceWorldFromView"),
			sourceViewMatrix: gl.getUniformLocation(reprojectProgram, "sourceViewMatrix"),
			targetWorldFromView: gl.getUniformLocation(reprojectProgram, "targetWorldFromView"),
			targetViewMatrix: gl.getUniformLocation(reprojectProgram, "targetViewMatrix"),
			targetProjMatrix: gl.getUniformLocation(reprojectProgram, "targetProjMatrix")
		};
	};

	const reprojectDepth = function(canonicalDepthState, depthSourcePacket) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (
			!canonicalDepthState ||
			!canonicalDepthState.texture ||
			!depthSourcePacket ||
			!depthSourcePacket.sourceProjectionParams ||
			!depthSourcePacket.sourceViewMatrix ||
			!depthSourcePacket.sourceWorldFromViewMatrix ||
			!depthSourcePacket.targetProjectionParams ||
			!depthSourcePacket.targetWorldFromViewMatrix ||
			!depthSourcePacket.targetViewMatrix ||
			!depthSourcePacket.targetProjMatrix ||
			!ensureReprojectResources(canonicalDepthState.width, canonicalDepthState.height)
		) {
			return null;
		}
		ensureReprojectProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, depthReprojectFramebuffer);
		gl.viewport(0, 0, depthReprojectWidth, depthReprojectHeight);
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
		gl.bindTexture(gl.TEXTURE_2D, canonicalDepthState.texture);
		gl.uniform1i(reprojectLocs.canonicalDepthTexture, 0);
		gl.uniform4f(reprojectLocs.sourceProjectionParams, depthSourcePacket.sourceProjectionParams.xScale, depthSourcePacket.sourceProjectionParams.yScale, depthSourcePacket.sourceProjectionParams.xOffset, depthSourcePacket.sourceProjectionParams.yOffset);
		gl.uniform4f(reprojectLocs.targetProjectionParams, depthSourcePacket.targetProjectionParams.xScale, depthSourcePacket.targetProjectionParams.yScale, depthSourcePacket.targetProjectionParams.xOffset, depthSourcePacket.targetProjectionParams.yOffset);
		gl.uniformMatrix4fv(reprojectLocs.sourceWorldFromView, false, depthSourcePacket.sourceWorldFromViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.sourceViewMatrix, false, depthSourcePacket.sourceViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.targetWorldFromView, false, depthSourcePacket.targetWorldFromViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.targetViewMatrix, false, depthSourcePacket.targetViewMatrix);
		gl.uniformMatrix4fv(reprojectLocs.targetProjMatrix, false, depthSourcePacket.targetProjMatrix);
		bindFullscreenTriangle(reprojectLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return {
			fieldTexture: depthReprojectTexture,
			width: depthReprojectWidth,
			height: depthReprojectHeight,
			validityInAlphaBool: true
		};
	};

	const ensureFinalProgram = function() {
		if (finalProgram) {
			return;
		}
		finalProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D lowResDepthField;",
			"uniform vec2 lowResTextureSize;",
			"uniform mat4 targetWorldFromView;",
			"uniform vec3 metricOriginWorld;",
			"uniform float radialMetric;",
			"in vec2 vScreenUv;",
			"layout(location=0) out vec4 fragFieldColor;",
			"layout(location=1) out vec4 fragCoverageColor;",
			"vec4 sampleLowRes(ivec2 texel){",
			"ivec2 safeTexel=clamp(texel,ivec2(0),ivec2(lowResTextureSize)-ivec2(1));",
			"return texelFetch(lowResDepthField,safeTexel,0);",
			"}",
			"float planarDepth(vec4 packed){",
			"return max(0.0,-packed.z);",
			"}",
			"bool hasValidDepth(vec4 packed,float depthValue){",
			"return packed.a>0.0001&&depthValue>0.0001;",
			"}",
			"void main(){",
			"vec2 samplePos=vScreenUv*lowResTextureSize-vec2(0.5);",
			"vec2 sampleCenter=samplePos+vec2(0.5);",
			"ivec2 baseTexel=ivec2(floor(samplePos));",
			"ivec2 anchorTexel=ivec2(floor(samplePos+vec2(0.5)));",
			"vec2 fracUv=fract(samplePos);",
			"float refDepth=0.0;",
			"float refWeightSum=0.0;",
			"for(int iy=0;iy<=1;iy+=1){",
			"for(int ix=0;ix<=1;ix+=1){",
			"ivec2 sampleTexel=baseTexel+ivec2(ix,iy);",
			"vec4 candidate=sampleLowRes(sampleTexel);",
			"float candidateDepth=planarDepth(candidate);",
			"if(!hasValidDepth(candidate,candidateDepth)){continue;}",
			"float wx=ix==0?1.0-fracUv.x:fracUv.x;",
			"float wy=iy==0?1.0-fracUv.y:fracUv.y;",
			"float sampleWeight=max(wx*wy,0.0001);",
			"refDepth+=candidateDepth*sampleWeight;",
			"refWeightSum+=sampleWeight;",
			"}",
			"}",
			"if(refWeightSum>0.0001){",
			"refDepth/=refWeightSum;",
			"}else{",
			"float closestDistanceSq=1e20;",
			"for(int iy=-" + DEPTH_RECONSTRUCTION_KERNEL_RADIUS + ";iy<=" + DEPTH_RECONSTRUCTION_KERNEL_RADIUS + ";iy+=1){",
			"for(int ix=-" + DEPTH_RECONSTRUCTION_KERNEL_RADIUS + ";ix<=" + DEPTH_RECONSTRUCTION_KERNEL_RADIUS + ";ix+=1){",
			"ivec2 sampleTexel=anchorTexel+ivec2(ix,iy);",
			"vec4 candidate=sampleLowRes(sampleTexel);",
			"float candidateDepth=planarDepth(candidate);",
			"if(!hasValidDepth(candidate,candidateDepth)){continue;}",
			"vec2 delta=(vec2(sampleTexel)+vec2(0.5))-sampleCenter;",
			"float distanceSq=dot(delta,delta);",
			"if(distanceSq<closestDistanceSq){closestDistanceSq=distanceSq;refDepth=candidateDepth;}",
			"}",
			"}",
			"}",
			"if(refDepth<=0.0001){fragFieldColor=vec4(0.0);fragCoverageColor=vec4(0.0);return;}",
			"float idealWeightSum=0.0;",
			"float sigma=max(" + DEPTH_RECONSTRUCTION_DEPTH_SIGMA_MIN.toFixed(3) + ",refDepth*" + DEPTH_RECONSTRUCTION_DEPTH_SIGMA_SCALE.toFixed(3) + ");",
			"float cutoff=sigma*" + DEPTH_RECONSTRUCTION_DEPTH_CUTOFF_SCALE.toFixed(3) + ";",
			"float invTwoSigmaSq=1.0/(2.0*sigma*sigma);",
			"float invTwoSpatialSigmaSq=1.0/(2.0*" + (DEPTH_RECONSTRUCTION_SPATIAL_SIGMA * DEPTH_RECONSTRUCTION_SPATIAL_SIGMA).toFixed(3) + ");",
			"vec3 weightedViewPoint=vec3(0.0);",
			"float weightSum=0.0;",
			"for(int iy=-" + DEPTH_RECONSTRUCTION_KERNEL_RADIUS + ";iy<=" + DEPTH_RECONSTRUCTION_KERNEL_RADIUS + ";iy+=1){",
			"for(int ix=-" + DEPTH_RECONSTRUCTION_KERNEL_RADIUS + ";ix<=" + DEPTH_RECONSTRUCTION_KERNEL_RADIUS + ";ix+=1){",
			"ivec2 sampleTexel=anchorTexel+ivec2(ix,iy);",
			"vec2 delta=(vec2(sampleTexel)+vec2(0.5))-sampleCenter;",
			"float spatialWeight=exp(-dot(delta,delta)*invTwoSpatialSigmaSq);",
			"idealWeightSum+=spatialWeight;",
			"vec4 packed=sampleLowRes(sampleTexel);",
			"float depthValue=planarDepth(packed);",
			"if(!hasValidDepth(packed,depthValue)){continue;}",
			"if(abs(depthValue-refDepth)>cutoff){continue;}",
			"float depthWeight=exp(-(depthValue-refDepth)*(depthValue-refDepth)*invTwoSigmaSq);",
			"float weight=spatialWeight*depthWeight;",
			"weightedViewPoint+=packed.xyz*weight;",
			"weightSum+=weight;",
			"}",
			"}",
			"if(weightSum<=0.0001){fragFieldColor=vec4(0.0);fragCoverageColor=vec4(0.0);return;}",
			"vec3 filteredViewPoint=weightedViewPoint/weightSum;",
			"float finalPlanarDepth=max(0.0,-filteredViewPoint.z);",
			"vec3 filteredWorldPoint=(targetWorldFromView*vec4(filteredViewPoint,1.0)).xyz;",
			"float radialDepth=distance(filteredWorldPoint,metricOriginWorld);",
			"float finalDepth=radialMetric>0.5?radialDepth:finalPlanarDepth;",
			"float coverage=idealWeightSum>0.0001?clamp(weightSum/idealWeightSum,0.0,1.0):0.0;",
			"fragFieldColor=vec4(finalDepth,filteredWorldPoint);",
			"fragCoverageColor=vec4(coverage,0.0,0.0,1.0);",
			"}"
		].join(""), "Depth finalize");
		finalLocs = {
			position: gl.getAttribLocation(finalProgram, "position"),
			lowResDepthField: gl.getUniformLocation(finalProgram, "lowResDepthField"),
			lowResTextureSize: gl.getUniformLocation(finalProgram, "lowResTextureSize"),
			targetWorldFromView: gl.getUniformLocation(finalProgram, "targetWorldFromView"),
			metricOriginWorld: gl.getUniformLocation(finalProgram, "metricOriginWorld"),
			radialMetric: gl.getUniformLocation(finalProgram, "radialMetric")
		};
	};

	const buildHighResField = function(reprojectedState, targetWidth, targetHeight, depthSourcePacket, processingConfig) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (!reprojectedState || !reprojectedState.fieldTexture || !ensureFinalResources(targetWidth, targetHeight)) {
			return null;
		}
		ensureFinalProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, finalFramebuffer);
		gl.viewport(0, 0, finalWidth, finalHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
		gl.useProgram(finalProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, reprojectedState.fieldTexture);
		gl.uniform1i(finalLocs.lowResDepthField, 0);
		gl.uniform2f(finalLocs.lowResTextureSize, reprojectedState.width, reprojectedState.height);
		gl.uniformMatrix4fv(finalLocs.targetWorldFromView, false, depthSourcePacket && depthSourcePacket.targetWorldFromViewMatrix ? depthSourcePacket.targetWorldFromViewMatrix : identityMatrix4);
		if (depthSourcePacket && depthSourcePacket.metricOriginWorld) {
			gl.uniform3f(finalLocs.metricOriginWorld, depthSourcePacket.metricOriginWorld[12] || 0, depthSourcePacket.metricOriginWorld[13] || 0, depthSourcePacket.metricOriginWorld[14] || 0);
		} else {
			gl.uniform3f(finalLocs.metricOriginWorld, 0, 0, 0);
		}
		gl.uniform1f(finalLocs.radialMetric, getDepthMetricMode(processingConfig) === DEPTH_METRIC_MODE_RADIAL ? 1 : 0);
		bindFullscreenTriangle(finalLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return {
			fieldTexture: finalTexture,
			coverageTexture: finalCoverageTexture,
			width: finalWidth,
			height: finalHeight
		};
	};

	const ensureVisibilityProgram = function() {
		if (visibilityProgram) {
			return;
		}
		visibilityProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D fieldTexture;",
			"uniform sampler2D coverageTexture;",
			"uniform float minCoverage;",
			"uniform float depthMode;",
			"uniform float depthThreshold;",
			"uniform float depthFade;",
			"uniform float depthEchoWavelength;",
			"uniform float depthEchoDutyCycle;",
			"uniform float depthEchoFade;",
			"uniform float depthPhaseOffset;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			createDepthBandMaskShaderChunk("computeDepthMask"),
			"void main(){",
			"float depthMeters=texture(fieldTexture,vScreenUv).r;",
			"float coverage=texture(coverageTexture,vScreenUv).r;",
			"if(coverage<minCoverage||depthMeters<=0.0001){fragColor=vec4(0.0);return;}",
			"float visibility=computeDepthMask(depthMeters);",
			"fragColor=vec4(visibility,visibility,visibility,1.0);",
			"}"
		].join(""), "Depth visibility");
		visibilityLocs = {
			position: gl.getAttribLocation(visibilityProgram, "position"),
			fieldTexture: gl.getUniformLocation(visibilityProgram, "fieldTexture"),
			coverageTexture: gl.getUniformLocation(visibilityProgram, "coverageTexture"),
			minCoverage: gl.getUniformLocation(visibilityProgram, "minCoverage"),
			depthMode: gl.getUniformLocation(visibilityProgram, "depthMode"),
			depthThreshold: gl.getUniformLocation(visibilityProgram, "depthThreshold"),
			depthFade: gl.getUniformLocation(visibilityProgram, "depthFade"),
			depthEchoWavelength: gl.getUniformLocation(visibilityProgram, "depthEchoWavelength"),
			depthEchoDutyCycle: gl.getUniformLocation(visibilityProgram, "depthEchoDutyCycle"),
			depthEchoFade: gl.getUniformLocation(visibilityProgram, "depthEchoFade"),
			depthPhaseOffset: gl.getUniformLocation(visibilityProgram, "depthPhaseOffset")
		};
	};

	const buildVisibilityField = function(fieldState, processingConfig) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (!fieldState || !fieldState.fieldTexture || !fieldState.coverageTexture || !ensureVisibilityResources(fieldState.width, fieldState.height)) {
			return null;
		}
		ensureVisibilityProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, visibilityFramebuffer);
		gl.viewport(0, 0, visibilityWidth, visibilityHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(visibilityProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, fieldState.fieldTexture);
		gl.uniform1i(visibilityLocs.fieldTexture, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, fieldState.coverageTexture);
		gl.uniform1i(visibilityLocs.coverageTexture, 1);
		gl.uniform1f(visibilityLocs.minCoverage, DEPTH_VISIBILITY_COVERAGE_THRESHOLD);
		gl.uniform1f(visibilityLocs.depthMode, processingConfig && processingConfig.depthMode != null ? processingConfig.depthMode : 0);
		gl.uniform1f(visibilityLocs.depthThreshold, processingConfig && processingConfig.depthThreshold != null ? processingConfig.depthThreshold : 0);
		gl.uniform1f(visibilityLocs.depthFade, processingConfig && processingConfig.depthFade != null ? processingConfig.depthFade : 0);
		gl.uniform1f(visibilityLocs.depthEchoWavelength, processingConfig && processingConfig.depthEchoWavelength != null ? processingConfig.depthEchoWavelength : 1);
		gl.uniform1f(visibilityLocs.depthEchoDutyCycle, processingConfig && processingConfig.depthEchoDutyCycle != null ? processingConfig.depthEchoDutyCycle : 0.5);
		gl.uniform1f(visibilityLocs.depthEchoFade, processingConfig && processingConfig.depthEchoFade != null ? processingConfig.depthEchoFade : 0);
		gl.uniform1f(visibilityLocs.depthPhaseOffset, processingConfig && processingConfig.depthPhaseOffset != null ? processingConfig.depthPhaseOffset : 0);
		bindFullscreenTriangle(visibilityLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return visibilityTexture;
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
			const depthSourcePacket = args && args.depthSourcePacket ? args.depthSourcePacket : null;
			const processingConfig = args && args.processingConfig ? args.processingConfig : null;
			const depthInfo = depthSourcePacket && depthSourcePacket.depthInfo ? depthSourcePacket.depthInfo : null;
			if (!floatTargetConfig || !depthSourcePacket || !processingConfig || !depthInfo || depthInfo.isValid === false) {
				return null;
			}
			const canonicalDepthState = canonicalizeDepth(depthSourcePacket);
			if (!canonicalDepthState) {
				return null;
			}
			const reprojectedState = reprojectDepth(canonicalDepthState, depthSourcePacket);
			if (!reprojectedState) {
				return null;
			}
			const consumerSize = resolveViewportSize(args || null, depthInfo.width, depthInfo.height);
			const highResField = buildHighResField(reprojectedState, consumerSize.width, consumerSize.height, depthSourcePacket, processingConfig);
			if (!highResField) {
				return null;
			}
			const finalVisibilityTexture = buildVisibilityField(highResField, processingConfig);
			return {
				fieldTexture: highResField.fieldTexture,
				coverageTexture: highResField.coverageTexture,
				visibilityTexture: finalVisibilityTexture,
				fieldWidth: highResField.width,
				fieldHeight: highResField.height,
				fieldWorldPointsBool: true
			};
		}
	};
};
