// Canonical depth adapter for raw depth plus spatial reprojection.

const DEFAULT_DEPTH_REPROJECTION_GRID_FACTOR = 0.75;
const DEPTH_ENCODING_SOURCE_RAW = 0;
const DEPTH_ENCODING_LINEAR_VIEW_Z = 1;

const getDepthReprojectionGridFactor = function(processingConfig) {
	const factor = processingConfig && processingConfig.reprojectionGridFactor != null ? Number(processingConfig.reprojectionGridFactor) : DEFAULT_DEPTH_REPROJECTION_GRID_FACTOR;
	if (!Number.isFinite(factor)) {
		return DEFAULT_DEPTH_REPROJECTION_GRID_FACTOR;
	}
	return clampNumber(factor, 0.25, 1);
};

const getDepthReprojectionGridDimensions = function(depthInfo, processingConfig) {
	const safeDepthWidth = Math.max(1, depthInfo && depthInfo.width ? depthInfo.width | 0 : 1);
	const safeDepthHeight = Math.max(1, depthInfo && depthInfo.height ? depthInfo.height | 0 : 1);
	const factor = getDepthReprojectionGridFactor(processingConfig);
	return {
		columns: clampNumber(Math.round(safeDepthWidth * factor), 1, safeDepthWidth),
		rows: clampNumber(Math.round(safeDepthHeight * factor), 1, safeDepthHeight)
	};
};

const createDepthReprojectionTriangleBuffer = function(gl, columns, rows) {
	const safeColumns = Math.max(1, columns | 0);
	const safeRows = Math.max(1, rows | 0);
	const triangleCount = safeColumns * safeRows * 2;
	const floatsPerVertex = 8;
	const vertices = new Float32Array(triangleCount * 3 * floatsPerVertex);
	let writeIndex = 0;
	const writeTriangle = function(ax, ay, bx, by, cx, cy) {
		vertices[writeIndex] = ax; vertices[writeIndex + 1] = ay;
		vertices[writeIndex + 2] = ax; vertices[writeIndex + 3] = ay;
		vertices[writeIndex + 4] = bx; vertices[writeIndex + 5] = by;
		vertices[writeIndex + 6] = cx; vertices[writeIndex + 7] = cy;
		vertices[writeIndex + 8] = bx; vertices[writeIndex + 9] = by;
		vertices[writeIndex + 10] = ax; vertices[writeIndex + 11] = ay;
		vertices[writeIndex + 12] = bx; vertices[writeIndex + 13] = by;
		vertices[writeIndex + 14] = cx; vertices[writeIndex + 15] = cy;
		vertices[writeIndex + 16] = cx; vertices[writeIndex + 17] = cy;
		vertices[writeIndex + 18] = ax; vertices[writeIndex + 19] = ay;
		vertices[writeIndex + 20] = bx; vertices[writeIndex + 21] = by;
		vertices[writeIndex + 22] = cx; vertices[writeIndex + 23] = cy;
		writeIndex += 24;
	};
	for (let y = 0; y < safeRows; y += 1) {
		const v0 = y / safeRows;
		const v1 = (y + 1) / safeRows;
		for (let x = 0; x < safeColumns; x += 1) {
			const u0 = x / safeColumns;
			const u1 = (x + 1) / safeColumns;
			writeTriangle(u0, v0, u1, v0, u0, v1);
			writeTriangle(u0, v1, u1, v0, u1, v1);
		}
	}
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
	return {
		buffer: buffer,
		vertexCount: triangleCount * 3,
		strideBytes: floatsPerVertex * 4
	};
};

const ensureDepthReprojectionGrid = function(gl, grid, depthInfo, processingConfig) {
	const dimensions = getDepthReprojectionGridDimensions(depthInfo, processingConfig);
	if (grid && grid.buffer && grid.columns === dimensions.columns && grid.rows === dimensions.rows) {
		return grid;
	}
	if (grid && grid.buffer) {
		gl.deleteBuffer(grid.buffer);
	}
	grid = createDepthReprojectionTriangleBuffer(gl, dimensions.columns, dimensions.rows);
	grid.columns = dimensions.columns;
	grid.rows = dimensions.rows;
	return grid;
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
	let reprojectionGrid = null;
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
	const ensureTargetDepthProgram = function() {
		if (targetDepthProgram) {
			return;
		}
		targetDepthProgram = createProgram(gl, [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D depthTexture;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform vec4 sourceProjectionParams;",
			"uniform mat4 sourceWorldFromView;",
			"uniform mat4 targetView;",
			"uniform mat4 targetProj;",
			"in vec2 sourceUv;",
			"in vec2 triangleUvA;",
			"in vec2 triangleUvB;",
			"in vec2 triangleUvC;",
			"out vec2 vSourceUv;",
			"out vec2 vTriangleUvA;",
			"out vec2 vTriangleUvB;",
			"out vec2 vTriangleUvC;",
			"out float vDepthValid;",
			"bool isTargetPointUsable(vec4 targetViewPoint, vec4 clip){",
			"if(-targetViewPoint.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){return false;}",
			"if(clip.w<=0.0001){return false;}",
			"if(abs(clip.x)>clip.w*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "){return false;}",
			"if(abs(clip.y)>clip.w*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "){return false;}",
			"return true;",
			"}",
			"vec3 getSourceViewPoint(vec2 uv,float depthMeters){",
			"vec2 ndc=uv*2.0-1.0;",
			"vec2 viewRay=vec2((ndc.x+sourceProjectionParams.z)/sourceProjectionParams.x,(ndc.y+sourceProjectionParams.w)/sourceProjectionParams.y);",
			"return vec3(viewRay*depthMeters,-depthMeters);",
			"}",
			"void main(){",
			"vSourceUv=sourceUv;",
			"vTriangleUvA=triangleUvA;",
			"vTriangleUvB=triangleUvB;",
			"vTriangleUvC=triangleUvC;",
			"float normalizedDepth=texture(depthTexture,sourceUv).r;",
			"if(normalizedDepth<=0.0001){",
			"vDepthValid=0.0;",
			"gl_Position=vec4(2.0,2.0,1.0,1.0);",
			"return;",
			"}",
			"float depthMeters=depthNearZ>0.0?depthNearZ/max(1.0-normalizedDepth,0.0001):normalizedDepth*rawValueToMeters;",
			"vec4 worldPoint=sourceWorldFromView*vec4(getSourceViewPoint(sourceUv,depthMeters),1.0);",
			"vec4 targetViewPoint=targetView*worldPoint;",
			"vec4 clip=targetProj*targetViewPoint;",
			"if(!isTargetPointUsable(targetViewPoint,clip)){",
			"vDepthValid=0.0;",
			"gl_Position=vec4(2.0,2.0,1.0,1.0);",
			"return;",
			"}",
			"vDepthValid=1.0;",
			"gl_Position=clip;",
			"}"
		].join(""), [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D depthTexture;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform vec4 sourceProjectionParams;",
			"uniform mat4 sourceWorldFromView;",
			"uniform mat4 targetView;",
			"uniform mat4 targetProj;",
			"in vec2 vSourceUv;",
			"in vec2 vTriangleUvA;",
			"in vec2 vTriangleUvB;",
			"in vec2 vTriangleUvC;",
			"in float vDepthValid;",
			"out vec4 fragColor;",
			"bool isTriangleCornerUsable(vec2 uv){",
			"float rawDepth=texture(depthTexture,uv).r;",
			"if(rawDepth<=0.0001){return false;}",
			"float sourceDepthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
			"vec2 ndc=uv*2.0-1.0;",
			"vec2 viewRay=vec2((ndc.x+sourceProjectionParams.z)/sourceProjectionParams.x,(ndc.y+sourceProjectionParams.w)/sourceProjectionParams.y);",
			"vec4 targetViewPoint=targetView*(sourceWorldFromView*vec4(vec3(viewRay*sourceDepthMeters,-sourceDepthMeters),1.0));",
			"vec4 targetClip=targetProj*targetViewPoint;",
			"if(-targetViewPoint.z<" + SPATIAL_DEPTH_NEAR_GUARD_METERS.toFixed(3) + "){return false;}",
			"if(targetClip.w<=0.0001){return false;}",
			"if(abs(targetClip.x)>targetClip.w*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "){return false;}",
			"if(abs(targetClip.y)>targetClip.w*" + SPATIAL_DEPTH_CLIP_MARGIN.toFixed(3) + "){return false;}",
			"return true;",
			"}",
			"void main(){",
			"if(vDepthValid<=0.0){discard;}",
			"if(!isTriangleCornerUsable(vTriangleUvA)||!isTriangleCornerUsable(vTriangleUvB)||!isTriangleCornerUsable(vTriangleUvC)){discard;}",
			"float rawDepth=texture(depthTexture,vSourceUv).r;",
			"if(rawDepth<=0.0001){discard;}",
			"float sourceDepthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
			"vec2 ndc=vSourceUv*2.0-1.0;",
			"vec2 viewRay=vec2((ndc.x+sourceProjectionParams.z)/sourceProjectionParams.x,(ndc.y+sourceProjectionParams.w)/sourceProjectionParams.y);",
			"vec4 targetViewPoint=targetView*(sourceWorldFromView*vec4(vec3(viewRay*sourceDepthMeters,-sourceDepthMeters),1.0));",
			"vec4 targetClip=targetProj*targetViewPoint;",
			"float clipW=max(targetClip.w,0.0001);",
			"gl_FragDepth=clamp(targetClip.z/clipW*0.5+0.5,0.0,1.0);",
			"fragColor=vec4(max(0.0,-targetViewPoint.z),0.0,0.0,1.0);",
			"}"
		].join(""), "Target-space depth reprojection");
		targetDepthLocs = {
			sourceUv: gl.getAttribLocation(targetDepthProgram, "sourceUv"),
			triangleUvA: gl.getAttribLocation(targetDepthProgram, "triangleUvA"),
			triangleUvB: gl.getAttribLocation(targetDepthProgram, "triangleUvB"),
			triangleUvC: gl.getAttribLocation(targetDepthProgram, "triangleUvC"),
			depthTexture: gl.getUniformLocation(targetDepthProgram, "depthTexture"),
			rawValueToMeters: gl.getUniformLocation(targetDepthProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(targetDepthProgram, "depthNearZ"),
			sourceProjectionParams: gl.getUniformLocation(targetDepthProgram, "sourceProjectionParams"),
			sourceWorldFromView: gl.getUniformLocation(targetDepthProgram, "sourceWorldFromView"),
			targetView: gl.getUniformLocation(targetDepthProgram, "targetView"),
			targetProj: gl.getUniformLocation(targetDepthProgram, "targetProj")
		};
	};
	const reprojectCanonicalDepth = function(depthInfo, args, canonicalTexture) {
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
			!reprojectionState.sourceWorldFromViewMatrix ||
			!reprojectionState.sourceProjectionParams ||
			!args.targetViewMatrix ||
			!args.targetProjMatrix ||
			!ensureTargetDepthResources(viewport.width, viewport.height)
		) {
			return null;
		}
		ensureTargetDepthProgram();
		reprojectionGrid = ensureDepthReprojectionGrid(gl, reprojectionGrid, depthInfo, args && args.processingConfig ? args.processingConfig : null);
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
		gl.uniform4f(
			targetDepthLocs.sourceProjectionParams,
			reprojectionState.sourceProjectionParams.xScale,
			reprojectionState.sourceProjectionParams.yScale,
			reprojectionState.sourceProjectionParams.xOffset,
			reprojectionState.sourceProjectionParams.yOffset
		);
		gl.uniformMatrix4fv(targetDepthLocs.sourceWorldFromView, false, reprojectionState.sourceWorldFromViewMatrix);
		gl.uniformMatrix4fv(targetDepthLocs.targetView, false, args.targetViewMatrix);
		gl.uniformMatrix4fv(targetDepthLocs.targetProj, false, args.targetProjMatrix);
		gl.bindBuffer(gl.ARRAY_BUFFER, reprojectionGrid.buffer);
		gl.enableVertexAttribArray(targetDepthLocs.sourceUv);
		gl.vertexAttribPointer(targetDepthLocs.sourceUv, 2, gl.FLOAT, false, reprojectionGrid.strideBytes || 0, 0);
		gl.enableVertexAttribArray(targetDepthLocs.triangleUvA);
		gl.vertexAttribPointer(targetDepthLocs.triangleUvA, 2, gl.FLOAT, false, reprojectionGrid.strideBytes || 0, 8);
		gl.enableVertexAttribArray(targetDepthLocs.triangleUvB);
		gl.vertexAttribPointer(targetDepthLocs.triangleUvB, 2, gl.FLOAT, false, reprojectionGrid.strideBytes || 0, 16);
		gl.enableVertexAttribArray(targetDepthLocs.triangleUvC);
		gl.vertexAttribPointer(targetDepthLocs.triangleUvC, 2, gl.FLOAT, false, reprojectionGrid.strideBytes || 0, 24);
		gl.drawArrays(gl.TRIANGLES, 0, reprojectionGrid.vertexCount);
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
			targetTexture = reprojectCanonicalDepth(depthInfo, args || {}, canonicalTexture);
			if (targetTexture) {
				return buildTargetDepthInfo(args || {}, targetTexture);
			}
			return buildCanonicalDepthInfo(depthInfo, canonicalTexture);
		}
	};
};
