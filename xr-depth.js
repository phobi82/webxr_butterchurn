// Depth generation, reconstruction, and smoothing.

// Depth processing
const createDepthProcessingRuntimeState = function() {
	return {
		buffer: null,
		texture2dProgram: null,
		texture2dLocs: null,
		gpuArrayProgram: null,
		gpuArrayLocs: null,
		smoothTexture2dProgram: null,
		smoothTexture2dLocs: null,
		smoothGpuArrayProgram: null,
		smoothGpuArrayLocs: null,
		smoothNormalizedProgram: null,
		smoothNormalizedLocs: null,
		heightmapProgram: null,
		heightmapLocs: null,
		cpuDepthTexture: null,
		cpuUploadBuffer: null,
		cpuDepthTexParamsSet: false,
		processedTargetConfig: null,
		depthUvTransform: new Float32Array(16),
		identityUvTransform: identityMatrix(),
		processedTargetsByView: [],
		surfaceTargetsByView: []
	};
};

const createDepthProcessingTargetManager = function(gl, webgl2Bool, runtimeState) {
	const selectProcessedTargetConfig = function() {
		const fallbackConfig = {
			internalFormat: gl.RGBA,
			format: gl.RGBA,
			type: gl.UNSIGNED_BYTE,
			label: "RGBA8"
		};
		if (webgl2Bool && gl.getExtension("EXT_color_buffer_float")) {
			return {
				internalFormat: gl.RGBA16F,
				format: gl.RGBA,
				type: gl.HALF_FLOAT,
				label: "RGBA16F"
			};
		}
		return fallbackConfig;
	};
	const allocateRenderTargetStorage = function(targetConfig, width, height) {
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			targetConfig.internalFormat,
			width,
			height,
			0,
			targetConfig.format,
			targetConfig.type,
			null
		);
	};
	const ensureRenderTarget = function(targetState, width, height) {
		targetState = targetState || {width: 0, height: 0, texture: null, framebuffer: null};
		if (targetState.width === width && targetState.height === height && targetState.texture && targetState.framebuffer) {
			return targetState;
		}
		targetState.width = width;
		targetState.height = height;
		if (!targetState.texture) {
			targetState.texture = gl.createTexture();
		}
		if (!targetState.framebuffer) {
			targetState.framebuffer = gl.createFramebuffer();
		}
		gl.bindTexture(gl.TEXTURE_2D, targetState.texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		try {
			allocateRenderTargetStorage(runtimeState.processedTargetConfig, width, height);
		} catch (error) {
			if (runtimeState.processedTargetConfig.label !== "RGBA8") {
				console.warn("[DepthProcessing] render target fallback to RGBA8:", error);
				runtimeState.processedTargetConfig = {
					internalFormat: gl.RGBA,
					format: gl.RGBA,
					type: gl.UNSIGNED_BYTE,
					label: "RGBA8"
				};
				allocateRenderTargetStorage(runtimeState.processedTargetConfig, width, height);
			} else {
				throw error;
			}
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, targetState.framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetState.texture, 0);
		return targetState;
	};
	return {
		init: function() {
			runtimeState.processedTargetConfig = selectProcessedTargetConfig();
		},
		getProcessedTargetLabel: function() {
			return runtimeState.processedTargetConfig ? runtimeState.processedTargetConfig.label : "unknown";
		},
		ensureProcessedTarget: function(viewIndex, width, height) {
			runtimeState.processedTargetsByView[viewIndex] = ensureRenderTarget(runtimeState.processedTargetsByView[viewIndex], width, height);
			return runtimeState.processedTargetsByView[viewIndex];
		},
		ensureSurfaceTargets: function(viewIndex, width, height) {
			let targetState = runtimeState.surfaceTargetsByView[viewIndex];
			if (!targetState) {
				targetState = {temp: null, smooth: null};
				runtimeState.surfaceTargetsByView[viewIndex] = targetState;
			}
			targetState.temp = ensureRenderTarget(targetState.temp, width, height);
			targetState.smooth = ensureRenderTarget(targetState.smooth, width, height);
			return targetState;
		}
	};
};

const createDepthProcessingSourceBinding = function(gl, webgl2Bool, runtimeState) {
	return {
		uploadCpuDepthTexture: function(depthInfo) {
			if (!depthInfo.data || !depthInfo.width || !depthInfo.height) {
				return false;
			}
			if (!runtimeState.cpuDepthTexture) {
				runtimeState.cpuDepthTexture = gl.createTexture();
			}
			const pixelCount = depthInfo.width * depthInfo.height;
			if (!runtimeState.cpuUploadBuffer || runtimeState.cpuUploadBuffer.length < pixelCount) {
				runtimeState.cpuUploadBuffer = new Float32Array(pixelCount);
			}
			// Convert Uint16 depth data to Float32 using native .set() instead of element-by-element loop
			runtimeState.cpuUploadBuffer.set(new Uint16Array(depthInfo.data));
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, runtimeState.cpuDepthTexture);
			if (webgl2Bool) {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, depthInfo.width, depthInfo.height, 0, gl.RED, gl.FLOAT, runtimeState.cpuUploadBuffer.subarray(0, pixelCount));
			} else {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, depthInfo.width, depthInfo.height, 0, gl.LUMINANCE, gl.FLOAT, runtimeState.cpuUploadBuffer.subarray(0, pixelCount));
			}
			if (!runtimeState.cpuDepthTexParamsSet) {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				runtimeState.cpuDepthTexParamsSet = true;
			}
			return true;
		},
		prepareSourceTexture: function(args) {
			if (args.depthFrameKind === "cpu") {
				if (!this.uploadCpuDepthTexture(args.depthInfo)) {
					return false;
				}
				gl.bindTexture(gl.TEXTURE_2D, runtimeState.cpuDepthTexture);
				return true;
			}
			if (args.depthFrameKind === "gpu-array" && webgl2Bool && args.depthInfo.texture) {
				gl.bindTexture(gl.TEXTURE_2D_ARRAY, args.depthInfo.texture);
				return true;
			}
			if (args.depthInfo.texture) {
				gl.bindTexture(gl.TEXTURE_2D, args.depthInfo.texture);
				return true;
			}
			return false;
		},
		setDepthUvTransform: function(depthInfo) {
			if (depthInfo.normDepthBufferFromNormView && depthInfo.normDepthBufferFromNormView.matrix) {
				runtimeState.depthUvTransform.set(depthInfo.normDepthBufferFromNormView.matrix);
			} else if (depthInfo.normDepthBufferFromNormView) {
				runtimeState.depthUvTransform.set(depthInfo.normDepthBufferFromNormView);
			} else {
				runtimeState.depthUvTransform.set(runtimeState.identityUvTransform);
			}
		},
		bindFullscreenTriangle: function(positionLoc) {
			gl.bindBuffer(gl.ARRAY_BUFFER, runtimeState.buffer);
			gl.enableVertexAttribArray(positionLoc);
			gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
		}
	};
};

// Shared full-resolution depth reconstruction for WebXR depth consumers.
const createDepthProcessingRenderer = function(options) {
	options = options || {};
	const gl = options.gl;
	const webgl2Bool = !!options.webgl2Bool;
	const runtimeState = createDepthProcessingRuntimeState();
	const processedDepthMaxMeters = 16;
	const targetManager = createDepthProcessingTargetManager(gl, webgl2Bool, runtimeState);
	const sourceBinding = createDepthProcessingSourceBinding(gl, webgl2Bool, runtimeState);
	const vertexSource = [
		"attribute vec2 position;",
		"varying vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");
	const texture2dFragmentSource = [
		"precision highp float;",
		"uniform sampler2D sourceDepthTexture;",
		"uniform vec2 sourceTexelSize;",
		"uniform float reconstructionMode;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform mat4 depthUvTransform;",
		"varying vec2 vScreenUv;",
		"float decodeRawDepthMeters(float rawDepth){",
		"return depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"}",
		"float sampleSourceRawDepth(vec2 depthUv){return texture2D(sourceDepthTexture,depthUv).r;}",
		"vec2 getSourcePixelPos(vec2 depthUv){",
		"vec2 texel=max(sourceTexelSize,vec2(0.0001));",
		"return depthUv/texel-0.5;",
		"}",
		"vec2 getDepthUvFromScreenUv(vec2 screenUv){",
		"return (depthUvTransform*vec4(screenUv,0.0,1.0)).xy;",
		"}",
		"float sampleTexelRawDepth(vec2 texelCoord){",
		"vec2 texel=max(sourceTexelSize,vec2(0.0001));",
		"vec2 sampleUv=(max(vec2(0.0),texelCoord)+0.5)*texel;",
		"return sampleSourceRawDepth(sampleUv);",
		"}",
		"float sampleTexelDepthMeters(vec2 texelCoord){",
		"float rawDepth=sampleTexelRawDepth(texelCoord);",
		"return rawDepth<=0.001?0.0:decodeRawDepthMeters(rawDepth);",
		"}",
		"float sampleNearestDepthMeters(vec2 depthUv){",
		"return sampleTexelDepthMeters(floor(getSourcePixelPos(depthUv)+0.5));",
		"}",
		"float sampleBilinearDepthMeters(vec2 depthUv){",
		"vec2 sourcePos=getSourcePixelPos(depthUv);",
		"vec2 base=floor(sourcePos);",
		"vec2 frac=clamp(sourcePos-base,0.0,1.0);",
		"float d00=sampleTexelDepthMeters(base);",
		"float d10=sampleTexelDepthMeters(base+vec2(1.0,0.0));",
		"float d01=sampleTexelDepthMeters(base+vec2(0.0,1.0));",
		"float d11=sampleTexelDepthMeters(base+vec2(1.0,1.0));",
		"float w00=(1.0-frac.x)*(1.0-frac.y);",
		"float w10=frac.x*(1.0-frac.y);",
		"float w01=(1.0-frac.x)*frac.y;",
		"float w11=frac.x*frac.y;",
		"float depthSum=0.0;",
		"float weightSum=0.0;",
		"if(d00>0.001){depthSum+=d00*w00;weightSum+=w00;}",
		"if(d10>0.001){depthSum+=d10*w10;weightSum+=w10;}",
		"if(d01>0.001){depthSum+=d01*w01;weightSum+=w01;}",
		"if(d11>0.001){depthSum+=d11*w11;weightSum+=w11;}",
		"return weightSum>0.0001?depthSum/weightSum:sampleNearestDepthMeters(depthUv);",
		"}",
		"float sampleEdgeAwareDepthMeters(vec2 depthUv){",
		"vec2 sourcePos=getSourcePixelPos(depthUv);",
		"vec2 rounded=floor(sourcePos+0.5);",
		"float centerMeters=sampleBilinearDepthMeters(depthUv);",
		"if(centerMeters<=0.001){return sampleNearestDepthMeters(depthUv);}",
		"float edgeMeters=max(0.05,centerMeters*0.04);",
		"float depthSum=0.0;",
		"float weightSum=0.0;",
		"for(int iy=-1;iy<=1;iy+=1){",
		"for(int ix=-1;ix<=1;ix+=1){",
		"vec2 offset=vec2(float(ix),float(iy));",
		"float sampleMeters=sampleTexelDepthMeters(rounded+offset);",
		"if(sampleMeters<=0.001){continue;}",
		"float spatialWeight=1.0/(1.0+dot(offset-(sourcePos-rounded),offset-(sourcePos-rounded)));",
		"float edgeWeight=max(0.0,1.0-abs(sampleMeters-centerMeters)/edgeMeters);",
		"float weight=spatialWeight*edgeWeight;",
		"depthSum+=sampleMeters*weight;",
		"weightSum+=weight;",
		"}",
		"}",
		"return weightSum>0.0001?depthSum/weightSum:centerMeters;",
		"}",
		"void main(){",
		"vec2 depthUv=getDepthUvFromScreenUv(vScreenUv);",
		"float depthMeters=reconstructionMode>0.5?sampleEdgeAwareDepthMeters(depthUv):sampleNearestDepthMeters(depthUv);",
		"float normalizedDepth=clamp(depthMeters/" + processedDepthMaxMeters.toFixed(1) + ",0.0,1.0);",
		"gl_FragColor=vec4(normalizedDepth,normalizedDepth,normalizedDepth,1.0);",
		"}"
	].join("");
	const gpuArrayVertexSource = [
		"#version 300 es\n",
		"in vec2 position;",
		"out vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");
	const gpuArrayFragmentSource = [
		"#version 300 es\n",
		"precision highp float;",
		"precision mediump sampler2DArray;",
		"uniform sampler2DArray sourceDepthTexture;",
		"uniform int sourceDepthLayer;",
		"uniform vec2 sourceTexelSize;",
		"uniform float reconstructionMode;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"uniform mat4 depthUvTransform;",
		"in vec2 vScreenUv;",
		"out vec4 fragColor;",
		"float decodeRawDepthMeters(float rawDepth){",
		"return depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"}",
		"float sampleSourceRawDepth(vec2 depthUv){return texture(sourceDepthTexture,vec3(depthUv,float(sourceDepthLayer))).r;}",
		"vec2 getSourcePixelPos(vec2 depthUv){",
		"vec2 texel=max(sourceTexelSize,vec2(0.0001));",
		"return depthUv/texel-0.5;",
		"}",
		"vec2 getDepthUvFromScreenUv(vec2 screenUv){",
		"return (depthUvTransform*vec4(screenUv,0.0,1.0)).xy;",
		"}",
		"float sampleTexelRawDepth(vec2 texelCoord){",
		"vec2 texel=max(sourceTexelSize,vec2(0.0001));",
		"vec2 sampleUv=(max(vec2(0.0),texelCoord)+0.5)*texel;",
		"return sampleSourceRawDepth(sampleUv);",
		"}",
		"float sampleTexelDepthMeters(vec2 texelCoord){",
		"float rawDepth=sampleTexelRawDepth(texelCoord);",
		"return rawDepth<=0.001?0.0:decodeRawDepthMeters(rawDepth);",
		"}",
		"float sampleNearestDepthMeters(vec2 depthUv){",
		"return sampleTexelDepthMeters(floor(getSourcePixelPos(depthUv)+0.5));",
		"}",
		"float sampleBilinearDepthMeters(vec2 depthUv){",
		"vec2 sourcePos=getSourcePixelPos(depthUv);",
		"vec2 base=floor(sourcePos);",
		"vec2 frac=clamp(sourcePos-base,0.0,1.0);",
		"float d00=sampleTexelDepthMeters(base);",
		"float d10=sampleTexelDepthMeters(base+vec2(1.0,0.0));",
		"float d01=sampleTexelDepthMeters(base+vec2(0.0,1.0));",
		"float d11=sampleTexelDepthMeters(base+vec2(1.0,1.0));",
		"float w00=(1.0-frac.x)*(1.0-frac.y);",
		"float w10=frac.x*(1.0-frac.y);",
		"float w01=(1.0-frac.x)*frac.y;",
		"float w11=frac.x*frac.y;",
		"float depthSum=0.0;",
		"float weightSum=0.0;",
		"if(d00>0.001){depthSum+=d00*w00;weightSum+=w00;}",
		"if(d10>0.001){depthSum+=d10*w10;weightSum+=w10;}",
		"if(d01>0.001){depthSum+=d01*w01;weightSum+=w01;}",
		"if(d11>0.001){depthSum+=d11*w11;weightSum+=w11;}",
		"return weightSum>0.0001?depthSum/weightSum:sampleNearestDepthMeters(depthUv);",
		"}",
		"float sampleEdgeAwareDepthMeters(vec2 depthUv){",
		"vec2 sourcePos=getSourcePixelPos(depthUv);",
		"vec2 rounded=floor(sourcePos+0.5);",
		"float centerMeters=sampleBilinearDepthMeters(depthUv);",
		"if(centerMeters<=0.001){return sampleNearestDepthMeters(depthUv);}",
		"float edgeMeters=max(0.05,centerMeters*0.04);",
		"float depthSum=0.0;",
		"float weightSum=0.0;",
		"for(int iy=-1;iy<=1;iy+=1){",
		"for(int ix=-1;ix<=1;ix+=1){",
		"vec2 offset=vec2(float(ix),float(iy));",
		"float sampleMeters=sampleTexelDepthMeters(rounded+offset);",
		"if(sampleMeters<=0.001){continue;}",
		"float spatialWeight=1.0/(1.0+dot(offset-(sourcePos-rounded),offset-(sourcePos-rounded)));",
		"float edgeWeight=max(0.0,1.0-abs(sampleMeters-centerMeters)/edgeMeters);",
		"float weight=spatialWeight*edgeWeight;",
		"depthSum+=sampleMeters*weight;",
		"weightSum+=weight;",
		"}",
		"}",
		"return weightSum>0.0001?depthSum/weightSum:centerMeters;",
		"}",
		"void main(){",
		"vec2 depthUv=getDepthUvFromScreenUv(vScreenUv);",
		"float depthMeters=reconstructionMode>0.5?sampleEdgeAwareDepthMeters(depthUv):sampleNearestDepthMeters(depthUv);",
		"float normalizedDepth=clamp(depthMeters/" + processedDepthMaxMeters.toFixed(1) + ",0.0,1.0);",
		"fragColor=vec4(normalizedDepth,normalizedDepth,normalizedDepth,1.0);",
		"}"
	].join("");
	const smoothTexture2dFragmentSource = [
		"precision highp float;",
		"uniform sampler2D sourceDepthTexture;",
		"uniform vec2 sourceTexelSize;",
		"uniform vec2 blurAxis;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"varying vec2 vScreenUv;",
		"float decodeRawDepthMeters(float rawDepth){",
		"return depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"}",
		"float sampleMeters(vec2 depthUv){",
		"float rawDepth=texture2D(sourceDepthTexture,depthUv).r;",
		"return rawDepth<=0.001?0.0:decodeRawDepthMeters(rawDepth);",
		"}",
		"void main(){",
		"float depthSum=0.0;",
		"float weightSum=0.0;",
		"for(int i=-2;i<=2;i+=1){",
		"float offset=float(i);",
		"float sampleMetersValue=sampleMeters(vScreenUv+blurAxis*sourceTexelSize*offset);",
		"if(sampleMetersValue<=0.001){continue;}",
		"float weight=offset==0.0?6.0:(abs(offset)<1.5?4.0:1.0);",
		"depthSum+=sampleMetersValue*weight;",
		"weightSum+=weight;",
		"}",
		"float depthMeters=weightSum>0.0001?depthSum/weightSum:0.0;",
		"float normalizedDepth=clamp(depthMeters/" + processedDepthMaxMeters.toFixed(1) + ",0.0,1.0);",
		"gl_FragColor=vec4(normalizedDepth,normalizedDepth,normalizedDepth,1.0);",
		"}"
	].join("");
	const smoothGpuArrayFragmentSource = [
		"#version 300 es\n",
		"precision highp float;",
		"precision mediump sampler2DArray;",
		"uniform sampler2DArray sourceDepthTexture;",
		"uniform int sourceDepthLayer;",
		"uniform vec2 sourceTexelSize;",
		"uniform vec2 blurAxis;",
		"uniform float rawValueToMeters;",
		"uniform float depthNearZ;",
		"in vec2 vScreenUv;",
		"out vec4 fragColor;",
		"float decodeRawDepthMeters(float rawDepth){",
		"return depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
		"}",
		"float sampleMeters(vec2 depthUv){",
		"float rawDepth=texture(sourceDepthTexture,vec3(depthUv,float(sourceDepthLayer))).r;",
		"return rawDepth<=0.001?0.0:decodeRawDepthMeters(rawDepth);",
		"}",
		"void main(){",
		"float depthSum=0.0;",
		"float weightSum=0.0;",
		"for(int i=-2;i<=2;i+=1){",
		"float offset=float(i);",
		"float sampleMetersValue=sampleMeters(vScreenUv+blurAxis*sourceTexelSize*offset);",
		"if(sampleMetersValue<=0.001){continue;}",
		"float weight=offset==0.0?6.0:(abs(offset)<1.5?4.0:1.0);",
		"depthSum+=sampleMetersValue*weight;",
		"weightSum+=weight;",
		"}",
		"float depthMeters=weightSum>0.0001?depthSum/weightSum:0.0;",
		"float normalizedDepth=clamp(depthMeters/" + processedDepthMaxMeters.toFixed(1) + ",0.0,1.0);",
		"fragColor=vec4(normalizedDepth,normalizedDepth,normalizedDepth,1.0);",
		"}"
	].join("");
	const smoothNormalizedFragmentSource = [
		"precision highp float;",
		"uniform sampler2D sourceDepthTexture;",
		"uniform vec2 sourceTexelSize;",
		"uniform vec2 blurAxis;",
		"varying vec2 vScreenUv;",
		"float sampleMeters(vec2 depthUv){",
		"return texture2D(sourceDepthTexture,depthUv).r*" + processedDepthMaxMeters.toFixed(1) + ";",
		"}",
		"void main(){",
		"float depthSum=0.0;",
		"float weightSum=0.0;",
		"for(int i=-2;i<=2;i+=1){",
		"float offset=float(i);",
		"float sampleMetersValue=sampleMeters(vScreenUv+blurAxis*sourceTexelSize*offset);",
		"if(sampleMetersValue<=0.001){continue;}",
		"float weight=offset==0.0?6.0:(abs(offset)<1.5?4.0:1.0);",
		"depthSum+=sampleMetersValue*weight;",
		"weightSum+=weight;",
		"}",
		"float depthMeters=weightSum>0.0001?depthSum/weightSum:0.0;",
		"float normalizedDepth=clamp(depthMeters/" + processedDepthMaxMeters.toFixed(1) + ",0.0,1.0);",
		"gl_FragColor=vec4(normalizedDepth,normalizedDepth,normalizedDepth,1.0);",
		"}"
	].join("");
	const heightmapFragmentSource = [
		"precision highp float;",
		"uniform sampler2D sourceDepthTexture;",
		"uniform vec2 sourceTexelSize;",
		"uniform mat4 depthUvTransform;",
		"varying vec2 vScreenUv;",
		"vec2 getSourcePixelPos(vec2 depthUv){",
		"vec2 texel=max(sourceTexelSize,vec2(0.0001));",
		"return depthUv/texel-0.5;",
		"}",
		"vec2 getDepthUvFromScreenUv(vec2 screenUv){",
		"return (depthUvTransform*vec4(screenUv,0.0,1.0)).xy;",
		"}",
		"float sampleTexelDepthMeters(vec2 texelCoord){",
		"vec2 texel=max(sourceTexelSize,vec2(0.0001));",
		"vec2 sampleUv=(max(vec2(0.0),texelCoord)+0.5)*texel;",
		"return texture2D(sourceDepthTexture,sampleUv).r*" + processedDepthMaxMeters.toFixed(1) + ";",
		"}",
		"float sampleBilinearDepthMeters(vec2 depthUv){",
		"vec2 sourcePos=getSourcePixelPos(depthUv);",
		"vec2 base=floor(sourcePos);",
		"vec2 frac=clamp(sourcePos-base,0.0,1.0);",
		"float d00=sampleTexelDepthMeters(base);",
		"float d10=sampleTexelDepthMeters(base+vec2(1.0,0.0));",
		"float d01=sampleTexelDepthMeters(base+vec2(0.0,1.0));",
		"float d11=sampleTexelDepthMeters(base+vec2(1.0,1.0));",
		"return mix(mix(d00,d10,frac.x),mix(d01,d11,frac.x),frac.y);",
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
		"float sampleMeters=sampleTexelDepthMeters(sampleCoord);",
		"if(sampleMeters<=0.001){continue;}",
		"vec2 delta=sourcePos-sampleCoord;",
		"float weight=bsplineWeight(delta.x)*bsplineWeight(delta.y);",
		"depthSum+=sampleMeters*weight;",
		"weightSum+=weight;",
		"}",
		"}",
		"return weightSum>0.0001?depthSum/weightSum:sampleBilinearDepthMeters(depthUv);",
		"}",
		"void main(){",
		"vec2 depthUv=getDepthUvFromScreenUv(vScreenUv);",
		"float depthMeters=sampleSurfaceFitDepthMeters(depthUv);",
		"float normalizedDepth=clamp(depthMeters/" + processedDepthMaxMeters.toFixed(1) + ",0.0,1.0);",
		"gl_FragColor=vec4(normalizedDepth,normalizedDepth,normalizedDepth,1.0);",
		"}"
	].join("");
	const buildDirectLocs = function(program, gpuArrayBool) {
		return {
			position: gl.getAttribLocation(program, "position"),
			sourceDepthTexture: gl.getUniformLocation(program, "sourceDepthTexture"),
			sourceDepthLayer: gpuArrayBool ? gl.getUniformLocation(program, "sourceDepthLayer") : null,
			sourceTexelSize: gl.getUniformLocation(program, "sourceTexelSize"),
			reconstructionMode: gl.getUniformLocation(program, "reconstructionMode"),
			rawValueToMeters: gl.getUniformLocation(program, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(program, "depthNearZ"),
			depthUvTransform: gl.getUniformLocation(program, "depthUvTransform")
		};
	};
	const buildSmoothRawLocs = function(program, gpuArrayBool) {
		return {
			position: gl.getAttribLocation(program, "position"),
			sourceDepthTexture: gl.getUniformLocation(program, "sourceDepthTexture"),
			sourceDepthLayer: gpuArrayBool ? gl.getUniformLocation(program, "sourceDepthLayer") : null,
			sourceTexelSize: gl.getUniformLocation(program, "sourceTexelSize"),
			blurAxis: gl.getUniformLocation(program, "blurAxis"),
			rawValueToMeters: gl.getUniformLocation(program, "rawValueToMeters"),
			depthNearZ: gl.getUniformLocation(program, "depthNearZ")
		};
	};
	const buildSmoothNormalizedLocs = function(program) {
		return {
			position: gl.getAttribLocation(program, "position"),
			sourceDepthTexture: gl.getUniformLocation(program, "sourceDepthTexture"),
			sourceTexelSize: gl.getUniformLocation(program, "sourceTexelSize"),
			blurAxis: gl.getUniformLocation(program, "blurAxis")
		};
	};
	const buildHeightmapLocs = function(program) {
		return {
			position: gl.getAttribLocation(program, "position"),
			sourceDepthTexture: gl.getUniformLocation(program, "sourceDepthTexture"),
			sourceTexelSize: gl.getUniformLocation(program, "sourceTexelSize"),
			depthUvTransform: gl.getUniformLocation(program, "depthUvTransform")
		};
	};
	const runDirectPass = function(args, targetState, processingConfig) {
		let program = null;
		let locs = null;
		gl.activeTexture(gl.TEXTURE0);
		if (!sourceBinding.prepareSourceTexture(args)) {
			return false;
		}
		if (args.depthFrameKind === "gpu-array" && webgl2Bool && args.depthInfo.texture) {
			if (!runtimeState.gpuArrayProgram) {
				runtimeState.gpuArrayProgram = createProgram(gl, gpuArrayVertexSource, gpuArrayFragmentSource, "Processed depth gpu-array");
				runtimeState.gpuArrayLocs = buildDirectLocs(runtimeState.gpuArrayProgram, true);
			}
			program = runtimeState.gpuArrayProgram;
			locs = runtimeState.gpuArrayLocs;
		} else {
			if (!runtimeState.texture2dProgram) {
				runtimeState.texture2dProgram = createProgram(gl, vertexSource, texture2dFragmentSource, "Processed depth texture2d");
				runtimeState.texture2dLocs = buildDirectLocs(runtimeState.texture2dProgram, false);
			}
			program = runtimeState.texture2dProgram;
			locs = runtimeState.texture2dLocs;
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, targetState.framebuffer);
		gl.viewport(0, 0, targetState.width, targetState.height);
		gl.useProgram(program);
		gl.uniform1i(locs.sourceDepthTexture, 0);
		if (locs.sourceDepthLayer) {
			gl.uniform1i(locs.sourceDepthLayer, args.depthInfo.imageIndex != null ? args.depthInfo.imageIndex : (args.depthInfo.textureLayer || 0));
		}
		gl.uniform2f(locs.sourceTexelSize, args.depthInfo.width > 0 ? 1 / args.depthInfo.width : 0, args.depthInfo.height > 0 ? 1 / args.depthInfo.height : 0);
		gl.uniform1f(locs.reconstructionMode, processingConfig.edgeAwareBool ? 1 : 0);
		gl.uniform1f(locs.rawValueToMeters, args.depthProfile ? args.depthProfile.linearScale : (args.depthInfo.rawValueToMeters || 0.001));
		gl.uniform1f(locs.depthNearZ, args.depthProfile ? args.depthProfile.nearZ : 0);
		sourceBinding.setDepthUvTransform(args.depthInfo);
		gl.uniformMatrix4fv(locs.depthUvTransform, false, runtimeState.depthUvTransform);
		sourceBinding.bindFullscreenTriangle(locs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		return true;
	};
	const runRawSmoothPass = function(args, surfaceTarget, axisX, axisY) {
		let program = null;
		let locs = null;
		gl.activeTexture(gl.TEXTURE0);
		if (!sourceBinding.prepareSourceTexture(args)) {
			return false;
		}
		if (args.depthFrameKind === "gpu-array" && webgl2Bool && args.depthInfo.texture) {
			if (!runtimeState.smoothGpuArrayProgram) {
				runtimeState.smoothGpuArrayProgram = createProgram(gl, gpuArrayVertexSource, smoothGpuArrayFragmentSource, "Smoothed raw depth gpu-array");
				runtimeState.smoothGpuArrayLocs = buildSmoothRawLocs(runtimeState.smoothGpuArrayProgram, true);
			}
			program = runtimeState.smoothGpuArrayProgram;
			locs = runtimeState.smoothGpuArrayLocs;
		} else {
			if (!runtimeState.smoothTexture2dProgram) {
				runtimeState.smoothTexture2dProgram = createProgram(gl, vertexSource, smoothTexture2dFragmentSource, "Smoothed raw depth texture2d");
				runtimeState.smoothTexture2dLocs = buildSmoothRawLocs(runtimeState.smoothTexture2dProgram, false);
			}
			program = runtimeState.smoothTexture2dProgram;
			locs = runtimeState.smoothTexture2dLocs;
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, surfaceTarget.framebuffer);
		gl.viewport(0, 0, surfaceTarget.width, surfaceTarget.height);
		gl.useProgram(program);
		gl.uniform1i(locs.sourceDepthTexture, 0);
		if (locs.sourceDepthLayer) {
			gl.uniform1i(locs.sourceDepthLayer, args.depthInfo.imageIndex != null ? args.depthInfo.imageIndex : (args.depthInfo.textureLayer || 0));
		}
		gl.uniform2f(locs.sourceTexelSize, args.depthInfo.width > 0 ? 1 / args.depthInfo.width : 0, args.depthInfo.height > 0 ? 1 / args.depthInfo.height : 0);
		gl.uniform2f(locs.blurAxis, axisX, axisY);
		gl.uniform1f(locs.rawValueToMeters, args.depthProfile ? args.depthProfile.linearScale : (args.depthInfo.rawValueToMeters || 0.001));
		gl.uniform1f(locs.depthNearZ, args.depthProfile ? args.depthProfile.nearZ : 0);
		sourceBinding.bindFullscreenTriangle(locs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		return true;
	};
	const runNormalizedSmoothPass = function(sourceTexture, sourceWidth, sourceHeight, surfaceTarget, axisX, axisY) {
		if (!runtimeState.smoothNormalizedProgram) {
			runtimeState.smoothNormalizedProgram = createProgram(gl, vertexSource, smoothNormalizedFragmentSource, "Smoothed normalized depth");
			runtimeState.smoothNormalizedLocs = buildSmoothNormalizedLocs(runtimeState.smoothNormalizedProgram);
		}
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
		gl.bindFramebuffer(gl.FRAMEBUFFER, surfaceTarget.framebuffer);
		gl.viewport(0, 0, surfaceTarget.width, surfaceTarget.height);
		gl.useProgram(runtimeState.smoothNormalizedProgram);
		gl.uniform1i(runtimeState.smoothNormalizedLocs.sourceDepthTexture, 0);
		gl.uniform2f(runtimeState.smoothNormalizedLocs.sourceTexelSize, sourceWidth > 0 ? 1 / sourceWidth : 0, sourceHeight > 0 ? 1 / sourceHeight : 0);
		gl.uniform2f(runtimeState.smoothNormalizedLocs.blurAxis, axisX, axisY);
		sourceBinding.bindFullscreenTriangle(runtimeState.smoothNormalizedLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		return true;
	};
	const runHeightmapPass = function(args, targetState, smoothTarget) {
		if (!runtimeState.heightmapProgram) {
			runtimeState.heightmapProgram = createProgram(gl, vertexSource, heightmapFragmentSource, "Processed depth heightmap");
			runtimeState.heightmapLocs = buildHeightmapLocs(runtimeState.heightmapProgram);
		}
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, smoothTarget.texture);
		gl.bindFramebuffer(gl.FRAMEBUFFER, targetState.framebuffer);
		gl.viewport(0, 0, targetState.width, targetState.height);
		gl.useProgram(runtimeState.heightmapProgram);
		gl.uniform1i(runtimeState.heightmapLocs.sourceDepthTexture, 0);
		gl.uniform2f(runtimeState.heightmapLocs.sourceTexelSize, smoothTarget.width > 0 ? 1 / smoothTarget.width : 0, smoothTarget.height > 0 ? 1 / smoothTarget.height : 0);
		sourceBinding.setDepthUvTransform(args.depthInfo);
		gl.uniformMatrix4fv(runtimeState.heightmapLocs.depthUvTransform, false, runtimeState.depthUvTransform);
		sourceBinding.bindFullscreenTriangle(runtimeState.heightmapLocs.position);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		return true;
	};
	const buildProcessedDepthState = function(targetState) {
		return {
			texture: targetState.texture,
			width: targetState.width,
			height: targetState.height,
			rawValueToMeters: processedDepthMaxMeters,
			normDepthBufferFromNormView: runtimeState.identityUvTransform,
			textureType: "texture-2d"
		};
	};
	return {
		init: function() {
			runtimeState.buffer = createFullscreenTriangleBuffer(gl);
			targetManager.init();
			console.log("[DepthProcessing] render target=" + targetManager.getProcessedTargetLabel());
		},
		process: function(args) {
			if (!args || !args.depthInfo || args.depthInfo.isValid === false || !args.viewport) {
				return null;
			}
			const depthInfo = args.depthInfo;
			const targetState = targetManager.ensureProcessedTarget(args.viewIndex || 0, Math.max(1, args.viewport.width | 0), Math.max(1, args.viewport.height | 0));
			const processingConfig = args.processingConfig || {edgeAwareBool: false, heightmapBool: true, reconstructionKey: "heightmap"};
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.disable(gl.BLEND);
			if (processingConfig.heightmapBool) {
				const surfaceState = targetManager.ensureSurfaceTargets(args.viewIndex || 0, Math.max(1, depthInfo.width | 0), Math.max(1, depthInfo.height | 0));
				if (!runRawSmoothPass(args, surfaceState.temp, 1, 0)) {
					return null;
				}
				runNormalizedSmoothPass(surfaceState.temp.texture, surfaceState.temp.width, surfaceState.temp.height, surfaceState.smooth, 0, 1);
				runHeightmapPass(args, targetState, surfaceState.smooth);
			} else if (!runDirectPass(args, targetState, processingConfig)) {
				return null;
			}
			gl.bindFramebuffer(gl.FRAMEBUFFER, args.outputFramebuffer || null);
			gl.activeTexture(gl.TEXTURE0);
			return buildProcessedDepthState(targetState);
		}
	};
};
