// Canonical depth adapter for raw depth plus inverse reprojection.
// Raw sensor data is fed directly to the inverse reprojection shader;
// hardware bilinear upscaling (LINEAR filter) handles the 320x320 → render-res step for free.

const DEPTH_ENCODING_SOURCE_RAW = 0;
const DEPTH_ENCODING_LINEAR_VIEW_Z = 1;

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
	let cpuTextureParamsSet = false;
	let arrayCopyProgram = null;
	let arrayCopyLocs = null;
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
	const ensureArrayTarget = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (arrayTargetTexture && arrayTargetFramebuffer && arrayTargetWidth === safeWidth && arrayTargetHeight === safeHeight) {
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
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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
	const buildCanonicalDepthInfo = function(depthInfo, texture) {
		return {
			texture: texture || null,
			width: depthInfo.width || 0,
			height: depthInfo.height || 0,
			depthEncodingMode: DEPTH_ENCODING_SOURCE_RAW,
			rawValueToMeters: depthInfo.rawValueToMeters || 0.001,
			normDepthBufferFromNormView: depthInfo.normDepthBufferFromNormView || identityMatrix()
		};
	};
	const buildTargetDepthInfo = function(args, texture) {
		const viewport = args && args.viewport ? args.viewport : null;
		const safeWidth = viewport && viewport.width ? viewport.width | 0 : 0;
		const safeHeight = viewport && viewport.height ? viewport.height | 0 : 0;
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
	const ensureCpuTexture = function(depthInfo) {
		const pixelCount = (depthInfo.width | 0) * (depthInfo.height | 0);
		const sourceData = depthInfo.data instanceof Uint16Array ? depthInfo.data : new Uint16Array(depthInfo.data);
		if (!cpuTexture) {
			cpuTexture = gl.createTexture();
		}
		if (!cpuUploadBuffer || cpuUploadBuffer.length < pixelCount) {
			cpuUploadBuffer = new Float32Array(pixelCount);
		}
		cpuUploadBuffer.set(sourceData.subarray(0, pixelCount));
		gl.bindTexture(gl.TEXTURE_2D, cpuTexture);
		if (webgl2Bool) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, depthInfo.width, depthInfo.height, 0, gl.RED, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
		} else {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, depthInfo.width, depthInfo.height, 0, gl.LUMINANCE, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
		}
		if (!cpuTextureParamsSet) {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			cpuTextureParamsSet = true;
		}
		return cpuTexture;
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
		].join(""), [
			"#version 300 es\n",
			"precision highp float;",
			"precision mediump sampler2DArray;",
			"uniform sampler2DArray sourceDepthTexture;",
			"uniform int sourceDepthLayer;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			"void main(){",
			"float rawDepth=texture(sourceDepthTexture,vec3(vScreenUv,float(sourceDepthLayer))).r;",
			"fragColor=vec4(rawDepth,0.0,0.0,1.0);",
			"}"
		].join(""), "Canonical depth array copy");
		arrayCopyLocs = {
			position: gl.getAttribLocation(arrayCopyProgram, "position"),
			sourceDepthTexture: gl.getUniformLocation(arrayCopyProgram, "sourceDepthTexture"),
			sourceDepthLayer: gl.getUniformLocation(arrayCopyProgram, "sourceDepthLayer")
		};
	};
	const canonicalizeGpuArrayDepth = function(depthInfo) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (!webgl2Bool || !depthInfo.texture || !ensureArrayTarget(depthInfo.width, depthInfo.height)) {
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
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(arrayCopyLocs.position);
		gl.vertexAttribPointer(arrayCopyLocs.position, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
		gl.viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);
		return arrayTargetTexture;
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
	const ensureInverseReprojectProgram = function() {
		if (targetDepthProgram) {
			return;
		}
		// Inverse reprojection: for each render pixel, look up depth in sensor space.
		// Raw sensor depth is decoded inline; hardware bilinear (LINEAR filter) handles upscaling.
		// Zero-depth samples are discarded.
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
		// Input: raw canonical depth texture (LINEAR filter, hardware bilinear upscaling).
		const fs = [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D depthTexture;",         // raw depth, LINEAR filter
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform vec4 sourceProjectionParams;",
			"uniform vec4 targetProjectionParams;",
			"uniform mat4 sourceWorldFromView;",
			"uniform mat4 sourceViewMatrix;",
			"uniform mat4 targetWorldFromView;",
			"uniform mat4 targetViewMatrix;",
			"uniform mat4 targetProjMatrix;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			"float decodeDepth(float raw){",
			"if(raw<=0.0001)return 0.0;",
			"return depthNearZ>0.0?depthNearZ/max(1.0-raw,0.0001):raw*rawValueToMeters;",
			"}",
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
			sourceProjectionParams: gl.getUniformLocation(targetDepthProgram, "sourceProjectionParams"),
			targetProjectionParams: gl.getUniformLocation(targetDepthProgram, "targetProjectionParams"),
			sourceWorldFromView:    gl.getUniformLocation(targetDepthProgram, "sourceWorldFromView"),
			sourceViewMatrix:       gl.getUniformLocation(targetDepthProgram, "sourceViewMatrix"),
			targetWorldFromView:    gl.getUniformLocation(targetDepthProgram, "targetWorldFromView"),
			targetViewMatrix:       gl.getUniformLocation(targetDepthProgram, "targetViewMatrix"),
			targetProjMatrix:       gl.getUniformLocation(targetDepthProgram, "targetProjMatrix")
		};
	};
	const inverseReprojectDepth = function(depthInfo, args, canonicalTexture) {
		const viewport = args && args.viewport ? args.viewport : null;
		const reprojectionState = args && args.depthReprojectionState ? args.depthReprojectionState : null;
		const depthProfile = args && args.depthProfile ? args.depthProfile : null;
		const profile = depthProfile || {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (
			!webgl2Bool ||
			!canonicalTexture ||
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
			!ensureTargetDepthResources(viewport.width, viewport.height)
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
		gl.bindTexture(gl.TEXTURE_2D, canonicalTexture);
		gl.uniform1i(targetDepthLocs.depthTexture, 0);
		gl.uniform1f(targetDepthLocs.rawValueToMeters, profile.linearScale != null ? profile.linearScale : (depthInfo.rawValueToMeters || 0.001));
		gl.uniform1f(targetDepthLocs.depthNearZ, profile.nearZ != null ? profile.nearZ : 0);
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
		return targetDepthTexture;
	};
	return {
		init: function() {
			buffer = createFullscreenTriangleBuffer(gl);
			arrayTargetConfig = selectFloatTargetConfig();
		},
		process: function(args) {
			const depthInfo = args && args.depthInfo ? args.depthInfo : null;
			let canonicalTexture = null;
			let targetTexture = null;
			if (!depthInfo || depthInfo.isValid === false) {
				return null;
			}
			if (depthInfo.texture && depthInfo.textureType === "texture-array") {
				canonicalTexture = canonicalizeGpuArrayDepth(depthInfo);
			} else if (depthInfo.texture) {
				canonicalTexture = depthInfo.texture;
			} else if (depthInfo.data && depthInfo.width && depthInfo.height) {
				canonicalTexture = ensureCpuTexture(depthInfo);
			}
			if (!canonicalTexture) {
				return null;
			}
			targetTexture = inverseReprojectDepth(depthInfo, args || {}, canonicalTexture);
			if (targetTexture) {
				return buildTargetDepthInfo(args || {}, targetTexture);
			}
			return buildCanonicalDepthInfo(depthInfo, canonicalTexture);
		}
	};
};
