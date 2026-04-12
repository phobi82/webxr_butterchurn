// Canonical depth adapter for stabilized source depth plus inverse reprojection.
// Source depth is normalized once here so every consumer samples the same processed texture.

const DEPTH_ENCODING_SOURCE_RAW = 0;
const DEPTH_ENCODING_LINEAR_VIEW_Z = 1;
const DEPTH_QUALITY_MODE_RAW = "raw";
const DEPTH_QUALITY_MODE_STABILIZED = "stabilized";
const DEFAULT_DEPTH_QUALITY_MODE = DEPTH_QUALITY_MODE_STABILIZED;
const STABILIZED_DEPTH_DELTA_METERS = 0.12;

const getDepthQualityMode = function(processingConfig) {
	const modeKey = processingConfig && processingConfig.depthQualityMode ? String(processingConfig.depthQualityMode) : DEFAULT_DEPTH_QUALITY_MODE;
	return modeKey === DEPTH_QUALITY_MODE_RAW ? DEPTH_QUALITY_MODE_RAW : DEPTH_QUALITY_MODE_STABILIZED;
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
	let arrayCopyProgram = null;
	let arrayCopyLocs = null;
	let textureCopyProgram = null;
	let textureCopyLocs = null;
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
	const buildCanonicalDepthState = function(texture, depthEncodingMode, depthProfile, rawValueToMeters, uvTransform) {
		return {
			texture: texture || null,
			depthEncodingMode: depthEncodingMode != null ? depthEncodingMode : DEPTH_ENCODING_SOURCE_RAW,
			depthProfile: depthProfile || {linearScale: rawValueToMeters || 0.001, nearZ: 0},
			rawValueToMeters: rawValueToMeters != null ? rawValueToMeters : (depthProfile && depthProfile.linearScale != null ? depthProfile.linearScale : 0.001),
			normDepthBufferFromNormView: uvTransform || identityMatrix()
		};
	};
	const buildCanonicalDepthInfo = function(depthInfo, canonicalDepthState) {
		return {
			texture: canonicalDepthState && canonicalDepthState.texture ? canonicalDepthState.texture : null,
			width: depthInfo.width || 0,
			height: depthInfo.height || 0,
			depthEncodingMode: canonicalDepthState && canonicalDepthState.depthEncodingMode != null ? canonicalDepthState.depthEncodingMode : DEPTH_ENCODING_SOURCE_RAW,
			rawValueToMeters: canonicalDepthState && canonicalDepthState.rawValueToMeters != null ? canonicalDepthState.rawValueToMeters : (depthInfo.rawValueToMeters || 0.001),
			normDepthBufferFromNormView: canonicalDepthState && canonicalDepthState.normDepthBufferFromNormView ? canonicalDepthState.normDepthBufferFromNormView : (depthInfo.normDepthBufferFromNormView || identityMatrix()),
			depthProfile: canonicalDepthState && canonicalDepthState.depthProfile ? canonicalDepthState.depthProfile : null
		};
	};
	const buildTargetDepthInfo = function(args, texture) {
		const targetSize = args && args.targetDepthTextureSize ? args.targetDepthTextureSize : null;
		const safeWidth = targetSize && targetSize.width ? targetSize.width | 0 : 0;
		const safeHeight = targetSize && targetSize.height ? targetSize.height | 0 : 0;
		return {
			texture: texture || null,
			width: safeWidth,
			height: safeHeight,
			depthEncodingMode: DEPTH_ENCODING_LINEAR_VIEW_Z,
			rawValueToMeters: 1,
			normDepthBufferFromNormView: identityMatrix(),
			depthProfile: {linearScale: 1, nearZ: 0}
		};
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
		return buildCanonicalDepthState(cpuTexture, DEPTH_ENCODING_LINEAR_VIEW_Z, depthProfile, linearScale, identityMatrix());
	};
	const buildCanonicalCopyFragmentSource = function(sampleRawDepthSource, samplerPrecisionLine) {
		return [
			"#version 300 es\n",
			"precision highp float;",
			samplerPrecisionLine || "",
			"uniform vec2 sourceTexelSize;",
			"uniform float useStabilizedDepth;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform float depthEncodingMode;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			createDepthDecodeShaderChunk("decodeDepthMeters"),
			"float sampleRawDepth(vec2 uv){" + sampleRawDepthSource + "}",
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
	const ensureArrayCopyProgram = function() {
		if (arrayCopyProgram) {
			return;
		}
		arrayCopyProgram = createProgram(gl, [
			"#version 300 es\n",
			"in vec2 position;",
			"out vec2 vScreenUv;",
			"void main(){",
			"vScreenUv=position*0.5+0.5;",
			"gl_Position=vec4(position,0.0,1.0);",
			"}"
		].join(""), buildCanonicalCopyFragmentSource("return texture(sourceDepthTexture,vec3(uv,float(sourceDepthLayer))).r;", "precision mediump sampler2DArray;uniform sampler2DArray sourceDepthTexture;uniform int sourceDepthLayer;"), "Canonical depth array copy");
		arrayCopyLocs = {
			position: gl.getAttribLocation(arrayCopyProgram, "position"),
			sourceDepthTexture: gl.getUniformLocation(arrayCopyProgram, "sourceDepthTexture"),
			sourceDepthLayer: gl.getUniformLocation(arrayCopyProgram, "sourceDepthLayer"),
			sourceTexelSize: gl.getUniformLocation(arrayCopyProgram, "sourceTexelSize"),
			useStabilizedDepth: gl.getUniformLocation(arrayCopyProgram, "useStabilizedDepth"),
			rawValueToMeters: gl.getUniformLocation(arrayCopyProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(arrayCopyProgram, "depthNearZ"),
			depthEncodingMode: gl.getUniformLocation(arrayCopyProgram, "depthEncodingMode")
		};
	};
	const ensureTextureCopyProgram = function() {
		if (textureCopyProgram) {
			return;
		}
		textureCopyProgram = createProgram(gl, [
			"#version 300 es\n",
			"in vec2 position;",
			"out vec2 vScreenUv;",
			"void main(){",
			"vScreenUv=position*0.5+0.5;",
			"gl_Position=vec4(position,0.0,1.0);",
			"}"
		].join(""), buildCanonicalCopyFragmentSource("return texture(sourceDepthTexture,uv).r;", "uniform sampler2D sourceDepthTexture;"), "Canonical depth texture copy");
		textureCopyLocs = {
			position: gl.getAttribLocation(textureCopyProgram, "position"),
			sourceDepthTexture: gl.getUniformLocation(textureCopyProgram, "sourceDepthTexture"),
			sourceTexelSize: gl.getUniformLocation(textureCopyProgram, "sourceTexelSize"),
			useStabilizedDepth: gl.getUniformLocation(textureCopyProgram, "useStabilizedDepth"),
			rawValueToMeters: gl.getUniformLocation(textureCopyProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(textureCopyProgram, "depthNearZ"),
			depthEncodingMode: gl.getUniformLocation(textureCopyProgram, "depthEncodingMode")
		};
	};
	const bindCanonicalCopyUniforms = function(copyLocs, depthInfo, depthProfile, processingConfig) {
		const profile = depthProfile || {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
		const stabilizedBool = getDepthQualityMode(processingConfig) === DEPTH_QUALITY_MODE_STABILIZED;
		gl.uniform2f(copyLocs.sourceTexelSize, 1 / Math.max(1, depthInfo.width | 0), 1 / Math.max(1, depthInfo.height | 0));
		gl.uniform1f(copyLocs.useStabilizedDepth, stabilizedBool ? 1 : 0);
		gl.uniform1f(copyLocs.rawValueToMeters, profile.linearScale != null ? profile.linearScale : (depthInfo.rawValueToMeters || 0.001));
		gl.uniform1f(copyLocs.depthNearZ, profile.nearZ != null ? profile.nearZ : 0);
		gl.uniform1f(copyLocs.depthEncodingMode, DEPTH_ENCODING_SOURCE_RAW);
	};
	const canonicalizeGpuArrayDepth = function(depthInfo, args) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		const depthProfile = args && args.depthProfile ? args.depthProfile : {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
		const stabilizedBool = getDepthQualityMode(args && args.processingConfig ? args.processingConfig : null) === DEPTH_QUALITY_MODE_STABILIZED;
		if (!webgl2Bool || !depthInfo.texture || !ensureArrayTarget(depthInfo.width, depthInfo.height, stabilizedBool)) {
			return null;
		}
		ensureArrayCopyProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, arrayTargetFramebuffer);
		gl.viewport(0, 0, arrayTargetWidth, arrayTargetHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(arrayCopyProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D_ARRAY, depthInfo.texture);
		gl.uniform1i(arrayCopyLocs.sourceDepthTexture, 0);
		gl.uniform1i(arrayCopyLocs.sourceDepthLayer, depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0));
		bindCanonicalCopyUniforms(arrayCopyLocs, depthInfo, depthProfile, args && args.processingConfig ? args.processingConfig : null);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(arrayCopyLocs.position);
		gl.vertexAttribPointer(arrayCopyLocs.position, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
		gl.viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);
		return buildCanonicalDepthState(arrayTargetTexture, DEPTH_ENCODING_LINEAR_VIEW_Z, depthProfile, depthProfile.linearScale, identityMatrix());
	};
	const canonicalizeGpuTextureDepth = function(depthInfo, args) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		const depthProfile = args && args.depthProfile ? args.depthProfile : {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
		const stabilizedBool = getDepthQualityMode(args && args.processingConfig ? args.processingConfig : null) === DEPTH_QUALITY_MODE_STABILIZED;
		if (!webgl2Bool || !depthInfo.texture || !ensureArrayTarget(depthInfo.width, depthInfo.height, stabilizedBool)) {
			return null;
		}
		ensureTextureCopyProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, arrayTargetFramebuffer);
		gl.viewport(0, 0, arrayTargetWidth, arrayTargetHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(textureCopyProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, depthInfo.texture);
		gl.uniform1i(textureCopyLocs.sourceDepthTexture, 0);
		bindCanonicalCopyUniforms(textureCopyLocs, depthInfo, depthProfile, args && args.processingConfig ? args.processingConfig : null);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(textureCopyLocs.position);
		gl.vertexAttribPointer(textureCopyLocs.position, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
		gl.viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);
		return buildCanonicalDepthState(arrayTargetTexture, DEPTH_ENCODING_LINEAR_VIEW_Z, depthProfile, depthProfile.linearScale, identityMatrix());
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
		// Consumers sample this processed texture directly, so centralize the upscale here.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
	const resolveTargetDepthTextureSize = function(depthInfo, viewport) {
		const sourceWidth = Math.max(1, depthInfo && depthInfo.width ? depthInfo.width | 0 : 1);
		const sourceHeight = Math.max(1, depthInfo && depthInfo.height ? depthInfo.height | 0 : 1);
		return {
			width: sourceWidth,
			height: sourceHeight
		};
	};
	const ensureInverseReprojectProgram = function() {
		if (targetDepthProgram) {
			return;
		}
		// Inverse reprojection: for each render pixel, look up the processed sensor depth.
		// Canonicalization already normalized raw depth into one shared sampling contract.
		const vs = [
			"#version 300 es\n",
			"precision highp float;",
			"in vec2 position;",
			"out vec2 vScreenUv;",
			"void main(){",
			"vScreenUv=position*0.5+0.5;",
			"gl_Position=vec4(position,0.0,1.0);",
			"}"
		].join("");
		// Input: canonical depth texture (raw or stabilized linear meters).
		const fs = [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D depthTexture;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform float depthEncodingMode;",
			"uniform vec4 sourceProjectionParams;",
			"uniform vec4 targetProjectionParams;",
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
			"vec3 renderViewPt=vec3(renderRay*1.5,-1.5);",
			"vec4 worldPt=targetWorldFromView*vec4(renderViewPt,1.0);",
			"vec4 sensorViewPt=sourceViewMatrix*worldPt;",
			"if(-sensorViewPt.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){discard;}",
			"float invSZ=1.0/max(-sensorViewPt.z,0.0001);",
			"vec2 sensorNDC=vec2(",
			"sensorViewPt.x*invSZ*sourceProjectionParams.x-sourceProjectionParams.z,",
			"sensorViewPt.y*invSZ*sourceProjectionParams.y-sourceProjectionParams.w);",
			"vec2 sensorUV=sensorNDC*0.5+0.5;",
			"if(sensorUV.x<0.0||sensorUV.x>1.0||sensorUV.y<0.0||sensorUV.y>1.0){discard;}",
			// Hardware bilinear sample; decode raw to meters inline
			"float depthMeters=decodeDepth(texture(depthTexture,sensorUV).r);",
			"if(depthMeters<=0.0001){discard;}",
			"vec3 sensorRayDir=vec3(sensorViewPt.xy*invSZ,-1.0);",
			"vec3 actualSensorPt=sensorRayDir*depthMeters;",
			"vec4 actualWorldPt=sourceWorldFromView*vec4(actualSensorPt,1.0);",
			"vec4 actualRenderPt=targetViewMatrix*actualWorldPt;",
			"if(-actualRenderPt.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){discard;}",
			"vec4 clip=targetProjMatrix*actualRenderPt;",
			"float clipW=max(clip.w,0.0001);",
			"if(abs(clip.x)>clipW*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "||abs(clip.y)>clipW*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "){discard;}",
			"gl_FragDepth=clamp(clip.z/clipW*0.5+0.5,0.0,1.0);",
			"fragColor=vec4(max(0.0,-actualRenderPt.z),0.0,0.0,1.0);",
			"}"
		].join("");
		targetDepthProgram = createProgram(gl, vs, fs, "Inverse depth reprojection");
		targetDepthLocs = {
			position:               gl.getAttribLocation(targetDepthProgram,  "position"),
			depthTexture:           gl.getUniformLocation(targetDepthProgram, "depthTexture"),
			rawValueToMeters:       gl.getUniformLocation(targetDepthProgram, "rawValueToMeters"),
			depthNearZ:             gl.getUniformLocation(targetDepthProgram, "depthNearZ"),
			depthEncodingMode:      gl.getUniformLocation(targetDepthProgram, "depthEncodingMode"),
			sourceProjectionParams: gl.getUniformLocation(targetDepthProgram, "sourceProjectionParams"),
			targetProjectionParams: gl.getUniformLocation(targetDepthProgram, "targetProjectionParams"),
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
		const targetTextureSize = resolveTargetDepthTextureSize(depthInfo, viewport);
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
		args.targetDepthTextureSize = targetTextureSize;
		return targetDepthTexture;
	};
	return {
		init: function() {
			buffer = createFullscreenTriangleBuffer(gl);
			arrayTargetConfig = selectFloatTargetConfig();
		},
		process: function(args) {
			const depthInfo = args && args.depthInfo ? args.depthInfo : null;
			let canonicalDepthState = null;
			let targetTexture = null;
			if (!depthInfo || depthInfo.isValid === false) {
				return null;
			}
			if (depthInfo.texture && depthInfo.textureType === "texture-array") {
				canonicalDepthState = canonicalizeGpuArrayDepth(depthInfo, args || null);
			} else if (depthInfo.texture) {
				if (getDepthQualityMode(args && args.processingConfig ? args.processingConfig : null) === DEPTH_QUALITY_MODE_STABILIZED) {
					canonicalDepthState = canonicalizeGpuTextureDepth(depthInfo, args || null);
				}
				if (!canonicalDepthState) {
					canonicalDepthState = buildCanonicalDepthState(
						depthInfo.texture,
						DEPTH_ENCODING_SOURCE_RAW,
						args && args.depthProfile ? args.depthProfile : {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0},
						depthInfo.rawValueToMeters || 0.001,
						depthInfo.normDepthBufferFromNormView || identityMatrix()
					);
				}
			} else if (depthInfo.data && depthInfo.width && depthInfo.height) {
				canonicalDepthState = ensureCpuTexture(depthInfo, args || null);
			}
			if (!canonicalDepthState || !canonicalDepthState.texture) {
				return null;
			}
			targetTexture = inverseReprojectDepth(depthInfo, args || {}, canonicalDepthState);
			if (targetTexture) {
				return buildTargetDepthInfo(args || {}, targetTexture);
			}
			return buildCanonicalDepthInfo(depthInfo, canonicalDepthState);
		}
	};
};
