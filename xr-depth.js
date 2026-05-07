// Depth processing stays centralized here.
// The pipeline is fixed: decode current per-eye source depth, smooth it once at
// native depth resolution, then spline-upscale into screen-space consumer textures.

const DEPTH_ENCODING_SOURCE_RAW = 0;
const DEPTH_ENCODING_LINEAR_VIEW_Z = 1;
const DEPTH_VISIBILITY_COVERAGE_THRESHOLD = 0.35;

const createDepthProcessingRenderer = function(options) {
	options = options || {};
	const gl = options.gl;
	const webgl2Bool = !!options.webgl2Bool;

	let buffer = null;
	let floatTargetConfig = null;

	let canonicalProgram = null;
	let canonicalLocs = null;
	let smoothProgram = null;
	let smoothLocs = null;
	let finalProgram = null;
	let finalLocs = null;
	let visibilityProgram = null;
	let visibilityLocs = null;

	let canonicalTexture = null;
	let canonicalFramebuffer = null;
	let canonicalWidth = 0;
	let canonicalHeight = 0;
	let smoothXTexture = null;
	let smoothXFramebuffer = null;
	let smoothYTexture = null;
	let smoothYFramebuffer = null;
	let smoothWidth = 0;
	let smoothHeight = 0;
	let finalTexture = null;
	let finalCoverageTexture = null;
	let finalFramebuffer = null;
	let finalDepthBuffer = null;
	let finalWidth = 0;
	let finalHeight = 0;
	let visibilityTexture = null;
	let visibilityFramebuffer = null;
	let visibilityWidth = 0;
	let visibilityHeight = 0;
	let cpuDepthTexture = null;
	let cpuDepthWidth = 0;
	let cpuDepthHeight = 0;
	let cpuDepthFormatKey = "";

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

	const resolveDepthDecodeParams = function(depthSourcePacket, sourceEncodingMode) {
		if (sourceEncodingMode === DEPTH_ENCODING_LINEAR_VIEW_Z) {
			return {linearScale: 1, nearZ: 0};
		}
		if (depthSourcePacket && depthSourcePacket.depthDecodeMode === "gpuHyperbolic") {
			return {linearScale: depthSourcePacket.rawValueToMeters || 1, nearZ: depthSourcePacket.depthNearZ || 0.1};
		}
		return {linearScale: depthSourcePacket && depthSourcePacket.rawValueToMeters ? depthSourcePacket.rawValueToMeters : 0.001, nearZ: 0};
	};

	const resolveDepthEncodingMode = function(depthInfo) {
		if (!depthInfo || depthInfo.depthEncodingMode == null) {
			return DEPTH_ENCODING_SOURCE_RAW;
		}
		return Number(depthInfo.depthEncodingMode) === DEPTH_ENCODING_LINEAR_VIEW_Z ? DEPTH_ENCODING_LINEAR_VIEW_Z : DEPTH_ENCODING_SOURCE_RAW;
	};

	const ensureFloatTexture = function(texture, width, height, filter) {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, floatTargetConfig.internalFormat, width, height, 0, floatTargetConfig.format, floatTargetConfig.type, null);
	};

	const ensureSingleAttachmentTarget = function(texture, framebuffer, width, height, filter) {
		ensureFloatTexture(texture, width, height, filter);
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
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
		return ensureSingleAttachmentTarget(canonicalTexture, canonicalFramebuffer, canonicalWidth, canonicalHeight, gl.NEAREST);
	};

	const ensureSmoothResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (smoothXTexture && smoothXFramebuffer && smoothYTexture && smoothYFramebuffer && smoothWidth === safeWidth && smoothHeight === safeHeight) {
			return true;
		}
		smoothWidth = safeWidth;
		smoothHeight = safeHeight;
		if (!smoothXTexture) {
			smoothXTexture = gl.createTexture();
		}
		if (!smoothXFramebuffer) {
			smoothXFramebuffer = gl.createFramebuffer();
		}
		if (!smoothYTexture) {
			smoothYTexture = gl.createTexture();
		}
		if (!smoothYFramebuffer) {
			smoothYFramebuffer = gl.createFramebuffer();
		}
		return ensureSingleAttachmentTarget(smoothXTexture, smoothXFramebuffer, smoothWidth, smoothHeight, gl.LINEAR) && ensureSingleAttachmentTarget(smoothYTexture, smoothYFramebuffer, smoothWidth, smoothHeight, gl.LINEAR);
	};

	const ensureFinalResources = function(width, height) {
		const safeWidth = Math.max(1, width | 0);
		const safeHeight = Math.max(1, height | 0);
		if (finalTexture && finalCoverageTexture && finalFramebuffer && finalDepthBuffer && finalWidth === safeWidth && finalHeight === safeHeight) {
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
		if (!finalDepthBuffer) {
			finalDepthBuffer = gl.createRenderbuffer();
		}
		ensureFloatTexture(finalTexture, finalWidth, finalHeight, gl.LINEAR);
		ensureFloatTexture(finalCoverageTexture, finalWidth, finalHeight, gl.LINEAR);
		gl.bindFramebuffer(gl.FRAMEBUFFER, finalFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, finalTexture, 0);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, finalCoverageTexture, 0);
		gl.bindRenderbuffer(gl.RENDERBUFFER, finalDepthBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, finalWidth, finalHeight);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, finalDepthBuffer);
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
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, visibilityWidth, visibilityHeight, 0, gl.RED, gl.UNSIGNED_BYTE, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, visibilityFramebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, visibilityTexture, 0);
		return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
	};

	const updateCpuDepthTexture = function(depthInfo) {
		if (!depthInfo || !depthInfo.data || !depthInfo.width || !depthInfo.height || !webgl2Bool) {
			return null;
		}
		const formatKey = depthInfo.data instanceof Uint8Array || depthInfo.depthDataFormat === "luminance-alpha" ? "rg8" : "r32f";
		if (!cpuDepthTexture || cpuDepthWidth !== depthInfo.width || cpuDepthHeight !== depthInfo.height || cpuDepthFormatKey !== formatKey) {
			if (cpuDepthTexture) {
				gl.deleteTexture(cpuDepthTexture);
			}
			cpuDepthTexture = gl.createTexture();
			cpuDepthWidth = depthInfo.width;
			cpuDepthHeight = depthInfo.height;
			cpuDepthFormatKey = formatKey;
			gl.bindTexture(gl.TEXTURE_2D, cpuDepthTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		} else {
			gl.bindTexture(gl.TEXTURE_2D, cpuDepthTexture);
		}
		if (formatKey === "rg8") {
			const data = depthInfo.data instanceof Uint8Array ? depthInfo.data : new Uint8Array(depthInfo.data);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, depthInfo.width, depthInfo.height, 0, gl.RG, gl.UNSIGNED_BYTE, data);
		} else {
			const data = depthInfo.data instanceof Float32Array ? depthInfo.data : new Float32Array(depthInfo.data);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, depthInfo.width, depthInfo.height, 0, gl.RED, gl.FLOAT, data);
		}
		return cpuDepthTexture;
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
			"in vec2 vScreenUv;",
			"layout(location=0) out vec4 fragColor;",
			"float sampleRawDepth(vec2 uv){",
			"if(useArraySource>0.5){return texture(sourceTextureArray,vec3(uv,float(sourceLayer))).r;}",
			"return texture(sourceTexture2D,uv).r;",
			"}",
			"float decodeDepth(float rawDepth){",
			"if(rawDepth<=0.0001){return 0.0;}",
			"if(sourceEncodingMode>0.5){return rawDepth;}",
			"if(useArraySource>0.5&&depthNearZ>0.0){return rawValueToMeters*depthNearZ/max(1.0-rawDepth,0.0001);}",
			"return rawDepth*rawValueToMeters;",
			"}",
			"void main(){",
			"vec2 uv=vScreenUv;",
			"if(useArraySource<0.5){uv.y=1.0-uv.y;}",
			"float depthMeters=decodeDepth(sampleRawDepth(uv));",
			"float valid=depthMeters>0.0001?1.0:0.0;",
			"fragColor=vec4(depthMeters,valid,0.0,1.0);",
			"}"
		].join(""), "Depth canonicalize screen-space");
		canonicalLocs = {
			position: gl.getAttribLocation(canonicalProgram, "position"),
			sourceTexture2D: gl.getUniformLocation(canonicalProgram, "sourceTexture2D"),
			sourceTextureArray: gl.getUniformLocation(canonicalProgram, "sourceTextureArray"),
			useArraySource: gl.getUniformLocation(canonicalProgram, "useArraySource"),
			sourceLayer: gl.getUniformLocation(canonicalProgram, "sourceLayer"),
			rawValueToMeters: gl.getUniformLocation(canonicalProgram, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(canonicalProgram, "depthNearZ"),
			sourceEncodingMode: gl.getUniformLocation(canonicalProgram, "sourceEncodingMode")
		};
	};

	const canonicalizeDepth = function(depthSourcePacket) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		const depthInfo = depthSourcePacket && depthSourcePacket.depthInfo ? depthSourcePacket.depthInfo : null;
		let sourceTexture = null;
		let useArraySourceBool = false;
		let sourceEncodingMode = DEPTH_ENCODING_SOURCE_RAW;
		if (!depthInfo || depthInfo.isValid === false || !depthInfo.width || !depthInfo.height || (!depthInfo.texture && !depthInfo.data)) {
			return null;
		}
		sourceTexture = depthInfo.texture || updateCpuDepthTexture(depthInfo);
		useArraySourceBool = !!(sourceTexture && (depthSourcePacket.textureType === "texture-array" || sourceTexture.isExternalTexture));
		sourceEncodingMode = resolveDepthEncodingMode(depthInfo);
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
		gl.uniform1i(canonicalLocs.sourceLayer, (depthSourcePacket.viewIndex != null ? depthSourcePacket.viewIndex : (depthSourcePacket.textureLayer != null ? depthSourcePacket.textureLayer : (depthSourcePacket.imageIndex || 0))) | 0);
		gl.uniform1f(canonicalLocs.rawValueToMeters, decodeParams.linearScale);
		gl.uniform1f(canonicalLocs.depthNearZ, decodeParams.nearZ);
		gl.uniform1f(canonicalLocs.sourceEncodingMode, sourceEncodingMode);
		bindFullscreenTriangle(canonicalLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return {
			texture: canonicalTexture,
			width: canonicalWidth,
			height: canonicalHeight
		};
	};

	const ensureSmoothProgram = function() {
		if (smoothProgram) {
			return;
		}
		smoothProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D sourceDepthTexture;",
			"uniform vec2 sourceTexelSize;",
			"uniform vec2 blurAxis;",
			"in vec2 vScreenUv;",
			"layout(location=0) out vec4 fragColor;",
			"vec2 sampleDepthValid(vec2 uv){",
			"vec4 sampleValue=texture(sourceDepthTexture,clamp(uv,vec2(0.0),vec2(1.0)));",
			"return sampleValue.rg;",
			"}",
			"void main(){",
			"float depthSum=0.0;",
			"float weightSum=0.0;",
			"for(int i=-2;i<=2;i+=1){",
			"float offset=float(i);",
			"vec2 sampleValue=sampleDepthValid(vScreenUv+blurAxis*sourceTexelSize*offset);",
			"if(sampleValue.y<=0.001||sampleValue.x<=0.001){continue;}",
			"float weight=offset==0.0?6.0:(abs(offset)<1.5?4.0:1.0);",
			"depthSum+=sampleValue.x*weight;",
			"weightSum+=weight;",
			"}",
			"float depthMeters=weightSum>0.0001?depthSum/weightSum:0.0;",
			"float valid=depthMeters>0.0001?1.0:0.0;",
			"fragColor=vec4(depthMeters,valid,0.0,1.0);",
			"}"
		].join(""), "Depth native smooth");
		smoothLocs = {
			position: gl.getAttribLocation(smoothProgram, "position"),
			sourceDepthTexture: gl.getUniformLocation(smoothProgram, "sourceDepthTexture"),
			sourceTexelSize: gl.getUniformLocation(smoothProgram, "sourceTexelSize"),
			blurAxis: gl.getUniformLocation(smoothProgram, "blurAxis")
		};
	};

	const runSmoothPass = function(sourceTexture, sourceWidth, sourceHeight, framebuffer, targetWidth, targetHeight, axisX, axisY) {
		ensureSmoothProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.viewport(0, 0, targetWidth, targetHeight);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.useProgram(smoothProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
		gl.uniform1i(smoothLocs.sourceDepthTexture, 0);
		gl.uniform2f(smoothLocs.sourceTexelSize, sourceWidth > 0 ? 1 / sourceWidth : 0, sourceHeight > 0 ? 1 / sourceHeight : 0);
		gl.uniform2f(smoothLocs.blurAxis, axisX, axisY);
		bindFullscreenTriangle(smoothLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	};

	const smoothNativeDepth = function(canonicalDepthState) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (!canonicalDepthState || !canonicalDepthState.texture || !ensureSmoothResources(canonicalDepthState.width, canonicalDepthState.height)) {
			return null;
		}
		runSmoothPass(canonicalDepthState.texture, canonicalDepthState.width, canonicalDepthState.height, smoothXFramebuffer, smoothWidth, smoothHeight, 1, 0);
		runSmoothPass(smoothXTexture, smoothWidth, smoothHeight, smoothYFramebuffer, smoothWidth, smoothHeight, 0, 1);
		restoreFramebufferState(previousFramebuffer, previousViewport);
		return {
			texture: smoothYTexture,
			width: smoothWidth,
			height: smoothHeight
		};
	};

	const ensureFinalProgram = function() {
		if (finalProgram) {
			return;
		}
		finalProgram = createProgram(gl, fullscreenVertexSource, [
			"#version 300 es\n",
			"precision highp float;",
			"uniform sampler2D smoothedDepthTexture;",
			"uniform vec2 sourceTexelSize;",
			"uniform vec4 viewProjectionParams;",
			"uniform float radialMetric;",
			"in vec2 vScreenUv;",
			"layout(location=0) out vec4 fragFieldColor;",
			"layout(location=1) out vec4 fragCoverageColor;",
			"vec2 getSourcePixelPos(vec2 depthUv){",
			"vec2 texel=max(sourceTexelSize,vec2(0.0001));",
			"return depthUv/texel-0.5;",
			"}",
			"vec2 sampleTexelDepthValid(vec2 texelCoord){",
			"vec2 texel=max(sourceTexelSize,vec2(0.0001));",
			"vec2 sampleUv=(max(vec2(0.0),texelCoord)+0.5)*texel;",
			"return texture(smoothedDepthTexture,clamp(sampleUv,vec2(0.0),vec2(1.0))).rg;",
			"}",
			"float sampleBilinearDepthMeters(vec2 depthUv){",
			"vec2 sourcePos=getSourcePixelPos(depthUv);",
			"vec2 base=floor(sourcePos);",
			"vec2 frac=clamp(sourcePos-base,0.0,1.0);",
			"vec2 d00=sampleTexelDepthValid(base);",
			"vec2 d10=sampleTexelDepthValid(base+vec2(1.0,0.0));",
			"vec2 d01=sampleTexelDepthValid(base+vec2(0.0,1.0));",
			"vec2 d11=sampleTexelDepthValid(base+vec2(1.0,1.0));",
			"float depthSum=0.0;",
			"float weightSum=0.0;",
			"float w00=(1.0-frac.x)*(1.0-frac.y);",
			"float w10=frac.x*(1.0-frac.y);",
			"float w01=(1.0-frac.x)*frac.y;",
			"float w11=frac.x*frac.y;",
			"if(d00.y>0.001&&d00.x>0.001){depthSum+=d00.x*w00;weightSum+=w00;}",
			"if(d10.y>0.001&&d10.x>0.001){depthSum+=d10.x*w10;weightSum+=w10;}",
			"if(d01.y>0.001&&d01.x>0.001){depthSum+=d01.x*w01;weightSum+=w01;}",
			"if(d11.y>0.001&&d11.x>0.001){depthSum+=d11.x*w11;weightSum+=w11;}",
			"return weightSum>0.0001?depthSum/weightSum:0.0;",
			"}",
			"float bsplineWeight(float x){",
			"x=abs(x);",
			"if(x<1.0){return (4.0-6.0*x*x+3.0*x*x*x)/6.0;}",
			"if(x<2.0){float t=2.0-x;return t*t*t/6.0;}",
			"return 0.0;",
			"}",
			"float sampleSurfaceFitDepthMeters(vec2 depthUv){",
			"vec2 sourcePos=getSourcePixelPos(depthUv);",
			"vec2 base=floor(sourcePos);",
			"float depthSum=0.0;",
			"float weightSum=0.0;",
			"for(int iy=-1;iy<=2;iy+=1){",
			"for(int ix=-1;ix<=2;ix+=1){",
			"vec2 sampleCoord=base+vec2(float(ix),float(iy));",
			"vec2 sampleValue=sampleTexelDepthValid(sampleCoord);",
			"if(sampleValue.y<=0.001||sampleValue.x<=0.001){continue;}",
			"vec2 delta=sourcePos-sampleCoord;",
			"float weight=bsplineWeight(delta.x)*bsplineWeight(delta.y);",
			"depthSum+=sampleValue.x*weight;",
			"weightSum+=weight;",
			"}",
			"}",
			"return weightSum>0.0001?depthSum/weightSum:sampleBilinearDepthMeters(depthUv);",
			"}",
			"float resolveMetricDepth(float planarDepthMeters,vec2 uv){",
			"if(radialMetric<0.5||planarDepthMeters<=0.0001){return planarDepthMeters;}",
			"vec2 ndc=uv*2.0-1.0;",
			"vec2 ray=vec2((ndc.x+viewProjectionParams.z)/viewProjectionParams.x,(ndc.y+viewProjectionParams.w)/viewProjectionParams.y);",
			"return planarDepthMeters*length(vec3(ray,1.0));",
			"}",
			"void main(){",
			"float depthMeters=resolveMetricDepth(sampleSurfaceFitDepthMeters(vScreenUv),vScreenUv);",
			"float valid=depthMeters>0.0001?1.0:0.0;",
			"fragFieldColor=vec4(depthMeters,0.0,0.0,0.0);",
			"fragCoverageColor=vec4(valid,0.0,0.0,1.0);",
			"}"
		].join(""), "Depth screen-space spline upscale");
		finalLocs = {
			position: gl.getAttribLocation(finalProgram, "position"),
			smoothedDepthTexture: gl.getUniformLocation(finalProgram, "smoothedDepthTexture"),
			sourceTexelSize: gl.getUniformLocation(finalProgram, "sourceTexelSize"),
			viewProjectionParams: gl.getUniformLocation(finalProgram, "viewProjectionParams"),
			radialMetric: gl.getUniformLocation(finalProgram, "radialMetric")
		};
	};

	const buildHighResField = function(smoothedDepthState, targetWidth, targetHeight, depthSourcePacket, processingConfig) {
		const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
		const previousViewport = gl.getParameter(gl.VIEWPORT);
		if (!smoothedDepthState || !smoothedDepthState.texture || !ensureFinalResources(targetWidth, targetHeight)) {
			return null;
		}
		ensureFinalProgram();
		gl.bindFramebuffer(gl.FRAMEBUFFER, finalFramebuffer);
		gl.viewport(0, 0, finalWidth, finalHeight);
		gl.clearColor(0, 0, 0, 0);
		gl.clearDepth(1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.disable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.CULL_FACE);
		gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
		gl.useProgram(finalProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, smoothedDepthState.texture);
		gl.uniform1i(finalLocs.smoothedDepthTexture, 0);
		gl.uniform2f(finalLocs.sourceTexelSize, smoothedDepthState.width > 0 ? 1 / smoothedDepthState.width : 0, smoothedDepthState.height > 0 ? 1 / smoothedDepthState.height : 0);
		if (depthSourcePacket && depthSourcePacket.viewProjectionParams) {
			gl.uniform4f(finalLocs.viewProjectionParams, depthSourcePacket.viewProjectionParams.xScale, depthSourcePacket.viewProjectionParams.yScale, depthSourcePacket.viewProjectionParams.xOffset, depthSourcePacket.viewProjectionParams.yOffset);
		} else {
			gl.uniform4f(finalLocs.viewProjectionParams, 1, 1, 0, 0);
		}
		gl.uniform1f(finalLocs.radialMetric, processingConfig && processingConfig.depthMetricMode === "radial" ? 1 : 0);
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
		].join(""), "Depth visibility screen-space");
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
			const smoothedDepthState = smoothNativeDepth(canonicalDepthState);
			if (!smoothedDepthState) {
				return null;
			}
			const consumerSize = resolveViewportSize(args || null, depthInfo.width, depthInfo.height);
			const highResField = buildHighResField(smoothedDepthState, consumerSize.width, consumerSize.height, depthSourcePacket, processingConfig);
			if (!highResField) {
				return null;
			}
			const finalVisibilityTexture = buildVisibilityField(highResField, processingConfig);
			return {
				sourceDepthTexture: canonicalDepthState.texture,
				sourceDepthWidth: canonicalDepthState.width,
				sourceDepthHeight: canonicalDepthState.height,
				smoothedDepthTexture: smoothedDepthState.texture,
				smoothedDepthWidth: smoothedDepthState.width,
				smoothedDepthHeight: smoothedDepthState.height,
				fieldTexture: highResField.fieldTexture,
				coverageTexture: highResField.coverageTexture,
				visibilityTexture: finalVisibilityTexture,
				fieldWidth: highResField.width,
				fieldHeight: highResField.height
			};
		}
	};
};
