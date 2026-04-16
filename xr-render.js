// Render stack: assets, geometry, MR lighting, and scene composition.

// GLB assets
const createGlbAssetStore = function(deps) {
	const gl = deps.gl;
	const fetchFn = deps.fetchFn || fetch;
	const createImageBitmapFn = deps.createImageBitmapFn || null;
	const imageCtor = deps.imageCtor || Image;
	const blobCtor = deps.blobCtor || Blob;
	const textDecoderCtor = deps.textDecoderCtor || TextDecoder;
	const urlApi = deps.urlApi || URL;
	const setStatus = deps.setStatus || function() {};
	const getLightingState = deps.getLightingState || function() { return null; };
	const getLightingUniformLocations = deps.getLightingUniformLocations;
	const applyLightingUniforms = deps.applyLightingUniforms;
	const maxSceneLights = deps.maxSceneLights || 4;
	let litProgram = null;
	let litPositionLoc = null;
	let litNormalLoc = null;
	let litUvLoc = null;
	let litModelLoc = null;
	let litViewLoc = null;
	let litProjLoc = null;
	let litSamplerLoc = null;
	let litLightingUniforms = null;
	const assets = [];

	const loadImageBitmapFromBlob = function(blob) {
		if (createImageBitmapFn) {
			return createImageBitmapFn(blob);
		}
		return new Promise(function(resolve, reject) {
			const image = new imageCtor();
			const imageUrl = urlApi.createObjectURL(blob);
			image.onload = function() {
				urlApi.revokeObjectURL(imageUrl);
				resolve(image);
			};
			image.onerror = function() {
				urlApi.revokeObjectURL(imageUrl);
				reject(new Error("glb texture load failed"));
			};
			image.src = imageUrl;
		});
	};

	const readAccessorTypedArray = function(glbBytes, json, accessorIndex) {
		const accessor = json.accessors[accessorIndex];
		const bufferView = json.bufferViews[accessor.bufferView];
		const componentCount = accessor.type === "VEC3" ? 3 : accessor.type === "VEC2" ? 2 : 1;
		const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
		const elementCount = accessor.count * componentCount;
		if (accessor.componentType === 5126) {
			return new Float32Array(glbBytes.buffer, glbBytes.byteOffset + byteOffset, elementCount);
		}
		if (accessor.componentType === 5125) {
			return new Uint32Array(glbBytes.buffer, glbBytes.byteOffset + byteOffset, elementCount);
		}
		if (accessor.componentType === 5123) {
			return new Uint16Array(glbBytes.buffer, glbBytes.byteOffset + byteOffset, elementCount);
		}
		throw new Error("unsupported glb accessor component type");
	};

	const createWorldMatrix = function(config, baseModelMatrix) {
		return multiplyMatrices(
			translateRotateYScale(config.position.x, config.position.y, config.position.z, config.rotationY || 0, config.scale, config.scale, config.scale),
			baseModelMatrix
		);
	};

	const transformPoint = function(matrix, x, y, z) {
		return {
			x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
			y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
			z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
		};
	};

	const createCollisionBox = function(bounds, worldMatrix) {
		const corners = [
			transformPoint(worldMatrix, bounds.min[0], bounds.min[1], bounds.min[2]),
			transformPoint(worldMatrix, bounds.min[0], bounds.min[1], bounds.max[2]),
			transformPoint(worldMatrix, bounds.min[0], bounds.max[1], bounds.min[2]),
			transformPoint(worldMatrix, bounds.min[0], bounds.max[1], bounds.max[2]),
			transformPoint(worldMatrix, bounds.max[0], bounds.min[1], bounds.min[2]),
			transformPoint(worldMatrix, bounds.max[0], bounds.min[1], bounds.max[2]),
			transformPoint(worldMatrix, bounds.max[0], bounds.max[1], bounds.min[2]),
			transformPoint(worldMatrix, bounds.max[0], bounds.max[1], bounds.max[2])
		];
		let minX = Infinity;
		let minY = Infinity;
		let minZ = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let maxZ = -Infinity;
		for (let i = 0; i < corners.length; i += 1) {
			minX = Math.min(minX, corners[i].x);
			minY = Math.min(minY, corners[i].y);
			minZ = Math.min(minZ, corners[i].z);
			maxX = Math.max(maxX, corners[i].x);
			maxY = Math.max(maxY, corners[i].y);
			maxZ = Math.max(maxZ, corners[i].z);
		}
		return {
			x: (minX + maxX) * 0.5,
			y: (minY + maxY) * 0.5,
			z: (minZ + maxZ) * 0.5,
			width: maxX - minX,
			height: maxY - minY,
			depth: maxZ - minZ
		};
	};

	return {
		init: function() {
			const litVs = "attribute vec3 position;attribute vec3 normal;attribute vec2 uv;uniform mat4 model;uniform mat4 view;uniform mat4 proj;varying vec3 vNormal;varying vec2 vUv;void main(){vNormal=mat3(model)*normal;vUv=uv;gl_Position=proj*view*model*vec4(position,1.0);}";
			const litFs = "precision mediump float;uniform sampler2D tex;uniform vec3 ambientColor;uniform float ambientStrength;uniform vec3 lightDirections[" + maxSceneLights + "];uniform vec3 lightColors[" + maxSceneLights + "];uniform float lightStrengths[" + maxSceneLights + "];varying vec3 vNormal;varying vec2 vUv;void main(){vec3 n=normalize(vNormal);vec3 lightAccum=ambientColor*ambientStrength;for(int i=0;i<" + maxSceneLights + ";i+=1){if(lightStrengths[i]>0.0){float diffuse=max(dot(n,normalize(lightDirections[i])),0.0);lightAccum+=lightColors[i]*(diffuse*lightStrengths[i]);}}vec4 base=texture2D(tex,vUv);gl_FragColor=vec4(base.rgb*min(lightAccum,vec3(1.9)),base.a);}";
			litProgram = createProgram(gl, litVs, litFs, "GLB asset");
			litPositionLoc = gl.getAttribLocation(litProgram, "position");
			litNormalLoc = gl.getAttribLocation(litProgram, "normal");
			litUvLoc = gl.getAttribLocation(litProgram, "uv");
			litModelLoc = gl.getUniformLocation(litProgram, "model");
			litViewLoc = gl.getUniformLocation(litProgram, "view");
			litProjLoc = gl.getUniformLocation(litProgram, "proj");
			litSamplerLoc = gl.getUniformLocation(litProgram, "tex");
			litLightingUniforms = getLightingUniformLocations ? getLightingUniformLocations(gl, litProgram) : null;
			gl.getExtension("OES_element_index_uint");
		},
		loadAsset: async function(config) {
			const response = await fetchFn(config.url, {mode: "cors"});
			if (!response.ok) {
				throw new Error("glb request failed: " + config.url);
			}
			const arrayBuffer = await response.arrayBuffer();
			const bytes = new Uint8Array(arrayBuffer);
			const headerView = new DataView(arrayBuffer, 0, 20);
			if (headerView.getUint32(0, true) !== 0x46546c67) {
				throw new Error("invalid glb header");
			}
			const jsonChunkLength = headerView.getUint32(12, true);
			const jsonText = new textDecoderCtor("utf-8").decode(new Uint8Array(arrayBuffer, 20, jsonChunkLength));
			const json = JSON.parse(jsonText);
			const binaryChunkOffset = 20 + jsonChunkLength + 8;
			const binaryChunkBytes = new Uint8Array(arrayBuffer, binaryChunkOffset);
			const primitive = json.meshes[0].primitives[0];
			const positions = readAccessorTypedArray(binaryChunkBytes, json, primitive.attributes.POSITION);
			const normals = readAccessorTypedArray(binaryChunkBytes, json, primitive.attributes.NORMAL);
			const uvs = readAccessorTypedArray(binaryChunkBytes, json, primitive.attributes.TEXCOORD_0);
			const indices = readAccessorTypedArray(binaryChunkBytes, json, primitive.indices);
			const imageDef = json.images[json.textures[0].source];
			const imageView = json.bufferViews[imageDef.bufferView];
			const imageStart = binaryChunkOffset + (imageView.byteOffset || 0);
			const imageEnd = imageStart + imageView.byteLength;
			const imageBlob = new blobCtor([bytes.slice(imageStart, imageEnd)], {type: imageDef.mimeType || "image/png"});
			const imageBitmap = await loadImageBitmapFromBlob(imageBlob);
			const positionBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
			const normalBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
			const uvBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
			const indexBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageBitmap);
			gl.generateMipmap(gl.TEXTURE_2D);
			const baseModelMatrix = json.nodes && json.nodes[0] && json.nodes[0].matrix ? new Float32Array(json.nodes[0].matrix) : identityMatrix();
			const worldMatrix = createWorldMatrix(config, baseModelMatrix);
			assets.push({
				positionBuffer: positionBuffer,
				normalBuffer: normalBuffer,
				uvBuffer: uvBuffer,
				indexBuffer: indexBuffer,
				indexCount: indices.length,
				indexType: indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
				worldMatrix: worldMatrix,
				texture: texture,
				collisionBox: config.collisionBool === false ? null : createCollisionBox({min: json.accessors[primitive.attributes.POSITION].min, max: json.accessors[primitive.attributes.POSITION].max}, worldMatrix)
			});
		},
		loadAssets: async function(configs) {
			for (let i = 0; i < configs.length; i += 1) {
				try {
					await this.loadAsset(configs[i]);
				} catch (error) {
					console.warn("[GLB] Failed to load asset: " + (configs[i].url || "unknown") + " — " + (error.message || "unknown error"));
					setStatus(error.message || "glb load failed");
				}
			}
		},
		draw: function(currentView, currentProj) {
			if (!assets.length) {
				return;
			}
			gl.useProgram(litProgram);
			gl.enable(gl.DEPTH_TEST);
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			if (applyLightingUniforms && litLightingUniforms) {
				applyLightingUniforms(gl, litLightingUniforms, getLightingState());
			}
			for (let i = 0; i < assets.length; i += 1) {
				const asset = assets[i];
				gl.bindBuffer(gl.ARRAY_BUFFER, asset.positionBuffer);
				gl.enableVertexAttribArray(litPositionLoc);
				gl.vertexAttribPointer(litPositionLoc, 3, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, asset.normalBuffer);
				gl.enableVertexAttribArray(litNormalLoc);
				gl.vertexAttribPointer(litNormalLoc, 3, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, asset.uvBuffer);
				gl.enableVertexAttribArray(litUvLoc);
				gl.vertexAttribPointer(litUvLoc, 2, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, asset.indexBuffer);
				gl.uniformMatrix4fv(litModelLoc, false, asset.worldMatrix);
				gl.uniformMatrix4fv(litViewLoc, false, currentView);
				gl.uniformMatrix4fv(litProjLoc, false, currentProj);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, asset.texture);
				gl.uniform1i(litSamplerLoc, 0);
				gl.drawElements(gl.TRIANGLES, asset.indexCount, asset.indexType, 0);
			}
		},
		getCollisionBoxes: function() {
			const boxes = [];
			for (let i = 0; i < assets.length; i += 1) {
				if (assets[i].collisionBox) {
					boxes.push(assets[i].collisionBox);
				}
			}
			return boxes;
		}
	};
};


// Geometry
const createStaticBuffer = function(gl, values) {
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
	return buffer;
};

const createSceneGeometry = function(gl) {
	const gridData = [];
	for (let i = -20; i <= 20; i += 1) {
		gridData.push(i, 0, -20, i, 0, 20);
		gridData.push(-20, 0, i, 20, 0, i);
	}
	return {
		floorBuffer: createStaticBuffer(gl, [-1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, 1]),
		floorNormalBuffer: createStaticBuffer(gl, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
		gridBuffer: createStaticBuffer(gl, gridData),
		gridVertexCount: gridData.length / 3,
		boxBuffer: createStaticBuffer(gl, [
			-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5,
			-0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
			-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
			-0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
			-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
			-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
			-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
			-0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
			-0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5,
			-0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
			0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5,
			0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5
		]),
		boxNormalBuffer: createStaticBuffer(gl, [
			0, 0, -1, 0, 0, -1, 0, 0, -1,
			0, 0, -1, 0, 0, -1, 0, 0, -1,
			0, 0, 1, 0, 0, 1, 0, 0, 1,
			0, 0, 1, 0, 0, 1, 0, 0, 1,
			0, -1, 0, 0, -1, 0, 0, -1, 0,
			0, -1, 0, 0, -1, 0, 0, -1, 0,
			0, 1, 0, 0, 1, 0, 0, 1, 0,
			0, 1, 0, 0, 1, 0, 0, 1, 0,
			-1, 0, 0, -1, 0, 0, -1, 0, 0,
			-1, 0, 0, -1, 0, 0, -1, 0, 0,
			1, 0, 0, 1, 0, 0, 1, 0, 0,
			1, 0, 0, 1, 0, 0, 1, 0, 0
		]),
		menuBuffer: createStaticBuffer(gl, [-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0]),
		menuUvBuffer: createStaticBuffer(gl, [0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
		lineBuffer: gl.createBuffer()
	};
};


// MR lighting renderer
const createMrLightingRenderer = function() {
	let gl = null;
	let program = null;
	let programLocs = null;
	let depthTexture2dProgram = null;
	let buffer = null;
	let depthTexture2dLocs = null;
	const maskCenters = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const maskParams = new Float32Array(PASSTHROUGH_MAX_FLASHLIGHTS * 2);
	const additiveColor = new Float32Array(3);
	const overlayVertexSource = [
		"attribute vec2 position;",
		"varying vec2 vScreenUv;",
		"void main(){",
		"vScreenUv=position*0.5+0.5;",
		"gl_Position=vec4(position,0.0,1.0);",
		"}"
	].join("");

	const fragmentSource = [
		"precision highp float;",
		"uniform float darkAlpha;",
		"uniform float visibleShare;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec3 additiveColor;",
		"uniform float additiveStrength;",
		"uniform float lightLayerCount;",
		"uniform vec4 lightLayerColors[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec2 lightLayerCenters[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEllipseParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAlphaBlendStrengths[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEffectParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAdditiveScale;",
		"uniform float lightLayerAlphaBlendScale;",
		"varying vec2 vScreenUv;",
		"float circleMask(vec2 uv, vec2 center, vec2 params){",
		"float radius=max(params.x,0.0001);",
		"float softness=max(params.y,0.0001);",
		"float inner=max(0.0,radius-softness);",
		"return 1.0-smoothstep(inner,radius,distance(uv,center));",
		"}",
		"float ellipseMask(vec2 uv, vec2 center, vec4 params){",
		"float radiusX=max(params.x,0.0001);",
		"float radiusY=max(params.y,0.0001);",
		"float softness=max(params.z,0.0001);",
		"float rotation=params.w;",
		"vec2 delta=uv-center;",
		"float cosAngle=cos(rotation);",
		"float sinAngle=sin(rotation);",
		"vec2 local=vec2(delta.x*cosAngle+delta.y*sinAngle,-delta.x*sinAngle+delta.y*cosAngle);",
		"float normalizedDistance=length(vec2(local.x/radiusX,local.y/radiusY));",
		"float edge=max(softness/max(radiusX,radiusY),0.0001);",
		"return 1.0-smoothstep(max(0.0,1.0-edge),1.0,normalizedDistance);",
		"}",
		fixtureEffectFragmentSource,
		"void main(){",
		"float alphaBlendOpen=visibleShare;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float localMask=circleMask(vScreenUv,maskCenters[i],maskParams[i]);",
		"alphaBlendOpen=1.0-(1.0-alphaBlendOpen)*(1.0-localMask);",
		"}",
		"vec3 color=additiveColor*additiveStrength*alphaBlendOpen;",
		"float localAlphaBlendOpen=0.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_LIGHT_LAYERS + ";i+=1){",
		"if(float(i)>=lightLayerCount){break;}",
		"float lightLayerMask=ellipseMask(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i]);",
		"vec2 effectMask=lightLayerEffect(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i],lightLayerEffectParams[i]);",
		"float lightLayerStrength=lightLayerColors[i].a*lightLayerMask*effectMask.x*alphaBlendOpen*lightLayerAdditiveScale;",
		"color+=lightLayerColors[i].rgb*lightLayerStrength;",
		"localAlphaBlendOpen=max(localAlphaBlendOpen,clamp(lightLayerColors[i].a*lightLayerMask*effectMask.y*lightLayerAlphaBlendStrengths[i]*1.65*alphaBlendOpen*lightLayerAlphaBlendScale,0.0,1.0));",
		"}",
		"gl_FragColor=vec4(color,darkAlpha*alphaBlendOpen*(1.0-localAlphaBlendOpen));",
		"}"
	].join("");

	const depthOverlayShaderChunk = [
		createDepthBandMaskShaderChunk("computeDepthMask"),
		"float computeDepthRetainShare(float baseVisibleShare){",
		"if(depthMrRetain<=0.0001){",
		"return baseVisibleShare;",
		"}",
		"float depthMeters=sampleDepth(vScreenUv);",
		"float valid=step(0.001,depthMeters);",
		"float mask=computeDepthMask(depthMeters);",
		"float localRetain=depthMrRetain*(1.0-mask)*valid;",
		"return max(baseVisibleShare,localRetain);",
		"}"
	].join("");
	const depthTexture2dFragmentSource = [
		"precision highp float;",
		"uniform float darkAlpha;",
		"uniform float visibleShare;",
		"uniform float maskCount;",
		"uniform vec2 maskCenters[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec2 maskParams[" + PASSTHROUGH_MAX_FLASHLIGHTS + "];",
		"uniform vec3 additiveColor;",
		"uniform float additiveStrength;",
		"uniform float lightLayerCount;",
		"uniform vec4 lightLayerColors[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec2 lightLayerCenters[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEllipseParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAlphaBlendStrengths[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerEffectParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec3 lightLayerWorldCenters[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec3 lightLayerWorldBasisX[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec3 lightLayerWorldBasisY[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform vec4 lightLayerWorldEllipseParams[" + PASSTHROUGH_MAX_LIGHT_LAYERS + "];",
		"uniform float lightLayerAdditiveScale;",
		"uniform float lightLayerAlphaBlendScale;",
		"uniform sampler2D depthTexture;",
		"uniform float depthMode;",
		"uniform float depthThreshold;",
		"uniform float depthFade;",
		"uniform float depthEchoWavelength;",
		"uniform float depthEchoDutyCycle;",
		"uniform float depthEchoFade;",
		"uniform float depthPhaseOffset;",
		"uniform float depthMrRetain;",
		"uniform float depthHasWorldPoints;",
		"varying vec2 vScreenUv;",
		"float circleMask(vec2 uv, vec2 center, vec2 params){float radius=max(params.x,0.0001);float softness=max(params.y,0.0001);float inner=max(0.0,radius-softness);return 1.0-smoothstep(inner,radius,distance(uv,center));}",
		depthEllipseMaskShaderChunk,
		fixtureEffectFragmentSource,
		"float sampleDepth(vec2 depthUv){return texture2D(depthTexture,depthUv).r;}",
		depthOverlayShaderChunk,
		depthWorldEllipseMaskShaderChunk,
		"void main(){",
		"float alphaBlendOpen=computeDepthRetainShare(visibleShare);",
		"vec4 packedDepth=texture2D(depthTexture,vScreenUv);",
		"float lightLayerDepthMeters=packedDepth.r;",
		"float lightLayerDepthValid=step(0.001,lightLayerDepthMeters);",
		"vec3 lightLayerWorldPoint=packedDepth.gba;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_FLASHLIGHTS + ";i+=1){",
		"if(float(i)>=maskCount){break;}",
		"float localMask=circleMask(vScreenUv,maskCenters[i],maskParams[i]);",
		"alphaBlendOpen=1.0-(1.0-alphaBlendOpen)*(1.0-localMask);",
		"}",
		"vec3 color=additiveColor*additiveStrength*alphaBlendOpen;",
		"float localAlphaBlendOpen=0.0;",
		"for(int i=0;i<" + PASSTHROUGH_MAX_LIGHT_LAYERS + ";i+=1){",
		"if(float(i)>=lightLayerCount){break;}",
		"float lightLayerMask=ellipseMask(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i]);",
		"if(depthHasWorldPoints>0.5&&lightLayerWorldEllipseParams[i].x>0.0001&&lightLayerDepthValid>0.5){lightLayerMask=worldEllipseMask(lightLayerWorldPoint,lightLayerWorldCenters[i],lightLayerWorldBasisX[i],lightLayerWorldBasisY[i],lightLayerWorldEllipseParams[i]);}",
		"vec2 effectMask=lightLayerEffect(vScreenUv,lightLayerCenters[i],lightLayerEllipseParams[i],lightLayerEffectParams[i]);",
		"float lightLayerStrength=lightLayerColors[i].a*lightLayerMask*effectMask.x*alphaBlendOpen*lightLayerAdditiveScale;",
		"color+=lightLayerColors[i].rgb*lightLayerStrength;",
		"localAlphaBlendOpen=max(localAlphaBlendOpen,clamp(lightLayerColors[i].a*lightLayerMask*effectMask.y*lightLayerAlphaBlendStrengths[i]*1.65*alphaBlendOpen*lightLayerAlphaBlendScale,0.0,1.0));",
		"}",
		"gl_FragColor=vec4(color,darkAlpha*alphaBlendOpen*(1.0-localAlphaBlendOpen));",
		"}"
	].join("");
	const buildOverlayLocs = function(targetProgram) {
		return {
			position: gl.getAttribLocation(targetProgram, "position"),
			darkAlpha: gl.getUniformLocation(targetProgram, "darkAlpha"),
			visibleShare: gl.getUniformLocation(targetProgram, "visibleShare"),
			maskCount: gl.getUniformLocation(targetProgram, "maskCount"),
			maskCenters: gl.getUniformLocation(targetProgram, "maskCenters"),
			maskParams: gl.getUniformLocation(targetProgram, "maskParams"),
			additiveColor: gl.getUniformLocation(targetProgram, "additiveColor"),
			additiveStrength: gl.getUniformLocation(targetProgram, "additiveStrength"),
			lightLayerCount: gl.getUniformLocation(targetProgram, "lightLayerCount"),
			lightLayerCenters: gl.getUniformLocation(targetProgram, "lightLayerCenters"),
			lightLayerColors: gl.getUniformLocation(targetProgram, "lightLayerColors"),
			lightLayerEllipseParams: gl.getUniformLocation(targetProgram, "lightLayerEllipseParams"),
			lightLayerAlphaBlendStrengths: gl.getUniformLocation(targetProgram, "lightLayerAlphaBlendStrengths"),
			lightLayerEffectParams: gl.getUniformLocation(targetProgram, "lightLayerEffectParams"),
			lightLayerWorldCenters: gl.getUniformLocation(targetProgram, "lightLayerWorldCenters"),
			lightLayerWorldBasisX: gl.getUniformLocation(targetProgram, "lightLayerWorldBasisX"),
			lightLayerWorldBasisY: gl.getUniformLocation(targetProgram, "lightLayerWorldBasisY"),
			lightLayerWorldEllipseParams: gl.getUniformLocation(targetProgram, "lightLayerWorldEllipseParams"),
			lightLayerAdditiveScale: gl.getUniformLocation(targetProgram, "lightLayerAdditiveScale"),
			lightLayerAlphaBlendScale: gl.getUniformLocation(targetProgram, "lightLayerAlphaBlendScale"),
			depthTexture: gl.getUniformLocation(targetProgram, "depthTexture"),
			depthMode: gl.getUniformLocation(targetProgram, "depthMode"),
			depthThreshold: gl.getUniformLocation(targetProgram, "depthThreshold"),
			depthFade: gl.getUniformLocation(targetProgram, "depthFade"),
			depthEchoWavelength: gl.getUniformLocation(targetProgram, "depthEchoWavelength"),
			depthEchoDutyCycle: gl.getUniformLocation(targetProgram, "depthEchoDutyCycle"),
			depthEchoFade: gl.getUniformLocation(targetProgram, "depthEchoFade"),
			depthPhaseOffset: gl.getUniformLocation(targetProgram, "depthPhaseOffset"),
			depthMrRetain: gl.getUniformLocation(targetProgram, "depthMrRetain"),
			depthHasWorldPoints: gl.getUniformLocation(targetProgram, "depthHasWorldPoints")
		};
	};
	return {
		init: function(glContext) {
			gl = glContext;
			program = createProgram(gl, fullscreenVertexSource, fragmentSource, "Passthrough overlay");
			programLocs = buildOverlayLocs(program);
			depthTexture2dProgram = createProgram(gl, overlayVertexSource, depthTexture2dFragmentSource, "Passthrough overlay depth texture2d");
			depthTexture2dLocs = buildOverlayLocs(depthTexture2dProgram);
			buffer = createFullscreenTriangleBuffer(gl);
		},
		draw: function(renderState, depthInfo) {
			if (!renderState) {
				return;
			}
			const effectiveAlphaBlendOpen = renderState.visibleShare > 0.001 || renderState.maskCount > 0 || !!(renderState.depth && renderState.depth.depthMrRetain > 0.001);
			if (!effectiveAlphaBlendOpen) {
				return;
			}
			const lightLayers = renderState.lightLayers;
			if (!lightLayers) {
				return;
			}
			for (let i = 0; i < maskCenters.length; i += 1) {
				maskCenters[i] = 0;
				maskParams[i] = 0;
			}
			for (let i = 0; i < renderState.maskCount && i < PASSTHROUGH_MAX_FLASHLIGHTS; i += 1) {
				maskCenters[i * 2] = renderState.masks[i].x;
				maskCenters[i * 2 + 1] = renderState.masks[i].y;
				maskParams[i * 2] = renderState.masks[i].radius;
				maskParams[i * 2 + 1] = renderState.masks[i].softness;
			}
			additiveColor[0] = renderState.additiveColor[0];
			additiveColor[1] = renderState.additiveColor[1];
			additiveColor[2] = renderState.additiveColor[2];
			const useDepthProgramBool = !!(depthInfo && depthInfo.texture && depthInfo.depthEncodingMode === DEPTH_ENCODING_LINEAR_VIEW_Z && (renderState.depth || lightLayers.surfaceDepthLayerCount > 0));
			const activeProgram = useDepthProgramBool ? depthTexture2dProgram : program;
			const activeLocs = useDepthProgramBool ? depthTexture2dLocs : programLocs;
			gl.enable(gl.BLEND);
			// Accumulate MR alpha additively so the global visualizer->MR crossfade does not
			// open an extra direct-passthrough gap between two already intentional layers.
			gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			gl.useProgram(activeProgram);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(activeLocs.position);
			gl.vertexAttribPointer(activeLocs.position, 2, gl.FLOAT, false, 0, 0);
			gl.uniform1f(activeLocs.darkAlpha, renderState.darkAlpha);
			gl.uniform1f(activeLocs.visibleShare, renderState.visibleShare);
			gl.uniform1f(activeLocs.maskCount, renderState.maskCount);
			gl.uniform2fv(activeLocs.maskCenters, maskCenters);
			gl.uniform2fv(activeLocs.maskParams, maskParams);
			gl.uniform3fv(activeLocs.additiveColor, additiveColor);
			gl.uniform1f(activeLocs.additiveStrength, renderState.additiveStrength);
			gl.uniform1f(activeLocs.lightLayerCount, lightLayers.count);
			gl.uniform2fv(activeLocs.lightLayerCenters, lightLayers.centersUv);
			gl.uniform4fv(activeLocs.lightLayerColors, lightLayers.colors);
			gl.uniform4fv(activeLocs.lightLayerEllipseParams, lightLayers.ellipseParamsUv);
			gl.uniform1fv(activeLocs.lightLayerAlphaBlendStrengths, lightLayers.alphaBlendStrengths);
			gl.uniform4fv(activeLocs.lightLayerEffectParams, lightLayers.effectParams);
			gl.uniform1f(activeLocs.lightLayerAdditiveScale, renderState.lightLayerAdditiveScale == null ? 1 : renderState.lightLayerAdditiveScale);
			gl.uniform1f(activeLocs.lightLayerAlphaBlendScale, renderState.lightLayerAlphaBlendScale == null ? 1 : renderState.lightLayerAlphaBlendScale);
			if (useDepthProgramBool && activeLocs.depthTexture) {
				gl.uniform1f(activeLocs.depthMode, renderState.depth && renderState.depth.depthMode != null ? renderState.depth.depthMode : 0);
				gl.uniform1f(activeLocs.depthThreshold, renderState.depth ? renderState.depth.depthThreshold : 0);
				gl.uniform1f(activeLocs.depthFade, renderState.depth ? renderState.depth.depthFade : 0);
				gl.uniform1f(activeLocs.depthEchoWavelength, renderState.depth && renderState.depth.depthEchoWavelength != null ? renderState.depth.depthEchoWavelength : 1);
				gl.uniform1f(activeLocs.depthEchoDutyCycle, renderState.depth && renderState.depth.depthEchoDutyCycle != null ? renderState.depth.depthEchoDutyCycle : 0.5);
				gl.uniform1f(activeLocs.depthEchoFade, renderState.depth && renderState.depth.depthEchoFade != null ? renderState.depth.depthEchoFade : 0);
				gl.uniform1f(activeLocs.depthPhaseOffset, renderState.depth && renderState.depth.depthPhaseOffset != null ? renderState.depth.depthPhaseOffset : 0);
				gl.uniform1f(activeLocs.depthMrRetain, renderState.depth ? (renderState.depth.depthMrRetain || 0) : 0);
				gl.uniform1f(activeLocs.depthHasWorldPoints, depthInfo.worldPointAvailableBool ? 1 : 0);
				gl.uniform3fv(activeLocs.lightLayerWorldCenters, lightLayers.worldCenters);
				gl.uniform3fv(activeLocs.lightLayerWorldBasisX, lightLayers.worldBasisX);
				gl.uniform3fv(activeLocs.lightLayerWorldBasisY, lightLayers.worldBasisY);
				gl.uniform4fv(activeLocs.lightLayerWorldEllipseParams, lightLayers.worldEllipseParams);
				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, depthInfo.texture);
				gl.uniform1i(activeLocs.depthTexture, 1);
			}
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.DEPTH_TEST);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		}
	};
};

// Scene renderer
const createSceneRenderer = function(options) {
	const canvas = options.canvas;
	const floorReceivesSceneLightingBool = options.floorReceivesSceneLightingBool !== false;
	let gl = null;
	let colorProgram = null;
	let litColorProgram = null;
	let texProgram = null;
	let colorPositionLoc = null;
	let litColorPositionLoc = null;
	let litColorNormalLoc = null;
	let colorModelLoc = null;
	let litColorModelLoc = null;
	let colorViewLoc = null;
	let litColorViewLoc = null;
	let colorProjLoc = null;
	let litColorProjLoc = null;
	let colorUniformLoc = null;
	let litColorUniformLoc = null;
	let litColorLightingUniforms = null;
	let texPositionLoc = null;
	let texUvLoc = null;
	let texModelLoc = null;
	let texViewLoc = null;
	let texProjLoc = null;
	let texSamplerLoc = null;
	let menuTexture = null;
	let mrLightingRenderer = null;
	let punchRenderer = null;
	let worldMaskCompositeRenderer = null;
	let processedDepthRenderer = null;
	let geometry = null;
	let webgl2Bool = false;
	const currentView = new Float32Array(16);
	const currentProj = new Float32Array(16);
	const currentPassthroughView = new Float32Array(16);
	const currentPassthroughProj = new Float32Array(16);
	const colorVec4 = new Float32Array(4);
	// pre-allocated buffers to avoid per-frame garbage in render loop
	const overlayLineData = new Float32Array(6);
	const reusableFloorMatrix = new Float32Array(16);
	const reusableBoxMatrix = new Float32Array(16);
	const reusableMenuPlaneMatrix = new Float32Array(16);
	const reusableRayEnd = {x: 0, y: 0, z: 0};
	const emptyMenuController = {
		state: {
			floorAlpha: 0.72,
			menuOpenBool: false,
			plane: {
				center: {x: 0, y: 0, z: 0},
				right: {x: 1, y: 0, z: 0},
				up: {x: 0, y: 1, z: 0},
				normal: {x: 0, y: 0, z: 1}
			},
			planeWidth: options.menuWidth || 0.74,
			planeHeight: (options.menuWidth || 0.74) * 0.75
		},
		controllerRays: [],
		renderTexture: function() {}
	};

	const perspectiveMatrix = function(fovRadians, aspect, near, far) {
		const f = 1 / Math.tan(fovRadians * 0.5);
		const rangeInv = 1 / (near - far);
		return new Float32Array([
			f / aspect, 0, 0, 0,
			0, f, 0, 0,
			0, 0, (near + far) * rangeInv, -1,
			0, 0, near * far * rangeInv * 2, 0
		]);
	};

	const createViewMatrixFromYawPitch = function(eyeX, eyeY, eyeZ, yaw, pitch) {
		const cosYaw = Math.cos(yaw);
		const sinYaw = Math.sin(yaw);
		const cosPitch = Math.cos(pitch);
		const sinPitch = Math.sin(pitch);
		const xAxis = {x: cosYaw, y: 0, z: sinYaw};
		const yAxis = {x: -sinYaw * sinPitch, y: cosPitch, z: cosYaw * sinPitch};
		const zAxis = {x: -sinYaw * cosPitch, y: -sinPitch, z: cosYaw * cosPitch};
		return new Float32Array([
			xAxis.x, yAxis.x, zAxis.x, 0,
			xAxis.y, yAxis.y, zAxis.y, 0,
			xAxis.z, yAxis.z, zAxis.z, 0,
			-(xAxis.x * eyeX + xAxis.y * eyeY + xAxis.z * eyeZ),
			-(yAxis.x * eyeX + yAxis.y * eyeY + yAxis.z * eyeZ),
			-(zAxis.x * eyeX + zAxis.y * eyeY + zAxis.z * eyeZ),
			1
		]);
	};

	// Apply IPD delta as view-matrix translation offset.
	// Uses native view.transform.inverse.matrix as base to preserve ATW precision,
	// then shifts only by the difference between desired and native eye position.
	const applyEyeDistanceDelta = function(viewMatrix, view, pose, eyeDistanceMeters) {
		const center = pose.transform.position;
		const eye = view.transform.position;
		const offsetX = eye.x - center.x;
		const offsetY = eye.y - center.y;
		const offsetZ = eye.z - center.z;
		const nativeHalfIpd = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);
		if (nativeHalfIpd < 0.000001) {
			return;
		}
		const scaleDelta = (eyeDistanceMeters * 0.5) / nativeHalfIpd - 1;
		if (Math.abs(scaleDelta) < 0.0001) {
			return;
		}
		// World-space camera shift = eye offset * scaleDelta
		const dx = offsetX * scaleDelta;
		const dy = offsetY * scaleDelta;
		const dz = offsetZ * scaleDelta;
		// Translate view matrix: subtract R^T * delta from translation column
		viewMatrix[12] -= viewMatrix[0] * dx + viewMatrix[4] * dy + viewMatrix[8] * dz;
		viewMatrix[13] -= viewMatrix[1] * dx + viewMatrix[5] * dy + viewMatrix[9] * dz;
		viewMatrix[14] -= viewMatrix[2] * dx + viewMatrix[6] * dy + viewMatrix[10] * dz;
	};

	const setColorUniform = function(uniformLoc, color) {
		colorVec4[0] = color[0];
		colorVec4[1] = color[1];
		colorVec4[2] = color[2];
		colorVec4[3] = color[3];
		gl.uniform4fv(uniformLoc, colorVec4);
	};

	const drawColor = function(buffer, count, mode, model, color) {
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(colorProgram);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(colorPositionLoc);
		gl.vertexAttribPointer(colorPositionLoc, 3, gl.FLOAT, false, 0, 0);
		gl.uniformMatrix4fv(colorModelLoc, false, model);
		gl.uniformMatrix4fv(colorViewLoc, false, currentView);
		gl.uniformMatrix4fv(colorProjLoc, false, currentProj);
		setColorUniform(colorUniformLoc, color);
		gl.drawArrays(mode, 0, count);
	};

	const drawLitColor = function(positionBuffer, normalBuffer, count, mode, model, color, sceneLighting) {
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(litColorProgram);
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.enableVertexAttribArray(litColorPositionLoc);
		gl.vertexAttribPointer(litColorPositionLoc, 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
		gl.enableVertexAttribArray(litColorNormalLoc);
		gl.vertexAttribPointer(litColorNormalLoc, 3, gl.FLOAT, false, 0, 0);
		gl.uniformMatrix4fv(litColorModelLoc, false, model);
		gl.uniformMatrix4fv(litColorViewLoc, false, currentView);
		gl.uniformMatrix4fv(litColorProjLoc, false, currentProj);
		setColorUniform(litColorUniformLoc, color);
		if (options.applyLightingUniforms && litColorLightingUniforms && sceneLighting) {
			options.applyLightingUniforms(gl, litColorLightingUniforms, sceneLighting.getState());
		}
		gl.drawArrays(mode, 0, count);
	};

	const drawTexturedPlane = function(model) {
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(texProgram);
		gl.bindBuffer(gl.ARRAY_BUFFER, geometry.menuBuffer);
		gl.enableVertexAttribArray(texPositionLoc);
		gl.vertexAttribPointer(texPositionLoc, 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, geometry.menuUvBuffer);
		gl.enableVertexAttribArray(texUvLoc);
		gl.vertexAttribPointer(texUvLoc, 2, gl.FLOAT, false, 0, 0);
		gl.uniformMatrix4fv(texModelLoc, false, model);
		gl.uniformMatrix4fv(texViewLoc, false, currentView);
		gl.uniformMatrix4fv(texProjLoc, false, currentProj);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, menuTexture);
		gl.uniform1i(texSamplerLoc, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	};

	const drawFloor = function(sceneLighting, reactiveColors) {
		const worldAlpha = reactiveColors.floor[3];
		gl.disable(gl.CULL_FACE);
		const floorMatrix = translateScale(0, -0.01, 0, options.floorHalfSize, 1, options.floorHalfSize, reusableFloorMatrix);
		if (floorReceivesSceneLightingBool) {
			drawLitColor(geometry.floorBuffer, geometry.floorNormalBuffer, 6, gl.TRIANGLES, floorMatrix, reactiveColors.floor, sceneLighting);
		} else {
			drawColor(geometry.floorBuffer, 6, gl.TRIANGLES, floorMatrix, reactiveColors.floor);
		}
		drawColor(geometry.gridBuffer, geometry.gridVertexCount, gl.LINES, identityMatrix(), reactiveColors.grid);
		for (let i = 0; i < options.levelBoxes.length; i += 1) {
			const box = options.levelBoxes[i];
			const pulse = options.clampNumber(reactiveColors.audioLevel * 0.4 + reactiveColors.beatPulse * 0.75 + reactiveColors.transient * 1.8, 0, 1);
			drawLitColor(
				geometry.boxBuffer,
				geometry.boxNormalBuffer,
				36,
				gl.TRIANGLES,
				translateScale(box.x, box.y, box.z, box.width, box.height, box.depth, reusableBoxMatrix),
				[
					options.clampNumber(box.color[0] + pulse * 0.25, 0, 1),
					options.clampNumber(box.color[1] + pulse * 0.25, 0, 1),
					options.clampNumber(box.color[2] + pulse * 0.25, 0, 1),
					options.clampNumber((box.color[3] + reactiveColors.beatPulse * 0.12) * worldAlpha, 0, 0.95)
				],
				sceneLighting
			);
		}
		gl.enable(gl.CULL_FACE);
	};

	const drawWorldLayer = function(args) {
		const menuController = args.menuController || emptyMenuController;
		const menuState = menuController.state;
		if (menuState.floorAlpha > 0.001) {
			drawFloor(args.sceneLighting, args.getReactiveFloorColors());
		}
		if (args.glbAssetStore) {
			args.glbAssetStore.draw(currentView, currentProj);
		}
		if (args.visualizerEngine) {
			args.visualizerEngine.drawWorld();
		}
	};

	const drawDepthMaskedLayer = function(args, worldMaskState, drawCallback) {
		if (!worldMaskCompositeRenderer || !worldMaskState || !drawCallback) {
			return;
		}
		worldMaskCompositeRenderer.beginWorldPass(args.targetViewport.width, args.targetViewport.height);
		drawCallback();
		gl.bindFramebuffer(gl.FRAMEBUFFER, args.outputFramebuffer || null);
		gl.viewport(args.targetViewport.x, args.targetViewport.y, args.targetViewport.width, args.targetViewport.height);
		worldMaskCompositeRenderer.compositeWorld(worldMaskState, args.processedDepthInfo);
	};

		const createWorldMaskCompositeRenderer = function() {
			let buffer = null;
			let framebuffer = null;
			let colorTexture = null;
			let depthBuffer = null;
			let texture2dProgram = null;
			let texture2dLocs = null;
			let targetWidth = 0;
			let targetHeight = 0;
			const buildLocs = function(program) {
				return {
					position: gl.getAttribLocation(program, "position"),
					worldTexture: gl.getUniformLocation(program, "worldTexture"),
					depthTexture: gl.getUniformLocation(program, "depthTexture"),
					depthMode: gl.getUniformLocation(program, "depthMode"),
					depthThreshold: gl.getUniformLocation(program, "depthThreshold"),
					depthFade: gl.getUniformLocation(program, "depthFade"),
					depthEchoWavelength: gl.getUniformLocation(program, "depthEchoWavelength"),
					depthEchoDutyCycle: gl.getUniformLocation(program, "depthEchoDutyCycle"),
					depthEchoFade: gl.getUniformLocation(program, "depthEchoFade"),
					depthPhaseOffset: gl.getUniformLocation(program, "depthPhaseOffset")
				};
			};
		const ensureRenderTarget = function(width, height) {
			if (width === targetWidth && height === targetHeight && framebuffer && colorTexture && depthBuffer) {
				return;
			}
			targetWidth = Math.max(1, width | 0);
			targetHeight = Math.max(1, height | 0);
			if (!framebuffer) {
				framebuffer = gl.createFramebuffer();
			}
			if (!colorTexture) {
				colorTexture = gl.createTexture();
			}
			if (!depthBuffer) {
				depthBuffer = gl.createRenderbuffer();
			}
			gl.bindTexture(gl.TEXTURE_2D, colorTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, targetWidth, targetHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, targetWidth, targetHeight);
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
			gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
		};
		const worldCompositeVertSource = [
			"attribute vec2 position;",
			"varying vec2 vScreenUv;",
			"void main(){",
			"vScreenUv=position*0.5+0.5;",
			"gl_Position=vec4(position,0.0,1.0);",
			"}"
		].join("");
		const worldCompositeTexture2dFragSource = [
			"precision highp float;",
			"uniform sampler2D worldTexture;",
			"uniform sampler2D depthTexture;",
			"uniform float depthMode;",
			"uniform float depthThreshold;",
			"uniform float depthFade;",
			"uniform float depthEchoWavelength;",
			"uniform float depthEchoDutyCycle;",
			"uniform float depthEchoFade;",
			"uniform float depthPhaseOffset;",
			"varying vec2 vScreenUv;",
			createDepthBandMaskShaderChunk("computeDepthVisibility"),
			"void main(){",
			"vec4 worldColor=texture2D(worldTexture,vScreenUv);",
			"float depthMeters=texture2D(depthTexture,vScreenUv).r;",
			"float valid=step(0.001,depthMeters);",
			"float visibility=valid>0.0?computeDepthVisibility(depthMeters):1.0;",
			"gl_FragColor=vec4(worldColor.rgb,worldColor.a*visibility);",
			"}"
		].join("");
		return {
			init: function() {
				buffer = createFullscreenTriangleBuffer(gl);
			},
			beginWorldPass: function(width, height) {
				ensureRenderTarget(width, height);
				gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
				gl.viewport(0, 0, targetWidth, targetHeight);
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			},
			compositeWorld: function(worldMaskState, depthInfo) {
				if (!worldMaskState || !depthInfo || !colorTexture) {
					return;
				}
				if (!depthInfo.texture) {
					return;
				}
				if (!texture2dProgram) {
					texture2dProgram = createProgram(gl, worldCompositeVertSource, worldCompositeTexture2dFragSource, "World composite texture2d");
					texture2dLocs = buildLocs(texture2dProgram);
				}
				gl.useProgram(texture2dProgram);
				gl.disable(gl.DEPTH_TEST);
				gl.disable(gl.CULL_FACE);
				gl.enable(gl.BLEND);
				gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, colorTexture);
				gl.uniform1i(texture2dLocs.worldTexture, 0);
				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, depthInfo.texture);
				gl.uniform1i(texture2dLocs.depthTexture, 1);
				gl.uniform1f(texture2dLocs.depthMode, worldMaskState.depthMode == null ? 0 : worldMaskState.depthMode);
				gl.uniform1f(texture2dLocs.depthThreshold, worldMaskState.depthThreshold);
				gl.uniform1f(texture2dLocs.depthFade, worldMaskState.depthFade);
				gl.uniform1f(texture2dLocs.depthEchoWavelength, worldMaskState.depthEchoWavelength == null ? 1 : worldMaskState.depthEchoWavelength);
				gl.uniform1f(texture2dLocs.depthEchoDutyCycle, worldMaskState.depthEchoDutyCycle == null ? 0.5 : worldMaskState.depthEchoDutyCycle);
				gl.uniform1f(texture2dLocs.depthEchoFade, worldMaskState.depthEchoFade == null ? 0 : worldMaskState.depthEchoFade);
				gl.uniform1f(texture2dLocs.depthPhaseOffset, worldMaskState.depthPhaseOffset == null ? 0 : worldMaskState.depthPhaseOffset);
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				gl.enableVertexAttribArray(texture2dLocs.position);
				gl.vertexAttribPointer(texture2dLocs.position, 2, gl.FLOAT, false, 0, 0);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
				gl.enable(gl.CULL_FACE);
				gl.enable(gl.DEPTH_TEST);
			}
		};
	};

	const drawOverlayLine = function(start, end, pointBool, color) {
		overlayLineData[0] = start.x;
		overlayLineData[1] = start.y;
		overlayLineData[2] = start.z;
		if (!pointBool) {
			overlayLineData[3] = end.x;
			overlayLineData[4] = end.y;
			overlayLineData[5] = end.z;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, geometry.lineBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, pointBool ? overlayLineData.subarray(0, 3) : overlayLineData, gl.DYNAMIC_DRAW);
		drawColor(geometry.lineBuffer, pointBool ? 1 : 2, pointBool ? gl.POINTS : gl.LINES, identityMatrix(), color);
	};

	const createSceneFrameState = function(args) {
		const menuController = args.menuController || emptyMenuController;
		const passthroughController = args.passthroughController || null;
		const controllerRays = menuController.controllerRays || [];
		// Depth must stay in passthrough/headset camera space. It must not follow
		// virtual locomotion or other game-world camera offsets.
		const depthViewMatrix = args.passthroughViewMatrix || currentView;
		const depthProjMatrix = args.passthroughProjMatrix || currentProj;
		const punchState = passthroughController && passthroughController.getPunchRenderState ? passthroughController.getPunchRenderState({
			viewMatrix: currentView,
			projMatrix: currentProj,
			controllerRays: controllerRays
		}) : null;
		return {
			menuController,
			menuState: menuController.state,
			passthroughController,
			visualizerBackgroundEnabledBool: args.visualizerBackgroundEnabledBool !== false,
			controllerRays,
			sceneLightingState: args.sceneLighting && args.sceneLighting.getState ? args.sceneLighting.getState() : null,
			depthViewMatrix: depthViewMatrix,
			depthProjMatrix: depthProjMatrix,
			punchState,
			worldMaskActiveBool: !!(worldMaskCompositeRenderer && punchState && punchState.worldMask && args.processedDepthInfo && (args.transparentBackgroundBool || args.passthroughFallbackBool))
		};
	};

	const renderVisualizerBackgroundLayer = function(args, frameState) {
		if (!frameState.visualizerBackgroundEnabledBool || !args.visualizerEngine) {
			return;
		}
		if (frameState.passthroughController && frameState.passthroughController.getBackgroundCompositeState) {
			applyVisualizerBackgroundComposite(args.visualizerEngine, frameState.passthroughController.getBackgroundCompositeState());
		}
		if (frameState.worldMaskActiveBool) {
			drawDepthMaskedLayer(args, frameState.punchState.worldMask, function() {
				args.visualizerEngine.drawPreScene();
			});
			return;
		}
		args.visualizerEngine.drawPreScene();
	};

	const renderModifiedRealityLayer = function(args, frameState) {
		if (!mrLightingRenderer || !(args.transparentBackgroundBool || args.passthroughFallbackBool)) {
			return;
		}
		mrLightingRenderer.draw(frameState.passthroughController && frameState.passthroughController.getOverlayRenderState ? frameState.passthroughController.getOverlayRenderState({
			viewMatrix: frameState.depthViewMatrix,
			projMatrix: frameState.depthProjMatrix,
			controllerRays: frameState.controllerRays,
			sceneLightingState: frameState.sceneLightingState
		}) : null, args.processedDepthInfo);
	};

	const renderVrWorldLayer = function(args, frameState) {
		if (frameState.worldMaskActiveBool) {
			drawDepthMaskedLayer(args, frameState.punchState.worldMask, function() {
				drawWorldLayer(args);
			});
			return;
		}
		drawWorldLayer(args);
	};

	const renderPunchLayer = function(args, frameState) {
		if (!punchRenderer || !(args.transparentBackgroundBool || args.passthroughFallbackBool) || !frameState.punchState) {
			return;
		}
		punchRenderer.draw(frameState.punchState, args.processedDepthInfo);
	};

	const renderSceneOverlayLayer = function(args, frameState) {
		if (args.visualizerEngine) {
			args.visualizerEngine.drawPostScene();
		}
		if (frameState.menuState.menuOpenBool) {
			frameState.menuController.renderTexture(gl, menuTexture, args.menuContentState);
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			drawTexturedPlane(basisScale(frameState.menuState.plane.center.x, frameState.menuState.plane.center.y, frameState.menuState.plane.center.z, frameState.menuState.plane.right, frameState.menuState.plane.up, frameState.menuState.plane.normal, frameState.menuState.planeWidth, frameState.menuState.planeHeight, 1, reusableMenuPlaneMatrix));
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.DEPTH_TEST);
		}
		for (let i = 0; i < frameState.controllerRays.length; i += 1) {
			const ray = frameState.controllerRays[i];
			reusableRayEnd.x = ray.origin.x + ray.dir.x * ray.length;
			reusableRayEnd.y = ray.origin.y + ray.dir.y * ray.length;
			reusableRayEnd.z = ray.origin.z + ray.dir.z * ray.length;
			drawOverlayLine(ray.origin, reusableRayEnd, false, ray.hitBool ? [1, 0.95, 0.2, 0.95] : [1, 0.2, 0.2, 0.9]);
			if (ray.hitPoint) {
				drawOverlayLine(ray.hitPoint, null, true, [0.2, 1, 0.2, 1]);
			}
		}
	};

	const renderScene = function(args) {
		const frameState = createSceneFrameState(args);
		renderVisualizerBackgroundLayer(args, frameState);
		renderModifiedRealityLayer(args, frameState);
		renderVrWorldLayer(args, frameState);
		renderPunchLayer(args, frameState);
		renderSceneOverlayLayer(args, frameState);
	};

	const clearSceneFramebuffer = function(passthroughFallbackBool, transparentBackgroundBool) {
		if (transparentBackgroundBool) {
			gl.clearColor(0, 0, 0, 0);
		} else {
			gl.clearColor(passthroughFallbackBool ? 0 : 0.01, passthroughFallbackBool ? 0 : 0.01, passthroughFallbackBool ? 0 : 0.08, 1);
		}
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	};

	const preparePreviewFrameState = function(args) {
		currentView.set(createViewMatrixFromYawPitch(
			args.desktopMovementState.origin.x,
			args.desktopMovementState.origin.y + args.desktopMovementState.eyeHeightMeters,
			args.desktopMovementState.origin.z,
			args.desktopMovementState.lookYaw,
			args.desktopMovementState.lookPitch
		));
		currentProj.set(perspectiveMatrix(Math.PI / 3, canvas.width / canvas.height, 0.05, 100));
		currentPassthroughView.set(currentView);
		currentPassthroughProj.set(currentProj);
		args.passthroughViewMatrix = currentPassthroughView;
		args.passthroughProjMatrix = currentPassthroughProj;
		args.rawPassthroughDepthInfo = null;
		args.processedDepthInfo = null;
		args.depthReprojectionState = null;
		args.viewIndex = 0;
		args.outputFramebuffer = null;
		args.targetViewport = {x: 0, y: 0, width: canvas.width, height: canvas.height};
		if (args.visualizerEngine) {
			args.visualizerEngine.setPreviewView(currentView, currentProj);
			args.visualizerEngine.update(args.previewTimeSeconds);
		}
	};

	const prepareXrViewState = function(args, view, viewIndex) {
		const viewport = args.baseLayer.getViewport(view);
		gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
		// Use native inverse matrix from the XR runtime for ATW-correct precision
		currentView.set(view.transform.inverse.matrix);
		currentProj.set(view.projectionMatrix);
		// Apply eye distance (IPD) adjustment as translation delta for scale effect
		applyEyeDistanceDelta(currentView, view, args.pose, args.eyeDistanceMeters);
		if (args.passthroughPose && args.passthroughPose.views && args.passthroughPose.views[viewIndex]) {
			const passthroughView = args.passthroughPose.views[viewIndex];
			currentPassthroughView.set(passthroughView.transform.inverse.matrix);
			currentPassthroughProj.set(passthroughView.projectionMatrix);
		} else {
			currentPassthroughView.set(currentView);
			currentPassthroughProj.set(currentProj);
		}
		args.passthroughViewMatrix = currentPassthroughView;
		args.passthroughProjMatrix = currentPassthroughProj;
		args.rawPassthroughDepthInfo = args.passthroughDepthInfoByView && args.passthroughDepthInfoByView[viewIndex] ? args.passthroughDepthInfoByView[viewIndex] : null;
		args.depthReprojectionState = args.depthReprojectionByView && args.depthReprojectionByView[viewIndex] ? args.depthReprojectionByView[viewIndex] : null;
		args.viewIndex = viewIndex;
		args.outputFramebuffer = args.baseLayer.framebuffer;
		args.targetViewport = viewport;
		return viewport;
	};

	const processSceneDepthForView = function(args, viewport) {
		const depthProcessingConfig = args.passthroughController && args.passthroughController.getDepthProcessingConfig ? args.passthroughController.getDepthProcessingConfig() : null;
		args.processedDepthInfo = processedDepthRenderer && args.rawPassthroughDepthInfo && depthProcessingConfig ? processedDepthRenderer.process({
			viewIndex: args.viewIndex,
			viewport: viewport,
			depthInfo: args.rawPassthroughDepthInfo,
			depthProfile: args.depthProfile || null,
			depthReprojectionState: args.depthReprojectionState || null,
			targetViewMatrix: args.passthroughViewMatrix || currentView,
			targetProjMatrix: args.passthroughProjMatrix || currentProj,
			processingConfig: depthProcessingConfig,
			outputFramebuffer: args.baseLayer.framebuffer
		}) : null;
		gl.bindFramebuffer(gl.FRAMEBUFFER, args.baseLayer.framebuffer);
		gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
		if (args.visualizerEngine) {
			args.visualizerEngine.setRenderView(currentView, currentProj);
		}
	};

	const renderPreviewPass = function(args) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		clearSceneFramebuffer(args.passthroughFallbackBool, false);
		preparePreviewFrameState(args);
		renderScene(args);
	};

	const renderSingleXrView = function(args, view, viewIndex) {
		const viewport = prepareXrViewState(args, view, viewIndex);
		processSceneDepthForView(args, viewport);
		renderScene(args);
	};

	const renderXrViews = function(args) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, args.baseLayer.framebuffer);
		clearSceneFramebuffer(args.passthroughFallbackBool, args.transparentBackgroundBool);
		for (let i = 0; i < args.pose.views.length; i += 1) {
			renderSingleXrView(args, args.pose.views[i], i);
		}
	};

	const initPrograms = function() {
		const colorVs = "attribute vec3 position;uniform mat4 model;uniform mat4 view;uniform mat4 proj;void main(){gl_Position=proj*view*model*vec4(position,1.0);}";
		const colorFs = "precision mediump float;uniform vec4 color;void main(){gl_FragColor=color;}";
		colorProgram = createProgram(gl, colorVs, colorFs, "Scene color");
		colorPositionLoc = gl.getAttribLocation(colorProgram, "position");
		colorModelLoc = gl.getUniformLocation(colorProgram, "model");
		colorViewLoc = gl.getUniformLocation(colorProgram, "view");
		colorProjLoc = gl.getUniformLocation(colorProgram, "proj");
		colorUniformLoc = gl.getUniformLocation(colorProgram, "color");

		const litColorVs = "attribute vec3 position;attribute vec3 normal;uniform mat4 model;uniform mat4 view;uniform mat4 proj;varying vec3 vNormal;void main(){vNormal=mat3(model)*normal;gl_Position=proj*view*model*vec4(position,1.0);}";
		const litColorFs = "precision mediump float;uniform vec4 color;uniform vec3 ambientColor;uniform float ambientStrength;uniform vec3 lightDirections[" + options.maxSceneLights + "];uniform vec3 lightColors[" + options.maxSceneLights + "];uniform float lightStrengths[" + options.maxSceneLights + "];varying vec3 vNormal;void main(){vec3 n=normalize(vNormal);vec3 lightAccum=ambientColor*ambientStrength;for(int i=0;i<" + options.maxSceneLights + ";i+=1){if(lightStrengths[i]>0.0){float diffuse=max(dot(n,normalize(lightDirections[i])),0.0);lightAccum+=lightColors[i]*(diffuse*lightStrengths[i]);}}gl_FragColor=vec4(color.rgb*min(lightAccum,vec3(1.9)),color.a);}";
		litColorProgram = createProgram(gl, litColorVs, litColorFs, "Scene lit color");
		litColorPositionLoc = gl.getAttribLocation(litColorProgram, "position");
		litColorNormalLoc = gl.getAttribLocation(litColorProgram, "normal");
		litColorModelLoc = gl.getUniformLocation(litColorProgram, "model");
		litColorViewLoc = gl.getUniformLocation(litColorProgram, "view");
		litColorProjLoc = gl.getUniformLocation(litColorProgram, "proj");
		litColorUniformLoc = gl.getUniformLocation(litColorProgram, "color");
		litColorLightingUniforms = options.getLightingUniformLocations ? options.getLightingUniformLocations(gl, litColorProgram) : null;

		const texVs = "attribute vec3 position;attribute vec2 uv;uniform mat4 model;uniform mat4 view;uniform mat4 proj;varying vec2 vUv;void main(){vUv=uv;gl_Position=proj*view*model*vec4(position,1.0);}";
		const texFs = "precision mediump float;uniform sampler2D tex;varying vec2 vUv;void main(){gl_FragColor=texture2D(tex,vUv);}";
		texProgram = createProgram(gl, texVs, texFs, "Scene texture");
		texPositionLoc = gl.getAttribLocation(texProgram, "position");
		texUvLoc = gl.getAttribLocation(texProgram, "uv");
		texModelLoc = gl.getUniformLocation(texProgram, "model");
		texViewLoc = gl.getUniformLocation(texProgram, "view");
		texProjLoc = gl.getUniformLocation(texProgram, "proj");
		texSamplerLoc = gl.getUniformLocation(texProgram, "tex");
	};

	const initResources = function() {
		mrLightingRenderer = createMrLightingRenderer();
		mrLightingRenderer.init(gl);
		punchRenderer = createPunchRenderer();
		punchRenderer.init(gl);
		processedDepthRenderer = createDepthProcessingRenderer({gl: gl, webgl2Bool: webgl2Bool});
		processedDepthRenderer.init();
		worldMaskCompositeRenderer = createWorldMaskCompositeRenderer();
		worldMaskCompositeRenderer.init();
		geometry = createSceneGeometry(gl);
		menuTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, menuTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.CULL_FACE);
	};

	const init = function() {
		gl = canvas.getContext("webgl2", {xrCompatible: true, antialias: true, alpha: true}) || canvas.getContext("webgl", {xrCompatible: true, antialias: true, alpha: true});
		webgl2Bool = !!gl && typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
		if (!gl) {
			options.onInitFailure();
			return null;
		}
		initPrograms();
		initResources();
		return gl;
	};

	return {
		init,
		renderPreviewFrame: renderPreviewPass,
		renderXrViews
	};
};
