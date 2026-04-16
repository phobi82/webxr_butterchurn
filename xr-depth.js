// Canonical depth adapter for stabilized source depth plus inverse reprojection.
// Source depth is normalized once here so every consumer samples the same processed texture.

const DEPTH_ENCODING_SOURCE_RAW = 0;
const DEPTH_ENCODING_LINEAR_VIEW_Z = 1;
const DEPTH_METRIC_MODE_PLANAR = "planar";
const DEPTH_METRIC_MODE_RADIAL = "radial";
const DEPTH_QUALITY_MODE_RAW = "raw";
const DEPTH_QUALITY_MODE_STABILIZED = "stabilized";
const DEFAULT_DEPTH_QUALITY_MODE = DEPTH_QUALITY_MODE_STABILIZED;
const STABILIZED_DEPTH_DELTA_METERS = 0.12;
const DEPTH_REPROJECTION_ACCEPT_TEXELS = 1.35;

const getDepthQualityMode = function(processingConfig) {
	const modeKey = processingConfig && processingConfig.depthQualityMode ? String(processingConfig.depthQualityMode) : DEFAULT_DEPTH_QUALITY_MODE;
	return modeKey === DEPTH_QUALITY_MODE_RAW ? DEPTH_QUALITY_MODE_RAW : DEPTH_QUALITY_MODE_STABILIZED;
};

const getDepthMetricMode = function(processingConfig) {
	const modeKey = processingConfig && processingConfig.depthMetricMode ? String(processingConfig.depthMetricMode) : DEPTH_METRIC_MODE_RADIAL;
	return modeKey === DEPTH_METRIC_MODE_PLANAR ? DEPTH_METRIC_MODE_PLANAR : DEPTH_METRIC_MODE_RADIAL;
};

const createDepthDecodeShaderChunk = function(functionName) {
	const resolvedFunctionName = functionName || "decodeDepthMeters";
	return [
		"float " + resolvedFunctionName + "(float rawDepth){",
		"if(depthEncodingMode>" + (DEPTH_ENCODING_LINEAR_VIEW_Z - 0.5).toFixed(1) + "){return rawDepth;}",
		"return depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"}"
	].join("");
};

const createDepthProcessingRenderer = function(options) {
	options = options || {};
	const gl = options.gl;
	const webgl2Bool = !!options.webgl2Bool;
	let buffer = null;
	let cpuTexture = null;
	let cpuUploadBuffer = null;
	let canonicalProgram = null;
	let canonicalLocs = null;
	let arrayTargetTexture = null;
	let arrayTargetFramebuffer = null;
	let arrayTargetWidth = 0;
	let arrayTargetHeight = 0;
	let arrayTargetConfig = null;
	let targetDepthTexture = null;
	let targetDepthFramebuffer = null;
	let targetDepthBuffer = null;
	let targetDepthWidth = 0;
	let targetDepthHeight = 0;
	let targetDepthProgram = null;
	let targetDepthLocs = null;
	let consumerDepthTexture = null;
	let consumerDepthFramebuffer = null;
	let consumerDepthWidth = 0;
	let consumerDepthHeight = 0;
	let consumerDepthProgram = null;
	let consumerDepthLocs = null;
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
	const selectFloatTargetConfig = function() {
		if (webgl2Bool && gl.getExtension("EXT_color_buffer_float")) {
			return {
				internalFormat: gl.RGBA16F,
				format: gl.RGBA,
				type: gl.HALF_FLOAT
			};
		}
		return {
			internalFormat: gl.RGBA,
			format: gl.RGBA,
			type: gl.UNSIGNED_BYTE
		};
	};
	const ensureArrayTarget = function(width, height, stabilizedBool) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (arrayTargetTexture && arrayTargetFramebuffer && arrayTargetWidth === safeWidth && arrayTargetHeight === safeHeight) {
			gl.bindTexture(gl.TEXTURE_2D, arrayTargetTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, stabilizedBool ? gl.LINEAR : gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, stabilizedBool ? gl.LINEAR : gl.NEAREST);
			return true;
		}
		arrayTargetWidth = safeWidth;
		arrayTargetHeight = safeHeight;
		if (!arrayTargetTexture) {
			arrayTargetTexture = gl.createTexture();
		}
		if (!arrayTargetFramebuffer) {
			arrayTargetFramebuffer = gl.createFramebuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, arrayTargetTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, stabilizedBool ? gl.LINEAR : gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, stabilizedBool ? gl.LINEAR : gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			arrayTargetConfig.internalFormat,
			arrayTargetWidth,
			arrayTargetHeight,
			0,
			arrayTargetConfig.format,
			arrayTargetConfig.type,
			null
		);
		gl.bindFramebuffer(gl.FRAMEBUFFER, arrayTargetFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, arrayTargetTexture, 0);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};
	const buildCanonicalDepthState = function(texture, depthEncodingMode, depthProfile, rawValueToMeters) {
		return {
			texture: texture || null,
			depthEncodingMode: depthEncodingMode != null ? depthEncodingMode : DEPTH_ENCODING_SOURCE_RAW,
			depthProfile: depthProfile || {linearScale: rawValueToMeters || 0.001, nearZ: 0},
			rawValueToMeters: rawValueToMeters != null ? rawValueToMeters : (depthProfile && depthProfile.linearScale != null ? depthProfile.linearScale : 0.001)
		};
	};
	const resolveConsumerDepthTextureSize = function(args, fallbackWidth, fallbackHeight) {
		const viewport = args && args.viewport ? args.viewport : null;
		return {
			width: viewport && viewport.width ? viewport.width | 0 : Math.max(1, fallbackWidth | 0),
			height: viewport && viewport.height ? viewport.height | 0 : Math.max(1, fallbackHeight | 0)
		};
	};
	const buildProcessedDepthInfo = function(args, texture, width, height) {
		const outputSize = resolveConsumerDepthTextureSize(args || null, width || 1, height || 1);
		return {
			texture: texture || null,
			width: outputSize.width,
			height: outputSize.height,
			depthEncodingMode: DEPTH_ENCODING_LINEAR_VIEW_Z,
			rawValueToMeters: 1,
			depthProfile: {linearScale: 1, nearZ: 0},
			worldPointAvailableBool: arrayTargetConfig && arrayTargetConfig.type === gl.HALF_FLOAT
		};
	};
	const resolveMetricProjectionParams = function(args) {
		const reprojectionState = args && args.depthReprojectionState ? args.depthReprojectionState : null;
		const projectionParams = reprojectionState ? reprojectionState.targetProjectionParams : null;
		if (projectionParams) {
			return projectionParams;
		}
		return extractProjectionRayParams(args && args.targetProjMatrix ? args.targetProjMatrix : null);
	};
	const ensureCpuTexture = function(depthInfo, args) {
		const pixelCount = (depthInfo.width | 0) * (depthInfo.height | 0);
		const sourceData = depthInfo.data instanceof Uint16Array ? depthInfo.data : new Uint16Array(depthInfo.data);
		const depthProfile = args && args.depthProfile ? args.depthProfile : {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
		const linearScale = depthProfile && depthProfile.linearScale != null ? depthProfile.linearScale : (depthInfo.rawValueToMeters || 0.001);
		const stabilizedBool = getDepthQualityMode(args && args.processingConfig ? args.processingConfig : null) === DEPTH_QUALITY_MODE_STABILIZED;
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
		if (webgl2Bool) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, depthInfo.width, depthInfo.height, 0, gl.RED, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
		} else {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, depthInfo.width, depthInfo.height, 0, gl.LUMINANCE, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
		}
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, stabilizedBool ? gl.LINEAR : gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, stabilizedBool ? gl.LINEAR : gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return buildCanonicalDepthState(cpuTexture, DEPTH_ENCODING_LINEAR_VIEW_Z, depthProfile, linearScale);
	};
	const buildCanonicalCopyFragmentSource = function() {
		return [
			"#version 300 es\n",
			"precision highp float;",
			"precision mediump sampler2DArray;",
			"uniform sampler2D sourceDepthTexture2D;",
			"uniform sampler2DArray sourceDepthTextureArray;",
			"uniform float useArraySource;",
			"uniform int sourceDepthLayer;",
			"uniform vec2 sourceTexelSize;",
			"uniform float useStabilizedDepth;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform float depthEncodingMode;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			createDepthDecodeShaderChunk("decodeDepthMeters"),
			"float sampleRawDepth(vec2 uv){",
			"if(useArraySource>0.5){",
			"return texture(sourceDepthTextureArray,vec3(uv,float(sourceDepthLayer))).r;",
			"}",
			"return texture(sourceDepthTexture2D,uv).r;",
			"}",
			"float sampleClampedRawDepth(vec2 uv){return sampleRawDepth(clamp(uv,sourceTexelSize*0.5,vec2(1.0)-sourceTexelSize*0.5));}",
			"float sampleNeighborMeters(vec2 uv,float centerMeters,float weight,inout float weightAccum){",
			"float rawDepth=sampleClampedRawDepth(uv);",
			"if(rawDepth<=0.0001){return 0.0;}",
			"float neighborMeters=decodeDepthMeters(rawDepth);",
			"if(abs(neighborMeters-centerMeters)>" + STABILIZED_DEPTH_DELTA_METERS.toFixed(3) + "){return 0.0;}",
			"weightAccum+=weight;",
			"return neighborMeters*weight;",
			"}",
			"void main(){",
			"float centerRawDepth=sampleClampedRawDepth(vScreenUv);",
			"if(centerRawDepth<=0.0001){fragColor=vec4(0.0,0.0,0.0,1.0);return;}",
			"float centerMeters=decodeDepthMeters(centerRawDepth);",
			"if(useStabilizedDepth<0.5){fragColor=vec4(centerMeters,0.0,0.0,1.0);return;}",
			"float metersAccum=centerMeters;",
			"float weightAccum=1.0;",
			"vec2 offsetX=vec2(sourceTexelSize.x,0.0);",
			"vec2 offsetY=vec2(0.0,sourceTexelSize.y);",
			"vec2 offsetDiag=sourceTexelSize;",
			"metersAccum+=sampleNeighborMeters(vScreenUv-offsetX,centerMeters,1.0,weightAccum);",
			"metersAccum+=sampleNeighborMeters(vScreenUv+offsetX,centerMeters,1.0,weightAccum);",
			"metersAccum+=sampleNeighborMeters(vScreenUv-offsetY,centerMeters,1.0,weightAccum);",
			"metersAccum+=sampleNeighborMeters(vScreenUv+offsetY,centerMeters,1.0,weightAccum);",
			"metersAccum+=sampleNeighborMeters(vScreenUv-offsetDiag,centerMeters,0.7071,weightAccum);",
			"metersAccum+=sampleNeighborMeters(vScreenUv+offsetDiag,centerMeters,0.7071,weightAccum);",
			"metersAccum+=sampleNeighborMeters(vScreenUv+vec2(sourceTexelSize.x,-sourceTexelSize.y),centerMeters,0.7071,weightAccum);",
			"metersAccum+=sampleNeighborMeters(vScreenUv+vec2(-sourceTexelSize.x,sourceTexelSize.y),centerMeters,0.7071,weightAccum);",
			"fragColor=vec4(metersAccum/max(weightAccum,1.0),0.0,0.0,1.0);",
			"}"
		].join("");
	};
	const ensureCanonicalProgram = function() {
		if (canonicalProgram) {
			return;
		}
		canonicalProgram = createProgram(gl, fullscreenVertexSource, buildCanonicalCopyFragmentSource(), "Canonical depth copy");
		canonicalLocs = {
			position: gl.getAttribLocation(canonicalProgram, "position"),
			sourceDepthTexture2D: gl.getUniformLocation(canonicalProgram, "sourceDepthTexture2D"),
			sourceDepthTextureArray: gl.getUniformLocation(canonicalProgram, "sourceDepthTextureArray"),
			useArraySource: gl.getUniformLocation(canonicalProgram, "useArraySource"),
			sourceDepthLayer: gl.getUniformLocation(canonicalProgram, "sourceDepthLayer"),
			sourceTexelSize: gl.getUniformLocation(canonicalProgram, "sourceTexelSize"),
			useStabilizedDepth: gl.getUniformLocation(canonicalProgram, "useStabilizedDepth"),
			rawValueToMeters: gl.getUniformLocation(canonicalProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(canonicalProgram, "depthNearZ"),
			depthEncodingMode: gl.getUniformLocation(canonicalProgram, "depthEncodingMode")
		};
	};
	const bindCanonicalCopyUniforms = function(copyLocs, depthInfo, depthProfile, args) {
		const profile = depthProfile || {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
		const stabilizedBool = getDepthQualityMode(args && args.processingConfig ? args.processingConfig : null) === DEPTH_QUALITY_MODE_STABILIZED;
		gl.uniform2f(copyLocs.sourceTexelSize, 1 / Math.max(1, depthInfo.width | 0), 1 / Math.max(1, depthInfo.height | 0));
		gl.uniform1f(copyLocs.useStabilizedDepth, stabilizedBool ? 1 : 0);
		gl.uniform1f(copyLocs.rawValueToMeters, profile.linearScale != null ? profile.linearScale : (depthInfo.rawValueToMeters || 0.001));
		gl.uniform1f(copyLocs.depthNearZ, profile.nearZ != null ? profile.nearZ : 0);
		gl.uniform1f(copyLocs.depthEncodingMode, depthInfo && depthInfo.depthEncodingMode != null ? depthInfo.depthEncodingMode : DEPTH_ENCODING_SOURCE_RAW);
	};
	const canonicalizeDepth = function(depthInfo, useArraySourceBool, args) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		const depthProfile = args && args.depthProfile ? args.depthProfile : {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
		const stabilizedBool = getDepthQualityMode(args && args.processingConfig ? args.processingConfig : null) === DEPTH_QUALITY_MODE_STABILIZED;
		if (!webgl2Bool || !depthInfo.texture || !ensureArrayTarget(depthInfo.width, depthInfo.height, stabilizedBool)) {
			return null;
		}
		ensureCanonicalProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, arrayTargetFramebuffer);
		gl.viewport(0, 0, arrayTargetWidth, arrayTargetHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(canonicalProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, useArraySourceBool ? null : depthInfo.texture);
		gl.uniform1i(canonicalLocs.sourceDepthTexture2D, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D_ARRAY, useArraySourceBool ? depthInfo.texture : null);
		gl.uniform1i(canonicalLocs.sourceDepthTextureArray, 1);
		gl.uniform1f(canonicalLocs.useArraySource, useArraySourceBool ? 1 : 0);
		gl.uniform1i(canonicalLocs.sourceDepthLayer, depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0));
		bindCanonicalCopyUniforms(canonicalLocs, depthInfo, depthProfile, args || null);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(canonicalLocs.position);
		gl.vertexAttribPointer(canonicalLocs.position, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
		gl.viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);
		return buildCanonicalDepthState(arrayTargetTexture, DEPTH_ENCODING_LINEAR_VIEW_Z, {linearScale: 1, nearZ: 0}, 1);
	};
	const ensureTargetDepthResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (targetDepthFramebuffer && targetDepthTexture && targetDepthBuffer && targetDepthWidth === safeWidth && targetDepthHeight === safeHeight) {
			return true;
		}
		targetDepthWidth = safeWidth;
		targetDepthHeight = safeHeight;
		if (!targetDepthTexture) {
			targetDepthTexture = gl.createTexture();
		}
		if (!targetDepthFramebuffer) {
			targetDepthFramebuffer = gl.createFramebuffer();
		}
		if (!targetDepthBuffer) {
			targetDepthBuffer = gl.createRenderbuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, targetDepthTexture);
		// Keep the upscale policy centralized here so consumers do not implement their own.
		// NEAREST makes low-res reprojection artifacts easier to diagnose than linear mixing.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			arrayTargetConfig.internalFormat,
			targetDepthWidth,
			targetDepthHeight,
			0,
			arrayTargetConfig.format,
			arrayTargetConfig.type,
			null
		);
		gl.bindRenderbuffer(gl.RENDERBUFFER, targetDepthBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, targetDepthWidth, targetDepthHeight);
		gl.bindFramebuffer(gl.FRAMEBUFFER, targetDepthFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetDepthTexture, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, targetDepthBuffer);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};
	const resolveTargetDepthTextureSize = function(depthInfo) {
		const sourceWidth = Math.max(1, depthInfo && depthInfo.width ? depthInfo.width | 0 : 1);
		const sourceHeight = Math.max(1, depthInfo && depthInfo.height ? depthInfo.height | 0 : 1);
		return {
			width: sourceWidth,
			height: sourceHeight
		};
	};
	const ensureConsumerDepthResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (consumerDepthFramebuffer && consumerDepthTexture && consumerDepthWidth === safeWidth && consumerDepthHeight === safeHeight) {
			return true;
		}
		consumerDepthWidth = safeWidth;
		consumerDepthHeight = safeHeight;
		if (!consumerDepthTexture) {
			consumerDepthTexture = gl.createTexture();
		}
		if (!consumerDepthFramebuffer) {
			consumerDepthFramebuffer = gl.createFramebuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, consumerDepthTexture);
		// The upscale pass below bakes the final smoothing for depth only. Keep the final packed
		// texture nearest-sampled so world points do not get linearly mixed across silhouettes.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, arrayTargetConfig.internalFormat, consumerDepthWidth, consumerDepthHeight, 0, arrayTargetConfig.format, arrayTargetConfig.type, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, consumerDepthFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, consumerDepthTexture, 0);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};
	const ensureConsumerDepthProgram = function() {
		if (consumerDepthProgram) {
			return;
		}
		consumerDepthProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D packedDepthTexture;",
			"uniform vec2 sourceTextureSize;",
			"uniform vec4 depthProjectionParams;",
			"uniform float depthMetricMode;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			"vec4 samplePackedAtTexel(vec2 texelCoord){",
			"vec2 depthUv=(clamp(texelCoord,vec2(0.0),sourceTextureSize-vec2(1.0))+0.5)/sourceTextureSize;",
			"return texture(packedDepthTexture,depthUv);",
			"}",
			"void main(){",
			// Smooth only the scalar depth metric during the upscale. World points stay nearest so
			// silhouettes do not interpolate foreground hands with background room geometry.
			"vec2 nearestTexel=floor(vScreenUv*sourceTextureSize);",
			"vec4 packedDepth=samplePackedAtTexel(nearestTexel);",
			"if(packedDepth.r<=0.0001){fragColor=vec4(0.0);return;}",
			"vec2 sourcePos=clamp(vScreenUv*sourceTextureSize-vec2(0.5),vec2(0.0),sourceTextureSize-vec2(1.0));",
			"vec2 baseTexel=floor(sourcePos);",
			"vec2 blend=sourcePos-baseTexel;",
			"vec4 sample00=samplePackedAtTexel(baseTexel);",
			"vec4 sample10=samplePackedAtTexel(baseTexel+vec2(1.0,0.0));",
			"vec4 sample01=samplePackedAtTexel(baseTexel+vec2(0.0,1.0));",
			"vec4 sample11=samplePackedAtTexel(baseTexel+vec2(1.0,1.0));",
			"float weight00=(1.0-blend.x)*(1.0-blend.y);",
			"float weight10=blend.x*(1.0-blend.y);",
			"float weight01=(1.0-blend.x)*blend.y;",
			"float weight11=blend.x*blend.y;",
			"float depthAccum=0.0;",
			"float weightAccum=0.0;",
			"if(sample00.r>0.0001){depthAccum+=sample00.r*weight00;weightAccum+=weight00;}",
			"if(sample10.r>0.0001){depthAccum+=sample10.r*weight10;weightAccum+=weight10;}",
			"if(sample01.r>0.0001){depthAccum+=sample01.r*weight01;weightAccum+=weight01;}",
			"if(sample11.r>0.0001){depthAccum+=sample11.r*weight11;weightAccum+=weight11;}",
			"float planarDepth=weightAccum>0.0001?depthAccum/weightAccum:packedDepth.r;",
			"if(depthMetricMode<0.5){fragColor=vec4(planarDepth,packedDepth.gba);return;}",
			"vec2 ndc=(nearestTexel+0.5)/sourceTextureSize*2.0-1.0;",
			"vec2 viewRay=vec2((ndc.x+depthProjectionParams.z)/depthProjectionParams.x,(ndc.y+depthProjectionParams.w)/depthProjectionParams.y);",
			"fragColor=vec4(planarDepth*sqrt(1.0+dot(viewRay,viewRay)),packedDepth.gba);",
			"}"
		].join(""), "Consumer depth build");
		consumerDepthLocs = {
			position: gl.getAttribLocation(consumerDepthProgram, "position"),
			packedDepthTexture: gl.getUniformLocation(consumerDepthProgram, "packedDepthTexture"),
			sourceTextureSize: gl.getUniformLocation(consumerDepthProgram, "sourceTextureSize"),
			depthProjectionParams: gl.getUniformLocation(consumerDepthProgram, "depthProjectionParams"),
			depthMetricMode: gl.getUniformLocation(consumerDepthProgram, "depthMetricMode")
		};
	};
	const buildConsumerDepthTexture = function(packedDepthTexture, sourceWidth, sourceHeight, targetWidth, targetHeight, planarEncodingMode, projectionParams, processingConfig) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (!packedDepthTexture || planarEncodingMode !== DEPTH_ENCODING_LINEAR_VIEW_Z) {
			return null;
		}
		if (!ensureConsumerDepthResources(targetWidth, targetHeight)) {
			return null;
		}
		ensureConsumerDepthProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, consumerDepthFramebuffer);
		gl.viewport(0, 0, consumerDepthWidth, consumerDepthHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(consumerDepthProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, packedDepthTexture);
		gl.uniform1i(consumerDepthLocs.packedDepthTexture, 0);
		gl.uniform2f(consumerDepthLocs.sourceTextureSize, Math.max(1, sourceWidth | 0), Math.max(1, sourceHeight | 0));
		gl.uniform4f(
			consumerDepthLocs.depthProjectionParams,
			projectionParams ? projectionParams.xScale : 1,
			projectionParams ? projectionParams.yScale : 1,
			projectionParams ? projectionParams.xOffset : 0,
			projectionParams ? projectionParams.yOffset : 0
		);
		gl.uniform1f(consumerDepthLocs.depthMetricMode, getDepthMetricMode(processingConfig) === DEPTH_METRIC_MODE_RADIAL ? 1 : 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(consumerDepthLocs.position);
		gl.vertexAttribPointer(consumerDepthLocs.position, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
		gl.viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);
		return consumerDepthTexture;
	};
	const ensureInverseReprojectProgram = function() {
		if (targetDepthProgram) {
			return;
		}
		// Inverse reprojection: for each render pixel, look up the processed sensor depth.
		// Canonicalization already normalized raw depth into one shared sampling contract.
		// Output packs target-space depth plus world point at native sensor resolution.
		const fs = [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D depthTexture;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform float depthEncodingMode;",
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
			createDepthDecodeShaderChunk("decodeDepth"),
			"void main(){",
			"vec2 renderNDC=vScreenUv*2.0-1.0;",
			"vec2 renderRay=vec2(",
			"(renderNDC.x+targetProjectionParams.z)/targetProjectionParams.x,",
			"(renderNDC.y+targetProjectionParams.w)/targetProjectionParams.y);",
			"float guessPlanarDepth=1.5;",
			"vec4 actualRenderPt=vec4(0.0);",
			"vec4 actualWorldPt=vec4(0.0);",
			"for(int i=0;i<3;i+=1){",
			"vec3 renderViewPt=vec3(renderRay*guessPlanarDepth,-guessPlanarDepth);",
			"vec4 worldPt=targetWorldFromView*vec4(renderViewPt,1.0);",
			"vec4 sensorViewPt=sourceViewMatrix*worldPt;",
			"if(-sensorViewPt.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){discard;}",
			"float invSZ=1.0/max(-sensorViewPt.z,0.0001);",
			"vec2 sensorNDC=vec2(",
			"sensorViewPt.x*invSZ*sourceProjectionParams.x-sourceProjectionParams.z,",
			"sensorViewPt.y*invSZ*sourceProjectionParams.y-sourceProjectionParams.w);",
			"vec2 sensorUV=sensorNDC*0.5+0.5;",
			"if(sensorUV.x<0.0||sensorUV.x>1.0||sensorUV.y<0.0||sensorUV.y>1.0){discard;}",
			"float depthMeters=decodeDepth(texture(depthTexture,sensorUV).r);",
			"if(depthMeters<=0.0001){discard;}",
			"vec3 sensorRayDir=vec3(sensorViewPt.xy*invSZ,-1.0);",
			"vec3 actualSensorPt=sensorRayDir*depthMeters;",
			"actualWorldPt=sourceWorldFromView*vec4(actualSensorPt,1.0);",
			"actualRenderPt=targetViewMatrix*actualWorldPt;",
			"guessPlanarDepth=max(-actualRenderPt.z," + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + ");",
			"}",
			"if(-actualRenderPt.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){discard;}",
			"vec4 clip=targetProjMatrix*actualRenderPt;",
			"float clipW=max(clip.w,0.0001);",
			"if(abs(clip.x)>clipW*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "||abs(clip.y)>clipW*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "){discard;}",
			"vec2 projectedUv=clip.xy/clipW*0.5+0.5;",
			"vec2 reprojectionDelta=abs(projectedUv-vScreenUv);",
			"if(reprojectionDelta.x>targetTexelSize.x*" + DEPTH_REPROJECTION_ACCEPT_TEXELS.toFixed(2) + "||reprojectionDelta.y>targetTexelSize.y*" + DEPTH_REPROJECTION_ACCEPT_TEXELS.toFixed(2) + "){discard;}",
			"float planarDepth=max(0.0,-actualRenderPt.z);",
			"gl_FragDepth=clamp(clip.z/clipW*0.5+0.5,0.0,1.0);",
			"fragColor=vec4(planarDepth,actualWorldPt.xyz);",
			"}"
		].join("");
		targetDepthProgram = createProgram(gl, fullscreenVertexSource, fs, "Inverse depth reprojection");
		targetDepthLocs = {
			position:               gl.getAttribLocation(targetDepthProgram,  "position"),
			depthTexture:           gl.getUniformLocation(targetDepthProgram, "depthTexture"),
			rawValueToMeters:       gl.getUniformLocation(targetDepthProgram, "rawValueToMeters"),
			depthNearZ:             gl.getUniformLocation(targetDepthProgram, "depthNearZ"),
			depthEncodingMode:      gl.getUniformLocation(targetDepthProgram, "depthEncodingMode"),
			sourceProjectionParams: gl.getUniformLocation(targetDepthProgram, "sourceProjectionParams"),
			targetProjectionParams: gl.getUniformLocation(targetDepthProgram, "targetProjectionParams"),
			targetTexelSize:        gl.getUniformLocation(targetDepthProgram, "targetTexelSize"),
			sourceWorldFromView:    gl.getUniformLocation(targetDepthProgram, "sourceWorldFromView"),
			sourceViewMatrix:       gl.getUniformLocation(targetDepthProgram, "sourceViewMatrix"),
			targetWorldFromView:    gl.getUniformLocation(targetDepthProgram, "targetWorldFromView"),
			targetViewMatrix:       gl.getUniformLocation(targetDepthProgram, "targetViewMatrix"),
			targetProjMatrix:       gl.getUniformLocation(targetDepthProgram, "targetProjMatrix")
		};
	};
	const inverseReprojectDepth = function(depthInfo, args, canonicalDepthState) {
		const viewport = args && args.viewport ? args.viewport : null;
		const reprojectionState = args && args.depthReprojectionState ? args.depthReprojectionState : null;
		const profile = canonicalDepthState && canonicalDepthState.depthProfile ? canonicalDepthState.depthProfile : (args && args.depthProfile ? args.depthProfile : {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0});
		const targetTextureSize = resolveTargetDepthTextureSize(depthInfo);
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (
			!webgl2Bool ||
			!canonicalDepthState ||
			!canonicalDepthState.texture ||
			!viewport ||
			!reprojectionState ||
			!reprojectionState.enabledBool ||
			!reprojectionState.sourceProjectionParams ||
			!reprojectionState.sourceViewMatrix ||
			!reprojectionState.sourceWorldFromViewMatrix ||
			!reprojectionState.targetProjectionParams ||
			!reprojectionState.targetWorldFromViewMatrix ||
			!reprojectionState.targetViewMatrix ||
			!args.targetProjMatrix ||
			!ensureTargetDepthResources(targetTextureSize.width, targetTextureSize.height)
		) {
			return null;
		}
		ensureInverseReprojectProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, targetDepthFramebuffer);
		gl.viewport(0, 0, targetDepthWidth, targetDepthHeight);
		gl.clearColor(0, 0, 0, 0);
		gl.clearDepth(1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.useProgram(targetDepthProgram);
		gl.enable(gl.DEPTH_TEST);
		gl.depthMask(true);
		gl.depthFunc(gl.LEQUAL);
		gl.disable(gl.BLEND);
		gl.disable(gl.CULL_FACE);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, canonicalDepthState.texture);
		gl.uniform1i(targetDepthLocs.depthTexture, 0);
		gl.uniform1f(targetDepthLocs.rawValueToMeters, canonicalDepthState.rawValueToMeters != null ? canonicalDepthState.rawValueToMeters : (profile.linearScale != null ? profile.linearScale : (depthInfo.rawValueToMeters || 0.001)));
		gl.uniform1f(targetDepthLocs.depthNearZ, profile.nearZ != null ? profile.nearZ : 0);
		gl.uniform1f(targetDepthLocs.depthEncodingMode, canonicalDepthState.depthEncodingMode != null ? canonicalDepthState.depthEncodingMode : DEPTH_ENCODING_SOURCE_RAW);
		gl.uniform4f(targetDepthLocs.sourceProjectionParams,
			reprojectionState.sourceProjectionParams.xScale,
			reprojectionState.sourceProjectionParams.yScale,
			reprojectionState.sourceProjectionParams.xOffset,
			reprojectionState.sourceProjectionParams.yOffset);
		gl.uniform4f(targetDepthLocs.targetProjectionParams,
			reprojectionState.targetProjectionParams.xScale,
			reprojectionState.targetProjectionParams.yScale,
			reprojectionState.targetProjectionParams.xOffset,
			reprojectionState.targetProjectionParams.yOffset);
		gl.uniform2f(targetDepthLocs.targetTexelSize, 1 / Math.max(1, targetTextureSize.width), 1 / Math.max(1, targetTextureSize.height));
		gl.uniformMatrix4fv(targetDepthLocs.sourceWorldFromView, false, reprojectionState.sourceWorldFromViewMatrix);
		gl.uniformMatrix4fv(targetDepthLocs.sourceViewMatrix,    false, reprojectionState.sourceViewMatrix);
		gl.uniformMatrix4fv(targetDepthLocs.targetWorldFromView, false, reprojectionState.targetWorldFromViewMatrix);
		gl.uniformMatrix4fv(targetDepthLocs.targetViewMatrix,    false, reprojectionState.targetViewMatrix);
		gl.uniformMatrix4fv(targetDepthLocs.targetProjMatrix,    false, args.targetProjMatrix);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(targetDepthLocs.position);
		gl.vertexAttribPointer(targetDepthLocs.position, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
		gl.viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);
		return {
			texture: targetDepthTexture,
			width: targetTextureSize.width,
			height: targetTextureSize.height
		};
	};
	return {
		init: function() {
			buffer = createFullscreenTriangleBuffer(gl);
			arrayTargetConfig = selectFloatTargetConfig();
		},
		process: function(args) {
			const depthInfo = args && args.depthInfo ? args.depthInfo : null;
			let canonicalDepthState = null;
			let sourceDepthInfo = null;
			let targetDepthResult = null;
			let consumerTexture = null;
			let consumerTextureSize = null;
			if (!depthInfo || depthInfo.isValid === false) {
				return null;
			}
			sourceDepthInfo = depthInfo;
			if (!depthInfo.texture && depthInfo.data && depthInfo.width && depthInfo.height) {
				// CPU input is uploaded once first, then it follows the same canonical GPU path.
				canonicalDepthState = ensureCpuTexture(depthInfo, args || null);
				if (!canonicalDepthState || !canonicalDepthState.texture) {
					return null;
				}
				sourceDepthInfo = {
					texture: canonicalDepthState.texture,
					width: depthInfo.width,
					height: depthInfo.height,
					rawValueToMeters: 1,
					depthEncodingMode: DEPTH_ENCODING_LINEAR_VIEW_Z
				};
			}
			canonicalDepthState = canonicalizeDepth(sourceDepthInfo, sourceDepthInfo.textureType === "texture-array", args || null);
			if (!canonicalDepthState || !canonicalDepthState.texture) {
				return null;
			}
			targetDepthResult = inverseReprojectDepth(depthInfo, args || {}, canonicalDepthState);
			consumerTextureSize = resolveConsumerDepthTextureSize(args || null, depthInfo.width || 1, depthInfo.height || 1);
			if (!targetDepthResult || !targetDepthResult.texture) {
				return null;
			}
			consumerTexture = buildConsumerDepthTexture(
				targetDepthResult.texture,
				targetDepthResult.width,
				targetDepthResult.height,
				consumerTextureSize.width,
				consumerTextureSize.height,
				DEPTH_ENCODING_LINEAR_VIEW_Z,
				resolveMetricProjectionParams(args || null),
				args && args.processingConfig ? args.processingConfig : null
			);
			return consumerTexture ? buildProcessedDepthInfo(args || {}, consumerTexture, consumerTextureSize.width, consumerTextureSize.height) : null;
		}
	};
};
