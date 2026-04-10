// Canonical depth adapter for raw depth plus spatial reprojection.

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
	const selectArrayTargetConfig = function() {
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
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
	const buildCanonicalDepthInfo = function(depthInfo, args, texture) {
		return {
			texture: texture || null,
			textureType: "texture-2d",
			width: depthInfo.width || 0,
			height: depthInfo.height || 0,
			rawValueToMeters: depthInfo.rawValueToMeters || 0.001,
			normDepthBufferFromNormView: depthInfo.normDepthBufferFromNormView || identityMatrix(),
			depthReprojectionState: args.depthReprojectionState || null
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
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
	return {
		init: function() {
			buffer = createFullscreenTriangleBuffer(gl);
			arrayTargetConfig = selectArrayTargetConfig();
			console.log("[Depth] canonical adapter active");
		},
		process: function(args) {
			const depthInfo = args && args.depthInfo ? args.depthInfo : null;
			let canonicalTexture = null;
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
			return buildCanonicalDepthInfo(depthInfo, args || {}, canonicalTexture);
		}
	};
};
