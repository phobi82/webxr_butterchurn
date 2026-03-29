// Shared full-resolution depth reconstruction for WebXR depth consumers.
const createDepthProcessingRenderer = function(options) {
	options = options || {};
	const gl = options.gl;
	const webgl2Bool = !!options.webgl2Bool;
	let buffer = null;
	let texture2dProgram = null;
	let texture2dLocs = null;
	let gpuArrayProgram = null;
	let gpuArrayLocs = null;
	let cpuDepthTexture = null;
	let cpuUploadBuffer = null;
	const depthUvTransform = new Float32Array(16);
	const identityUvTransform = identityMatrix();
	const processedDepthMaxMeters = 16;
	const targetsByView = [];
	const vertexSource = [
		"attribute vec2 position;",
		"varying vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");
	const texture2dFragmentSource = [
		"precision mediump float;",
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
		"float sampleSurfaceFitDepthMeters(vec2 depthUv){",
		"vec2 sourcePos=getSourcePixelPos(depthUv);",
		"float centerMeters=sampleBilinearDepthMeters(depthUv);",
		"if(centerMeters<=0.001){return centerMeters;}",
		"float edgeMeters=max(0.06,centerMeters*0.06);",
		"float sW=0.0,sX=0.0,sY=0.0,sXX=0.0,sYY=0.0,sXY=0.0,sZ=0.0,sXZ=0.0,sYZ=0.0;",
		"int validSamples=0;",
		"for(int iy=-2;iy<=2;iy+=1){",
		"for(int ix=-2;ix<=2;ix+=1){",
		"vec2 sampleCoord=floor(sourcePos)+vec2(float(ix),float(iy));",
		"float sampleMeters=sampleTexelDepthMeters(sampleCoord);",
		"if(sampleMeters<=0.001){continue;}",
		"float edgeWeight=max(0.0,1.0-abs(sampleMeters-centerMeters)/(edgeMeters*1.25));",
		"if(edgeWeight<=0.0001){continue;}",
		"vec2 delta=sampleCoord-sourcePos;",
		"float spatialWeight=1.0/(1.0+dot(delta*0.75,delta*0.75));",
		"float w=spatialWeight*edgeWeight;",
		"float x=delta.x;",
		"float y=delta.y;",
		"sW+=w; sX+=w*x; sY+=w*y; sXX+=w*x*x; sYY+=w*y*y; sXY+=w*x*y; sZ+=w*sampleMeters; sXZ+=w*x*sampleMeters; sYZ+=w*y*sampleMeters;",
		"validSamples+=1;",
		"}",
		"}",
		"if(validSamples<6){return centerMeters;}",
		"float det=sXX*(sYY*sW-sY*sY)-sXY*(sXY*sW-sY*sX)+sX*(sXY*sY-sYY*sX);",
		"if(abs(det)<=0.0001){return centerMeters;}",
		"float detC=sXX*(sYY*sZ-sY*sYZ)-sXY*(sXY*sZ-sY*sXZ)+sX*(sXY*sYZ-sYY*sXZ);",
		"float planeMeters=detC/det;",
		"return abs(planeMeters-centerMeters)<=edgeMeters*2.0?planeMeters:centerMeters;",
		"}",
		"float sampleReconstructedDepthMeters(vec2 depthUv){",
		"if(reconstructionMode>1.5){return sampleSurfaceFitDepthMeters(depthUv);}",
		"if(reconstructionMode>0.5){return sampleEdgeAwareDepthMeters(depthUv);}",
		"return sampleNearestDepthMeters(depthUv);",
		"}",
		"void main(){",
		"vec2 depthUv=getDepthUvFromScreenUv(vScreenUv);",
		"float depthMeters=sampleReconstructedDepthMeters(depthUv);",
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
		"precision mediump float;",
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
		"float sampleSurfaceFitDepthMeters(vec2 depthUv){",
		"vec2 sourcePos=getSourcePixelPos(depthUv);",
		"float centerMeters=sampleBilinearDepthMeters(depthUv);",
		"if(centerMeters<=0.001){return centerMeters;}",
		"float edgeMeters=max(0.06,centerMeters*0.06);",
		"float sW=0.0,sX=0.0,sY=0.0,sXX=0.0,sYY=0.0,sXY=0.0,sZ=0.0,sXZ=0.0,sYZ=0.0;",
		"int validSamples=0;",
		"for(int iy=-2;iy<=2;iy+=1){",
		"for(int ix=-2;ix<=2;ix+=1){",
		"vec2 sampleCoord=floor(sourcePos)+vec2(float(ix),float(iy));",
		"float sampleMeters=sampleTexelDepthMeters(sampleCoord);",
		"if(sampleMeters<=0.001){continue;}",
		"float edgeWeight=max(0.0,1.0-abs(sampleMeters-centerMeters)/(edgeMeters*1.25));",
		"if(edgeWeight<=0.0001){continue;}",
		"vec2 delta=sampleCoord-sourcePos;",
		"float spatialWeight=1.0/(1.0+dot(delta*0.75,delta*0.75));",
		"float w=spatialWeight*edgeWeight;",
		"float x=delta.x;",
		"float y=delta.y;",
		"sW+=w; sX+=w*x; sY+=w*y; sXX+=w*x*x; sYY+=w*y*y; sXY+=w*x*y; sZ+=w*sampleMeters; sXZ+=w*x*sampleMeters; sYZ+=w*y*sampleMeters;",
		"validSamples+=1;",
		"}",
		"}",
		"if(validSamples<6){return centerMeters;}",
		"float det=sXX*(sYY*sW-sY*sY)-sXY*(sXY*sW-sY*sX)+sX*(sXY*sY-sYY*sX);",
		"if(abs(det)<=0.0001){return centerMeters;}",
		"float detC=sXX*(sYY*sZ-sY*sYZ)-sXY*(sXY*sZ-sY*sXZ)+sX*(sXY*sYZ-sYY*sXZ);",
		"float planeMeters=detC/det;",
		"return abs(planeMeters-centerMeters)<=edgeMeters*2.0?planeMeters:centerMeters;",
		"}",
		"float sampleReconstructedDepthMeters(vec2 depthUv){",
		"if(reconstructionMode>1.5){return sampleSurfaceFitDepthMeters(depthUv);}",
		"if(reconstructionMode>0.5){return sampleEdgeAwareDepthMeters(depthUv);}",
		"return sampleNearestDepthMeters(depthUv);",
		"}",
		"void main(){",
		"vec2 depthUv=getDepthUvFromScreenUv(vScreenUv);",
		"float depthMeters=sampleReconstructedDepthMeters(depthUv);",
		"float normalizedDepth=clamp(depthMeters/" + processedDepthMaxMeters.toFixed(1) + ",0.0,1.0);",
		"fragColor=vec4(normalizedDepth,normalizedDepth,normalizedDepth,1.0);",
		"}"
	].join("");
	const buildLocs = function(program, gpuArrayBool) {
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
	const ensureTargets = function(viewIndex, width, height) {
		let targetState = targetsByView[viewIndex];
		if (!targetState) {
			targetState = {width: 0, height: 0, texture: null, framebuffer: null};
			targetsByView[viewIndex] = targetState;
		}
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
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, targetState.framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetState.texture, 0);
		return targetState;
	};
	const uploadCpuDepthTexture = function(depthInfo) {
		if (!depthInfo.data || !depthInfo.width || !depthInfo.height) {
			return false;
		}
		if (!cpuDepthTexture) {
			cpuDepthTexture = gl.createTexture();
		}
		const pixelCount = depthInfo.width * depthInfo.height;
		if (!cpuUploadBuffer || cpuUploadBuffer.length < pixelCount) {
			cpuUploadBuffer = new Float32Array(pixelCount);
		}
		const src = new Uint16Array(depthInfo.data);
		for (let i = 0; i < pixelCount; i += 1) {
			cpuUploadBuffer[i] = src[i];
		}
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, cpuDepthTexture);
		if (webgl2Bool) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, depthInfo.width, depthInfo.height, 0, gl.RED, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
		} else {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, depthInfo.width, depthInfo.height, 0, gl.LUMINANCE, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
		}
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return true;
	};
	return {
		init: function() {
			buffer = createFullscreenTriangleBuffer(gl);
		},
		process: function(args) {
			if (!args || !args.depthInfo || args.depthInfo.isValid === false || !args.viewport) {
				return null;
			}
			const depthInfo = args.depthInfo;
			const targetState = ensureTargets(args.viewIndex || 0, Math.max(1, args.viewport.width | 0), Math.max(1, args.viewport.height | 0));
			const processingConfig = args.processingConfig || {edgeAwareBool: true, surfaceFitBool: false, reconstructionKey: "edgeAware"};
			let program = null;
			let locs = null;
			gl.activeTexture(gl.TEXTURE0);
			if (args.depthFrameKind === "cpu") {
				if (!uploadCpuDepthTexture(depthInfo)) {
					return null;
				}
				if (!texture2dProgram) {
					texture2dProgram = createProgram(gl, vertexSource, texture2dFragmentSource, "Processed depth texture2d");
					texture2dLocs = buildLocs(texture2dProgram, false);
				}
				program = texture2dProgram;
				locs = texture2dLocs;
				gl.bindTexture(gl.TEXTURE_2D, cpuDepthTexture);
			} else if (args.depthFrameKind === "gpu-array" && webgl2Bool && depthInfo.texture) {
				if (!gpuArrayProgram) {
					gpuArrayProgram = createProgram(gl, gpuArrayVertexSource, gpuArrayFragmentSource, "Processed depth gpu-array");
					gpuArrayLocs = buildLocs(gpuArrayProgram, true);
				}
				program = gpuArrayProgram;
				locs = gpuArrayLocs;
				gl.bindTexture(gl.TEXTURE_2D_ARRAY, depthInfo.texture);
			} else if (depthInfo.texture) {
				if (!texture2dProgram) {
					texture2dProgram = createProgram(gl, vertexSource, texture2dFragmentSource, "Processed depth texture2d");
					texture2dLocs = buildLocs(texture2dProgram, false);
				}
				program = texture2dProgram;
				locs = texture2dLocs;
				gl.bindTexture(gl.TEXTURE_2D, depthInfo.texture);
			} else {
				return null;
			}
			gl.bindFramebuffer(gl.FRAMEBUFFER, targetState.framebuffer);
			gl.viewport(0, 0, targetState.width, targetState.height);
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.disable(gl.BLEND);
			gl.useProgram(program);
			gl.uniform1i(locs.sourceDepthTexture, 0);
			if (locs.sourceDepthLayer) {
				gl.uniform1i(locs.sourceDepthLayer, depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0));
			}
			gl.uniform2f(locs.sourceTexelSize, depthInfo.width > 0 ? 1 / depthInfo.width : 0, depthInfo.height > 0 ? 1 / depthInfo.height : 0);
			gl.uniform1f(locs.reconstructionMode, processingConfig.surfaceFitBool ? 2 : (processingConfig.edgeAwareBool ? 1 : 0));
			gl.uniform1f(locs.rawValueToMeters, args.depthProfile ? args.depthProfile.linearScale : (depthInfo.rawValueToMeters || 0.001));
			gl.uniform1f(locs.depthNearZ, args.depthProfile ? args.depthProfile.nearZ : 0);
			if (depthInfo.normDepthBufferFromNormView && depthInfo.normDepthBufferFromNormView.matrix) {
				depthUvTransform.set(depthInfo.normDepthBufferFromNormView.matrix);
			} else if (depthInfo.normDepthBufferFromNormView) {
				depthUvTransform.set(depthInfo.normDepthBufferFromNormView);
			} else {
				depthUvTransform.set(identityUvTransform);
			}
			gl.uniformMatrix4fv(locs.depthUvTransform, false, depthUvTransform);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(locs.position);
			gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.bindFramebuffer(gl.FRAMEBUFFER, args.outputFramebuffer || null);
			gl.activeTexture(gl.TEXTURE0);
			return {
				texture: targetState.texture,
				width: targetState.width,
				height: targetState.height,
				rawValueToMeters: processedDepthMaxMeters,
				normDepthBufferFromNormView: identityUvTransform,
				textureType: "texture-2d"
			};
		}
	};
};
